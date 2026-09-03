/**
 * Fee Service — Centralized Fee Calculation Logic
 *
 * Consolidates all platform fee calculations previously scattered in controller/index.ts:
 *   - getTransactionFee: Platform transaction fee % (env → Redis → DB)
 *   - getDiscountedTransactionFee: With referral discount
 *   - getBlockchainFee: Blockchain fee from admin config
 *   - getBlockchainConfig: Full fee configuration for a blockchain
 *   - calculateTransactionFees: Tier-based fee calculation (fixed + %)
 *   - calculateTransactionFeesWithDiscount: With referral discount applied
 *
 * Business Rule: Merchant pays ALL fees. Fees are deducted from merchant payouts.
 */

import { feesModel } from "../models";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import { log } from "../utils/loggers";
import { D, div, pct, toFixedStr, toNumber } from "../utils/money";
import { getBlockchainThreshold, getTransactionFeePercent, getFeeTiers } from "../utils/feeConfigUtils";
import { getPlatformFeePercent } from "../utils/volumeTierUtils";
import { userModel } from "../models";
import User from "../models/userModels/userModel";

// ── Fee Retrieval ───────────────────────────────────────────────────────────

export const getTransactionFee = async () => {
  const envFee = getTransactionFeePercent();
  if (envFee) return envFee;

  const admin_fee = await getRedisItem("admin_fee");
  let transaction_fee;
  if (!admin_fee?.transaction_fee) {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "TRANSACTION_FEE",
        },
      })
    ).dataValues;
    transaction_fee = fee;
    await setRedisItem("admin_fee", { transaction_fee });
  } else {
    transaction_fee = admin_fee?.transaction_fee;
  }
  return transaction_fee;
};

/**
 * Get transaction fee with user's referral discount applied
 */
export const getDiscountedTransactionFee = async (userId: number) => {
  const baseFee = await getTransactionFee();

  const user = await User.findByPk(userId, {
    attributes: ['fee_discount_percent', 'fee_discount_expires_at', 'fee_discount_reason'],
  });

  if (!user) {
    return {
      base_fee: baseFee,
      discount_percent: 0,
      discount_reason: null,
      final_fee: baseFee,
      discount_expires_at: null,
    };
  }

  const discountPercent = Number((user as { fee_discount_percent?: number }).fee_discount_percent) || 0;
  const expiresAt = (user as { fee_discount_expires_at?: Date }).fee_discount_expires_at;
  const reason = (user as { fee_discount_reason?: string }).fee_discount_reason;

  const isActive = expiresAt && new Date() < expiresAt && discountPercent > 0;

  if (!isActive) {
    return {
      base_fee: baseFee,
      discount_percent: 0,
      discount_reason: null,
      final_fee: baseFee,
      discount_expires_at: null,
    };
  }

  const discountAmount = (Number(baseFee) * discountPercent) / 100;
  const finalFee = Math.max(0, Number(baseFee) - discountAmount);

  return {
    base_fee: baseFee,
    discount_percent: discountPercent,
    discount_reason: reason,
    final_fee: toNumber(finalFee, 2),
    discount_expires_at: expiresAt,
  };
};

export const getBlockchainFee = async () => {
  const admin_fee = await getRedisItem("admin_fee");
  let blockchain_fee;
  if (!admin_fee?.blockchain_fee) {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "BLOCKCHAIN_FEE",
        },
      })
    ).dataValues;
    blockchain_fee = fee;
    await setRedisItem("admin_fee", { blockchain_fee });
  } else {
    blockchain_fee = admin_fee?.blockchain_fee;
  }
  return blockchain_fee;
};

// ── Fee Configuration ───────────────────────────────────────────────────────

/**
 * Look up a user's platform-fee % based on their fee_tier column. Safe against
 * missing/unknown values (falls back to 1.5% starter rate via getPlatformFeePercent).
 */
const getUserPlatformFeePercent = async (userId?: number): Promise<number> => {
  if (!userId) return getTransactionFeePercent();
  try {
    const user = await userModel.findOne({
      where: { user_id: userId },
      attributes: ["fee_tier"],
      raw: true,
    });
    const tierName = (user as any)?.fee_tier as string | undefined;
    return getPlatformFeePercent(tierName);
  } catch {
    return getTransactionFeePercent();
  }
};

export const getBlockchainConfig = async (blockchain: string, userId?: number) => {
  const threshold = getBlockchainThreshold(blockchain);
  const tiers = getFeeTiers();

  if (threshold !== undefined && tiers.length > 0) {
    return {
      blockchain,
      min_forwarding_amount: threshold,
      transaction_fee_percent: await getUserPlatformFeePercent(userId),
      tiers: tiers.map(t => ({
        min_amount: t.min,
        max_amount: t.max,
        fixed_fee: t.fixed,
      }))
    };
  }
};

// ── Fee Calculation ─────────────────────────────────────────────────────────

interface FeeTier {
  min_amount: number;
  max_amount: number | null;
  fixed_fee: number;
  id?: number;
}

/**
 * Find the matching fee tier for a given amount.
 * Falls back to the lowest tier if amount is below all tier minimums.
 */
const findMatchingTier = (tiers: FeeTier[], amount: number, context: string): FeeTier => {
  const matchingTier = tiers.find(
    (tier) =>
      amount >= tier.min_amount &&
      (tier.max_amount === null || amount <= tier.max_amount)
  );

  if (matchingTier) return matchingTier;

  // Fallback: use lowest tier for small payments
  const sortedTiers = [...tiers].sort((a, b) => a.min_amount - b.min_amount);
  if (sortedTiers[0] && amount > 0) {
    log(`[${context}] No exact tier for amount ${amount}, using lowest tier (min=${sortedTiers[0].min_amount})`, 'warn');
    return sortedTiers[0];
  }

  throw new Error(`No fee tier found for amount ${amount}`);
};

export const calculateTransactionFees = async (
  blockchain: string,
  amount: number,
  userId?: number
) => {
  const config = await getBlockchainConfig(blockchain, userId);
  if (!config) {
    throw new Error(`Blockchain ${blockchain} configuration not found`);
  }

  const tiers = (config.tiers || []) as FeeTier[];
  const effectiveTier = findMatchingTier(tiers, amount, 'calculateTransactionFees');

  // Exact decimal math (amounts are USD); rounded to 8 dp at the boundary so
  // downstream crypto conversions keep full precision.
  const grossD = D(amount);
  const fixedFeeD = D(effectiveTier.fixed_fee);
  const transactionFeeD = pct(grossD, config.transaction_fee_percent);
  let totalDeductionD = fixedFeeD.plus(transactionFeeD);
  let userReceivesD = grossD.minus(totalDeductionD);

  // Phase 2: Fee-free override for trial users
  let feeFreeApplied = false;
  let feeFreeDiscountD = D(0);
  let feeFreeRemaining = 0;
  let scale = D(1); // share of the nominal fee that is still charged

  if (userId) {
    try {
      const { calculateFeeFreeDiscount } = require("./feeFreeService");
      const discount = await calculateFeeFreeDiscount(userId, amount);
      
      if (discount.fee_free_amount > 0) {
        const freeRatio = div(discount.fee_free_amount, grossD);
        feeFreeDiscountD = totalDeductionD.times(freeRatio);
        feeFreeApplied = true;
        feeFreeRemaining = discount.remaining_after;
        scale = totalDeductionD.isZero() ? D(1) : D(1).minus(div(feeFreeDiscountD, totalDeductionD));
        totalDeductionD = totalDeductionD.minus(feeFreeDiscountD);
        userReceivesD = grossD.minus(totalDeductionD);
        
        log(`[FeeFree] User ${userId}: $${discount.fee_free_amount}/$${amount} fee-free, discount $${toFixedStr(feeFreeDiscountD, 2)}`, 'info');
      }
    } catch (e: any) {
      log(`[FeeFree] Fee-free check failed (non-critical): ${e.message}`, 'warn');
    }
  }

  return {
    fixedFee: toNumber(fixedFeeD.times(scale), 8),
    transactionFee: toNumber(transactionFeeD.times(scale), 8),
    totalDeduction: toNumber(totalDeductionD, 8),
    userReceives: toNumber(userReceivesD, 8),
    tierId: effectiveTier.id ?? 0,
    minForwarding: config.min_forwarding_amount,
    feeFreeApplied,
    feeFreeDiscount: toNumber(feeFreeDiscountD, 8),
    feeFreeRemaining,
  };
};

/**
 * Calculate transaction fees with user's referral discount applied
 */
export const calculateTransactionFeesWithDiscount = async (
  blockchain: string,
  amount: number,
  userId: number
) => {
  const config = await getBlockchainConfig(blockchain, userId);
  if (!config) {
    throw new Error(`Blockchain ${blockchain} configuration not found`);
  }

  const tiers = (config.tiers || []) as FeeTier[];
  const effectiveTier = findMatchingTier(tiers, amount, 'calculateTransactionFeesWithDiscount');

  const discountInfo = await getDiscountedTransactionFee(userId);
  const discountPercent = discountInfo.discount_percent || 0;

  const grossD = D(amount);
  const fixedFeeD = D(effectiveTier.fixed_fee);
  const baseTransactionFeePercent = config.transaction_fee_percent;

  const discountedFeePercent = discountPercent > 0
    ? D(baseTransactionFeePercent).times(D(1).minus(div(discountPercent, 100)))
    : D(baseTransactionFeePercent);

  const transactionFeeD = pct(grossD, discountedFeePercent);
  const transactionFeeOriginalD = pct(grossD, baseTransactionFeePercent);
  const totalDeductionD = fixedFeeD.plus(transactionFeeD);

  return {
    fixedFee: toNumber(fixedFeeD, 8),
    transactionFee: toNumber(transactionFeeD, 8),
    transactionFeeOriginal: toNumber(transactionFeeOriginalD, 8),
    totalDeduction: toNumber(totalDeductionD, 8),
    userReceives: toNumber(grossD.minus(totalDeductionD), 8),
    tierId: effectiveTier.id ?? 0,
    minForwarding: config.min_forwarding_amount,
    discountApplied: discountPercent > 0,
    discountPercent,
    discountReason: discountInfo.discount_reason,
    discountExpiresAt: discountInfo.discount_expires_at,
    savings: discountPercent > 0 ? toNumber(transactionFeeOriginalD.minus(transactionFeeD), 8) : 0,
  };
};
