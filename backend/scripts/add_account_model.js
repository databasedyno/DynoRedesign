/* Additive migration: the "Account" foundation.
 *
 * WHY
 * ---
 * DynoPay currently has three competing ideas of "who owns this": tbl_user
 * (login), tbl_company (business) and tbl_product.merchant_user_id (a third
 * convention). A user is NOT given a company at signup — companies are only
 * created by an explicit action — yet invoices, customers, payment_journal,
 * webhook_delivery_log and api_usage_log are company-scoped ONLY. So an
 * individual creator can hold a wallet and take a payment but can never be
 * invoiced-from or have customers. See docs/IA_AUDIT_2026-08.md §1.
 *
 * Founder decision (2026-08-12): DynoPay serves BOTH individuals and
 * businesses, so the Account becomes the single tenant and "Company" becomes an
 * optional business profile on it. Teams are wanted soon, so the membership
 * table is introduced NOW rather than retrofitted later.
 *
 * WHAT THIS DOES (all additive — nothing is renamed, moved or dropped)
 *   1. tbl_company.account_type  -> 'individual' | 'business'   (default 'business')
 *   2. tbl_account_member        -> the membership/teams join table
 *   3. seeds one role='owner' member row per existing company
 *
 * SAFETY
 *   - ADD COLUMN IF NOT EXISTS, nullable, with a default => no table rewrite, no lock.
 *   - CREATE TABLE IF NOT EXISTS + UNIQUE(company_id, user_id).
 *   - The seed uses ON CONFLICT DO NOTHING, so rerunning changes nothing.
 *   - Fully idempotent. Safe to rerun. Non-destructive.
 *   - Deliberately does NOT touch tbl_product.merchant_user_id — that is P1,
 *     and it needs an add-column + backfill + dual-write of its own.
 *
 * DO NOT use `yarn migrate` for this: that runs sequelize.sync({ alter: true }),
 * which lets Sequelize rewrite the live schema to match the models. Never point
 * that at a production payments database.
 *
 * Run: cd /app/backend && node scripts/add_account_model.js
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

  // ── 1. account_type on tbl_company ────────────────────────────────────────
  // Nullable + DEFAULT (rather than NOT NULL) so the statement can never fail
  // on unexpected existing data; readers COALESCE to 'business'.
  await client.query(
    "ALTER TABLE tbl_company ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'business'"
  );
  const typed = await client.query(
    "UPDATE tbl_company SET account_type = 'business' WHERE account_type IS NULL RETURNING company_id"
  );
  console.log(
    `OK: tbl_company.account_type ensured (backfilled ${typed.rowCount} existing row(s) to 'business')`
  );

  // ── 2. membership / teams table ───────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS tbl_account_member (
      member_id   SERIAL PRIMARY KEY,
      company_id  INTEGER NOT NULL REFERENCES tbl_company(company_id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES tbl_user(user_id)       ON DELETE CASCADE,
      role        VARCHAR(20) NOT NULL DEFAULT 'owner',
      status      VARCHAR(20) NOT NULL DEFAULT 'active',
      invited_by  INTEGER NULL REFERENCES tbl_user(user_id)           ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tbl_account_member_company_user_unique UNIQUE (company_id, user_id)
    )
  `);
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_account_member_user ON tbl_account_member(user_id)"
  );
  await client.query(
    "CREATE INDEX IF NOT EXISTS idx_account_member_company ON tbl_account_member(company_id)"
  );
  console.log("OK: tbl_account_member ensured (+ indexes on user_id, company_id)");

  // ── 3. every existing company gets its owner membership row ───────────────
  const seeded = await client.query(`
    INSERT INTO tbl_account_member (company_id, user_id, role, status)
    SELECT c.company_id, c.user_id, 'owner', 'active'
      FROM tbl_company c
     WHERE c.user_id IS NOT NULL
    ON CONFLICT (company_id, user_id) DO NOTHING
    RETURNING member_id, company_id, user_id
  `);
  console.log(`OK: seeded ${seeded.rowCount} owner membership row(s) (existing rows untouched)`);

  // ── report ────────────────────────────────────────────────────────────────
  const report = await client.query(`
    SELECT c.company_id,
           c.company_name,
           c.user_id AS owner_user_id,
           COALESCE(c.account_type, 'business') AS account_type,
           (SELECT COUNT(*)::int FROM tbl_account_member m WHERE m.company_id = c.company_id) AS members
      FROM tbl_company c
     ORDER BY c.company_id
  `);
  console.table(report.rows);

  await client.end();
  console.log("\nDONE — schema foundation in place. Data backfill is a separate, opt-in step:");
  console.log("  node scripts/backfill_personal_accounts.js            (dry run)");
  console.log("  node scripts/backfill_personal_accounts.js --apply    (writes)");
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
