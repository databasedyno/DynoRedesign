// Inspect tbl_merchant_wallet schema + any RLUSD row for user 1 (read-only).
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cols = await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='tbl_merchant_wallet' ORDER BY ordinal_position`
  );
  console.log("tbl_merchant_wallet columns:", cols.rows.map((r) => r.column_name).join(", "));
  // Find likely currency + user columns then dump recent user-1 rows.
  const dump = await c.query(
    `SELECT * FROM tbl_merchant_wallet WHERE user_id=1 ORDER BY "createdAt" DESC NULLS LAST LIMIT 25`
  ).catch((e) => ({ rows: [{ err: e.message }] }));
  console.log("\nrecent user_1 merchant_wallet rows:");
  dump.rows.forEach((r) => console.log(JSON.stringify(r)));
  await c.end();
})();
