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

export const changePassword = async (req: express.Request, res: express.Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    
    // Validate new password strength
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    // Find user and verify old password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 401, "User not found");
    }
    
    const isOldPasswordValid = await verifyPassword(oldPassword, user.dataValues.password, userData.user_id);
    if (isOldPasswordValid) {
      const newPass = hashPassword(newPassword);
      await userModel.update(
        { password: newPass },
        {
          where: {
            user_id: userData.user_id,
          },
        }
      );
      
      // Send password changed notification email
      try {
        const user = await userModel.findByPk(userData.user_id);
        if (user && user.dataValues.email) {
          const now = new Date();
          const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
          const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          await emailService.sendPasswordChangedEmail(
            user.dataValues.email,
            user.dataValues.name || 'User',
            date,
            time
          );
          userLogger.info(`[ChangePassword] Password changed notification sent to ${user.dataValues.email}`);
        }
      } catch (emailError) {
        userLogger.error("[ChangePassword] Failed to send password changed email:", emailError);
        // Don't fail the request if email fails
      }
      
      successResponseHelper(res, 200, "Password updated successfully!", null);
    } else {
      errorResponseHelper(res, 401, "Old password not recognized!");
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};


/**
 * Set or update the account password.
 * POST /api/user/profile/set-password  { newPassword }
 * Identity is proven by the `security` step-up session (requireStepUp at the router).
 */
export const setPassword = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return errorResponseHelper(res, 400, "New password is required");
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    await userModel.update({ password: hashPassword(newPassword) }, { where: { user_id: userData.user_id } });

    // Invalidate profile cache so has_password updates
    await deleteRedisItem(`profile:${userData.user_id}`);

    try {
      if (user.dataValues.email) {
        const now = new Date();
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        await emailService.sendPasswordChangedEmail(user.dataValues.email, user.dataValues.name || 'User', date, time);
      }
    } catch (emailError) {
      userLogger.error("[setPassword] Failed to send notification email:", emailError);
    }

    const hadPassword = !!user.dataValues.password;
    userLogger.info(`[setPassword] Password ${hadPassword ? 'updated' : 'set'} for user ${userData.user_id}`);
    return successResponseHelper(res, 200, hadPassword ? "Password updated successfully!" : "Password set successfully!");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Get login activity history
 * GET /api/user/login-activity
 */
export const getLoginActivity = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const { count, rows } = await loginActivityModel.findAndCountAll({
      where: { user_id: userData.user_id },
      order: [['login_at', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'ip_address', 'device', 'browser', 'os', 'location', 'flagged', 'flagged_at', 'login_at'],
    });

    return successResponseHelper(res, 200, "Login activity retrieved", {
      activities: rows.map((r: any) => r.dataValues),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Flag a login as suspicious ("Not you?" link from email)
 * POST /api/user/security/flag-login
 * Public endpoint — uses security_token from email link
 */
export const flagLogin = async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return errorResponseHelper(res, 400, "Security token is required");
    }

    const activity = await loginActivityModel.findOne({
      where: { security_token: token, flagged: false },
    }) as any;

    if (!activity) {
      return errorResponseHelper(res, 404, "Invalid or already processed security token");
    }

    // Flag the login
    await loginActivityModel.update(
      { flagged: true, flagged_at: new Date() },
      { where: { id: activity.dataValues.id } }
    );

    // Lock the account: clear password and invalidate sessions
    const userId = activity.dataValues.user_id;

    // Set a temporary lock flag in Redis (24 hours)
    await setRedisItemWithTTL(`account_locked:${userId}`, { locked: true, reason: "suspicious_login", flagged_login_id: activity.dataValues.id }, 86400);

    // Log the security event
    userLogger.warn(`[SECURITY] Account ${userId} flagged suspicious login ID ${activity.dataValues.id} from IP ${activity.dataValues.ip_address}`);

    // Send security alert email
    try {
      const user = await userModel.findOne({ where: { user_id: userId } });
      if (user && user.dataValues.email) {
        const { sendSecurityAlertEmail } = await import("../../services/emailService");
        await sendSecurityAlertEmail(
          user.dataValues.email,
          user.dataValues.name || 'User',
          'Suspicious Login Flagged',
          `A login from ${activity.dataValues.location || activity.dataValues.ip_address} was flagged as suspicious. Your account has been temporarily locked for 24 hours. Please reset your password to regain access.`
        );
      }
    } catch (emailError) {
      userLogger.error("[flagLogin] Failed to send security alert email:", emailError);
    }

    return successResponseHelper(res, 200, "Login flagged as suspicious. Your account has been temporarily locked for your protection. Please reset your password to regain access.", {
      flagged: true,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

// One-tap "sign out everywhere" (new-device alert email) lives in
// ./signoutEverywhere.ts — kept separate so this file stays within the
// 500-line budget (R2). Exported to the router via userController.

// ── Creator vanity page (dynopay.com/{handle}) ──
// Handles reserved so a user can't shadow an app route.

