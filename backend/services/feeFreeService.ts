/**
 * First-Payment-Free Service
 *
 * Manages the "Your first payment is on us" promotion for new merchants.
 * Tracked per USER ACCOUNT (user_id), NOT per company — one free payment total
 * across ALL of that user's companies.
 *
 * Rule (decided 2026-08, replaces the old "first $500 of lifetime volume"):
 *   - The merchant's FIRST successfully-settled payment has DynoPay's full
 *     platform deduction (fixed fee + %) waived — any size, no cap.
 *   - Blockchain / gas cost is SEPARATE and ALWAYS applies (never part of the
 *     platform deduction), matching "fee-free except blockchain cost".
 *   - After that first payment settles, the account graduates trial → standard
 *     and every later payment is charged normally.
 *
 * Entitlement is DERIVED from existing state — no dedicated column needed:
 *     available  ⟺  cumulative_volume_usd <= 0  AND  fee_tier === 'trial'
 *   cumulative_volume_usd is incremented ONLY at settlement
 *   (recordTransactionVolume), so "== 0" means "no successful payment yet" ⟺ the
 *   next payment is the first. Already-transacted / graduated merchants
 *   (cumulative > 0 OR fee_tier ≠ 'trial') are treated as having used their free
 *   payment — a clean cut-over from the old $500 trial for existing accounts.
 */

import { raw as envRaw } from "../utils/config";
import sequelize from "../utils/dbInstance";
import { userModel } from "../models";
import { log } from "../utils/loggers";

// Legacy display sentinel (kept only so status payloads that still surface a
// "total" figure don't break). The new model has NO dollar cap.
const FREE_TRIAL_VOLUME_USD = parseFloat(envRaw("FREE_TRIAL_VOLUME_USD") || "500");

// Float tolerance for the "no successful volume yet" check.
const VOLUME_EPSILON = 0.00001;

export interface FeeFreeStatus {
  user_id: number;
  cumulative_volume_usd: number;
  fee_free_remaining_usd: number;
  fee_free_total_usd: number;
  fee_free_used_usd: number;
  fee_tier: string;
  is_fee_free: boolean;
  /** NEW explicit flag: the account's one free payment is still available. */
  first_payment_free: boolean;
  percentage_used: number;
}

/**
 * Is the account's first-payment-free entitlement still available?
 * True only for a genuine new merchant: no settled volume AND still on 'trial'.
 * Graduated merchants (tier ≠ trial) and anyone who has transacted
 * (cumulative > 0) are excluded even if a counter drifted.
 */
export const isFirstPaymentFreeAvailable = (
  cumulativeVolumeUsd: number,
  feeTier: string
): boolean => {
  const cumulative = Number.isFinite(cumulativeVolumeUsd) ? cumulativeVolumeUsd : 0;
  return cumulative <= VOLUME_EPSILON && (feeTier || "trial") === "trial";
};

/**
 * Back-compat helper (still imported by controller/user/profile.ts). Under the
 * first-payment-free model there is no dollar budget, so this simply reports the
 * legacy sentinel while the freebie is available and 0 once it's used.
 */
export const resolveFeeFreeRemaining = (
  cumulativeVolumeUsd: number,
  _storedRemainingUsd?: number
): number => {
  const cumulative = Number.isFinite(cumulativeVolumeUsd) ? Math.max(0, cumulativeVolumeUsd) : 0;
  return cumulative <= VOLUME_EPSILON ? FREE_TRIAL_VOLUME_USD : 0;
};

/**
 * Get the first-payment-free status for a user account.
 */
export const getFeeFreeStatus = async (userId: number): Promise<FeeFreeStatus | null> => {
  try {
    const user = await userModel.findByPk(userId, {
      attributes: ["user_id", "cumulative_volume_usd", "fee_free_remaining_usd", "fee_tier"],
    });

    if (!user) return null;

    const data = user.get({ plain: true }) as any;
    const cumulative = parseFloat(data.cumulative_volume_usd || "0");
    const tier = data.fee_tier || "trial";
    const available = isFirstPaymentFreeAvailable(cumulative, tier);

    return {
      user_id: data.user_id,
      cumulative_volume_usd: cumulative,
      // Legacy sentinel: > 0 while the freebie is available so any older surface
      // still gated on `fee_free_remaining_usd > 0` keeps working; 0 once used.
      fee_free_remaining_usd: available ? FREE_TRIAL_VOLUME_USD : 0,
      fee_free_total_usd: FREE_TRIAL_VOLUME_USD,
      fee_free_used_usd: available ? 0 : FREE_TRIAL_VOLUME_USD,
      fee_tier: tier,
      is_fee_free: available,
      first_payment_free: available,
      percentage_used: available ? 0 : 100,
    };
  } catch (error: any) {
    log(`[FeeFree] Error getting fee-free status for user ${userId}: ${error.message}`, "error");
    return null;
  }
};

/**
 * Calculate the fee-free discount for a transaction.
 *
 * First-payment-free model: while the account's free payment is available, the
 * ENTIRE payment is platform-fee-free (any size, no cap) — feeService then
 * waives the full deduction because fee_free_amount === amount. Otherwise
 * nothing is waived.
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

    if (!status || !status.is_fee_free) {
      return {
        fee_free_amount: 0,
        fee_applicable_amount: transactionAmountUsd,
        is_fully_free: false,
        remaining_after: 0,
      };
    }

    // First payment → the whole amount is platform-fee-free (no cap).
    return {
      fee_free_amount: transactionAmountUsd,
      fee_applicable_amount: 0,
      is_fully_free: true,
      remaining_after: 0,
    };
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
 * Record a settled transaction's volume and consume the first-payment-free
 * entitlement. Called at settlement (BEFORE settlement completes; reversed on
 * failure — see reverseTransactionVolume).
 *
 * - Always adds to cumulative_volume_usd (drives volume-tier pricing/analytics).
 * - Graduates the account trial → standard on its FIRST payment and zeroes the
 *   legacy remaining counter. Idempotent for the 2nd+ payment (tier already
 *   'standard' → CASE leaves it unchanged).
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
        fee_free_remaining_usd: 0,
        fee_tier: sequelize.literal(`CASE WHEN "fee_tier" = 'trial' THEN 'standard' ELSE "fee_tier" END`),
      },
      {
        where: { user_id: userId },
        transaction: t,
      }
    );

    await t.commit();
    log(`[FeeFree] User ${userId} recorded $${amountUsd} volume (first-payment-free consumed if this was their first)`, "info");
    return getFeeFreeStatus(userId);
  } catch (error: any) {
    await t.rollback();
    log(`[FeeFree] Error recording volume for user ${userId}: ${error.message}`, "error");
    return null;
  }
};

/**
 * Reverse a previously recorded settlement volume. Called when settlement fails
 * AFTER recordTransactionVolume ran.
 *
 * - Decrements cumulative_volume_usd (clamped at 0).
 * - If the reversal brings the account back to ZERO settled volume, the failed
 *   payment was the merchant's only/first one → RESTORE the first-payment-free
 *   entitlement (standard → trial). If other successful payments remain
 *   (cumulative still > 0), the entitlement stays consumed — an established
 *   merchant is never handed a fresh free payment by a single reversal.
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
      },
      {
        where: { user_id: userId },
        transaction: t,
      }
    );

    const updated = await userModel.findByPk(userId, {
      attributes: ["cumulative_volume_usd", "fee_tier"],
      transaction: t,
    });

    if (updated) {
      const cumulative = parseFloat((updated as any).cumulative_volume_usd || "0");
      const currentTier = (updated as any).fee_tier;

      // Restore the freebie ONLY when the account is back to zero settled volume
      // AND it had graduated to 'standard' (i.e. this reversed payment was the
      // one that consumed it).
      if (cumulative <= VOLUME_EPSILON && currentTier === "standard") {
        await userModel.update(
          { fee_tier: "trial", fee_free_remaining_usd: FREE_TRIAL_VOLUME_USD },
          { where: { user_id: userId }, transaction: t }
        );
        log(`[FeeFree] User ${userId} first-payment-free RESTORED (settlement reversed to $0 volume). Tier: standard → trial`, "info");
      }
    }

    await t.commit();
    log(`[FeeFree] ↩️ User ${userId} REVERSED $${amountUsd} settled volume (settlement failed)`, "info");
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
  isFirstPaymentFreeAvailable,
  resolveFeeFreeRemaining,
};
