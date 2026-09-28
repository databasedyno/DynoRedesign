#!/usr/bin/env ts-node --transpile-only
/**
 * Recent Payments + Anomaly snapshot against the LIVE production DB.
 * Read-only. Run: cd /app/backend && npx ts-node --transpile-only scripts/recent_payments_report.ts
 */
import dotenv from "dotenv";
dotenv.config();
import { Sequelize, QueryTypes } from "sequelize";

const seq = new Sequelize(process.env.DATABASE_URL!, {
  dialect: "postgres",
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

async function q<T = any>(sql: string): Promise<T[]> {
  return (await seq.query(sql, { type: QueryTypes.SELECT })) as T[];
}

function fmt(v: any, n = 18) {
  const s = v === null || v === undefined ? "" : String(v);
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

async function main() {
  await seq.authenticate();
  const now = await q<{ now: string }>("SELECT NOW() as now");
  console.log(`\n=== LIVE DB TIME: ${now[0].now} ===`);

  // 25 most recent payments
  console.log(`\n================ 25 MOST RECENT PAYMENTS (tbl_customer_transaction) ================`);
  const recent = await q<any>(
    `SELECT transaction_id, company_id, payment_mode, base_amount, base_currency,
            paid_amount, paid_currency, transaction_type, status,
            "createdAt", "updatedAt"
     FROM tbl_customer_transaction
     ORDER BY "createdAt" DESC LIMIT 25`
  );
  console.log(
    fmt("created", 22) + fmt("txid", 20) + fmt("mode", 10) + fmt("base", 16) +
    fmt("paid", 16) + fmt("type", 12) + "status"
  );
  console.log("-".repeat(120));
  for (const r of recent) {
    console.log(
      fmt(new Date(r.createdAt).toISOString(), 22) +
      fmt(r.transaction_id, 20) +
      fmt(r.payment_mode, 10) +
      fmt(`${r.base_amount ?? ""} ${r.base_currency ?? ""}`.trim(), 16) +
      fmt(`${r.paid_amount ?? ""} ${r.paid_currency ?? ""}`.trim(), 16) +
      fmt(r.transaction_type, 12) +
      (r.status ?? "")
    );
  }

  // Volume windows
  console.log(`\n================ ACTIVITY WINDOWS ================`);
  for (const [label, intv] of [["last 1h", "1 hour"], ["last 24h", "24 hours"], ["last 7d", "7 days"], ["last 30d", "30 days"]]) {
    const c = await q<{ cnt: string }>(
      `SELECT COUNT(*) cnt FROM tbl_customer_transaction WHERE "createdAt" > NOW() - INTERVAL '${intv}'`
    );
    console.log(`  ${label.padEnd(10)}: ${c[0].cnt} payment(s) created`);
  }

  // Status distribution (all-time + 7d)
  console.log(`\n================ STATUS DISTRIBUTION (all-time) ================`);
  const dist = await q<{ status: string; cnt: string }>(
    `SELECT COALESCE(status,'<NULL>') status, COUNT(*) cnt FROM tbl_customer_transaction GROUP BY status ORDER BY cnt DESC`
  );
  for (const d of dist) console.log(`  ${fmt(d.status, 22)} ${d.cnt}`);

  console.log(`\n================ STATUS DISTRIBUTION (last 7d) ================`);
  const dist7 = await q<{ status: string; cnt: string }>(
    `SELECT COALESCE(status,'<NULL>') status, COUNT(*) cnt FROM tbl_customer_transaction
     WHERE "createdAt" > NOW() - INTERVAL '7 days' GROUP BY status ORDER BY cnt DESC`
  );
  if (dist7.length === 0) console.log("  (none)");
  for (const d of dist7) console.log(`  ${fmt(d.status, 22)} ${d.cnt}`);

  // ---------------- ANOMALIES ----------------
  console.log(`\n================ ANOMALY SCAN ================`);
  const anomalies: string[] = [];

  const nullStatus = await q<{ cnt: string }>(`SELECT COUNT(*) cnt FROM tbl_customer_transaction WHERE status IS NULL`);
  if (+nullStatus[0].cnt > 0) anomalies.push(`NULL status on ${nullStatus[0].cnt} payment(s)`);

  const paidPending = await q<any>(
    `SELECT transaction_id, base_amount, base_currency, paid_amount, paid_currency, "updatedAt"
     FROM tbl_customer_transaction WHERE status IN ('pending','detected') AND paid_amount > 0
     ORDER BY "updatedAt" DESC LIMIT 20`
  );
  if (paidPending.length > 0) {
    anomalies.push(`${paidPending.length} payment(s) pending/detected but paid_amount > 0 (possible MISSED WEBHOOK):`);
    for (const p of paidPending)
      anomalies.push(`   - ${p.transaction_id} paid ${p.paid_amount} ${p.paid_currency} of ${p.base_amount} ${p.base_currency} (upd ${new Date(p.updatedAt).toISOString()})`);
  }

  for (const state of ["processing", "confirming", "confirmed", "detected", "underpaid", "converted"]) {
    const stuck = await q<any>(
      `SELECT transaction_id, paid_amount, paid_currency, "updatedAt"
       FROM tbl_customer_transaction WHERE status = '${state}' AND "updatedAt" < NOW() - INTERVAL '2 hours'
       ORDER BY "updatedAt" ASC LIMIT 15`
    );
    if (stuck.length > 0) {
      anomalies.push(`${stuck.length} payment(s) STUCK in '${state}' >2h:`);
      for (const s of stuck)
        anomalies.push(`   - ${s.transaction_id} ${s.paid_amount ?? ""} ${s.paid_currency ?? ""} (upd ${new Date(s.updatedAt).toISOString()})`);
    }
  }

  const dupe = await q<{ transaction_id: string; cnt: string }>(
    `SELECT transaction_id, COUNT(*) cnt FROM tbl_customer_transaction
     WHERE transaction_id IS NOT NULL GROUP BY transaction_id HAVING COUNT(*) > 1 LIMIT 10`
  );
  if (dupe.length > 0) anomalies.push(`${dupe.length} duplicate transaction_id(s): ` + dupe.map(d => `${d.transaction_id}(x${d.cnt})`).join(", "));

  const failed24 = await q<{ cnt: string }>(
    `SELECT COUNT(*) cnt FROM tbl_customer_transaction WHERE status='failed' AND "updatedAt" > NOW() - INTERVAL '24 hours'`
  );
  if (+failed24[0].cnt > 0) anomalies.push(`${failed24[0].cnt} failed payment(s) in last 24h`);

  const underpaid = await q<any>(
    `SELECT transaction_id, base_amount, base_currency, paid_amount, paid_currency, status, "updatedAt"
     FROM tbl_customer_transaction WHERE status='underpaid' ORDER BY "updatedAt" DESC LIMIT 15`
  );
  if (underpaid.length > 0) {
    anomalies.push(`${underpaid.length} UNDERPAID payment(s):`);
    for (const u of underpaid)
      anomalies.push(`   - ${u.transaction_id} paid ${u.paid_amount} ${u.paid_currency} of ${u.base_amount} ${u.base_currency} (upd ${new Date(u.updatedAt).toISOString()})`);
  }

  if (anomalies.length === 0) console.log("  No payment-level anomalies detected in tbl_customer_transaction.");
  else for (const a of anomalies) console.log("  " + (a.startsWith("   ") ? a : "• " + a));

  await seq.close();
}

main().catch(async (e) => {
  console.error("REPORT FAILED:", e.message);
  try { await seq.close(); } catch {}
  process.exit(1);
});
