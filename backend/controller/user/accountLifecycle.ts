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

export const deleteAccount = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { password, confirmation } = req.body;

    if (!password) {
      return errorResponseHelper(res, 400, "Password is required for account deletion");
    }

    if (confirmation !== "DELETE") {
      return errorResponseHelper(res, 400, "Please type 'DELETE' to confirm account deletion");
    }

    // Verify password using bcrypt (with SHA-256 migration)
    const user = await userModel.findOne({
      where: { user_id: userData.user_id }
    });

    if (!user || !(await verifyPassword(password, user.dataValues.password, userData.user_id))) {
      return errorResponseHelper(res, 401, "Invalid password");
    }

    // Delete all related data (cascading should handle most, but let's be explicit)
    const userId = userData.user_id;

    // Delete notifications
    await notificationModel.destroy({ where: { user_id: userId } });
    
    // Delete notification preferences
    await notificationPreferencesModel.destroy({ where: { user_id: userId } });

    // Delete KYC records
    await kycModel.destroy({ where: { user_id: userId } });

    // Delete wallet addresses
    await userWalletAddressModel.destroy({ where: { user_id: userId } });

    // Delete wallets
    await userWalletModel.destroy({ where: { user_id: userId } });

    // Delete API keys (will cascade to plans and subscriptions)
    await apiModel.destroy({ where: { user_id: userId } });

    // Delete companies (will cascade to related data)
    await companyModel.destroy({ where: { user_id: userId } });

    // Clean up Redis entries for user's payment links
    try {
      const { paymentLinkModel } = await import("../../models");
      const userPaymentLinks = await paymentLinkModel.findAll({
        where: { user_id: userId },
        attributes: ['payment_link'],
      });
      
      for (const link of userPaymentLinks) {
        const paymentLinkUrl = link.dataValues.payment_link;
        const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
        if (urlMatch && urlMatch[1]) {
          await deleteRedisItem("customer-" + urlMatch[1]);
        }
      }
      
      // Delete payment links from database
      await paymentLinkModel.destroy({ where: { user_id: userId } });
      
      // Clean up any cached data for this user
      await deleteRedisItem(`dashboard:${userId}:all`);
      await deleteRedisItem(`profile:${userId}`);
      await deleteRedisItem(`wallets:${userId}`);
      await deleteRedisItem(`auth:user:${userId}`);
      await deleteRedisItem(userData.email + "-withdrawal-otp");
      
      userLogger.info(`Redis cleanup completed for user ${userId}`);
    } catch (redisError) {
      userLogger.warn(`Redis cleanup failed for user ${userId}: ${getErrorMessage(redisError)}`);
      // Continue with deletion even if Redis cleanup fails
    }

    // Finally, delete the user
    await userModel.destroy({ where: { user_id: userId } });

    userLogger.info(`User account deleted: ${userData.email}`);

    return successResponseHelper(res, 200, "Account deleted successfully", {
      message: "Your account and all associated data have been permanently deleted"
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

