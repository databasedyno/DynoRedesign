#!/usr/bin/env node
/**
 * One-off: clear the leaked frontend placeholder webhook_url
 * ('https://mystore.com/dynopay-webhook') that was never explicitly set by
 * merchants. Sets webhook_url = NULL only for rows that still carry that exact
 * placeholder. Transactional; prints affected rows before committing.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const LEAK = "https://mystore.com/dynopay-webhook";
const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });

(async () => {
  await client.connect();
  await client.query("BEGIN");
  const before = await client.query(
    "select company_id, company_name from tbl_company where webhook_url = $1 order by company_id",
    [LEAK]
  );
  console.log(`Rows matching placeholder: ${before.rows.length}`);
  const upd = await client.query(
    "update tbl_company set webhook_url = NULL where webhook_url = $1",
    [LEAK]
  );
  console.log(`Rows updated (webhook_url -> NULL): ${upd.rowCount}`);
  const remaining = await client.query(
    "select count(*)::int as n from tbl_company where webhook_url = $1",
    [LEAK]
  );
  console.log(`Remaining with placeholder after update: ${remaining.rows[0].n}`);
  await client.query("COMMIT");
  console.log("COMMITTED");
  console.log("Cleared company_ids:", before.rows.map((r) => r.company_id).join(", "));
  await client.end();
})().catch((e) => { console.error("ERR", e.message); client.query("ROLLBACK").finally(() => client.end()); process.exit(1); });
