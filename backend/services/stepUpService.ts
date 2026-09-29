/**
 * Unified step-up authentication (sudo mode) for sensitive actions.
 *
 * One verified factor opens a short, SCOPED elevated session in Redis
 * (`stepup:{scope}:{userId}`). Scopes never bleed into each other: unlocking
 * API-key management does not unlock payouts.
 *
 * FACTOR POLICY (2026-06): the step-up factor is the account's enrolled 2FA factor.
 *   - Authenticator enrolled (User2FA.method === "totp") → ONLY totp / backup codes.
 *     Email/SMS codes are never offered or accepted — a mailbox must not be able to
 *     bypass the authenticator.
 *   - Email factor (or no 2FA yet) → 6-digit code emailed to the account owner;
 *     SMS (Telnyx) only when the account has no email address.
 */
import axios from "axios";
import crypto from "crypto";
import { raw as envRaw } from "../utils/config";
import { redis, getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { userModel } from "../models";
import { apiLogger } from "../utils/loggers";
import { generateOtpCode } from "../helper/otpGuard";
import { validate2FAToken, get2FAStatus } from "./twoFactorService";
import { sendTelnyxSMS } from "../controller/user/userShared";
import { sendStepUpCodeEmail } from "./email/securityEmails";

export const STEP_UP_SCOPES = ["apikey", "wallet", "brand_delete", "security", "payout", "team", "settlement", "account_delete"] as const;
export type StepUpScope = (typeof STEP_UP_SCOPES)[number];
export type StepUpMethod = "email" | "sms" | "totp" | "backup";

export const STEP_UP_TTL_SECONDS = 10 * 60;
const CODE_TTL_SECONDS = 5 * 60;
const CODE_RATE_SECONDS = 30;
const MAX_CODE_ATTEMPTS = 5;

export const AUTHENTICATOR_REQUIRED_MESSAGE =
  "Your account is protected by an authenticator app — enter the code from your app (or a backup code) instead.";

export const isStepUpScope = (s: unknown): s is StepUpScope => STEP_UP_SCOPES.includes(String(s) as StepUpScope);

const sessionKey = (scope: StepUpScope, uid: number) => `stepup:${scope}:${uid}`;
const codeKey = (scope: StepUpScope, uid: number) => `stepup:otp:${scope}:${uid}`;
const rateKey = (scope: StepUpScope, uid: number) => `stepup:rate:${scope}:${uid}`;

export class StepUpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const hashCode = (code: string) =>
  crypto.createHmac("sha256", String(envRaw("API_SECRET") || "dynopay")).update(String(code)).digest("hex");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const maskEmail = (e?: string | null) => (e ? e.replace(/(.{2})(.*)(@.*)/, "$1***$3") : "");
export const maskPhone = (p?: string | null) => (p ? `****${String(p).slice(-4)}` : "");

type Contact = { email: string | null; mobile: string | null; name: string; language: string | null };

const loadContact = async (userId: number): Promise<Contact> => {
  const u = await userModel.findOne({ where: { user_id: userId }, attributes: ["email", "mobile", "name", "language"] });
  const d = (u?.dataValues || {}) as Record<string, string | null>;
  return { email: d.email || null, mobile: d.mobile || null, name: d.name || "", language: d.language || null };
};

export const readSession = async (userId: number, scope: StepUpScope) => {
  const s = (await getRedisItem(sessionKey(scope, userId))) as Record<string, unknown> | null;
  const exp = Number(s?.expires_at || 0);
  if (!exp || Date.now() >= exp) return { active: false, expiresAt: null as number | null };
  return { active: true, expiresAt: exp };
};

/**
 * True when the account can complete a step-up at all: an enrolled authenticator,
 * or a verified email / phone that can receive a code. Contact-change routes skip
 * the gate ONLY for factor-less accounts (fresh social sign-ins with no contact yet),
 * where adding the first contact is onboarding rather than a sensitive change.
 */
export const hasStepUpFactor = async (userId: number): Promise<boolean> => {
  const [authenticator, contact] = await Promise.all([usesAuthenticator(userId), loadContact(userId)]);
  return authenticator || !!contact.email || !!contact.mobile;
};

/** True when the account's enrolled 2FA factor is an authenticator app (totp/backup are then the ONLY step-up methods). */
export const usesAuthenticator = async (userId: number): Promise<boolean> => {
  const twofa = await get2FAStatus(userId);
  return !!twofa.enabled && twofa.method === "totp";
};

export const getStepUpStatus = async (userId: number, scope: StepUpScope) => {
  const [{ active, expiresAt }, contact, authenticator] = await Promise.all([
    readSession(userId, scope),
    loadContact(userId),
    usesAuthenticator(userId),
  ]);
  const hasEmail = !!contact.email;
  return {
    scope,
    active,
    expires_at: expiresAt,
    now: Date.now(),
    ttl_seconds: STEP_UP_TTL_SECONDS,
    factor: authenticator ? "authenticator" : "code",
    methods: {
      email: !authenticator && hasEmail,
      sms: !authenticator && !hasEmail && !!contact.mobile,
      totp: authenticator,
      backup: authenticator,
    },
    contact: { email: maskEmail(contact.email), phone: maskPhone(contact.mobile) },
  };
};

export const requestStepUpCode = async (userId: number, scope: StepUpScope) => {
  if (await usesAuthenticator(userId)) throw new StepUpError(403, AUTHENTICATOR_REQUIRED_MESSAGE);
  const contact = await loadContact(userId);
  if (!contact.email && !contact.mobile) {
    throw new StepUpError(400, "Add an email address to your account to receive verification codes.");
  }
  const channel: "email" | "sms" = contact.email ? "email" : "sms";

  const allowed = await redis.set(rateKey(scope, userId), "1", { NX: true, EX: CODE_RATE_SECONDS });
  if (allowed !== "OK") throw new StepUpError(429, "Please wait a moment before requesting another code.");

  if (channel === "sms") {
    const sent = await sendTelnyxSMS(contact.mobile!);
    if (!sent) throw new StepUpError(503, "We couldn't send the text message. Please try again.");
    await setRedisItemWithTTL(codeKey(scope, userId), { channel: "sms", attempts: 0 }, CODE_TTL_SECONDS);
    apiLogger.info(`[stepUp] sms code issued`, { user_id: userId, scope });
    return { channel, contact: maskPhone(contact.mobile), expires_in: CODE_TTL_SECONDS };
  }

  const code = generateOtpCode();
  await setRedisItemWithTTL(codeKey(scope, userId), { channel: "email", hash: hashCode(code), attempts: 0 }, CODE_TTL_SECONDS);
  await sendStepUpCodeEmail(contact.email!, contact.name, code, scope, contact.language);
  apiLogger.info(`[stepUp] email code issued`, { user_id: userId, scope });
  return {
    channel,
    contact: maskEmail(contact.email),
    expires_in: CODE_TTL_SECONDS,
    // Preview pods suppress outbound email → surface the code for QA only.
    ...(envRaw("DISABLE_OUTBOUND_EMAIL") === "true" ? { preview_otp: code } : {}),
  };
};

const verifyTelnyx = async (mobile: string, code: string): Promise<boolean> => {
  try {
    const r = await axios.post(
      `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
      { code, verify_profile_id: envRaw("TELNYX_VERIFY_PROFILE_ID") || envRaw("PROFILE_ID") },
      { headers: { Authorization: "Bearer " + (envRaw("TELNYX_API_KEY") || envRaw("ACCESS_TOKEN")) }, timeout: 10000 }
    );
    return r.data?.data?.response_code === "accepted";
  } catch {
    return false;
  }
};

const verifyEmittedCode = async (userId: number, scope: StepUpScope, method: "email" | "sms", code: string) => {
  const key = codeKey(scope, userId);
  const stored = (await getRedisItem(key)) as Record<string, unknown> | null;
  if (!stored || Object.keys(stored).length === 0 || stored.channel !== method) {
    throw new StepUpError(400, "Code expired or not found. Please request a new one.");
  }
  const attempts = Number(stored.attempts || 0) + 1;
  if (attempts > MAX_CODE_ATTEMPTS) {
    await deleteRedisItem(key);
    throw new StepUpError(400, "Too many attempts. Please request a new code.");
  }
  let ok = false;
  if (method === "email") {
    ok = safeEqual(String(stored.hash), hashCode(code));
  } else {
    const { mobile } = await loadContact(userId);
    ok = !!mobile && (await verifyTelnyx(mobile, code));
  }
  if (!ok) {
    await setRedisItemWithTTL(key, { ...stored, attempts }, CODE_TTL_SECONDS);
    throw new StepUpError(400, "Invalid code. Please try again.");
  }
  await deleteRedisItem(key);
};

export const verifyStepUp = async (userId: number, scope: StepUpScope, method: StepUpMethod, rawCode: string) => {
  const code = String(rawCode || "").trim();
  if (!code) throw new StepUpError(400, "Verification code is required.");
  const authenticator = await usesAuthenticator(userId);

  if (method === "email" || method === "sms") {
    // Policy: a mailbox/phone code can never stand in for an enrolled authenticator.
    if (authenticator) throw new StepUpError(403, AUTHENTICATOR_REQUIRED_MESSAGE);
    await verifyEmittedCode(userId, scope, method, code);
  } else if (method === "totp" || method === "backup") {
    if (!authenticator) throw new StepUpError(400, "No authenticator app is enrolled on this account.");
    // Never let "none" (2FA disabled) authorise — only a real totp/backup match counts.
    const r = await validate2FAToken(userId, code);
    if (!(r.valid && (r.method === "totp" || r.method === "backup_code"))) {
      throw new StepUpError(400, "Invalid verification code.");
    }
  } else {
    throw new StepUpError(400, "Unsupported verification method.");
  }

  const expiresAt = Date.now() + STEP_UP_TTL_SECONDS * 1000;
  await setRedisItemWithTTL(sessionKey(scope, userId), { issued_at: Date.now(), expires_at: expiresAt, method }, STEP_UP_TTL_SECONDS);
  apiLogger.info(`[stepUp] session unlocked via ${method}`, { user_id: userId, scope });
  return { scope, active: true, expires_at: expiresAt, ttl_seconds: STEP_UP_TTL_SECONDS };
};

export const revokeStepUp = async (userId: number, scope: StepUpScope) => {
  await deleteRedisItem(sessionKey(scope, userId));
};

export const stepUpChallengeBody = (scope: StepUpScope) => ({
  success: false,
  statusCode: 403,
  code: "STEPUP_REQUIRED",
  scope,
  message: "Please verify it's you to continue.",
});
