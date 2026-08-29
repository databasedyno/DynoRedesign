/**
 * Merchant Webhook Outbox — cutover entrypoint (Tier-2 Item #10).
 *
 * Single delivery seam for ALL merchant-facing webhook events
 * (payment.pending / .confirmed / .underpaid / .settled / .settlement_failed
 *  and the opt-in .created / .expired / .overpaid).
 *
 *   ENABLE_OUTBOX on  → enqueue a durable `merchant.webhook` row into tbl_outbox;
 *                       the relay (worker) delivers it via the registered
 *                       dispatcher (services/outbox/outboxDispatchers.ts).
 *                       The outbox is then the SINGLE source of delivery.
 *   ENABLE_OUTBOX off → call `callMerchantWebhook(...)` directly, byte-for-byte
 *                       the same behaviour as before the cutover (prod default).
 *
 * The enqueue is idempotent per (event, payment_id, txId) so repeated emit
 * points (checkout polling, reconciliation, retries) collapse to one delivery.
 * Never throws — a webhook must never break payment processing. If the enqueue
 * itself fails it falls back to a direct call so no event is silently dropped.
 */

import type { Transaction } from "sequelize";
import { bool as envBool } from "../../utils/config";
import { webhookLogs } from "../../utils/loggers";

export const MERCHANT_WEBHOOK_EVENT_TYPE = "merchant.webhook";

export interface DeliverMerchantWebhookOpts {
  /** Participate in the caller's unit of work (settlement ledger commit). */
  transaction?: Transaction;
  /** Override the idempotency suffix; defaults to `${event}:${paymentId}:${txId}`. */
  dedupKey?: string;
}

export interface DeliverMerchantWebhookResult {
  mode: "outbox" | "direct";
  success: boolean;
  error?: string;
}

/** Lazy require breaks the webhooks/index.ts <-> outbox import cycle. */
function directDeliver(
  customerData: Record<string, unknown>,
  eventData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const { callMerchantWebhook } = require("../../webhooks");
  return callMerchantWebhook(customerData, eventData);
}

/**
 * Deliver a merchant webhook — through the outbox when ENABLE_OUTBOX is on,
 * otherwise directly. Drop-in replacement for `callMerchantWebhook(...)`.
 */
export async function deliverMerchantWebhook(
  customerData: Record<string, unknown>,
  eventData: Record<string, unknown> & { event?: string },
  opts: DeliverMerchantWebhookOpts = {}
): Promise<DeliverMerchantWebhookResult> {
  if (envBool("ENABLE_OUTBOX")) {
    try {
      const event = String(eventData?.event ?? "unknown");
      const pid = String(
        eventData?.payment_id ?? customerData?.payment_id ?? customerData?.ref ?? "no-pid"
      );
      const tx = String(eventData?.txId ?? eventData?.transaction_reference ?? "no-tx");
      const suffix = opts.dedupKey ?? `${event}:${pid}:${tx}`;
      // Lazy require so the flag-OFF path (prod default) never loads the outbox
      // DB-model chain — keeps behaviour byte-identical to the pre-cutover code.
      const { enqueueOutbox } = require("./outboxService");
      await enqueueOutbox(
        {
          aggregateType: "payment",
          aggregateId: pid,
          eventType: MERCHANT_WEBHOOK_EVENT_TYPE,
          payload: { customerData, eventData },
          correlationId: pid,
          eventId: `webhook:${suffix}`,
        },
        { transaction: opts.transaction }
      );
      return { mode: "outbox", success: true };
    } catch (err) {
      // Enqueue must never break payment processing — fall back to a direct send
      // so the event is not lost while ENABLE_OUTBOX is being validated.
      webhookLogs.error(
        `[merchantWebhookOutbox] enqueue failed for ${String(eventData?.event)} — ` +
          `falling back to direct delivery: ${(err as Error).message}`
      );
    }
  }

  try {
    const r = await directDeliver(customerData, eventData);
    return { mode: "direct", success: !!r?.success, error: r?.error };
  } catch (err) {
    webhookLogs.error(`[merchantWebhookOutbox] direct delivery threw: ${(err as Error).message}`);
    return { mode: "direct", success: false, error: (err as Error).message };
  }
}

export default { MERCHANT_WEBHOOK_EVENT_TYPE, deliverMerchantWebhook };
