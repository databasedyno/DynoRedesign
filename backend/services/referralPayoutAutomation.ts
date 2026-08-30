import { Op, QueryTypes } from "sequelize";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { cronLogger } from "../utils/loggers";
import User from "../models/userModels/userModel";
import ReferralPayout from "../models/referralModels/referralPayoutModel";
import { MIN_PAYOUT_USDT } from "./referralPayoutService";
import { sendReferralPayoutReadyEmail, sendReferralPayoutRequestedEmail } from "./emailService";

/**
 * Referral payout AUTOMATION (leader/prod cron only): the "you can cash out" nudge
 * and hands-off auto cash-out. Runs after accrual so balances are fresh; OFF in the
 * SAFE-MODE preview (registered inside registerLeaderCronJobs).
 */

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;
const maskAddr = (a: string): string => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

/** Email a referrer once when their unpaid balance first crosses the cash-out minimum. */
export const processReferralNudges = async (): Promise<number> => {
  const rows = await sequelize.query<{
    user_id: number;
    email: string;
    name: string | null;
    language: string | null;
    referral_payout_mode: string | null;
    unpaid: string;
  }>(
    `SELECT u.user_id, u.email, u.name, u.language, u.referral_payout_mode,
            SUM(r.commission_accrued_usd - r.commission_paid_usd) AS unpaid
       FROM tbl_referral r
       JOIN tbl_user u ON u.user_id = r.referrer_user_id
      WHERE r.status IN ('active','rewarded')
        AND u.referral_payout_nudged_at IS NULL
        AND u.email IS NOT NULL
      GROUP BY u.user_id, u.email, u.name, u.language, u.referral_payout_mode
     HAVING SUM(r.commission_accrued_usd - r.commission_paid_usd) >= :min`,
    { replacements: { min: MIN_PAYOUT_USDT }, type: QueryTypes.SELECT }
  );

  let sent = 0;
  for (const row of rows) {
    try {
      const unpaid = round2(Number(row.unpaid));
      await sendReferralPayoutReadyEmail(
        row.email,
        row.name || "there",
        unpaid,
        row.referral_payout_mode || "credit",
        row.language || undefined
      );
      await User.update({ referral_payout_nudged_at: new Date() } as never, { where: { user_id: row.user_id } });
      cronLogger.info(`[ReferralNudge] Notified user ${row.user_id} — $${unpaid.toFixed(2)} ready to cash out`);
      sent++;
    } catch (e) {
      cronLogger.error(`[ReferralNudge] error user ${row.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return sent;
};

/**
 * For referrers with auto cash-out ON (cash mode + verified address, no payout in
 * progress) whose balance ≥ their auto-min, create a 'pending' payout row (no OTP —
 * pre-authorized when they enabled auto). The Phase-3 cron then sends it.
 */
export const processAutoPayouts = async (): Promise<number> => {
  const rows = await sequelize.query<{
    user_id: number;
    email: string;
    name: string | null;
    language: string | null;
    address: string;
    unpaid: string;
  }>(
    `SELECT u.user_id, u.email, u.name, u.language,
            u.referral_payout_trc20_address AS address,
            SUM(r.commission_accrued_usd - r.commission_paid_usd) AS unpaid
       FROM tbl_referral r
       JOIN tbl_user u ON u.user_id = r.referrer_user_id
      WHERE r.status IN ('active','rewarded')
        AND u.referral_payout_auto = true
        AND u.referral_payout_mode = 'cash'
        AND u.referral_payout_trc20_address IS NOT NULL
        AND u.referral_payout_address_verified_at IS NOT NULL
      GROUP BY u.user_id, u.email, u.name, u.language, u.referral_payout_trc20_address, u.referral_payout_auto_min_usd
     HAVING SUM(r.commission_accrued_usd - r.commission_paid_usd)
            >= GREATEST(COALESCE(u.referral_payout_auto_min_usd, :min), :min)`,
    { replacements: { min: MIN_PAYOUT_USDT }, type: QueryTypes.SELECT }
  );

  let created = 0;
  for (const row of rows) {
    try {
      const existing = await ReferralPayout.findOne({
        where: { user_id: row.user_id, status: { [Op.in]: ["pending", "processing"] } },
      });
      if (existing) continue;

      const amount = round2(Number(row.unpaid));
      if (amount < MIN_PAYOUT_USDT) continue;

      const payout = await ReferralPayout.create({
        user_id: row.user_id,
        amount_usd: amount,
        trc20_address: row.address,
        status: "pending",
        idempotency_key: crypto.randomUUID(),
        requested_at: new Date(),
      } as never);

      const masked = maskAddr(row.address);
      try {
        await sendReferralPayoutRequestedEmail(row.email, row.name || "there", amount, masked, true, row.language || undefined);
      } catch {
        /* email non-fatal */
      }
      cronLogger.info(`[AutoPayout] Created payout ${(payout as { payout_id: number }).payout_id} for user ${row.user_id} ($${amount.toFixed(2)})`);
      created++;
    } catch (e) {
      cronLogger.error(`[AutoPayout] error user ${row.user_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return created;
};

export default { processReferralNudges, processAutoPayouts };
