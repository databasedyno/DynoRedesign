/* Additive migration: tbl_user.public_analytics_enabled BOOLEAN DEFAULT TRUE.
 *
 * Session 2026-08-05: adds a per-creator toggle that controls whether the
 * Creator Page Analytics widget (30-day tip chart + top supporters) is shown
 * publicly on their /:handle page. Merchants can hide it while still seeing
 * their own private analytics in /creator settings.
 *
 * DEFAULT TRUE — every existing creator gets analytics visible by default
 * (the widget is opt-out from public visibility, opt-in via the toggle in
 * settings). Any creator who prefers privacy can flip it off with one click.
 *
 * Safe: ADD COLUMN IF NOT EXISTS with a DEFAULT + NOT NULL. Postgres 11+ (Railway
 * uses PG 15+) treats a DEFAULT value on ADD COLUMN as metadata-only —
 * NO full-table rewrite / long lock. Idempotent + non-destructive + safe to
 * rerun.
 *
 * Run: cd /app/backend && node scripts/add_public_analytics_enabled.js
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

  await client.query(
    "ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS public_analytics_enabled BOOLEAN NOT NULL DEFAULT TRUE"
  );
  console.log("OK: column public_analytics_enabled ensured on tbl_user (default TRUE)");

  // Report current column presence + a small sample
  const cols = await client.query(
    `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns
      WHERE table_name = 'tbl_user'
        AND column_name = 'public_analytics_enabled'`
  );
  console.table(cols.rows);

  const sample = await client.query(
    `SELECT user_id, handle, creator_page_enabled, public_analytics_enabled
       FROM tbl_user
      WHERE handle IS NOT NULL
      ORDER BY user_id ASC
      LIMIT 5`
  );
  console.table(sample.rows);

  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
