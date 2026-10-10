import { QueryTypes } from "sequelize";
import config from "../utils/config";
import sequelize from "../utils/dbInstance";
import mailTransporter from "../utils/mailTransporter";
import { t, resolveLangByEmail } from "../utils/emailI18n";
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
import { dispatchCompanyEmail } from "./email/companyDispatch";
import { mul, sum, toFixedStr, toNumber } from "../utils/money";

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

export interface BrandBucket {
  companyId: number;
  name: string;
  volumeUsd: number;
  volumeDisplay: number;
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
  // Account-wide digests (no companyId override) sum EVERY brand the merchant
  // owns. `brands` is the per-brand split of settledVolume for this period and
  // `totalBrands` how many brands the account has, so the email/notification
  // can say "covers all N brands" instead of silently merging them.
  brands: BrandBucket[];
  totalBrands: number;
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
    return toNumber(mul(usd, rate), 2);
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
  const { getUserDisplayCurrency, resolveDisplayFx } = await import("../utils/currencyUtils");
  // No USD→brand rate → the whole digest is in USD (label and numbers agree).
  const digestFx = await resolveDisplayFx(
    String(await getUserDisplayCurrency(Number(u.user_id), companyIdForResolve)),
  );
  const displayCurrency = digestFx.currency;
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

  // 6. Per-brand split + brand count (account-wide digests only)
  const brandRows = (await sequelize.query(
    `SELECT c.company_id, c.company_name,
            COALESCE(SUM(ut.usd_value), 0) AS volume_usd,
            COUNT(ut.transaction_id) FILTER (
              WHERE ut."createdAt" >= :start AND ut."createdAt" < :end AND ut.status IN (${statusList})
            ) AS tx_count
     FROM tbl_company c
     LEFT JOIN tbl_user_transaction ut
       ON ut.company_id = c.company_id
      AND ut."createdAt" >= :start AND ut."createdAt" < :end
      AND ut.status IN (${statusList})
     WHERE c.user_id = :userId
       ${companyId ? "AND c.company_id = :companyId" : ""}
     GROUP BY c.company_id, c.company_name
     ORDER BY volume_usd DESC, c.company_id ASC`,
    { replacements: { userId, companyId, start, end }, type: QueryTypes.SELECT },
  )) as Array<Record<string, unknown>>;
  const totalBrands = brandRows.length;
  const brands: BrandBucket[] = await Promise.all(
    brandRows
      .filter((r) => Number(r.tx_count || 0) > 0)
      .map(async (r) => {
        const volumeUsd = Number(r.volume_usd || 0);
        return {
          companyId: Number(r.company_id),
          name: String(r.company_name || `Brand #${r.company_id}`),
          volumeUsd,
          volumeDisplay: await usdToDisplay(volumeUsd, displayCurrency),
          txCount: Number(r.tx_count || 0),
        };
      }),
  );

  // 7. Fee tier
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

  // 8. Convert volumes to display currency for the email numbers
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
    brands,
    totalBrands,
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

const escapeHtmlText = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const PAYOUT_DIGEST_NOTIFICATION_TYPE = "payout_digest_weekly";

/** Plain-text summary used for the in-app notification (no HTML). */
export function buildPayoutDigestNotificationText(d: PayoutDigest, lang: string): { title: string; message: string } {
  const money = (n: number) => fmtMoney(n, d.currencySymbol, d.displayCurrency);
  const dtLocale =
    ({ en: "en-GB", pt: "pt-PT", es: "es-ES", fr: "fr-FR", de: "de-DE", nl: "nl-NL" } as Record<string, string>)[lang] || "en-GB";
  const period = `${new Date(d.periodStart).toLocaleDateString(dtLocale, { day: "2-digit", month: "short" })} – ${new Date(d.periodEnd).toLocaleDateString(dtLocale, { day: "2-digit", month: "short" })}`;
  const isAccountWide = !d.companyId && d.totalBrands > 1;
  const title = d.hasActivity
    ? t("payoutDigest.subjectActive", lang, { amount: money(d.settledVolume) })
    : t("payoutDigest.subjectQuiet", lang);
  const parts: string[] = [];
  parts.push(
    d.hasActivity
      ? t("payoutDigest.notifBody", lang, { period, count: d.settledCount, fees: money(d.feesPaid), net: money(Math.max(0, d.settledVolume - d.feesPaid)) })
      : t("payoutDigest.notifBodyQuiet", lang, { period }),
  );
  if (isAccountWide) {
    const split = d.brands.map((b) => `${b.name} ${money(b.volumeDisplay)}`).join(" · ");
    parts.push(t("payoutDigest.allBrandsNote", lang, { count: d.totalBrands }) + (split ? ` ${t("payoutDigest.notifSplitPrefix", lang)} ${split}.` : ""));
  }
  return { title, message: parts.join(" ") };
}

async function createPayoutDigestNotifications(d: PayoutDigest, lang: string): Promise<void> {
  try {
    const { createNotification } = await import("../controller/notificationController");
    const { title, message } = buildPayoutDigestNotificationText(d, lang);
    const targets = d.companyId
      ? [d.companyId]
      : ((await sequelize.query(`SELECT company_id FROM tbl_company WHERE user_id = :userId`, {
          replacements: { userId: d.userId },
          type: QueryTypes.SELECT,
        })) as Array<{ company_id: number }>).map((r) => Number(r.company_id));
    const data = {
      period_start: d.periodStart,
      period_end: d.periodEnd,
      settled_volume: d.settledVolume,
      settled_count: d.settledCount,
      fees_paid: d.feesPaid,
      display_currency: d.displayCurrency,
      all_brands: !d.companyId && d.totalBrands > 1,
      total_brands: d.totalBrands,
      brands: d.brands.map((b) => ({ company_id: b.companyId, name: b.name, settled: b.volumeDisplay, count: b.txCount })),
    };
    for (const companyId of targets) {
      const [existing] = (await sequelize.query(
        `SELECT 1 FROM tbl_notification
         WHERE user_id = :userId AND company_id = :companyId AND type = :type
           AND created_at >= NOW() - INTERVAL '6 days'
         LIMIT 1`,
        { replacements: { userId: d.userId, companyId, type: PAYOUT_DIGEST_NOTIFICATION_TYPE }, type: QueryTypes.SELECT },
      )) as unknown[];
      if (existing) continue; // already surfaced this week's digest for this brand
      await createNotification(d.userId, PAYOUT_DIGEST_NOTIFICATION_TYPE, title, message, data, companyId);
    }
  } catch (e) {
    apiLogger.error("[PayoutDigest] in-app notification failed", e);
  }
}

/**
 * Render + send the digest email for one aggregated payload.
 * Never throws — errors are captured and logged; returns { sent: boolean }.
 */
/** Pure render (no send) — exported so the digest can be previewed/tested offline. */
export async function renderPayoutDigestEmail(
  d: PayoutDigest,
): Promise<{ subject: string; html: string; lang: string }> {
    // Zero-activity accounts still receive the digest but with a "no volume this
    // week" note — Coinbase pattern: keep engagement even on quiet weeks.
    const lang = await resolveLangByEmail(d.email);
    const dtLocale =
      ({ en: "en-GB", pt: "pt-PT", es: "es-ES", fr: "fr-FR", de: "de-DE", nl: "nl-NL" } as Record<string, string>)[lang] ||
      "en-GB";
    const paymentsLabel = (n: number) =>
      `${n} ${n === 1 ? t("payoutDigest.paymentSingular", lang) : t("payoutDigest.paymentPlural", lang)}`;
    const subject = d.hasActivity
      ? t("payoutDigest.subjectActive", lang, { amount: fmtMoney(d.settledVolume, d.currencySymbol, d.displayCurrency) })
      : t("payoutDigest.subjectQuiet", lang);

    const periodLabel = `${new Date(d.periodStart).toLocaleDateString(dtLocale, {
      day: "2-digit",
      month: "short",
    })} – ${new Date(d.periodEnd).toLocaleDateString(dtLocale, {
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
      ? `${deltaArrow} ${toFixedStr(Math.abs(d.volumeDeltaPct), 1)}%`
      : t("payoutDigest.newThisWeek", lang);
    const deltaChip = `<span class="${positive ? 'chip chip-success' : 'chip'}" style="display:inline-block; background:${deltaBg}; color:${deltaColor}; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${deltaText}</span>`;

    // Stat cards row: Settled | Fees paid
    const settledCard = statCard(
      t("payoutDigest.settledThisWeek", lang),
      fmtMoney(d.settledVolume, d.currencySymbol, d.displayCurrency),
      paymentsLabel(d.settledCount),
      "green",
    );
    const feesCard = statCard(
      t("payoutDigest.platformFees", lang),
      fmtMoney(d.feesPaid, d.currencySymbol, d.displayCurrency),
      d.feeTier ? t("payoutDigest.feeTierContext", lang, { name: d.feeTier.name, percent: d.feeTier.percent }) : t("payoutDigest.thisPeriod", lang),
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
        t("payoutDigest.totalTopCoins", lang),
        fmtMoney(
          sum(d.topCoins.map((c) => c.volumeDisplay)).toNumber(),
          d.currencySymbol,
          d.displayCurrency,
        ),
      );
      topCoinsSection = feeTable(rows + totalRow, t("payoutDigest.topCoinsTitle", lang));
    }

    // Comparison row
    const compareRow = d.hasPriorActivity
      ? p(
          t("payoutDigest.compareToLast", lang, {
            prevAmount: fmtMoney(d.prevVolume, d.currencySymbol, d.displayCurrency),
            prevCountLabel: paymentsLabel(d.prevCount),
            delta: deltaChip,
          }),
        )
      : d.hasActivity
        ? p(t("payoutDigest.firstActiveWeek", lang, { delta: deltaChip }))
        : p(
            t("payoutDigest.nothingSettled", lang, {
              link: `<a href="${FRONTEND_BASE_URL}/create-pay-link" style="color:${EMAIL_TOKENS.brandDeep};font-weight:600;text-decoration:underline;">${t("payoutDigest.createPayLink", lang)}</a>`,
            }),
          );

    // Info box: quick summary + link
    const heroInfo = infoBox(
      `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t("payoutDigest.period", lang), periodLabel)}
        ${dataRow(t("payoutDigest.paymentsSettled", lang), `<strong>${d.settledCount}</strong>`)}
        ${dataRow(t("payoutDigest.grossSettled", lang), fmtMoney(d.settledVolume, d.currencySymbol, d.displayCurrency))}
        ${dataRow(t("payoutDigest.feesPaidRow", lang), `−${fmtMoney(d.feesPaid, d.currencySymbol, d.displayCurrency)}`)}
        ${dataRow(t("payoutDigest.netReceived", lang), `<strong>${fmtMoney(Math.max(0, d.settledVolume - d.feesPaid), d.currencySymbol, d.displayCurrency)}</strong>`)}
        ${dataRow(
          t("payoutDigest.changeVsPrior", lang),
          d.hasPriorActivity ? deltaChip : t("payoutDigest.newThisWeek", lang),
          true,
        )}
      </table>
    `,
    );
    const statementLink = `<a href="${FRONTEND_BASE_URL}/invoices" style="color:${EMAIL_TOKENS.brandDeep};font-weight:600;text-decoration:underline;">${t("payoutDigest.downloadStatement", lang)}</a>`;

    const heading = d.hasActivity
      ? t("payoutDigest.headingActive", lang)
      : t("payoutDigest.headingQuiet", lang);

    // Account-wide scope note + per-brand split. Only shown when the account has
    // more than one brand — a single-brand merchant sees the email unchanged.
    const isAccountWide = !d.companyId && d.totalBrands > 1;
    const scopeNote = isAccountWide
      ? p(
          `<strong>${t("payoutDigest.allBrandsNote", lang, { count: d.totalBrands })}</strong> ${t("payoutDigest.allBrandsHint", lang)}`,
          `background:${EMAIL_TOKENS.greenSurface};border-radius:8px;padding:10px 12px;font-size:13px;`,
        )
      : "";
    let brandsSection = "";
    if (isAccountWide && d.brands.length > 0) {
      const rows = d.brands
        .map((b) => feeRow(`<strong>${escapeHtmlText(b.name)}</strong> — ${paymentsLabel(b.txCount)}`, fmtMoney(b.volumeDisplay, d.currencySymbol, d.displayCurrency), false))
        .join("");
      brandsSection = feeTable(
        rows + feeTotalRow(t("payoutDigest.perBrandTotal", lang), fmtMoney(d.settledVolume, d.currencySymbol, d.displayCurrency)),
        t("payoutDigest.perBrandTitle", lang),
      );
    }

    const content = `
      ${p(d.name ? t("common.greeting", lang, { name: d.name }) : t("common.greetingDefault", lang))}
      ${p(t("payoutDigest.intro", lang))}
      ${scopeNote}
      ${statsRow}
      ${heroInfo}
      ${brandsSection}
      ${topCoinsSection}
      ${compareRow}
      ${d.hasActivity ? p(t("payoutDigest.statementBody", lang, { link: statementLink }), "font-size:13px;color:#6b7280;") : ""}
      ${p(t("payoutDigest.openDashboardBody", lang))}
    `;

    const html = baseEmailTemplate(heading, content, {
      lang,
      preheader: d.hasActivity
        ? t("payoutDigest.preheaderActive", lang)
        : t("payoutDigest.preheaderQuiet", lang),
      showButton: true,
      buttonText: t("payoutDigest.openDashboard", lang),
      buttonLink: `${FRONTEND_BASE_URL}/transactions?range=7d`,
    });
    return { subject, html, lang };
}

export async function sendPayoutDigestEmail(
  d: PayoutDigest,
  opts?: { fanout?: boolean },
): Promise<{ sent: boolean; skipped?: string }> {
  try {
    if (!d.email) return { sent: false, skipped: "no-email" };
    const { subject, html, lang } = await renderPayoutDigestEmail(d);

    // Cron path fans the company digest out to team members (deduped + RBAC via
    // notificationRecipients); the manual "send me a preview" path stays single.
    if (opts?.fanout && d.companyId) {
      await dispatchCompanyEmail(
        d.companyId,
        "digests",
        { email: d.email, name: d.name },
        (email, name) => mailTransporter({ to: email, name, subject, body: html }),
      );
    } else {
      await mailTransporter({
        to: d.email,
        name: d.name,
        subject,
        body: html,
      });
    }
    apiLogger.info(
      `[PayoutDigest] sent to ${d.email} — settled=${d.settledVolume} ${d.displayCurrency}, count=${d.settledCount}`,
    );
    // Mirror the email in the dashboard inbox of EVERY brand on the account, so
    // the digest is visible no matter which brand is selected (the inbox is
    // company-scoped). Idempotent per brand per week, so the manual "send me a
    // preview" button can be used to (re)surface this week's digest safely.
    await createPayoutDigestNotifications(d, lang);
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
  opts?: { fanout?: boolean },
): Promise<{ sent: boolean; digest?: PayoutDigest; skipped?: string }> {
  const d = await buildPayoutDigest(userId);
  if (!d) return { sent: false, skipped: "user-not-found" };
  const r = await sendPayoutDigestEmail(d, opts);
  return { ...r, digest: d };
}

/**
 * Cron entry point — sends digests to every OPTED-IN active merchant.
 *
 * Definition of "eligible":
 *   • Opted in (tbl_notification_preferences.payout_digest_weekly = true)
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
       AND ut.status IN (${statusList})
       AND EXISTS (
         SELECT 1 FROM tbl_notification_preferences np
         WHERE np.user_id = u.user_id AND np.payout_digest_weekly = true
       )`,
    { type: QueryTypes.SELECT },
  )) as Array<Record<string, unknown>>;
  let sent = 0;
  let skipped = 0;
  for (const r of rows) {
    const userId = Number(r.user_id);
    try {
      const result = await sendPayoutDigestForUser(userId, { fanout: true });
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
