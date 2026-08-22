import sequelize from '../utils/dbInstance';

/**
 * Adds the nullable `display_currency` VARCHAR(3) column to tbl_company.
 *
 * The Session-39 dashboard display-currency feature shipped code that reads
 * (utils/currencyUtils.ts::getCompanyDisplayCurrency) and writes
 * (companyController.updateDisplayCurrency) tbl_company.display_currency, but
 * the migration to add the column was never created — so on databases without
 * it the SELECT threw "column does not exist" on every dashboard load and the
 * UPDATE 500'd. This backfills the missing column. Idempotent
 * (ADD COLUMN IF NOT EXISTS) and non-destructive (nullable, no default).
 */
async function addDisplayCurrencyColumn() {
  try {
    await sequelize.query(`
      ALTER TABLE tbl_company
      ADD COLUMN IF NOT EXISTS display_currency VARCHAR(3)
    `);
    console.log('✅ display_currency column ready on tbl_company');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ display_currency column already exists');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
  process.exit(0);
}

addDisplayCurrencyColumn();
