/**
 * Two-Factor Authentication Service
 * 
 * Implements TOTP-based 2FA with backup codes.
 * Uses otplib v13 functional API for TOTP generation/verification.
 */
import { raw as envRaw } from "../utils/config";
import { generateSecret, generateURI, verifySync } from "otplib";
import crypto from "crypto";
import User2FA from "../models/securityModels/user2FAModel";
import { userLogger } from "../utils/loggers";
import QRCode from "qrcode";

const APP_NAME = envRaw("APP_NAME") || "Dynopay";
const BACKUP_CODE_COUNT = parseInt(envRaw("BACKUP_CODE_COUNT") || "10", 10);
const MAX_2FA_FAILED_ATTEMPTS = parseInt(envRaw("MAX_2FA_FAILED_ATTEMPTS") || "5", 10);
const LOCKOUT_DURATION_MINUTES = parseInt(envRaw("LOCKOUT_DURATION_MINUTES") || "15", 10);

/** Login step-up challenge (Redis) — minted after the first factor, consumed by /2fa/validate. */
export const TWO_FA_CHALLENGE_TTL = 300;
export const twoFAChallengeKey = (token: string) => `2fa_challenge:${token}`;

/**
 * Generate backup codes
 */
const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
};

/**
 * Hash backup codes for storage
 */
const hashBackupCodes = (codes: string[]): string[] => {
  return codes.map((code) =>
    crypto.createHash("sha256").update(code.replace("-", "")).digest("hex")
  );
};

/**
 * Verify a TOTP token against a secret with window tolerance
 */
const verifyTOTP = (token: string, secret: string | null | undefined): boolean => {
  if (!secret) return false;
  try {
    const result = verifySync({ token, secret, strategy: "totp", epochTolerance: 30 });
    return result?.valid === true;
  } catch {
    return false;
  }
};

/**
 * Setup 2FA for a user — generates secret and QR code
 * Does NOT enable 2FA yet — user must verify first
 */
export const setup2FA = async (
  userId: number,
  email: string
): Promise<{ secret: string; qr_code: string; backup_codes: string[] }> => {
  const existing = await User2FA.findOne({ where: { user_id: userId } });
  // An enrolled AUTHENTICATOR must be switched off first; an email-code
  // baseline may be upgraded in place (the pending secret is unused until verified).
  if (existing && existing.is_enabled && existing.method === "totp") {
    throw new Error("2FA is already enabled. Disable it first to reconfigure.");
  }

  const secret = generateSecret();
  const otpauth = generateURI({
    secret,
    issuer: APP_NAME,
    label: email,
    strategy: "totp",
  });

  const qr_code = await QRCode.toDataURL(otpauth);

  const plainBackupCodes = generateBackupCodes();
  const hashedBackupCodes = hashBackupCodes(plainBackupCodes);

  if (existing) {
    const keepEmailBaseline = existing.is_enabled && existing.method === "email";
    await existing.update({
      secret,
      backup_codes: hashedBackupCodes,
      is_enabled: keepEmailBaseline,
      method: keepEmailBaseline ? "email" : "totp",
      failed_attempts: 0,
      locked_until: null,
    });
  } else {
    await User2FA.create({
      user_id: userId,
      secret,
      backup_codes: hashedBackupCodes,
      is_enabled: false,
      method: "totp",
      failed_attempts: 0,
    });
  }

  userLogger.info(`[2FA] Setup initiated for user ${userId}`);

  return {
    secret,
    qr_code,
    backup_codes: plainBackupCodes,
  };
};

/**
 * Verify and enable 2FA — user must provide a valid TOTP code
 */
export const verify2FASetup = async (userId: number, token: string): Promise<boolean> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record) throw new Error("2FA setup not found. Please initiate setup first.");
  if (record.is_enabled && record.method === "totp") throw new Error("2FA is already enabled.");

  const isValid = verifyTOTP(token, record.secret);

  if (!isValid) {
    throw new Error("Invalid verification code. Please try again with a fresh code from your authenticator app.");
  }

  await record.update({
    is_enabled: true,
    method: "totp",
    enabled_at: new Date(),
    failed_attempts: 0,
  });

  userLogger.info(`[2FA] Enabled for user ${userId}`);
  return true;
};

/**
 * Validate a 2FA token during login
 */
export const validate2FAToken = async (
  userId: number,
  token: string
): Promise<{ valid: boolean; method: string }> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled) {
    return { valid: true, method: "none" };
  }

  if (record.locked_until && new Date() < new Date(record.locked_until)) {
    const remaining = Math.ceil((new Date(record.locked_until).getTime() - Date.now()) / 60000);
    throw new Error(`2FA verification locked. Try again in ${remaining} minutes.`);
  }

  // Try TOTP first (only meaningful for authenticator enrolments)
  const isTOTPValid = record.method === "totp" && verifyTOTP(token, record.secret);

  if (isTOTPValid) {
    await record.update({
      last_used_at: new Date(),
      failed_attempts: 0,
      locked_until: null,
    });
    return { valid: true, method: "totp" };
  }

  // Try backup code
  const normalizedToken = token.replace("-", "");
  const hashedToken = crypto.createHash("sha256").update(normalizedToken).digest("hex");

  if (record.backup_codes && record.backup_codes.includes(hashedToken)) {
    const updatedCodes = record.backup_codes.filter((c) => c !== hashedToken);
    await record.update({
      backup_codes: updatedCodes,
      last_used_at: new Date(),
      failed_attempts: 0,
      locked_until: null,
    });
    userLogger.info(`[2FA] Backup code used by user ${userId}. Remaining: ${updatedCodes.length}`);
    return { valid: true, method: "backup_code" };
  }

  // Failed attempt
  const newAttempts = (record.failed_attempts || 0) + 1;
  const updates: Record<string, unknown> = { failed_attempts: newAttempts };

  if (newAttempts >= MAX_2FA_FAILED_ATTEMPTS) {
    const lockUntil = new Date();
    lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
    updates.locked_until = lockUntil;
    userLogger.warn(`[2FA] User ${userId} locked after ${newAttempts} failed 2FA attempts`);
  }

  await record.update(updates);
  return { valid: false, method: "failed" };
};

/**
 * Turn the authenticator off. A second factor is mandatory, so the account
 * falls back to the EMAIL-CODE baseline instead of having no factor at all.
 */
export const disable2FA = async (userId: number): Promise<boolean> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled || record.method !== "totp") {
    throw new Error("2FA is not currently enabled.");
  }
  await record.update({ method: "email", secret: null, failed_attempts: 0, locked_until: null });
  userLogger.info(`[2FA] Authenticator disabled for user ${userId} — email codes remain the baseline`);
  return true;
};

/** Enrol the EMAIL-CODE baseline (caller has already verified a code sent to the account email). */
export const enableEmail2FA = async (userId: number): Promise<string[]> => {
  const plain = generateBackupCodes();
  const hashed = hashBackupCodes(plain);
  const existing = await User2FA.findOne({ where: { user_id: userId } });
  if (existing?.is_enabled && existing.method === "totp") {
    throw new Error("An authenticator app is already enabled.");
  }
  const fields = { method: "email" as const, secret: null, is_enabled: true, enabled_at: new Date(), backup_codes: hashed, failed_attempts: 0, locked_until: null };
  if (existing) await existing.update(fields);
  else await User2FA.create({ user_id: userId, ...fields });
  userLogger.info(`[2FA] Email-code baseline enabled for user ${userId}`);
  return plain;
};

/** Lost-authenticator recovery: drop TOTP, keep the mandatory email baseline, burn old backup codes. */
export const resetToEmailFactor = async (userId: number): Promise<void> => {
  const existing = await User2FA.findOne({ where: { user_id: userId } });
  const fields = { method: "email" as const, secret: null, is_enabled: true, enabled_at: new Date(), backup_codes: hashBackupCodes(generateBackupCodes()), failed_attempts: 0, locked_until: null };
  if (existing) await existing.update(fields);
  else await User2FA.create({ user_id: userId, ...fields });
  userLogger.warn(`[2FA] Reset to email baseline for user ${userId}`);
};

/** The second factor that a sign-in must satisfy, or null when the account is not enrolled yet. */
export const getLoginFactor = async (userId: number): Promise<"totp" | "email" | null> => {
  const record = await User2FA.findOne({ where: { user_id: userId, is_enabled: true }, attributes: ["method"] });
  if (!record) return null;
  return record.method === "totp" ? "totp" : "email";
};

/**
 * Regenerate backup codes
 */
export const regenerateBackupCodes = async (userId: number): Promise<string[]> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled) {
    throw new Error("2FA must be enabled to regenerate backup codes.");
  }

  const plainCodes = generateBackupCodes();
  const hashedCodes = hashBackupCodes(plainCodes);

  await record.update({ backup_codes: hashedCodes });

  userLogger.info(`[2FA] Backup codes regenerated for user ${userId}`);
  return plainCodes;
};

/**
 * Get 2FA status for a user
 */
export const get2FAStatus = async (userId: number): Promise<{
  enabled: boolean;
  method: string;
  backup_codes_remaining: number;
  enabled_at: Date | null;
  last_used_at: Date | null;
}> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });

  if (!record) {
    return { enabled: false, method: "none", backup_codes_remaining: 0, enabled_at: null, last_used_at: null };
  }

  return {
    enabled: record.is_enabled,
    method: record.method,
    backup_codes_remaining: record.backup_codes?.length || 0,
    enabled_at: record.enabled_at || null,
    last_used_at: record.last_used_at || null,
  };
};

/**
 * Check if 2FA is required for login (is it enabled for this user?)
 */
export const is2FARequired = async (userId: number): Promise<boolean> => {
  const record = await User2FA.findOne({
    where: { user_id: userId, is_enabled: true },
    attributes: ["is_enabled"],
  });
  return !!record;
};

export default {
  setup2FA,
  verify2FASetup,
  validate2FAToken,
  disable2FA,
  enableEmail2FA,
  resetToEmailFactor,
  getLoginFactor,
  regenerateBackupCodes,
  get2FAStatus,
  is2FARequired,
};
