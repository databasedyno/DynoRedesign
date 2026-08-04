/* One-off backfill: mark all Google OAuth users as email_verified=true.
 *
 * Rationale: googleSignIn previously created users WITHOUT email_verified=true
 * (unlike the GitHub flow), so the emailVerifiedMiddleware blocked previously
 * onboarded Google merchants with a "verify your email" 403. Google already
 * verifies email ownership as part of OAuth, so these rows are safe to trust.
 *
 * Idempotent: only touches login_type='GOOGLE' rows that are not already
 * verified. Prints affected counts. No schema change, no table lock.
 *
 * Run: cd /app/backend && node scripts/backfill_google_email_verified.js
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

  // 1) Report how many Google rows are currently unverified.
  const before = await client.query(
    `SELECT COUNT(*)::int AS n
       FROM tbl_user
      WHERE login_type = 'GOOGLE'
        AND (email_verified IS DISTINCT FROM true)`
  );
  console.log(`Google users needing backfill: ${before.rows[0].n}`);

  // 2) Backfill (idempotent — only unverified Google rows with an email on file).
  const res = await client.query(
    `UPDATE tbl_user
        SET email_verified = true
      WHERE login_type = 'GOOGLE'
        AND email IS NOT NULL
        AND (email_verified IS DISTINCT FROM true)`
  );
  console.log(`OK: set email_verified=true on ${res.rowCount} Google user row(s)`);

  // 3) Distribution sanity check.
  const dist = await client.query(
    `SELECT login_type,
            COALESCE(email_verified::text, '(null)') AS email_verified,
            COUNT(*)::int AS n
       FROM tbl_user
      GROUP BY 1, 2
      ORDER BY 1, 2`
  );
  console.table(dist.rows);

  await client.end();
})().catch((e) => {
  console.error("BACKFILL FAILED:", e.message);
  process.exit(1);
});
