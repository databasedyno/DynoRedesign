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
import { invalidateUserAuthCache } from "../../middleware/authMiddleware";
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

export const changeEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newEmail, password } = req.body;
    
    if (!newEmail || !password) {
      return errorResponseHelper(res, 400, "Email and password are required");
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return errorResponseHelper(res, 400, "Invalid email format");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user || !(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if new email is already in use
    const emailExists = await userModel.findOne({
      where: {
        email: newEmail.toLowerCase(),
        user_id: { [Op.ne]: userData.user_id }
      }
    });
    
    if (emailExists) {
      return errorResponseHelper(res, 400, "Email address already in use");
    }
    
    const oldEmail = String(user.dataValues.email || "").toLowerCase();

    // Update email
    await userModel.update(
      { email: newEmail.toLowerCase() },
      { where: { user_id: userData.user_id } }
    );
    
    // Branded, localized notice to the NEW address + security alert to the OLD address
    try {
      await emailService.sendUserProfileUpdatedEmail(
        newEmail.toLowerCase(),
        user.dataValues.name || "",
        ["Email address: Updated"],
        oldEmail && oldEmail !== newEmail.toLowerCase() ? oldEmail : undefined,
        user.dataValues.language,
      );
    } catch (emailError) {
      userLogger.error("Failed to send email change confirmation", emailError);
    }
    
    // Generate new token with updated email
    const token = await getAccessToken(userData.user_id);
    
    successResponseHelper(res, 200, "Email updated successfully!", token);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Change Phone Number
 * PUT /api/user/phone
 * Requires password confirmation for security (since phone is used for SMS auth)
 */

export const removeEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { password } = req.body;
    
    if (!password) {
      return errorResponseHelper(res, 400, "Password is required");
    }
    
    // Get user data
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    if (!(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if user has alternative login method
    const hasMobile = user.dataValues.mobile && user.dataValues.mobile.length > 0;
    const hasGoogle = user.dataValues.google_id;
    const hasTelegram = user.dataValues.telegram_id;
    
    if (!hasMobile && !hasGoogle && !hasTelegram) {
      return errorResponseHelper(
        res, 
        400, 
        "Cannot remove email. Please add a phone number or link a social account first."
      );
    }
    
    // Remove email
    await userModel.update(
      { email: null },
      { where: { user_id: userData.user_id } }
    );
    
    userLogger.info(`Email removed for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Email removed successfully. You can still login using your phone or social accounts.");
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Remove Phone Number from Account
 * DELETE /api/user/phone
 * Requires password and must have alternative login method (email/social)
 */

export const addEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponseHelper(res, 400, "Invalid email format");
    }

    // Check if email is already in use by another user
    const emailExists = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
        user_id: { [Op.ne]: userData.user_id },
      },
    });
    if (emailExists) {
      return errorResponseHelper(res, 400, "Email address already in use by another account");
    }

    // Send OTP to the email
    const sent = await sendEmailOTP(email.toLowerCase(), userData.name || "User", { purpose: 'emailChange' });
    if (sent) {
      return successResponseHelper(res, 200, "Verification OTP sent to your email address.");
    }
    return errorResponseHelper(res, 503, "Unable to send OTP email. Please try again shortly.");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Verify Add Email (Step 2: Verify OTP & Save)
 * POST /api/user/verifyAddEmail
 * Requires auth. Verifies the email OTP and saves the email to the account.
 */
export const verifyAddEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return errorResponseHelper(res, 400, "Email and OTP are required");
    }

    // Verify OTP from Redis
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
      return errorResponseHelper(res, 400, "OTP expired. Please request a new one.");
    }

    if (otp !== item.otp) {
      const locked = await recordOtpFailure(otpKey, item, undefined, { email: userData.email, ip: clientIp(req), channel: "email_change" });
      return errorResponseHelper(res, 400, locked ? otpLockedMessage : "OTP did not match!");
    }

    // OTP verified - check email not taken (race condition guard)
    const emailExists = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
        user_id: { [Op.ne]: userData.user_id },
      },
    });
    if (emailExists) {
      await deleteRedisItem(otpKey);
      return errorResponseHelper(res, 400, "Email address already in use by another account");
    }

    // Save email to user account
    await userModel.update(
      { email: email.toLowerCase(), email_verified: true },
      { where: { user_id: userData.user_id } }
    );
    await deleteRedisItem(otpKey);
    // B2: email + email_verified just changed — bump the auth cache so the
    // gate/downstream reflect it immediately.
    await invalidateUserAuthCache(userData.user_id);

    // Generate new token with updated data
    const token = await getAccessToken(userData.user_id);

    userLogger.info(`Email added for user ${userData.user_id}: ${email.toLowerCase()}`);
    successResponseHelper(res, 200, "Email added and verified successfully!", token);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Add Phone to Account (Step 1: Send SMS OTP)
 * POST /api/user/addPhone
 * Requires auth. Sends SMS OTP to the new phone for verification.
 */

