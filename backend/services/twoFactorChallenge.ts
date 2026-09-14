/**
 * Sign-in second-factor challenge (Redis, single-use, 5 min).
 * Minted after the first factor (password / email code / SMS / social) for an
 * enrolled account on an UNTRUSTED browser. `totp` challenges are answered with
 * an authenticator or backup code; `email` challenges auto-send a 6-digit code.
 */
import crypto from "crypto";
import { raw as envRaw } from "../utils/config";
import { redis, getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { userModel } from "../models";
import { userLogger } from "../utils/loggers";
import { generateOtpCode } from "../helper/otpGuard";
import { sendPurposeOTPEmail } from "./email/otpEmails";
import { validate2FAToken, TWO_FA_CHALLENGE_TTL, twoFAChallengeKey } from "./twoFactorService";

export type ChallengeMethod = "totp" | "email";
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;

interface ChallengeRecord {
  user_id: number;
  method: ChallengeMethod;
  issued_at: number;
  code_hash?: string;
  attempts?: number;
  email?: string;
}

export class ChallengeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const maskEmail = (e: string) => e.replace(/(.{2})(.*)(@.*)/, "$1***$3");

const hashCode = (code: string) =>
  crypto.createHmac("sha256", String(envRaw("API_SECRET") || "dynopay")).update(String(code)).digest("hex");

const loadContact = async (userId: number) => {
  const u = await userModel.findOne({ where: { user_id: userId }, attributes: ["email", "name", "language"] });
  const d = (u?.dataValues || {}) as { email?: string | null; name?: string | null; language?: string | null };
  return { email: d.email || null, name: d.name || "", language: d.language || null };
};

const emailCode = async (rec: ChallengeRecord) => {
  const contact = await loadContact(rec.user_id);
  if (!contact.email) throw new ChallengeError(400, "This account has no email address for verification codes.");
  const code = generateOtpCode();
  rec.code_hash = hashCode(code);
  rec.attempts = 0;
  rec.email = contact.email;
  await sendPurposeOTPEmail(contact.email, contact.name, code, "login", contact.language);
  return { masked: maskEmail(contact.email), preview: envRaw("DISABLE_OUTBOUND_EMAIL") === "true" ? code : undefined };
};

export const issueLoginChallenge = async (userId: number, method: ChallengeMethod) => {
  const token = crypto.randomBytes(32).toString("hex");
  const rec: ChallengeRecord = { user_id: userId, method, issued_at: Date.now() };
  let masked_email: string | undefined;
  let preview_otp: string | undefined;
  if (method === "email") {
    const sent = await emailCode(rec);
    masked_email = sent.masked;
    preview_otp = sent.preview;
  }
  await setRedisItemWithTTL(twoFAChallengeKey(token), rec, TWO_FA_CHALLENGE_TTL);
  userLogger.info(`[2FA] ${method} challenge issued for user ${userId}`);
  return {
    requires_2fa: true,
    method,
    challenge_token: token,
    expires_in: TWO_FA_CHALLENGE_TTL,
    ...(masked_email ? { masked_email } : {}),
    ...(preview_otp ? { preview_otp } : {}),
    message:
      method === "email"
        ? "Enter the 6-digit code we just emailed you to finish signing in."
        : "Enter the 6-digit code from your authenticator app to finish signing in.",
  };
};

const loadChallenge = async (token: string): Promise<{ key: string; rec: ChallengeRecord }> => {
  const key = twoFAChallengeKey(String(token || ""));
  const rec = (await getRedisItem(key)) as ChallengeRecord | null;
  if (!rec || !Number(rec.user_id)) throw new ChallengeError(400, "Your sign-in session expired. Please log in again.");
  return { key, rec: { ...rec, user_id: Number(rec.user_id) } };
};

/** Peek at a challenge without consuming it (used by the 2FA-reset request). */
export const peekLoginChallenge = async (token: string) => (await loadChallenge(token)).rec;

export const resendLoginChallengeCode = async (token: string) => {
  const { key, rec } = await loadChallenge(token);
  if (rec.method !== "email") throw new ChallengeError(400, "This sign-in uses an authenticator app.");
  const allowed = await redis.set(`${key}:resend`, "1", { NX: true, EX: RESEND_SECONDS });
  if (allowed !== "OK") throw new ChallengeError(429, "Please wait a moment before requesting another code.");
  const sent = await emailCode(rec);
  await setRedisItemWithTTL(key, rec, TWO_FA_CHALLENGE_TTL);
  return { masked_email: sent.masked, ...(sent.preview ? { preview_otp: sent.preview } : {}) };
};

/** Consume the challenge. Resolves with the user id + method used, throws on a bad code. */
export const verifyLoginChallenge = async (token: string, rawCode: string): Promise<{ user_id: number; method: string }> => {
  const { key, rec } = await loadChallenge(token);
  const code = String(rawCode || "").trim();
  if (!code) throw new ChallengeError(400, "Verification code is required.");

  if (rec.method === "email") {
    const isCode = /^\d{6}$/.test(code);
    const attempts = Number(rec.attempts || 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      await deleteRedisItem(key);
      throw new ChallengeError(429, "Too many attempts. Please log in again.");
    }
    if (isCode && rec.code_hash) {
      const a = Buffer.from(rec.code_hash);
      const b = Buffer.from(hashCode(code));
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        await deleteRedisItem(key);
        return { user_id: rec.user_id, method: "email" };
      }
    }
    // Backup codes are accepted on the email baseline too.
    const r = await validate2FAToken(rec.user_id, code);
    if (r.valid && r.method === "backup_code") {
      await deleteRedisItem(key);
      return { user_id: rec.user_id, method: "backup_code" };
    }
    await setRedisItemWithTTL(key, { ...rec, attempts }, TWO_FA_CHALLENGE_TTL);
    throw new ChallengeError(401, "Invalid code. Please try again.");
  }

  const r = await validate2FAToken(rec.user_id, code);
  // A challenge only exists for enrolled accounts — never let "none" become a free session.
  if (!r.valid || r.method === "none") throw new ChallengeError(401, "Invalid 2FA code. Please try again.");
  await deleteRedisItem(key);
  return { user_id: rec.user_id, method: r.method };
};
