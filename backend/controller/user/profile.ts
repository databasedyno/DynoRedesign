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
import { resolveFeeFreeRemaining } from "../../services/feeFreeService";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";

export const updateUser = async (req: express.Request, res: express.Response) => {
  try {
    const file = req.file as Express.Multer.File;
    
    // Handle multiple input formats
    let data;
    
    // Format 1: JSON string in "data" field (backwards compatibility)
    if (req.body.data && typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } 
    // Format 2: Object in "data" field (backwards compatibility)
    else if (req.body.data && typeof req.body.data === 'object') {
      data = req.body.data;
    } 
    // Format 3: Individual form fields (NEW - Swagger UI friendly)
    else if (req.body.name || req.body.email) {
      data = {
        name: req.body.name,
        email: req.body.email,
      };
      // Remove undefined fields
      Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    } else {
      return res.status(400).json({ message: "Missing user data. Please provide name and email.", error: true });
    }
    
    const userData = jwt.decode(res.locals.token) as IUserType;
    const oldEmail = userData.email;
    const oldName = userData.name;
    
    // Track what fields are being updated
    const updatedFields: string[] = [];
    if (data.name && data.name !== oldName) {
      updatedFields.push(`Name: ${oldName} → ${data.name}`);
    }
    if (data.email && data.email !== oldEmail) {
      updatedFields.push(`Email: ${oldEmail} → ${data.email}`);
    }
    
    let photo;
    if (file) {
      const serverUrl = process.env.SERVER_URL?.endsWith('/') ? process.env.SERVER_URL : process.env.SERVER_URL + '/';
      photo = serverUrl + "images/" + file.filename;
      updatedFields.push('Profile Photo: Updated');
    }
    await userModel.update(
      {
        ...data,
        photo,
      },
      { where: { user_id: userData.user_id } }
    );
    
    // Send profile update notification email
    if (updatedFields.length > 0) {
      const { sendUserProfileUpdatedEmail } = await import("../../services/emailService");
      const newEmail = data.email || oldEmail;
      const newName = data.name || oldName;
      
      sendUserProfileUpdatedEmail(
        newEmail,
        newName,
        updatedFields,
        data.email && data.email !== oldEmail ? oldEmail : undefined
      ).catch(err => {
        userLogger.error("[UpdateUser] Failed to send notification email:", err);
      });
    }
    
    const token = await getAccessToken(userData.user_id);
    successResponseHelper(res, 200, "User updated successfully!", token);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};


export const getProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // Check Redis cache first
    const cacheKey = `profile:${userData.user_id}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      userLogger.info(`[Profile] Cache hit for user ${userData.user_id}`);
      return successResponseHelper(res, 200, "Profile retrieved successfully", cached);
    }

    // OPTIMIZED: Run all queries in parallel
    const [user, companiesCount, walletsCount, apiKeysCount] = await Promise.all([
      userModel.findOne({
        where: { user_id: userData.user_id },
        attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry', 'verified_otp', 'otp_expired'] }
      }),
      companyModel.count({ where: { user_id: userData.user_id } }),
      userWalletAddressModel.count({ where: { user_id: userData.user_id } }),
      apiModel.count({ where: { user_id: userData.user_id } })
    ]);

    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    // password is excluded from the main query, so check separately
    const userPwCheck = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ['password']
    });

    const profileData = {
      ...user.dataValues,
      // Clamp to the trial the user is still entitled to for their lifetime
      // volume — the dashboard GrowPanel drives its fee-free CTA off this
      // field, and a drifted counter must not offer the promo to a merchant
      // who already processed way past the first $500.
      fee_free_remaining_usd: resolveFeeFreeRemaining(
        parseFloat((user.dataValues as any).cumulative_volume_usd || "0"),
        parseFloat((user.dataValues as any).fee_free_remaining_usd || "0")
      ),
      has_password: !!(userPwCheck?.dataValues?.password),
      stats: {
        companies: companiesCount,
        wallets: walletsCount,
        api_keys: apiKeysCount,
      }
    };

    // Cache the result
    await setRedisItem(cacheKey, profileData);
    await setRedisTTL(cacheKey, PROFILE_CACHE_TTL);

    return successResponseHelper(res, 200, "Profile retrieved successfully", profileData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Update Profile (name, mobile, username)
 * PUT /api/user/profile
 * Allows updating basic profile fields without image
 */
export const updateProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { name, mobile, username, language } = req.body;
    
    // Fetch current DB data for accurate comparison (JWT may be stale)
    const currentUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ['name', 'mobile', 'username', 'language']
    });
    const currentName = currentUser?.dataValues?.name || userData.name;
    const currentMobile = currentUser?.dataValues?.mobile || userData.mobile;
    const currentUsername = currentUser?.dataValues?.username || userData.username;
    const currentLanguage = currentUser?.dataValues?.language || 'en';
    
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    const updatedFields: string[] = [];
    
    if (name !== undefined && name !== currentName) {
      updateData.name = name;
      updatedFields.push(`Name: ${currentName} → ${name}`);
    }
    if (mobile !== undefined && mobile !== currentMobile) {
      updateData.mobile = mobile;
      updatedFields.push(`Mobile: ${currentMobile || 'Not set'} → ${mobile}`);
    }
    if (username !== undefined && username !== currentUsername) {
      updateData.username = username;
      updatedFields.push(`Username: ${currentUsername} → ${username}`);
    }
    // Language preference — updated silently (no notification email for a UI preference)
    const SUPPORTED_LANGS = ["en", "pt", "fr", "es", "de", "nl"];
    let languagePreferenceProvided = false;
    if (language !== undefined) {
      const base = String(language || "").toLowerCase().split("-")[0];
      if (!SUPPORTED_LANGS.includes(base)) {
        return errorResponseHelper(res, 400, "Unsupported language");
      }
      languagePreferenceProvided = true;
      const normalized = normalizeLang(language);
      if (normalized !== currentLanguage) {
        updateData.language = normalized;
      }
    }
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      // Re-selecting the language you already have is a valid, idempotent no-op
      // (the client uses this to keep the account in sync) — not an error.
      if (languagePreferenceProvided) {
        const profile = await userModel.findOne({
          where: { user_id: userData.user_id },
          attributes: { exclude: ["password", "reset_token", "reset_token_expiry"] },
        });
        return successResponseHelper(res, 200, "No changes to apply", profile);
      }
      return errorResponseHelper(res, 400, "No fields to update");
    }
    
    await userModel.update(updateData, {
      where: { user_id: userData.user_id }
    });
    
    // Get updated user data
    const updatedUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] }
    });
    
    // Invalidate profile cache
    await deleteRedisItem(`profile:${userData.user_id}`);
    
    // Send profile update notification email
    if (updatedFields.length > 0) {
      const { sendUserProfileUpdatedEmail } = await import("../../services/emailService");
      sendUserProfileUpdatedEmail(
        userData.email,
        updatedUser?.dataValues.name || userData.name,
        updatedFields
      ).catch(err => {
        userLogger.error("[UpdateProfile] Failed to send notification email:", err);
      });
    }
    
    successResponseHelper(res, 200, "Profile updated successfully!", updatedUser);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Canonical set of dashboard Quick Action slugs a merchant may pin.
 * MUST stay in sync with the frontend catalog in
 * Components/Page/Dashboard/v2026/QuickActionsDock.tsx.
 */
export const ALLOWED_QUICK_ACTIONS = [
  "create-paylink",
  "paylinks",
  "invoice",
  "wallet",
  "transactions",
  "creator",
  "products",
  "fees",
  "api",
  "referrals",
];

/**
 * Update the merchant's pinned dashboard Quick Actions.
 * PUT /api/user/dashboard-quick-actions
 * Body: { actions: string[] }  (exactly 4 unique slugs from ALLOWED_QUICK_ACTIONS)
 */
export const updateDashboardQuickActions = async (
  req: express.Request,
  res: express.Response,
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { actions } = req.body;
    if (!Array.isArray(actions) || actions.length !== 4) {
      return errorResponseHelper(res, 400, "Exactly 4 quick actions are required");
    }
    const unique = Array.from(new Set(actions.map((a: unknown) => String(a))));
    if (unique.length !== 4) {
      return errorResponseHelper(res, 400, "Quick actions must be unique");
    }
    const invalid = unique.filter((a) => !ALLOWED_QUICK_ACTIONS.includes(a));
    if (invalid.length > 0) {
      return errorResponseHelper(res, 400, `Unknown quick action(s): ${invalid.join(", ")}`);
    }

    await userModel.update(
      { dashboard_quick_actions: unique },
      { where: { user_id: userData.user_id } },
    );

    // Invalidate the cached profile so the next getProfile reflects the change.
    await deleteRedisItem(`profile:${userData.user_id}`);

    return successResponseHelper(res, 200, "Quick actions updated", {
      dashboard_quick_actions: unique,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Change Email Address
 * PUT /api/user/email
 * Requires password confirmation for security
 */

export const updateLastCompany = async (req: express.Request, res: express.Response) => {
  try {
    const userId = (res.locals.user as any)?.user_id;
    if (!userId) return errorResponseHelper(res, 401, "Unauthorized");

    const { company_id } = req.body;
    if (!company_id) return errorResponseHelper(res, 400, "company_id is required");

    // Verify this company belongs to the user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userId },
    });
    if (!company) return errorResponseHelper(res, 404, "Company not found or not owned by user");

    await userModel.update(
      { last_company_id: company_id },
      { where: { user_id: userId } }
    );

    successResponseHelper(res, 200, "Last company updated", { last_company_id: company_id });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Check Phone - Check if a phone number is registered
 * GET /api/user/checkPhone?phone=1234567890
 */

