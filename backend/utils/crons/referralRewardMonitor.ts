/**
 * Referral Reward Monitor Cron
 * Schedule: every 15 minutes at :10 / :25 / :40 / :55
 *
 * Unified referral program (revenue-share, 2026-08):
 *   A) ACTIVATION + ACCRUAL — when a REFERRED merchant takes their first qualifying
 *      ($100+) payment, the referral is ACTIVATED (opens a 12-month window) via
 *      referralService.processReferrerReward. Then, every cycle, we accrue 25% of
 *      that merchant's platform fees into the referrer's running balance
 *      (referralService.accrueActiveReferralCommissions — idempotent, window-capped).
 *      Delivered as fee-credit by default; opt-in USDT-TRC20 cash-out is Phase 2.
 *   B) POST-PAYMENT CUSTOMER INVITE — when a CUSTOMER (payer) with no Dynopay
 *      account completes a payment, email them a one-time 50%/30d invite to open
 *      their own merchant account. This REPLACES the old invite-at-link-creation
 *      (the invite now fires only after the customer actually pays).
 *
 * Registered inside registerLeaderCronJobs() in server.ts, so it runs ONLY on the
 * leader instance with ENABLE_BACKGROUND_JOBS=true — never in preview/SAFE MODE.
 * Outbound email is additionally gated by DISABLE_OUTBOUND_EMAIL (mailTransporter).
 */
import cron from "node-cron";
import { QueryTypes } from "sequelize";
import sequelize from "../dbInstance";
import { log } from "../loggers";
import { captureError } from "../../services/errorMonitoringService";

export const setupReferralRewardCron = () => {
  cron.schedule("10,25,40,55 * * * *", async () => {
    try {
      await processPendingReferrerRewards();
      await expireStalePendingReferrals(); // F3: expire stale pending past 90-day window
    } catch (e) {
      log(`Referral Reward Monitor (rewards) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:rewards" });
    }
    try {
      // Revenue-share: accrue 25% of each referred merchant's platform fees into
      // the referrer's running balance (idempotent watermark; window-capped), then
      // reconcile refunds/chargebacks by clawing back commission on reversed fees.
      const { accrueActiveReferralCommissions, clawbackReversedReferralCommissions } = await import(
        "../../services/referralService"
      );
      await accrueActiveReferralCommissions();
      await clawbackReversedReferralCommissions(); // F5: refund/chargeback clawback
    } catch (e) {
      log(`Referral Reward Monitor (accrual) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:accrual" });
    }
    try {
      // Revenue-share: threshold nudge + auto cash-out. Nudge emails referrers once
      // their balance crosses the minimum; auto creates 'pending' payout rows for
      // opted-in referrers (the payouts block below then sends them). Leader/prod only.
      const { processReferralNudges, processAutoPayouts } = await import(
        "../../services/referralPayoutAutomation"
      );
      await processReferralNudges();
      await processAutoPayouts();
    } catch (e) {
      log(`Referral Reward Monitor (nudge/auto) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:nudgeAuto" });
    }
    try {
      // Revenue-share CASH-OUT (Phase 2): submit any 'pending' USDT-TRC20 payouts
      // to Binance (treasury-guarded) and poll 'processing' ones to completion.
      // Leader/prod only; NEVER runs in SAFE-MODE preview (Binance geo-blocked there).
      const { processReferralPayouts, monitorReferralPayouts } = await import(
        "../../services/referralPayoutCron"
      );
      await processReferralPayouts();
      await monitorReferralPayouts();
    } catch (e) {
      log(`Referral Reward Monitor (payouts) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:payouts" });
    }
    try {
      await sendPostPaymentInvites();
    } catch (e) {
      log(`Referral Reward Monitor (invites) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:invites" });
    }
  });

  // Monthly referral DIGEST — 1st of each month at 09:00 UTC. Emails every referrer
  // a recap of what they earned LAST month (per-merchant breakdown; skips $0). A Redis
  // lock + per-referrer/month key make it safe against double-fire / leader re-election.
  cron.schedule("0 9 1 * *", async () => {
    try {
      const { acquireLock } = await import("../redisInstance");
      const locked = await acquireLock("cron:referralMonthlyDigest", 600, 1, 100, true);
      if (!locked) return;
      const { sendMonthlyReferralDigests } = await import("../../services/referralDigestService");
      const r = await sendMonthlyReferralDigests();
      log(`Referral monthly digest: ${r.sent} sent / ${r.skipped} skipped ($${r.totalUsd.toFixed(2)} total)`, "info");
    } catch (e) {
      log(`Referral Monthly Digest error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:monthlyDigest" });
    }
  });

  // Referral SHARE NUDGE — daily at 14:30 UTC. Emails active merchants who have a
  // referral code but have NEVER referred anyone (0 referrals, $0 earned) to start
  // sharing. Per-referrer Redis idempotency (30d) means each is nudged at most once
  // a month; a daily lock guards against double-fire / leader re-election.
  cron.schedule("30 14 * * *", async () => {
    try {
      const { acquireLock } = await import("../redisInstance");
      const locked = await acquireLock("cron:referralShareNudge", 600, 1, 100, true);
      if (!locked) return;
      const { sendReferralShareNudges } = await import("../../services/referralNudgeService");
      const r = await sendReferralShareNudges({ dryRun: false });
      log(`Referral share nudge: ${r.sent} sent / ${r.skipped} skipped of ${r.scanned} scanned`, "info");
    } catch (e) {
      log(`Referral Share Nudge error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:shareNudge" });
    }
  });

  log("Referral Reward Monitor Cron scheduled for every 15 minutes (+ monthly digest 1st @ 09:00 UTC, share nudge daily @ 14:30 UTC)", "info");
};

/**
 * USD-pegged currencies whose stored base_amount already IS the USD value, so the
 * $100 activation gate needs no FX call for them (the overwhelming common case).
 */
const USD_PEGGED = new Set([
  "USD", "USDT", "USDC", "BUSD", "DAI",
  "USDT-TRC20", "USDT-ERC20", "USDC-ERC20",
  "USDT_TRC20", "USDT_ERC20", "USDC_ERC20",
  "USDT-POLYGON", "USDT_POLYGON",
]);

/**
 * A) Unlock the referrer's reward once the referred merchant has received their
 *    first qualifying ($100+ USD) successful payment since being referred, WITHIN
 *    the 90-day activation window.
 *
 * F3: only payments with `t."createdAt" <= r.expires_at` qualify (90-day window).
 * F6: the $100 gate is evaluated in USD, not the raw base_currency amount. We fetch
 *     the largest successful in-window payment PER (referred_user, currency) so USD
 *     normalization needs at most one FX conversion per distinct currency.
 */
export const processPendingReferrerRewards = async () => {
  const rows = await sequelize.query<{
    referred_user_id: number;
    base_currency: string | null;
    max_amount: string | null;
  }>(
    `SELECT r.referred_user_id,
            UPPER(COALESCE(t.base_currency, 'USD')) AS base_currency,
            MAX(t.base_amount) AS max_amount
       FROM tbl_referral r
       JOIN tbl_company c ON c.user_id = r.referred_user_id
       JOIN tbl_customer_transaction t ON t.company_id = c.company_id
      WHERE r.status = 'pending'
        AND t.status = 'successful'
        AND t.base_amount > 0
        AND t."createdAt" >= r.referred_at
        AND (r.expires_at IS NULL OR t."createdAt" <= r.expires_at)
      GROUP BY r.referred_user_id, UPPER(COALESCE(t.base_currency, 'USD'))`,
    { type: QueryTypes.SELECT }
  );

  if (rows.length === 0) return;

  // Reduce to the max USD-valued SINGLE payment per referred merchant.
  const { convertToUSD } = await import("../currencyUtils");
  const maxUsdByUser = new Map<number, number>();
  for (const row of rows) {
    const amount = Number(row.max_amount || 0);
    if (amount <= 0) continue;
    const currency = (row.base_currency || "USD").toUpperCase();
    let usd: number;
    if (USD_PEGGED.has(currency)) {
      usd = amount;
    } else {
      try {
        const converted = Number(await convertToUSD(currency, amount));
        // Fallback to the raw amount on FX failure (0) — never worse than the
        // pre-fix behaviour, and avoids missing a legit activation on an FX hiccup.
        usd = converted > 0 ? converted : amount;
        if (converted <= 0) {
          log(
            `Referral Reward Monitor: FX for ${currency} failed; using raw amount for the $100 gate (user ${row.referred_user_id})`,
            "warn"
          );
        }
      } catch {
        usd = amount;
      }
    }
    const prev = maxUsdByUser.get(row.referred_user_id) || 0;
    if (usd > prev) maxUsdByUser.set(row.referred_user_id, usd);
  }

  const { processReferrerReward } = await import("../../services/referralService");

  for (const [referredUserId, maxUsd] of maxUsdByUser) {
    try {
      if (maxUsd < 100) continue; // USD-normalized activation gate (F6)
      const rewarded = await processReferrerReward({
        refereeUserId: referredUserId,
        transactionAmount: maxUsd,
      });
      if (rewarded) {
        log(
          `Referral Reward Monitor: referrer of merchant ${referredUserId} rewarded (first payment ≈ $${maxUsd.toFixed(2)} USD)`,
          "info"
        );
      }
    } catch (e) {
      log(`Referral Reward Monitor: reward error for user ${referredUserId}: ${e}`, "error");
    }
  }
};

/**
 * F3: sweep stale PENDING referrals whose 90-day activation window has elapsed with
 * no qualifying payment → 'expired'. Runs AFTER activation so a within-window payment
 * processed late still activates first (its createdAt <= expires_at still qualifies).
 */
export const expireStalePendingReferrals = async (): Promise<number> => {
  const expired = await sequelize.query<{ referral_id: number }>(
    `UPDATE tbl_referral
        SET status = 'expired'
      WHERE status = 'pending'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
    RETURNING referral_id`,
    { type: QueryTypes.SELECT }
  );
  const count = expired.length;
  if (count > 0) {
    log(`Referral Reward Monitor: expired ${count} stale pending referral(s) past their 90-day window`, "info");
  }
  return count;
};

/**
 * B) Invite recent paying customers (no Dynopay account yet) to become merchants.
 *
 * 24-hour lookback (was 30 min): slow-confirming payments (e.g. BTC) often turn
 * 'successful' long after createdAt, so a short window silently skipped those
 * customers. checkRefereeCodeSent/checkEmailHasAccount dedup makes the wider
 * window safe — each email is only ever invited once. Synthetic API-payment
 * placeholder emails (…@dynopay.internal etc.) are excluded at the SQL level.
 */
const sendPostPaymentInvites = async () => {
  const rows = await sequelize.query<{
    email: string;
    company_id: number;
    user_id: number;
  }>(
    `SELECT DISTINCT ON (LOWER(cust.email))
            LOWER(cust.email) AS email,
            c.company_id,
            c.user_id
       FROM tbl_customer_transaction t
       JOIN tbl_company c ON c.company_id = t.company_id
       JOIN tbl_customer cust ON cust.customer_id = t.customer_id
      WHERE t.status = 'successful'
        AND t."createdAt" >= NOW() - INTERVAL '24 hours'
        AND cust.email IS NOT NULL
        AND cust.email <> ''
        AND cust.email NOT ILIKE '%@dynopay.internal'
        AND cust.email NOT ILIKE '%@dynopay.local'
        AND cust.email NOT ILIKE 'legacy-api-%'
        AND cust.email NOT ILIKE 'pk-buyer-%'
        AND cust.email NOT ILIKE 'elements-buyer-%'
        AND cust.email NOT ILIKE 'recovered-%'
      ORDER BY LOWER(cust.email), t."createdAt" DESC`,
    { type: QueryTypes.SELECT }
  );

  if (rows.length === 0) return;

  const { createRefereeCode, checkEmailHasAccount, checkRefereeCodeSent } = await import(
    "../../services/referralService"
  );
  const { sendRefereeInviteEmail } = await import("../../services/emailService");

  for (const row of rows) {
    try {
      if (!row.email) continue;
      if (await checkEmailHasAccount(row.email)) continue;
      if (await checkRefereeCodeSent(row.email)) continue;

      const code = await createRefereeCode({
        customerEmail: row.email,
        referrerCompanyId: row.company_id,
        referrerUserId: row.user_id,
      });

      if (code) {
        await sendRefereeInviteEmail(row.email, code.code, code.discount, code.duration, code.unsubscribeToken);
        log(`Referral Reward Monitor: post-payment invite sent to ${row.email}`, "info");
      }
    } catch (e) {
      log(`Referral Reward Monitor: invite error for ${row.email}: ${e}`, "error");
    }
  }
};
