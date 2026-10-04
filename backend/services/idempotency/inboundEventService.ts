/**
 * Inbound Event Service — DB-level idempotency primitive (Tier-2 Item #4).
 *
 * `recordInbound()` attempts to INSERT one row per external provider event.
 * A UNIQUE(provider, provider_event_id) violation means we have already seen
 * this event => the caller should treat it as a duplicate and no-op.
 *
 * This is intentionally provider-agnostic so Tatum, Veriff, Binance
 * etc. can all share the same "exactly once" guarantee.
 */

import InboundEvent from "../../models/inboundEventModel";
import { webhookLogs } from "../../utils/loggers";

export interface RecordInboundInput {
  provider: string;
  providerEventId: string;
  eventType?: string | null;
  paymentId?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface RecordInboundResult {
  isNew: boolean;   // false => duplicate (already processed / in flight)
  id?: number;
}

const UNIQUE_ERR = /tbl_inbound_events_provider_evt_uq|unique constraint|duplicate key/i;

/**
 * Robustly detect a unique-violation across Sequelize dialects.
 * Sequelize wraps it as SequelizeUniqueConstraintError whose `.message` is the
 * GENERIC "Validation error" — so we must also check the error name and the
 * underlying Postgres SQLSTATE 23505 (unique_violation), not just the message.
 */
function isUniqueViolation(err: unknown): boolean {
  const e = err as {
    name?: string;
    message?: string;
    original?: { code?: string; message?: string };
    parent?: { code?: string; message?: string };
  };
  if (e?.name === "SequelizeUniqueConstraintError") return true;
  if (e?.original?.code === "23505" || e?.parent?.code === "23505") return true;
  return (
    UNIQUE_ERR.test(e?.message || "") ||
    UNIQUE_ERR.test(e?.original?.message || "") ||
    UNIQUE_ERR.test(e?.parent?.message || "")
  );
}

/**
 * Record an inbound event. Returns { isNew:false } if it already exists.
 * Never throws on a duplicate — that is the whole point.
 */
export async function recordInbound(input: RecordInboundInput): Promise<RecordInboundResult> {
  if (!input.provider || !input.providerEventId) {
    // Cannot dedup without a stable id — let the caller proceed (fail-open),
    // the downstream Redis/DB guards still apply.
    return { isNew: true };
  }
  try {
    const row = await InboundEvent.create({
      provider: input.provider,
      provider_event_id: String(input.providerEventId).slice(0, 191),
      event_type: input.eventType ?? null,
      payment_id: input.paymentId ?? null,
      payload: input.payload ?? null,
      status: "received",
      error: null,
      processed_at: null,
    });
    return { isNew: true, id: row.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      webhookLogs.info(
        `[InboundEvent] duplicate ${input.provider}:${input.providerEventId} — skipping (idempotent)`
      );
      return { isNew: false };
    }
    // Unknown DB error — fail-open so we never drop a real event on infra hiccups.
    webhookLogs.warn(`[InboundEvent] record failed (fail-open): ${(err as Error).message}`);
    return { isNew: true };
  }
}

export async function markProcessed(id: number): Promise<void> {
  try {
    await InboundEvent.update(
      { status: "processed", processed_at: new Date() },
      { where: { id } }
    );
  } catch { /* best-effort observability write */ }
}

export async function markFailed(id: number, error: string): Promise<void> {
  try {
    await InboundEvent.update(
      { status: "failed", error: String(error).slice(0, 2000), processed_at: new Date() },
      { where: { id } }
    );
  } catch { /* best-effort */ }
}

/** Receiver-level drop (duplicate / outgoing tx / unknown asset) — nothing to process. */
export async function markSkipped(id: number, reason: string): Promise<void> {
  try {
    await InboundEvent.update(
      { status: "skipped", error: String(reason).slice(0, 2000), processed_at: new Date() },
      { where: { id } }
    );
  } catch { /* best-effort */ }
}

/**
 * Age out inbound-event rows left in 'received' with no processed_at — i.e. ones
 * the worker or a receiver-level skip never finalized (e.g. rows that pre-dated
 * the markProcessed/markSkipped wiring: prod sweep 2026-10 found 531 frozen
 * ADDRESS_EVENT rows from 2026-08-29→09-29, none newer, polluting the
 * "unprocessed backlog" metric). Marks them 'skipped' with a reason so the
 * backlog reflects reality. Idempotent, bounded, best-effort; returns the count.
 */
export async function reconcileStaleReceivedInboundEvents(maxAgeHours = 24): Promise<number> {
  try {
    const sequelize = (await import("../../utils/dbInstance")).default;
    const { QueryTypes } = await import("sequelize");
    const rows = (await sequelize.query(
      `UPDATE tbl_inbound_events
          SET status = 'skipped',
              processed_at = NOW(),
              error = COALESCE(error, 'auto-reconciled: stale ''received'' — never finalized within ' || :h || 'h')
        WHERE status = 'received'
          AND processed_at IS NULL
          AND received_at < NOW() - (:h || ' hours')::interval
        RETURNING id`,
      { replacements: { h: maxAgeHours }, type: QueryTypes.SELECT }
    )) as Array<{ id: number }>;
    const affected = Array.isArray(rows) ? rows.length : 0;
    if (affected > 0) {
      webhookLogs.info(`[InboundEvent] reconciled ${affected} stale 'received' row(s) older than ${maxAgeHours}h → skipped`);
    }
    return affected;
  } catch (err) {
    webhookLogs.warn(`[InboundEvent] stale reconcile failed (best-effort): ${(err as Error).message}`);
    return 0;
  }
}

export default { recordInbound, markProcessed, markFailed, markSkipped, reconcileStaleReceivedInboundEvents };
