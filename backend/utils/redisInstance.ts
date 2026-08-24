import { createClient } from "redis";
import { cronLogger } from "../utils/loggers";
import { log } from "./loggers";
import config from "./config";

const redisClient = createClient({
  url: config.redisUrl || undefined,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: retries => Math.min(retries * 100, 3000),
  },
});

redisClient.on("error", err => {
  // Suppress noisy repeated ECONNRESET logs — only log once per 60s
  const now = Date.now();
  const msg = err.message || '';
  if (msg.includes('ECONNRESET') || msg.includes('Connection timeout') || msg.includes('Socket closed')) {
    if (now - lastRedisErrorLog < 60000) return; // throttle: 1 log per minute
    lastRedisErrorLog = now;
    log(`Redis connection issue (throttled): ${msg}`, "error");
  } else {
    log(`Redis Client Error: ${msg}`, "error");
  }
});

let lastRedisErrorLog = 0;

redisClient.on("reconnecting", () => {
  redisConnected = false;
  log("Redis reconnecting...", "info");
});

redisClient.on("ready", () => {
  redisConnected = true;
  log("Redis connection ready", "info");
});

let redisConnected = false;

export const connectRedis = async () => {
  if (!redisConnected) {
    await redisClient.connect();
    redisConnected = true;
    log("Redis connected", "info");
  }
};

// ============================================
// REDIS CACHE OPERATIONS (Single unified cache)
// ============================================

const setRedisItem = async (key: string, value: unknown) => {
  // Store as JSON string for all objects (simplified storage)
  if (typeof value === 'object' && value !== null) {
    await redisClient.set(key + ':json', JSON.stringify(value));
    // Also delete any old hash data to prevent stale reads
    await redisClient.del(key);
  } else {
    for (const [field, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined && val !== null) {
        await redisClient.hSet(key, field, String(val));
      }
    }
  }
};

// Set Redis item with TTL (time-to-live in seconds)
const setRedisItemWithTTL = async (key: string, value: unknown, ttlSeconds: number) => {
  if (typeof value === 'object' && value !== null) {
    await redisClient.set(key + ':json', JSON.stringify(value), { EX: ttlSeconds });
  } else {
    for (const [field, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined && val !== null) {
        await redisClient.hSet(key, field, String(val));
      }
    }
    await redisClient.expire(key, ttlSeconds);
  }
};

// Set TTL on existing key
const setRedisTTL = async (key: string, ttlSeconds: number) => {
  await redisClient.expire(key, ttlSeconds);
  await redisClient.expire(key + ':json', ttlSeconds);
};

const getRedisItem = async (key: string) => {
  if (!key) return {};
  // Check for JSON stored object FIRST (preferred storage for objects)
  const jsonValue = await redisClient.get(key + ':json');
  if (jsonValue) {
    try {
      return JSON.parse(jsonValue);
    } catch (e) {
      cronLogger.info(`[Redis] JSON parse error for ${key}:json, falling back to hash`);
    }
  }
  
  // Fall back to hash storage (only if JSON doesn't exist)
  const hashValue = await redisClient.hGetAll(key);
  if (hashValue && Object.keys(hashValue).length > 0) {
    return hashValue;
  }
  
  // No data found
  return {};
};

const deleteRedisItem = async (key: string) => {
  await redisClient.del(key);
  await redisClient.del(key + ':json');
};

// Soft delete - set TTL instead of immediate deletion (for checkout polling)
const softDeleteRedisItem = async (key: string, ttlSeconds: number = 1800) => {
  // Default 30 minutes TTL to allow checkout to poll for status
  await redisClient.expire(key, ttlSeconds);
  await redisClient.expire(key + ':json', ttlSeconds);
  cronLogger.info(`[Redis] Soft delete: ${key} will expire in ${ttlSeconds}s`);
};

// ============================================
// BACKWARD COMPATIBILITY (deprecated functions)
// ============================================
// These are kept for backward compatibility but now just use Redis

const setMemoryCache = (key: string, value: unknown, ttlSeconds: number) => {
  // Now just calls setRedisItemWithTTL
  setRedisItemWithTTL(key, value, ttlSeconds);
};

const getMemoryCache = async (key: string): Promise<unknown | null> => {
  // Now just calls getRedisItem
  const result = await getRedisItem(key);
  return Object.keys(result).length > 0 ? result : null;
};

const invalidateCache = async (key: string) => {
  await deleteRedisItem(key);
  cronLogger.info(`[Redis] INVALIDATED ${key}`);
};

// ============================================
// DISTRIBUTED LOCKING (for concurrency control)
// ============================================
// Designed for a payment gateway handling many concurrent payments.
// Features:
//  - Automatic lock TTL renewal (heartbeat) for long operations
//  - Stale lock cleanup on startup (dead-process recovery)
//  - Per-payment granular locking (no global batch bottleneck)
//  - Atomic acquire/release via Lua scripts

// Track lock ownership per key for safe release
const lockOwners = new Map<string, string>();

// Active renewal timers (cleared on release)
const lockRenewTimers = new Map<string, NodeJS.Timeout>();

/**
 * Acquire a distributed lock with optional auto-renewal.
 *
 * Auto-renewal: When `autoRenew` is true, a background timer extends the lock
 * at 50% of TTL. This prevents the lock expiring mid-operation when a sweep or
 * conversion takes longer than expected — the #1 cause of the "stuck lock" bugs.
 */
const acquireLock = async (
  lockKey: string,
  ttlSeconds: number = 30,
  maxRetries: number = 3,
  retryDelayMs: number = 100,
  autoRenew: boolean = false,
  silent: boolean = false
): Promise<boolean> => {
  const fullKey = `lock:${lockKey}`;
  const lockValue = `${process.pid}:${Date.now()}`;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await redisClient.set(fullKey, lockValue, {
        NX: true,
        EX: ttlSeconds
      });
      
      if (result === 'OK') {
        lockOwners.set(fullKey, lockValue);
        if (!silent) cronLogger.info(`[Lock] Acquired: ${lockKey} (TTL: ${ttlSeconds}s, autoRenew: ${autoRenew})`);
        
        // Start heartbeat renewal at 50% of TTL
        if (autoRenew) {
          const renewInterval = Math.floor(ttlSeconds * 500); // ms, 50% of TTL
          const timer = setInterval(async () => {
            try {
              // Only extend if we still own the lock (atomic check via Lua)
              const extended = await redisClient.eval(EXTEND_LOCK_SCRIPT, {
                keys: [fullKey],
                arguments: [lockValue, String(ttlSeconds)],
              });
              if (extended === 1) {
                if (!silent) cronLogger.info(`[Lock] Renewed: ${lockKey} (+${ttlSeconds}s)`);
              } else {
                // Lock was lost (expired or stolen) — stop renewing
                clearInterval(timer);
                lockRenewTimers.delete(fullKey);
                if (!silent) cronLogger.warn(`[Lock] Renewal failed (lost): ${lockKey}`);
              }
            } catch {
              // Redis error — stop renewing to avoid noise
              clearInterval(timer);
              lockRenewTimers.delete(fullKey);
            }
          }, renewInterval);
          lockRenewTimers.set(fullKey, timer);
        }
        
        return true;
      }
      
      if (attempt === 0) {
        const holder = await redisClient.get(fullKey);
        const ttl = await redisClient.ttl(fullKey);
        if (!silent) cronLogger.info(`[Lock] ${lockKey} held by ${holder}, TTL: ${ttl}s (current PID: ${process.pid})`);

        // BUG-5 FIX: Steal stale locks with expired TTL (negative or zero)
        // This happens when the previous holder crashed without releasing,
        // and Redis TTL has already expired but the key persists (race window)
        // or the key was set without TTL by a bug.
        if (ttl <= 0 && holder) {
          cronLogger.warn(`[Lock] Stealing stale lock ${lockKey} (TTL: ${ttl}s, old holder: ${holder})`);
          // Force-set the lock with our value and TTL (overwrites stale key)
          const stealResult = await redisClient.set(fullKey, lockValue, { EX: ttlSeconds });
          if (stealResult === 'OK') {
            lockOwners.set(fullKey, lockValue);
            if (!silent) cronLogger.info(`[Lock] Stolen & acquired: ${lockKey} (TTL: ${ttlSeconds}s, autoRenew: ${autoRenew})`);
            if (autoRenew) {
              const renewInterval = Math.floor(ttlSeconds * 500);
              const timer = setInterval(async () => {
                try {
                  const extended = await redisClient.eval(EXTEND_LOCK_SCRIPT, {
                    keys: [fullKey],
                    arguments: [lockValue, String(ttlSeconds)],
                  });
                  if (extended === 1) {
                    if (!silent) cronLogger.info(`[Lock] Renewed: ${lockKey} (+${ttlSeconds}s)`);
                  } else {
                    clearInterval(timer);
                    lockRenewTimers.delete(fullKey);
                  }
                } catch {
                  clearInterval(timer);
                  lockRenewTimers.delete(fullKey);
                }
              }, renewInterval);
              lockRenewTimers.set(fullKey, timer);
            }
            return true;
          }
        }
      }
    } catch (err) {
      cronLogger.error(`[Lock] Redis error during acquire ${lockKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  if (!silent) cronLogger.info(`[Lock] Failed to acquire after ${maxRetries} attempts: ${lockKey}`);
  return false;
};

// Lua: Atomic compare-and-delete (only delete if we own the lock)
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

// Lua: Atomic compare-and-extend (only extend TTL if we still own the lock)
const EXTEND_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
  else
    return 0
  end
`;

/**
 * Release a distributed lock (only if current process owns it)
 */
const releaseLock = async (lockKey: string, silent: boolean = false): Promise<void> => {
  const fullKey = `lock:${lockKey}`;
  
  // Stop renewal timer first
  const timer = lockRenewTimers.get(fullKey);
  if (timer) {
    clearInterval(timer);
    lockRenewTimers.delete(fullKey);
  }
  
  const lockValue = lockOwners.get(fullKey);
  if (lockValue) {
    try {
      const result = await redisClient.eval(RELEASE_LOCK_SCRIPT, {
        keys: [fullKey],
        arguments: [lockValue],
      });
      if (result === 1) {
        if (!silent) cronLogger.info(`[Lock] Released: ${lockKey}`);
      } else {
        if (!silent) cronLogger.warn(`[Lock] Lock expired or owned by another process: ${lockKey}`);
      }
    } catch {
      await redisClient.del(fullKey).catch(() => {});
      if (!silent) cronLogger.info(`[Lock] Released (fallback): ${lockKey}`);
    }
    lockOwners.delete(fullKey);
  } else {
    await redisClient.del(fullKey).catch(() => {});
    if (!silent) cronLogger.info(`[Lock] Released (no owner): ${lockKey}`);
  }
};

/**
 * Execute a function with a distributed lock.
 * Uses auto-renewal by default to prevent lock expiry during long operations.
 */
const withLock = async <T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 30,
  silent: boolean = false
): Promise<{ success: boolean; result?: T; error?: string }> => {
  const acquired = await acquireLock(lockKey, ttlSeconds, 3, 100, true, silent);
  
  if (!acquired) {
    return { success: false, error: 'Could not acquire lock' };
  }
  
  try {
    const result = await fn();
    return { success: true, result };
  } finally {
    await releaseLock(lockKey, silent);
  }
};

/**
 * Cleanup stale locks from dead processes on startup.
 * Scans all lock:cron:* keys and removes any owned by PIDs that no longer exist.
 * This prevents the "stuck cron" scenario after an unclean restart.
 */
const cleanupStaleLocks = async (): Promise<number> => {
  let cleaned = 0;
  try {
    const lockKeys = await redisClient.keys('lock:cron:*');
    for (const key of lockKeys) {
      const value = await redisClient.get(key);
      if (!value) continue;
      
      const [pidStr] = value.split(':');
      const pid = parseInt(pidStr, 10);
      
      // Check if the PID is still alive
      let alive = false;
      try {
        process.kill(pid, 0); // Signal 0 = existence check, no actual signal
        alive = true;
      } catch {
        alive = false; // Process doesn't exist
      }
      
      if (!alive) {
        await redisClient.del(key);
        cleaned++;
        cronLogger.info(`[Lock] Cleaned stale lock: ${key} (dead PID: ${pid})`);
      }
    }
    if (cleaned > 0) {
      cronLogger.info(`[Lock] Startup cleanup: removed ${cleaned} stale locks`);
    }
  } catch (err) {
    cronLogger.error(`[Lock] Startup cleanup error: ${err instanceof Error ? err.message : String(err)}`);
  }
  return cleaned;
};

export { 
  setRedisItem, 
  setRedisItemWithTTL, 
  setRedisTTL, 
  getRedisItem, 
  deleteRedisItem, 
  softDeleteRedisItem, 
  setMemoryCache, 
  getMemoryCache, 
  invalidateCache,
  acquireLock,
  releaseLock,
  withLock,
  cleanupStaleLocks,
  redisClient as redis,
};
