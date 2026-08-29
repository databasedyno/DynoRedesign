/**
 * Inbound Event Service — DB-level idempotency primitive (Tier-2 Item #4).
 *
 * `recordInbound()` attempts to INSERT one row per external provider event.
 * A UNIQUE(provider, provider_event_id) violation means we have already seen
 * this event => the caller should treat it as a duplicate and no-op.
 *
 * This is intentionally provider-agnostic so Tatum, Flutterwave, Veriff, Binance
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

export default { recordInbound, markProcessed, markFailed };
