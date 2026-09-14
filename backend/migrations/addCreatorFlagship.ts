import sequelize from '../utils/dbInstance';

/**
 * Additive, idempotent migration for the Creator Vanity Page — "Flagship" phase.
 * Adds:
 *   - cover_image  VARCHAR(500)  — public banner shown behind the avatar
 *   - social_links JSONB DEFAULT '{}'::jsonb  — {twitter, instagram, youtube, tiktok, website}
 *
 * Safe to re-run: uses IF NOT EXISTS.
 */
async function addCreatorFlagship() {
  try {
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500)`);
    await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb`);
    console.log('✅ Creator flagship columns added to tbl_user (cover_image, social_links)');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ Creator flagship columns already exist');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addCreatorFlagship();
