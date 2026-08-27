/* Session 74 — one-shot schema-drift repair for LIVE Railway PG.
 *
 * BUG: dynopay.com login returns 500 "column \"display_currency\" does not exist"
 * because backend/models/userModels/userModel.ts (and companyModel.ts) declare 22+
 * columns that were never migrated onto the production DB. Every Sequelize
 * userModel.findOne() without an explicit `attributes: [...]` list therefore
 * throws a SequelizeDatabaseError → 500.
 *
 * FIX: additive ALTER TABLE … ADD COLUMN IF NOT EXISTS for each missing col,
 * matching the Sequelize type + nullability + default from the model files.
 * No data mutation. No table lock. No downtime.
 *
 * Run: cd /app/backend && node scripts/session74_fix_schema_drift.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const USER_STATEMENTS = [
  // Doc-3 workstream E — per-user display currency
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3)`,

  // Localization + tax defaults
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en'`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS default_apply_tax BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS default_tax_inclusive BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS merchant_country_code VARCHAR(2)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS merchant_vat_id VARCHAR(32)`,

  // Creator vanity page (dynopay.com/{handle})
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS handle VARCHAR(50)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS bio VARCHAR(500)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS creator_page_enabled BOOLEAN DEFAULT false`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb`,

  // Support widget (creator tip / buy-me-a-coffee)
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_enabled BOOLEAN DEFAULT false`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_style VARCHAR(20) DEFAULT 'coffee'`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_label VARCHAR(80)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_preset_amounts JSONB DEFAULT '[3,5,10,25]'::jsonb`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_currency VARCHAR(10) DEFAULT 'USD'`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_min_amount DECIMAL(10,2) DEFAULT 1`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_allow_message BOOLEAN DEFAULT true`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_thanks_message TEXT`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_show_supporters BOOLEAN DEFAULT true`,

  // Creator theme (Session 60)
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(9)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS theme_cover_style VARCHAR(20)`,
  `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS theme_cover_gradient VARCHAR(60)`,
];

const COMPANY_STATEMENTS = [
  // Merchant contact name (independent of user.name)
  `ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS contact_first_name VARCHAR(255)`,
  `ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS contact_last_name VARCHAR(255)`,

  // Webhook circuit breaker (Session 49)
  `ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS webhook_disabled BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS webhook_disabled_at TIMESTAMP WITH TIME ZONE`,
  `ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS webhook_disabled_reason VARCHAR(500)`,

  // Merchant dashboard display currency (Doc-3 workstream E)
  `ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3)`,
];

const COMPANY_BACKFILL = [
  `UPDATE tbl_company c
     SET display_currency = COALESCE(
       (SELECT UPPER(a.base_currency) FROM tbl_api a
         WHERE a.company_id = c.company_id
           AND UPPER(a.base_currency) IN ('USD','EUR','GBP','NGN','CAD','AUD')
         ORDER BY (CASE WHEN a.status = 'active' THEN 0 ELSE 1 END),
                  (CASE WHEN a.environment = 'production' THEN 0 ELSE 1 END),
                  a."createdAt" DESC
         LIMIT 1),
       'USD')
     WHERE c.display_currency IS NULL`,
];

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
  console.log(`[session74] Connected to ${process.env.HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

  const runBatch = async (label, stmts) => {
    console.log(`\n=== ${label} — ${stmts.length} statement(s) ===`);
    for (const s of stmts) {
      const summary = s.replace(/\s+/g, " ").slice(0, 100);
      try {
        await client.query(s);
        console.log(`OK: ${summary}`);
      } catch (e) {
        console.error(`FAIL: ${summary} -> ${e.message}`);
        throw e;
      }
    }
  };

  try {
    await client.query("BEGIN");
    await runBatch("tbl_user additive columns", USER_STATEMENTS);
    await runBatch("tbl_company additive columns", COMPANY_STATEMENTS);
    await runBatch("tbl_company display_currency backfill", COMPANY_BACKFILL);
    await client.query("COMMIT");
    console.log("\n✅ All schema drift repaired. Committed.");

    // Verification
    const verifyUser = await client.query(
      `SELECT column_name FROM information_schema.columns
         WHERE table_name='tbl_user' AND column_name IN
         ('display_currency','handle','bio','support_widget_enabled','theme_accent_color',
          'language','default_apply_tax','merchant_country_code','cover_image','social_links')
       ORDER BY column_name`
    );
    const verifyCompany = await client.query(
      `SELECT column_name FROM information_schema.columns
         WHERE table_name='tbl_company' AND column_name IN
         ('display_currency','contact_first_name','contact_last_name',
          'webhook_disabled','webhook_disabled_at','webhook_disabled_reason')
       ORDER BY column_name`
    );
    console.log("\nVERIFY tbl_user new cols present:", verifyUser.rows.map((r) => r.column_name).join(", "));
    console.log("VERIFY tbl_company new cols present:", verifyCompany.rows.map((r) => r.column_name).join(", "));

    // Confirm login flow works (userModel.findOne with default * SELECT)
    const smoke = await client.query(
      `SELECT user_id, email, display_currency, handle, support_widget_enabled, theme_accent_color
         FROM tbl_user WHERE user_id = 1`
    );
    console.log("\nSMOKE TEST userModel row (user_id=1):", smoke.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("\n❌ MIGRATION FAILED — rolled back:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("MIGRATION ERROR:", e.message);
  process.exit(1);
});
