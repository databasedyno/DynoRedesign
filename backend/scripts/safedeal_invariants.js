#!/usr/bin/env node
/**
 * READ-ONLY SafeDeal money-invariant audit for one brand (default 262).
 *   I1 wallet == ledger:   Σ CREDIT − Σ DEBIT == available + held  (per customer)
 *   I2 held == open holds: held_amount == Σ HOLD/CREDIT(held) − Σ UNHOLD   (per customer)
 *   I3 deal conservation:  for each settled deal, hold released == paid_to_seller + fees + costs + rounding + refund-left-in-balance
 *   I4 quote == charged:   funded_amount_usd == amount ± locked totalCost per fee_payer
 *   I5 rounding rows:      any 'rounding' ledger row >= $0.05 (means live-rate drift, not rounding)
 * Usage: node scripts/safedeal_invariants.js [companyId]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const COMPANY_ID = Number(process.argv[2] || 262);
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });

(async () => {
  await client.connect();
  const issues = [];
  const modes = ["ESCROW", "WITHDRAWAL", "MERCHANT", "ADJUSTMENT", "TOPUP"];

  // I1 + I2 per customer
  const wallets = (await client.query(
    `SELECT c.customer_id, c.email, COALESCE(w.amount,0)::numeric AS available, COALESCE(w.held_amount,0)::numeric AS held
       FROM tbl_customer c LEFT JOIN tbl_customer_wallet w ON w.customer_id=c.customer_id WHERE c.company_id=$1 ORDER BY c.customer_id`, [COMPANY_ID])).rows;
  for (const w of wallets) {
    const s = (await client.query(
      `SELECT COALESCE(SUM(CASE transaction_type WHEN 'CREDIT' THEN paid_amount WHEN 'DEBIT' THEN -paid_amount ELSE 0 END),0) AS total,
              COALESCE(SUM(CASE WHEN transaction_type='HOLD' OR (transaction_type='CREDIT' AND meta->>'bucket'='held') THEN paid_amount
                               WHEN transaction_type='UNHOLD' THEN -paid_amount ELSE 0 END),0) AS held
         FROM tbl_customer_transaction WHERE customer_id=$1 AND payment_mode = ANY($2)`, [w.customer_id, modes])).rows[0];
    const total = r2(Number(w.available) + Number(w.held));
    if (Math.abs(r2(s.total) - total) >= 0.01) issues.push({ check: "I1 wallet≠ledger", customer: w.customer_id, email: w.email, ledger_total: r2(s.total), wallet_total: total });
    if (Math.abs(r2(s.held) - r2(w.held)) >= 0.01) issues.push({ check: "I2 held≠open holds", customer: w.customer_id, email: w.email, ledger_held: r2(s.held), wallet_held: r2(w.held) });
  }

  // I3 + I4 per settled deal
  const deals = (await client.query(
    `SELECT escrow_id, status, outcome, amount::numeric, fee_payer, funded_amount_usd::numeric, custody_amount_stable::numeric,
            seller_entitlement_stable::numeric, buyer_entitlement_stable::numeric, fee_breakdown_locked, funding_method
       FROM tbl_escrow_deal WHERE company_id=$1 AND source='safedeal' AND outcome IS NOT NULL ORDER BY escrow_id`, [COMPANY_ID])).rows;
  for (const d of deals) {
    const rows = (await client.query(
      `SELECT transaction_type, paid_amount::numeric AS amt, meta->>'kind' AS kind, customer_id FROM tbl_customer_transaction
        WHERE transaction_reference LIKE $1`, [`escrow:${d.escrow_id}:settle:%`])).rows;
    const by = (k) => r2(rows.filter((x) => x.kind === k).reduce((a, x) => a + Number(x.amt), 0));
    const unhold = by("hold_released");
    if (!rows.length) { issues.push({ check: "I3 no settlement ledger rows (buyer side purged?)", deal: d.escrow_id }); continue; }
    const consumed = r2(by("paid_to_seller") + by("escrow_fee") + by("exchange_fee") + by("escrow_costs") + (rows.some((x) => x.kind === "rounding" && x.transaction_type === "DEBIT") ? by("rounding") : -by("rounding")));
    const refundLeft = r2(unhold - consumed);
    const expectedRefund = r2(Number(d.buyer_entitlement_stable || 0));
    if (unhold > 0 && Math.abs(refundLeft - expectedRefund) >= 0.01) issues.push({ check: "I3 conservation", deal: d.escrow_id, unhold, consumed, refund_left: refundLeft, buyer_entitlement: expectedRefund });
    if (by("release_received") && Math.abs(by("release_received") - r2(Number(d.seller_entitlement_stable || 0))) >= 0.01) issues.push({ check: "I3 seller credit≠entitlement", deal: d.escrow_id, credited: by("release_received"), entitlement: r2(d.seller_entitlement_stable) });
    const rounding = by("rounding");
    if (rounding >= 0.05) issues.push({ check: "I5 rounding row too large (rate drift)", deal: d.escrow_id, rounding });
    const lb = d.fee_breakdown_locked;
    if (lb) {
      const tc = Number(lb.totalCost);
      const half = r2(tc / 2);
      const expBuyer = d.fee_payer === "buyer" ? r2(Number(d.amount) + tc) : d.fee_payer === "split" ? r2(Number(d.amount) + half) : r2(Number(d.amount));
      if (Math.abs(expBuyer - r2(d.funded_amount_usd)) >= 0.01) issues.push({ check: "I4 quote≠charged", deal: d.escrow_id, expected_buyer_pays: expBuyer, funded: r2(d.funded_amount_usd) });
    } else issues.push({ check: "I4 no locked breakdown (pre-audit deal)", deal: d.escrow_id, severity: "info" });
  }

  console.log(JSON.stringify({ company_id: COMPANY_ID, customers: wallets.length, settled_deals: deals.length, issues }, null, 1));
  await client.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
