#!/usr/bin/env node
/**
 * ONE-OFF: purge SafeDeal brand 262 of ALL test data, KEEP only the real account
 * moxxcompany@gmail.com (customer_id 696) with its current $50 wallet, address & history.
 *
 * - Backs up every affected table (brand 262) to /tmp/safedeal_262_backup_<ts>.json first.
 * - Runs inside a single transaction; verifies the end state before COMMIT (else ROLLBACK).
 * - PRESERVES: brand company row, funding wallets (tbl_user_wallet), API key (tbl_api),
 *   shared pools (tbl_usdt_pool_transaction / tbl_merchant_pool_transaction).
 *
 * Run:  node scripts/cleanup_262.js --yes
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const { Client } = require("pg");

const KEEP = 696; // moxxcompany@gmail.com on brand 262
const COMPANY = 262;

if (!process.argv.includes("--yes")) {
  console.error("Refusing: pass --yes to actually purge. (dry-run aborted)");
  process.exit(2);
}

const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });

const BACKUP_TABLES = [
  ["tbl_customer", `SELECT * FROM tbl_customer WHERE company_id=${COMPANY}`],
  ["tbl_escrow_deal", `SELECT * FROM tbl_escrow_deal WHERE company_id=${COMPANY}`],
  ["tbl_escrow_attachment", `SELECT * FROM tbl_escrow_attachment WHERE company_id=${COMPANY}`],
  ["tbl_customer_transaction", `SELECT * FROM tbl_customer_transaction WHERE company_id=${COMPANY}`],
  ["tbl_customer_withdrawal", `SELECT * FROM tbl_customer_withdrawal WHERE company_id=${COMPANY}`],
  ["tbl_customer_payout_address", `SELECT * FROM tbl_customer_payout_address WHERE company_id=${COMPANY}`],
  ["tbl_safedeal_profile", `SELECT * FROM tbl_safedeal_profile WHERE company_id=${COMPANY}`],
  ["tbl_safedeal_topup", `SELECT * FROM tbl_safedeal_topup WHERE company_id=${COMPANY}`],
  ["tbl_customer_wallet", `SELECT w.* FROM tbl_customer_wallet w JOIN tbl_customer c ON c.customer_id=w.customer_id WHERE c.company_id=${COMPANY}`],
];

(async () => {
  await client.connect();
  // ---- backup ----
  const backup = { at: new Date().toISOString(), company_id: COMPANY, keep_customer_id: KEEP, tables: {} };
  for (const [name, sql] of BACKUP_TABLES) {
    const r = await client.query(sql);
    backup.tables[name] = r.rows;
  }
  const path = `/tmp/safedeal_${COMPANY}_backup_${Date.now()}.json`;
  fs.writeFileSync(path, JSON.stringify(backup, null, 1));
  const totalBackup = Object.values(backup.tables).reduce((n, rows) => n + rows.length, 0);
  console.log(`Backup written: ${path} (${totalBackup} rows across ${BACKUP_TABLES.length} tables)`);

  // ---- purge ----
  const deletes = [
    ["customer_transaction (non-696)", `DELETE FROM tbl_customer_transaction WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`],
    ["customer_withdrawal (non-696)", `DELETE FROM tbl_customer_withdrawal WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`],
    ["customer_payout_address (non-696)", `DELETE FROM tbl_customer_payout_address WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`],
    ["safedeal_topup (non-696)", `DELETE FROM tbl_safedeal_topup WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`],
    ["safedeal_profile (non-696)", `DELETE FROM tbl_safedeal_profile WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`],
    ["customer_wallet (non-696)", `DELETE FROM tbl_customer_wallet WHERE customer_id IN (SELECT customer_id FROM tbl_customer WHERE company_id=${COMPANY} AND customer_id<>${KEEP})`],
    ["escrow_attachment (all 262)", `DELETE FROM tbl_escrow_attachment WHERE company_id=${COMPANY}`],
    ["escrow_deal (all 262 test deals)", `DELETE FROM tbl_escrow_deal WHERE company_id=${COMPANY}`],
    ["customer (non-696)", `DELETE FROM tbl_customer WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`],
    ["reset 696 stale parked/deposit", `UPDATE tbl_safedeal_profile SET parked_payout_usd=0, deposit_reserved_usd=0, updated_at=NOW() WHERE customer_id=${KEEP}`],
  ];
  try {
    await client.query("BEGIN");
    for (const [label, sql] of deletes) {
      const r = await client.query(sql);
      console.log(`  ${label}: ${r.rowCount} rows`);
    }
    // ---- verify before commit ----
    const q = async (sql) => Number((await client.query(sql)).rows[0].n);
    const custLeft = await q(`SELECT COUNT(*) AS n FROM tbl_customer WHERE company_id=${COMPANY}`);
    const notKept = await q(`SELECT COUNT(*) AS n FROM tbl_customer WHERE company_id=${COMPANY} AND customer_id<>${KEEP}`);
    const dealsLeft = await q(`SELECT COUNT(*) AS n FROM tbl_escrow_deal WHERE company_id=${COMPANY}`);
    const wallet696 = Number((await client.query(`SELECT amount FROM tbl_customer_wallet WHERE customer_id=${KEEP}`)).rows[0]?.amount ?? -1);
    console.log(`Verify: customers_left=${custLeft} non696=${notKept} deals_left=${dealsLeft} wallet696=${wallet696}`);
    if (custLeft !== 1 || notKept !== 0 || dealsLeft !== 0 || Math.abs(wallet696 - 50) > 0.001) {
      throw new Error("verification failed — expected customers_left=1, non696=0, deals_left=0, wallet696=50");
    }
    await client.query("COMMIT");
    console.log("✅ COMMITTED — brand 262 now holds only moxxcompany (696), wallet $50, 0 deals.");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ ROLLED BACK:", e.message);
    process.exitCode = 1;
  }
  await client.end();
})().catch((e) => { console.error("ERR", e.message); client.end(); process.exit(1); });
