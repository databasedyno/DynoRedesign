import { redis } from "./redisInstance";
import { apiLogger } from "./loggers";

/**
 * Redis-backed primitives for operational state that must SURVIVE a container
 * restart/redeploy (alert cooldowns, abuse counters, scanner blocklists).
 * Every call degrades gracefully: when Redis is unavailable it returns null /
 * false and logs (throttled) so callers keep working from their in-memory copy.
 */
const PREFIX = "dynopay:durable:";

let lastWarnAt = 0;
const warn = (op: string, err: unknown): void => {
  const now = Date.now();
  if (now - lastWarnAt < 60_000) return;
  lastWarnAt = now;
  apiLogger.warn(
    `[DurableState] ${op} failed — using in-memory fallback: ${err instanceof Error ? err.message : String(err)}`
  );
};

// INCR + EXPIRE-on-first-hit in one atomic step (no un-expiring keys on crash).
const COUNT_HIT_LUA =
  "local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return n";

/** Fixed-window counter. Returns the hit number within the window (1 = first). */
export async function countHit(key: string, windowSec: number): Promise<number | null> {
  try {
    const n = await redis.eval(COUNT_HIT_LUA, { keys: [PREFIX + key], arguments: [String(windowSec)] });
    return Number(n);
  } catch (err) {
    warn(`countHit ${key}`, err);
    return null;
  }
}

/** Claim `key` once per `ttlSec` (SET NX EX). true = claimed now, false = already claimed. */
export async function claimOnce(key: string, ttlSec: number): Promise<boolean | null> {
  try {
    const r = await redis.set(PREFIX + key, String(Date.now()), { NX: true, EX: ttlSec });
    return r === "OK";
  } catch (err) {
    warn(`claimOnce ${key}`, err);
    return null;
  }
}

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (err) {
    warn(`loadJson ${key}`, err);
    return null;
  }
}

export async function saveJson(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  try {
    await redis.set(PREFIX + key, JSON.stringify(value), { EX: ttlSec });
    return true;
  } catch (err) {
    warn(`saveJson ${key}`, err);
    return false;
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await redis.del(PREFIX + key);
  } catch (err) {
    warn(`remove ${key}`, err);
  }
}

/** `{ suffix → parsed JSON }` for every key under `prefix` (SCAN — never blocks Redis). null = Redis unavailable. */
export async function loadAllJson<T>(prefix: string): Promise<Record<string, T> | null> {
  const out: Record<string, T> = {};
  try {
    for await (const k of redis.scanIterator({ MATCH: `${PREFIX}${prefix}*`, COUNT: 200 })) {
      const raw = await redis.get(k);
      if (!raw) continue;
      try {
        out[k.slice(PREFIX.length + prefix.length)] = JSON.parse(raw) as T;
      } catch {
        /* skip corrupt entry */
      }
    }
  } catch (err) {
    warn(`loadAllJson ${prefix}`, err);
    return null;
  }
  return out;
}
