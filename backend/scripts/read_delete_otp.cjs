/* QA helper: fetch the pending ACCOUNT-DELETE OTP for an email.
 * Looks up the user_id in Postgres, then reads account_delete_otp_<userId>:json
 * from the app's Redis. Prints just the 6-digit code.
 * Usage: node backend/scripts/read_delete_otp.cjs <email>
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");
const { createClient } = require("redis");

(async () => {
  const email = (process.argv[2] || "").toLowerCase().trim();
  if (!email) { console.error("email required"); process.exit(2); }

  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await pg.connect();
  const u = await pg.query(`SELECT user_id FROM tbl_user WHERE lower(email) = $1`, [email]);
  await pg.end();
  if (!u.rows.length) { console.error("no such user"); process.exit(1); }
  const userId = u.rows[0].user_id;

  const c = createClient({ url: process.env.REDIS_PUBLIC_URL.trim() });
  c.on("error", () => {});
  await c.connect();
  const v = await c.get(`account_delete_otp_${userId}:json`);
  await c.quit();
  process.stdout.write(v ? (JSON.parse(v).otp || "") : "");
})();
