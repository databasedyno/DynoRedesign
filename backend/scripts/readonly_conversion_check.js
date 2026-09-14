/* READ-ONLY diagnostic: inspect the latest stablecoin conversion + linked transaction rows.
 * Usage: node scripts/readonly_conversion_check.js
 * Only SELECT statements are issued. Runs inside a READ ONLY transaction as a hard guard. */
require("dotenv").config({ path: __dirname + "/../.env" });
const { Client } = require("pg");

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("BEGIN READ ONLY");
  const q = async (label, sql, params = []) => {
    const r = await c.query(sql, params);
    console.log(`\n=== ${label} (${r.rowCount} rows) ===`);
    for (const row of r.rows) console.log(JSON.stringify(row, null, 0));
  };

  await q("tbl_stablecoin_conversion: latest 3",
    `SELECT *


       FROM tbl_stablecoin_conversion ORDER BY conversion_id DESC LIMIT 3`);

  await q("tbl_user_transaction for payment 3d317a20",
    `SELECT * FROM tbl_user_transaction WHERE transaction_id = 883`);

  await q("tbl_customer_transaction 221fc5e7",
    `SELECT * FROM tbl_customer_transaction WHERE transaction_id::text = '221fc5e7-6e9b-4633-97fa-4fd6054b3801' OR id::text = '221fc5e7-6e9b-4633-97fa-4fd6054b3801'`).catch(async e => {
      console.log("customer tx query fallback:", e.message);
      await c.query("ROLLBACK"); await c.query("BEGIN READ ONLY");
      const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tbl_customer_transaction' ORDER BY ordinal_position`);
      console.log("customer tx columns:", cols.rows.map(r => r.column_name).join(", "));
    });

  await q("payment link 339",
    `SELECT * FROM tbl_payment_link WHERE id = 339 OR link_id = 339`).catch(async e => {
      console.log("payment link query fallback:", e.message);
      await c.query("ROLLBACK"); await c.query("BEGIN READ ONLY");
      const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%link%' OR table_name ILIKE '%pay%'`);
      console.log("candidate tables:", t.rows.map(r => r.table_name).join(", "));
    });

  await c.query("ROLLBACK");
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
