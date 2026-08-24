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

// Cache TTL for profile data (60 seconds)
export const PROFILE_CACHE_TTL = 60;

// ── SEO Attribution Helper ────────────────────────────────────────────────
// SEO landing pages send { attribution: { src: "seo", page, kind } } on
// register API calls. This helper produces a compact ` [seo:kind/slug]`
// suffix for the userLogger line so admins can grep how many signups each
// SEO page produced.
export function _formatAttribution(attr: unknown): string {
  if (!attr || typeof attr !== "object") return "";
  const a = attr as { src?: unknown; page?: unknown; kind?: unknown };
  if (a.src !== "seo" || !a.page || !a.kind) return "";
  const kind = String(a.kind).replace(/[^a-z]/gi, "").slice(0, 16);
  const page = String(a.page).replace(/[^a-z0-9-]/gi, "").slice(0, 64);
  if (!kind || !page) return "";
  return ` [seo:${kind}/${page}]`;
}

// ── User-Agent Parser ─────────────────────────────────────────────────────
export function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
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


export const createUserWallets = async (userId: number) => {
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
export const generateReferralCode = () => {
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

export const finalizeLogin = async (
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

  // Send login notification email — gated by bot-UA filter + per-fingerprint throttle
  // Rationale: preview/CI containers & automated tests hit /api/user/login with real
  // creds thousands of times, spamming the merchant's inbox. We now:
  //   1. Skip the email entirely for automation user-agents (curl, python-requests,
  //      HeadlessChrome, node/, wget, PostmanRuntime, axios/, etc.).
  //   2. Dedup by fingerprint = user_id + ipAddress + browser + os for 15 min in Redis.
  //   3. Respect optional per-user preference `notify_new_device_only` — when true,
  //      only send when the (ip, device, browser, os) tuple has never been seen for
  //      this user (i.e. genuinely new device).
  try {
    if (userData.dataValues.email) {
      const uaLower = (userAgent || '').toLowerCase();
      const BOT_UA_PATTERNS = [
        'curl/', 'python-requests', 'python-urllib', 'headlesschrome', 'phantomjs',
        'node-fetch', 'node/', 'wget/', 'go-http-client', 'axios/', 'postmanruntime',
        'insomnia/', 'okhttp/', 'apache-httpclient', 'java/', 'libwww-perl',
        'lighthouse', 'monitor', 'uptime', 'bot', 'spider', 'crawler'
      ];
      const isBotUA = BOT_UA_PATTERNS.some(p => uaLower.includes(p));
      // Localhost / internal IPs are always synthetic — never email for them.
      const isInternalIp = ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress === '::ffff:127.0.0.1' || ipAddress.startsWith('10.') || ipAddress.startsWith('192.168.') || ipAddress === 'Unknown';

      if (isBotUA || isInternalIp) {
        userLogger.info(`${logPrefix} Skipping login-notification email — ua="${userAgent.substring(0,80)}" ip=${ipAddress} (bot=${isBotUA} internal=${isInternalIp})`);
      } else {
        // Fingerprint per (user, ip, browser, os) — case-insensitive.
        const fp = `${userData.dataValues.user_id}|${ipAddress}|${(browser||'').toLowerCase()}|${(os||'').toLowerCase()}`;
        const fpHash = crypto.createHash('sha256').update(fp).digest('hex').substring(0, 24);
        const throttleKey = `login-notif:${userData.dataValues.user_id}:${fpHash}`;
        const throttled = await getRedisItem(throttleKey);

        // Optional preference: only email when the (ip, browser, os) tuple is genuinely new.
        // Default = false (email every distinct fingerprint per 15 min).
        let shouldSend = !throttled;
        try {
          const prefs = await notificationPreferencesModel.findOne({ where: { user_id: userData.dataValues.user_id } });
          const prefsData = (prefs?.dataValues || {}) as { notify_new_device_only?: boolean };
          if (prefsData.notify_new_device_only === true) {
            // Look up the seen-device key (30-day TTL) — only send if unseen.
            const seenKey = `login-notif-seen:${userData.dataValues.user_id}:${fpHash}`;
            const seen = await getRedisItem(seenKey);
            shouldSend = !seen;
            if (shouldSend) {
              await setRedisItemWithTTL(seenKey, { at: new Date().toISOString() }, 30 * 24 * 60 * 60);
            }
          }
        } catch (_prefErr) {
          // Prefs lookup failure is non-fatal — fall through to default throttle.
        }

        if (!shouldSend) {
          userLogger.info(`${logPrefix} Skipping login-notification email — throttled (fp=${fpHash}) or already-known device`);
        } else {
          // Record throttle marker (15 min TTL)
          await setRedisItemWithTTL(throttleKey, { at: new Date().toISOString() }, 15 * 60);

          const { sendLoginNotificationEmail } = await import("../../services/emailService");
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
      }
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


export const getAccessToken = async (id: number) => {
  const users: IUserType[] = await sequelize.query(
    "select * from tbl_user where user_id=" + id,
    {
      type: QueryTypes.SELECT,
    }
  );

  const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");

  const { password, telegram_id, ...userData } = users[0];

  if (tokenSecret) {
    const accessToken = jwt.sign(userData, tokenSecret, {
      expiresIn: "7d", // align auto-login (register / mobile-verify) with 7-day login persistence
    });
    const resData = { userData, accessToken };
    return resData;
  }
};

/**
 * Helper: Send OTP via email and store in Redis.
 * Returns true on success, false on failure.
 */
export const sendEmailOTP = async (email: string, name: string): Promise<boolean> => {
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
export const sendTelnyxSMS = async (mobile: string, maxRetries: number = 1): Promise<boolean> => {
  const telnyxApiKey = envRaw("TELNYX_API_KEY") || envRaw("ACCESS_TOKEN");
  const verifyProfileId = envRaw("TELNYX_VERIFY_PROFILE_ID") || envRaw("PROFILE_ID");

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

