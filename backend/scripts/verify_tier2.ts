/**
 * Tier-2 (#4/#8/#10) verification — SYNTHETIC rows only, cleaned up after.
 * Run: DOTENV_CONFIG_PATH=/app/backend/.env ts-node --transpile-only -r dotenv/config scripts/verify_tier2.ts
 * Does NOT touch any real payment / wallet / ledger data.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import InboundEvent from "../models/inboundEventModel";
import OutboxEvent from "../models/outboxEventModel";
import KeyAccessAudit from "../models/keyAccessAuditModel";
import { recordInbound } from "../services/idempotency/inboundEventService";
import { enqueueOutbox, registerDispatcher, relayPendingBatch } from "../services/outbox/outboxService";

async function main() {
  const out: string[] = [];
  await sequelize.authenticate();

  const tables = (await sequelize.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('tbl_inbound_events','tbl_outbox','tbl_key_access_audit')
      ORDER BY table_name`,
    { type: QueryTypes.SELECT }
  )) as Array<{ table_name: string }>;
  out.push("tables present: " + tables.map((t) => t.table_name).join(", "));

  const idx = (await sequelize.query(
    `SELECT indexname FROM pg_indexes WHERE tablename='tbl_inbound_events'`,
    { type: QueryTypes.SELECT }
  )) as Array<{ indexname: string }>;
  out.push("inbound indexes: " + idx.map((i) => i.indexname).join(", "));

  // #4 idempotency
  const eid = "TEST-EVT-" + Date.now();
  const r1 = await recordInbound({ provider: "tatum", providerEventId: eid, payload: { t: 1 } });
  const r2 = await recordInbound({ provider: "tatum", providerEventId: eid, payload: { t: 2 } });
  out.push(`#4 dedup: first.isNew=${r1.isNew} second.isNew=${r2.isNew}  (expect true, false)`);

  // #10 outbox enqueue -> relay -> dispatch
  let dispatched = 0;
  registerDispatcher("test.event", async () => { dispatched++; });
  const agg = "TEST-AGG-" + Date.now();
  const enq = await enqueueOutbox({
    aggregateType: "test", aggregateId: agg, eventType: "test.event",
    payload: { hello: "world" }, correlationId: "test-corr",
  });
  const relay = await relayPendingBatch(10);
  const row = await OutboxEvent.findOne({ where: { aggregate_id: agg } });
  out.push(`#10 outbox: enqueued=${enq.created} relay=${JSON.stringify(relay)} dispatched=${dispatched} finalStatus=${row?.status}  (expect created=true, dispatched=1, status=dispatched)`);

  // #8 audit table write (synthetic — no real key touched)
  const audit = await KeyAccessAudit.create({
    key_ref_hash: "deadbeefTEST", key_id: "TEST", purpose: "verify",
    actor: "verify-script", success: true, error: null,
  } as never);
  out.push(`#8 key_access_audit insert ok id=${(audit as { id: number }).id}`);

  // CLEANUP
  const c1 = await InboundEvent.destroy({ where: { provider_event_id: eid } });
  const c2 = await OutboxEvent.destroy({ where: { aggregate_id: agg } });
  const c3 = await KeyAccessAudit.destroy({ where: { id: (audit as { id: number }).id } });
  out.push(`cleanup: inbound=${c1} outbox=${c2} audit=${c3}`);

  console.log("\n==== TIER-2 VERIFY ====\n" + out.join("\n") + "\n=======================\n");
  await sequelize.close();
  process.exit(0);
}
main().catch((e) => { console.error("VERIFY FAILED:", e); process.exit(1); });
