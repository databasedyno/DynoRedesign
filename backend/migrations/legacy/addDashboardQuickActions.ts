import sequelize from '../../utils/dbInstance';

/**
 * Adds the nullable `dashboard_quick_actions` JSONB column to tbl_user so
 * merchants can pin their 4 dashboard Quick Action shortcuts. Idempotent
 * (ADD COLUMN IF NOT EXISTS) and non-destructive.
 */
async function addDashboardQuickActionsColumn() {
  try {
    await sequelize.query(`
      ALTER TABLE tbl_user
      ADD COLUMN IF NOT EXISTS dashboard_quick_actions JSONB
    `);
    console.log('✅ dashboard_quick_actions column ready on tbl_user');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ dashboard_quick_actions column already exists');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
  process.exit(0);
}

addDashboardQuickActionsColumn();
