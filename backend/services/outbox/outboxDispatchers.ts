/**
 * Outbox Dispatchers — maps domain event_type -> side-effect (Tier-2 Item #10).
 *
 * CUTOVER (2026-06): the `merchant.webhook` dispatcher now performs the REAL
 * merchant webhook delivery. Every emit point in the settlement path routes
 * through services/outbox/merchantWebhookOutbox.ts::deliverMerchantWebhook,
 * which — when ENABLE_OUTBOX is on — enqueues a `merchant.webhook` row instead
 * of calling the merchant directly. The relay then drives THIS dispatcher, so
 * the outbox is the single source of delivery (no more dual-write). With
 * ENABLE_OUTBOX off (prod default) the direct call still fires and this
 * dispatcher is never exercised, so the cutover is fully reversible by flag.
 *
 * The `payment.detected` / `payment.settled` dispatchers stay OBSERVABILITY-ONLY
 * — those are the internal LEDGER events (ledgerPaymentMapper) enqueued
 * atomically with the ledger batch; they are NOT merchant webhooks.
 *
 * Registering happens once at boot (registerDefaultOutboxDispatchers), guarded
 * so it is a no-op unless ENABLE_OUTBOX is set.
 */

import { registerDispatcher } from "./outboxService";
import { MERCHANT_WEBHOOK_EVENT_TYPE } from "./merchantWebhookOutbox";
import { cronLogger, webhookLogs } from "../../utils/loggers";

let registered = false;

// A failed delivery here is thrown so the relay retries with backoff. But a
// permanently-skipped endpoint (merchant disabled it, localhost, auto-disabled)
// must NOT be retried forever — mark it dispatched instead.
const PERMANENT_SKIP = /disabled|localhost|unreachable/i;

export function registerDefaultOutboxDispatchers(): void {
  if (registered) return;
  registered = true;

  const logOnly = (label: string) => async (evt: {
    eventId: string; aggregateId: string; eventType: string; correlationId: string | null;
  }) => {
    cronLogger.info(
      `[Outbox:${label}] dispatched event=${evt.eventId} aggregate=${evt.aggregateId} ` +
      `type=${evt.eventType} corr=${evt.correlationId ?? "-"} (observability-only)`
    );
  };

  // Internal ledger events — observability only (NOT merchant webhooks).
  registerDispatcher("payment.detected", logOnly("payment.detected"));
  registerDispatcher("payment.settled", logOnly("payment.settled"));

  // Real merchant webhook delivery — the cutover target.
  registerDispatcher(MERCHANT_WEBHOOK_EVENT_TYPE, async (evt) => {
    const payload = (evt.payload || {}) as {
      customerData?: Record<string, unknown>;
      eventData?: Record<string, unknown>;
    };
    const customerData = payload.customerData || {};
    const eventData = payload.eventData || {};
    const eventName = String((eventData as { event?: string }).event ?? "unknown");

    // Lazy require breaks the webhooks/index.ts <-> outbox import cycle.
    const { callMerchantWebhook } = require("../../webhooks");
    const result = await callMerchantWebhook(customerData, eventData);

    if (result?.success) {
      webhookLogs.info(
        `[Outbox:merchant.webhook] delivered event=${evt.eventId} (${eventName}) aggregate=${evt.aggregateId}`
      );
      return; // delivered, or legitimately skipped (no URL / not subscribed)
    }

    const err = String(result?.error || "unknown webhook delivery error");
    if (PERMANENT_SKIP.test(err)) {
      webhookLogs.warn(
        `[Outbox:merchant.webhook] permanent skip event=${evt.eventId} (${eventName}): ${err}`
      );
      return; // do not retry a disabled/localhost endpoint forever
    }

    // Transient failure — throw so the relay retries with exponential backoff.
    throw new Error(`merchant webhook delivery failed (${eventName}): ${err}`);
  });
}

export default { registerDefaultOutboxDispatchers };
