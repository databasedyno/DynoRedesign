import { apiLogger } from "../utils/loggers";
import { Op } from "sequelize";
import sequelize from "../utils/dbInstance";
import User from "../models/userModels/userModel";
import Referral from "../models/referralModels/referralModel";
import ReferralReward from "../models/referralModels/referralRewardModel";

/**
 * Referral revenue-share FEE-CREDIT consumption (BLENDED model, default path).
 *
 * When a referrer is in 'credit' payout mode (the default / opt-out of cash-out),
 * their accrued-but-unpaid revenue-share balance is spent to REDUCE their own
 * DynoPay platform fee at settlement (Option 1.a — the merchant keeps more of the
 * payment). Blockchain/gas cost is NEVER touched here (always deducted as usual).
 *
 * ONE shared balance pool: unpaid = accrued − cash_paid − credited, so a dollar can
 * never be both cashed out AND credited. In 'cash' mode this returns 0 (the balance
 * is reserved for USDT-TRC20 cash-out).
 */

const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Account-level referral balance available to spend as FEE CREDIT ($ USD). */
export const getAvailableCreditForFees = async (userId: number): Promise<number> => {
  const user = await User.findByPk(userId, { attributes: ["referral_payout_mode"] });
  const mode = ((user as unknown as Record<string, unknown>)?.referral_payout_mode as string) || "credit";
  if (mode !== "credit") return 0;
  const referrals = await Referral.findAll({
    where: { referrer_user_id: userId, status: { [Op.in]: ["active", "rewarded"] } },
    attributes: ["commission_accrued_usd", "commission_paid_usd", "commission_credited_usd"],
  });
  let unpaid = 0;
  for (const r of referrals) {
    unpaid +=
      Number(r.commission_accrued_usd || 0) -
      Number(r.commission_paid_usd || 0) -
      Number(r.commission_credited_usd || 0);
  }
  return Math.max(0, round2(unpaid));
};

/**
 * Idempotently consume up to `maxUsd` of referral fee-credit for a settlement,
 * keyed by `transactionRef`. Distributes across the referrer's referrals
 * oldest-first, bumps commission_credited_usd, and writes per-referral audit rows
 * (reward_type='commission_credit', status='credited', transaction_id=transactionRef).
 * Returns the total USD actually consumed.
 *
 * Safe to re-invoke (settlement webhooks retry): if credit was already applied for
 * this transactionRef, returns the previously-applied total WITHOUT double-spending.
 * Only consumes when the account is in 'credit' mode.
 */
export const consumeReferralCreditForTransaction = async (params: {
  userId: number;
  maxUsd: number;
  transactionRef: string;
}): Promise<number> => {
  const { userId, transactionRef } = params;
  const maxUsd = round2(params.maxUsd);
  if (!userId || !transactionRef || maxUsd <= 0) return 0;

  // Idempotency — already applied for this settlement?
  const prior = await ReferralReward.findAll({
    where: { user_id: userId, reward_type: "commission_credit", transaction_id: transactionRef },
    attributes: ["amount"],
  });
  if (prior.length > 0) {
    return round2(prior.reduce((s, r) => s + Number(r.amount || 0), 0));
  }

  // Mode gate — only 'credit' mode spends the balance as fee credit.
  const user = await User.findByPk(userId, { attributes: ["referral_payout_mode"] });
  if ((((user as unknown as Record<string, unknown>)?.referral_payout_mode as string) || "credit") !== "credit") {
    return 0;
  }

  let consumed = 0;
  await sequelize.transaction(async (t) => {
    const referrals = await Referral.findAll({
      where: { referrer_user_id: userId, status: { [Op.in]: ["active", "rewarded"] } },
      order: [["activated_at", "ASC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    let remaining = maxUsd;
    for (const r of referrals) {
      if (remaining <= 0.001) break;
      const accrued = Number(r.commission_accrued_usd || 0);
      const paid = Number(r.commission_paid_usd || 0);
      const credited = Number(r.commission_credited_usd || 0);
      const unpaid = round2(accrued - paid - credited);
      if (unpaid <= 0) continue;
      const applied = round2(Math.min(unpaid, remaining));
      if (applied <= 0) continue;
      await r.update({ commission_credited_usd: round2(credited + applied) }, { transaction: t });
      await ReferralReward.create(
        {
          referral_id: r.referral_id,
          user_id: userId,
          reward_type: "commission_credit",
          amount: applied,
          currency: "USD",
          status: "credited",
          transaction_id: transactionRef,
          credited_at: new Date(),
        } as Record<string, unknown> as never,
        { transaction: t }
      );
      remaining = round2(remaining - applied);
      consumed = round2(consumed + applied);
    }
  });

  if (consumed > 0) {
    apiLogger.info(
      `[ReferralCredit] Applied $${consumed.toFixed(2)} referral fee-credit for user ${userId} (tx ${transactionRef})`
    );
  }
  return consumed;
};

/**
 * Fee-credit shift for settlement paths that work in CRYPTO units and DON'T already
 * have a pre-computed platform-fee USD (e.g. the incomplete-payment RECOVERY flow in
 * paymentController.ts). Given the admin/merchant crypto split for a payment, this:
 *   • reads the account's available fee-credit (0 unless 'credit' payout mode),
 *   • derives the platform-fee cap in USD from the admin crypto portion at the payment's
 *     realized rate (receivedUSD / baseCryptoAmount) — a PROPER USD conversion, not a guess,
 *   • shifts crypto admin→merchant, capped so the admin fee never goes negative,
 *   • returns the shifted amounts + the USD actually applied (= min(cap, crypto-shifted→USD)).
 * It does NOT mutate the DB balance. The caller persists `referral_credit_applied_usd`
 * on the tx row and then calls consumeReferralCreditForTransaction (idempotent) AFTER the
 * settlement write. `toUsd` is injected (paymentHelpers.convertToUSD) to avoid a circular
 * import; any failure returns the UNMODIFIED split (never blocks a settlement).
 */
export const computeReferralFeeCreditShift = async (params: {
  userId?: number | null;
  currency: string;
  baseCryptoAmount: number;
  adminAmountToSend: number;
  userAmountToSend: number;
  toUsd: (amount: number, currency: string) => Promise<number>;
}): Promise<{ adminAmountToSend: number; userAmountToSend: number; appliedUsd: number }> => {
  const origAdmin = Number(params.adminAmountToSend) || 0;
  const origUser = Number(params.userAmountToSend) || 0;
  let admin = origAdmin;
  let user = origUser;
  let appliedUsd = 0;
  try {
    const userId = Number(params.userId) || 0;
    const baseCrypto = Number(params.baseCryptoAmount) || 0;
    if (userId && user > 0 && admin > 0 && baseCrypto > 0) {
      const availableCredit = await getAvailableCreditForFees(userId);
      if (availableCredit > 0) {
        const receivedUSD = Number(await params.toUsd(baseCrypto, params.currency)) || 0;
        if (receivedUSD > 0) {
          const rate = receivedUSD / baseCrypto; // USD per unit of this crypto
          const platformFeeUsd = admin * rate;   // the fee portion, in USD → the cap
          const applyUsd = Math.min(availableCredit, platformFeeUsd);
          if (applyUsd > 0) {
            let creditCrypto = applyUsd / rate;
            if (creditCrypto > admin) creditCrypto = admin; // never drive admin negative
            if (creditCrypto > 0) {
              admin = admin - creditCrypto;
              user = user + creditCrypto;
              if (user > baseCrypto) user = baseCrypto;
              const actualUsd = creditCrypto * rate;
              appliedUsd = Math.min(applyUsd, round2(actualUsd)); // never over-consume vs shift
            }
          }
        }
      }
    }
  } catch (err) {
    apiLogger.warn(
      `[ReferralCredit] computeReferralFeeCreditShift skipped (non-fatal): ${(err as Error)?.message || err}`
    );
    return { adminAmountToSend: origAdmin, userAmountToSend: origUser, appliedUsd: 0 };
  }
  return { adminAmountToSend: admin, userAmountToSend: user, appliedUsd };
};

export default { getAvailableCreditForFees, consumeReferralCreditForTransaction, computeReferralFeeCreditShift };
