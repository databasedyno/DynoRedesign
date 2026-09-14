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
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, requires2FAChallenge, getAccessToken, sendEmailOTP, sendTelnyxSMS, sendTelnyxVerification, SMS_UNSUPPORTED_MESSAGE } from "./userShared";
import { normalizeMobile, INVALID_MOBILE_MESSAGE } from "../../utils/phoneNumber";

export const phoneTypeCheck = async (req: express.Request, res: express.Response) => {
  try {
    const { mobile: rawMobile } = req.body;

    if (!rawMobile) {
      return errorResponseHelper(res, 400, "Phone number is required");
    }

    const normalized = normalizeMobile(rawMobile);
    if (!normalized) {
      return errorResponseHelper(res, 400, INVALID_MOBILE_MESSAGE);
    }
    const mobile = normalized.digits;

    const telnyxApiKey = envRaw("TELNYX_API_KEY") || envRaw("ACCESS_TOKEN");

    try {
      // `type=carrier` is what makes Telnyx return carrier.type (mobile/landline/voip);
      // without it the lookup never classifies the line and every check read "unknown".
      const response = await axios.get(
        `https://api.telnyx.com/v2/number_lookup/+${mobile}?type=carrier`,
        {
          headers: {
            Authorization: "Bearer " + telnyxApiKey,
          },
          timeout: 8000,
        }
      );

      const data = response.data?.data;
      if (data?.valid_number === false) {
        return errorResponseHelper(res, 400, INVALID_MOBILE_MESSAGE);
      }
      const phoneType = data?.carrier?.type || "unknown";
      const countryCode = data?.country_code || normalized.country;

      return successResponseHelper(res, 200, "Phone type retrieved", {
        phone_type: phoneType,
        is_mobile: phoneType === "mobile" || phoneType === "unknown",
        country_code: countryCode,
        carrier_name: data?.carrier?.name || null,
        normalized: mobile,
      });

    } catch (lookupErr: any) {
      // If lookup fails, allow it through (don't block registration)
      userLogger.warn("[phoneTypeCheck] Telnyx lookup failed, allowing through", {
        error: lookupErr?.response?.data?.errors?.[0]?.detail || lookupErr.message,
      });
      return successResponseHelper(res, 200, "Phone type check unavailable", {
        phone_type: "unknown",
        is_mobile: true, // Default to allowing
        country_code: normalized.country,
        carrier_name: null,
        normalized: mobile,
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
export const registerPhoneStep1 = async (req: express.Request, res: express.Response) => {
  try {
    const { mobile: rawMobile } = req.body;
    const { referral_code, attribution, purpose_vertical } = req.body;
    
    if (!rawMobile) {
      return errorResponseHelper(res, 400, "Mobile number is required");
    }
    
    // Canonicalise to E.164 digits (handles "+", spaces and a trunk "0" typed after the country code)
    const normalized = normalizeMobile(rawMobile);
    if (!normalized) {
      return errorResponseHelper(res, 400, INVALID_MOBILE_MESSAGE);
    }
    const mobile = normalized.digits;

    const attrStr = _formatAttribution(attribution);

    // Whitelist purpose vertical (design audit 2026-08-05)
    const validVerticals = ["merchants", "fundraisers", "creators", "developers"] as const;
    const purposeVertical =
      typeof purpose_vertical === "string" &&
      (validVerticals as readonly string[]).includes(purpose_vertical)
        ? purpose_vertical
        : null;
    
    // Check if mobile already registered — if so, switch to a passwordless LOGIN
    // via OTP instead of dead-ending. verify step will sign the user in.
    const mobileExists = await userModel.findOne({
      where: { mobile }
    });
    
    if (mobileExists) {
      const smsLogin = await sendTelnyxVerification(mobile);
      if (!smsLogin.ok) {
        return errorResponseHelper(res, smsLogin.reason === "error" ? 503 : 400, smsLogin.reason === "unsupported_destination" ? SMS_UNSUPPORTED_MESSAGE : smsLogin.reason === "invalid_number" ? INVALID_MOBILE_MESSAGE : "Failed to send verification code. Please try again.");
      }
      userLogger.info(`[RegisterPhone] Existing account — login OTP sent: ${mobile}${attrStr}`);
      return successResponseHelper(res, 200, "This number is already registered — we've texted you a code to log in to your existing account instead.", { account_exists: true, mobile });
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
    // Store purpose vertical for use in Step 2
    if (purposeVertical) {
      await setRedisItemWithTTL(`reg-vertical-phone:${mobile}`, { purpose_vertical: purposeVertical }, 900);
    }
    
    // Send OTP via Telnyx
    const sms = await sendTelnyxVerification(mobile);
    if (sms.ok) {
      userLogger.info(`[RegisterPhone] OTP sent for registration: ${mobile}${attrStr}${purposeVertical ? " · vertical=" + purposeVertical : ""}`);
      return successResponseHelper(res, 200, "Verification code sent to your phone number.", { account_exists: false, mobile });
    }
    if (sms.reason === "unsupported_destination") return errorResponseHelper(res, 400, SMS_UNSUPPORTED_MESSAGE);
    if (sms.reason === "invalid_number") return errorResponseHelper(res, 400, INVALID_MOBILE_MESSAGE);
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
export const registerPhoneStep2 = async (req: express.Request, res: express.Response) => {
  try {
    const { otp } = req.body;
    const { mobile: rawMobile } = req.body;
    
    if (!rawMobile || !otp) {
      return errorResponseHelper(res, 400, "Mobile number and verification code are required");
    }
    
    // Same canonical form as step 1 so the Telnyx lookup + Redis keys line up
    const normalized = normalizeMobile(rawMobile);
    if (!normalized) {
      return errorResponseHelper(res, 400, INVALID_MOBILE_MESSAGE);
    }
    const mobile = normalized.digits;
    
    // Verify OTP with Telnyx
    try {
      const verifyResponse = await axios.post(
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
      if (await requires2FAChallenge(res, mobileExists.dataValues.user_id, req)) return;
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

    // Retrieve purpose vertical stored in Redis by Step 1 (design audit 2026-08-05).
    // Also accept it directly in this request body as a fallback.
    const validVerticalsPhone = ["merchants", "fundraisers", "creators", "developers"] as const;
    const storedVerticalPhone = await getRedisItem(`reg-vertical-phone:${mobile}`);
    if (storedVerticalPhone) await deleteRedisItem(`reg-vertical-phone:${mobile}`);
    const requestVerticalPhone = req.body?.purpose_vertical;
    const rawVerticalPhone: unknown =
      (storedVerticalPhone && typeof storedVerticalPhone.purpose_vertical === "string" && storedVerticalPhone.purpose_vertical) ||
      (typeof requestVerticalPhone === "string" ? requestVerticalPhone : null);
    const purposeVerticalPhone =
      typeof rawVerticalPhone === "string" && (validVerticalsPhone as readonly string[]).includes(rawVerticalPhone)
        ? rawVerticalPhone
        : null;
    
    // Capture the person's name (now collected on the OTP screen). Stored as a
    // single "First Last" string; REQUIRED so no account is created name-less.
    const rawFirstPhone = typeof req.body?.first_name === "string" ? req.body.first_name.trim() : "";
    const rawLastPhone = typeof req.body?.last_name === "string" ? req.body.last_name.trim() : "";
    const fullNamePhone = (rawFirstPhone || rawLastPhone)
      ? `${rawFirstPhone} ${rawLastPhone}`.replace(/\s+/g, " ").trim()
      : (typeof req.body?.name === "string" ? req.body.name.replace(/\s+/g, " ").trim() : "");
    if (!fullNamePhone || fullNamePhone.length < 2) {
      return errorResponseHelper(res, 400, "Please enter your first and last name.");
    }
    const { first_name: firstNamePhone, last_name: lastNamePhone } = deriveNameParts({
      first: rawFirstPhone,
      last: rawLastPhone,
      full: fullNamePhone,
    });

    const photoLocation = await downloadUserImage();
    const photo = envRaw("SERVER_URL") + photoLocation;
    const userReferralCode = generateReferralCode();
    
    // Create user with mobile + name; no password
    const createdUser = await userModel.create({
      name: fullNamePhone,
      first_name: firstNamePhone,
      last_name: lastNamePhone,
      mobile,
      email: null,
      photo,
      password: null,
      login_type: "SMS",
      referral_code: userReferralCode,
      referred_by_code: referral_code,
      language: normalizeLang(req.body?.language),
      purpose_vertical: purposeVerticalPhone,
    });
    
    // Create wallets
    await createUserWallets(createdUser.dataValues.user_id);

    // Capture the real signup IP + country (non-blocking) for future investigations
    captureSignupContext(createdUser.dataValues.user_id, req);

    // Referral: unified service — creates the referral record AND grants the
    // invitee their 50%/30d welcome discount (single source of truth; replaces
    // the old inline block whose broken require path silently no-op'd).
    if (referral_code) {
      try {
        const r = await redeemUserReferralCode({
          referralCode: referral_code,
          newUserId: createdUser.dataValues.user_id,
        });
        if (!r.success) userLogger.info(`[RegisterPhone] referral not applied: ${r.message}`);
      } catch (refError) {
        userLogger.error("Error applying referral:", refError);
      }
    }
    
    const resData = await getAccessToken(createdUser.dataValues.user_id);
    
    userLogger.info(`[RegisterPhone] User registered via simplified phone flow: ${mobile}${attrLogSuffixPhone}`);

    emailService.sendNewUserAdminNotification({
      name: fullNamePhone || mobile, mobile, login_type: "SMS",
      user_id: createdUser.dataValues.user_id,
      signup_ip: getClientIp(req),
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

export const checkPhone = async (req: express.Request, res: express.Response) => {
  // ── Account-enumeration protection ─────────────────────────────────────────
  // NEVER reveal whether a phone number is registered, and NEVER leak the
  // account's name/email. Always respond as if the phone is valid so the login
  // UI advances to the OTP step identically for real and unknown numbers. A
  // wrong OTP then fails generically, so an attacker can't probe for accounts.
  try {
    const { phone } = req.query as { phone?: string };
    if (!phone) {
      return errorResponseHelper(res, 400, "Phone number is required");
    }
    return successResponseHelper(res, 200, "Phone check completed", { validPhone: true });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * Add Email to Account (Step 1: Send OTP)
 * POST /api/user/addEmail
 * Requires auth. Sends OTP to the new email for verification.
 */

