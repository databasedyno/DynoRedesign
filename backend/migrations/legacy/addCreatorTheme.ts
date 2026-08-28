import sequelize from '../../utils/dbInstance';

/**
 * Additive, idempotent migration for Creator "Custom Theme" (Session 60).
 *
 * tbl_user — creator page visual customization:
 *   - theme_accent_color    VARCHAR(9)   nullable   — CSS color for buttons/highlights (e.g. #CCFF00)
 *   - theme_cover_style     VARCHAR(20)  nullable   — one of: 'solid' | 'gradient' | 'image' | 'pattern'
 *   - theme_cover_gradient  VARCHAR(60)  nullable   — gradient preset key ('sunset','ocean','forest','twilight')
 *                                                     OR a custom "hex1,hex2" pair
 *
 * Safe to re-run: uses IF NOT EXISTS.
 */
async function addCreatorTheme() {
  try {
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS theme_accent_color VARCHAR(9)`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS theme_cover_style VARCHAR(20)`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS theme_cover_gradient VARCHAR(60)`);

    console.log('✅ Creator theme columns added to tbl_user (theme_accent_color, theme_cover_style, theme_cover_gradient)');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ Creator theme columns already exist');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addCreatorTheme();
