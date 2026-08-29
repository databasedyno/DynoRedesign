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

function backoffMs(attempts: number): number {
  // 2^n seconds, capped at 5 minutes.
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

/** Atomically claim a batch of due rows (multi-worker safe via SKIP LOCKED). */
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
        `UPDATE tbl_outbox SET status = 'processing' WHERE id IN (:ids)`,
        { replacements: { ids }, transaction: t }
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

async function markRetry(row: ClaimedRow, error: string): Promise<void> {
  const attempts = row.attempts + 1;
  const failed = attempts >= row.max_attempts;
  await OutboxEvent.update(
    {
      status: failed ? "failed" : "pending",
      attempts,
      last_error: String(error).slice(0, 2000),
      available_at: new Date(Date.now() + backoffMs(attempts)),
    },
    { where: { id: row.id } }
  );
  if (failed) {
    cronLogger.error(`[Outbox] event ${row.event_id} (${row.event_type}) moved to FAILED after ${attempts} attempts: ${error}`);
  }
}

/** Dispatch one due batch. Returns how many were processed. */
export async function relayPendingBatch(limit = 50): Promise<{ dispatched: number; retried: number }> {
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
      await markRetry(row, (err as Error).message || String(err));
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
