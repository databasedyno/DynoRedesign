/**
 * Redis-based Leader Election for background jobs.
 *
 * PROBLEM: DigitalOcean App Platform runs N identical instances of this service
 * (currently 2), and env vars are app-level — so BOTH instances get
 * WORKER_ROLE=primary + ENABLE_BACKGROUND_JOBS=true. Previously every primary
 * instance registered its own cron scheduler, causing:
 *   - Every cron job firing N× in parallel (duplicate sweeps racing for per-job locks)
 *   - Lock-steal races in the logs (the stale-lock steal path is not atomic)
 *   - Double Tatum/Binance API consumption
 *   - BullMQ webhook worker consuming on every instance
 *
 * SOLUTION: All eligible instances (ENABLE_BACKGROUND_JOBS=true, WORKER_ROLE!=secondary)
 * compete for a single Redis lease (SET NX EX). Exactly one instance holds the lease
 * ("leader") and runs cron jobs + leader-only services. The leader renews the lease
 * every RENEW/ACQUIRE tick; standbys retry acquisition. If the leader dies, is
 * redeployed, or loses connectivity, its lease expires within LEADER_TTL_SECONDS and
 * a standby is promoted automatically. On graceful shutdown the leader releases the
 * lease immediately so failover is near-instant during rolling deploys.
 *
 * Per-job locks in redisInstance.ts remain as a second line of defense during
 * leadership transitions (e.g. a Redis flap where two instances briefly overlap).
 *
 * NOTE (preview/staging safety): instances with ENABLE_BACKGROUND_JOBS=false never
 * call startLeaderElection(), so they can never grab the production lease even
 * though they share the same Redis.
 */
import os from "os";
import { redis } from "./redisInstance";
import { cronLogger } from "./loggers";

const LEADER_KEY = "leader:background-jobs";
const LEADER_TTL_SECONDS = 60;      // lease lifetime — leader death detected within this window
const TICK_INTERVAL_MS = 15_000;    // leader renews / standby retries every 15s (4 renewals per TTL)

// Unique per-process identity (hostname distinguishes DO instances, pid + nonce guard restarts)
const INSTANCE_ID = `${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;

// Atomic "extend only if still owner" (avoids stealing a peer's lease after a flap)
const EXTEND_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("expire", KEYS[1], ARGV[2])
else
  return 0
end`;

// Atomic "release only if still owner"
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

interface LeaderCallbacks {
  /** Called every time this instance BECOMES leader (first election AND re-promotions). */
  onPromoted: () => void;
  /** Called when this instance LOSES leadership (lease lost/stolen after a flap). */
  onDemoted: () => void;
}

let leader = false;
let stopped = false;
let started = false;
let tickTimer: NodeJS.Timeout | null = null;
let callbacks: LeaderCallbacks | null = null;

export const isLeader = (): boolean => leader;
export const getInstanceId = (): string => INSTANCE_ID;

const tick = async (): Promise<void> => {
  if (stopped) return;
  try {
    if (leader) {
      // Renew our lease — atomic ownership check via Lua
      const extended = await redis.eval(EXTEND_SCRIPT, {
        keys: [LEADER_KEY],
        arguments: [INSTANCE_ID, String(LEADER_TTL_SECONDS)],
      });
      if (extended !== 1) {
        leader = false;
        const holder = await redis.get(LEADER_KEY).catch(() => "unknown");
        cronLogger.warn(
          `[LeaderElection] ⚠️  LOST leadership (lease expired or taken by ${holder}). ` +
          `Pausing background jobs on ${INSTANCE_ID}.`
        );
        callbacks?.onDemoted();
      }
    } else {
      // Standby: try to acquire the lease
      const result = await redis.set(LEADER_KEY, INSTANCE_ID, {
        NX: true,
        EX: LEADER_TTL_SECONDS,
      });
      if (result === "OK") {
        leader = true;
        cronLogger.info(
          `[LeaderElection] 👑 PROMOTED to background-jobs leader: ${INSTANCE_ID} ` +
          `(lease TTL ${LEADER_TTL_SECONDS}s, renew every ${TICK_INTERVAL_MS / 1000}s)`
        );
        callbacks?.onPromoted();
      }
    }
  } catch (err) {
    // Redis error: if we were leader we KEEP our local leader flag — the per-job
    // locks protect against overlap, and demoting on a transient Redis blip would
    // needlessly stop jobs. If Redis is down long enough the lease expires and the
    // next successful tick resolves the real state.
    cronLogger.error(
      `[LeaderElection] Redis error during ${leader ? "renewal" : "acquisition"}: ` +
      `${err instanceof Error ? err.message : String(err)}`
    );
  }
};

/**
 * Start competing for background-jobs leadership.
 * Safe to call once per process; subsequent calls are ignored.
 */
export const startLeaderElection = (cbs: LeaderCallbacks): void => {
  if (started) return;
  started = true;
  stopped = false;
  callbacks = cbs;
  cronLogger.info(`[LeaderElection] Started as candidate: ${INSTANCE_ID} (key: ${LEADER_KEY})`);
  // Immediate first attempt so a single-instance deploy promotes without waiting a tick
  void tick();
  tickTimer = setInterval(() => { void tick(); }, TICK_INTERVAL_MS);
  // Don't hold the event loop open just for elections
  tickTimer.unref?.();
};

/**
 * Stop participating and release the lease if we own it.
 * Called during graceful shutdown so a peer can take over within one tick (~15s)
 * instead of waiting for the full TTL (60s).
 */
export const stopLeaderElection = async (): Promise<void> => {
  stopped = true;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (leader) {
    leader = false;
    try {
      const released = await redis.eval(RELEASE_SCRIPT, {
        keys: [LEADER_KEY],
        arguments: [INSTANCE_ID],
      });
      cronLogger.info(
        `[LeaderElection] Released leadership lease on shutdown (released=${released}) — ` +
        `a standby instance can promote within ${TICK_INTERVAL_MS / 1000}s.`
      );
    } catch (err) {
      cronLogger.warn(
        `[LeaderElection] Could not release lease on shutdown (lease will expire in ≤${LEADER_TTL_SECONDS}s): ` +
        `${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
};
