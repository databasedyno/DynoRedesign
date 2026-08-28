import sequelize from '../../utils/dbInstance';

/**
 * Additive, idempotent migration — 2026-08-05 design audit Phase 3 wiring.
 *
 * Adds `purpose_vertical` to `tbl_user`. Captured during signup by the new
 * PurposePicker (`/app/Components/UI/AuthLayout/PurposePicker.tsx`); reveals
 * which of the four Dynopay verticals the merchant identifies with:
 *
 *   'merchants'   — sells products, storefront + pay-links + invoices
 *   'fundraisers' — runs donation / crowdfunding campaigns
 *   'creators'    — collects tips through @handle page
 *   'developers'  — building on the API
 *
 * NULL is a valid state — pre-existing users signed up before this column
 * existed and users who skip the picker have no explicit intent yet. The
 * frontend `useVerticalAccent()` hook falls back to route detection when
 * the DB value is NULL, so nothing breaks for legacy users.
 *
 * CHECK constraint keeps the column narrow — only the four known verticals
 * (plus NULL) are accepted. Anything else raises at the DB level so we
 * catch typos in future controllers.
 */
async function addPurposeVertical() {
  try {
    await sequelize.query(
      `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS purpose_vertical VARCHAR(20)`
    );
    // Named constraint so we can detect + skip it on re-run without hitting
    // Postgres's "constraint already exists" error.
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tbl_user_purpose_vertical_chk'
        ) THEN
          ALTER TABLE tbl_user
            ADD CONSTRAINT tbl_user_purpose_vertical_chk
            CHECK (purpose_vertical IS NULL OR purpose_vertical IN ('merchants','fundraisers','creators','developers'));
        END IF;
      END $$;
    `);
    console.log('✅ purpose_vertical column + CHECK constraint added to tbl_user');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ purpose_vertical column already exists');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addPurposeVertical();
