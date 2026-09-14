/* TEST-ONLY reversible scratch merchant for verifying admin ban/suspend/unlock
 * endpoints against the LIVE DB without touching real merchants.
 * Usage:
 *   node scratch_merchant.js create   -> inserts a scratch tbl_user, prints id+email
 *   node scratch_merchant.js delete    -> hard-deletes any scratch_admin_test_* rows
 * Direct SQL INSERT bypasses Sequelize afterCreate hooks (no account provisioning).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

const PREFIX = "scratch_admin_test_";

(async () => {
  const mode = process.argv[2] || "create";
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();

  if (mode === "create") {
    const email = `${PREFIX}${Date.now()}@dynopay-test.invalid`;
    const r = await c.query(
      `INSERT INTO tbl_user (name, first_name, last_name, email, status, login_type, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'active','EMAIL', now(), now()) RETURNING user_id`,
      ["Scratch Test Merchant", "Scratch", "Merchant", email]
    );
    console.log(`USER_ID=${r.rows[0].user_id}`);
    console.log(`EMAIL=${email}`);
  } else if (mode === "delete") {
    const r = await c.query(`DELETE FROM tbl_user WHERE email LIKE $1 RETURNING user_id`, [`${PREFIX}%`]);
    console.log(`DELETED=${r.rowCount} rows:`, r.rows.map((x) => x.user_id).join(","));
  }

  await c.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
