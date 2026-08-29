import express from "express";
import {
  downloadUserImage,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import emailService from "../../services/emailService";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel, loginActivityModel } from "../../models";
import { userWalletAddressModel } from "../../models/userModels";
import notificationModel from "../../models/notificationModel";
import notificationPreferencesModel from "../../models/notificationPreferencesModel";
import kycModel from "../../models/kycModel";
import sha256 from "crypto-js/sha256";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../helper/passwordHelper";
import crypto from "crypto";
import sequelize from "../../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import axios from "axios";
import { userLogger } from "../../utils/loggers";
import { invalidateUserAuthCache } from "../../middleware/authMiddleware";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../../services/accountLockoutService";
import { createSession } from "../../services/sessionService";
import { finalizeUploadedImage } from "../../services/objectStorage";
import { is2FARequired } from "../../services/twoFactorService";
import { normalizeLang } from "../../utils/emailI18n";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";

export const getOnboardingStatus = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;

    // ── Redis cache (60s TTL) — onboarding changes rarely ──
    const cacheKey = `onboarding:${userId}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Onboarding status retrieved successfully", cached);
    }
    
    // 1. Check wallet setup
    // Known crypto wallet_type values — wallets whose wallet_type matches any of
    // these are crypto wallets regardless of the legacy currency_type column.
    const CRYPTO_WALLET_TYPES = [
      'BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'SOL', 'XRP', 'TRX',
      'USDT-ERC20', 'USDT-TRC20', 'USDC-ERC20', 'USDT-POLYGON',
      'POLYGON', 'RLUSD', 'RLUSD-ERC20',
    ];

    // ── Run ALL independent queries in parallel ──
    const [allWallets, additionalAddresses, kycRecord, volumeResult, apiKeys, companies, userRecord] = await Promise.all([
      userWalletModel.findAll({ where: { user_id: userId } }),
      userWalletAddressModel.findAll({ where: { user_id: userId } }).catch(() => []),
      kycModel.findOne({ where: { user_id: userId } }),
      sequelize.query(
        `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
         FROM tbl_customer_transaction 
         WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId)
         AND status = 'successful'`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      ) as Promise<{ total_volume: string }[]>,
      apiModel.findAll({ where: { user_id: userId } }),
      companyModel.findAll({ where: { user_id: userId } }),
      userModel.findOne({ where: { user_id: userId }, attributes: ['email_verified'] }),
    ]);

    // ── Process results (from parallel queries) ──
    const cryptoWallets = allWallets.filter((w: any) => {
      const wType = (w.get("wallet_type") || '').toUpperCase();
      const cType = (w.get("currency_type") || '').toUpperCase();
      return cType === 'CRYPTO' || CRYPTO_WALLET_TYPES.includes(wType);
    });
    
    const walletsWithAddress = cryptoWallets.filter((w: any) => {
      const address = w.get("wallet_address");
      return address && address.trim() !== '';
    });
    
    const hasCryptoWallet = cryptoWallets.length > 0;
    const hasWalletAddress = walletsWithAddress.length > 0 || (additionalAddresses as any[]).length > 0;
    const totalConfiguredAddresses = walletsWithAddress.length + (additionalAddresses as any[]).length;
    
    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));
    const kycThreshold = 10000;
    const kycGracePeriodDays = 90;
    const requiresKyc = totalVolume >= kycThreshold;
    const kycStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
    const kycApproved = kycStatus === "approved";
    
    const hasProductionKey = apiKeys.some((key: any) => 
      key.get("environment") === "production" && key.get("status") === "active"
    );
    const hasDevelopmentKey = apiKeys.some((key: any) => 
      key.get("environment") === "development" && key.get("status") === "active"
    );
    
    const hasCompany = companies.length > 0;
    
    // 5. Calculate KYC grace period if applicable
    let kycWarning: {
      type: string;
      message: string;
      days_remaining: number;
      threshold_date: string | null;
      grace_period_end: string | null;
      verification_url: string | null;
      api_endpoint: string;
      has_active_session: boolean;
    } | null = null;
    
    const veriffSessionUrl = kycRecord ? kycRecord.get("veriff_session_url") as string | null : null;
    const kycSubmittedStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
    const hasActiveSession = veriffSessionUrl && ["submitted", "pending"].includes(kycSubmittedStatus);
    
    if (requiresKyc && !kycApproved) {
      try {
        const thresholdQuery = `
          SELECT MIN("createdAt") as threshold_date
          FROM (
            SELECT "createdAt", 
                   SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
            FROM tbl_customer_transaction 
            WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) 
            AND status = 'successful'
          ) sub
          WHERE running_total >= :threshold
        `;
        
        const thresholdResult = await sequelize.query<{ threshold_date: string }>(
          thresholdQuery,
          {
            replacements: { userId, threshold: kycThreshold },
            type: QueryTypes.SELECT,
          }
        );
        
        const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : null;
        
        if (thresholdDate) {
          const gracePeriodEnd = new Date(thresholdDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + kycGracePeriodDays);
          const now = new Date();
          const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 0) {
            const urgencyType = daysRemaining <= 14 ? "critical" : daysRemaining <= 30 ? "warning" : "info";
            kycWarning = {
              type: urgencyType,
              message: daysRemaining <= 14 
                ? `URGENT: Only ${daysRemaining} days left to complete KYC verification! Your account will be restricted after ${gracePeriodEnd.toLocaleDateString()}.`
                : daysRemaining <= 30
                ? `Warning: ${daysRemaining} days remaining to complete KYC verification before your account is restricted.`
                : `KYC verification required within ${daysRemaining} days. Complete verification to continue processing payments.`,
              days_remaining: daysRemaining,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              // If merchant has an active Veriff session, use that URL; otherwise provide API endpoint
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          } else {
            kycWarning = {
              type: "critical",
              message: "Your KYC grace period has expired. Complete verification immediately to resume payment processing.",
              days_remaining: 0,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          }
        }
      } catch (e) {
        userLogger.warn("[Onboarding] Could not calculate KYC grace period:", e);
      }
    }
    
    // 6. Determine next steps
    const nextSteps: string[] = [];
    
    // Email verification (from parallel query result)
    const isEmailVerified = userRecord?.dataValues?.email_verified === true;
    
    if (!isEmailVerified) {
      nextSteps.push("Verify your email address to unlock all features");
    }
    
    if (!hasCompany) {
      nextSteps.push("Create a company to start accepting payments");
    }
    
    if (!hasWalletAddress) {
      nextSteps.push("Add a wallet address to receive crypto payments");
    }
    
    if (requiresKyc && !kycApproved) {
      const kycMessage = kycWarning?.days_remaining !== undefined && kycWarning.days_remaining <= 30
        ? `URGENT: Complete KYC verification (${kycWarning.days_remaining} days remaining)`
        : "Complete KYC verification to continue processing payments";
      nextSteps.push(kycMessage);
    }
    
    if (!hasProductionKey && hasCompany) {
      nextSteps.push("Create a production API key for live payments");
    }
    
    // 7. Determine if onboarding is complete (email must be verified)
    const onboardingComplete = isEmailVerified && hasCompany && hasWalletAddress && (!requiresKyc || kycApproved);
    
    // Build response
    const onboardingStatus = {
      email_verification: {
        is_verified: isEmailVerified,
        required_action: !isEmailVerified ? "Verify your email address" : null,
      },
      wallet_setup: {
        has_wallet: hasCryptoWallet,  // Has at least one CRYPTO wallet type
        has_wallet_address: hasWalletAddress,  // Has at least one address to receive payments
        wallet_count: cryptoWallets.length,  // Only CRYPTO wallets (not FIAT)
        address_count: totalConfiguredAddresses,  // Total configured addresses
        // Breakdown for clarity
        wallets_with_address: walletsWithAddress.length,
        additional_addresses: additionalAddresses.length,
        required_action: !hasWalletAddress ? "Add at least one wallet address to receive payments" : null,
      },
      kyc_status: {
        status: kycStatus,
        requires_kyc: requiresKyc,
        is_approved: kycApproved,
        total_volume: totalVolume,
        threshold: kycThreshold,
        grace_period_days: kycGracePeriodDays,
        required_action: requiresKyc && !kycApproved ? "Complete KYC verification" : null,
        // Include warning for in-app banner display
        warning: kycWarning,
      },
      api_key_status: {
        has_production_key: hasProductionKey,
        has_development_key: hasDevelopmentKey,
        total_keys: apiKeys.length,
        required_action: !hasProductionKey && hasCompany ? "Create a production API key for live payments" : null,
      },
      company_setup: {
        has_company: hasCompany,
        company_count: companies.length,
        required_action: !hasCompany ? "Create a company to start accepting payments" : null,
      },
      onboarding_complete: onboardingComplete,
      next_steps: nextSteps,
    };
    
    userLogger.info(`[Onboarding] Status retrieved for user ${userId}: complete=${onboardingComplete}, next_steps=${nextSteps.length}`);
    
    // Cache the result (60s TTL — onboarding state changes infrequently)
    await setRedisItem(cacheKey, onboardingStatus);
    await setRedisTTL(cacheKey, 60);
    
    return successResponseHelper(res, 200, "Onboarding status retrieved successfully", onboardingStatus);
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/verify-email
 * Verify email address using OTP sent during registration.
 * Requires authentication.
 */
export const verifyEmail = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData.user_id;
    const { otp } = req.body;

    if (!otp) {
      return errorResponseHelper(res, 400, "OTP is required");
    }

    // Check if already verified
    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    if (user.dataValues.email_verified) {
      return successResponseHelper(res, 200, "Email is already verified", { email_verified: true });
    }

    // Acquire a lock to prevent duplicate verification (race condition guard)
    const verifyLockKey = `email-verify-lock:${userId}`;
    const existingLock = await getRedisItem(verifyLockKey);
    if (existingLock && Object.keys(existingLock).length > 0) {
      return successResponseHelper(res, 200, "Email verification is being processed", { email_verified: true });
    }
    await setRedisItem(verifyLockKey, { processing: true });
    await setRedisTTL(verifyLockKey, 30); // 30 second lock

    // Check OTP from Redis
    const verifyKey = `email-verify:${userId}`;
    const storedData = await getRedisItem(verifyKey);
    if (!storedData || typeof storedData !== 'object' || !('otp' in (storedData as Record<string, unknown>))) {
      await deleteRedisItem(verifyLockKey);
      return errorResponseHelper(res, 400, "Verification code has expired. Please request a new one.");
    }

    const storedOtp = (storedData as Record<string, unknown>).otp;
    if (String(storedOtp) !== String(otp)) {
      await deleteRedisItem(verifyLockKey);
      return errorResponseHelper(res, 400, "Invalid verification code. Please try again.");
    }

    // OTP matches — mark email as verified
    await userModel.update({ email_verified: true }, { where: { user_id: userId } });
    await deleteRedisItem(verifyKey);

    // Invalidate profile cache so subsequent calls reflect the change
    await deleteRedisItem(`profile:${userId}`);
    // B2: bump the auth cache so emailVerifiedMiddleware stops gating this user
    // immediately (otherwise the cached email_verified=false lingers up to 60s).
    await invalidateUserAuthCache(userId);

    userLogger.info(`[VerifyEmail] Email verified for user ${userId}`);

    // Send welcome email now that OTP is verified (non-blocking, with dedup guard)
    const welcomeSentKey = `welcome-email-sent:${userId}`;
    const alreadySent = await getRedisItem(welcomeSentKey);
    if (!alreadySent || Object.keys(alreadySent).length === 0) {
      await setRedisItem(welcomeSentKey, { sent: true });
      await setRedisTTL(welcomeSentKey, 3600); // 1 hour dedup window
      const email = user.dataValues.email;
      const name = user.dataValues.name || "User";
      emailService.sendWelcomeEmail(email.toLowerCase(), name).catch(err => {
        userLogger.error("[VerifyEmail] Failed to send welcome email:", err);
      });
    }

    // Release lock
    await deleteRedisItem(verifyLockKey);

    return successResponseHelper(res, 200, "Email verified successfully!", { email_verified: true });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/resend-verification
 * Resend email verification OTP. Requires authentication.
 * Rate limited: 1 request per 60 seconds.
 */
export const resendVerification = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData.user_id;

    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    if (user.dataValues.email_verified) {
      return successResponseHelper(res, 200, "Email is already verified", { email_verified: true });
    }

    // Cooldown check — 60 seconds between resend requests
    const cooldownKey = `email-verify-cooldown:${userId}`;
    const cooldown = await getRedisItem(cooldownKey);
    if (cooldown && Object.keys(cooldown).length > 0) {
      return errorResponseHelper(res, 429, "Please wait 60 seconds before requesting a new code.");
    }

    // Generate new OTP
    const email = user.dataValues.email;
    const name = user.dataValues.name || "User";
    const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 min TTL
    const verifyKey = `email-verify:${userId}`;
    await setRedisItem(verifyKey, { otp: verifyOtp, createdAt: new Date().toISOString() });
    await setRedisTTL(verifyKey, 600);

    // Set 60s cooldown
    await setRedisItem(cooldownKey, { sent: true });
    await setRedisTTL(cooldownKey, 60);

    // Send email (non-blocking)
    emailService.sendEmailVerificationOTPEmail(email, name, verifyOtp).catch(err => {
      userLogger.error("[ResendVerification] Failed to send verification email:", err);
    });

    userLogger.info(`[ResendVerification] Verification OTP resent for user ${userId}`);

    return successResponseHelper(res, 200, "Verification code sent to your email.");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Update last selected company for the user (for session persistence across logins)
 * PUT /api/user/last-company
 * Body: { company_id: number }
 */

