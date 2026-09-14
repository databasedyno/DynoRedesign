/**
 * Second-factor enrolment helpers (mandatory-2FA rollout):
 * - POST /2fa/email/start   — email a 6-digit code to the account address (authed)
 * - POST /2fa/email/verify  — confirm the code → email-code baseline enrolled (authed)
 * - GET  /2fa/enforcement   — soft/hard-wall state for the signed-in user (authed)
 * - POST /2fa/resend        — re-send the emailed sign-in code for a live challenge (public)
 */
import express from "express";
import crypto from "crypto";
import { raw as envRaw } from "../utils/config";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import { redis, getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { generateOtpCode } from "../helper/otpGuard";
import { userModel } from "../models";
import { sendPurposeOTPEmail } from "../services/email/otpEmails";
import { send2FAEnabledEmail } from "../services/email/securityEmails";
import { enableEmail2FA } from "../services/twoFactorService";
import { getMfaEnforcement } from "../services/mfaEnforcement";
import { ChallengeError, resendLoginChallengeCode } from "../services/twoFactorChallenge";
import { trustDevice } from "../services/session/trustedDevices";

const CODE_TTL = 10 * 60;
const MAX_ATTEMPTS = 5;
const enrollKey = (uid: number) => `2fa_enroll:${uid}`;
const hashCode = (code: string) =>
  crypto.createHmac("sha256", String(envRaw("API_SECRET") || "dynopay")).update(String(code)).digest("hex");
const maskEmail = (e: string) => e.replace(/(.{2})(.*)(@.*)/, "$1***$3");

const emailStart = async (req: express.Request, res: express.Response) => {
  try {
    const { user_id } = res.locals.user as IUserType;
    const u = await userModel.findOne({ where: { user_id }, attributes: ["email", "name", "language"] });
    const email = u?.dataValues?.email as string | undefined;
    if (!email) return errorResponseHelper(res, 400, "Add an email address to your account first.");

    const allowed = await redis.set(`${enrollKey(user_id)}:rate`, "1", { NX: true, EX: 30 });
    if (allowed !== "OK") return errorResponseHelper(res, 429, "Please wait a moment before requesting another code.");

    const code = generateOtpCode();
    await setRedisItemWithTTL(enrollKey(user_id), { hash: hashCode(code), attempts: 0 }, CODE_TTL);
    await sendPurposeOTPEmail(email, u?.dataValues?.name || "", code, "emailVerify", u?.dataValues?.language);
    userLogger.info(`[2FA] email-baseline enrolment code sent for user ${user_id}`);

    successResponseHelper(res, 200, "We emailed you a 6-digit code.", {
      masked_email: maskEmail(email),
      expires_in: CODE_TTL,
      ...(envRaw("DISABLE_OUTBOUND_EMAIL") === "true" ? { preview_otp: code } : {}),
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

const emailVerify = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) return errorResponseHelper(res, 400, "Enter the 6-digit code from your email.");

    const key = enrollKey(userData.user_id);
    const stored = (await getRedisItem(key)) as { hash?: string; attempts?: number } | null;
    if (!stored?.hash) return errorResponseHelper(res, 400, "Code expired or not found. Please request a new one.");

    const attempts = Number(stored.attempts || 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      await deleteRedisItem(key);
      return errorResponseHelper(res, 429, "Too many attempts. Please request a new code.");
    }
    const a = Buffer.from(stored.hash);
    const b = Buffer.from(hashCode(code));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await setRedisItemWithTTL(key, { ...stored, attempts }, CODE_TTL);
      return errorResponseHelper(res, 400, "That code didn't match. Please try again.");
    }
    await deleteRedisItem(key);

    const backupCodes = await enableEmail2FA(userData.user_id);
    await trustDevice(userData.user_id, req, res).catch((e) => userLogger.warn("[2FA] trustDevice after email enrolment failed", e));
    if (userData.email) void send2FAEnabledEmail(userData.email, userData.name || "", (userData as { language?: string }).language);

    successResponseHelper(res, 200, "Email codes are now your second step at sign-in.", {
      enabled: true,
      method: "email",
      backup_codes: backupCodes,
      important: "Save your backup codes securely. They will not be shown again.",
    });
  } catch (e) {
    if ((e as Error).message.includes("already enabled")) return errorResponseHelper(res, 409, (e as Error).message);
    handleControllerError(res, e, userLogger);
  }
};

const enforcement = async (req: express.Request, res: express.Response) => {
  try {
    const { user_id } = res.locals.user as IUserType;
    successResponseHelper(res, 200, "OK", await getMfaEnforcement(user_id));
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

const resendChallenge = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.body?.challenge_token || "");
    if (!token) return errorResponseHelper(res, 400, "challenge_token is required");
    const out = await resendLoginChallengeCode(token);
    successResponseHelper(res, 200, "We sent you a new code.", out);
  } catch (e) {
    if (e instanceof ChallengeError) return errorResponseHelper(res, e.status, e.message);
    handleControllerError(res, e, userLogger);
  }
};

export default { emailStart, emailVerify, enforcement, resendChallenge };
