import crypto from 'crypto';
import { apiLogger } from "../utils/loggers";
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../utils/dbInstance';
import User from '../models/userModels/userModel';
import RefereeCode from '../models/referralModels/refereeCodeModel';
import Referral from '../models/referralModels/referralModel';
import { toFixedStr } from "../utils/money";

// ============================================
// REFEREE CODE SERVICE (Type 2 - Payment Link)
// ============================================

/**
 * Generate unique referee code
 * Format: REF-XXXXXXXX (8 random chars)
 */
export const generateRefereeCode = (): string => {
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `REF-${randomPart}`;
};

/**
 * Check if customer email already has a Dynopay account
 */
export const checkEmailHasAccount = async (email: string): Promise<boolean> => {
  const user = await User.findOne({
    where: { email: email.toLowerCase() },
  });
  return !!user;
};

/**
 * Check if referee code was already sent to this email
 */
export const checkRefereeCodeSent = async (email: string): Promise<boolean> => {
  const existingCode = await RefereeCode.findOne({
    where: { 
      customer_email: email.toLowerCase(),
      status: { [Op.in]: ['sent', 'used'] },
    },
  });
  return !!existingCode;
};

/**
 * Create referee code for payment link email
 * Returns null if:
 * - Email already has an account
 * - Referee code already sent to this email
 */
export const createRefereeCode = async (params: {
  customerEmail: string;
  referrerCompanyId: number;
  referrerUserId: number;
  paymentLinkId?: number;
}): Promise<{ code: string; discount: number; duration: number; unsubscribeToken: string } | null> => {
  const { customerEmail, referrerCompanyId, referrerUserId, paymentLinkId } = params;
  const email = customerEmail.toLowerCase();

  // Check if email already has account
  const hasAccount = await checkEmailHasAccount(email);
  if (hasAccount) {
    apiLogger.info(`[RefereeCode] Skipping - ${email} already has an account`);
    return null;
  }

  // Check if code already sent to this email
  const codeSent = await checkRefereeCodeSent(email);
  if (codeSent) {
    apiLogger.info(`[RefereeCode] Skipping - code already sent to ${email}`);
    return null;
  }

  // Generate unique code
  let code = generateRefereeCode();
  let attempts = 0;
  while (attempts < 10) {
    const exists = await RefereeCode.findOne({ where: { code } });
    if (!exists) break;
    code = generateRefereeCode();
    attempts++;
  }

  // Create referee code (expires in 30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const refereeCode = await RefereeCode.create({
    code,
    customer_email: email,
    referrer_company_id: referrerCompanyId,
    referrer_user_id: referrerUserId,
    payment_link_id: paymentLinkId,
    status: 'sent',
    discount_percent: 50,
    discount_duration_days: 30,
    sent_at: new Date(),
    expires_at: expiresAt,
  } as Record<string, unknown>);

  apiLogger.info(`[RefereeCode] Created code ${code} for ${email}`);

  return {
    code: refereeCode.code,
    discount: refereeCode.discount_percent,
    duration: refereeCode.discount_duration_days,
    unsubscribeToken: (refereeCode as unknown as { unsubscribe_token: string }).unsubscribe_token,
  };
};

/**
 * Validate and redeem referee code during signup
 * Returns discount info if valid, null if invalid
 */
export const redeemRefereeCode = async (params: {
  code: string;
  userEmail: string;
  userId: number;
}): Promise<{
  success: boolean;
  discountPercent?: number;
  discountDays?: number;
  expiresAt?: Date;
  referrerUserId?: number;
  message: string;
}> => {
  const { code, userId } = params;

  // Find the referee code
  const refereeCode = await RefereeCode.findOne({
    where: { code: code.toUpperCase() },
  });

  if (!refereeCode) {
    return { success: false, message: 'Invalid referee code' };
  }

  // Check if code is expired
  if (new Date() > refereeCode.expires_at) {
    await refereeCode.update({ status: 'expired' });
    return { success: false, message: 'Referee code has expired' };
  }

  // Check if code is already used
  if (refereeCode.status === 'used') {
    return { success: false, message: 'Referee code has already been used' };
  }

  // Check if code was sent to a different email (optional - can be relaxed)
  // For now, allow any email to use the code

  // Mark code as used
  await refereeCode.update({
    status: 'used',
    used_by_user_id: userId,
    used_at: new Date(),
  });

  // Calculate discount expiry date
  const discountExpiresAt = new Date();
  discountExpiresAt.setDate(discountExpiresAt.getDate() + refereeCode.discount_duration_days);

  // Apply discount to new user
  await User.update(
    {
      fee_discount_percent: refereeCode.discount_percent,
      fee_discount_expires_at: discountExpiresAt,
      fee_discount_reason: 'referee_code',
      referred_by_referee_code: refereeCode.code,
    },
    { where: { user_id: userId } }
  );

  // UNIFIED referral program (revenue-share): the referrer's reward — 25% of
  // this invited merchant's platform fees as CREDIT over a 12-month window — is
  // DEFERRED. It unlocks only after this invited user takes their first
  // qualifying ($100+) payment, exactly like the organic user-referral program.
  // We record a pending referral so the reward monitor can process it later
  // (utils/crons/referralRewardMonitor.ts). The referrer gets NO fee discount.
  if (refereeCode.referrer_user_id !== userId) {
    const existingReferral = await Referral.findOne({
      where: {
        referred_user_id: userId,
        status: { [Op.in]: ['pending', 'active', 'rewarded'] },
      },
    });
    if (!existingReferral) {
      await Referral.create({
        referrer_user_id: refereeCode.referrer_user_id,
        referred_user_id: userId,
        referral_code: refereeCode.code,
        status: 'pending',
        activation_requirement: 'first_transaction_100',
        bonus_amount: 0,
        bonus_currency: 'USD',
        referee_discount_percent: refereeCode.discount_percent,
        referee_discount_duration_days: refereeCode.discount_duration_days,
        referred_at: new Date(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      } as Record<string, unknown>);

      // Increment referrer's referral count (once per invited user)
      await User.increment(
        { referral_count: 1 },
        { where: { user_id: refereeCode.referrer_user_id } }
      );
    }
  }

  apiLogger.info(`[RefereeCode] Code ${code} redeemed by user ${userId} — referrer reward deferred to first payment`);

  return {
    success: true,
    discountPercent: refereeCode.discount_percent,
    discountDays: refereeCode.discount_duration_days,
    expiresAt: discountExpiresAt,
    referrerUserId: refereeCode.referrer_user_id,
    message: `Welcome! You have ${refereeCode.discount_percent}% off fees for ${refereeCode.discount_duration_days} days`,
  };
};

// ============================================
// USER REFERRAL CODE SERVICE (Type 1 - Organic)
// ============================================

/**
 * Generate user referral code
 * Format: DYNO2026JOHXXXXXXXX
 */
export const generateUserReferralCode = (_userId: number, userName: string): string => {
  const prefix = 'DYNO';
  const year = new Date().getFullYear();
  const userPart = (userName || 'USR').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${year}${userPart}${randomPart}`;
};

/**
 * Redeem user referral code during signup.
 * Referee (new user): 50% off fees for 30 days (applied immediately).
 * Referrer: earns 25% of the referred merchant's fees as credit for 12 months,
 * unlocked after the referee's first $100+ payment (revenue-share, deferred).
 */
export const redeemUserReferralCode = async (params: {
  referralCode: string;
  newUserId: number;
}): Promise<{
  success: boolean;
  message: string;
  discountPercent?: number;
  discountDays?: number;
}> => {
  const { referralCode, newUserId } = params;

  // Find referrer by referral code
  const referrer = await User.findOne({
    where: { referral_code: referralCode },
  });

  if (!referrer) {
    return { success: false, message: 'Invalid referral code' };
  }

  const referrerId = (referrer as unknown as { user_id: number }).user_id;

  // Check if user is trying to refer themselves
  if (referrerId === newUserId) {
    return { success: false, message: 'You cannot refer yourself' };
  }

  // F4 fix: a referred user may hold only ONE referral across ALL referrers.
  // Guard on referred_user_id (any pending/active/rewarded) — mirrors the
  // redeemRefereeCode path — so a second referrer's organic code can't create a
  // duplicate pending row that lingers forever (activation only picks one).
  const existingReferral = await Referral.findOne({
    where: {
      referred_user_id: newUserId,
      status: { [Op.in]: ['pending', 'active', 'rewarded'] },
    },
  });

  if (existingReferral) {
    return { success: false, message: 'Referral already applied' };
  }

  // Create referral record (status: pending - activated after first $100 transaction)
  await Referral.create({
    referrer_user_id: referrerId,
    referred_user_id: newUserId,
    referral_code: referralCode,
    status: 'pending',
    activation_requirement: 'first_transaction_100',
    bonus_amount: 0, // Fee discount instead of bonus
    bonus_currency: 'USD',
    referee_discount_percent: 50,
    referee_discount_duration_days: 30,
    referred_at: new Date(),
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days to complete qualifying transaction
  } as Record<string, unknown>);

  // Apply immediate discount to referee (50% for 30 days)
  const refereeDiscountExpiry = new Date();
  refereeDiscountExpiry.setDate(refereeDiscountExpiry.getDate() + 30);

  await User.update(
    {
      fee_discount_percent: 50,
      fee_discount_expires_at: refereeDiscountExpiry,
      fee_discount_reason: 'user_referral_referee',
      referred_by_code: referralCode,
    },
    { where: { user_id: newUserId } }
  );

  // Increment referrer's referral count
  await User.increment(
    { referral_count: 1 },
    { where: { user_id: referrerId } }
  );

  apiLogger.info(`[UserReferral] New user ${newUserId} referred by ${referrerId}`);

  return {
    success: true,
    message: 'Referral code applied! You have 50% off fees for 30 days',
    discountPercent: 50,
    discountDays: 30,
  };
};

/**
 * Activate a referral when the referred merchant completes their first qualifying
 * ($100+) transaction. Opens the 12-month REVENUE-SHARE commission window.
 *
 * REVENUE-SHARE MODEL (2026-08): the referrer no longer gets a 50%/30d fee
 * discount here. Instead the referral becomes 'active' and starts accruing 25%
 * of the platform fees the referred merchant generates, for 12 months
 * (see accrueReferralCommission + the referralRewardMonitor cron).
 *
 * Idempotent: only acts on a 'pending' referral; re-runs are no-ops once active.
 * (Name kept as processReferrerReward — the cron imports it; activateReferral is
 * an alias below.)
 */
export const processReferrerReward = async (params: {
  refereeUserId: number;
  transactionAmount: number;
}): Promise<boolean> => {
  const { refereeUserId, transactionAmount } = params;

  // Activation gate: referred merchant's first $100+ successful payment.
  if (transactionAmount < 100) {
    return false;
  }

  // Find pending referral for this referred merchant.
  const referral = await Referral.findOne({
    where: {
      referred_user_id: refereeUserId,
      status: 'pending',
    },
  });

  if (!referral) {
    return false; // No pending referral (already active/rewarded, or none)
  }

  // Open the 12-month commission window from activation. NO fee discount granted.
  const activatedAt = new Date();
  const windowEndsAt = new Date(activatedAt);
  windowEndsAt.setMonth(windowEndsAt.getMonth() + 12);

  const currentRate = Number(referral.commission_rate ?? 0.25) || 0.25;

  await referral.update({
    status: 'active',
    activated_at: activatedAt,
    commission_rate: currentRate,
    commission_window_ends_at: windowEndsAt,
    last_accrual_at: activatedAt,
  });

  apiLogger.info(
    `[Referral] Activated referral ${referral.referral_id} (referrer ${referral.referrer_user_id}); ` +
    `${toFixedStr((currentRate * 100), 0)}% revenue-share window open until ${windowEndsAt.toISOString()}`
  );

  // Milestone nudge: tell the REFERRER their merchant just went live. Best-effort —
  // never blocks activation. Leader/prod only (email suppressed by DISABLE_OUTBOUND_EMAIL).
  try {
    const [referrer, merchant] = await Promise.all([
      User.findByPk(referral.referrer_user_id, { attributes: ['email', 'name'] }),
      User.findByPk(refereeUserId, { attributes: ['name', 'email'] }),
    ]);
    const to = (referrer as unknown as { email?: string })?.email;
    if (to) {
      const referrerName = (referrer as unknown as { name?: string })?.name || to;
      const m = merchant as unknown as { name?: string; email?: string };
      const merchantName = m?.name || m?.email || 'a merchant you referred';
      const { sendReferralActivatedEmail } = await import('./email/referralEmails');
      await sendReferralActivatedEmail(to, referrerName, merchantName);
    }
  } catch (mailErr) {
    apiLogger.error(`[Referral] activation email failed for referral ${referral.referral_id}: ${mailErr}`);
  }

  return true;
};

/** Explicit alias — "activate" is the accurate verb for the revenue-share model. */
export const activateReferral = processReferrerReward;

// Revenue-share commission accrual lives in referralCommissionService.ts
// (R2 file-size split — pure move, no logic change). Re-exported for callers.
import {
  accrueReferralCommission,
  accrueActiveReferralCommissions,
  getReferrerCommissionSummary,
  clawbackReferralCommission,
  clawbackReversedReferralCommissions,
} from './referralCommissionService';
export {
  accrueReferralCommission,
  accrueActiveReferralCommissions,
  getReferrerCommissionSummary,
  clawbackReferralCommission,
  clawbackReversedReferralCommissions,
};

// ============================================
// FEE DISCOUNT CALCULATION (moved to referral/feeDiscount.ts — R2 file-size split)
// ============================================
import { getUserFeeDiscount, calculateDiscountedFee } from './referral/feeDiscount';
export { getUserFeeDiscount, calculateDiscountedFee };

// ============================================
// REFERRAL MARKETING BACKFILL (moved to referral/refereeBackfill.ts — R2 file-size split)
// ============================================
export { backfillRefereeInvites, type BackfillResult } from './referral/refereeBackfill';

// Real-time post-payment referee invite — extracted to its own module to keep
// this file under the 500-line R2 budget. Re-exported here so existing import
// paths (services/referralService) keep working.
import { maybeSendPostPaymentInvite } from './referral/postPaymentInvite';
export { maybeSendPostPaymentInvite };


export default {
  maybeSendPostPaymentInvite,
  // Referee Code (Type 2)
  generateRefereeCode,
  checkEmailHasAccount,
  checkRefereeCodeSent,
  createRefereeCode,
  redeemRefereeCode,
  // User Referral (Type 1)
  generateUserReferralCode,
  redeemUserReferralCode,
  processReferrerReward,
  activateReferral,
  accrueReferralCommission,
  accrueActiveReferralCommissions,
  getReferrerCommissionSummary,
  clawbackReferralCommission,
  clawbackReversedReferralCommissions,
  // Fee Discount
  getUserFeeDiscount,
  calculateDiscountedFee,
};
