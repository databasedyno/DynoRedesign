#!/usr/bin/env node
/**
 * ONE-OFF, GUARDED, IDEMPOTENT: rebuild the two SafeDeal-brand (company 262) payment
 * rows that were cascade-deleted from tbl_user_transaction when cleanup_262.js removed
 * their customers (FK customer_id was ON DELETE CASCADE — fixed by migration 0046).
 *
 * Source of truth = the on-chain settlement records that survived:
 *   tbl_merchant_pool_transaction 531  →  50.50 USDT-TRC20, moxxcompany top-up #15 (payment 19fc6f2c…)
 *   tbl_merchant_pool_transaction 533  →  44.50 USDT-TRC20, funding of SafeDeal deal #209
 *
 * Dry-run by default (prints the rows it would insert). Pass --yes to write.
 * Skips any row whose id OR transaction_reference already exists. Runs in one
 * transaction and verifies the end state before COMMIT.
 *
 * Run:  node scripts/restore_262_transactions.js [--yes]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const crypto = require("crypto");
const { Client } = require("pg");

const COMPANY = 262;
const OWNER_USER = 1;
const KEEP_CUSTOMER = 696; // moxxcompany@gmail.com on brand 262
const TOPUP_POOL_TX = 531;
const TOPUP_ID = 15;
const DEAL_POOL_TX = 533;
const DEAL_ESCROW_ID = 209;
const DEAL_BUYER = "gidimeter@gmail.com";
const WRITE = process.argv.includes("--yes");

const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });

const one = async (sql, params) => (await client.query(sql, params)).rows[0] || null;

(async () => {
  await client.connect();

  const company = await one(`SELECT company_id, user_id, company_name FROM tbl_company WHERE company_id=$1 AND deleted_at IS NULL`, [COMPANY]);
  if (!company || Number(company.user_id) !== OWNER_USER) throw new Error(`brand ${COMPANY} missing or not owned by user ${OWNER_USER}`);
  const customer = await one(`SELECT customer_id, email FROM tbl_customer WHERE customer_id=$1 AND company_id=$2`, [KEEP_CUSTOMER, COMPANY]);
  if (!customer) throw new Error(`customer ${KEEP_CUSTOMER} not found on brand ${COMPANY}`);
  const wallet = await one(`SELECT wallet_id FROM tbl_user_wallet WHERE company_id=$1 AND wallet_type='USDT-TRC20' AND wallet_address IS NOT NULL ORDER BY wallet_id LIMIT 1`, [COMPANY]);
  if (!wallet) throw new Error(`no USDT-TRC20 wallet on brand ${COMPANY}`);

  const pool531 = await one(`SELECT * FROM tbl_merchant_pool_transaction WHERE pool_tx_id=$1 AND company_id=$2 AND status='completed'`, [TOPUP_POOL_TX, COMPANY]);
  const pool533 = await one(`SELECT * FROM tbl_merchant_pool_transaction WHERE pool_tx_id=$1 AND company_id=$2 AND status='completed'`, [DEAL_POOL_TX, COMPANY]);
  const topup = await one(`SELECT * FROM tbl_safedeal_topup WHERE topup_id=$1 AND company_id=$2 AND customer_id=$3 AND status='credited'`, [TOPUP_ID, COMPANY, KEEP_CUSTOMER]);
  if (!pool531 || !pool533 || !topup) throw new Error("evidence rows missing (pool 531/533, topup 15) — refusing");
  if (pool531.incoming_tx_id !== topup.seen_tx) throw new Error(`pool 531 tx ${pool531.incoming_tx_id} ≠ topup 15 seen_tx ${topup.seen_tx}`);

  const marker = (what) => `Credited funds into wallet · ${what} · ledger row restored ${new Date().toISOString().slice(0, 10)} from merchant-pool record`;
  const rows = [
    {
      id: topup.payment_id,
      base_amount: Number(topup.pays_usd),
      crypto_amount: Number(pool531.payment_amount),
      transaction_reference: pool531.incoming_tx_id,
      outgoing_tx_hash: pool531.merchant_tx_id,
      customer_id: KEEP_CUSTOMER,
      details: marker(`SafeDeal wallet top-up DEP-${TOPUP_ID} (${customer.email})`),
      createdAt: topup.created_at,
      updatedAt: pool531.created_at,
    },
    {
      id: crypto.randomUUID(),
      base_amount: Number(pool533.payment_amount),
      crypto_amount: Number(pool533.payment_amount),
      transaction_reference: pool533.incoming_tx_id,
      outgoing_tx_hash: pool533.merchant_tx_id,
      customer_id: null,
      details: marker(`SafeDeal deal #${DEAL_ESCROW_ID} funding (buyer ${DEAL_BUYER})`),
      createdAt: pool533.created_at,
      updatedAt: pool533.created_at,
    },
  ];

  const insertSql = `
    INSERT INTO tbl_user_transaction
      (id, wallet_id, user_id, payment_mode, base_amount, base_currency, crypto_amount, crypto_currency, usd_value,
       transaction_fee, fixed_fee, blockchain_buffer_fee, confirmations, required_confirmations,
       transaction_reference, incoming_tx_hash, outgoing_tx_hash, transaction_details, transaction_type, status,
       customer_id, company_id, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, 'CRYPTO', $4, 'USDT-TRC20', $5, 'USDT-TRC20', $5,
            0, 0, 0, 20, 6,
            $6, $6, $7, $8, 'CREDIT', 'successful',
            $9, $10, $11, $12)
    RETURNING transaction_id`;

  console.log(`${WRITE ? "WRITE" : "DRY-RUN"} — brand ${COMPANY} "${company.company_name}", wallet ${wallet.wallet_id}, customer ${KEEP_CUSTOMER} ${customer.email}`);
  try {
    await client.query("BEGIN");
    let inserted = 0;
    for (const r of rows) {
      const dup = await one(`SELECT transaction_id FROM tbl_user_transaction WHERE id=$1 OR transaction_reference=$2 LIMIT 1`, [r.id, r.transaction_reference]);
      if (dup) { console.log(`  skip ${r.transaction_reference.slice(0, 12)}… — already present as transaction_id ${dup.transaction_id}`); continue; }
      console.log(`  insert ${r.crypto_amount} USDT-TRC20 tx ${r.transaction_reference.slice(0, 12)}… → ${r.details}`);
      if (WRITE) {
        const ins = await one(insertSql, [r.id, wallet.wallet_id, OWNER_USER, r.base_amount, r.crypto_amount, r.transaction_reference, r.outgoing_tx_hash, r.details, r.customer_id, COMPANY, r.createdAt, r.updatedAt]);
        console.log(`    → transaction_id ${ins.transaction_id}`);
      }
      inserted++;
    }
    if (!WRITE) { await client.query("ROLLBACK"); console.log(`Dry-run complete: ${inserted} row(s) would be inserted. Re-run with --yes.`); return; }
    const after = await one(`SELECT COUNT(*)::int AS n, COALESCE(SUM(usd_value),0)::numeric(18,2) AS usd FROM tbl_user_transaction WHERE company_id=$1 AND user_id=$2 AND status='successful'`, [COMPANY, OWNER_USER]);
    if (after.n < 2) throw new Error(`verification failed — expected ≥2 successful rows on brand ${COMPANY}, found ${after.n}`);
    await client.query("COMMIT");
    console.log(`✅ COMMITTED — brand ${COMPANY} now has ${after.n} settled payment(s), ${after.usd} USD.`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ ROLLED BACK:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})().catch((e) => { console.error("ERR", e.message); client.end(); process.exit(1); });
