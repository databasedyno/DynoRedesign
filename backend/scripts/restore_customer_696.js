#!/usr/bin/env node
/**
 * ONE-OFF DATA REPAIR (user-approved): re-create the tbl_customer parent row for
 * moxxcompany@gmail.com (customer_id 696, SafeDeal brand company 262) that was
 * removed by a prior manual cleanup, orphaning their wallet ($20), 4 ledger
 * transactions, escrow deal #246 and their safedeal profile.
 *
 * Idempotent: no-op if the row already exists. Does NOT touch any other row.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const { randomUUID } = require("crypto");

const CUSTOMER_ID = 696;
const COMPANY_ID = 262;
const EMAIL = "moxxcompany@gmail.com";
const CREATED_AT = "2026-09-20T13:05:11.912Z"; // earliest known activity (topup credit)

const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });

(async () => {
  await client.connect();
  const existing = await client.query("SELECT customer_id, email FROM tbl_customer WHERE customer_id=$1", [CUSTOMER_ID]);
  if (existing.rows.length) {
    console.log("NOOP — tbl_customer already present:", JSON.stringify(existing.rows[0]));
  } else {
    await client.query(
      `INSERT INTO tbl_customer (customer_id, id, company_id, customer_name, email, mobile, telegram_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, $6, NOW())`,
      [CUSTOMER_ID, randomUUID(), COMPANY_ID, EMAIL, EMAIL, CREATED_AT]
    );
    console.log("INSERTED tbl_customer row for customer_id=696");
  }

  // Read-back: confirm the row + re-linked data.
  const row = (await client.query("SELECT customer_id, id, company_id, email, \"createdAt\" FROM tbl_customer WHERE customer_id=$1", [CUSTOMER_ID])).rows[0];
  const wallet = (await client.query("SELECT amount, held_amount, wallet_type FROM tbl_customer_wallet WHERE customer_id=$1", [CUSTOMER_ID])).rows;
  const tx = (await client.query("SELECT count(*)::int AS n FROM tbl_customer_transaction WHERE customer_id=$1", [CUSTOMER_ID])).rows[0].n;
  const deals = (await client.query("SELECT count(*)::int AS n FROM tbl_escrow_deal WHERE creator_customer_id=$1 OR counterparty_customer_id=$1", [CUSTOMER_ID])).rows[0].n;
  const profile = (await client.query("SELECT count(*)::int AS n FROM tbl_safedeal_profile WHERE customer_id=$1", [CUSTOMER_ID])).rows[0].n;
  console.log("VERIFY", JSON.stringify({ customer: row, wallet, transactions: tx, deals, profiles: profile }, null, 2));

  await client.end();
})().catch((e) => { console.error("ERR", e.message); client.end(); process.exit(1); });
