/* Phase 3.2 (Session 44) — crowdfunding GoFundMe-lite — donor wall + tiers + updates.
 *
 * Adds:
 *   - tbl_donation_tier            — milestone reward tiers per campaign
 *   - tbl_donation_update          — organizer updates feed per campaign
 *   - organizer_reply column        — optional public reply on each contribution row
 *
 * Idempotent (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS).
 * Non-destructive. Safe to rerun.
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
    // ── tbl_donation_tier ───────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_donation_tier (
      tier_id           BIGSERIAL PRIMARY KEY,
      parent_link_id    BIGINT NOT NULL REFERENCES tbl_payment_link(link_id) ON DELETE CASCADE,
      min_amount        DECIMAL(14, 2) NOT NULL,
      title             VARCHAR(200) NOT NULL,
      description       TEXT,
      image_url         VARCHAR(512),
      "order"           INTEGER DEFAULT 0,
      is_active         BOOLEAN DEFAULT TRUE,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_donation_tier_parent ON tbl_donation_tier(parent_link_id, "order")`,

    // ── tbl_donation_update ─────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS tbl_donation_update (
      update_id         BIGSERIAL PRIMARY KEY,
      campaign_link_id  BIGINT NOT NULL REFERENCES tbl_payment_link(link_id) ON DELETE CASCADE,
      author_user_id    BIGINT NOT NULL,
      title             VARCHAR(200) NOT NULL,
      body_md           TEXT NOT NULL,
      image_url         VARCHAR(512),
      is_published      BOOLEAN DEFAULT TRUE,
      notify_contributors BOOLEAN DEFAULT FALSE,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_donation_update_campaign ON tbl_donation_update(campaign_link_id, "createdAt" DESC)`,

    // ── organizer_reply on contribution rows ─────────────────────────────
    `ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS organizer_reply TEXT`,
    `ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS organizer_reply_at TIMESTAMPTZ`,
  ];

  for (const s of stmts) {
    try {
      await client.query(s);
      console.log("OK:", s.split("\n")[0]);
    } catch (e) {
      console.error("FAIL:", s.split("\n")[0], "->", e.message);
      throw e;
    }
  }

  const [tiers] = (await client.query("SELECT count(*) FROM tbl_donation_tier")).rows;
  const [updates] = (await client.query("SELECT count(*) FROM tbl_donation_update")).rows;
  console.log(`\ntbl_donation_tier rows: ${tiers.count}`);
  console.log(`tbl_donation_update rows: ${updates.count}`);
  console.log(`tbl_payment_link.organizer_reply added.`);

  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
