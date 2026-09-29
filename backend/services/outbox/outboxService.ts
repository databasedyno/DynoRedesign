/**
 * Outbox Service — transactional enqueue + reliable relay (Tier-2 Item #10).
 *
 * WRITE SIDE (in the request/settlement path):
 *   await enqueueOutbox({ aggregateType, aggregateId, eventType, payload }, { transaction })
 *   — pass the SAME Sequelize transaction as the domain write so the event row
 *     and the state change commit atomically (or not at all).
 *
 * RELAY SIDE (worker only):
 *   startOutboxRelay() polls `tbl_outbox` for due `pending` rows using
 *   FOR UPDATE SKIP LOCKED (safe across multiple worker replicas), dispatches
 *   each via a registered handler, and marks it dispatched — or bumps attempts
 *   with exponential backoff, moving to `failed` after max_attempts.
 *
 * Gating: the relay is started only when ENABLE_OUTBOX && isCronEnabled
 * (WORKER_ROLE=primary + ENABLE_BACKGROUND_JOBS). The write path is gated by
 * ENABLE_OUTBOX at the call site, so with the flag OFF nothing changes.
 */

import { randomUUID, createHash } from "crypto";
import { QueryTypes, Transaction } from "sequelize";
import sequelize from "../../utils/dbInstance";
import OutboxEvent from "../../models/outboxEventModel";
import { cronLogger } from "../../utils/loggers";

export interface EnqueueOutboxInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  eventId?: string;          // supply to make enqueue idempotent for a business op
  maxAttempts?: number;
}

export type OutboxHandler = (event: {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId: string | null;
}) => Promise<void>;

const dispatchers = new Map<string, OutboxHandler>();

// tbl_outbox column limits (see models/outboxEventModel.ts). Real-world business
// keys overflow these — a BTC txid is 64 chars, a Solana signature ~88 — so a
// naive `settlement:${paymentId}:${txId}` event_id (or a chain signature used as
// a correlation id) would throw "value too long for type character varying(64)".
// Critically, the ledger enqueue runs INSIDE the settlement DB transaction, so
// that overflow would roll the settlement back. Normalise here so every caller
// (ledger + merchant webhook) is safe.
const EVENT_ID_MAX = 64;
const CORRELATION_ID_MAX = 64;
const AGGREGATE_ID_MAX = 100;

/** Keep a stable, unique event_id within varchar(64): hash anything longer. */
function normalizeEventId(id: string): string {
  if (id.length <= EVENT_ID_MAX) return id;
  // sha256 hex is exactly 64 chars and deterministic → idempotency preserved.
  return createHash("sha256").update(id).digest("hex");
}

/** Register a dispatcher for an event_type. Last registration wins. */
export function registerDispatcher(eventType: string, handler: OutboxHandler): void {
  dispatchers.set(eventType, handler);
}

/**
 * Insert an outbox row. When `transaction` is supplied the insert participates
 * in the caller's atomic unit of work (the whole point of the pattern).
 */
export async function enqueueOutbox(
  input: EnqueueOutboxInput,
  opts: { transaction?: Transaction } = {}
): Promise<{ eventId: string; created: boolean }> {
  const eventId = normalizeEventId(input.eventId || randomUUID());
  try {
    await OutboxEvent.create(
      {
        event_id: eventId,
        aggregate_type: input.aggregateType,
        aggregate_id: String(input.aggregateId ?? "").slice(0, AGGREGATE_ID_MAX),
        event_type: input.eventType,
        payload: input.payload,
        status: "pending",
        attempts: 0,
        max_attempts: input.maxAttempts ?? 20,
        available_at: new Date(),
        correlation_id: input.correlationId
          ? String(input.correlationId).slice(0, CORRELATION_ID_MAX)
          : null,
        last_error: null,
        dispatched_at: null,
      },
      { transaction: opts.transaction }
    );
    return { eventId, created: true };
  } catch (err) {
    // Duplicate event_id => idempotent enqueue for the same business op.
    // Detect robustly: Sequelize surfaces unique violations as
    // SequelizeUniqueConstraintError (generic message) / Postgres SQLSTATE 23505.
    const e = err as {
      name?: string;
      message?: string;
      original?: { code?: string };
      parent?: { code?: string };
    };
    const isUnique =
      e?.name === "SequelizeUniqueConstraintError" ||
      e?.original?.code === "23505" ||
      e?.parent?.code === "23505" ||
      /unique constraint|duplicate key/i.test(e?.message || "");
    if (isUnique) {
      return { eventId, created: false };
    }
    throw err;
  }
}

// ─── Relay ──────────────────────────────────────────────────────────────────

// Explicit merchant-webhook retry schedule (API review §5.1.3): 7 retries over
// ~24h so a merchant deploy or a short outage no longer loses events. Indexed by
// the post-increment attempt number (attempt 1 → 1m … attempt 7 → 24h). Other
// outbox event types keep the fast exponential backoff below.
const MERCHANT_WEBHOOK_RETRY_MS = [
  60_000,        // 1m
  5 * 60_000,    // 5m
  30 * 60_000,   // 30m
  2 * 3_600_000, // 2h
  6 * 3_600_000, // 6h
  12 * 3_600_000, // 12h
  24 * 3_600_000, // 24h
];

function backoffMs(attempts: number, eventType?: string): number {
  if (eventType === "merchant.webhook") {
    const idx = Math.min(Math.max(attempts - 1, 0), MERCHANT_WEBHOOK_RETRY_MS.length - 1);
    return MERCHANT_WEBHOOK_RETRY_MS[idx];
  }
  // Default (ledger / other events): 2^n seconds, capped at 5 minutes.
  return Math.min(5 * 60_000, Math.pow(2, attempts) * 1000);
}

interface ClaimedRow {
  id: number;
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  correlation_id: string | null;
}

/** How long a claimed row may sit in `processing` before it is considered abandoned. */
export const PROCESSING_LEASE_MS = 10 * 60_000;
/** Abandoned rows older than this are closed as failed instead of being redelivered (stale intermediate events). */
export const STALE_REDELIVERY_MAX_AGE_MS = 24 * 60 * 60_000;

/**
 * Thrown by a dispatcher when only SOME of its targets failed transiently.
 * `deliveredTargets` is persisted on the row so the retry skips the endpoints
 * that already received the event (no double delivery).
 */
export class OutboxPartialFailure extends Error {
  constructor(message: string, public readonly deliveredTargets: string[]) {
    super(message);
    this.name = "OutboxPartialFailure";
  }
}

/**
 * Release rows whose `processing` lease expired (worker killed between claim and
 * mark — e.g. a container swap). Recent rows go back to `pending`; rows older than
 * 24h are closed as `failed` so a stale intermediate event is not replayed after a
 * later event (payment.settled) already reached the merchant.
 */
export async function reclaimStaleProcessing(): Promise<{ requeued: number; closed: number }> {
  const rows = (await sequelize.query(
    `UPDATE tbl_outbox
        SET status = CASE WHEN created_at > NOW() - make_interval(secs => :maxAgeS) THEN 'pending' ELSE 'failed' END,
            last_error = CASE WHEN created_at > NOW() - make_interval(secs => :maxAgeS)
                              THEN 'reclaimed: processing lease expired (worker did not finish)'
                              ELSE 'stale processing lease expired (>24h) — not redelivered' END,
            available_at = NOW()
      WHERE status = 'processing' AND available_at <= NOW() - make_interval(secs => :leaseS)
      RETURNING id, event_id, event_type, status`,
    { type: QueryTypes.SELECT, replacements: { leaseS: PROCESSING_LEASE_MS / 1000, maxAgeS: STALE_REDELIVERY_MAX_AGE_MS / 1000 } }
  )) as unknown as Array<{ id: number; event_id: string; event_type: string; status: string }>;
  let requeued = 0;
  let closed = 0;
  for (const r of rows) {
    if (r.status === "pending") requeued++; else closed++;
    cronLogger.warn(`[Outbox] reclaimed stale processing row #${r.id} (${r.event_type}, ${r.event_id}) → ${r.status}`);
  }
  return { requeued, closed };
}

/** Atomically claim a batch of due rows (multi-worker safe via SKIP LOCKED). The claim carries a lease via available_at. */
async function claimBatch(limit: number): Promise<ClaimedRow[]> {
  return sequelize.transaction(async (t) => {
    const rows = (await sequelize.query(
      `SELECT id, event_id, aggregate_type, aggregate_id, event_type, payload,
              attempts, max_attempts, correlation_id
         FROM tbl_outbox
        WHERE status = 'pending' AND available_at <= NOW()
        ORDER BY id ASC
        LIMIT :limit
        FOR UPDATE SKIP LOCKED`,
      { type: QueryTypes.SELECT, replacements: { limit }, transaction: t }
    )) as unknown as ClaimedRow[];

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      await sequelize.query(
        `UPDATE tbl_outbox SET status = 'processing', available_at = NOW() + make_interval(secs => :leaseS) WHERE id IN (:ids)`,
        { replacements: { ids, leaseS: PROCESSING_LEASE_MS / 1000 }, transaction: t }
      );
    }
    return rows;
  });
}

async function markDispatched(id: number): Promise<void> {
  await OutboxEvent.update(
    { status: "dispatched", dispatched_at: new Date(), last_error: null },
    { where: { id } }
  );
}

async function markRetry(row: ClaimedRow, error: string, payloadPatch?: Record<string, unknown>): Promise<void> {
  const attempts = row.attempts + 1;
  const failed = attempts >= row.max_attempts;
  await OutboxEvent.update(
    {
      status: failed ? "failed" : "pending",
      attempts,
      last_error: String(error).slice(0, 2000),
      available_at: new Date(Date.now() + backoffMs(attempts, row.event_type)),
      ...(payloadPatch ? { payload: { ...(row.payload || {}), ...payloadPatch } } : {}),
    },
    { where: { id: row.id } }
  );
  if (failed) {
    cronLogger.error(`[Outbox] event ${row.event_id} (${row.event_type}) moved to FAILED after ${attempts} attempts: ${error}`);
  }
}

/** Dispatch one due batch. Returns how many were processed. */
export async function relayPendingBatch(limit = 50): Promise<{ dispatched: number; retried: number }> {
  try {
    await reclaimStaleProcessing();
  } catch (err) {
    cronLogger.warn(`[Outbox] stale-lease reclaim failed (non-fatal): ${(err as Error).message}`);
  }
  const rows = await claimBatch(limit);
  let dispatched = 0;
  let retried = 0;
  for (const row of rows) {
    const handler = dispatchers.get(row.event_type);
    try {
      if (!handler) {
        // No handler registered yet — keep it pending (do not lose it), log once.
        await markRetry(row, `no dispatcher registered for '${row.event_type}'`);
        retried++;
        continue;
      }
      await handler({
        eventId: row.event_id,
        aggregateType: row.aggregate_type,
        aggregateId: row.aggregate_id,
        eventType: row.event_type,
        payload: row.payload,
        correlationId: row.correlation_id,
      });
      await markDispatched(row.id);
      dispatched++;
    } catch (err) {
      const patch = err instanceof OutboxPartialFailure ? { deliveredTargets: err.deliveredTargets } : undefined;
      await markRetry(row, (err as Error).message || String(err), patch);
      retried++;
    }
  }
  return { dispatched, retried };
}

let relayTimer: NodeJS.Timeout | null = null;

/** Start the relay poll loop (idempotent). Caller must gate on flags. */
export function startOutboxRelay(intervalMs = 5000): void {
  if (relayTimer) return;
  cronLogger.info(`[Outbox] relay started (every ${intervalMs}ms)`);
  const tick = async () => {
    try {
      const { dispatched, retried } = await relayPendingBatch(50);
      if (dispatched || retried) {
        cronLogger.info(`[Outbox] relay cycle: ${dispatched} dispatched, ${retried} retried`);
      }
    } catch (err) {
      cronLogger.error(`[Outbox] relay cycle error: ${(err as Error).message}`);
    }
  };
  relayTimer = setInterval(tick, intervalMs);
  // Kick one immediately (non-blocking).
  void tick();
}

export function stopOutboxRelay(): void {
  if (relayTimer) {
    clearInterval(relayTimer);
    relayTimer = null;
  }
}

export async function getOutboxHealth(): Promise<Record<string, number>> {
  const rows = (await sequelize.query(
    `SELECT status, COUNT(*)::int AS n FROM tbl_outbox GROUP BY status`,
    { type: QueryTypes.SELECT }
  )) as Array<{ status: string; n: number }>;
  const out: Record<string, number> = { pending: 0, processing: 0, dispatched: 0, failed: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export default {
  registerDispatcher,
  enqueueOutbox,
  relayPendingBatch,
  startOutboxRelay,
  stopOutboxRelay,
  getOutboxHealth,
};
