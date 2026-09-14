import sequelize from '../utils/dbInstance';

async function addApplyTaxColumn() {
  try {
    await sequelize.query(`
      ALTER TABLE tbl_payment_link 
      ADD COLUMN IF NOT EXISTS apply_tax BOOLEAN DEFAULT false NOT NULL
    `);
    console.log('✅ apply_tax column added to tbl_payment_link');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ apply_tax column already exists');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
  process.exit(0);
}

addApplyTaxColumn();
