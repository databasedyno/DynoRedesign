import sequelize from '../../utils/dbInstance';

/**
 * Per-Company Tax (2026-08-23) — adds nullable tax-settings columns to
 * tbl_company so each business entity keeps its own VAT ID + tax defaults.
 *
 * Semantics: `tax_configured = false` (default) means the company INHERITS the
 * account-level values on tbl_user (legacy behavior, zero change at rollout).
 * The first PATCH /api/user/tax-settings for a company seeds all four fields
 * from the resolved values and flips tax_configured = true, after which the
 * company's own values are authoritative (including an explicitly-empty VAT).
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS) and non-destructive (all nullable /
 * defaulted; no existing rows or columns are touched).
 */
async function addCompanyTaxSettings() {
  try {
    await sequelize.query(`
      ALTER TABLE tbl_company
      ADD COLUMN IF NOT EXISTS default_apply_tax BOOLEAN,
      ADD COLUMN IF NOT EXISTS default_tax_inclusive BOOLEAN,
      ADD COLUMN IF NOT EXISTS merchant_country_code VARCHAR(2),
      ADD COLUMN IF NOT EXISTS merchant_vat_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS tax_configured BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('✅ per-company tax columns ready on tbl_company');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ per-company tax columns already exist');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addCompanyTaxSettings();
