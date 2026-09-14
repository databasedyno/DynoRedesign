/**
 * Payment State Machine
 *
 * Formalizes the payment lifecycle into a strict state machine with validated
 * transitions. Every status change in the system MUST go through this service
 * to ensure consistency and auditability.
 *
 * States:
 *   PENDING          – Payment created, awaiting blockchain transaction
 *   DETECTED         – Transaction seen on-chain (unconfirmed)
 *   CONFIRMING       – Blockchain confirmations in progress
 *   CONFIRMED        – Required confirmations reached
 *   UNDERPAID        – Partial payment received, waiting for remainder
 *   PROCESSING       – Settlement / forwarding in progress
 *   CONVERTED        – Auto-converted to stablecoin (optional path)
 *   PAYOUT_COMPLETE  – Funds delivered to merchant wallet
 *   FAILED           – Permanent failure after all retries
 *   EXPIRED          – Payment timed out or grace period lapsed
 *   REFUNDED         – Payment refunded to sender
 */

import { webhookLogs } from "../utils/loggers";

// ── State Enum ───────────────────────────────────────────────────────────────

export enum PaymentState {
  PENDING         = "pending",
  DETECTED        = "detected",
  CONFIRMING      = "confirming",
  CONFIRMED       = "confirmed",
  UNDERPAID       = "underpaid",
  PROCESSING      = "processing",
  CONVERTED       = "converted",
  PAYOUT_COMPLETE = "payout_complete",
  FAILED          = "failed",
  EXPIRED         = "expired",
  REFUNDED        = "refunded",
}

// ── Transition Map ───────────────────────────────────────────────────────────
// Key = current state, Value = set of states it can transition TO

const VALID_TRANSITIONS: Record<PaymentState, Set<PaymentState>> = {
  [PaymentState.PENDING]: new Set([
    PaymentState.DETECTED,
    PaymentState.PROCESSING,  // FIX BUG-4: Webhook flow skips DETECTED on fast-confirm chains
    PaymentState.UNDERPAID,   // FIX BUG-4: Partial payments go directly to UNDERPAID
    PaymentState.EXPIRED,
    PaymentState.FAILED,
  ]),
  [PaymentState.DETECTED]: new Set([
    PaymentState.CONFIRMING,
    PaymentState.CONFIRMED,
    PaymentState.PROCESSING,  // fast-confirm chains skip CONFIRMING
    PaymentState.UNDERPAID,
    PaymentState.FAILED,
  ]),
  [PaymentState.CONFIRMING]: new Set([
    PaymentState.CONFIRMED,
    PaymentState.FAILED,
  ]),
  [PaymentState.CONFIRMED]: new Set([
    PaymentState.PROCESSING,
    PaymentState.CONVERTED,
    PaymentState.FAILED,
  ]),
  [PaymentState.UNDERPAID]: new Set([
    PaymentState.DETECTED,   // completion payment arrives
    PaymentState.PROCESSING, // direct-API: process with partial amount
    PaymentState.EXPIRED,    // grace period lapsed
    PaymentState.FAILED,
  ]),
  [PaymentState.PROCESSING]: new Set([
    PaymentState.PROCESSING,      // Allow retry/re-processing (e.g., after OUT_OF_ENERGY recovery)
    PaymentState.PAYOUT_COMPLETE,
    PaymentState.CONVERTED,
    PaymentState.FAILED,
  ]),
  [PaymentState.CONVERTED]: new Set([
    PaymentState.PAYOUT_COMPLETE,
    PaymentState.FAILED,
  ]),
  // Terminal states — no outgoing transitions (except refund from payout_complete)
  [PaymentState.PAYOUT_COMPLETE]: new Set([
    PaymentState.PAYOUT_COMPLETE,  // FIX BUG-5: Idempotent self-transition (reconciliation + webhook race)
    PaymentState.REFUNDED,
  ]),
  [PaymentState.FAILED]:   new Set(),
  [PaymentState.EXPIRED]:  new Set(),
  [PaymentState.REFUNDED]: new Set(),
};

// ── Terminal helpers ─────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set<PaymentState>([
  PaymentState.PAYOUT_COMPLETE,
  PaymentState.FAILED,
  PaymentState.EXPIRED,
  PaymentState.REFUNDED,
]);

// ── Transition record ────────────────────────────────────────────────────────

export interface TransitionRecord {
  from: PaymentState;
  to: PaymentState;
  timestamp: string;       // ISO-8601
  paymentId: string;       // unique identifier for this payment
  reason?: string;         // human-readable reason
  metadata?: Record<string, unknown>;
}

// ── Error class ──────────────────────────────────────────────────────────────

export class InvalidTransitionError extends Error {
  public readonly from: PaymentState;
  public readonly to: PaymentState;
  public readonly paymentId: string;

  constructor(from: PaymentState, to: PaymentState, paymentId: string) {
    super(
      `Invalid state transition: ${from} → ${to} for payment ${paymentId}. ` +
      `Allowed transitions from '${from}': [${[...(VALID_TRANSITIONS[from] || [])].join(", ")}]`
    );
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
    this.paymentId = paymentId;
  }
}

// ── Core API ─────────────────────────────────────────────────────────────────

/**
 * Validate whether a transition from `currentState` to `nextState` is allowed.
 * Returns true if valid, false otherwise.
 */
export function canTransition(currentState: PaymentState, nextState: PaymentState): boolean {
  const allowed = VALID_TRANSITIONS[currentState];
  if (!allowed) return false;
  return allowed.has(nextState);
}

/**
 * Attempt a state transition. Throws `InvalidTransitionError` if the
 * transition is not allowed by the state machine.
 *
 * Returns a `TransitionRecord` for audit logging.
 */
export function transition(
  currentState: PaymentState,
  nextState: PaymentState,
  paymentId: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): TransitionRecord {
  if (!canTransition(currentState, nextState)) {
    throw new InvalidTransitionError(currentState, nextState, paymentId);
  }

  const record: TransitionRecord = {
    from: currentState,
    to: nextState,
    timestamp: new Date().toISOString(),
    paymentId,
    reason,
    metadata,
  };

  webhookLogs.info(
    `[StateMachine] ${paymentId}: ${currentState} → ${nextState}` +
    (reason ? ` (${reason})` : "")
  );

  // Emit SSE event for real-time payment updates
  try {
    const sseService = require("./sseService");
    if (metadata?.user_id) {
      sseService.emitPaymentUpdate(metadata.user_id as number, {
        transaction_id: paymentId,
        status: toExternalStatus(nextState),
        payment_status: nextState,
        amount: metadata?.amount as number | undefined,
        currency: metadata?.currency as string | undefined,
      });
    }
    // Also broadcast to the 'payments' channel
    sseService.sendToChannel("payments", "payment_status_change", {
      transaction_id: paymentId,
      from: toExternalStatus(currentState),
      to: toExternalStatus(nextState),
      timestamp: record.timestamp,
    });
  } catch (sseErr) {
    // SSE is best-effort, never block payment processing
  }

  return record;
}

/**
 * Returns all states reachable from the given state.
 */
export function getAllowedTransitions(state: PaymentState): PaymentState[] {
  const allowed = VALID_TRANSITIONS[state];
  return allowed ? [...allowed] : [];
}

/**
 * Returns true if the state is terminal (no outgoing transitions, or only
 * refund from payout_complete).
 */
export function isTerminal(state: PaymentState): boolean {
  return TERMINAL_STATES.has(state);
}

/**
 * Parse a raw status string (from Redis or DB) into a PaymentState enum value.
 * Returns undefined if the string is not a recognized state.
 */
export function parseState(raw: string | undefined | null): PaymentState | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().trim();

  // Direct match
  const values = Object.values(PaymentState) as string[];
  if (values.includes(normalized)) {
    return normalized as PaymentState;
  }

  // Legacy aliases (map old ad-hoc statuses to formal states)
  const LEGACY_MAP: Record<string, PaymentState> = {
    successful:       PaymentState.PAYOUT_COMPLETE,
    completed:        PaymentState.PAYOUT_COMPLETE,
    recovered:        PaymentState.PAYOUT_COMPLETE,
    done:             PaymentState.PAYOUT_COMPLETE,
    retrying:         PaymentState.PROCESSING,
    pending_deposit:  PaymentState.PENDING,
    paid:             PaymentState.DETECTED,
    incomplete:       PaymentState.UNDERPAID,
  };

  return LEGACY_MAP[normalized];
}

// ── External Compatibility Layer ─────────────────────────────────────────────
// Maps formal PaymentState → legacy status strings that merchants already
// handle in their integrations. This ensures ZERO breaking changes for any
// developer who has integrated our payment gateway.

/**
 * Convert internal PaymentState to the legacy Redis status string.
 * This is what gets stored in Redis and read by the verify endpoint.
 */
export function toRedisStatus(state: PaymentState): string {
  const REDIS_MAP: Record<PaymentState, string> = {
    [PaymentState.PENDING]:         "pending",
    [PaymentState.DETECTED]:        "pending",
    [PaymentState.CONFIRMING]:      "processing",
    [PaymentState.CONFIRMED]:       "processing",
    [PaymentState.UNDERPAID]:       "underpaid",
    [PaymentState.PROCESSING]:      "processing",
    [PaymentState.CONVERTED]:       "successful",
    [PaymentState.PAYOUT_COMPLETE]: "successful",
    [PaymentState.FAILED]:          "failed",
    [PaymentState.EXPIRED]:         "failed",
    [PaymentState.REFUNDED]:        "successful",
  };
  return REDIS_MAP[state];
}

/**
 * Convert internal PaymentState to the external API status string.
 * This is what merchants see in the verify endpoint response and callback URLs.
 */
export function toExternalStatus(state: PaymentState): string {
  const EXTERNAL_MAP: Record<PaymentState, string> = {
    [PaymentState.PENDING]:         "waiting",
    [PaymentState.DETECTED]:        "pending",
    [PaymentState.CONFIRMING]:      "pending",
    [PaymentState.CONFIRMED]:       "confirmed",
    [PaymentState.UNDERPAID]:       "underpaid",
    [PaymentState.PROCESSING]:      "processing",
    [PaymentState.CONVERTED]:       "settled",
    [PaymentState.PAYOUT_COMPLETE]: "settled",
    [PaymentState.FAILED]:          "failed",
    [PaymentState.EXPIRED]:         "expired",
    [PaymentState.REFUNDED]:        "refunded",
  };
  return EXTERNAL_MAP[state];
}

/**
 * Convert internal PaymentState to the webhook event name.
 * This is what merchants see in the X-DynoPay-Event header.
 * 
 * Webhook events:
 *   payment.pending           — crypto detected at temp address
 *   payment.confirmed         — crypto confirmed on-chain (before settlement)
 *   payment.settled           — crypto delivered to merchant wallet
 *   payment.underpaid         — amount received is less than expected
 *   payment.settlement_failed — settlement failed but crypto was received
 */
export function toWebhookEvent(state: PaymentState): string | null {
  const EVENT_MAP: Partial<Record<PaymentState, string>> = {
    [PaymentState.PENDING]:         "payment.pending",
    [PaymentState.DETECTED]:        "payment.pending",
    [PaymentState.CONFIRMED]:       "payment.confirmed",
    [PaymentState.PAYOUT_COMPLETE]: "payment.settled",
    [PaymentState.UNDERPAID]:       "payment.underpaid",
    [PaymentState.FAILED]:          "payment.settlement_failed",
  };
  return EVENT_MAP[state] || null;
}

/**
 * Soft-enforcement transition validator. Validates the state transition and
 * logs an audit record, but does NOT throw on invalid transitions — instead
 * it returns `{ valid: false }` so the caller can decide how to handle it.
 *
 * Use this when wiring the state machine into existing code paths where
 * throwing would break the payment flow.
 */
export function validateTransition(
  currentState: PaymentState,
  nextState: PaymentState,
  paymentId: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): { valid: boolean; record?: TransitionRecord; error?: string } {
  if (canTransition(currentState, nextState)) {
    const record = transition(currentState, nextState, paymentId, reason, metadata);
    return { valid: true, record };
  }

  const error =
    `Invalid state transition: ${currentState} → ${nextState} for payment ${paymentId}. ` +
    `Allowed: [${getAllowedTransitions(currentState).join(", ")}]`;

  webhookLogs.warn(`[StateMachine] SOFT REJECT: ${error}`);

  return { valid: false, error };
}

/**
 * Get the full transition map (for diagnostics / admin endpoints).
 */
export function getTransitionMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [state, targets] of Object.entries(VALID_TRANSITIONS)) {
    map[state] = [...targets];
  }
  return map;
}

/**
 * All defined payment states.
 */
export const ALL_STATES = Object.values(PaymentState);

// ── Auto-Conversion Status Mapping ───────────────────────────────────────────
// Maps raw DB conversion statuses (tbl_stablecoin_conversion.status) to
// merchant-facing display statuses. Keeps raw `status` for backward compat;
// the new `display_status` is the normalized version.

const CONVERSION_DISPLAY_MAP: Record<string, string> = {
  PENDING_DEPOSIT:   "pending",
  DEPOSIT_CREDITED:  "processing",
  CONVERTING:        "converting",
  CONVERTED:         "converted",
  WITHDRAWING:       "settling",
  COMPLETED:         "settled",
  FAILED:            "failed",
};

/**
 * Convert raw DB auto-conversion status to a merchant-facing display status.
 * Returns the normalized string, or the raw input (lowercased) if unknown.
 */
export function toConversionDisplayStatus(rawDbStatus: string | null | undefined): string {
  if (!rawDbStatus) return "unknown";
  return CONVERSION_DISPLAY_MAP[rawDbStatus.toUpperCase()] ?? rawDbStatus.toLowerCase();
}


// ── Persisted (audited) transitions ──────────────────────────────────────────

export interface PersistTransitionParams {
  paymentId: string;
  from?: PaymentState | string | null;
  to: PaymentState | string;
  event: string;
  actor?: string;
  txId?: string | null;
  address?: string | null;
  currency?: string | null;
  amount?: number | null;
  companyId?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * THE single audited gateway for payment state changes (tbl_payment_journal).
 * Every state write must call this so no transition goes unrecorded.
 * Invalid transitions are journaled with `state_machine_valid: false` instead
 * of throwing — the audit trail must never break the money path.
 */
export async function persistTransition(p: PersistTransitionParams): Promise<void> {
  try {
    const fromState = typeof p.from === "string" ? parseState(p.from) : p.from ?? undefined;
    const toState = typeof p.to === "string" ? parseState(p.to) : p.to;

    let machineValid: boolean | undefined;
    if (fromState && toState) {
      machineValid = fromState === toState || canTransition(fromState, toState);
      if (!machineValid) {
        webhookLogs.warn(
          `[StateMachine] ⚠️ AUDIT VIOLATION: ${fromState} → ${toState} for ${p.paymentId} ` +
          `(event=${p.event}, actor=${p.actor || "unknown"}) — journaled with violation flag`
        );
      }
    }

    // Lazy require avoids a module cycle with paymentReliability.
    const { journalStateTransition } = require("./paymentReliability");
    await journalStateTransition({
      paymentId: p.paymentId,
      txId: p.txId ?? null,
      address: p.address ?? "",
      currency: p.currency ?? "",
      event: p.event,
      fromState: p.from != null ? String(p.from) : null,
      toState: String(p.to),
      amount: p.amount ?? null,
      companyId: p.companyId ?? null,
      metadata: {
        ...(p.metadata || {}),
        ...(p.actor ? { actor: p.actor } : {}),
        ...(machineValid === undefined ? {} : { state_machine_valid: machineValid }),
      },
    });
  } catch (err) {
    webhookLogs.warn(`[StateMachine] persistTransition failed for ${p.paymentId}: ${(err as Error).message}`);
  }
}
