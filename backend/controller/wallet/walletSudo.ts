/**
 * Wallet "Full Package" — 10-minute security session (sudo mode) + bulk mutations.
 *
 * A single email OTP unlocks a Redis-backed 10-minute session (keyed by user_id,
 * consistent with the app's existing server-side OTP model — no client token).
 * While the session is active the merchant can add / edit / delete multiple payout
 * wallets in one batch without a fresh OTP per network.
 *
 * ADDITIVE: the legacy single-action OTP flows (validateWallet/verifyOtp,
 * sendUpdateWalletOTP/updateWalletWithOTP, delete flow) are untouched and keep
 * working. This module only adds new session-gated endpoints.
 */
import { raw as envRaw } from "../../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { IUserType } from "../../utils/types";
import { errorResponseHelper, successResponseHelper } from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import {
  getRedisItem,
  setRedisItemWithTTL,
  deleteRedisItem,
  redis,
} from "../../utils/redisInstance";
import { userModel } from "../../models/userModels";
import { walletLogger } from "../../utils/loggers";
import { sendWalletSudoOTPEmail } from "../../services/emailService";

// Bulk add/edit/delete lives in walletBatch.ts (kept separate for the 500-line budget).
export { batchWalletMutate } from "./walletBatch";

const SUDO_TTL_SECONDS = 10 * 60; // 10-minute elevated session
const OTP_TTL_SECONDS = 5 * 60; // unlock code validity
const OTP_RATE_SECONDS = 30; // min gap between code requests
const MAX_OTP_ATTEMPTS = 5;

const sudoSessionKey = (uid: number | string) => `wallet_sudo_session_${uid}`;
const sudoOtpKey = (uid: number | string) => `wallet_sudo_otp_${uid}`;
const sudoRateKey = (uid: number | string) => `wallet_sudo_otp_rate_${uid}`;

function hashOtp(code: string): string {
  return crypto
    .createHmac("sha256", String(envRaw("API_SECRET") || "dynopay"))
    .update(String(code))
    .digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const maskEmail = (e?: string | null): string =>
  e ? e.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "";

async function readSudoSession(
  uid: number,
): Promise<{ active: boolean; expiresAt: number | null }> {
  const s = await getRedisItem(sudoSessionKey(uid));
  if (!s || Object.keys(s).length === 0) return { active: false, expiresAt: null };
  const exp = Number(s.expires_at || 0);
  if (!exp || Date.now() >= exp) return { active: false, expiresAt: null };
  return { active: true, expiresAt: exp };
}

// ============================================
// GET /wallet/sudo/status — is the session live?
// ============================================
export const getWalletSudoStatus = async (
  req: express.Request,
  res: express.Response,
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { active, expiresAt } = await readSudoSession(userData.user_id);
    return successResponseHelper(res, 200, "OK", {
      active,
      expires_at: expiresAt,
      now: Date.now(),
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger, { user_id: userData?.user_id });
  }
};

// ============================================
// POST /wallet/sudo/request-otp — email a one-time unlock code
// ============================================
export const requestWalletSudoOtp = async (
  req: express.Request,
  res: express.Response,
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const accountUser = await userModel.findOne({
      where: { user_id },
      attributes: ["email", "email_verified", "name", "language"],
    });
    if (!accountUser?.dataValues?.email || !accountUser.dataValues.email_verified) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "Please add and verify an email address before managing wallets.",
      });
    }

    // Rate-limit: one code per 30s (atomic NX).
    const allowed = await redis.set(sudoRateKey(user_id), "1", {
      NX: true,
      EX: OTP_RATE_SECONDS,
    });
    if (allowed !== "OK") {
      return errorResponseHelper(
        res,
        429,
        "Please wait a moment before requesting another code.",
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await setRedisItemWithTTL(
      sudoOtpKey(user_id),
      { hash: hashOtp(code), attempts: 0 },
      OTP_TTL_SECONDS,
    );

    await sendWalletSudoOTPEmail(
      accountUser.dataValues.email,
      accountUser.dataValues.name,
      code,
      accountUser.dataValues.language,
    );

    walletLogger.info(`[walletSudo] unlock OTP sent`, { user_id });
    return successResponseHelper(res, 200, "Verification code sent to your email", {
      email: maskEmail(accountUser.dataValues.email),
      expires_in: OTP_TTL_SECONDS,
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger, {
      user_id: userData?.user_id,
      email: userData?.email,
    });
  }
};

// ============================================
// POST /wallet/sudo/verify-otp — consume code, open 10-min session
// ============================================
export const verifyWalletSudoOtp = async (
  req: express.Request,
  res: express.Response,
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const otp = String(req.body?.otp || "").trim();
    if (!/^\d{6}$/.test(otp)) {
      return errorResponseHelper(res, 400, "Please enter a valid 6-digit code.");
    }

    const stored = await getRedisItem(sudoOtpKey(user_id));
    if (!stored || Object.keys(stored).length === 0) {
      return errorResponseHelper(
        res,
        400,
        "Code expired or not found. Please request a new one.",
      );
    }

    const attempts = Number(stored.attempts || 0) + 1;
    if (attempts > MAX_OTP_ATTEMPTS) {
      await deleteRedisItem(sudoOtpKey(user_id));
      return errorResponseHelper(
        res,
        400,
        "Too many attempts. Please request a new code.",
      );
    }

    if (!timingSafeEqualHex(String(stored.hash), hashOtp(otp))) {
      await setRedisItemWithTTL(
        sudoOtpKey(user_id),
        { hash: stored.hash, attempts },
        OTP_TTL_SECONDS,
      );
      return errorResponseHelper(res, 400, "Invalid code. Please try again.");
    }

    // Single-use: consume the code, then open the elevated session.
    await deleteRedisItem(sudoOtpKey(user_id));
    const expiresAt = Date.now() + SUDO_TTL_SECONDS * 1000;
    await setRedisItemWithTTL(
      sudoSessionKey(user_id),
      { issued_at: Date.now(), expires_at: expiresAt },
      SUDO_TTL_SECONDS,
    );

    walletLogger.info(`[walletSudo] session unlocked`, { user_id });
    return successResponseHelper(
      res,
      200,
      "Wallet management unlocked for 10 minutes.",
      { active: true, expires_at: expiresAt, ttl_seconds: SUDO_TTL_SECONDS },
    );
  } catch (e) {
    handleControllerError(res, e, walletLogger, {
      user_id: userData?.user_id,
      email: userData?.email,
    });
  }
};

// ============================================
// POST /wallet/sudo/revoke — lock immediately
// ============================================
export const revokeWalletSudo = async (
  req: express.Request,
  res: express.Response,
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    await deleteRedisItem(sudoSessionKey(userData.user_id));
    return successResponseHelper(res, 200, "Wallet management locked.", {
      active: false,
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger, { user_id: userData?.user_id });
  }
};

// ============================================
// Middleware: require an active sudo session (fail-closed)
// ============================================
export const requireWalletSudo = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (!userData?.user_id) {
      return errorResponseHelper(res, 401, "Authentication required.");
    }
    const { active } = await readSudoSession(userData.user_id);
    if (!active) {
      return res.status(403).json({
        success: false,
        statusCode: 403,
        code: "SUDO_REQUIRED",
        message: "Please verify with a one-time code to manage wallets.",
      });
    }
    return next();
  } catch (e) {
    // Never bypass sudo on a Redis error — fail closed.
    walletLogger.error(`[walletSudo] session check failed`, e);
    return res.status(403).json({
      success: false,
      statusCode: 403,
      code: "SUDO_REQUIRED",
      message: "Please verify with a one-time code to manage wallets.",
    });
  }
};
