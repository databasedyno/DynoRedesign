import sequelize from '../utils/dbInstance';

/**
 * Additive, idempotent migration for the Creator "Support Widget" (Tip / Buy-me-a-coffee).
 *
 * tbl_user — always-on support widget configuration (creator-exclusive):
 *   - support_widget_enabled        BOOLEAN  DEFAULT false
 *   - support_widget_style          VARCHAR(20) DEFAULT 'coffee'  ('coffee' | 'tip' | 'support')
 *   - support_widget_label          VARCHAR(80)                    custom heading override
 *   - support_widget_preset_amounts JSONB    DEFAULT '[3,5,10,25]'
 *   - support_widget_currency       VARCHAR(10) DEFAULT 'USD'
 *   - support_widget_min_amount     NUMERIC(10,2) DEFAULT 1
 *   - support_widget_allow_message  BOOLEAN  DEFAULT true
 *   - support_widget_thanks_message TEXT                            custom post-tip thank-you
 *   - support_widget_show_supporters BOOLEAN DEFAULT true
 *
 * tbl_payment_link — marks the hidden singleton "tip jar" donation parent per creator:
 *   - is_tip_jar                    BOOLEAN NOT NULL DEFAULT false
 *
 * Safe to re-run: uses IF NOT EXISTS.
 */
async function addSupportWidget() {
  try {
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_enabled BOOLEAN DEFAULT false`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_style VARCHAR(20) DEFAULT 'coffee'`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_label VARCHAR(80)`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_preset_amounts JSONB DEFAULT '[3,5,10,25]'::jsonb`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_currency VARCHAR(10) DEFAULT 'USD'`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_min_amount NUMERIC(10,2) DEFAULT 1`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_allow_message BOOLEAN DEFAULT true`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_thanks_message TEXT`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS support_widget_show_supporters BOOLEAN DEFAULT true`);

    await sequelize.query(`ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS is_tip_jar BOOLEAN NOT NULL DEFAULT false`);

    console.log('✅ Support widget columns added (tbl_user x9, tbl_payment_link.is_tip_jar)');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ Support widget columns already exist');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addSupportWidget();
