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
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, requires2FAChallenge, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";
import { generateOtpCode, recordOtpFailure, otpLockedMessage } from "../../helper/otpGuard";
import { clientIp } from "../../middleware/rateLimitMiddleware";

export const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return errorResponseHelper(res, 400, "Email and password are required");
    }
    
    // ── Account Lockout Check ──────────────────────────────────────────────────
    const lockoutStatus = await isAccountLocked(email);
    if (lockoutStatus.locked) {
      const minutes = Math.ceil(lockoutStatus.remaining_seconds / 60);
      return errorResponseHelper(res, 429, `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minutes.`);
    }
    
    const newPassword_unused = null; // Legacy sha256 removed — bcrypt used via verifyPassword
    
    // Step 1: Find user by email only (bcrypt hashes can't be queried directly)
    const userData = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });
    
    // Step 2: Verify password using bcrypt (with transparent SHA-256 migration)
    const isPasswordValid = userData
      ? await verifyPassword(password, userData.dataValues.password, userData.dataValues.user_id)
      : false;
    
    if (!userData || !isPasswordValid) {
      // ── Record failed attempt & check lockout ─────────────────────────────
      const rawIp = req.headers['x-forwarded-for'] as string || req.ip || 'Unknown';
      const ipAddress = rawIp.split(',')[0].trim().substring(0, 45);
      
      const lockoutResult = await recordFailedAttempt(email, ipAddress);
      
      // Send alert email after 3 failed attempts (existing behavior)
      try {
        const cacheKey = `failed_logins:${email.toLowerCase()}`;
        const failedAttempts = await getRedisItem(cacheKey);
        let attemptCount = 1;
        if (failedAttempts !== null && failedAttempts !== undefined) {
          if (typeof failedAttempts === 'number') {
            attemptCount = failedAttempts + 1;
          } else if (typeof failedAttempts === 'string') {
            const parsed = parseInt(failedAttempts, 10);
            attemptCount = isNaN(parsed) ? 1 : parsed + 1;
          } else if (typeof failedAttempts === 'object') {
            const val = (failedAttempts as Record<string, unknown>).value || (failedAttempts as Record<string, unknown>).count;
            if (typeof val === 'number') {
              attemptCount = val + 1;
            } else if (typeof val === 'string') {
              const parsed = parseInt(val, 10);
              attemptCount = isNaN(parsed) ? 1 : parsed + 1;
            }
          }
        }
        await setRedisItem(cacheKey, attemptCount);
        await setRedisTTL(cacheKey, 3600);
        
        if (attemptCount >= 3) {
          const existingUser = await userModel.findOne({ where: { email: email.toLowerCase() } });
          if (existingUser) {
            const { sendFailedLoginAttemptsEmail } = await import("../../services/emailService");
            const now = new Date();
            const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            await sendFailedLoginAttemptsEmail(
              existingUser.dataValues.email,
              existingUser.dataValues.name || 'User',
              attemptCount,
              ipAddress,
              date,
              time
            );
            userLogger.info(`[Login] Failed login alert sent to ${email} - ${attemptCount} attempts from ${ipAddress}`);
          }
        }
      } catch (redisError) {
        userLogger.error("[Login] Redis error tracking failed attempts:", redisError);
      }
      
      // Return lockout warning if close to limit
      if (lockoutResult.locked) {
        return errorResponseHelper(res, 429, `Account locked for ${lockoutResult.lockout_minutes} minutes after ${lockoutResult.attempts} failed attempts.`);
      }
      
      const remainingAttempts = lockoutResult.max_attempts - lockoutResult.attempts;
      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        return errorResponseHelper(res, 401, `Invalid email or password. ${remainingAttempts} attempt(s) remaining before account lockout.`);
      }
      
      return errorResponseHelper(res, 401, "Invalid email or password");
    } else {
      // ── Trial Account Guard: Prevent trial users from logging in ──
      const userStatus = userData.dataValues.status;
      if (userStatus === "trial") {
        return errorResponseHelper(
          res,
          403,
          "Your account hasn't been activated yet. Please complete a trial payment and claim your funds to activate your account."
        );
      }

      // ── Successful Credentials — Complete Login Directly ────────────────
      // Password IS the authentication factor. Users who prove their password
      // are logged in immediately (no email OTP round-trip). Accounts with
      // TOTP 2FA enabled still get the requires_2fa step inside finalizeLogin.
      // Passwordless (email-OTP / SMS) login paths are unaffected.
      await clearFailedAttempts(email);
      const cacheKey = `failed_logins:${email.toLowerCase()}`;
      await deleteRedisItem(cacheKey);

      return await finalizeLogin(userData, req, res, "[Login]");
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

// ── Verify Login OTP ──────────────────────────────────────────────────────
export const verifyLoginOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { login_otp_session, otp } = req.body;
    if (!login_otp_session || !otp) {
      return errorResponseHelper(res, 400, "Session and OTP are required");
    }

    const redisKey = `login_otp:${login_otp_session}`;
    const raw = await getRedisItem(redisKey);
    if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
      return errorResponseHelper(res, 400, "OTP expired or invalid session. Please login again.");
    }

    const otpData = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Check attempts
    if (Number(otpData.attempts) >= 3) {
      await deleteRedisItem(redisKey);
      return errorResponseHelper(res, 429, "Too many failed attempts. Please login again.");
    }

    // Verify OTP
    if (String(otpData.otp) !== String(otp)) {
      otpData.attempts = Number(otpData.attempts) + 1;
      const remaining = 3 - otpData.attempts;
      await setRedisItemWithTTL(redisKey, otpData, 300);
      if (remaining <= 0) {
        await deleteRedisItem(redisKey);
        return errorResponseHelper(res, 429, "Too many failed attempts. Please login again.");
      }
      return errorResponseHelper(res, 400, `Invalid OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
    }

    // OTP is valid — delete it and complete login
    await deleteRedisItem(redisKey);

    // Fetch user data fresh
    const userData = await userModel.findOne({ where: { user_id: otpData.user_id } });
    if (!userData) {
      return errorResponseHelper(res, 400, "User not found");
    }

    return await finalizeLogin(userData, req, res, "[Login OTP Verify]");
  } catch (e) {
    userLogger.error("[verifyLoginOTP] Error:", e);
    handleControllerError(res, e, userLogger);
  }
};

// ── Resend Login OTP ──────────────────────────────────────────────────────
export const resendLoginOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { login_otp_session } = req.body;
    if (!login_otp_session) {
      return errorResponseHelper(res, 400, "Session ID is required");
    }

    const redisKey = `login_otp:${login_otp_session}`;
    const raw = await getRedisItem(redisKey);
    if (!raw || (typeof raw === 'object' && Object.keys(raw).length === 0)) {
      return errorResponseHelper(res, 400, "Session expired. Please login again.");
    }

    const otpData = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Generate new OTP and reset attempts
    const newOtp = String(generateOtpCode());
    otpData.otp = newOtp;
    otpData.attempts = 0;
    await setRedisItemWithTTL(redisKey, otpData, 300);

    // Send new OTP email
    const { sendLoginOTPEmail } = await import("../../services/emailService");
    await sendLoginOTPEmail(otpData.email, otpData.name, newOtp);

    userLogger.info(`[Login OTP Resend] New OTP sent to ${otpData.email}`);
    successResponseHelper(res, 200, "New OTP sent to your email");
  } catch (e) {
    userLogger.error("[resendLoginOTP] Error:", e);
    handleControllerError(res, e, userLogger);
  }
};

export const checkEmail = async (req: express.Request, res: express.Response) => {
  // ── Account-enumeration protection ─────────────────────────────────────────
  // NEVER reveal whether an email is registered, and NEVER leak the account's
  // phone number. Always respond as if the email is valid so the login UI
  // advances to the password / OTP step identically for real and unknown
  // emails. A wrong password (login) or wrong code (OTP) then fails with a
  // generic error, so an attacker cannot probe which addresses have accounts.
  try {
    const { email } = req.query as { email?: string };
    if (!email || typeof email !== "string" || !email.trim()) {
      return errorResponseHelper(res, 400, "Email is required");
    }
    return successResponseHelper(res, 200, "OK", { validEmail: true });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};


export const generateOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, mobile } = req.body;
    if (mobile) {
      // Mobile-based OTP with Telnyx SMS + email fallback
      const userData = await userModel.findOne({
        where: { mobile },
        attributes: ['mobile', 'email', 'name'],
      });

      if (!userData) {
        // ── Account-enumeration protection ──────────────────────────────────
        // Behave EXACTLY as if an OTP was sent to a registered number. Nothing
        // is actually sent (no account exists); a later code entry fails with a
        // generic "invalid code", so an attacker can't tell registered numbers
        // from unregistered ones.
        return successResponseHelper(res, 200, "OTP sent successfully via SMS!");
      }

      // Attempt 1: Send via Telnyx SMS (with built-in retry)
      const smsSent = await sendTelnyxSMS(mobile);
      if (smsSent) {
        return successResponseHelper(res, 200, "OTP sent successfully via SMS!");
      }

      // Attempt 2: Fall back to email if user has one registered
      const userEmail = userData.dataValues?.email;
      const userName = userData.dataValues?.name || "User";
      if (userEmail) {
        userLogger.info(`[generateOTP] Telnyx SMS failed, falling back to email for mobile user`, {
          mobile: mobile.slice(0, 4) + "****",
          email: userEmail,
        });
        const emailSent = await sendEmailOTP(userEmail, userName);
        if (emailSent) {
          return successResponseHelper(res, 200, "SMS unavailable. OTP sent to your registered email instead.");
        }
      }

      // Both channels failed
      userLogger.error("[generateOTP] All OTP channels failed", {
        mobile: mobile.slice(0, 4) + "****",
        hasEmail: !!userEmail,
      });
      return errorResponseHelper(res, 503, "Unable to send OTP at this time. Please try again shortly.");

    } else if (email) {
      // Email-based OTP
      const userData = await userModel.findOne({
        where: { email },
      });
      if (userData?.dataValues) {
        const sent = await sendEmailOTP(email, userData.dataValues.name);
        if (sent) {
          return successResponseHelper(res, 200, "OTP sent successfully!");
        }
        return errorResponseHelper(res, 503, "Unable to send OTP email. Please try again shortly.");
      } else {
        // ── Account-enumeration protection ──────────────────────────────────
        // Respond as if the OTP was sent even when no account exists. Nothing
        // is sent; a later code entry fails generically. Keeps the response
        // identical for real and unknown emails.
        return successResponseHelper(res, 200, "OTP sent successfully!");
      }
    } else {
      return errorResponseHelper(res, 400, "Please add any number or email!");
    }
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export const confirmOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp, mobile } = req.body;
    if (otp) {
      if (mobile) {
        // ── Account-enumeration protection ──────────────────────────────────
        // ANY verification failure — a wrong code, OR no verification in flight
        // (the number was never registered so no OTP was ever sent) — returns
        // the SAME generic "OTP did not match!". Never 404 "user not found".
        let accepted = false;
        try {
          const {
            data: { data },
          } = await axios.post(
            `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
            {
              code: otp,
              verify_profile_id: envRaw("TELNYX_VERIFY_PROFILE_ID") || envRaw("PROFILE_ID"),
            },
            {
              headers: {
                Authorization: "Bearer " + (envRaw("TELNYX_API_KEY") || envRaw("ACCESS_TOKEN")),
              },
            }
          );
          accepted = data?.response_code === "accepted";
        } catch (telnyxErr) {
          userLogger.warn("[confirmOTP] Telnyx verify failed", { error: (telnyxErr as Error).message });
          accepted = false;
        }
        if (!accepted) {
          return errorResponseHelper(res, 400, "OTP did not match!");
        }
        // Verified at Telnyx — look up the local account.
        const userData = await userModel.findOne({ where: { mobile } });
        if (!userData) {
          // Stay generic even if the code verified but there's no local account.
          return errorResponseHelper(res, 400, "OTP did not match!");
        }
        if (await requires2FAChallenge(res, userData.dataValues.user_id)) return;
        const resData = await getAccessToken(userData.dataValues.user_id);
        return successResponseHelper(res, 200, "Login Successful!", resData);
      } else {
        // Get OTP from Redis instead of localStorage
        const otpKey = `otp:${email}`;
        const item = await getRedisItem(otpKey);
        
        if (!item || !item.otp) {
          errorResponseHelper(res, 400, "OTP expired or not found!");
          return;
        }
        
        const createdTime = new Date(item.createdAt);
        const currentTime = new Date();
        const diff = getMinutesBetweenDates(currentTime, createdTime);
        if (diff < 10) {
          if (otp === item.otp) {
            const userData = await userModel.findOne({
              where: {
                email,
              },
            });
            // Delete OTP after successful verification
            await deleteRedisItem(otpKey);
            if (!userData) {
              // Stay generic — never reveal that the account is missing.
              return errorResponseHelper(res, 400, "OTP did not match!");
            }
            if (await requires2FAChallenge(res, userData.dataValues.user_id)) return;
            const resData = await getAccessToken(userData.dataValues.user_id);
            successResponseHelper(res, 200, "Login Successful!", resData);
          } else {
            const locked = await recordOtpFailure(otpKey, item, undefined, { email, ip: clientIp(req), channel: "login" });
            errorResponseHelper(res, 400, locked ? otpLockedMessage : "OTP did not match!");
          }
        } else {
          // Delete expired OTP
          await deleteRedisItem(otpKey);
          errorResponseHelper(res, 400, "OTP expired!");
        }
      }
    } else {
      errorResponseHelper(res, 400, "Please add OTP!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    userLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message ?? "Please request for a new code!");
  }
};


