import express from "express";
import {
  downloadUserImage,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../helper/index";
import { handleControllerError } from "../helper/controllerErrorHandler";
import emailService from "../services/emailService";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel, loginActivityModel } from "../models";
import { userWalletAddressModel } from "../models/userModels";
import notificationModel from "../models/notificationModel";
import notificationPreferencesModel from "../models/notificationPreferencesModel";
import kycModel from "../models/kycModel";
import sha256 from "crypto-js/sha256";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../helper/passwordHelper";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
// OTP storage moved to Redis - localStorage import removed
import axios from "axios";
// tatumApi import removed - not used in this controller
import { userLogger } from "../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../services/accountLockoutService";
import { createSession } from "../services/sessionService";
import { is2FARequired } from "../services/twoFactorService";
import { normalizeLang } from "../utils/emailI18n";

// Cache TTL for profile data (60 seconds)
const PROFILE_CACHE_TTL = 60;

// ── SEO Attribution Helper ────────────────────────────────────────────────
// SEO landing pages send { attribution: { src: "seo", page, kind } } on
// register API calls. This helper produces a compact ` [seo:kind/slug]`
// suffix for the userLogger line so admins can grep how many signups each
// SEO page produced.
function _formatAttribution(attr: unknown): string {
  if (!attr || typeof attr !== "object") return "";
  const a = attr as { src?: unknown; page?: unknown; kind?: unknown };
  if (a.src !== "seo" || !a.page || !a.kind) return "";
  const kind = String(a.kind).replace(/[^a-z]/gi, "").slice(0, 16);
  const page = String(a.page).replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  if (!kind || !page) return "";
  return ` [seo:${kind}/${page}]`;
}

// ── User-Agent Parser ─────────────────────────────────────────────────────
function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  let device = 'Unknown Device';
  let browser = 'Unknown';
  let os = 'Unknown';

  // OS detection
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('iPhone')) os = 'iOS';
  else if (ua.includes('iPad')) os = 'iPadOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('CrOS')) os = 'ChromeOS';

  // Device detection
  if (ua.includes('iPhone')) device = 'iPhone';
  else if (ua.includes('iPad')) device = 'iPad';
  else if (ua.includes('Android') && ua.includes('Mobile')) device = 'Android Phone';
  else if (ua.includes('Android')) device = 'Android Tablet';
  else if (ua.includes('Windows') || ua.includes('Mac') || ua.includes('Linux') || ua.includes('CrOS')) device = 'Desktop';
  else if (ua.includes('Mobile')) device = 'Mobile';

  // Browser detection
  if (ua.includes('Edg/') || ua.includes('EdgA/')) browser = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Brave')) browser = 'Brave';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  return { device, browser, os };
}

const registerUser = async (req: express.Request, res: express.Response) => {
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
const createUserWallets = async (userId: number) => {
  const walletData = await adminWalletModel.findAll();
  const fiatData = walletData.filter((x) => x.dataValues.currency_type === "FIAT");
  const cryptoData = walletData.filter((x) => x.dataValues.currency_type === "CRYPTO");
  for (let i = 0; i < fiatData.length; i++) {
    await userWalletModel.create({
      id: crypto.randomUUID(),
      user_id: userId,
      wallet_type: fiatData[i].dataValues.wallet_type,
      currency_type: "FIAT",
    });
  }
  for (let i = 0; i < cryptoData.length; i++) {
    await userWalletModel.create({
      id: crypto.randomUUID(),
      user_id: userId,
      wallet_type: cryptoData[i].dataValues.wallet_type,
      currency_type: "CRYPTO",
    });
  }
};

// ─── Helper to generate referral code ───
const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `DYNO-${code}`;
};

/**
 * Simplified Email Registration - Step 1: Send OTP
 * POST /api/user/registerEmail
 * Only requires email — no password, no name
 */
const registerEmailStep1 = async (req: express.Request, res: express.Response) => {
  try {
    const { email, referral_code, attribution } = req.body;

    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }

    const emailLower = email.toLowerCase().trim();

    // Optional SEO attribution — captured on the client from
    // `?src=seo&page={slug}&kind={country|vertical}` on landing pages.
    // We log it so admins can measure per-page conversion downstream.
    const attrStr = _formatAttribution(attribution);

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

    // Store referral code + attribution in Redis for later use during verification
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

    // Send OTP via email
    const sent = await sendEmailOTP(emailLower, "there");
    if (!sent) {
      return errorResponseHelper(res, 503, "Unable to send verification code. Please try again.");
    }

    userLogger.info(`[RegisterEmail] OTP sent for registration: ${emailLower}${attrStr}`);
    return successResponseHelper(res, 200, "Verification code sent to your email", { account_exists: false });

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Simplified Email Registration - Step 2: Verify OTP & Create Account
 * POST /api/user/registerEmail/verify-otp
 */
const registerEmailVerifyOtp = async (req: express.Request, res: express.Response) => {
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
const phoneTypeCheck = async (req: express.Request, res: express.Response) => {
  try {
    let { mobile } = req.body;

    if (!mobile) {
      return errorResponseHelper(res, 400, "Phone number is required");
    }

    mobile = mobile.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');

    const telnyxApiKey = process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN;

    try {
      const response = await axios.get(
        `https://api.telnyx.com/v2/number_lookup/+${mobile}`,
        {
          headers: {
            Authorization: "Bearer " + telnyxApiKey,
          },
        }
      );

      const data = response.data?.data;
      const phoneType = data?.carrier?.type || "unknown";
      const countryCode = data?.country_code || null;

      return successResponseHelper(res, 200, "Phone type retrieved", {
        phone_type: phoneType,
        is_mobile: phoneType === "mobile",
        country_code: countryCode,
        carrier_name: data?.carrier?.name || null,
      });

    } catch (lookupErr: any) {
      // If lookup fails, allow it through (don't block registration)
      userLogger.warn("[phoneTypeCheck] Telnyx lookup failed, allowing through", {
        error: lookupErr?.response?.data?.errors?.[0]?.detail || lookupErr.message,
      });
      return successResponseHelper(res, 200, "Phone type check unavailable", {
        phone_type: "unknown",
        is_mobile: true, // Default to allowing
        country_code: null,
        carrier_name: null,
      });
    }

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Register User with Phone Number (Step 1: Send OTP)
 * POST /api/user/registerPhone
 * Sends OTP to phone for verification
 */
const registerPhoneStep1 = async (req: express.Request, res: express.Response) => {
  try {
    let { mobile } = req.body;
    const { referral_code, attribution } = req.body;
    
    if (!mobile) {
      return errorResponseHelper(res, 400, "Mobile number is required");
    }
    
    // Strip + prefix if present
    mobile = mobile.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');
    
    // Validate mobile format (digits only, 10-15 chars)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(mobile)) {
      return errorResponseHelper(res, 400, "Invalid mobile number format. Use 10-15 digits with country code (e.g. 13025141000)");
    }

    const attrStr = _formatAttribution(attribution);
    
    // Check if mobile already registered — if so, switch to a passwordless LOGIN
    // via OTP instead of dead-ending. verify step will sign the user in.
    const mobileExists = await userModel.findOne({
      where: { mobile }
    });
    
    if (mobileExists) {
      const smsLoginSent = await sendTelnyxSMS(mobile);
      if (!smsLoginSent) {
        return errorResponseHelper(res, 503, "Failed to send verification code. Please try again.");
      }
      userLogger.info(`[RegisterPhone] Existing account — login OTP sent: ${mobile}${attrStr}`);
      return successResponseHelper(res, 200, "You already have an account — we've sent a code to log you in.", { account_exists: true });
    }

    // Store referral code in Redis for later use
    if (referral_code) {
      await setRedisItemWithTTL(`reg-referral-phone:${mobile}`, { referral_code }, 900);
    }
    // Store SEO attribution for later log at user-creation time
    if (attribution && typeof attribution === "object" && (attribution as any).src === "seo") {
      await setRedisItemWithTTL(
        `reg-attribution-phone:${mobile}`,
        {
          src: String((attribution as any).src),
          page: String((attribution as any).page || ""),
          kind: String((attribution as any).kind || ""),
        },
        900,
      );
    }
    
    // Send OTP via Telnyx
    const smsSent = await sendTelnyxSMS(mobile);
    if (smsSent) {
      userLogger.info(`[RegisterPhone] OTP sent for registration: ${mobile}${attrStr}`);
      return successResponseHelper(res, 200, "Verification code sent to your phone number.", { account_exists: false });
    }
    return errorResponseHelper(res, 503, "Failed to send verification code. Please try again.");
    
  } catch (e) {
      handleControllerError(res, e, userLogger);
  }
};

/**
 * Simplified Phone Registration - Step 2: Verify OTP & Create Account
 * POST /api/user/registerPhone/verify
 * No password needed — just verifies OTP and creates account
 */
const registerPhoneStep2 = async (req: express.Request, res: express.Response) => {
  try {
    const { otp } = req.body;
    let { mobile } = req.body;
    
    if (!mobile || !otp) {
      return errorResponseHelper(res, 400, "Mobile number and verification code are required");
    }
    
    // Strip + prefix
    mobile = mobile.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');
    
    // Verify OTP with Telnyx
    try {
      const verifyResponse = await axios.post(
        `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
        {
          code: otp,
          verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
          },
        }
      );
      
      if (verifyResponse.data?.data?.response_code !== "accepted") {
        return errorResponseHelper(res, 400, "Invalid or expired verification code");
      }
      
    } catch (otpError) {
      userLogger.error("OTP verification failed", otpError);
      return errorResponseHelper(res, 400, "Invalid or expired verification code");
    }
    
    // If the account already exists, this OTP was a passwordless LOGIN —
    // issue tokens and sign the user in (proceed as usual).
    const mobileExists = await userModel.findOne({ where: { mobile } });
    if (mobileExists) {
      const loginData = await getAccessToken(mobileExists.dataValues.user_id);
      const existingAttr = _formatAttribution(req.body?.attribution);
      userLogger.info(`[RegisterPhone] Existing account logged in via OTP: ${mobile}${existingAttr}`);
      return successResponseHelper(res, 200, "Logged in successfully!", {
        ...loginData,
        account_exists: true,
      });
    }

    // Retrieve referral code if stored
    const referralData = await getRedisItem(`reg-referral-phone:${mobile}`);
    const referral_code = referralData?.referral_code || null;
    if (referralData) await deleteRedisItem(`reg-referral-phone:${mobile}`);

    // Retrieve SEO attribution (if the user arrived from an SEO landing page)
    const storedAttrPhone = await getRedisItem(`reg-attribution-phone:${mobile}`);
    if (storedAttrPhone) await deleteRedisItem(`reg-attribution-phone:${mobile}`);
    const requestAttrPhone = _formatAttribution(req.body?.attribution);
    const storedAttrPhoneStr = _formatAttribution(
      storedAttrPhone && Object.keys(storedAttrPhone).length > 0 ? storedAttrPhone : null,
    );
    const attrLogSuffixPhone = requestAttrPhone || storedAttrPhoneStr;
    
    const photoLocation = await downloadUserImage();
    const photo = process.env.SERVER_URL + photoLocation;
    const userReferralCode = generateReferralCode();
    
    // Create user with mobile only — no name, no password
    const createdUser = await userModel.create({
      name: null,
      mobile,
      email: null,
      photo,
      password: null,
      login_type: "SMS",
      referral_code: userReferralCode,
      referred_by_code: referral_code,
      language: normalizeLang(req.body?.language),
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
    
    const resData = await getAccessToken(createdUser.dataValues.user_id);
    
    userLogger.info(`[RegisterPhone] User registered via simplified phone flow: ${mobile}${attrLogSuffixPhone}`);

    emailService.sendNewUserAdminNotification({
      name: mobile, mobile, login_type: "SMS",
      user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));
    
    successResponseHelper(res, 200, "Account created successfully!", {
      ...resData,
      referral_code: userReferralCode,
    });
    
  } catch (e) {
      handleControllerError(res, e, userLogger);
  }
};

// ── Shared login completion ────────────────────────────────────────────────
// Records device/IP activity, sends the login notification email, updates
// last_login_ip, creates the session and sends the final "Login Successful!"
// response. Used by BOTH the direct password login and the OTP login path.
const finalizeLogin = async (
  userData: any,
  req: express.Request,
  res: express.Response,
  logPrefix: string
) => {
  // Check if 2FA is required (TOTP)
  const needs2FA = await is2FARequired(userData.dataValues.user_id);
  if (needs2FA) {
    return successResponseHelper(res, 200, "2FA verification required", {
      requires_2fa: true,
      user_id: userData.dataValues.user_id,
      message: "Please provide your 2FA code to complete login.",
    });
  }

  // Check for new device/IP login
  const rawIp = req.headers['x-forwarded-for'] as string || req.ip || 'Unknown';
  const ipAddress = rawIp.split(',')[0].trim().substring(0, 45);
  const userAgent = (req.headers['user-agent'] || 'Unknown') as string;
  const { device, browser, os } = parseUserAgent(userAgent);

  userLogger.info(`${logPrefix} User ${userData.dataValues.email} - IP: ${ipAddress}, Device: ${device}, Browser: ${browser}`);

  // Geo-locate the IP (best-effort, non-blocking)
  let location: string | null = null;
  try {
    const geoResponse = await axios.get(`http://ip-api.com/json/${ipAddress}?fields=status,city,country`, { timeout: 3000 });
    if (geoResponse.data && geoResponse.data.status === 'success') {
      const { city, country } = geoResponse.data;
      location = city && country ? `${city}, ${country}` : (country || null);
    }
  } catch (geoError: any) {
    userLogger.info(`${logPrefix} IP geolocation failed: ${geoError.message}`);
  }

  // Generate a unique security token for the "Not you?" link
  const securityToken = crypto.randomBytes(32).toString('hex');

  // Record login activity in the database
  try {
    await loginActivityModel.create({
      user_id: userData.dataValues.user_id,
      ip_address: ipAddress,
      user_agent: userAgent,
      device,
      browser,
      os,
      location,
      security_token: securityToken,
    });
  } catch (activityError: any) {
    userLogger.error(`${logPrefix} Failed to record login activity: ${activityError.message}`);
  }

  // Send login notification email (every login)
  try {
    if (userData.dataValues.email) {
      const { sendLoginNotificationEmail } = await import("../services/emailService");
      const now = new Date();
      const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      // Fire and forget — don't block the login response
      sendLoginNotificationEmail(
        userData.dataValues.email,
        userData.dataValues.name || 'User',
        ipAddress,
        device,
        browser,
        os,
        location,
        date,
        time,
        securityToken
      ).catch(err => userLogger.error(`${logPrefix} Login notification email failed:`, err));
    }
  } catch (emailError) {
    userLogger.error(`${logPrefix} Failed to send login notification:`, emailError);
  }

  // Update last login IP
  await userModel.update(
    { last_login_ip: ipAddress },
    { where: { user_id: userData.dataValues.user_id } }
  );

  // Create Session with Refresh Token
  const sessionData = await createSession(userData.dataValues, req as any);

  // Build response
  const { password: _pw, telegram_id: _tid, ...userDataClean } = userData.dataValues;
  const resData = {
    userData: userDataClean,
    accessToken: sessionData.accessToken,
    refreshToken: sessionData.refreshToken,
    expiresIn: sessionData.expiresIn,
    session_id: sessionData.session_id,
    token_type: "Bearer",
  };

  userLogger.info(`${logPrefix} Login completed for ${userData.dataValues.email}`);
  return successResponseHelper(res, 200, "Login Successful!", resData);
};

const login = async (req: express.Request, res: express.Response) => {
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
            const { sendFailedLoginAttemptsEmail } = await import("../services/emailService");
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
const verifyLoginOTP = async (req: express.Request, res: express.Response) => {
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
const resendLoginOTP = async (req: express.Request, res: express.Response) => {
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
    const newOtp = String(Math.floor(100000 + Math.random() * 900000));
    otpData.otp = newOtp;
    otpData.attempts = 0;
    await setRedisItemWithTTL(redisKey, otpData, 300);

    // Send new OTP email
    const { sendLoginOTPEmail } = await import("../services/emailService");
    await sendLoginOTPEmail(otpData.email, otpData.name, newOtp);

    userLogger.info(`[Login OTP Resend] New OTP sent to ${otpData.email}`);
    successResponseHelper(res, 200, "New OTP sent to your email");
  } catch (e) {
    userLogger.error("[resendLoginOTP] Error:", e);
    handleControllerError(res, e, userLogger);
  }
};

const checkEmail = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.query as { email?: string };
    const userData = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    let resData: Record<string, unknown> = { validEmail: false };
    if (userData) {
      resData = {
        validEmail: true,
        email: userData.dataValues.email,
        mobile: userData.dataValues.mobile ? userData.dataValues.mobile : null,
      };
    }
    successResponseHelper(res, 200, "User profile retrieved successfully", resData);
  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

const getAccessToken = async (id: number) => {
  const users: IUserType[] = await sequelize.query(
    "select * from tbl_user where user_id=" + id,
    {
      type: QueryTypes.SELECT,
    }
  );

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { password, telegram_id, ...userData } = users[0];

  if (tokenSecret) {
    const accessToken = jwt.sign(userData, tokenSecret, {
      expiresIn: "30d",
    });
    const resData = { userData, accessToken };
    return resData;
  }
};

/**
 * Helper: Send OTP via email and store in Redis.
 * Returns true on success, false on failure.
 */
const sendEmailOTP = async (email: string, name: string): Promise<boolean> => {
  try {
    const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
    await sendEmail(
      email,
      name,
      "OTP for login",
      "Here is your login code: " + randomNumberOTP
    );
    // Store OTP in Redis with 10-minute TTL
    const otpKey = `otp:${email}`;
    await setRedisItem(otpKey, {
      otp: randomNumberOTP.toString(),
      createdAt: new Date().toISOString(),
    });
    await setRedisTTL(otpKey, 600); // 10 minutes TTL
    return true;
  } catch (err) {
    userLogger.error("[generateOTP] Email OTP send failed", { email, error: (err as Error).message });
    return false;
  }
};

/**
 * Helper: Send OTP via Telnyx SMS with retry.
 * Retries once after 1s delay on 401/5xx errors.
 * Returns true on success, false on failure.
 */
const sendTelnyxSMS = async (mobile: string, maxRetries: number = 1): Promise<boolean> => {
  const telnyxApiKey = process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN;
  const verifyProfileId = process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await axios.post(
        "https://api.telnyx.com/v2/verifications/sms",
        {
          phone_number: "+" + mobile,
          verify_profile_id: verifyProfileId,
          timeout_secs: 600,
        },
        {
          headers: {
            Authorization: "Bearer " + telnyxApiKey,
          },
          timeout: 10000, // 10s timeout
        }
      );
      return true; // Success
    } catch (err: any) {
      const status = err?.response?.status;
      const errMsg = err?.response?.data?.errors?.[0]?.detail || err?.message || "Unknown error";
      userLogger.error(`[generateOTP] Telnyx SMS attempt ${attempt + 1}/${maxRetries + 1} failed`, {
        mobile: mobile.slice(0, 4) + "****", // Mask PII
        status,
        error: errMsg,
      });

      // Only retry on 401 (auth flake) or 5xx (server errors)
      if (attempt < maxRetries && (status === 401 || status === 429 || (status >= 500 && status < 600))) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // 1s, 2s backoff
        continue;
      }
      return false; // Non-retryable or exhausted retries
    }
  }
  return false;
};

const generateOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, mobile } = req.body;
    if (mobile) {
      // Mobile-based OTP with Telnyx SMS + email fallback
      const userData = await userModel.findOne({
        where: { mobile },
        attributes: ['mobile', 'email', 'name'],
      });

      if (!userData) {
        return errorResponseHelper(res, 404, "Please enter a registered mobile number!");
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
        return errorResponseHelper(res, 404, "Please enter a registered email!");
      }
    } else {
      return errorResponseHelper(res, 400, "Please add any number or email!");
    }
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

const confirmOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp, mobile } = req.body;
    if (otp) {
      if (mobile) {
        const {
          data: { data },
        } = await axios.post(
          `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
          {
            code: otp,
            verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
          },
          {
            headers: {
              Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
            },
          }
        );
        if (data.response_code === "accepted") {
          // Look up user by mobile when using phone OTP, fallback to email
          const userData = await userModel.findOne({
            where: mobile ? { mobile } : { email },
          });
          if (!userData) {
            return errorResponseHelper(res, 404, "User not found for this phone number");
          }
          const resData = await getAccessToken(userData.dataValues.user_id);
          successResponseHelper(res, 200, "Login Successful!", resData);
        } else {
          errorResponseHelper(res, 400, "OTP did not match!");
        }
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
            const resData = await getAccessToken(userData.dataValues.user_id);
            successResponseHelper(res, 200, "Login Successful!", resData);
          } else {
            errorResponseHelper(res, 400, "OTP did not match!");
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

const updateUser = async (req: express.Request, res: express.Response) => {
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
      const { sendUserProfileUpdatedEmail } = await import("../services/emailService");
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

const changePassword = async (req: express.Request, res: express.Response) => {
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

const connectSocial = async (req: express.Request, res: express.Response) => {
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
const facebookSignIn = async (req: express.Request, res: express.Response) => {
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
const forgotPassword = async (req: express.Request, res: express.Response) => {
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
    const sent = await sendEmailOTP(email.toLowerCase(), user.dataValues.name || "User");
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
const forgotPasswordPhone = async (req: express.Request, res: express.Response) => {
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

    // Fallback to email if user has one
    const userEmail = user.dataValues?.email;
    const userName = user.dataValues?.name || "User";
    if (userEmail) {
      userLogger.info(`SMS failed, falling back to email for password reset`, { mobile: mobile.slice(0, 4) + "****" });
      const emailSent = await sendEmailOTP(userEmail, userName);
      if (emailSent) {
        return successResponseHelper(res, 200, "SMS unavailable. OTP sent to your registered email instead.", { fallbackEmail: true });
      }
    }

    return errorResponseHelper(res, 503, "Unable to send OTP at this time. Please try again shortly.");

  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Forgot Password Verify OTP (Email) - Verify OTP and return reset session token
 * POST /api/user/forgot-password/verify-otp
 */
const forgotPasswordVerifyOtp = async (req: express.Request, res: express.Response) => {
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
      return errorResponseHelper(res, 400, "Invalid OTP. Please try again.");
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
const forgotPasswordPhoneVerifyOtp = async (req: express.Request, res: express.Response) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return errorResponseHelper(res, 400, "Phone number and OTP are required");
    }

    // Verify via Telnyx API
    const telnyxApiKey = process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN;
    const verifyProfileId = process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID;

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
      return errorResponseHelper(res, 404, "User not found");
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
const resetPassword = async (req: express.Request, res: express.Response) => {
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

    // Check for OTP-based reset session token in Redis
    const resetSessionKey = `pwd-reset-session:${token}`;
    const session = await getRedisItem(resetSessionKey);

    if (session) {
      // OTP-based flow — session contains email or userId
      const userEmail = session.email || email;
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
          await sendEmail(
            userEmail2,
            user.dataValues.name || "User",
            "Password Changed Successfully - Dynopay",
            `Your Dynopay account password was successfully changed on ${date} at ${time}.\n\nIf you did not make this change, please contact support immediately.`
          );
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
      await sendEmail(
        email.toLowerCase(),
        user.dataValues.name || "User",
        "Password Changed Successfully - Dynopay",
        `Your Dynopay account password was successfully changed on ${date} at ${time}.\n\nIf you did not make this change, please contact support immediately.`
      );
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
const googleSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      return errorResponseHelper(res, 400, "Google ID token or access token is required");
    }

    let googleUserInfo: { email?: string; name?: string; picture?: string; sub?: string };

    if (idToken) {
      // Verify ID token with Google
      try {
        const response = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google ID token");
      }
    } else if (accessToken) {
      // Use access token to get user info
      try {
        const response = await axios.get(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google access token");
      }
    }

    if (!googleUserInfo || !googleUserInfo.email) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from Google");
    }

    const { email, name, picture, sub: googleId } = googleUserInfo;

    // Check if user exists by email or google_id
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { google_id: googleId },
        ],
      },
    });

    if (user) {
      // Update google_id if not set
      if (!user.dataValues.google_id && googleId) {
        await userModel.update(
          { 
            google_id: googleId,
            login_type: "GOOGLE",
          },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      // Update last login IP
      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      await userModel.update(
        { last_login_ip: typeof ipAddress === "string" ? ipAddress : String(ipAddress) },
        { where: { user_id: user.dataValues.user_id } }
      );

      // Create session with refresh token (same as OTP login)
      const sessionData = await createSession(user.dataValues, req as any);
      const { password: _pw, telegram_id: _tid, ...userDataClean } = user.dataValues;
      const resData = {
        userData: userDataClean,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        session_id: sessionData.session_id,
        token_type: "Bearer",
      };
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // Create new user
    const photoUrl = picture || process.env.SERVER_URL + (await downloadUserImage());
    
    const createdUser = await userModel.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      photo: photoUrl,
      login_type: "GOOGLE",
      google_id: googleId,
      language: normalizeLang(req.body?.language),
    });

    // Create default wallets for new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter((x) => x.dataValues.currency_type === "FIAT");
    const cryptoData = walletData.filter((x) => x.dataValues.currency_type === "CRYPTO");

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

    const sessionDataNew = await createSession(createdUser.dataValues, req as any);
    const { password: _pw2, telegram_id: _tid2, ...newUserDataClean } = createdUser.dataValues;
    const resData = {
      userData: newUserDataClean,
      accessToken: sessionDataNew.accessToken,
      refreshToken: sessionDataNew.refreshToken,
      expiresIn: sessionDataNew.expiresIn,
      session_id: sessionDataNew.session_id,
      token_type: "Bearer",
    };

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(email.toLowerCase(), name || email.split("@")[0]);
    } catch (emailError) {
      // Log error but don't fail registration
      userLogger.error("Error sending welcome email:", emailError);
    }

    userLogger.info(`New user registered via Google: ${email}`);

    // Notify admin of new user registration (non-blocking)
    emailService.sendNewUserAdminNotification({
      name: name || email.split("@")[0], email: email.toLowerCase(),
      login_type: "Google", user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {


      handleControllerError(res, e, userLogger);
  }
};

/**
 * GitHub Sign-In - OAuth authorization-code exchange
 * POST /api/user/github-signin
 * Body: { code: string, redirectUri?: string }
 * The client secret never leaves the server — the SPA sends only the temporary code.
 */
const githubSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code) {
      return errorResponseHelper(res, 400, "GitHub authorization code is required");
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return errorResponseHelper(res, 503, "GitHub login is not configured");
    }

    // 1. Exchange the authorization code for an access token
    let ghAccessToken: string | undefined;
    try {
      const tokenRes = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          ...(redirectUri ? { redirect_uri: redirectUri } : {}),
        },
        { headers: { Accept: "application/json" }, timeout: 15000 }
      );
      ghAccessToken = tokenRes.data?.access_token;
      if (!ghAccessToken) {
        userLogger.warn(`[GitHub] Token exchange failed: ${JSON.stringify(tokenRes.data?.error || tokenRes.data)}`);
        return errorResponseHelper(res, 401, "Invalid GitHub authorization code");
      }
    } catch (tokenError) {
      return errorResponseHelper(res, 401, "Invalid GitHub authorization code");
    }

    // 2. Fetch the GitHub user profile
    const ghHeaders = {
      Authorization: `Bearer ${ghAccessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "DynoPay-Auth",
    };
    let ghUser: { id?: number; login?: string; name?: string; email?: string; avatar_url?: string };
    try {
      const userRes = await axios.get("https://api.github.com/user", { headers: ghHeaders, timeout: 15000 });
      ghUser = userRes.data;
    } catch (profileError) {
      return errorResponseHelper(res, 401, "Could not retrieve user info from GitHub");
    }
    if (!ghUser || !ghUser.id) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from GitHub");
    }

    // 3. Resolve a verified email (profile email may be private/null)
    let email: string | null = ghUser.email || null;
    if (!email) {
      try {
        const emailsRes = await axios.get("https://api.github.com/user/emails", { headers: ghHeaders, timeout: 15000 });
        const emails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
        const best =
          emails.find((e: { primary?: boolean; verified?: boolean; email?: string }) => e.primary && e.verified) ||
          emails.find((e: { verified?: boolean; email?: string }) => e.verified);
        email = best?.email || null;
      } catch {
        /* fall through — handled below */
      }
    }
    if (!email) {
      return errorResponseHelper(res, 400, "Your GitHub account has no verified email address. Please verify an email on GitHub and try again.");
    }

    // Prefixed to avoid clashing with raw Facebook ids that share the external_id column
    const githubId = `github:${ghUser.id}`;
    const name = ghUser.name || ghUser.login || email.split("@")[0];
    const picture = ghUser.avatar_url;

    // 4. Existing user → login
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { external_id: githubId },
        ],
      },
    });

    if (user) {
      // Link the GitHub identity if not linked yet
      if (!user.dataValues.external_id) {
        await userModel.update(
          { external_id: githubId },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      const ipAddress = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
      await userModel.update(
        { last_login_ip: typeof ipAddress === "string" ? ipAddress : String(ipAddress) },
        { where: { user_id: user.dataValues.user_id } }
      );

      const sessionData = await createSession(user.dataValues, req as any);
      const { password: _pw, telegram_id: _tid, ...userDataClean } = user.dataValues;
      const resData = {
        userData: userDataClean,
        accessToken: sessionData.accessToken,
        refreshToken: sessionData.refreshToken,
        expiresIn: sessionData.expiresIn,
        session_id: sessionData.session_id,
        token_type: "Bearer",
      };
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // 5. New user → register (mirrors googleSignIn)
    const photoUrl = picture || process.env.SERVER_URL + (await downloadUserImage());

    const createdUser = await userModel.create({
      name,
      email: email.toLowerCase(),
      photo: photoUrl,
      login_type: "GITHUB",
      external_id: githubId,
      email_verified: true, // GitHub verified the email for us
      language: normalizeLang(req.body?.language),
    });

    // Create default wallets for new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter((x) => x.dataValues.currency_type === "FIAT");
    const cryptoData = walletData.filter((x) => x.dataValues.currency_type === "CRYPTO");

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

    const sessionDataNew = await createSession(createdUser.dataValues, req as any);
    const { password: _pw2, telegram_id: _tid2, ...newUserDataClean } = createdUser.dataValues;
    const resData = {
      userData: newUserDataClean,
      accessToken: sessionDataNew.accessToken,
      refreshToken: sessionDataNew.refreshToken,
      expiresIn: sessionDataNew.expiresIn,
      session_id: sessionDataNew.session_id,
      token_type: "Bearer",
    };

    // Send welcome email (non-fatal)
    try {
      await emailService.sendWelcomeEmail(email.toLowerCase(), name);
    } catch (emailError) {
      userLogger.error("Error sending welcome email:", emailError);
    }

    userLogger.info(`New user registered via GitHub: ${email}`);

    emailService.sendNewUserAdminNotification({
      name, email: email.toLowerCase(),
      login_type: "GitHub", user_id: createdUser.dataValues.user_id,
    }).catch(err => userLogger.error("Admin notification error:", err));

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {

      handleControllerError(res, e, userLogger);
  }
};

/**
 * Get User Profile
 * GET /api/user/profile
 */
const getProfile = async (req: express.Request, res: express.Response) => {
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
const updateProfile = async (req: express.Request, res: express.Response) => {
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
    if (language !== undefined) {
      const normalized = normalizeLang(language);
      if (normalized !== currentLanguage) {
        updateData.language = normalized;
      }
    }
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
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
      const { sendUserProfileUpdatedEmail } = await import("../services/emailService");
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
 * Change Email Address
 * PUT /api/user/email
 * Requires password confirmation for security
 */
const changeEmail = async (req: express.Request, res: express.Response) => {
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
    
    // Update email
    await userModel.update(
      { email: newEmail.toLowerCase() },
      { where: { user_id: userData.user_id } }
    );
    
    // Send confirmation email to new address
    try {
      await sendEmail(
        newEmail,
        user.dataValues.name || "User",
        "Email Address Changed - Dynopay",
        `Your Dynopay account email has been successfully changed to this address.

If you didn't make this change, please contact support immediately.

Best regards,
Dynopay Team`
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
const changePhone = async (req: express.Request, res: express.Response) => {
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
          from: process.env.TELNYX_PHONE_NUMBER,
          to: "+" + newPhone,
          text: `Your Dynopay phone number has been successfully updated to this number. If you didn't make this change, please contact support immediately.`
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
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
const removeEmail = async (req: express.Request, res: express.Response) => {
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
const removePhone = async (req: express.Request, res: express.Response) => {
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
const deleteAccount = async (req: express.Request, res: express.Response) => {
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
      const { paymentLinkModel } = await import("../models");
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
const unsubscribeFromReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { refereeCodeModel } = await import("../models");
    
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
const unsubscribeFromPaymentReminders = async (req: express.Request, res: express.Response) => {
  try {
    // Token can come from query param (GET) or body (POST)
    const token = req.params.token || req.query.token || req.body.token;
    
    if (!token) {
      return errorResponseHelper(res, 400, "Unsubscribe token is required");
    }
    
    const { paymentLinkModel } = await import("../models");
    
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
const getOnboardingStatus = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const userId = userData.user_id;

    // ── Redis cache (60s TTL) — onboarding changes rarely ──
    const cacheKey = `onboarding:${userId}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Onboarding status retrieved successfully", cached);
    }
    
    // 1. Check wallet setup
    // Known crypto wallet_type values — wallets whose wallet_type matches any of
    // these are crypto wallets regardless of the legacy currency_type column.
    const CRYPTO_WALLET_TYPES = [
      'BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'SOL', 'XRP', 'TRX',
      'USDT-ERC20', 'USDT-TRC20', 'USDC-ERC20', 'USDT-POLYGON',
      'POLYGON', 'RLUSD', 'RLUSD-ERC20',
    ];

    // ── Run ALL independent queries in parallel ──
    const [allWallets, additionalAddresses, kycRecord, volumeResult, apiKeys, companies, userRecord] = await Promise.all([
      userWalletModel.findAll({ where: { user_id: userId } }),
      userWalletAddressModel.findAll({ where: { user_id: userId } }).catch(() => []),
      kycModel.findOne({ where: { user_id: userId } }),
      sequelize.query(
        `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
         FROM tbl_customer_transaction 
         WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId)
         AND status = 'successful'`,
        { replacements: { userId }, type: QueryTypes.SELECT }
      ) as Promise<{ total_volume: string }[]>,
      apiModel.findAll({ where: { user_id: userId } }),
      companyModel.findAll({ where: { user_id: userId } }),
      userModel.findOne({ where: { user_id: userId }, attributes: ['email_verified'] }),
    ]);

    // ── Process results (from parallel queries) ──
    const cryptoWallets = allWallets.filter((w: any) => {
      const wType = (w.get("wallet_type") || '').toUpperCase();
      const cType = (w.get("currency_type") || '').toUpperCase();
      return cType === 'CRYPTO' || CRYPTO_WALLET_TYPES.includes(wType);
    });
    
    const walletsWithAddress = cryptoWallets.filter((w: any) => {
      const address = w.get("wallet_address");
      return address && address.trim() !== '';
    });
    
    const hasCryptoWallet = cryptoWallets.length > 0;
    const hasWalletAddress = walletsWithAddress.length > 0 || (additionalAddresses as any[]).length > 0;
    const totalConfiguredAddresses = walletsWithAddress.length + (additionalAddresses as any[]).length;
    
    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));
    const kycThreshold = 10000;
    const kycGracePeriodDays = 90;
    const requiresKyc = totalVolume >= kycThreshold;
    const kycStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
    const kycApproved = kycStatus === "approved";
    
    const hasProductionKey = apiKeys.some((key: any) => 
      key.get("environment") === "production" && key.get("status") === "active"
    );
    const hasDevelopmentKey = apiKeys.some((key: any) => 
      key.get("environment") === "development" && key.get("status") === "active"
    );
    
    const hasCompany = companies.length > 0;
    
    // 5. Calculate KYC grace period if applicable
    let kycWarning: {
      type: string;
      message: string;
      days_remaining: number;
      threshold_date: string | null;
      grace_period_end: string | null;
      verification_url: string | null;
      api_endpoint: string;
      has_active_session: boolean;
    } | null = null;
    
    const veriffSessionUrl = kycRecord ? kycRecord.get("veriff_session_url") as string | null : null;
    const kycSubmittedStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
    const hasActiveSession = veriffSessionUrl && ["submitted", "pending"].includes(kycSubmittedStatus);
    
    if (requiresKyc && !kycApproved) {
      try {
        const thresholdQuery = `
          SELECT MIN("createdAt") as threshold_date
          FROM (
            SELECT "createdAt", 
                   SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
            FROM tbl_customer_transaction 
            WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) 
            AND status = 'successful'
          ) sub
          WHERE running_total >= :threshold
        `;
        
        const thresholdResult = await sequelize.query<{ threshold_date: string }>(
          thresholdQuery,
          {
            replacements: { userId, threshold: kycThreshold },
            type: QueryTypes.SELECT,
          }
        );
        
        const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : null;
        
        if (thresholdDate) {
          const gracePeriodEnd = new Date(thresholdDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + kycGracePeriodDays);
          const now = new Date();
          const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysRemaining > 0) {
            const urgencyType = daysRemaining <= 14 ? "critical" : daysRemaining <= 30 ? "warning" : "info";
            kycWarning = {
              type: urgencyType,
              message: daysRemaining <= 14 
                ? `URGENT: Only ${daysRemaining} days left to complete KYC verification! Your account will be restricted after ${gracePeriodEnd.toLocaleDateString()}.`
                : daysRemaining <= 30
                ? `Warning: ${daysRemaining} days remaining to complete KYC verification before your account is restricted.`
                : `KYC verification required within ${daysRemaining} days. Complete verification to continue processing payments.`,
              days_remaining: daysRemaining,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              // If merchant has an active Veriff session, use that URL; otherwise provide API endpoint
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          } else {
            kycWarning = {
              type: "critical",
              message: "Your KYC grace period has expired. Complete verification immediately to resume payment processing.",
              days_remaining: 0,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          }
        }
      } catch (e) {
        userLogger.warn("[Onboarding] Could not calculate KYC grace period:", e);
      }
    }
    
    // 6. Determine next steps
    const nextSteps: string[] = [];
    
    // Email verification (from parallel query result)
    const isEmailVerified = userRecord?.dataValues?.email_verified === true;
    
    if (!isEmailVerified) {
      nextSteps.push("Verify your email address to unlock all features");
    }
    
    if (!hasCompany) {
      nextSteps.push("Create a company to start accepting payments");
    }
    
    if (!hasWalletAddress) {
      nextSteps.push("Add a wallet address to receive crypto payments");
    }
    
    if (requiresKyc && !kycApproved) {
      const kycMessage = kycWarning?.days_remaining !== undefined && kycWarning.days_remaining <= 30
        ? `URGENT: Complete KYC verification (${kycWarning.days_remaining} days remaining)`
        : "Complete KYC verification to continue processing payments";
      nextSteps.push(kycMessage);
    }
    
    if (!hasProductionKey && hasCompany) {
      nextSteps.push("Create a production API key for live payments");
    }
    
    // 7. Determine if onboarding is complete (email must be verified)
    const onboardingComplete = isEmailVerified && hasCompany && hasWalletAddress && (!requiresKyc || kycApproved);
    
    // Build response
    const onboardingStatus = {
      email_verification: {
        is_verified: isEmailVerified,
        required_action: !isEmailVerified ? "Verify your email address" : null,
      },
      wallet_setup: {
        has_wallet: hasCryptoWallet,  // Has at least one CRYPTO wallet type
        has_wallet_address: hasWalletAddress,  // Has at least one address to receive payments
        wallet_count: cryptoWallets.length,  // Only CRYPTO wallets (not FIAT)
        address_count: totalConfiguredAddresses,  // Total configured addresses
        // Breakdown for clarity
        wallets_with_address: walletsWithAddress.length,
        additional_addresses: additionalAddresses.length,
        required_action: !hasWalletAddress ? "Add at least one wallet address to receive payments" : null,
      },
      kyc_status: {
        status: kycStatus,
        requires_kyc: requiresKyc,
        is_approved: kycApproved,
        total_volume: totalVolume,
        threshold: kycThreshold,
        grace_period_days: kycGracePeriodDays,
        required_action: requiresKyc && !kycApproved ? "Complete KYC verification" : null,
        // Include warning for in-app banner display
        warning: kycWarning,
      },
      api_key_status: {
        has_production_key: hasProductionKey,
        has_development_key: hasDevelopmentKey,
        total_keys: apiKeys.length,
        required_action: !hasProductionKey && hasCompany ? "Create a production API key for live payments" : null,
      },
      company_setup: {
        has_company: hasCompany,
        company_count: companies.length,
        required_action: !hasCompany ? "Create a company to start accepting payments" : null,
      },
      onboarding_complete: onboardingComplete,
      next_steps: nextSteps,
    };
    
    userLogger.info(`[Onboarding] Status retrieved for user ${userId}: complete=${onboardingComplete}, next_steps=${nextSteps.length}`);
    
    // Cache the result (60s TTL — onboarding state changes infrequently)
    await setRedisItem(cacheKey, onboardingStatus);
    await setRedisTTL(cacheKey, 60);
    
    return successResponseHelper(res, 200, "Onboarding status retrieved successfully", onboardingStatus);
    
  } catch (e) {

    
      handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/verify-email
 * Verify email address using OTP sent during registration.
 * Requires authentication.
 */
const verifyEmail = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData.user_id;
    const { otp } = req.body;

    if (!otp) {
      return errorResponseHelper(res, 400, "OTP is required");
    }

    // Check if already verified
    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    if (user.dataValues.email_verified) {
      return successResponseHelper(res, 200, "Email is already verified", { email_verified: true });
    }

    // Acquire a lock to prevent duplicate verification (race condition guard)
    const verifyLockKey = `email-verify-lock:${userId}`;
    const existingLock = await getRedisItem(verifyLockKey);
    if (existingLock && Object.keys(existingLock).length > 0) {
      return successResponseHelper(res, 200, "Email verification is being processed", { email_verified: true });
    }
    await setRedisItem(verifyLockKey, { processing: true });
    await setRedisTTL(verifyLockKey, 30); // 30 second lock

    // Check OTP from Redis
    const verifyKey = `email-verify:${userId}`;
    const storedData = await getRedisItem(verifyKey);
    if (!storedData || typeof storedData !== 'object' || !('otp' in (storedData as Record<string, unknown>))) {
      await deleteRedisItem(verifyLockKey);
      return errorResponseHelper(res, 400, "Verification code has expired. Please request a new one.");
    }

    const storedOtp = (storedData as Record<string, unknown>).otp;
    if (String(storedOtp) !== String(otp)) {
      await deleteRedisItem(verifyLockKey);
      return errorResponseHelper(res, 400, "Invalid verification code. Please try again.");
    }

    // OTP matches — mark email as verified
    await userModel.update({ email_verified: true }, { where: { user_id: userId } });
    await deleteRedisItem(verifyKey);

    // Invalidate profile cache so subsequent calls reflect the change
    await deleteRedisItem(`profile:${userId}`);

    userLogger.info(`[VerifyEmail] Email verified for user ${userId}`);

    // Send welcome email now that OTP is verified (non-blocking, with dedup guard)
    const welcomeSentKey = `welcome-email-sent:${userId}`;
    const alreadySent = await getRedisItem(welcomeSentKey);
    if (!alreadySent || Object.keys(alreadySent).length === 0) {
      await setRedisItem(welcomeSentKey, { sent: true });
      await setRedisTTL(welcomeSentKey, 3600); // 1 hour dedup window
      const email = user.dataValues.email;
      const name = user.dataValues.name || "User";
      emailService.sendWelcomeEmail(email.toLowerCase(), name).catch(err => {
        userLogger.error("[VerifyEmail] Failed to send welcome email:", err);
      });
    }

    // Release lock
    await deleteRedisItem(verifyLockKey);

    return successResponseHelper(res, 200, "Email verified successfully!", { email_verified: true });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * POST /api/user/resend-verification
 * Resend email verification OTP. Requires authentication.
 * Rate limited: 1 request per 60 seconds.
 */
const resendVerification = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData.user_id;

    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }
    if (user.dataValues.email_verified) {
      return successResponseHelper(res, 200, "Email is already verified", { email_verified: true });
    }

    // Cooldown check — 60 seconds between resend requests
    const cooldownKey = `email-verify-cooldown:${userId}`;
    const cooldown = await getRedisItem(cooldownKey);
    if (cooldown && Object.keys(cooldown).length > 0) {
      return errorResponseHelper(res, 429, "Please wait 60 seconds before requesting a new code.");
    }

    // Generate new OTP
    const email = user.dataValues.email;
    const name = user.dataValues.name || "User";
    const verifyOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 10 min TTL
    const verifyKey = `email-verify:${userId}`;
    await setRedisItem(verifyKey, { otp: verifyOtp, createdAt: new Date().toISOString() });
    await setRedisTTL(verifyKey, 600);

    // Set 60s cooldown
    await setRedisItem(cooldownKey, { sent: true });
    await setRedisTTL(cooldownKey, 60);

    // Send email (non-blocking)
    emailService.sendEmailVerificationOTPEmail(email, name, verifyOtp).catch(err => {
      userLogger.error("[ResendVerification] Failed to send verification email:", err);
    });

    userLogger.info(`[ResendVerification] Verification OTP resent for user ${userId}`);

    return successResponseHelper(res, 200, "Verification code sent to your email.");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Update last selected company for the user (for session persistence across logins)
 * PUT /api/user/last-company
 * Body: { company_id: number }
 */
const updateLastCompany = async (req: express.Request, res: express.Response) => {
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
const checkPhone = async (req: express.Request, res: express.Response) => {
  try {
    const { phone } = req.query as { phone?: string };
    if (!phone) {
      return errorResponseHelper(res, 400, "Phone number is required");
    }
    const cleaned = phone.replace(/^\+/, '').replace(/\s/g, '').replace(/-/g, '');
    const userData = await userModel.findOne({
      where: { mobile: cleaned },
    });

    let resData: Record<string, unknown> = { validPhone: false };
    if (userData) {
      resData = {
        validPhone: true,
        mobile: userData.dataValues.mobile,
        email: userData.dataValues.email ? userData.dataValues.email : null,
        name: userData.dataValues.name,
      };
    }
    successResponseHelper(res, 200, "Phone check completed", resData);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Add Email to Account (Step 1: Send OTP)
 * POST /api/user/addEmail
 * Requires auth. Sends OTP to the new email for verification.
 */
const addEmail = async (req: express.Request, res: express.Response) => {
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
    const sent = await sendEmailOTP(email.toLowerCase(), userData.name || "User");
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
const verifyAddEmail = async (req: express.Request, res: express.Response) => {
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
      return errorResponseHelper(res, 400, "OTP did not match!");
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
const addPhone = async (req: express.Request, res: express.Response) => {
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
const verifyAddPhone = async (req: express.Request, res: express.Response) => {
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
          verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
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
const requestPasswordOtp = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { channel } = req.body || {};
    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const userEmail = user.dataValues.email;
    const userPhone = user.dataValues.mobile;
    const userName = user.dataValues.name || "User";

    if (!userEmail && !userPhone) {
      return errorResponseHelper(res, 400, "No email or phone on account. Please add one first.");
    }

    // Use requested channel if provided and available, otherwise prefer email → phone
    let sentVia = "";
    if (channel === "phone" && userPhone) {
      const sent = await sendTelnyxSMS(userPhone);
      if (!sent) {
        return errorResponseHelper(res, 503, "Failed to send OTP. Please try again.");
      }
      sentVia = "phone";
    } else if (channel === "email" && userEmail) {
      const sent = await sendEmailOTP(userEmail, userName);
      if (!sent) {
        return errorResponseHelper(res, 503, "Failed to send OTP. Please try again.");
      }
      sentVia = "email";
    } else if (userEmail) {
      const sent = await sendEmailOTP(userEmail, userName);
      if (!sent) {
        return errorResponseHelper(res, 503, "Failed to send OTP. Please try again.");
      }
      sentVia = "email";
    } else if (userPhone) {
      const sent = await sendTelnyxSMS(userPhone);
      if (!sent) {
        return errorResponseHelper(res, 503, "Failed to send OTP. Please try again.");
      }
      sentVia = "phone";
    }

    // Store a session marker in Redis so setPasswordWithOtp knows OTP was requested
    const sessionKey = `password_otp_session:${userData.user_id}`;
    await setRedisItemWithTTL(sessionKey, { requested: true, via: sentVia }, 600);

    const maskedContact = sentVia === "email"
      ? userEmail!.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      : `****${userPhone!.slice(-4)}`;

    return successResponseHelper(res, 200, `Verification code sent to your ${sentVia}`, {
      sent_via: sentVia,
      masked_contact: maskedContact,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Set or update password after OTP verification
 * POST /api/user/profile/set-password
 * Verifies OTP and sets the new password
 */
const setPasswordWithOtp = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword) {
      return errorResponseHelper(res, 400, "OTP and new password are required");
    }

    // Validate password strength
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    const user = await userModel.findOne({ where: { user_id: userData.user_id } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    // Check the session marker
    const sessionKey = `password_otp_session:${userData.user_id}`;
    const session = await getRedisItem(sessionKey);
    if (!session || !session.requested) {
      return errorResponseHelper(res, 400, "Please request a verification code first");
    }

    const sentVia = session.via;
    let otpValid = false;

    if (sentVia === "email") {
      const userEmail = user.dataValues.email;
      const otpKey = `otp:${userEmail}`;
      const item = await getRedisItem(otpKey);
      if (!item || !item.otp) {
        return errorResponseHelper(res, 400, "OTP expired or not found. Please request a new one.");
      }
      const createdTime = new Date(item.createdAt);
      const diff = getMinutesBetweenDates(new Date(), createdTime);
      if (diff >= 10) {
        await deleteRedisItem(otpKey);
        return errorResponseHelper(res, 400, "OTP expired. Please request a new one.");
      }
      if (otp !== item.otp) {
        return errorResponseHelper(res, 400, "Invalid OTP");
      }
      await deleteRedisItem(otpKey);
      otpValid = true;
    } else if (sentVia === "phone") {
      const userPhone = user.dataValues.mobile;
      try {
        const verifyResponse = await axios.post(
          `https://api.telnyx.com/v2/verifications/by_phone_number/+${userPhone}/actions/verify`,
          {
            code: otp,
            verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
          },
          {
            headers: {
              Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
            },
          }
        );
        if (verifyResponse.data?.data?.response_code === "accepted") {
          otpValid = true;
        }
      } catch (otpError) {
        userLogger.error("Phone OTP verification failed for password set", otpError);
        return errorResponseHelper(res, 400, "Invalid or expired OTP");
      }
    }

    if (!otpValid) {
      return errorResponseHelper(res, 400, "Invalid or expired OTP");
    }

    // Set the password
    const hashedPassword = hashPassword(newPassword);
    await userModel.update(
      { password: hashedPassword },
      { where: { user_id: userData.user_id } }
    );

    // Clean up session
    await deleteRedisItem(sessionKey);

    // Invalidate profile cache so has_password updates
    await deleteRedisItem(`profile:${userData.user_id}`);

    // Send notification email
    try {
      if (user.dataValues.email) {
        const now = new Date();
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        await emailService.sendPasswordChangedEmail(
          user.dataValues.email,
          user.dataValues.name || 'User',
          date,
          time
        );
      }
    } catch (emailError) {
      userLogger.error("[setPasswordWithOtp] Failed to send notification email:", emailError);
    }

    const hadPassword = !!user.dataValues.password;
    const message = hadPassword ? "Password updated successfully!" : "Password set successfully!";
    userLogger.info(`[setPasswordWithOtp] Password ${hadPassword ? 'updated' : 'set'} for user ${userData.user_id}`);
    return successResponseHelper(res, 200, message);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Get login activity history
 * GET /api/user/login-activity
 */
const getLoginActivity = async (req: express.Request, res: express.Response) => {
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
const flagLogin = async (req: express.Request, res: express.Response) => {
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
        const { sendSecurityAlertEmail } = await import("../services/emailService");
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

// ── Creator vanity page (dynopay.com/{handle}) ──
// Handles reserved so a user can't shadow an app route.
const RESERVED_HANDLES = new Set([
  "auth", "admin", "dashboard", "pay", "payment", "payments", "fees", "blog", "docs",
  "documentation", "help-support", "help", "support", "system-status", "status",
  "privacy-policy", "privacy", "terms-conditions", "terms", "aml-policy", "legal",
  "settings", "profile", "reset-password", "api", "public", "static", "assets",
  "accept-crypto-payments-in", "for", "create-pay-link", "about", "contact", "login",
  "register", "signup", "signin", "logout", "home", "index", "app", "www", "pricing",
  "qa", "sitemap", "robots", "favicon", "og", "images", "checkout", "invoice", "invoices",
  "wallet", "wallets", "company", "companies", "user", "users", "me", "new", "edit",
  "creator", "creators", "explore", "discover",
]);
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

const normalizeHandle = (h: string) => String(h || "").trim().toLowerCase();

const validateHandle = (h: string): string | null => {
  if (!h) return "Handle is required";
  if (h.length < 3 || h.length > 30) return "Handle must be 3–30 characters";
  if (!HANDLE_RE.test(h)) return "Use lowercase letters, numbers, hyphens or underscores (must start with a letter or number)";
  if (RESERVED_HANDLES.has(h)) return "This handle is reserved";
  return null;
};

/** GET /api/user/creator/check-handle?handle=xxx */
const checkHandle = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const handle = normalizeHandle(req.query.handle as string);
    const err = validateHandle(handle);
    if (err) return successResponseHelper(res, 200, "checked", { available: false, reason: err });

    const existing = await userModel.findOne({
      where: sequelize.where(sequelize.fn("LOWER", sequelize.col("handle")), handle),
      attributes: ["user_id"],
    });
    const taken = existing && existing.dataValues.user_id !== userData.user_id;
    return successResponseHelper(res, 200, "checked", {
      available: !taken,
      reason: taken ? "This handle is already taken" : null,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** PUT /api/user/creator/profile  { handle, bio, creator_page_enabled, cover_image, social_links, support_widget_* } */
const updateCreatorProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      handle: rawHandle, bio, creator_page_enabled, cover_image, social_links,
      support_widget_enabled, support_widget_style, support_widget_label,
      support_widget_preset_amounts, support_widget_currency, support_widget_min_amount,
      support_widget_allow_message, support_widget_thanks_message, support_widget_show_supporters,
    } = req.body as {
      handle?: string;
      bio?: string;
      creator_page_enabled?: boolean;
      cover_image?: string | null;
      social_links?: Record<string, string> | null;
      support_widget_enabled?: boolean;
      support_widget_style?: string;
      support_widget_label?: string | null;
      support_widget_preset_amounts?: unknown;
      support_widget_currency?: string;
      support_widget_min_amount?: number | string;
      support_widget_allow_message?: boolean;
      support_widget_thanks_message?: string | null;
      support_widget_show_supporters?: boolean;
    };
    const updates: Record<string, unknown> = {};

    if (rawHandle !== undefined) {
      const handle = normalizeHandle(rawHandle);
      const err = validateHandle(handle);
      if (err) return errorResponseHelper(res, 400, err);
      const existing = await userModel.findOne({
        where: sequelize.where(sequelize.fn("LOWER", sequelize.col("handle")), handle),
        attributes: ["user_id"],
      });
      if (existing && existing.dataValues.user_id !== userData.user_id) {
        return errorResponseHelper(res, 409, "This handle is already taken");
      }
      updates.handle = handle;
    }

    if (bio !== undefined) {
      updates.bio = String(bio || "").slice(0, 500);
    }
    if (creator_page_enabled !== undefined) {
      updates.creator_page_enabled = Boolean(creator_page_enabled);
    }

    // Cover image: URL string (uploaded via /user/creator/upload-cover) or null to clear
    if (cover_image !== undefined) {
      if (cover_image === null || cover_image === "") {
        updates.cover_image = null;
      } else {
        const url = String(cover_image).trim();
        // Basic URL sanity: must be http(s) or a local /api/static path
        if (!/^https?:\/\//.test(url) && !url.startsWith("/api/static/")) {
          return errorResponseHelper(res, 400, "Invalid cover image URL");
        }
        updates.cover_image = url.slice(0, 500);
      }
    }

    // Social links: allowlist platforms + basic URL validation
    if (social_links !== undefined) {
      const ALLOWED = ["twitter", "instagram", "youtube", "tiktok", "website"] as const;
      const cleaned: Record<string, string> = {};
      const src = (social_links && typeof social_links === "object") ? social_links : {};
      for (const key of ALLOWED) {
        const raw = String((src as Record<string, unknown>)[key] || "").trim();
        if (!raw) continue;
        // Accept full URLs or bare handles (@name) — normalize handles to URLs client-side.
        // Here we only enforce max length and that it's not obviously malicious.
        if (raw.length > 200) {
          return errorResponseHelper(res, 400, `${key} link is too long (max 200 chars)`);
        }
        // Reject javascript:/data: URIs
        if (/^\s*(javascript:|data:|vbscript:)/i.test(raw)) {
          return errorResponseHelper(res, 400, `Invalid ${key} link`);
        }
        cleaned[key] = raw;
      }
      updates.social_links = cleaned;
    }

    // ── Support Widget (Tip / Buy-me-a-coffee) — creator-exclusive ──
    if (support_widget_enabled !== undefined) {
      updates.support_widget_enabled = Boolean(support_widget_enabled);
    }
    if (support_widget_style !== undefined) {
      const style = String(support_widget_style || "").trim().toLowerCase();
      if (!["coffee", "tip", "support"].includes(style)) {
        return errorResponseHelper(res, 400, "Invalid widget style. Choose coffee, tip, or support.");
      }
      updates.support_widget_style = style;
    }
    if (support_widget_label !== undefined) {
      updates.support_widget_label = support_widget_label ? String(support_widget_label).trim().slice(0, 80) : null;
    }
    if (support_widget_preset_amounts !== undefined) {
      let arr: unknown = support_widget_preset_amounts;
      if (typeof arr === "string") {
        arr = arr.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(arr)) {
        return errorResponseHelper(res, 400, "Preset amounts must be a list of numbers.");
      }
      const nums = (arr as unknown[])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.round(n * 100) / 100);
      if (nums.length > 5) {
        return errorResponseHelper(res, 400, "You can set at most 5 preset amounts.");
      }
      // De-dupe while preserving order
      updates.support_widget_preset_amounts = [...new Set(nums)];
    }
    if (support_widget_currency !== undefined) {
      const cur = String(support_widget_currency || "").trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(cur)) {
        return errorResponseHelper(res, 400, "Invalid currency code.");
      }
      updates.support_widget_currency = cur;
    }
    if (support_widget_min_amount !== undefined) {
      const min = Number(support_widget_min_amount);
      if (!Number.isFinite(min) || min <= 0 || min > 1000000) {
        return errorResponseHelper(res, 400, "Minimum amount must be a positive number.");
      }
      updates.support_widget_min_amount = Math.round(min * 100) / 100;
    }
    if (support_widget_allow_message !== undefined) {
      updates.support_widget_allow_message = Boolean(support_widget_allow_message);
    }
    if (support_widget_thanks_message !== undefined) {
      updates.support_widget_thanks_message = support_widget_thanks_message
        ? String(support_widget_thanks_message).trim().slice(0, 280)
        : null;
    }
    if (support_widget_show_supporters !== undefined) {
      updates.support_widget_show_supporters = Boolean(support_widget_show_supporters);
    }

    // Can't enable the page without a handle
    if (updates.creator_page_enabled === true) {
      const cur = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["handle"] });
      if (!updates.handle && !cur?.dataValues?.handle) {
        return errorResponseHelper(res, 400, "Choose a handle before publishing your page");
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponseHelper(res, 400, "Nothing to update");
    }

    await userModel.update(updates, { where: { user_id: userData.user_id } });
    await deleteRedisItem(`profile:${userData.user_id}`);

    const fresh = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: [
        "handle", "bio", "creator_page_enabled", "cover_image", "social_links",
        "support_widget_enabled", "support_widget_style", "support_widget_label",
        "support_widget_preset_amounts", "support_widget_currency", "support_widget_min_amount",
        "support_widget_allow_message", "support_widget_thanks_message", "support_widget_show_supporters",
      ],
    });
    return successResponseHelper(res, 200, "Creator page updated", fresh?.dataValues || updates);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** POST /api/user/creator/upload-cover — multipart/form-data with field "image" */
const uploadCoverImage = async (req: express.Request, res: express.Response) => {
  try {
    const file = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!file) {
      return errorResponseHelper(res, 400, "No image uploaded.");
    }
    const serverUrl = (process.env.SERVER_URL || "").trim().replace(/\/$/, "");
    const url = `${serverUrl}/api/static/images/${file.filename}`;
    userLogger.info(`[uploadCoverImage] uploaded: ${file.filename} (${file.mimetype}, ${file.size}b)`);
    return successResponseHelper(res, 200, "Cover image uploaded", {
      url,
      name: file.originalname?.slice(0, 255) || file.filename,
      type: file.mimetype,
      size: file.size,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** GET /api/user/creator/stats — total + this-week visits, supporters count */
const getCreatorStats = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ["handle"],
    });
    const handle = user?.dataValues?.handle ? String(user.dataValues.handle).toLowerCase() : null;

    if (!handle) {
      return successResponseHelper(res, 200, "Stats retrieved", {
        total_visits: 0,
        this_week_visits: 0,
        supporters_count: 0,
        has_handle: false,
      });
    }

    // Total visits (single counter key)
    let totalVisits = 0;
    try {
      const raw = await redis.get(`creator-visits:${handle}`);
      totalVisits = Number(raw || 0);
    } catch { /* redis best-effort */ }

    // This week: sum last 7 daily buckets
    let weekVisits = 0;
    try {
      const now = Date.now();
      const daily = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now - i * 86400000);
          const ymd = d.toISOString().slice(0, 10);
          return redis.get(`creator-visits:${handle}:day:${ymd}`);
        })
      );
      weekVisits = daily.reduce((a: number, b) => a + Number(b || 0), 0);
    } catch { /* best-effort */ }

    // Supporters count: distinct customers on this user's completed donation contributions
    let supportersCount = 0;
    try {
      const rows = await sequelize.query(
        `SELECT COUNT(DISTINCT ut.customer_id) AS c
         FROM tbl_user_transaction ut
         JOIN tbl_payment_link pl ON pl.link_id = ut.link_id
         JOIN tbl_payment_link parent ON parent.link_id = pl.parent_link_id
         WHERE parent.user_id = :uid
           AND parent.link_type = 'donation'
           AND LOWER(ut.status) IN ('successful','completed','confirmed','processing','converted','payout_complete')`,
        { replacements: { uid: userData.user_id }, type: QueryTypes.SELECT }
      ) as Array<{ c: string | number }>;
      supportersCount = Number(rows?.[0]?.c || 0);
    } catch { /* best-effort */ }

    return successResponseHelper(res, 200, "Stats retrieved", {
      total_visits: totalVisits,
      this_week_visits: weekVisits,
      supporters_count: supportersCount,
      has_handle: true,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};



export default {
  registerUser,
  registerEmailStep1,
  registerEmailVerifyOtp,
  phoneTypeCheck,
  registerPhoneStep1,
  registerPhoneStep2,
  login,
  verifyLoginOTP,
  resendLoginOTP,
  checkEmail,
  checkPhone,
  generateOTP,
  confirmOTP,
  connectSocial,
  facebookSignIn,
  updateUser,
  changePassword,
  forgotPassword,
  forgotPasswordPhone,
  forgotPasswordVerifyOtp,
  forgotPasswordPhoneVerifyOtp,
  resetPassword,
  googleSignIn,
  githubSignIn,
  getProfile,
  updateProfile,
  changeEmail,
  changePhone,
  removeEmail,
  removePhone,
  deleteAccount,
  unsubscribeFromReminders,
  unsubscribeFromPaymentReminders,
  getOnboardingStatus,
  verifyEmail,
  resendVerification,
  updateLastCompany,
  addEmail,
  verifyAddEmail,
  addPhone,
  verifyAddPhone,
  requestPasswordOtp,
  setPasswordWithOtp,
  getLoginActivity,
  flagLogin,
  checkHandle,
  updateCreatorProfile,
  uploadCoverImage,
  getCreatorStats,
};
