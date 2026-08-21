/**
 * Fee-Free Trial Service
 * 
 * Manages the "First $500 Fee-Free" promotion for new users.
 * Tracked per user account, not per company.
 * 
 * Key features:
 * - Track cumulative transaction volume per user
 * - Calculate fee-free remaining balance
 * - Atomic decrement to prevent race conditions
 * - Fee override: waive or reduce fees while balance remains
 */

import sequelize from "../utils/dbInstance";
import { userModel } from "../models";
import { log } from "../utils/loggers";

const FREE_TRIAL_VOLUME_USD = parseFloat(process.env.FREE_TRIAL_VOLUME_USD || "500");

export interface FeeFreeStatus {
  user_id: number;
  cumulative_volume_usd: number;
  fee_free_remaining_usd: number;
  fee_free_total_usd: number;
  fee_free_used_usd: number;
  fee_tier: string;
  is_fee_free: boolean;
  percentage_used: number;
}

/**
 * Trial entitlement is a function of LIFETIME volume — NOT of the stored
 * counter alone. The counter can drift upwards (a failed-settlement reversal
 * adds the amount back; see reverseTransactionVolume), which previously
 * resurrected the "first $500 fee-free" promo — welcome popup, banner and an
 * actual fee waiver — for established merchants who processed $20k+ long ago.
 * Clamping the stored value to (500 − lifetime volume) makes every surface
 * self-healing regardless of counter drift.
 */
export const resolveFeeFreeRemaining = (
  cumulativeVolumeUsd: number,
  storedRemainingUsd: number
): number => {
  const cumulative = Number.isFinite(cumulativeVolumeUsd) ? Math.max(0, cumulativeVolumeUsd) : 0;
  const stored = Number.isFinite(storedRemainingUsd) ? storedRemainingUsd : 0;
  const entitled = Math.max(0, FREE_TRIAL_VOLUME_USD - cumulative);
  return Math.max(0, Math.min(stored, entitled));
};

/**
 * Get the fee-free status for a user
 */
export const getFeeFreeStatus = async (userId: number): Promise<FeeFreeStatus | null> => {
  try {
    const user = await userModel.findByPk(userId, {
      attributes: ["user_id", "cumulative_volume_usd", "fee_free_remaining_usd", "fee_tier"],
    });

    if (!user) return null;

    const data = user.get({ plain: true }) as any;
    const cumulative = parseFloat(data.cumulative_volume_usd || "0");
    const remaining = resolveFeeFreeRemaining(cumulative, parseFloat(data.fee_free_remaining_usd || "0"));
    const used = FREE_TRIAL_VOLUME_USD - remaining;

    return {
      user_id: data.user_id,
      cumulative_volume_usd: cumulative,
      fee_free_remaining_usd: Math.max(0, remaining),
      fee_free_total_usd: FREE_TRIAL_VOLUME_USD,
      fee_free_used_usd: Math.min(used, FREE_TRIAL_VOLUME_USD),
      fee_tier: data.fee_tier || "trial",
      is_fee_free: remaining > 0,
      percentage_used: Math.min(100, (used / FREE_TRIAL_VOLUME_USD) * 100),
    };
  } catch (error: any) {
    log(`[FeeFree] Error getting fee-free status for user ${userId}: ${error.message}`, "error");
    return null;
  }
};

/**
 * Calculate the fee-free discount for a transaction.
 * Returns the portion of the transaction that should be fee-free.
 * 
 * @param userId - The user making the transaction
 * @param transactionAmountUsd - The transaction amount in USD
 */
export const calculateFeeFreeDiscount = async (
  userId: number,
  transactionAmountUsd: number
): Promise<{
  fee_free_amount: number;
  fee_applicable_amount: number;
  is_fully_free: boolean;
  remaining_after: number;
}> => {
  try {
    const status = await getFeeFreeStatus(userId);

    if (!status || !status.is_fee_free || status.fee_free_remaining_usd <= 0) {
      return {
        fee_free_amount: 0,
        fee_applicable_amount: transactionAmountUsd,
        is_fully_free: false,
        remaining_after: 0,
      };
    }

    const remaining = status.fee_free_remaining_usd;

    if (transactionAmountUsd <= remaining) {
      return {
        fee_free_amount: transactionAmountUsd,
        fee_applicable_amount: 0,
        is_fully_free: true,
        remaining_after: remaining - transactionAmountUsd,
      };
    } else {
      return {
        fee_free_amount: remaining,
        fee_applicable_amount: transactionAmountUsd - remaining,
        is_fully_free: false,
        remaining_after: 0,
      };
    }
  } catch (error: any) {
    log(`[FeeFree] Error calculating discount for user ${userId}: ${error.message}`, "error");
    return {
      fee_free_amount: 0,
      fee_applicable_amount: transactionAmountUsd,
      is_fully_free: false,
      remaining_after: 0,
    };
  }
};

/**
 * Record a transaction and decrement the fee-free balance.
 * Uses atomic DB operation to prevent race conditions.
 */
export const recordTransactionVolume = async (
  userId: number,
  amountUsd: number
): Promise<FeeFreeStatus | null> => {
  const t = await sequelize.transaction();

  try {
    await userModel.update(
      {
        cumulative_volume_usd: sequelize.literal(`COALESCE("cumulative_volume_usd", 0) + ${amountUsd}`),
        fee_free_remaining_usd: sequelize.literal(
          `GREATEST(0, COALESCE("fee_free_remaining_usd", 0) - ${amountUsd})`
        ),
      },
      {
        where: { user_id: userId },
        transaction: t,
      }
    );

    const updated = await userModel.findByPk(userId, {
      attributes: ["fee_free_remaining_usd", "fee_tier"],
      transaction: t,
    });

    if (updated) {
      const remaining = parseFloat((updated as any).fee_free_remaining_usd || "0");
      const currentTier = (updated as any).fee_tier;

      if (remaining <= 0 && currentTier === "trial") {
        await userModel.update(
          { fee_tier: "standard" },
          { where: { user_id: userId }, transaction: t }
        );
        log(`[FeeFree] User ${userId} exhausted fee-free balance. Tier: trial → standard`, "info");
      }
    }

    await t.commit();
    log(`[FeeFree] User ${userId} recorded $${amountUsd} volume`, "info");
    return getFeeFreeStatus(userId);
  } catch (error: any) {
    await t.rollback();
    log(`[FeeFree] Error recording volume for user ${userId}: ${error.message}`, "error");
    return null;
  }
};

/**
 * Reverse a previously recorded fee-free volume deduction.
 * Called when settlement fails AFTER recordTransactionVolume was called.
 * Atomic: restores fee_free_remaining_usd and decrements cumulative_volume_usd.
 * Also restores "trial" tier if the user was prematurely graduated to "standard".
 */
export const reverseTransactionVolume = async (
  userId: number,
  amountUsd: number
): Promise<FeeFreeStatus | null> => {
  const t = await sequelize.transaction();

  try {
    await userModel.update(
      {
        cumulative_volume_usd: sequelize.literal(
          `GREATEST(0, COALESCE("cumulative_volume_usd", 0) - ${amountUsd})`
        ),
        // Never restore MORE than the trial the user is still entitled to for
        // their (post-reversal) lifetime volume. Without this clamp a failed
        // settlement handed a fresh fee-free balance to merchants who had
        // already blown past the $500 trial months earlier.
        fee_free_remaining_usd: sequelize.literal(
          `LEAST(
             COALESCE("fee_free_remaining_usd", 0) + ${amountUsd},
             GREATEST(0, ${FREE_TRIAL_VOLUME_USD} - GREATEST(0, COALESCE("cumulative_volume_usd", 0) - ${amountUsd}))
           )`
        ),
      },
      {
        where: { user_id: userId },
        transaction: t,
      }
    );

    // If the tier was prematurely switched to "standard" by the original record,
    // restore it to "trial" if remaining is now > 0
    const updated = await userModel.findByPk(userId, {
      attributes: ["fee_free_remaining_usd", "fee_tier"],
      transaction: t,
    });

    if (updated) {
      const remaining = parseFloat((updated as any).fee_free_remaining_usd || "0");
      const currentTier = (updated as any).fee_tier;

      if (remaining > 0 && currentTier === "standard") {
        await userModel.update(
          { fee_tier: "trial" },
          { where: { user_id: userId }, transaction: t }
        );
        log(`[FeeFree] User ${userId} fee-free balance restored ($${remaining}). Tier: standard → trial`, "info");
      }
    }

    await t.commit();
    log(`[FeeFree] ↩️ User ${userId} REVERSED $${amountUsd} fee-free volume (settlement failed)`, "info");
    return getFeeFreeStatus(userId);
  } catch (error: any) {
    await t.rollback();
    log(`[FeeFree] Error reversing volume for user ${userId}: ${error.message}`, "error");
    return null;
  }
};

export default {
  getFeeFreeStatus,
  calculateFeeFreeDiscount,
  recordTransactionVolume,
  reverseTransactionVolume,
};
