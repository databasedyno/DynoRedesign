/* One-off additive migration: tbl_user.display_currency (Doc-3 workstream E).
 *
 * Per-user override for the dashboard display currency. Resolution chain:
 *   1. tbl_user.display_currency   (this migration adds it)
 *   2. tbl_company.display_currency (already shipped)
 *   3. legacy API-key base_currency
 *   4. 'USD'
 *
 * This lets individual users inside a multi-seat company view amounts in
 * their own preferred currency (e.g. a UK employee sees GBP while the
 * company default is USD) without touching pricing or stored data — it's
 * purely a display transformation.
 *
 * Idempotent: ADD COLUMN IF NOT EXISTS. No backfill needed (NULL = fall
 * through to company preference — safe default).
 *
 * Run: cd /app/backend && node scripts/add_user_display_currency.js
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

  const stmts = [
    // Additive column — nullable so NULL = "fall through to company pref"
    `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3)`,
  ];

  for (const s of stmts) {
    try {
      await client.query(s);
      console.log("OK:", s.split("\n")[0].slice(0, 90));
    } catch (e) {
      console.error("FAIL:", s.split("\n")[0].slice(0, 90), "->", e.message);
      throw e;
    }
  }

  const { rows } = await client.query(
    `SELECT COUNT(*) AS n FROM tbl_user WHERE display_currency IS NOT NULL`
  );
  console.log(`\ntbl_user.display_currency populated on ${rows[0].n} rows (NULL = inherit from company).`);
  console.log("✅ Migration complete. Per-user display currency is live.");

  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
