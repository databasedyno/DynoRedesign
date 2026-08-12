import { QueryTypes } from "sequelize";
import config from "../utils/config";
import sequelize from "../utils/dbInstance";
import mailTransporter from "../utils/mailTransporter";
import { apiLogger } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";
import {
  baseEmailTemplate,
  getCurrencySymbol,
  infoBox,
  dataRow,
  statCard,
  twoColumnStats,
  p,
  feeRow,
  feeTotalRow,
  feeTable,
} from "../utils/emailTemplate";
import { EMAIL_TOKENS } from "../utils/brandTokens";

/**
 * Payout Digest Service (Session 97, 2026-08-02)
 *
 * Weekly "Coinbase-style" digest email — richer than the existing weekly
 * summary. Covers per-merchant:
 *   • Settled volume (last 7 days, converted to their display currency)
 *   • Platform fees paid
 *   • Transaction count (settled) + delta vs prior week
 *   • Top 3 coins by volume
 *   • Fee tier context ("You're on Starter — X% fee")
 *
 * Consumers:
 *   1. buildPayoutDigest(userId) — pure aggregation, returns the data model
 *   2. sendPayoutDigestForUser(userId) — aggregates + sends the email
 *   3. sendPayoutDigestsToAll() — cron-friendly bulk sender
 *
 * The manual-trigger endpoint POST /api/notifications/payout-digest/preview
 * calls sendPayoutDigestForUser() so a logged-in merchant can send the digest
 * to their own email for QA. In production, the leader cron fires it weekly.
 */

const FRONTEND_BASE_URL = (config.frontendUrl || "https://dynopay.com").replace(
  /\/$/,
  "",
);

// Statuses that count as "settled" (received in the merchant's wallet)
const SETTLED_STATUSES = ["successful", "done", "completed", "paid", "settled", "confirmed"];

export interface CoinBucket {
  symbol: string;
  network?: string | null;
  volumeUsd: number;
  volumeDisplay: number; // volumeUsd converted into the merchant's display currency
  txCount: number;
}

export interface PayoutDigest {
  userId: number;
  companyId?: number | null;
  email: string;
  name: string;
  periodStart: string; // ISO
  periodEnd: string; // ISO
  displayCurrency: string; // e.g. 'USD'
  currencySymbol: string;
  // Current period
  settledVolume: number;
  settledCount: number;
  feesPaid: number;
  // Prior period
  prevVolume: number;
  prevCount: number;
  volumeDeltaPct: number; // % change (this vs prior)
  countDelta: number; // absolute
  // Top coins
  topCoins: CoinBucket[]; // up to 3
  // Fee tier context
  feeTier: {
    name: string; // "Starter" / "Growth" / ...
    percent: number; // 1.5 etc.
  } | null;
  // Rendering guards
  hasActivity: boolean;
  hasPriorActivity: boolean;
}

/**
 * Convert a USD amount into a display-currency amount using the shared,
 * Redis-cached USD→fiat rate (same helper the /transactions export,
 * dashboard tiles, /invoices tax report, and invoice PDF all use).
 * Falls back to identity on failure so the digest never blocks.
 */
async function usdToDisplay(
  usd: number,
  displayCurrency: string,
): Promise<number> {
  if (!usd || usd === 0 || displayCurrency.toUpperCase() === "USD") return usd;
  try {
    const { getUsdToFiatRate } = await import("../utils/currencyUtils");
    const rate = await getUsdToFiatRate(displayCurrency);
    if (!rate || rate <= 0) return usd;
    return Math.round(usd * rate * 100) / 100;
  } catch {
    return usd;
  }
}

/**
 * Aggregate the last 7-day payout picture for a single user.
 *
 * Uses raw SQL (Sequelize) against tbl_user_transaction. Volumes come from the
 * denormalised `usd_value` column (already stored in USD at time of confirmation).
 */
export async function buildPayoutDigest(
  userId: number,
  overrideCompanyId?: number,
): Promise<PayoutDigest | null> {
  // 1. User + display currency
  const userRows = (await sequelize.query(
    `SELECT user_id, name, email, last_company_id
     FROM tbl_user WHERE user_id = :userId LIMIT 1`,
    { replacements: { userId }, type: QueryTypes.SELECT },
  )) as Array<Record<string, unknown>>;
  if (!userRows.length) return null;
  const u = userRows[0];
  const email = String(u.email || "");
  const name = String(u.name || "");
  // Use the shared resolution chain: tbl_user.display_currency →
  // tbl_company.display_currency → legacy base_currency → USD. Same helper
  // the /transactions export, /invoices tax report, and invoice PDF all
  // rely on so every merchant-facing surface stays in lock-step.
  const companyIdForResolve =
    overrideCompanyId ?? (u.last_company_id as number | null) ?? null;
  const { getUserDisplayCurrency } = await import("../utils/currencyUtils");
  const displayCurrency = String(
    await getUserDisplayCurrency(Number(u.user_id), companyIdForResolve),
  ).toUpperCase();
  const currencySymbol = getCurrencySymbol(displayCurrency);
  if (!email) return null;

  // 2. Company scope (default: any company the merchant owns unless caller overrides)
  const companyId = overrideCompanyId ?? null;

  // 3. Time windows
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);

  const statusList = SETTLED_STATUSES.map((s) => `'${s}'`).join(", ");
  const companyClause = companyId ? "AND ut.company_id = :companyId" : "";

  // 4. Aggregate current + previous periods in a single round-trip
  // Fees are pro-rated to USD: (transaction_fee + fixed_fee) * (usd_value / base_amount)
  // to keep the digest currency consistent even when merchants have multi-currency tx history.
  const [aggRow] = (await sequelize.query(
    `SELECT
       COALESCE(SUM(CASE WHEN ut."createdAt" >= :start AND ut."createdAt" < :end
                          AND ut.status IN (${statusList})
                     THEN COALESCE(ut.usd_value, 0) ELSE 0 END), 0) AS cur_volume,
       COUNT(*) FILTER (WHERE ut."createdAt" >= :start AND ut."createdAt" < :end
                          AND ut.status IN (${statusList})) AS cur_count,
       COALESCE(SUM(CASE WHEN ut."createdAt" >= :prevStart AND ut."createdAt" < :prevEnd
                          AND ut.status IN (${statusList})
                     THEN COALESCE(ut.usd_value, 0) ELSE 0 END), 0) AS prev_volume,
       COUNT(*) FILTER (WHERE ut."createdAt" >= :prevStart AND ut."createdAt" < :prevEnd
                          AND ut.status IN (${statusList})) AS prev_count,
       COALESCE(SUM(CASE WHEN ut."createdAt" >= :start AND ut."createdAt" < :end
                          AND ut.status IN (${statusList})
                          AND ut.base_amount > 0
                     THEN (COALESCE(ut.transaction_fee, 0) + COALESCE(ut.fixed_fee, 0))
                          * (COALESCE(ut.usd_value, 0) / NULLIF(ut.base_amount, 0))
                     ELSE 0 END), 0) AS fees_paid
     FROM tbl_user_transaction ut
     WHERE ut.user_id = :userId
       ${companyClause}`,
    {
      replacements: { userId, companyId, start, end, prevStart, prevEnd },
      type: QueryTypes.SELECT,
    },
  )) as Array<Record<string, unknown>>;

  const curVolumeUsd = Number(aggRow?.cur_volume || 0);
  const curCount = Number(aggRow?.cur_count || 0);
  const prevVolumeUsd = Number(aggRow?.prev_volume || 0);
  const prevCount = Number(aggRow?.prev_count || 0);
  const feesPaidUsd = Number(aggRow?.fees_paid || 0);

  // 5. Top coins by USD volume (current window)
  const coinRows = (await sequelize.query(
    `SELECT
       COALESCE(ut.crypto_currency, ut.base_currency) AS symbol,
       COALESCE(SUM(ut.usd_value), 0) AS volume_usd,
       COUNT(*) AS tx_count
     FROM tbl_user_transaction ut
     WHERE ut.user_id = :userId
       ${companyClause}
       AND ut."createdAt" >= :start AND ut."createdAt" < :end
       AND ut.status IN (${statusList})
     GROUP BY COALESCE(ut.crypto_currency, ut.base_currency)
     ORDER BY volume_usd DESC
     LIMIT 3`,
    {
      replacements: { userId, companyId, start, end },
      type: QueryTypes.SELECT,
    },
  )) as Array<Record<string, unknown>>;

  const topCoins: CoinBucket[] = await Promise.all(
    coinRows.map(async (r) => {
      const volumeUsd = Number(r.volume_usd || 0);
      return {
        symbol: String(r.symbol || "—").toUpperCase(),
        network: null,
        volumeUsd,
        // "Fiat Everywhere" — convert each coin's aggregate volume into the
        // merchant's DISPLAY currency so the digest email reads consistently
        // (Top coins section + Total row) alongside the settled-volume/fees
        // tiles above. Uses the same Redis-cached USD→fiat rate.
        volumeDisplay: await usdToDisplay(volumeUsd, displayCurrency),
        txCount: Number(r.tx_count || 0),
      };
    }),
  );

  // 6. Fee tier
  let feeTier: PayoutDigest["feeTier"] = null;
  try {
    const { getVolumeTiers } = await import("../utils/volumeTierUtils");
    // Use cumulative lifetime USD volume for tier selection
    const [lifetimeRow] = (await sequelize.query(
      `SELECT COALESCE(SUM(ut.usd_value), 0) AS lifetime_usd
       FROM tbl_user_transaction ut
       WHERE ut.user_id = :userId
         ${companyClause}
         AND ut.status IN (${statusList})`,
      {
        replacements: { userId, companyId },
        type: QueryTypes.SELECT,
      },
    )) as Array<Record<string, unknown>>;
    const lifetimeUsd = Number(lifetimeRow?.lifetime_usd || 0);
    const tiers = getVolumeTiers();
    const t = tiers.find((tt) => {
      const maxN = tt.max === null ? Number.POSITIVE_INFINITY : tt.max;
      return lifetimeUsd >= tt.min && lifetimeUsd < maxN;
    }) || tiers[tiers.length - 1];
    feeTier = { name: t.displayName, percent: t.percent };
  } catch (e) {
    feeTier = null;
  }

  // 7. Convert volumes to display currency for the email numbers
  const settledVolume = await usdToDisplay(curVolumeUsd, displayCurrency);
  const feesPaid = await usdToDisplay(feesPaidUsd, displayCurrency);
  const prevVolume = await usdToDisplay(prevVolumeUsd, displayCurrency);

  const volumeDeltaPct =
    prevVolumeUsd > 0
      ? Math.round(((curVolumeUsd - prevVolumeUsd) / prevVolumeUsd) * 1000) / 10
      : curVolumeUsd > 0
        ? 100
        : 0;
  const countDelta = curCount - prevCount;

  return {
    userId: Number(u.user_id),
    companyId: companyId ?? null,
    email,
    name,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    displayCurrency,
    currencySymbol,
    settledVolume,
    settledCount: curCount,
    feesPaid,
    prevVolume,
    prevCount,
    volumeDeltaPct,
    countDelta,
    topCoins,
    feeTier,
    hasActivity: curCount > 0 || curVolumeUsd > 0,
    hasPriorActivity: prevCount > 0 || prevVolumeUsd > 0,
  };
}

/**
 * Format a number as "$1,234.56" in the merchant's display currency.
 */
function fmtMoney(amount: number, symbol: string, currency: string): string {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted} ${currency}`;
}

/**
 * Render + send the digest email for one aggregated payload.
 * Never throws — errors are captured and logged; returns { sent: boolean }.
 */
export async function sendPayoutDigestEmail(
  d: PayoutDigest,
): Promise<{ sent: boolean; skipped?: string }> {
  try {
    if (!d.email) return { sent: false, skipped: "no-email" };
    // Zero-activity accounts still receive the digest but with a "no volume this
    // week" note — Coinbase pattern: keep engagement even on quiet weeks.
    const subject = d.hasActivity
      ? `Weekly payout digest — ${fmtMoney(d.settledVolume, d.currencySymbol, d.displayCurrency)}`
      : `Weekly payout digest — quiet week ahead of a new one`;

    const periodLabel = `${new Date(d.periodStart).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    })} – ${new Date(d.periodEnd).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`;

    // Delta chip HTML
    const positive = d.volumeDeltaPct >= 0;
    const deltaColor = positive ? EMAIL_TOKENS.greenDeep : EMAIL_TOKENS.muted;
    const deltaBg = positive ? EMAIL_TOKENS.greenSurface : "#f1f5f9";
    const deltaArrow = positive ? "▲" : "▼";
    const deltaText = d.hasPriorActivity
      ? `${deltaArrow} ${Math.abs(d.volumeDeltaPct).toFixed(1)}%`
      : "New this week";
    const deltaChip = `<span style="display:inline-block; background:${deltaBg}; color:${deltaColor}; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${deltaText}</span>`;

    // Stat cards row: Settled | Fees paid
    const settledCard = statCard(
      "Settled this week",
      fmtMoney(d.settledVolume, d.currencySymbol, d.displayCurrency),
      `${d.settledCount} payment${d.settledCount === 1 ? "" : "s"}`,
      "green",
    );
    const feesCard = statCard(
      "Platform fees",
      fmtMoney(d.feesPaid, d.currencySymbol, d.displayCurrency),
      d.feeTier ? `${d.feeTier.name} tier — ${d.feeTier.percent}%` : "This period",
      "blue",
    );
    const statsRow = twoColumnStats(settledCard, feesCard);

    // Top coins section — feeRow reuse for consistent style, feeTotalRow for the total
    let topCoinsSection = "";
    if (d.topCoins.length > 0) {
      const rows = d.topCoins
        .map((c) => {
          const vol = fmtMoney(c.volumeDisplay, d.currencySymbol, d.displayCurrency);
          return feeRow(
            `<strong>${c.symbol}</strong> — ${c.txCount} tx`,
            vol,
            false,
          );
        })
        .join("");
      const totalRow = feeTotalRow(
        "Total across top coins",
        fmtMoney(
          d.topCoins.reduce((s, c) => s + c.volumeDisplay, 0),
          d.currencySymbol,
          d.displayCurrency,
        ),
      );
      topCoinsSection = feeTable(rows + totalRow);
    }

    // Comparison row
    const compareRow = d.hasPriorActivity
      ? p(
          `Compared to last week (${fmtMoney(
            d.prevVolume,
            d.currencySymbol,
            d.displayCurrency,
          )}, ${d.prevCount} payment${d.prevCount === 1 ? "" : "s"}): ${deltaChip}`,
        )
      : d.hasActivity
        ? p(`This is your first active week — welcome to the weekly digest. ${deltaChip}`)
        : p(
            `Nothing settled this week. Send a payment link to a customer and let's get the first one through: <a href="${FRONTEND_BASE_URL}/create-pay-link" style="color:${EMAIL_TOKENS.brand};font-weight:600;">Create a payment link →</a>`,
          );

    // Info box: quick summary + link
    const heroInfo = infoBox(
      `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow("Period", periodLabel)}
        ${dataRow("Payments settled", `<strong>${d.settledCount}</strong>`)}
        ${dataRow(
          "Change vs prior week",
          d.hasPriorActivity ? deltaChip : "New this week",
          true,
        )}
      </table>
    `,
    );

    const heading = d.hasActivity
      ? `Your weekly payout digest`
      : `Weekly payout digest — quiet week`;

    const content = `
      ${p(`Hey ${d.name || "there"},`)}
      ${p(`Here's how the last 7 days looked for your business on DynoPay.`)}
      ${statsRow}
      ${heroInfo}
      ${topCoinsSection}
      ${compareRow}
      ${p(
        `Open your dashboard to explore transactions, adjust wallets, or share a new payment link.`,
      )}
    `;

    const html = baseEmailTemplate(heading, content, {
      showButton: true,
      buttonText: "Open dashboard",
      buttonLink: `${FRONTEND_BASE_URL}/dashboard`,
    });

    await mailTransporter({
      to: d.email,
      name: d.name,
      subject,
      body: html,
    });
    apiLogger.info(
      `[PayoutDigest] sent to ${d.email} — settled=${d.settledVolume} ${d.displayCurrency}, count=${d.settledCount}`,
    );
    return { sent: true };
  } catch (e) {
    apiLogger.error("[PayoutDigest] send error", e);
    captureError(e, "email", { extraContext: "sendPayoutDigestEmail" });
    return { sent: false, skipped: "error" };
  }
}

/**
 * Manual trigger — send the current-user's digest to their own email.
 * Called by the /api/notifications/payout-digest/preview route.
 */
export async function sendPayoutDigestForUser(
  userId: number,
): Promise<{ sent: boolean; digest?: PayoutDigest; skipped?: string }> {
  const d = await buildPayoutDigest(userId);
  if (!d) return { sent: false, skipped: "user-not-found" };
  const r = await sendPayoutDigestEmail(d);
  return { ...r, digest: d };
}

/**
 * Cron entry point — sends digests to every active merchant.
 *
 * Definition of "active":
 *   • Has verified email
 *   • Has status = 'active'
 *   • Has at least one settled transaction ever (skip freshly-signed-up empties)
 */
export async function sendPayoutDigestsToAll(): Promise<{
  attempted: number;
  sent: number;
  skipped: number;
}> {
  const statusList = SETTLED_STATUSES.map((s) => `'${s}'`).join(", ");
  const rows = (await sequelize.query(
    `SELECT DISTINCT u.user_id
     FROM tbl_user u
     JOIN tbl_user_transaction ut ON ut.user_id = u.user_id
     WHERE u.status = 'active'
       AND u.email IS NOT NULL AND u.email <> ''
       AND ut.status IN (${statusList})`,
    { type: QueryTypes.SELECT },
  )) as Array<Record<string, unknown>>;
  let sent = 0;
  let skipped = 0;
  for (const r of rows) {
    const userId = Number(r.user_id);
    try {
      const result = await sendPayoutDigestForUser(userId);
      if (result.sent) sent += 1;
      else skipped += 1;
    } catch (e) {
      skipped += 1;
      apiLogger.error(`[PayoutDigest] bulk send failed for user ${userId}`, e);
    }
  }
  apiLogger.info(
    `[PayoutDigest] bulk complete — attempted=${rows.length} sent=${sent} skipped=${skipped}`,
  );
  return { attempted: rows.length, sent, skipped };
}
