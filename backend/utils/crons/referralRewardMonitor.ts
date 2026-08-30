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
    } catch (e) {
      log(`Referral Reward Monitor (rewards) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:rewards" });
    }
    try {
      // Revenue-share: accrue 25% of each referred merchant's platform fees into
      // the referrer's running balance (idempotent watermark; window-capped).
      const { accrueActiveReferralCommissions } = await import("../../services/referralService");
      await accrueActiveReferralCommissions();
    } catch (e) {
      log(`Referral Reward Monitor (accrual) error: ${e}`, "error");
      captureError(e, "cron", { extraContext: "referralRewardMonitor:accrual" });
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

  log("Referral Reward Monitor Cron scheduled for every 15 minutes", "info");
};

/**
 * A) Unlock the referrer's reward once the referred merchant has received their
 *    first qualifying ($100+) successful payment since being referred.
 */
const processPendingReferrerRewards = async () => {
  const rows = await sequelize.query<{
    referred_user_id: number;
    max_amount: string | null;
  }>(
    `SELECT r.referred_user_id,
            MAX(t.base_amount) AS max_amount
       FROM tbl_referral r
       JOIN tbl_company c ON c.user_id = r.referred_user_id
       JOIN tbl_customer_transaction t ON t.company_id = c.company_id
      WHERE r.status = 'pending'
        AND t.status = 'successful'
        AND t.base_amount >= 100
        AND t."createdAt" >= r.referred_at
      GROUP BY r.referred_user_id`,
    { type: QueryTypes.SELECT }
  );

  if (rows.length === 0) return;

  const { processReferrerReward } = await import("../../services/referralService");

  for (const row of rows) {
    try {
      const amount = Number(row.max_amount || 0);
      const rewarded = await processReferrerReward({
        refereeUserId: row.referred_user_id,
        transactionAmount: amount,
      });
      if (rewarded) {
        log(
          `Referral Reward Monitor: referrer of merchant ${row.referred_user_id} rewarded (first payment $${amount})`,
          "info"
        );
      }
    } catch (e) {
      log(`Referral Reward Monitor: reward error for user ${row.referred_user_id}: ${e}`, "error");
    }
  }
};

/**
 * B) Invite recent paying customers (no Dynopay account yet) to become merchants.
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
        AND t."createdAt" >= NOW() - INTERVAL '30 minutes'
        AND cust.email IS NOT NULL
        AND cust.email <> ''
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
