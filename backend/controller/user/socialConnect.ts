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

export const connectSocial = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, photo, provider, id = "0" } = req.body;

    const isExists = await userModel
      .findOne({
        where: {
          [Op.or]: [
            {
              email: email,
            },
            { telegram_id: id },
          ],
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    userLogger.info("isExists====>", isExists);
    if (isExists) {
      const userData = await userModel.findOne({
        where: {
          [Op.or]: [
            {
              email,
            },
            { telegram_id: id },
          ],
        },
      });
      if (!userData) {
        errorResponseHelper(res, 404, "User not found!");
      } else {
        const resData = await getAccessToken(userData.dataValues.user_id);
        successResponseHelper(res, 200, "Login Successful!", resData);
      }
    } else {
      const image =
        photo ?? process.env.SERVER_URL + (await downloadUserImage());
      const createdUser = await userModel.create({
        name,
        email,
        photo: image,
        login_type: provider.toUpperCase(),
        telegram_id: id,
      });

      if (provider === "telegram") {
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: id,
            text: "Please provide an email or mobile number to have more control over your account.",
          }
        );
      }
      const resData = await getAccessToken(createdUser.dataValues.user_id);

      // Send welcome email if email is available
      if (email) {
        try {
          await emailService.sendWelcomeEmail(email.toLowerCase(), name || "User");
        } catch (emailError) {
          // Log error but don't fail registration
          userLogger.error("Error sending welcome email:", emailError);
        }
      }

      // Notify admin of new user registration (non-blocking)
      emailService.sendNewUserAdminNotification({
        name, email, login_type: provider.toUpperCase(),
        user_id: createdUser.dataValues.user_id,
      }).catch(err => userLogger.error("Admin notification error:", err));

      successResponseHelper(res, 200, "Registered Successful!", resData);
    }
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Facebook Sign-In / Sign-Up
 * POST /api/user/facebook-signin
 * Authenticates or registers user via Facebook OAuth
 */
export const facebookSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return errorResponseHelper(res, 400, "Facebook access token is required");
    }

    // Verify token and get user info from Facebook
    let facebookUserInfo: { id?: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
    try {
      const response = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );
      facebookUserInfo = response.data;
    } catch (fbError) {
      userLogger.error("Facebook token verification failed", fbError);
      return errorResponseHelper(res, 401, "Invalid Facebook access token");
    }

    if (!facebookUserInfo || !facebookUserInfo.id) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from Facebook");
    }

    const { id: facebookId, name, email, picture } = facebookUserInfo;
    const photoUrl = picture?.data?.url;

    // Check if user exists by email or facebook ID (stored in external_id)
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          email ? { email: email.toLowerCase() } : null,
          { external_id: facebookId },
        ].filter(Boolean),
      },
    });

    if (user) {
      // Update external_id if not set
      if (!user.dataValues.external_id && facebookId) {
        await userModel.update(
          { 
            external_id: facebookId,
            login_type: "FACEBOOK",
          },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      // Generate access token and return
      const resData = await getAccessToken(user.dataValues.user_id);
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // Create new user
    const defaultPhoto = process.env.SERVER_URL + (await downloadUserImage());
    const finalPhoto = photoUrl || defaultPhoto;
    
    const createdUser = await userModel.create({
      name: name || (email ? email.split("@")[0] : "Facebook User"),
      email: email ? email.toLowerCase() : null,
      photo: finalPhoto,
      login_type: "FACEBOOK",
      external_id: facebookId,
    });

    // Create wallets for the new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter(
      (x) => x.dataValues.currency_type === "FIAT"
    );
    const cryptoData = walletData.filter(
      (x) => x.dataValues.currency_type === "CRYPTO"
    );

    for (let i = 0; i < fiatData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: fiatData[i].dataValues.wallet_type,
        currency_type: "FIAT",
      });
    }

    for (let i = 0; i < cryptoData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: cryptoData[i].dataValues.wallet_type,
        currency_type: "CRYPTO",
      });
    }

    // Generate access token
    const resData = await getAccessToken(createdUser.dataValues.user_id);

    // Send welcome email if email is available
    if (email) {
      try {
        await emailService.sendWelcomeEmail(email.toLowerCase(), name || "Facebook User");
      } catch (emailError) {
        // Log error but don't fail registration
        userLogger.error("Error sending welcome email:", emailError);
      }
    }

    userLogger.info(`New user registered via Facebook: ${facebookId}`);

    // Notify admin of new user registration (non-blocking)
    emailService.sendNewUserAdminNotification({
      name: name || "Facebook User", email: email ? email.toLowerCase() : null,
      login_type: "Facebook", user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * Forgot Password - Send reset email with token
 * POST /api/user/forgot-password
 */

