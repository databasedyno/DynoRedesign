/**
 * Opt-in merchant webhook events (Tier-1 audit item #2).
 *
 * The legacy events (payment.pending / .confirmed / .underpaid / .settled /
 * .settlement_failed) keep firing for every merchant exactly as before.
 *
 * The events added here are OPT-IN per company via `tbl_company.webhook_events`:
 *   NULL / []            → merchant receives only the legacy set (today's behavior)
 *   ["payment.created"]  → merchant also receives payment.created
 *
 * Rationale: utils/webhookRetry.ts auto-disables a merchant's endpoint after
 * repeated failures, so pushing brand-new event types at an integration that
 * cannot parse them could take their webhooks offline. Opt-in makes the rollout
 * zero-risk for existing merchants.
 */

import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { webhookLogs } from "../utils/loggers";
import { redis } from "../utils/redisInstance";

export const OPT_IN_WEBHOOK_EVENTS = [
  "payment.created",
  "payment.expired",
  "payment.overpaid",
] as const;

export type OptInWebhookEvent = (typeof OPT_IN_WEBHOOK_EVENTS)[number];

/** Always delivered — never filtered, so existing integrations are untouched. */
export const ALWAYS_ON_WEBHOOK_EVENTS = [
  "payment.pending",
  "payment.confirmed",
  "payment.underpaid",
  "payment.settled",
  "payment.settlement_failed",
  "webhook.test",
];

export function isOptInWebhookEvent(event: string): event is OptInWebhookEvent {
  return (OPT_IN_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

/** tbl_company.webhook_events can arrive as JSONB array or text — normalise both. */
export function parseSubscribedEvents(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Legacy events pass unconditionally; opt-in events require an explicit subscription. */
export function isEventSubscribed(subscribedRaw: unknown, event: string): boolean {
  if (!isOptInWebhookEvent(event)) return true;
  return parseSubscribedEvents(subscribedRaw).includes(event);
}

export async function getSubscribedEvents(companyId: number | string): Promise<string[]> {
  const rows = (await sequelize.query(
    `SELECT webhook_events FROM tbl_company WHERE company_id = :cid LIMIT 1`,
    { replacements: { cid: companyId }, type: QueryTypes.SELECT }
  )) as Array<{ webhook_events?: unknown }>;
  return parseSubscribedEvents(rows?.[0]?.webhook_events);
}

/**
 * Atomic once-only guard. Checkout polling and webhook retries hit the same
 * emit points repeatedly; without this a merchant would get duplicates.
 */
export async function claimEmitOnce(dedupKey: string, ttlSeconds = 86400): Promise<boolean> {
  try {
    const res = await redis.set(`wh-emit:${dedupKey}`, "1", { NX: true, EX: ttlSeconds });
    return res === "OK";
  } catch (err) {
    webhookLogs.warn(`[webhookEvents] dedup guard unavailable for ${dedupKey}: ${(err as Error).message}`);
    return true; // Redis down — prefer delivering over silently dropping
  }
}

interface EmitResult {
  emitted: boolean;
  reason?: "not_subscribed" | "duplicate" | "no_company" | "error";
}

/**
 * Deliver an opt-in event. Safe to call unconditionally — it is a no-op unless
 * the merchant subscribed. Never throws (webhooks must not break payments).
 */
export async function emitOptInWebhook(
  customerData: Record<string, unknown>,
  eventData: Record<string, unknown> & { event: OptInWebhookEvent },
  opts: { dedupKey: string; ttlSeconds?: number }
): Promise<EmitResult> {
  try {
    const companyId = customerData?.company_id;
    if (!companyId) {
      webhookLogs.info(`[webhookEvents] ${eventData.event} skipped — no company_id on payment`);
      return { emitted: false, reason: "no_company" };
    }

    const subscribed = await getSubscribedEvents(companyId as number);
    if (!subscribed.includes(eventData.event)) {
      return { emitted: false, reason: "not_subscribed" };
    }

    if (!(await claimEmitOnce(opts.dedupKey, opts.ttlSeconds))) {
      webhookLogs.info(`[webhookEvents] ${eventData.event} already emitted for ${opts.dedupKey} — skipping duplicate`);
      return { emitted: false, reason: "duplicate" };
    }

    // Lazy require breaks the webhooks/index.ts <-> webhookEvents.ts import cycle.
    const { callMerchantWebhook } = require("../webhooks");
    await callMerchantWebhook(customerData, {
      ...eventData,
      created_at: eventData.created_at || new Date().toISOString(),
    });
    webhookLogs.info(`[webhookEvents] ✅ ${eventData.event} delivered for company ${companyId} (${opts.dedupKey})`);
    return { emitted: true };
  } catch (err) {
    webhookLogs.error(`[webhookEvents] ${eventData.event} failed: ${(err as Error).message}`);
    return { emitted: false, reason: "error" };
  }
}

// ── Typed emitters ───────────────────────────────────────────────────────────

export async function emitPaymentCreated(
  customerData: Record<string, unknown>,
  fields: {
    payment_id: string;
    address?: string | null;
    amount?: number | string | null;
    currency?: string | null;
    base_amount?: number | string | null;
    base_currency?: string | null;
    link_id?: number | string | null;
    fee_payer?: string | null;
    destination_tag?: number | string | null;
    expires_at?: string | null;
  }
): Promise<EmitResult> {
  return emitOptInWebhook(
    customerData,
    {
      event: "payment.created",
      payment_type: fields.link_id ? "payment_link" : "direct_api",
      status: "created",
      payment_status: "created",
      ...fields,
    },
    { dedupKey: `created:${fields.payment_id}`, ttlSeconds: 86400 }
  );
}

export async function emitPaymentOverpaid(
  customerData: Record<string, unknown>,
  fields: {
    payment_id: string;
    address?: string | null;
    txId?: string | null;
    amount_received: number;
    amount_expected: number;
    excess_amount: number;
    excess_amount_usd: number;
    currency?: string | null;
    base_amount?: number | string | null;
    base_currency?: string | null;
    link_id?: number | string | null;
  }
): Promise<EmitResult> {
  return emitOptInWebhook(
    customerData,
    {
      event: "payment.overpaid",
      payment_type: fields.link_id ? "payment_link" : "direct_api",
      status: "overpaid",
      payment_status: "overpaid",
      transaction_reference: fields.txId || null,
      note: "Customer sent more than the requested amount. The payment is settled in full; the excess is credited as received.",
      ...fields,
    },
    { dedupKey: `overpaid:${fields.payment_id}`, ttlSeconds: 604800 }
  );
}

export async function emitPaymentExpired(
  customerData: Record<string, unknown>,
  fields: {
    payment_id: string;
    link_id?: number | string | null;
    base_amount?: number | string | null;
    base_currency?: string | null;
    link_type?: string | null;
    expires_at?: string | Date | null;
  }
): Promise<EmitResult> {
  return emitOptInWebhook(
    customerData,
    {
      event: "payment.expired",
      payment_type: fields.link_id ? "payment_link" : "direct_api",
      status: "expired",
      payment_status: "expired",
      expired_at: new Date().toISOString(),
      ...fields,
      expires_at: fields.expires_at ? new Date(fields.expires_at).toISOString() : null,
    },
    { dedupKey: `expired:${fields.link_id || fields.payment_id}`, ttlSeconds: 2592000 }
  );
}

export default {
  OPT_IN_WEBHOOK_EVENTS,
  ALWAYS_ON_WEBHOOK_EVENTS,
  isOptInWebhookEvent,
  isEventSubscribed,
  parseSubscribedEvents,
  getSubscribedEvents,
  claimEmitOnce,
  emitOptInWebhook,
  emitPaymentCreated,
  emitPaymentOverpaid,
  emitPaymentExpired,
};
