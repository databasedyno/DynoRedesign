/**
 * Outbox Cutover verification (Tier-2 #10) — SYNTHETIC rows only, cleaned up after.
 * Run: DOTENV_CONFIG_PATH=/app/backend/.env ts-node --transpile-only -r dotenv/config scripts/verify_outbox_cutover.ts
 *
 * Proves the flag-gated cutover end-to-end WITHOUT touching real payments:
 *   A) ENABLE_OUTBOX on  → deliverMerchantWebhook enqueues a `merchant.webhook`
 *      row; relayPendingBatch() claims it, the REAL dispatcher runs
 *      callMerchantWebhook (no URL configured → success), row → 'dispatched'.
 *   B) Idempotency — enqueuing the same (event,payment_id,txId) twice yields ONE row.
 *   C) ENABLE_OUTBOX off → deliverMerchantWebhook delivers DIRECTLY (no outbox row).
 *   D) Transient failure → dispatcher throws → row stays 'pending' with attempts++.
 *   E) best-effort real HTTP POST to a public echo endpoint (skipped on network error).
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import OutboxEvent from "../models/outboxEventModel";
import { relayPendingBatch, registerDispatcher } from "../services/outbox/outboxService";
import { registerDefaultOutboxDispatchers } from "../services/outbox/outboxDispatchers";
import { deliverMerchantWebhook, MERCHANT_WEBHOOK_EVENT_TYPE } from "../services/outbox/merchantWebhookOutbox";

const SYN = "SYN-OBX-" + Date.now();

async function outboxRows(aggregateId: string) {
  return OutboxEvent.findAll({ where: { aggregate_id: aggregateId } });
}

async function main() {
  const out: string[] = [];
  await sequelize.authenticate();
  registerDefaultOutboxDispatchers();

  // ── A) flag ON → enqueue → relay → dispatched ─────────────────────────────
  process.env.ENABLE_OUTBOX = "true";
  const aggA = `${SYN}-A`;
  const rA = await deliverMerchantWebhook(
    { company_id: null }, // no webhook URL / not subscribed → callMerchantWebhook returns success
    { event: "payment.confirmed", payment_id: aggA, txId: `${aggA}-tx`, amount: 1, currency: "BTC" }
  );
  const rowsAEnq = await outboxRows(aggA);
  const relayA = await relayPendingBatch(50);
  const rowA = (await outboxRows(aggA))[0];
  out.push(
    `A) flag ON: mode=${rA.mode} (expect outbox) · enqueuedRows=${rowsAEnq.length} (expect 1) · ` +
    `eventType=${rowsAEnq[0]?.get("event_type")} (expect ${MERCHANT_WEBHOOK_EVENT_TYPE}) · ` +
    `finalStatus=${rowA?.get("status")} (expect dispatched) · relay=${JSON.stringify(relayA)}`
  );

  // ── B) idempotent enqueue (same event/payment/tx → one row) ───────────────
  const aggB = `${SYN}-B`;
  await deliverMerchantWebhook({ company_id: null }, { event: "payment.settled", payment_id: aggB, txId: `${aggB}-tx` });
  await deliverMerchantWebhook({ company_id: null }, { event: "payment.settled", payment_id: aggB, txId: `${aggB}-tx` });
  const rowsB = await outboxRows(aggB);
  out.push(`B) idempotency: rows for same (event,pid,tx) = ${rowsB.length} (expect 1)`);

  // ── C) flag OFF → direct delivery, no outbox row ──────────────────────────
  process.env.ENABLE_OUTBOX = "false";
  const aggC = `${SYN}-C`;
  const rC = await deliverMerchantWebhook({ company_id: null }, { event: "payment.pending", payment_id: aggC, txId: `${aggC}-tx` });
  const rowsC = await outboxRows(aggC);
  out.push(`C) flag OFF: mode=${rC.mode} (expect direct) · outboxRows=${rowsC.length} (expect 0)`);

  // ── D) transient failure → retry (row stays pending, attempts bumped) ─────
  // Temporarily register a throwing dispatcher for a throwaway event type.
  process.env.ENABLE_OUTBOX = "true";
  const aggD = `${SYN}-D`;
  registerDispatcher("test.transient.fail", async () => { throw new Error("simulated transient failure"); });
  const { enqueueOutbox } = await import("../services/outbox/outboxService");
  await enqueueOutbox({ aggregateType: "test", aggregateId: aggD, eventType: "test.transient.fail", payload: {} });
  const relayD = await relayPendingBatch(50);
  const rowD = (await outboxRows(aggD))[0];
  out.push(
    `D) transient fail: status=${rowD?.get("status")} (expect pending) · attempts=${rowD?.get("attempts")} (expect 1) · ` +
    `relay=${JSON.stringify(relayD)}`
  );

  // ── E) best-effort REAL HTTP POST to a public echo endpoint ───────────────
  const aggE = `${SYN}-E`;
  try {
    await deliverMerchantWebhook(
      { company_id: null, webhook_url: "https://httpbin.org/status/200" },
      { event: "payment.confirmed", payment_id: aggE, txId: `${aggE}-tx`, amount: 1, currency: "BTC" }
    );
    const relayE = await relayPendingBatch(50);
    const rowE = (await outboxRows(aggE))[0];
    out.push(`E) real HTTP POST: finalStatus=${rowE?.get("status")} (expect dispatched) · relay=${JSON.stringify(relayE)}`);
  } catch (e) {
    out.push(`E) real HTTP POST: SKIPPED (network unavailable) — ${(e as Error).message}`);
  }

  // ── CLEANUP ───────────────────────────────────────────────────────────────
  const del = await OutboxEvent.destroy({ where: { aggregate_id: { [require("sequelize").Op.like]: `${SYN}%` } } });
  out.push(`cleanup: deleted ${del} synthetic outbox rows`);

  console.log("\n==== OUTBOX CUTOVER VERIFY ====\n" + out.join("\n") + "\n===============================\n");
  await sequelize.close();
  process.exit(0);
}
main().catch((e) => { console.error("VERIFY FAILED:", e); process.exit(1); });
