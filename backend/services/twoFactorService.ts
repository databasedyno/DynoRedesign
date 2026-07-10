/**
 * Two-Factor Authentication Service
 * 
 * Implements TOTP-based 2FA with backup codes.
 * Uses otplib v13 functional API for TOTP generation/verification.
 */
import { generateSecret, generateURI, verifySync } from "otplib";
import crypto from "crypto";
import User2FA from "../models/securityModels/user2FAModel";
import { userLogger } from "../utils/loggers";
import QRCode from "qrcode";

const APP_NAME = process.env.APP_NAME || "Dynopay";
const BACKUP_CODE_COUNT = parseInt(process.env.BACKUP_CODE_COUNT || "10", 10);
const MAX_2FA_FAILED_ATTEMPTS = parseInt(process.env.MAX_2FA_FAILED_ATTEMPTS || "5", 10);
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || "15", 10);

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
const verifyTOTP = (token: string, secret: string): boolean => {
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
  if (existing && existing.is_enabled) {
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
    await existing.update({
      secret,
      backup_codes: hashedBackupCodes,
      is_enabled: false,
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
  if (record.is_enabled) throw new Error("2FA is already enabled.");

  const isValid = verifyTOTP(token, record.secret);

  if (!isValid) {
    throw new Error("Invalid verification code. Please try again with a fresh code from your authenticator app.");
  }

  await record.update({
    is_enabled: true,
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

  // Try TOTP first
  const isTOTPValid = verifyTOTP(token, record.secret);

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
 * Disable 2FA for a user
 */
export const disable2FA = async (userId: number): Promise<boolean> => {
  const record = await User2FA.findOne({ where: { user_id: userId } });
  if (!record || !record.is_enabled) {
    throw new Error("2FA is not currently enabled.");
  }

  await record.update({
    is_enabled: false,
    failed_attempts: 0,
    locked_until: null,
  });

  userLogger.info(`[2FA] Disabled for user ${userId}`);
  return true;
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
  regenerateBackupCodes,
  get2FAStatus,
  is2FARequired,
};
