import sequelize from '../utils/dbInstance';

/**
 * Additive, idempotent migration for the product "one-off service" flag.
 *
 * tbl_product.hide_quantity BOOLEAN NOT NULL DEFAULT false
 *   When true the storefront hides the quantity stepper and cart/checkout
 *   force quantity = 1 (e.g. "Talk to a Developer" — a service, not a SKU you
 *   buy N of).
 *
 * Safe to re-run: uses IF NOT EXISTS.
 */
async function addProductHideQuantity() {
  try {
    await sequelize.query(
      `ALTER TABLE tbl_product ADD COLUMN IF NOT EXISTS hide_quantity BOOLEAN NOT NULL DEFAULT false`
    );
    console.log('✅ tbl_product.hide_quantity added');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ tbl_product.hide_quantity already exists');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addProductHideQuantity();
