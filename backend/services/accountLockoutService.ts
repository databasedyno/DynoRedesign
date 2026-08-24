/**
 * Account Lockout Service
 * 
 * Enforces account lockout after N failed login attempts.
 * Uses Redis for tracking with automatic expiry.
 */
import { raw as envRaw } from "../utils/config";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem } from "../utils/redisInstance";
import { userLogger } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";

// Configuration
const MAX_FAILED_ATTEMPTS = parseInt(envRaw("ACCOUNT_LOCKOUT_MAX_ATTEMPTS") || "5", 10);
const LOCKOUT_DURATION_MINUTES = parseInt(envRaw("ACCOUNT_LOCKOUT_DURATION_MINUTES") || "30", 10);
const ATTEMPT_WINDOW_MINUTES = parseInt(envRaw("ACCOUNT_LOCKOUT_WINDOW_MINUTES") || "15", 10);

interface LockoutState {
  attempts: number;
  locked_until: string | null;
  first_attempt_at: string;
  last_attempt_at: string;
  ip_addresses: string[];
}

const getLockoutKey = (email: string): string => `lockout:${email.toLowerCase()}`;

/**
 * Check if an account is currently locked
 */
export const isAccountLocked = async (email: string): Promise<{ locked: boolean; remaining_seconds: number; attempts: number }> => {
  try {
    const key = getLockoutKey(email);
    const state = await getRedisItem(key) as LockoutState | null;

    if (!state || typeof state !== "object" || !state.locked_until) {
      return { locked: false, remaining_seconds: 0, attempts: state?.attempts || 0 };
    }

    const lockUntil = new Date(state.locked_until);
    const now = new Date();

    if (now < lockUntil) {
      const remaining = Math.ceil((lockUntil.getTime() - now.getTime()) / 1000);
      return { locked: true, remaining_seconds: remaining, attempts: state.attempts };
    }

    // Lock expired — clear it
    await deleteRedisItem(key);
    return { locked: false, remaining_seconds: 0, attempts: 0 };
  } catch (err) {
    userLogger.error("[Lockout] Error checking lockout state:", err);
    return { locked: false, remaining_seconds: 0, attempts: 0 };
  }
};

/**
 * Record a failed login attempt. Returns lockout info.
 */
export const recordFailedAttempt = async (
  email: string,
  ipAddress: string
): Promise<{ locked: boolean; attempts: number; max_attempts: number; lockout_minutes: number }> => {
  try {
    const key = getLockoutKey(email);
    const existing = await getRedisItem(key) as LockoutState | null;
    const now = new Date();

    let state: LockoutState;

    if (existing && typeof existing === "object" && existing.first_attempt_at) {
      // Check if window expired
      const windowExpiry = new Date(existing.first_attempt_at);
      windowExpiry.setMinutes(windowExpiry.getMinutes() + ATTEMPT_WINDOW_MINUTES);

      if (now > windowExpiry && !existing.locked_until) {
        // Window expired, reset
        state = {
          attempts: 1,
          locked_until: null,
          first_attempt_at: now.toISOString(),
          last_attempt_at: now.toISOString(),
          ip_addresses: [ipAddress],
        };
      } else {
        state = {
          ...existing,
          attempts: (existing.attempts || 0) + 1,
          last_attempt_at: now.toISOString(),
          ip_addresses: [...new Set([...(existing.ip_addresses || []), ipAddress])].slice(-10),
        };
      }
    } else {
      state = {
        attempts: 1,
        locked_until: null,
        first_attempt_at: now.toISOString(),
        last_attempt_at: now.toISOString(),
        ip_addresses: [ipAddress],
      };
    }

    // Check if we should lock
    if (state.attempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      state.locked_until = lockUntil.toISOString();

      userLogger.warn(`[Lockout] Account ${email} LOCKED for ${LOCKOUT_DURATION_MINUTES} minutes after ${state.attempts} failed attempts from IPs: ${state.ip_addresses.join(", ")}`);
    }

    await setRedisItem(key, state);
    // TTL = lockout duration + buffer, or window duration
    const ttlSeconds = state.locked_until
      ? (LOCKOUT_DURATION_MINUTES + 5) * 60
      : (ATTEMPT_WINDOW_MINUTES + 5) * 60;
    await setRedisTTL(key, ttlSeconds);

    return {
      locked: !!state.locked_until,
      attempts: state.attempts,
      max_attempts: MAX_FAILED_ATTEMPTS,
      lockout_minutes: LOCKOUT_DURATION_MINUTES,
    };
  } catch (err) {
    userLogger.error("[Lockout] Error recording failed attempt:", err);
    captureError(err instanceof Error ? err : new Error(String(err)), "api", { extraContext: "Account lockout recording" });
    return { locked: false, attempts: 0, max_attempts: MAX_FAILED_ATTEMPTS, lockout_minutes: LOCKOUT_DURATION_MINUTES };
  }
};

/**
 * Clear failed attempts (on successful login)
 */
export const clearFailedAttempts = async (email: string): Promise<void> => {
  try {
    await deleteRedisItem(getLockoutKey(email));
  } catch (err) {
    userLogger.error("[Lockout] Error clearing failed attempts:", err);
  }
};

/**
 * Admin: Unlock a locked account
 */
export const adminUnlockAccount = async (email: string): Promise<boolean> => {
  try {
    await deleteRedisItem(getLockoutKey(email));
    userLogger.info(`[Lockout] Admin unlocked account: ${email}`);
    return true;
  } catch (err) {
    userLogger.error("[Lockout] Error unlocking account:", err);
    return false;
  }
};

/**
 * Get lockout configuration (for API responses)
 */
export const getLockoutConfig = () => ({
  max_attempts: MAX_FAILED_ATTEMPTS,
  lockout_duration_minutes: LOCKOUT_DURATION_MINUTES,
  attempt_window_minutes: ATTEMPT_WINDOW_MINUTES,
});

export default {
  isAccountLocked,
  recordFailedAttempt,
  clearFailedAttempts,
  adminUnlockAccount,
  getLockoutConfig,
};
