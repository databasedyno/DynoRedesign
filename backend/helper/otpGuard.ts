import { randomInt } from "crypto";
import { deleteRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { notifySuspiciousActivity } from "../services/securityAlertService";

/** Failed attempts allowed per issued code before it is invalidated. */
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_TTL_SECONDS = 600;

/** CSPRNG 6-digit code (Math.random is predictable and unsuitable for OTPs). */
export const generateOtpCode = (): string => String(randomInt(100000, 1000000));

/**
 * Record a failed OTP attempt against a Redis-stored code. Preserves the
 * original expiry window (derived from `createdAt`) and deletes the code once
 * OTP_MAX_ATTEMPTS is reached so a 6-digit code can't be brute-forced.
 * Returns true when the code has been locked out.
 */
export interface OtpAlertContext {
  /** Account owner to warn (not necessarily the address the code went to). */
  email: string;
  ip: string;
  channel: "password_reset" | "login" | "email_change" | "password_change" | "email_verification" | "onboarding";
}

export const recordOtpFailure = async (
  key: string,
  item: Record<string, unknown>,
  ttlSeconds: number = OTP_TTL_SECONDS,
  alert?: OtpAlertContext
): Promise<boolean> => {
  const attempts = Number(item.attempts || 0) + 1;
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await deleteRedisItem(key);
    if (alert) void notifySuspiciousActivity({ ...alert, event: "otp_lockout", attempts });
    return true;
  }
  const created = item.createdAt ? new Date(String(item.createdAt)).getTime() : NaN;
  const elapsed = Number.isFinite(created) ? Math.floor((Date.now() - created) / 1000) : 0;
  const remaining = Math.max(30, ttlSeconds - elapsed);
  await setRedisItemWithTTL(key, { ...item, attempts }, remaining);
  return false;
};

export const otpLockedMessage =
  "Too many incorrect attempts. Please request a new code.";
