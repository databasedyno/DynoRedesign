#!/usr/bin/env node
/** R7 cleanup: purge throwaway customer rows created during iteration 225. */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const IDS = [964, 965, 966];
const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  const list = IDS.join(",");
  const tables = [
    "tbl_customer_transaction",
    "tbl_customer_withdrawal",
    "tbl_customer_payout_address",
    "tbl_safedeal_topup",
    "tbl_safedeal_profile",
    "tbl_customer_wallet",
  ];
  const deleted = {};
  for (const t of tables) {
    try {
      const r = await client.query(`DELETE FROM ${t} WHERE customer_id IN (${list})`);
      deleted[t] = r.rowCount;
    } catch (e) {
      deleted[t] = `ERR:${e.message}`;
    }
  }
  // also remove any deals/holds referencing these customers (best-effort, buyer_id/seller_id/customer_id)
  const dealTables = [
    ["tbl_safedeal_deal", "buyer_id"],
    ["tbl_safedeal_deal", "seller_id"],
    ["tbl_safedeal_ledger", "customer_id"],
  ];
  for (const [t, col] of dealTables) {
    try {
      const r = await client.query(`DELETE FROM ${t} WHERE ${col} IN (${list})`);
      deleted[`${t}.${col}`] = r.rowCount;
    } catch (e) {
      deleted[`${t}.${col}`] = `ERR:${e.message}`;
    }
  }
  try {
    const r = await client.query(`DELETE FROM tbl_customer WHERE customer_id IN (${list})`);
    deleted["tbl_customer"] = r.rowCount;
  } catch (e) {
    deleted["tbl_customer"] = `ERR:${e.message}`;
  }
  // verify
  const check = await client.query(`SELECT count(*)::int AS c FROM tbl_customer WHERE customer_id IN (${list})`);
  console.log(JSON.stringify({ deleted, final_customer_count: check.rows[0].c, ids: IDS }, null, 2));
  await client.end();
})().catch((e) => {
  console.error("FATAL", e.message);
  client.end();
  process.exit(1);
});
