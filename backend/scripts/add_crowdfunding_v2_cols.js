/* Phase 3 (Session 44) — crowdfunding GoFundMe-lite additive migration.
 *
 * Adds:
 *   - donation_story_md TEXT              — Markdown campaign body
 *   - donation_gallery JSONB DEFAULT '[]' — array of { url, caption } photos
 *   - donation_ends_at TIMESTAMPTZ        — optional campaign end date for countdown
 *   - donation_category VARCHAR(48)       — medical / community / creative / emergency / education / other
 *   - donation_organizer_thanks TEXT      — custom post-contribution thank-you
 *   - donation_beneficiary JSONB          — { name, description } (optional)
 *   - refund_address VARCHAR(255)         — CleanCheckoutV2 refund-address field (Phase 1)
 *
 * All ADD COLUMN IF NOT EXISTS. Idempotent — safe to re-run. Non-destructive.
 * Nothing about existing rows changes. No new tables in this migration; the
 * donor-wall public projection uses the existing tbl_payment_link contribution
 * rows. Updates feed and tiers deferred to a follow-up migration.
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
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donation_story_md TEXT",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donation_gallery JSONB DEFAULT '[]'::jsonb",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donation_ends_at TIMESTAMPTZ",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donation_category VARCHAR(48)",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donation_organizer_thanks TEXT",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donation_beneficiary JSONB",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS refund_address VARCHAR(255)",
  ];
  for (const s of stmts) {
    try {
      await client.query(s);
      console.log("OK:", s);
    } catch (e) {
      console.error("FAIL:", s, "->", e.message);
      throw e;
    }
  }
  const res = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tbl_payment_link' AND column_name IN ('donation_story_md','donation_gallery','donation_ends_at','donation_category','donation_organizer_thanks','donation_beneficiary','refund_address') ORDER BY column_name"
  );
  console.log("\nColumns added:");
  console.table(res.rows);
  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
