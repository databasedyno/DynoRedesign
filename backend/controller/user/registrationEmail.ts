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
import { captureSignupContext, getClientIp } from "../../utils/clientContext";
import { deriveNameParts } from "../../utils/nameUtils";
import axios from "axios";
import { userLogger } from "../../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../../services/accountLockoutService";
import { createSession } from "../../services/sessionService";
import { finalizeUploadedImage } from "../../services/objectStorage";
import { is2FARequired } from "../../services/twoFactorService";
import { normalizeLang } from "../../utils/emailI18n";
import { redeemUserReferralCode } from "../../services/referralService";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";
import { generateOtpCode, recordOtpFailure, otpLockedMessage } from "../../helper/otpGuard";
import { clientIp } from "../../middleware/rateLimitMiddleware";

export const registerUser = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, password, referral_code } = req.body;
    
    // Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return errorResponseHelper(res, 400, passwordError);
    }

    // Keep the split columns in sync with `name` on this (password) path too.
    const { first_name: regFirst, last_name: regLast } = deriveNameParts({
      first: req.body?.first_name,
      last: req.body?.last_name,
      full: name,
    });
    
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
      return errorResponseHelper(res, 409, "Account Already Exists!");
    } else {
      const photoLocation = await downloadUserImage();
      const photo = envRaw("SERVER_URL") + photoLocation;

      // Unique referral code for new user (shared helper — consistent across all signup paths)
      const userReferralCode = generateReferralCode();

      const createdUser = await userModel.create({
        name,
        first_name: regFirst,
        last_name: regLast,
        email: email.toLowerCase(),
        photo,
        password: newPassword,
        referral_code: userReferralCode,
        referred_by_code: referral_code || null,
        language: normalizeLang(req.body?.language),
      });

      // Create default wallets (shared helper — identical across all signup paths)
      await createUserWallets(createdUser.dataValues.user_id);

      // Capture the real signup IP + country (non-blocking) for future investigations
      captureSignupContext(createdUser.dataValues.user_id, req);

      // Referral: unified service — creates the referral record AND grants the
      // invitee their 50%/30d welcome discount (single source of truth for the
      // whole referral program; also fixes the previously-broken inline require
      // path that silently no-op'd, so referrals were never recorded here).
      if (referral_code) {
        try {
          const r = await redeemUserReferralCode({
            referralCode: referral_code,
            newUserId: createdUser.dataValues.user_id,
          });
          if (!r.success) userLogger.info(`[RegisterEmail] referral not applied: ${r.message}`);
        } catch (refError) {
          userLogger.error("Error applying referral:", refError);
        }
      }

      emailService.sendNewUserAdminNotification({
        name, email: email.toLowerCase(), login_type: "Email",
        user_id: createdUser.dataValues.user_id,
        signup_ip: getClientIp(req),
      }).catch(err => userLogger.error("Admin notification error:", err));

      const verifyOtp = generateOtpCode().toString();
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

    // Send OTP via email — signup-specific subject/body so the verification
    // code clearly reads as a sign-up code, not a "login" code (QA custom::13).
    const sent = await sendEmailOTP(emailLower, "there", {
      subject: "Verify your email to finish signing up · Dynopay",
      intro: "Welcome to Dynopay! Here is your sign-up verification code: ",
    });
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

    // Capture the person's name up-front (now collected on the OTP screen, product
    // decision 2026-09-07). Stored as a single "First Last" string. Accept either
    // structured {first_name,last_name} or a combined {name}. This is REQUIRED for
    // new-account creation below; passwordless LOGIN of an existing account returns
    // before the requirement, so returning users are unaffected.
    const rawFirst = typeof req.body?.first_name === "string" ? req.body.first_name.trim() : "";
    const rawLast = typeof req.body?.last_name === "string" ? req.body.last_name.trim() : "";
    const fullName = (rawFirst || rawLast)
      ? `${rawFirst} ${rawLast}`.replace(/\s+/g, " ").trim()
      : (typeof req.body?.name === "string" ? req.body.name.replace(/\s+/g, " ").trim() : "");
    // Split into discrete first/last for the dedicated columns (kept in sync
    // with `name`). Structured first/last inputs win; else the combined name
    // is split on the first space.
    const { first_name: firstNameStored, last_name: lastNameStored } = deriveNameParts({
      first: rawFirst,
      last: rawLast,
      full: fullName,
    });
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
      const locked = await recordOtpFailure(otpKey, item, undefined, { email, ip: clientIp(req), channel: "email_verification" });
      return errorResponseHelper(res, 400, locked ? otpLockedMessage : "Invalid verification code.");
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

    // Guarantee a name is recorded for EVERY new account (product decision
    // 2026-09-07). The email onboarding collects First + Last on the OTP screen,
    // so a missing/blank name here means a malformed client request — reject it
    // rather than silently create a nameless merchant.
    if (!fullName || fullName.length < 2) {
      return errorResponseHelper(res, 400, "Please enter your first and last name.");
    }

    // Create user — name captured on the OTP screen; no password (OTP-based)
    const photoLocation = await downloadUserImage();
    const photo = envRaw("SERVER_URL") + photoLocation;
    const userReferralCode = generateReferralCode();

    const createdUser = await userModel.create({
      name: fullName,
      first_name: firstNameStored,
      last_name: lastNameStored,
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

    // Capture the real signup IP + country (non-blocking) for future investigations
    captureSignupContext(createdUser.dataValues.user_id, req);

    // Handle referral
    // Referral: unified service — creates the referral record AND grants the
    // invitee their 50%/30d welcome discount (single source of truth; replaces
    // the old inline block whose broken require path silently no-op'd).
    if (referral_code) {
      try {
        const r = await redeemUserReferralCode({
          referralCode: referral_code,
          newUserId: createdUser.dataValues.user_id,
        });
        if (!r.success) userLogger.info(`[RegisterEmail] referral not applied: ${r.message}`);
      } catch (refError) {
        userLogger.error("Error applying referral:", refError);
      }
    }

    // Admin notification
    emailService.sendNewUserAdminNotification({
      name: fullName, email: emailLower, login_type: "Email",
      user_id: createdUser.dataValues.user_id,
      signup_ip: getClientIp(req),
    }).catch(err => userLogger.error("Admin notification error:", err));

    // Welcome email
    emailService.sendWelcomeEmail(emailLower, rawFirst || fullName || "there").catch(err => {
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

