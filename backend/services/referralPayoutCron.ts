import { cronLogger } from "../utils/loggers";
import { Op } from "sequelize";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";
import ReferralPayout from "../models/referralModels/referralPayoutModel";
import { acquireLock, releaseLock } from "../utils/redisInstance";
import { sendWithdrawalSuccessEmail, sendReferralPayoutFailedEmail } from "./emailService";
import binanceService from "./binanceService";
import { alertTreasuryLow } from "../utils/treasuryAlert";

/**
 * Referral revenue-share PAYOUT EXECUTION (Phase 3). LEADER/PROD cron ONLY —
 * NEVER called from an API request and OFF in the SAFE-MODE preview
 * (setupReferralRewardCron lives inside registerLeaderCronJobs).
 */

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Reconcile a completed account-level payout back onto the per-referral totals. */
const applyPayoutToReferrals = async (userId: number, amountUsd: number, txHash: string): Promise<void> => {
  let remaining = round2(amountUsd);
  const referrals = await Referral.findAll({
    where: { referrer_user_id: userId, status: { [Op.in]: ["active", "rewarded"] } },
    order: [["activated_at", "ASC"]],
  });
  for (const r of referrals) {
    if (remaining <= 0.001) break;
    const accrued = Number(r.commission_accrued_usd || 0);
    const paid = Number(r.commission_paid_usd || 0);
    const unpaid = round2(accrued - paid);
    if (unpaid <= 0) continue;
    const applied = Math.min(unpaid, remaining);
    const newPaid = round2(paid + applied);
    await r.update({ commission_paid_usd: newPaid });
    remaining = round2(remaining - applied);
    if (newPaid >= accrued - 0.001) {
      const reward = await ReferralReward.findOne({
        where: { referral_id: r.referral_id, reward_type: "commission" },
      });
      if (reward) await reward.update({ status: "withdrawn", withdrawn_at: new Date(), transaction_id: txHash });
    }
  }
};

/** Submit all 'pending' payouts to Binance (treasury-guarded, per-payout locked, idempotent). */
export const processReferralPayouts = async (): Promise<number> => {
  const pending = await ReferralPayout.findAll({
    where: { status: "pending" },
    order: [["payout_id", "ASC"]],
    limit: 20,
  });
  let submitted = 0;
  for (const payout of pending) {
    const lockKey = `cron:referralPayout:${payout.payout_id}`;
    const locked = await acquireLock(lockKey, 120, 1, 100, true);
    if (!locked) continue;
    try {
      const amount = Number(payout.amount_usd);
      const orderId = payout.idempotency_key;

      // Idempotency guard: if a withdrawal with this order id already exists at Binance,
      // adopt it instead of re-submitting (covers a crash between submit and DB write).
      if (orderId) {
        try {
          const prior = await binanceService.getWithdrawalHistory({ coin: "USDT", withdrawOrderId: orderId, limit: 5 });
          if (prior && prior.length > 0) {
            await payout.update({ status: "processing", binance_withdrawal_id: prior[0].id, error_message: null });
            cronLogger.warn(`[ReferralPayout] Adopted existing Binance withdrawal for payout ${payout.payout_id} (order ${orderId})`);
            continue;
          }
        } catch {
          /* history lookup is best-effort */
        }
      }

      const balance = await binanceService.getAssetBalance("USDT");
      if (balance.free < amount * 0.99) {
        cronLogger.warn(
          `[ReferralPayout] Insufficient USDT treasury for payout ${payout.payout_id}: have ${balance.free}, need ${amount} — waiting for top-up`
        );
        await payout.update({ error_message: `Insufficient USDT treasury (have ${balance.free.toFixed(2)}, need ${amount.toFixed(2)}) — awaiting top-up` });
        await alertTreasuryLow({ asset: "USDT", have: balance.free, need: amount, context: `Referral payout #${payout.payout_id}` });
        continue;
      }
      await payout.update({ status: "processing" });
      const wd = await binanceService.submitWithdrawal({
        coin: "USDT",
        address: payout.trc20_address,
        amount,
        network: "TRC20",
        withdrawOrderId: orderId || undefined,
      });
      await payout.update({ binance_withdrawal_id: wd.id, error_message: null });
      cronLogger.info(`[ReferralPayout] Submitted payout ${payout.payout_id} ($${amount}) → Binance wd ${wd.id}`);
      submitted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      cronLogger.error(`[ReferralPayout] submit error for ${payout.payout_id}: ${msg}`);
      // Reset to 'pending' so it can retry next cycle (withdrawOrderId prevents double-send).
      await payout.update({ status: "pending", error_message: msg });
    } finally {
      await releaseLock(lockKey);
    }
  }
  return submitted;
};

/** Poll 'processing' payouts → complete/fail; reconcile referral totals on success. */
export const monitorReferralPayouts = async (): Promise<number> => {
  const processing = await ReferralPayout.findAll({
    where: { status: "processing", binance_withdrawal_id: { [Op.not]: null } },
    limit: 20,
  });
  let completed = 0;
  for (const payout of processing) {
    try {
      const history = await binanceService.getWithdrawalHistory({ coin: "USDT", limit: 50 });
      const match = history.find((w) => w.id === payout.binance_withdrawal_id);
      if (!match) continue;
      if (match.status === 6) {
        const fee = parseFloat(match.transactionFee || "0");
        await payout.update({
          status: "completed",
          tx_hash: match.txId,
          withdrawal_fee_usdt: fee,
          completed_at: new Date(),
        });
        await applyPayoutToReferrals(payout.user_id, Number(payout.amount_usd), match.txId);
        // Reset the nudge flag so a future balance can trigger a fresh "you can cash out" email.
        await User.update({ referral_payout_nudged_at: null } as never, { where: { user_id: payout.user_id } });
        try {
          const user = await User.findByPk(payout.user_id, { attributes: ["email", "name", "language"] });
          const u = user as unknown as Record<string, string> | null;
          if (u?.email) {
            await sendWithdrawalSuccessEmail(
              u.email,
              u.name || "there",
              Number(payout.amount_usd).toFixed(2),
              "USDT-TRC20",
              payout.trc20_address,
              match.txId,
              u.language
            );
          }
        } catch {
          /* email is non-fatal */
        }
        cronLogger.info(`[ReferralPayout] Completed payout ${payout.payout_id}: tx ${match.txId}`);
        completed++;
      } else if (match.status === 1 || match.status === 3 || match.status === 5) {
        await payout.update({
          status: "failed",
          error_message: `Binance withdrawal status ${match.status}`,
          completed_at: new Date(),
        });
        try {
          const user = await User.findByPk(payout.user_id, { attributes: ["email", "name", "language"] });
          const u = user as unknown as Record<string, string> | null;
          if (u?.email) {
            await sendReferralPayoutFailedEmail(
              u.email,
              u.name || "there",
              Number(payout.amount_usd),
              payout.trc20_address.length > 14 ? `${payout.trc20_address.slice(0, 8)}…${payout.trc20_address.slice(-6)}` : payout.trc20_address,
              `Binance withdrawal status ${match.status}`,
              u.language
            );
          }
        } catch {
          /* email is non-fatal */
        }
        cronLogger.warn(`[ReferralPayout] Payout ${payout.payout_id} FAILED (Binance status ${match.status})`);
      }
    } catch (e) {
      cronLogger.error(
        `[ReferralPayout] monitor error for ${payout.payout_id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
  return completed;
};

export default { processReferralPayouts, monitorReferralPayouts };
