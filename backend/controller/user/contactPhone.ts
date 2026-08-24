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

export const changePhone = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newPhone, password } = req.body;
    
    if (!newPhone || !password) {
      return errorResponseHelper(res, 400, "Phone number and password are required");
    }
    
    // Validate phone format (basic - digits only, 10-15 chars)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(newPhone)) {
      return errorResponseHelper(res, 400, "Invalid phone number format. Use digits only (10-15 digits)");
    }
    
    // Verify password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });
    
    if (!user || !(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if new phone is already in use by another user
    const phoneExists = await userModel.findOne({
      where: {
        mobile: newPhone,
        user_id: { [Op.ne]: userData.user_id }
      }
    });
    
    if (phoneExists) {
      return errorResponseHelper(res, 400, "Phone number already in use by another account");
    }
    
    // Update phone number
    await userModel.update(
      { mobile: newPhone },
      { where: { user_id: userData.user_id } }
    );
    
    // Get updated user data
    const updatedUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] }
    });
    
    // Optionally send SMS confirmation to new number
    try {
      await axios.post(
        "https://api.telnyx.com/v2/messages",
        {
          from: envRaw("TELNYX_PHONE_NUMBER"),
          to: "+" + newPhone,
          text: `Your Dynopay phone number has been successfully updated to this number. If you didn't make this change, please contact support immediately.`
        },
        {
          headers: {
            Authorization: "Bearer " + (envRaw("TELNYX_API_KEY") || envRaw("ACCESS_TOKEN")),
          },
        }
      );
    } catch (smsError) {
      // Log but don't fail the request if SMS fails
      userLogger.error("Failed to send phone change confirmation SMS", smsError);
    }
    
    userLogger.info(`Phone number updated for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Phone number updated successfully!", updatedUser);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Remove Email from Account
 * DELETE /api/user/email
 * Requires password and must have alternative login method (mobile/social)
 */

export const removePhone = async (req: express.Request, res: express.Response) => {
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
    const hasEmail = user.dataValues.email && user.dataValues.email.length > 0;
    const hasGoogle = user.dataValues.google_id;
    const hasTelegram = user.dataValues.telegram_id;
    
    if (!hasEmail && !hasGoogle && !hasTelegram) {
      return errorResponseHelper(
        res, 
        400, 
        "Cannot remove phone. Please add an email or link a social account first."
      );
    }
    
    // Remove mobile
    await userModel.update(
      { mobile: null },
      { where: { user_id: userData.user_id } }
    );
    
    userLogger.info(`Phone removed for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Phone number removed successfully. You can still login using your email or social accounts.");
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Delete User Account
 * DELETE /api/user/account
 * Requires password confirmation for security
 */

export const addPhone = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    let { phone } = req.body;
    if (!phone) {
      return errorResponseHelper(res, 400, "Phone number is required");
    }
    phone = phone.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
      return errorResponseHelper(res, 400, "Invalid phone number format. Use 10-15 digits with country code.");
    }

    // Check if phone is already in use by another user
    const phoneExists = await userModel.findOne({
      where: {
        mobile: phone,
        user_id: { [Op.ne]: userData.user_id },
      },
    });
    if (phoneExists) {
      return errorResponseHelper(res, 400, "Phone number already in use by another account");
    }

    // Send OTP via Telnyx SMS
    const smsSent = await sendTelnyxSMS(phone);
    if (smsSent) {
      return successResponseHelper(res, 200, "Verification OTP sent to your phone number.");
    }
    return errorResponseHelper(res, 503, "Failed to send SMS OTP. Please try again shortly.");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Verify Add Phone (Step 2: Verify SMS OTP & Save)
 * POST /api/user/verifyAddPhone
 * Requires auth. Verifies the SMS OTP and saves the phone to the account.
 */
export const verifyAddPhone = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp) {
      return errorResponseHelper(res, 400, "Phone number and OTP are required");
    }
    phone = phone.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');

    // Verify OTP with Telnyx
    try {
      const verifyResponse = await axios.post(
        `https://api.telnyx.com/v2/verifications/by_phone_number/+${phone}/actions/verify`,
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

      if (verifyResponse.data?.data?.response_code !== "accepted") {
        return errorResponseHelper(res, 400, "Invalid or expired OTP");
      }
    } catch (otpError) {
      userLogger.error("Phone OTP verification failed", otpError);
      return errorResponseHelper(res, 400, "Invalid or expired OTP");
    }

    // OTP verified - check phone not taken (race condition guard)
    const phoneExists = await userModel.findOne({
      where: {
        mobile: phone,
        user_id: { [Op.ne]: userData.user_id },
      },
    });
    if (phoneExists) {
      return errorResponseHelper(res, 400, "Phone number already in use by another account");
    }

    // Save phone to user account
    await userModel.update(
      { mobile: phone },
      { where: { user_id: userData.user_id } }
    );

    // Generate new token with updated data
    const token = await getAccessToken(userData.user_id);

    userLogger.info(`Phone added for user ${userData.user_id}: ${phone}`);
    successResponseHelper(res, 200, "Phone number added and verified successfully!", token);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};



/**
 * Request OTP for setting/updating password from profile
 * POST /api/user/profile/request-password-otp
 * Sends OTP to the user's registered email or phone for identity verification
 */

