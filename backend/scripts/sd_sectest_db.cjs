// Throwaway test helper: read/cleanup for the SafeDeal security e2e test.
// Usage: node sd_sectest_db.cjs <read|cleanup> <email>
const { Client } = require("pg");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

async function main() {
  const [, , cmd, email] = process.argv;
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const cust = await c.query(`SELECT customer_id, email FROM tbl_customer WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
    if (!cust.rows.length) { console.log(JSON.stringify({ found: false })); return; }
    const cid = cust.rows[0].customer_id;
    if (cmd === "read") {
      const p = await c.query(`SELECT tokens_valid_after, cashout_hold_until FROM tbl_safedeal_profile WHERE customer_id = $1`, [cid]);
      console.log(JSON.stringify({ found: true, customer_id: cid, email: cust.rows[0].email, profile: p.rows[0] || null }));
    } else if (cmd === "cleanup") {
      await c.query(`DELETE FROM tbl_customer_transaction WHERE customer_id = $1`, [cid]).catch(() => {});
      await c.query(`DELETE FROM tbl_customer_wallet WHERE customer_id = $1`, [cid]).catch(() => {});
      await c.query(`DELETE FROM tbl_customer_withdrawal WHERE customer_id = $1`, [cid]).catch(() => {});
      await c.query(`DELETE FROM tbl_customer_payout_address WHERE customer_id = $1`, [cid]).catch(() => {});
      await c.query(`DELETE FROM tbl_safedeal_profile WHERE customer_id = $1`, [cid]).catch(() => {});
      await c.query(`DELETE FROM tbl_customer WHERE customer_id = $1`, [cid]).catch(() => {});
      console.log(JSON.stringify({ cleaned: true, customer_id: cid }));
    }
  } finally {
    await c.end();
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
