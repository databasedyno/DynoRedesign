import sequelize from '../utils/dbInstance';

// Additive, idempotent migration for the Creator Vanity Page feature.
// Adds a public handle (dynopay.me/{handle}), a short bio, and an enable flag.
async function addCreatorHandle() {
  try {
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS handle VARCHAR(50)`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS bio VARCHAR(500)`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS creator_page_enabled BOOLEAN DEFAULT false`);
    // Case-insensitive uniqueness; allows many NULLs (users without a handle).
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tbl_user_handle_lower ON tbl_user (LOWER(handle)) WHERE handle IS NOT NULL`
    );
    console.log('✅ Creator handle columns + unique index added to tbl_user');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ Creator handle columns already exist');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addCreatorHandle();
