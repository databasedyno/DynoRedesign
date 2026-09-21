#!/usr/bin/env node
// One-off: remove internal vocabulary ("[SIMULATED …]", "(simulated)", "Binance", "BINANCE-…" refs)
// from user-facing text already stored in the DB. Text-only: amounts, refs and ledger rows are untouched;
// where a SIMULATED tag is stripped the fact is kept in activity meta.simulated for admins.
//   node scripts/scrub_internal_terms.js            (dry run — prints what would change)
//   node scripts/scrub_internal_terms.js --apply
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function scrubText(note) {
  if (!note || typeof note !== "string") return { text: note, simulated: false };
  let t = note;
  let simulated = false;
  // The authorization tag was stamped unconditionally (even for live deals) — not a reliable flag, so no meta.
  if (/^\[SIMULATED — no on-chain transaction\]\s*/.test(t)) t = cap(t.replace(/^\[SIMULATED — no on-chain transaction\]\s*/, ""));
  if (/^\[LIVE\]\s*/.test(t)) t = cap(t.replace(/^\[LIVE\]\s*/, ""));
  if (/^\[SIMULATED\]\s*/.test(t)) { simulated = true; t = t.replace(/^\[SIMULATED\]\s*/, ""); }
  if (/ \(simulated\)/i.test(t)) { simulated = true; t = t.replace(/ \(simulated\)/gi, ""); }
  if (/ \[SIMULATED\]/.test(t)) { simulated = true; t = t.replace(/ \[SIMULATED\]/g, ""); }
  t = t.replace(/, ref BINANCE-[0-9a-f]+/gi, "").replace(/\s*\(ref BINANCE-[0-9a-f]+\)/gi, "").replace(/BINANCE-[0-9a-f]+/gi, "the exchange");
  t = t.replace(/held in custody on Binance/g, "held securely in escrow").replace(/converted to ([0-9.]+ [A-Z0-9-]+) held in custody\./g, "$1 held securely in escrow.");
  t = t.replace(/Binance/g, "the exchange");
  t = t.replace(/^Parked payout of /, "Payout of ");
  return { text: t, simulated };
}

async function scrubDeals() {
  const { rows } = await client.query(
    `SELECT escrow_id, activity_log, settlement_note FROM tbl_escrow_deal
      WHERE activity_log::text ~* '(simulated|binance|\\[LIVE\\])' OR settlement_note ~* '(simulated|binance|\\[LIVE\\])' ORDER BY escrow_id`
  );
  let changedDeals = 0, changedEntries = 0;
  for (const r of rows) {
    let touched = false;
    const log = Array.isArray(r.activity_log) ? r.activity_log.map((e) => {
      const { text, simulated } = scrubText(e.note);
      if (text === e.note) return e;
      touched = true; changedEntries++;
      const meta = { ...(e.meta || {}) };
      if (simulated && meta.simulated === undefined) meta.simulated = true;
      return { ...e, note: text, meta };
    }) : r.activity_log;
    const { text: sn } = scrubText(r.settlement_note);
    if (sn !== r.settlement_note) touched = true;
    if (!touched) continue;
    changedDeals++;
    if (process.argv.includes("--verbose") || r.escrow_id === 209) {
      console.log(`deal #${r.escrow_id}`);
      (log || []).forEach((e, i) => { if (e.note !== (r.activity_log[i] || {}).note) console.log(`   ${r.activity_log[i].note}\n → ${e.note}`); });
      if (sn !== r.settlement_note) console.log(`   settlement_note: ${r.settlement_note}\n → ${sn}`);
    }
    if (APPLY) {
      await client.query(`UPDATE tbl_escrow_deal SET activity_log = $1::jsonb, settlement_note = $2, updated_at = updated_at WHERE escrow_id = $3`, [JSON.stringify(log), sn, r.escrow_id]);
    }
  }
  console.log(`deals: ${changedDeals} rows / ${changedEntries} activity entries ${APPLY ? "updated" : "would change"}`);
}

async function scrubStatement() {
  const { rows } = await client.query(
    `SELECT transaction_id, transaction_details FROM tbl_customer_transaction WHERE transaction_details ~* '(simulated|binance)' ORDER BY transaction_id`
  );
  let n = 0;
  for (const r of rows) {
    const { text } = scrubText(r.transaction_details);
    if (text === r.transaction_details) continue;
    n++;
    if (process.argv.includes("--verbose")) console.log(`tx ${r.transaction_id}: ${r.transaction_details}\n → ${text}`);
    if (APPLY) await client.query(`UPDATE tbl_customer_transaction SET transaction_details = $1 WHERE transaction_id = $2`, [text, r.transaction_id]);
  }
  console.log(`statement rows: ${n} ${APPLY ? "updated" : "would change"}`);
}

(async () => {
  await client.connect();
  console.log(APPLY ? "APPLYING" : "DRY RUN");
  await scrubDeals();
  await scrubStatement();
  await client.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
