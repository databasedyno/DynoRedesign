/**
 * Migration — add tax-awareness columns across five tables.
 *
 * Session 57 "FIX ALL tax" work:
 *   - Merchant-level tax settings default (tbl_user)
 *   - Per-product tax category + override (tbl_product)
 *   - Tax-inclusive pricing option on payment links (tbl_payment_link)
 *   - Persist actual tax collected on the order row (tbl_product_order)
 *   - Persist actual tax collected on the settlement row (tbl_user_transaction)
 *
 * Dynopay is a PAYMENT PROCESSOR — we compute + collect, merchant remits.
 * All columns use IF NOT EXISTS so this is idempotent + zero-downtime.
 */
import sequelize from '../utils/dbInstance';

async function addTaxFields() {
  try {
    // ── tbl_user — merchant tax defaults ─────────────────────────────
    await sequelize.query(`
      ALTER TABLE tbl_user
      ADD COLUMN IF NOT EXISTS default_apply_tax BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS default_tax_inclusive BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS merchant_country_code VARCHAR(2) NULL,
      ADD COLUMN IF NOT EXISTS merchant_vat_id VARCHAR(32) NULL
    `);
    console.log('✅ tbl_user: default_apply_tax, default_tax_inclusive, merchant_country_code, merchant_vat_id');

    // ── tbl_product — per-product tax category + override ─────────────
    await sequelize.query(`
      ALTER TABLE tbl_product
      ADD COLUMN IF NOT EXISTS tax_category VARCHAR(20) NOT NULL DEFAULT 'digital',
      ADD COLUMN IF NOT EXISTS apply_tax_override BOOLEAN NULL
    `);
    // Constrain tax_category values (drop first to allow idempotent re-run)
    await sequelize.query(`
      ALTER TABLE tbl_product DROP CONSTRAINT IF EXISTS tbl_product_tax_category_check
    `);
    await sequelize.query(`
      ALTER TABLE tbl_product
      ADD CONSTRAINT tbl_product_tax_category_check
      CHECK (tax_category IN ('digital', 'physical', 'service', 'exempt'))
    `);
    console.log('✅ tbl_product: tax_category (digital|physical|service|exempt), apply_tax_override');

    // ── tbl_payment_link — tax-inclusive pricing ─────────────────────
    await sequelize.query(`
      ALTER TABLE tbl_payment_link
      ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false NOT NULL
    `);
    console.log('✅ tbl_payment_link: tax_inclusive');

    // ── tbl_product_order — persist tax details on the order ─────────
    await sequelize.query(`
      ALTER TABLE tbl_product_order
      ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) NULL,
      ADD COLUMN IF NOT EXISTS tax_label VARCHAR(20) NULL,
      ADD COLUMN IF NOT EXISTS tax_country_code VARCHAR(2) NULL,
      ADD COLUMN IF NOT EXISTS customer_vat_id VARCHAR(32) NULL,
      ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN DEFAULT false NOT NULL
    `);
    console.log('✅ tbl_product_order: tax_rate, tax_label, tax_country_code, customer_vat_id, reverse_charge, tax_inclusive');

    // ── tbl_user_transaction — persist tax collected at settlement ────
    // These get set by cryptoSettlement when the payment lands.
    await sequelize.query(`
      ALTER TABLE tbl_user_transaction
      ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(20,8) NULL,
      ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) NULL,
      ADD COLUMN IF NOT EXISTS tax_label VARCHAR(20) NULL,
      ADD COLUMN IF NOT EXISTS tax_country_code VARCHAR(2) NULL,
      ADD COLUMN IF NOT EXISTS customer_vat_id VARCHAR(32) NULL,
      ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT false NOT NULL
    `);
    console.log('✅ tbl_user_transaction: tax_amount, tax_rate, tax_label, tax_country_code, customer_vat_id, reverse_charge');

    console.log('\n🎉 All tax columns added successfully.');
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

addTaxFields();
