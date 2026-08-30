/**
 * Referral MONTHLY DIGEST (2026-08 fork).
 *
 * On the 1st of each month, email every referrer a recap of what they earned in
 * the PRIOR calendar month — "your referrals earned you $X" — with a per-merchant
 * breakdown. Referrers who earned $0 last month are skipped (no spam).
 *
 * The monthly figure is computed READ-ONLY from settled fees using the SAME formula
 * + status filter + activation/12-month-window bounds as accrual, so it always
 * reconciles with the balance. It touches NO watermark and moves NO money.
 *
 * Idempotent: a per-referrer-per-month Redis key ensures each referrer gets exactly
 * one digest per month even if the cron double-fires or the leader is re-elected.
 * Leader/prod only (registered inside setupReferralRewardCron); outbound email is
 * additionally gated by DISABLE_OUTBOUND_EMAIL.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { apiLogger } from "../utils/loggers";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { sendReferralMonthlyDigestEmail } from "./email/referralEmails";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Previous calendar month window in UTC: [firstOfPrevMonth, firstOfThisMonth). */
export const getPrevMonthWindowUTC = (now: Date = new Date()): { start: Date; end: Date; label: string; key: string } => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // current month 0-11
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const label = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, label, key };
};

interface DigestRow {
  referral_id: number;
  referrer_id: number;
  referrer_email: string | null;
  referrer_name: string | null;
  mode: string | null;
  rate: number;
  merchant_name: string | null;
  merchant_email: string | null;
  fees_usd: number;
}

const FEE_USD_EXPR =
  "(COALESCE(ut.transaction_fee,0)+COALESCE(ut.fixed_fee,0))*(COALESCE(ut.usd_value,0)/NULLIF(ut.base_amount,0))";

/**
 * Compute prior-month referral earnings for every referrer (grouped per referral),
 * respecting activation time + the 12-month commission window. Read-only.
 */
export const computeMonthlyReferralEarnings = async (
  window: { start: Date; end: Date }
): Promise<Map<number, { email: string; name: string; mode: string; total: number; perMerchant: Array<{ name: string; usd: number }> }>> => {
  const rows = await sequelize.query<DigestRow>(
    `SELECT rf.referral_id AS referral_id,
            rf.referrer_user_id AS referrer_id,
            ru.email AS referrer_email,
            ru.name AS referrer_name,
            ru.referral_payout_mode AS mode,
            COALESCE(rf.commission_rate, 0.25) AS rate,
            m.name AS merchant_name,
            m.email AS merchant_email,
            COALESCE(SUM(${FEE_USD_EXPR}), 0)::float AS fees_usd
       FROM tbl_referral rf
       JOIN tbl_user ru ON ru.user_id = rf.referrer_user_id
       JOIN tbl_user m ON m.user_id = rf.referred_user_id
       JOIN tbl_user_transaction ut ON ut.user_id = rf.referred_user_id
      WHERE rf.status IN ('active','rewarded')
        AND ut.base_amount > 0
        AND ut.status IN ('successful','done','completed')
        AND ut."createdAt" >= :start AND ut."createdAt" < :end
        AND ut."createdAt" > rf.activated_at
        AND (rf.commission_window_ends_at IS NULL OR ut."createdAt" <= rf.commission_window_ends_at)
      GROUP BY rf.referral_id, rf.referrer_user_id, ru.email, ru.name, ru.referral_payout_mode, rf.commission_rate, m.name, m.email
      HAVING COALESCE(SUM(${FEE_USD_EXPR}), 0) > 0`,
    { replacements: { start: window.start, end: window.end }, type: QueryTypes.SELECT }
  );

  const byReferrer = new Map<
    number,
    { email: string; name: string; mode: string; total: number; perMerchant: Array<{ name: string; usd: number }> }
  >();

  for (const r of rows) {
    const commission = round2(Number(r.fees_usd || 0) * (Number(r.rate) || 0.25));
    if (commission <= 0) continue;
    const email = (r.referrer_email || "").trim();
    if (!email) continue;
    const entry =
      byReferrer.get(r.referrer_id) ||
      { email, name: r.referrer_name || email, mode: (r.mode as string) || "credit", total: 0, perMerchant: [] };
    entry.total = round2(entry.total + commission);
    entry.perMerchant.push({ name: r.merchant_name || r.merchant_email || `Merchant #${r.referral_id}`, usd: commission });
    byReferrer.set(r.referrer_id, entry);
  }

  // Biggest contributor first in each breakdown.
  for (const e of byReferrer.values()) e.perMerchant.sort((a, b) => b.usd - a.usd);
  return byReferrer;
};

/**
 * Send the monthly digest to all referrers who earned > 0 last month.
 * @param opts.now      override "now" (tests)
 * @param opts.dryRun   compute + (email fn still called, suppressed by DISABLE_OUTBOUND_EMAIL)
 *                      but do NOT write the idempotency key (so a harness can re-run).
 */
export const sendMonthlyReferralDigests = async (
  opts?: { now?: Date; dryRun?: boolean }
): Promise<{ referrers: number; totalUsd: number; sent: number; skipped: number }> => {
  const now = opts?.now ?? new Date();
  const dryRun = !!opts?.dryRun;
  const { start, end, label, key } = getPrevMonthWindowUTC(now);

  const byReferrer = await computeMonthlyReferralEarnings({ start, end });
  let sent = 0;
  let skipped = 0;
  let totalUsd = 0;

  for (const [referrerId, info] of byReferrer.entries()) {
    totalUsd = round2(totalUsd + info.total);
    if (info.total < 0.01) { skipped++; continue; }

    const idemKey = `referral-digest-sent:${referrerId}:${key}`;
    if (!dryRun) {
      try {
        const already = await getRedisItem(idemKey);
        if (already) { skipped++; continue; }
      } catch { /* redis down -> fall through and still send (better than silent skip) */ }
    }

    await sendReferralMonthlyDigestEmail(info.email, info.name, label, info.total, info.perMerchant, info.mode);
    sent++;

    if (!dryRun) {
      try {
        await setRedisItemWithTTL(idemKey, { sentAt: new Date().toISOString(), totalUsd: info.total }, 45 * 24 * 3600);
      } catch { /* non-fatal */ }
    }
  }

  if (sent > 0 || byReferrer.size > 0) {
    apiLogger.info(
      `[Referral] Monthly digest (${label}) — ${sent} sent / ${skipped} skipped of ${byReferrer.size} earning referrer(s), $${totalUsd.toFixed(2)} total`
    );
  }
  return { referrers: byReferrer.size, totalUsd, sent, skipped };
};

export default { getPrevMonthWindowUTC, computeMonthlyReferralEarnings, sendMonthlyReferralDigests };
