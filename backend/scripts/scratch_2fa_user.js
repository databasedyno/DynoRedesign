/* TEST-ONLY reversible scratch merchant for verifying the TOTP 2FA lifecycle
 * against the LIVE DB without touching real merchants.
 * Usage:
 *   node scratch_2fa_user.js create   -> inserts an active tbl_user w/ bcrypt password, prints id+email+password
 *   node scratch_2fa_user.js delete   -> hard-deletes scratch_2fa_test_* users + their 2fa/session/login rows
 * Direct SQL INSERT bypasses Sequelize afterCreate hooks (no account provisioning).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const PREFIX = "scratch_2fa_test_";
const PASSWORD = "Scratch2FA!Test123";

(async () => {
  const mode = process.argv[2] || "create";
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();

  if (mode === "create") {
    const email = `${PREFIX}${Date.now()}@example.com`;
    const hash = bcrypt.hashSync(PASSWORD, 12);
    const r = await c.query(
      `INSERT INTO tbl_user (name, first_name, last_name, email, password, status, login_type, email_verified, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'active','EMAIL', true, now(), now()) RETURNING user_id`,
      ["Scratch 2FA Merchant", "Scratch", "TwoFA", email, hash]
    );
    console.log(`USER_ID=${r.rows[0].user_id}`);
    console.log(`EMAIL=${email}`);
    console.log(`PASSWORD=${PASSWORD}`);
  } else if (mode === "delete") {
    const users = await c.query(`SELECT user_id FROM tbl_user WHERE email LIKE $1`, [`${PREFIX}%`]);
    const ids = users.rows.map((x) => x.user_id);
    if (ids.length) {
      for (const t of ["tbl_user_2fa", "tbl_user_session", "tbl_login_activities", "tbl_login_history", "tbl_security_log"]) {
        try {
          const d = await c.query(`DELETE FROM ${t} WHERE user_id = ANY($1::int[])`, [ids]);
          console.log(`${t}: -${d.rowCount}`);
        } catch (e) {
          console.log(`${t}: skipped (${e.message.split("\n")[0]})`);
        }
      }
    }
    const r = await c.query(`DELETE FROM tbl_user WHERE email LIKE $1 RETURNING user_id`, [`${PREFIX}%`]);
    console.log(`DELETED=${r.rowCount} users:`, r.rows.map((x) => x.user_id).join(","));
  }

  await c.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
