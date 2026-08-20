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

export const registerUser = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, password, referral_code } = req.body;
    
    // Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }
    
    const newPassword = hashPassword(password);
    const isExists = await userModel
      .findOne({
        where: {
          email: email.toLowerCase(),
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    userLogger.info("isExists====>", isExists);
    if (isExists) {
      errorResponseHelper(res, 503, "Account Already Exists!!!");
    } else {
      const photoLocation = await downloadUserImage();
      const photo = process.env.SERVER_URL + photoLocation;

      // Generate unique referral code for new user
      const generateReferralCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        const bytes = crypto.randomBytes(6);
        for (let i = 0; i < 6; i++) {
          code += chars[bytes[i] % chars.length];
        }
        return `DYNO-${code}`;
      };

      const userReferralCode = generateReferralCode();

      const createdUser = await userModel.create({
        name,
        email: email.toLowerCase(),
        photo,
        password: newPassword,
        referral_code: userReferralCode,
        referred_by_code: referral_code || null,
        language: normalizeLang(req.body?.language),
      });

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

      if (referral_code) {
        try {
          const referrer = await userModel.findOne({ where: { referral_code } });
          if (referrer) {
            const Referral = require('../models/referralModels/referralModel').default;
            await Referral.create({
              referrer_user_id: referrer.dataValues.user_id,
              referred_user_id: createdUser.dataValues.user_id,
              referral_code,
              status: 'pending',
              activation_requirement: 'first_transaction_100',
              bonus_amount: 10.00,
              bonus_currency: 'USD',
              referee_discount_percent: 50.00,
              referee_discount_duration_days: 30,
              referred_at: new Date(),
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            });
          }
        } catch (refError) {
          userLogger.error("Error creating referral record:", refError);
        }
      }

      emailService.sendNewUserAdminNotification({
        name, email: email.toLowerCase(), login_type: "Email",
        user_id: createdUser.dataValues.user_id,
      }).catch(err => userLogger.error("Admin notification error:", err));

      const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const verifyKey = `email-verify:${createdUser.dataValues.user_id}`;
      await setRedisItem(verifyKey, { otp: verifyOtp, createdAt: new Date().toISOString() });
      await setRedisTTL(verifyKey, 600);
      emailService.sendEmailVerificationOTPEmail(email.toLowerCase(), name, verifyOtp).catch(err => {
        userLogger.error("Failed to send email verification OTP:", err);
      });

      const resData = await getAccessToken(createdUser.dataValues.user_id);

      successResponseHelper(res, 200, "Registered Successful! Please verify your email.", {
        ...resData,
        email_verified: false,
        referral_code: userReferralCode,
        referred_by: referral_code || null,
      });
    }
  } catch (e) {
      handleControllerError(res, e, userLogger);
  }
};

// ─── Helper to create user wallets ───

export const registerEmailStep1 = async (req: express.Request, res: express.Response) => {
  try {
    const { email, referral_code, attribution, purpose_vertical } = req.body;

    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }

    const emailLower = email.toLowerCase().trim();

    // Optional SEO attribution — captured on the client from
    // `?src=seo&page={slug}&kind={country|vertical}` on landing pages.
    // We log it so admins can measure per-page conversion downstream.
    const attrStr = _formatAttribution(attribution);

    // Optional purpose vertical from the new PurposePicker signup step
    // (design audit Phase 2/3). One of "merchants" | "fundraisers" |
    // "creators" | "developers". Whitelist here so an invalid value from
    // an outdated client never trips the DB CHECK constraint later.
    const validVerticals = ["merchants", "fundraisers", "creators", "developers"] as const;
    const purposeVertical =
      typeof purpose_vertical === "string" &&
      (validVerticals as readonly string[]).includes(purpose_vertical)
        ? purpose_vertical
        : null;

    // Check if email already exists — if so, switch to a passwordless LOGIN via OTP
    // instead of dead-ending. We still send a code; verify-otp will sign the user in.
    const existing = await userModel.findOne({ where: { email: emailLower } });
    if (existing) {
      const sentLogin = await sendEmailOTP(emailLower, existing.dataValues.name || "there");
      if (!sentLogin) {
        return errorResponseHelper(res, 503, "Unable to send verification code. Please try again.");
      }
      userLogger.info(`[RegisterEmail] Existing account — login OTP sent: ${emailLower}${attrStr}`);
      return successResponseHelper(res, 200, "You already have an account — we've sent a code to log you in.", { account_exists: true });
    }

    // Store referral code + attribution + purpose vertical in Redis for
    // later use during OTP verification (Step 2).
    if (referral_code) {
      await setRedisItemWithTTL(`reg-referral:${emailLower}`, { referral_code }, 900);
    }
    if (attribution && typeof attribution === "object" && attribution.src === "seo") {
      await setRedisItemWithTTL(
        `reg-attribution:${emailLower}`,
        {
          src: String(attribution.src),
          page: String(attribution.page || ""),
          kind: String(attribution.kind || ""),
        },
        900,
      );
    }
    if (purposeVertical) {
      await setRedisItemWithTTL(`reg-vertical:${emailLower}`, { purpose_vertical: purposeVertical }, 900);
    }

    // Send OTP via email
    const sent = await sendEmailOTP(emailLower, "there");
    if (!sent) {
      return errorResponseHelper(res, 503, "Unable to send verification code. Please try again.");
    }

    userLogger.info(`[RegisterEmail] OTP sent for registration: ${emailLower}${attrStr}${purposeVertical ? " · vertical=" + purposeVertical : ""}`);
    return successResponseHelper(res, 200, "Verification code sent to your email", { account_exists: false });

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Simplified Email Registration - Step 2: Verify OTP & Create Account
 * POST /api/user/registerEmail/verify-otp
 */
export const registerEmailVerifyOtp = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return errorResponseHelper(res, 400, "Email and verification code are required");
    }

    const emailLower = email.toLowerCase().trim();

    // Verify OTP from Redis
    const otpKey = `otp:${emailLower}`;
    const item = await getRedisItem(otpKey);

    if (!item || !item.otp) {
      return errorResponseHelper(res, 400, "Verification code expired. Please request a new one.");
    }

    const createdTime = new Date(item.createdAt);
    const diff = getMinutesBetweenDates(new Date(), createdTime);
    if (diff >= 10) {
      await deleteRedisItem(otpKey);
      return errorResponseHelper(res, 400, "Verification code expired. Please request a new one.");
    }

    if (otp !== item.otp) {
      return errorResponseHelper(res, 400, "Invalid verification code.");
    }

    // OTP verified — delete it
    await deleteRedisItem(otpKey);

    // If the account already exists, this OTP was a passwordless LOGIN —
    // issue tokens and sign the user in (proceed as usual).
    const existing = await userModel.findOne({ where: { email: emailLower } });
    if (existing) {
      const loginData = await getAccessToken(existing.dataValues.user_id);
      const existingAttr = _formatAttribution(req.body?.attribution);
      userLogger.info(`[RegisterEmail] Existing account logged in via OTP: ${emailLower}${existingAttr}`);
      return successResponseHelper(res, 200, "Logged in successfully!", {
        ...loginData,
        account_exists: true,
        email_verified: true,
      });
    }

    // Retrieve referral code if stored
    const referralData = await getRedisItem(`reg-referral:${emailLower}`);
    const referral_code = referralData?.referral_code || null;
    if (referralData) await deleteRedisItem(`reg-referral:${emailLower}`);

    // Retrieve SEO attribution (if the user arrived from an SEO landing page)
    const storedAttr = await getRedisItem(`reg-attribution:${emailLower}`);
    if (storedAttr) await deleteRedisItem(`reg-attribution:${emailLower}`);
    const requestAttr = _formatAttribution(req.body?.attribution);
    const storedAttrStr = _formatAttribution(storedAttr && Object.keys(storedAttr).length > 0 ? storedAttr : null);
    const attrLogSuffix = requestAttr || storedAttrStr;

    // Retrieve purpose vertical stored in Redis by Step 1 (design audit 2026-08-05).
    // Also accept it directly in this request body as a fallback so callers can
    // pass it end-to-end in one shot if they prefer.
    const validVerticals = ["merchants", "fundraisers", "creators", "developers"] as const;
    const storedVertical = await getRedisItem(`reg-vertical:${emailLower}`);
    if (storedVertical) await deleteRedisItem(`reg-vertical:${emailLower}`);
    const requestVertical = req.body?.purpose_vertical;
    const rawVertical: unknown =
      (storedVertical && typeof storedVertical.purpose_vertical === "string" && storedVertical.purpose_vertical) ||
      (typeof requestVertical === "string" ? requestVertical : null);
    const purposeVertical =
      typeof rawVertical === "string" && (validVerticals as readonly string[]).includes(rawVertical)
        ? rawVertical
        : null;

    // Create user — no name, no password
    const photoLocation = await downloadUserImage();
    const photo = process.env.SERVER_URL + photoLocation;
    const userReferralCode = generateReferralCode();

    const createdUser = await userModel.create({
      name: null,
      email: emailLower,
      photo,
      password: null,
      email_verified: true, // Already verified by OTP
      referral_code: userReferralCode,
      referred_by_code: referral_code,
      login_type: "EMAIL",
      language: normalizeLang(req.body?.language),
      purpose_vertical: purposeVertical,
    });

    // Create wallets
    await createUserWallets(createdUser.dataValues.user_id);

    // Handle referral
    if (referral_code) {
      try {
        const referrer = await userModel.findOne({ where: { referral_code } });
        if (referrer) {
          const Referral = require('../models/referralModels/referralModel').default;
          await Referral.create({
            referrer_user_id: referrer.dataValues.user_id,
            referred_user_id: createdUser.dataValues.user_id,
            referral_code,
            status: 'pending',
            activation_requirement: 'first_transaction_100',
            bonus_amount: 10.00,
            bonus_currency: 'USD',
            referee_discount_percent: 50.00,
            referee_discount_duration_days: 30,
            referred_at: new Date(),
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          });
        }
      } catch (refError) {
        userLogger.error("Error creating referral record:", refError);
      }
    }

    // Admin notification
    emailService.sendNewUserAdminNotification({
      name: emailLower, email: emailLower, login_type: "Email",
      user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));

    // Welcome email
    emailService.sendWelcomeEmail(emailLower, "there").catch(err => {
      userLogger.error("Failed to send welcome email:", err);
    });

    const resData = await getAccessToken(createdUser.dataValues.user_id);

    userLogger.info(`[RegisterEmail] User registered via simplified email flow: ${emailLower}${attrLogSuffix}`);

    return successResponseHelper(res, 200, "Account created successfully!", {
      ...resData,
      email_verified: true,
      referral_code: userReferralCode,
    });

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Phone Type Check via Telnyx Number Lookup
 * POST /api/user/phone-type-check
 * Returns whether a phone number is mobile, landline, voip etc.
 */

