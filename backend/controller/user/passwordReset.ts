import { raw as envRaw } from "../../utils/config";
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
import { recordOtpFailure, otpLockedMessage } from "../../helper/otpGuard";
import { clientIp } from "../../middleware/rateLimitMiddleware";

export const forgotPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }

    // Find user by email
    const user = await userModel.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return successResponseHelper(res, 200, "If the email exists, an OTP has been sent", {});
    }

    // Send OTP via email (reuse existing sendEmailOTP which stores in Redis)
    const sent = await sendEmailOTP(email.toLowerCase(), user.dataValues.name || "User", { purpose: 'passwordReset' });
    if (!sent) {
      return errorResponseHelper(res, 503, "Unable to send OTP at this time. Please try again shortly.");
    }

    userLogger.info(`Password reset OTP sent for email: ${email}`);
    
    return successResponseHelper(res, 200, "If the email exists, an OTP has been sent", {});

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Forgot Password Phone - Send OTP to phone via Telnyx
 * POST /api/user/forgot-password-phone
 */
export const forgotPasswordPhone = async (req: express.Request, res: express.Response) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return errorResponseHelper(res, 400, "Phone number is required");
    }

    // Find user by mobile
    const user = await userModel.findOne({
      where: { mobile },
    });

    if (!user) {
      return successResponseHelper(res, 200, "If the phone number exists, an OTP has been sent", {});
    }

    // Send OTP via Telnyx SMS
    const sent = await sendTelnyxSMS(mobile);
    if (sent) {
      userLogger.info(`Password reset OTP sent via SMS for mobile: ${mobile.slice(0, 4)}****`);
      return successResponseHelper(res, 200, "If the phone number exists, an OTP has been sent", {});
    }

    // SMS failed — silently fall back to email if the account has one, but keep
    // the response IDENTICAL (account-enumeration protection: never reveal that
    // the number is registered or that it fell back to email).
    const userEmail = user.dataValues?.email;
    const userName = user.dataValues?.name || "User";
    if (userEmail) {
      userLogger.info(`SMS failed, falling back to email for password reset`, { mobile: mobile.slice(0, 4) + "****" });
      await sendEmailOTP(userEmail, userName, { purpose: 'passwordReset' });
    }

    return successResponseHelper(res, 200, "If the phone number exists, an OTP has been sent", {});

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Forgot Password Verify OTP (Email) - Verify OTP and return reset session token
 * POST /api/user/forgot-password/verify-otp
 */
export const forgotPasswordVerifyOtp = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return errorResponseHelper(res, 400, "Email and OTP are required");
    }

    // Get OTP from Redis
    const otpKey = `otp:${email.toLowerCase()}`;
    const item = await getRedisItem(otpKey);

    if (!item || !item.otp) {
      return errorResponseHelper(res, 400, "OTP expired or not found. Please request a new one.");
    }

    const createdTime = new Date(item.createdAt);
    const currentTime = new Date();
    const diff = getMinutesBetweenDates(currentTime, createdTime);

    if (diff >= 10) {
      await deleteRedisItem(otpKey);
      return errorResponseHelper(res, 400, "OTP has expired. Please request a new one.");
    }

    if (otp !== item.otp) {
      const locked = await recordOtpFailure(otpKey, item, undefined, { email, ip: clientIp(req), channel: "password_reset" });
      return errorResponseHelper(res, 400, locked ? otpLockedMessage : "Invalid OTP. Please try again.");
    }

    // OTP verified — delete it and create a short-lived reset session token
    await deleteRedisItem(otpKey);

    const resetSessionToken = crypto.randomBytes(32).toString("hex");
    const resetSessionKey = `pwd-reset-session:${resetSessionToken}`;
    await setRedisItemWithTTL(resetSessionKey, {
      email: email.toLowerCase(),
      verifiedAt: new Date().toISOString(),
    }, 900); // 15 minutes TTL

    userLogger.info(`Password reset OTP verified for email: ${email}`);

    return successResponseHelper(res, 200, "OTP verified successfully", { resetToken: resetSessionToken });

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Forgot Password Verify OTP (Phone) - Verify Telnyx OTP and return reset session token
 * POST /api/user/forgot-password-phone/verify-otp
 */
export const forgotPasswordPhoneVerifyOtp = async (req: express.Request, res: express.Response) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return errorResponseHelper(res, 400, "Phone number and OTP are required");
    }

    // Verify via Telnyx API
    const telnyxApiKey = envRaw("TELNYX_API_KEY") || envRaw("ACCESS_TOKEN");
    const verifyProfileId = envRaw("TELNYX_VERIFY_PROFILE_ID") || envRaw("PROFILE_ID");

    try {
      const { data: { data } } = await axios.post(
        `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
        {
          code: otp,
          verify_profile_id: verifyProfileId,
        },
        {
          headers: {
            Authorization: "Bearer " + telnyxApiKey,
          },
        }
      );

      if (data.response_code !== "accepted") {
        return errorResponseHelper(res, 400, "Invalid OTP. Please try again.");
      }
    } catch (verifyErr: any) {
      const errMsg = verifyErr?.response?.data?.errors?.[0]?.detail || "OTP verification failed";
      userLogger.error("[forgotPasswordPhoneVerifyOtp] Telnyx verify failed", { error: errMsg });
      return errorResponseHelper(res, 400, "Invalid OTP. Please try again.");
    }

    // Find user by mobile to get email for the reset session
    const user = await userModel.findOne({ where: { mobile } });
    if (!user) {
      // Stay generic — never reveal that the number has no account.
      return errorResponseHelper(res, 400, "Invalid OTP. Please try again.");
    }

    // Create reset session token
    const resetSessionToken = crypto.randomBytes(32).toString("hex");
    const resetSessionKey = `pwd-reset-session:${resetSessionToken}`;
    await setRedisItemWithTTL(resetSessionKey, {
      email: user.dataValues.email?.toLowerCase() || null,
      mobile: mobile,
      userId: user.dataValues.user_id,
      verifiedAt: new Date().toISOString(),
    }, 900); // 15 minutes TTL

    userLogger.info(`Password reset OTP verified for mobile: ${mobile.slice(0, 4)}****`);

    return successResponseHelper(res, 200, "OTP verified successfully", { resetToken: resetSessionToken });

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Reset Password - Reset password using OTP-verified session token
 * POST /api/user/reset-password
 */
export const resetPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !newPassword) {
      return errorResponseHelper(res, 400, "Reset token and new password are required");
    }

    if (newPassword.length < 6) {
      return errorResponseHelper(res, 400, "Password must be at least 6 characters");
    }
    
    // Validate password strength (OWASP)
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    // Check for OTP-based reset session token in Redis.
    // SECURITY: getRedisItem() returns {} for a missing key, so the session is
    // only valid when it actually carries the identity written by verify-otp.
    // Never fall back to the request-body email here — that allowed resetting
    // ANY account's password with a made-up token.
    const resetSessionKey = `pwd-reset-session:${token}`;
    const session = await getRedisItem(resetSessionKey);
    const hasOtpSession = !!session && (typeof session.email === "string" || session.userId != null);

    if (hasOtpSession) {
      // OTP-based flow — session contains email or userId
      const userEmail = session.email as string | undefined;
      const userId = session.userId;

      let user;
      if (userId) {
        user = await userModel.findOne({ where: { user_id: userId } });
      } else if (userEmail) {
        user = await userModel.findOne({ where: { email: userEmail.toLowerCase() } });
      }

      if (!user) {
        return errorResponseHelper(res, 400, "User not found");
      }

      // Hash new password and update
      const hashedPassword = hashPassword(newPassword);
      await userModel.update(
        {
          password: hashedPassword,
          reset_token: null,
          reset_token_expiry: null,
        },
        { where: { user_id: user.dataValues.user_id } }
      );

      // Delete the session token
      await deleteRedisItem(resetSessionKey);

      // Send confirmation email
      try {
        const now = new Date();
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const userEmail2 = user.dataValues.email;
        if (userEmail2) {
          await emailService.sendPasswordChangedEmail(userEmail2, user.dataValues.name || "", date, time, user.dataValues.language);
        }
      } catch (emailErr) {
        userLogger.warn("[resetPassword] Confirmation email failed", { error: (emailErr as Error).message });
      }

      userLogger.info(`Password reset successful (OTP flow) for user: ${user.dataValues.user_id}`);
      return successResponseHelper(res, 200, "Password has been reset successfully", {});
    }

    // Legacy token-based flow fallback (for old reset links)
    if (!email) {
      return errorResponseHelper(res, 400, "Invalid or expired reset token");
    }

    const tokenHash = sha256(token).toString();
    const user = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
        reset_token: tokenHash,
        reset_token_expiry: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return errorResponseHelper(res, 400, "Invalid or expired reset token");
    }

    const hashedPassword = hashPassword(newPassword);
    await userModel.update(
      {
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      },
      { where: { user_id: user.dataValues.user_id } }
    );

    try {
      const now = new Date();
      const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      await emailService.sendPasswordChangedEmail(email.toLowerCase(), user.dataValues.name || "", date, time, user.dataValues.language);
    } catch (emailErr) {
      userLogger.warn("[resetPassword] Confirmation email failed", { error: (emailErr as Error).message });
    }

    userLogger.info(`Password reset successful (link flow) for email: ${email}`);
    return successResponseHelper(res, 200, "Password has been reset successfully", {});

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Google Sign-In - Authenticate with Google ID token
 * POST /api/user/google-signin
 */

