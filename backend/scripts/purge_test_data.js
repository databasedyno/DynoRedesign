#!/usr/bin/env node
// Re-runnable purge of TEST data created by QA runs against the shared DB.
// Rule: SafeDeal brand (SAFEDEAL_COMPANY_ID, default 262) identities whose e-mail is @example.com,
// escrow deals whose parties are only @example.com (or none), the pending Dynopay checkouts those
// identities opened (releasing the merchant-pool addresses they hold), plus orphan ledger/top-up rows.
// Real accounts are protected twice: KEEP list + "never delete a non-@example.com identity".
//   node scripts/purge_test_data.js            dry run (counts only)
//   node scripts/purge_test_data.js --apply    back up to /app/memory/backups then delete in ONE transaction
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const COMPANY_ID = Number(process.env.SAFEDEAL_COMPANY_ID || 262);
const KEEP = ["moxxcompany@gmail.com", "gidimeter@gmail.com", "gidineter@gmail.com"];
const TEST_DOMAIN = "%@example.com";
const BACKUP_DIR = "/app/memory/backups";

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 300000 });
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

async function collect() {
  const testCustomers = await q(
    `SELECT customer_id, email FROM tbl_customer WHERE company_id = $1 AND email ILIKE $2 AND LOWER(email) <> ALL($3::text[]) ORDER BY customer_id`,
    [COMPANY_ID, TEST_DOMAIN, KEEP]
  );
  const cids = testCustomers.map((c) => c.customer_id);
  const liveCids = (await q(`SELECT customer_id FROM tbl_customer WHERE company_id = $1`, [COMPANY_ID])).map((r) => r.customer_id);

  const deals = await q(
    `SELECT escrow_id, source, company_id, title, creator_email, counterparty_email, status FROM tbl_escrow_deal
      WHERE NOT (LOWER(COALESCE(creator_email,'')) = ANY($1::text[]) OR LOWER(COALESCE(counterparty_email,'')) = ANY($1::text[]))
        AND COALESCE(creator_email, 'x@example.com') ILIKE $2 AND COALESCE(counterparty_email, 'x@example.com') ILIKE $2
        AND (creator_email IS NOT NULL OR counterparty_email IS NOT NULL OR creator_customer_id = ANY($3::int[]) OR counterparty_customer_id = ANY($3::int[]) OR source <> 'safedeal')
      ORDER BY escrow_id`,
    [KEEP, TEST_DOMAIN, cids.length ? cids : [0]]
  );
  const dealIds = deals.map((d) => d.escrow_id);

  const attachments = await q(`SELECT * FROM tbl_escrow_attachment WHERE escrow_id = ANY($1::int[])`, [dealIds.length ? dealIds : [0]]);
  // Ledger + top-ups of test customers, plus rows whose customer no longer exists (orphans of earlier test runs).
  const ledger = await q(
    `SELECT * FROM tbl_customer_transaction WHERE company_id = $1 AND (customer_id = ANY($2::int[]) OR customer_id <> ALL($3::int[]))`,
    [COMPANY_ID, cids.length ? cids : [0], liveCids.length ? liveCids : [0]]
  );
  const topups = await q(
    `SELECT * FROM tbl_safedeal_topup WHERE company_id = $1 AND (customer_id = ANY($2::int[]) OR customer_id <> ALL($3::int[]))`,
    [COMPANY_ID, cids.length ? cids : [0], liveCids.length ? liveCids : [0]]
  );
  const withdrawals = await q(`SELECT * FROM tbl_customer_withdrawal WHERE customer_id = ANY($1::int[]) OR (company_id = $2 AND escrow_id = ANY($3::int[]))`, [cids.length ? cids : [0], COMPANY_ID, dealIds.length ? dealIds : [0]]);
  const addresses = await q(`SELECT * FROM tbl_customer_payout_address WHERE customer_id = ANY($1::int[])`, [cids.length ? cids : [0]]);
  const profiles = await q(`SELECT * FROM tbl_safedeal_profile WHERE customer_id = ANY($1::int[])`, [cids.length ? cids : [0]]);
  const wallets = await q(`SELECT * FROM tbl_customer_wallet WHERE customer_id = ANY($1::int[])`, [cids.length ? cids : [0]]);

  // Pending Dynopay checkouts opened by test identities (or anonymous) on the SafeDeal brand — never a real customer's, never paid.
  const realCids = (await q(`SELECT customer_id FROM tbl_customer WHERE company_id = $1 AND LOWER(email) = ANY($2::text[])`, [COMPANY_ID, KEEP])).map((r) => r.customer_id);
  const checkouts = await q(
    `SELECT t.* FROM tbl_user_transaction t WHERE t.company_id = $1 AND t.status = 'pending' AND t.incoming_tx_hash IS NULL
        AND (t.customer_id IS NULL OR t.customer_id <> ALL($2::int[]))
        AND NOT EXISTS (SELECT 1 FROM tbl_payment_journal j WHERE j.payment_id = t.id::text)`,
    [COMPANY_ID, realCids.length ? realCids : [0]]
  );
  const checkoutIds = checkouts.map((c) => String(c.id));
  const poolAddresses = await q(
    `SELECT temp_address_id, wallet_type, wallet_address, status, current_payment_id, expected_amount FROM tbl_merchant_temp_address
      WHERE status = 'RESERVED' AND current_payment_id = ANY($1::text[])`,
    [checkoutIds.length ? checkoutIds : ["-"]]
  );

  return { testCustomers, deals, attachments, ledger, topups, withdrawals, addresses, profiles, wallets, checkouts, poolAddresses, realCids };
}

function guard(s) {
  const bad = s.testCustomers.filter((c) => !/@example\.com$/i.test(c.email) || KEEP.includes(String(c.email).toLowerCase()));
  if (bad.length) throw new Error(`refusing: non-test customer in purge set ${JSON.stringify(bad)}`);
  const badDeal = s.deals.filter((d) => [d.creator_email, d.counterparty_email].some((e) => e && (!/@example\.com$/i.test(e) || KEEP.includes(e.toLowerCase()))));
  if (badDeal.length) throw new Error(`refusing: real party in deal purge set ${JSON.stringify(badDeal.map((d) => d.escrow_id))}`);
  const badTx = s.checkouts.filter((t) => t.status !== "pending" || t.incoming_tx_hash || s.realCids.includes(t.customer_id));
  if (badTx.length) throw new Error(`refusing: non-test checkout in purge set ${JSON.stringify(badTx.map((t) => t.transaction_id))}`);
}

async function summary(label) {
  const [r] = await q(
    `SELECT (SELECT count(*) FROM tbl_escrow_deal) deals,
            (SELECT count(*) FROM tbl_customer WHERE company_id = $1) customers,
            (SELECT count(*) FROM tbl_customer_transaction WHERE company_id = $1) ledger_rows,
            (SELECT count(*) FROM tbl_customer_withdrawal WHERE company_id = $1) withdrawals,
            (SELECT count(*) FROM tbl_safedeal_topup WHERE company_id = $1) topups,
            (SELECT count(*) FROM tbl_user_transaction WHERE company_id = $1) dynopay_tx,
            (SELECT count(*) FROM tbl_merchant_temp_address WHERE status = 'RESERVED' AND current_company_id = $1) reserved_pool`,
    [COMPANY_ID]
  );
  console.log(`${label}:`, r);
}

(async () => {
  await client.connect();
  console.log(APPLY ? "APPLYING" : "DRY RUN", `— SafeDeal brand ${COMPANY_ID}, keeping ${KEEP.join(", ")}`);
  await summary("before");
  const s = await collect();
  guard(s);
  const counts = Object.fromEntries(Object.entries(s).filter(([k]) => k !== "realCids").map(([k, v]) => [k, v.length]));
  console.log("to purge:", counts);
  if (!APPLY) { await client.end(); return; }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `purge_test_data_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), company_id: COMPANY_ID, keep: KEEP, ...s }, null, 1));
  console.log(`backup written: ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);

  const ids = (rows, k) => rows.map((r) => r[k]);
  await client.query("BEGIN");
  try {
    await client.query(`DELETE FROM tbl_escrow_attachment WHERE attachment_id = ANY($1::int[])`, [ids(s.attachments, "attachment_id")]);
    const d = await client.query(`DELETE FROM tbl_escrow_deal WHERE escrow_id = ANY($1::int[])`, [ids(s.deals, "escrow_id")]);
    const l = await client.query(`DELETE FROM tbl_customer_transaction WHERE transaction_id = ANY($1::int[])`, [ids(s.ledger, "transaction_id")]);
    const t = await client.query(`DELETE FROM tbl_safedeal_topup WHERE topup_id = ANY($1::int[])`, [ids(s.topups, "topup_id")]);
    const w = await client.query(`DELETE FROM tbl_customer_withdrawal WHERE withdrawal_id = ANY($1::int[])`, [ids(s.withdrawals, "withdrawal_id")]);
    // customers cascade → wallets, profiles, payout addresses, remaining withdrawals
    const c = await client.query(`DELETE FROM tbl_customer WHERE customer_id = ANY($1::int[])`, [ids(s.testCustomers, "customer_id")]);
    const p = await client.query(
      `UPDATE tbl_merchant_temp_address SET status = 'AVAILABLE', current_payment_id = NULL, expected_amount = NULL, reserved_until = NULL, current_company_id = NULL, last_payment_context = NULL, updated_at = NOW()
        WHERE temp_address_id = ANY($1::int[]) AND status = 'RESERVED'`,
      [ids(s.poolAddresses, "temp_address_id")]
    );
    const x = await client.query(`DELETE FROM tbl_user_transaction WHERE transaction_id = ANY($1::int[])`, [ids(s.checkouts, "transaction_id")]);
    // real accounts must still be there
    const keep = await client.query(`SELECT count(*)::int n FROM tbl_customer WHERE company_id = $1 AND LOWER(email) = ANY($2::text[])`, [COMPANY_ID, KEEP]);
    const realDeals = await client.query(`SELECT count(*)::int n FROM tbl_escrow_deal WHERE LOWER(creator_email) = ANY($1::text[]) OR LOWER(counterparty_email) = ANY($1::text[])`, [KEEP]);
    if (keep.rows[0].n !== s.realCids.length || realDeals.rows[0].n < 1) throw new Error("post-check failed — real accounts/deals would be affected");
    await client.query("COMMIT");
    console.log("deleted:", { deals: d.rowCount, ledger_rows: l.rowCount, topups: t.rowCount, withdrawals: w.rowCount, customers: c.rowCount, checkouts: x.rowCount, pool_addresses_released: p.rowCount });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
  await summary("after");
  await client.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
