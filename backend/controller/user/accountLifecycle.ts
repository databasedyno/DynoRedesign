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
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../../services/accountLockoutService";
import { createSession } from "../../services/sessionService";
import { finalizeUploadedImage } from "../../services/objectStorage";
import { is2FARequired } from "../../services/twoFactorService";
import { normalizeLang } from "../../utils/emailI18n";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";
import { sendAccountDeletedEmail, sendAccountDeleteOTPEmail, sendAccountSoftDeletedEmail } from "../../services/email/securityEmails";
import { sendAccountDeletedAdminEmail } from "../../services/email/adminNotificationEmails";
import { softDeleteAccount } from "../../services/accountPurgeService";
import { generateOtpCode, recordOtpFailure, otpLockedMessage, OTP_TTL_SECONDS } from "../../helper/otpGuard";
import { ACCOUNT_DELETE_GRACE_DAYS } from "../../helper/accountDeletion";
import { raw as envRaw } from "../../utils/config";

const accountDeleteOtpKey = (userId: number | string) => `account_delete_otp_${userId}`;
const maskAccountEmail = (email: string) => email.replace(/(.{2})(.*)(@.*)/, "$1***$3");

/**
 * POST /api/user/account/send-otp
 * Step 1 of account deletion: email a one-time code to the account owner
 * (mirrors the brand-deletion confirmation flow).
 */
export const sendDeleteAccountOtp = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["name", "email"] });
    if (!user) return errorResponseHelper(res, 404, "Account not found");
    const email: string | null = user.dataValues.email || userData.email || null;
    if (!email) {
      return errorResponseHelper(res, 400, "Your account has no email address to receive the verification code.");
    }

    const otp = generateOtpCode();
    await setRedisItemWithTTL(
      accountDeleteOtpKey(userData.user_id),
      { otp, createdAt: new Date().toISOString(), attempts: 0 },
      OTP_TTL_SECONDS,
    );
    await sendAccountDeleteOTPEmail(email, user.dataValues.name || userData.name || "", otp);
    userLogger.info(`Account delete OTP sent for user ${userData.user_id}`);

    return successResponseHelper(res, 200, "Verification code sent to your email", {
      email: maskAccountEmail(email),
      expires_in: OTP_TTL_SECONDS,
      // Preview pods suppress outbound email, so surface the code for QA there only.
      ...(envRaw("DISABLE_OUTBOUND_EMAIL") === "true" ? { preview_otp: otp } : {}),
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** Step 2 helper: consume the account-delete code (5-strike lockout). */
const verifyDeleteAccountOtp = async (userId: number | string, otp: unknown) => {
  const code = String(otp ?? "").trim();
  if (!code) return { ok: false, status: 400, message: "Verification code is required. Request a code to your email first." };
  const key = accountDeleteOtpKey(userId);
  const item = (await getRedisItem(key)) as Record<string, unknown> | null;
  if (!item || !item.otp) return { ok: false, status: 400, message: "Verification code expired or not found. Please request a new one." };
  if (String(item.otp) !== code) {
    const locked = await recordOtpFailure(key, item);
    return { ok: false, status: 400, message: locked ? otpLockedMessage : "Invalid verification code." };
  }
  await deleteRedisItem(key);
  return { ok: true };
};

/**
 * DELETE /api/user/account
 * Soft-delete (7-day recoverable) the whole account after OTP confirmation.
 * The account is hidden + the user is signed out everywhere immediately; the
 * irreversible data purge happens after 7 days (services/accountPurgeService),
 * or when an admin manually purges it. An admin can restore within the window.
 */
export const deleteAccount = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const otpCheck = await verifyDeleteAccountOtp(userData.user_id, req.body?.otp ?? req.query?.otp);
    if (!otpCheck.ok) {
      return errorResponseHelper(res, otpCheck.status || 400, otpCheck.message || "Invalid verification code.");
    }

    const user = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["name", "email", "language"] });
    if (!user) return errorResponseHelper(res, 404, "Account not found");

    const { ok, scheduledPurgeAt } = await softDeleteAccount(userData.user_id, userData.user_id);
    if (!ok) {
      return errorResponseHelper(res, 400, "Your account is already scheduled for deletion.");
    }

    const purgeDateStr = scheduledPurgeAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const email = user.dataValues.email;
    if (email) {
      void sendAccountSoftDeletedEmail(email, user.dataValues.name || "", purgeDateStr);
    }
    void sendAccountDeletedAdminEmail({
      userId: userData.user_id,
      ownerName: user.dataValues.name,
      ownerEmail: email || null,
      deletedAtStr: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC",
      purgeDateStr,
    });

    userLogger.info(`User account ${userData.user_id} soft-deleted (${email}) — purge ${scheduledPurgeAt.toISOString()}`);

    return successResponseHelper(res, 200, "Your account has been scheduled for deletion. You have 7 days to restore it — contact support if this was a mistake.", {
      scheduled_purge_at: scheduledPurgeAt.toISOString(),
      restore_before: purgeDateStr,
      grace_days: ACCOUNT_DELETE_GRACE_DAYS,
      logout: true,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Unsubscribe from referee code reminder emails
 * No authentication required - uses unsubscribe token
 */
export const unsubscribeFromReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { refereeCodeModel } = await import("../../models");
    
    // Find the referee code with this unsubscribe token
    const refereeCode = await refereeCodeModel.findOne({
      where: { unsubscribe_token: token },
    });
    
    if (!refereeCode) {
      return errorResponseHelper(res, 404, "Invalid unsubscribe token");
    }
    
    const codeData = refereeCode.dataValues;
    
    // Check if already unsubscribed
    if (codeData.unsubscribed_at) {
      return successResponseHelper(res, 200, "You have already unsubscribed from reminder emails", {
        email: codeData.customer_email,
        unsubscribed_at: codeData.unsubscribed_at,
      });
    }
    
    // Mark as unsubscribed
    await refereeCodeModel.update(
      { unsubscribed_at: new Date() },
      { where: { code_id: codeData.code_id } }
    );
    
    userLogger.info(`[Unsubscribe] ${codeData.customer_email} unsubscribed from referee code reminders`);
    
    return successResponseHelper(res, 200, "Successfully unsubscribed from reminder emails", {
      email: codeData.customer_email,
      message: "You will no longer receive reminder emails about your discount code. Note: Your discount code is still valid if you decide to sign up.",
    });
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Unsubscribe from payment link reminder emails
 * No authentication required - uses unsubscribe token
 */
export const unsubscribeFromPaymentReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { paymentLinkModel } = await import("../../models");
    
    // Find the payment link with this unsubscribe token
    const paymentLink = await paymentLinkModel.findOne({
      where: { unsubscribe_token: token },
    });
    
    if (!paymentLink) {
      return errorResponseHelper(res, 404, "Invalid unsubscribe token");
    }
    
    const linkData = paymentLink.dataValues;
    
    // Check if already unsubscribed
    if (linkData.unsubscribed_at) {
      return successResponseHelper(res, 200, "You have already unsubscribed from payment reminder emails", {
        email: linkData.email,
        unsubscribed_at: linkData.unsubscribed_at,
      });
    }
    
    // Mark as unsubscribed
    await paymentLinkModel.update(
      { unsubscribed_at: new Date() },
      { where: { link_id: linkData.link_id } }
    );
    
    userLogger.info(`[Unsubscribe] ${linkData.email} unsubscribed from payment link reminders (link_id: ${linkData.link_id})`);
    
    return successResponseHelper(res, 200, "Successfully unsubscribed from payment reminder emails", {
      email: linkData.email,
      message: "You will no longer receive reminder emails about this payment. You can still complete the payment using your original link.",
    });
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Get onboarding status for authenticated user
 * GET /api/user/onboarding-status
 * 
 * Returns a comprehensive status of user's setup progress including:
 * - Wallet setup status
 * - KYC status
 * - API key status
 * - Company setup status
 * - Next steps for incomplete setup
 */

