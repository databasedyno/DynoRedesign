/**
 * Tatum Call Meter (Phase 1 — observability + soft budget guard)
 *
 * WHY: Tatum credit usage has been climbing fast (LTC/DOGE general API calls
 * dominate). Before changing any payment-detection behaviour we need to KNOW
 * which caller/job is making the expensive reads. This module records every
 * logical Tatum read (operation + chain + source + cache outcome + duration)
 * into short-lived Redis counters so an admin endpoint can attribute the spend.
 *
 * SAFETY:
 *  - Records are fire-and-forget and NEVER throw — metering can never break a
 *    payment path.
 *  - No addresses, keys, tokens, amounts or PII are ever recorded. Only the
 *    normalised operation name, chain symbol, a coarse source/job tag, the
 *    cache outcome, the response status class and a duration.
 *  - The budget guard defaults to ALERT-ONLY (a deduped warning log). The
 *    optional idle-poll skip is OFF unless TATUM_IDLE_READ_GUARD=true and only
 *    ever applies to non-critical idle-pool scans — active checkout / webhook /
 *    missed-payment detection is never throttled.
 *
 * ENV (all optional):
 *   TATUM_METER_ENABLED=false            disable metering entirely (default on)
 *   TATUM_HOURLY_BUDGET_<CHAIN>=<n>      per-chain hourly provider-call alert
 *                                        threshold, e.g. TATUM_HOURLY_BUDGET_LTC=2000
 *   TATUM_HOURLY_BUDGET_DEFAULT=<n>      fallback threshold for chains without a
 *                                        specific one (default 0 = disabled)
 *   TATUM_IDLE_READ_GUARD=true           allow idle-pool scans to skip a read
 *                                        once that chain is over its hourly budget
 */
import { AsyncLocalStorage } from "async_hooks";
import { redis } from "../utils/redisInstance";
import { cronLogger } from "../utils/loggers";
import { num, bool, raw as envRaw } from "../utils/config";

export type CacheOutcome = "hit" | "miss" | "bypass" | "none";

export interface TatumCallRecord {
  operation: string;
  chain: string;
  cache?: CacheOutcome;
  status?: "ok" | "error";
  ms?: number;
}

interface SourceCtx {
  source: string;
}

const als = new AsyncLocalStorage<SourceCtx>();

/** Run `fn` with a source/job tag so any Tatum reads inside are attributed to it. */
export const runWithTatumSource = <T>(source: string, fn: () => Promise<T>): Promise<T> =>
  als.run({ source }, fn);

/** Express middleware form — tags all Tatum reads in the request as `source`. */
export const tatumSourceMiddleware =
  (source: string) =>
  (_req: unknown, _res: unknown, next: () => void): void => {
    als.run({ source }, () => next());
  };

/** Current source tag, or "other" when none is set (e.g. ad-hoc / request paths). */
export const getTatumSource = (): string => als.getStore()?.source || "other";

const RETENTION_HOURS = 73;
const meterEnabled = (): boolean => envRaw("TATUM_METER_ENABLED") !== "false";

const hourKey = (d: Date = new Date()): string =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate()
  ).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}`;

// Keep labels compact and collision-free with the "~" field separator.
const sanitize = (s: string): string => String(s || "unknown").replace(/[|~]/g, "-").slice(0, 48);

/** Per-chain hourly alert threshold (provider calls). 0 → disabled. */
const chainBudget = (chain: string): number => {
  const up = sanitize(chain).toUpperCase();
  const specific = num(`TATUM_HOURLY_BUDGET_${up}`, -1);
  if (specific >= 0) return specific;
  const fallback = num("TATUM_HOURLY_BUDGET_DEFAULT", -1);
  return fallback >= 0 ? fallback : 0;
};

// In-memory dedupe so the budget warning fires at most once per chain per hour.
const warnedThisHour = new Set<string>();

function maybeWarnBudget(chain: string, count: number): void {
  const limit = chainBudget(chain);
  if (limit <= 0 || count < limit) return;
  const key = `${chain}:${hourKey()}`;
  if (warnedThisHour.has(key)) return;
  warnedThisHour.add(key);
  if (warnedThisHour.size > 1000) warnedThisHour.clear();
  cronLogger.warn(
    `[TatumMeter] 🚨 Hourly Tatum budget exceeded for ${chain}: ${count} provider calls this hour (limit ${limit}). ` +
      `Inspect caller breakdown at GET /api/diagnostics/tatum-usage.`
  );
}

async function doRecord(rec: TatumCallRecord, source: string): Promise<void> {
  const hk = hourKey();
  const op = sanitize(rec.operation);
  const chain = sanitize(rec.chain);
  const src = sanitize(source);
  const cache: CacheOutcome = rec.cache || "none";
  const status = rec.status || "ok";

  const detailKey = `tatum:meter:${hk}`;
  const field = `${op}~${chain}~${src}~${cache}~${status}`;

  const n = await redis.hIncrBy(detailKey, field, 1);
  if (n === 1) await redis.expire(detailKey, RETENTION_HOURS * 3600);

  if (rec.ms && rec.ms > 0) {
    await redis.hIncrBy(detailKey, `ms~${op}~${chain}`, Math.round(rec.ms));
  }

  // Fast per-chain provider-call counter (cache hits are free, excluded).
  if (cache !== "hit") {
    const chainKey = `tatum:meter:chain:${chain}:${hk}`;
    const c = await redis.incr(chainKey);
    if (c === 1) await redis.expire(chainKey, RETENTION_HOURS * 3600);
    maybeWarnBudget(chain, c);
  }
}

/** Record a Tatum read. Fire-and-forget; never throws, never blocks the caller. */
export const recordTatumCall = (rec: TatumCallRecord): void => {
  if (!meterEnabled()) return;
  const source = getTatumSource();
  void doRecord(rec, source).catch(() => {
    /* metering must never break a payment path */
  });
};

/** Time + record an async Tatum operation. Rethrows the original error. */
export async function meterTatum<T>(
  operation: string,
  chain: string,
  fn: () => Promise<T>,
  opts: { cache?: CacheOutcome } = {}
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    recordTatumCall({ operation, chain, cache: opts.cache ?? "miss", status: "ok", ms: Date.now() - start });
    return result;
  } catch (e) {
    recordTatumCall({ operation, chain, cache: opts.cache ?? "miss", status: "error", ms: Date.now() - start });
    throw e;
  }
}

/**
 * Soft guard for NON-CRITICAL idle-pool scans only. Returns true when the idle
 * guard is enabled AND the chain is already over its hourly budget, so the
 * caller can skip a redundant balance read this cycle. Default OFF.
 */
export async function shouldSkipIdlePoll(chain: string): Promise<boolean> {
  if (!bool("TATUM_IDLE_READ_GUARD", false)) return false;
  const limit = chainBudget(chain);
  if (limit <= 0) return false;
  try {
    const c = Number(await redis.get(`tatum:meter:chain:${sanitize(chain)}:${hourKey()}`)) || 0;
    return c >= limit;
  } catch {
    return false;
  }
}

export interface MeterSnapshot {
  generatedAt: string;
  hours: number;
  totals: {
    byChain: Record<string, number>;
    bySource: Record<string, number>;
    byOperation: Record<string, number>;
    byChainSource: Record<string, number>;
  };
  buckets: Array<{
    hour: string;
    total: number;
    entries: Array<{
      op: string;
      chain: string;
      source: string;
      cache: string;
      status: string;
      count: number;
    }>;
  }>;
}

/** Read-only attribution snapshot for the last `hours` hourly buckets. */
export async function getMeterSnapshot(hours = 6): Promise<MeterSnapshot> {
  const now = new Date();
  const buckets: MeterSnapshot["buckets"] = [];
  const byChain: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byOperation: Record<string, number> = {};
  const byChainSource: Record<string, number> = {};

  for (let i = 0; i < Math.max(1, Math.min(hours, RETENTION_HOURS)); i++) {
    const d = new Date(now.getTime() - i * 3600 * 1000);
    const hk = hourKey(d);
    const h = (await redis.hGetAll(`tatum:meter:${hk}`).catch(() => ({}))) as Record<string, string>;
    const entries: MeterSnapshot["buckets"][number]["entries"] = [];
    let bucketTotal = 0;

    for (const [fieldRaw, valRaw] of Object.entries(h)) {
      if (fieldRaw.startsWith("ms~")) continue;
      const [op, chain, source, cache, status] = fieldRaw.split("~");
      const count = Number(valRaw) || 0;
      bucketTotal += count;
      entries.push({ op, chain, source, cache, status, count });
      byChain[chain] = (byChain[chain] || 0) + count;
      bySource[source] = (bySource[source] || 0) + count;
      byOperation[op] = (byOperation[op] || 0) + count;
      const cs = `${chain}|${source}`;
      byChainSource[cs] = (byChainSource[cs] || 0) + count;
    }

    entries.sort((a, b) => b.count - a.count);
    buckets.push({ hour: hk, total: bucketTotal, entries });
  }

  return {
    generatedAt: now.toISOString(),
    hours,
    totals: { byChain, bySource, byOperation, byChainSource },
    buckets,
  };
}
