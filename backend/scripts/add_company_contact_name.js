/* Additive migration: tbl_company.contact_first_name / contact_last_name.
 *
 * Solution B for the "company name clobber" bug: each company now stores its OWN
 * contact person, decoupled from the account-level tbl_user.name. This stops a
 * 2nd company's first/last name from overwriting the name shown in another
 * company's merchant emails.
 *
 * Safe: ADD COLUMN IF NOT EXISTS (nullable, no default → no table rewrite/lock).
 * Idempotent. Non-destructive. Safe to rerun.
 *
 * Also performs a ONE-OFF account-name correction requested for the primary
 * account (user_id=1): set tbl_user.name = 'hostbay' (only if it differs), because
 * an earlier run of the buggy code overwrote it. Guarded + idempotent.
 *
 * Run: cd /app/backend && node scripts/add_company_contact_name.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

(async () => {
  const client = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1) Add per-company contact columns (idempotent, nullable)
  await client.query(
    "ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS contact_first_name VARCHAR(255)"
  );
  await client.query(
    "ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS contact_last_name VARCHAR(255)"
  );
  console.log("OK: columns contact_first_name + contact_last_name ensured on tbl_company");

  // 2) One-off account-name correction for the primary account (user_id=1).
  //    User-approved: the account display name should be 'hostbay'.
  const fix = await client.query(
    "UPDATE tbl_user SET name = 'hostbay' WHERE user_id = 1 AND name IS DISTINCT FROM 'hostbay' RETURNING user_id, name"
  );
  if (fix.rowCount > 0) {
    console.log(`OK: corrected account name for user_id=1 -> 'hostbay'`);
  } else {
    console.log("OK: account name for user_id=1 already 'hostbay' (or user missing) — no change");
  }

  // 3) Report current contact-column presence + a small sample
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'tbl_company'
        AND column_name IN ('contact_first_name','contact_last_name')
      ORDER BY column_name`
  );
  console.table(cols.rows);

  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
