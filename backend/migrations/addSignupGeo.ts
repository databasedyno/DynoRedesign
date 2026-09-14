import "dotenv/config";
import sequelize from '../utils/dbInstance';

/**
 * Additive, idempotent migration.
 *
 * Adds `signup_ip` + `signup_country` to `tbl_user` so the REAL client IP and
 * country are captured at account creation. This makes fraud / abuse
 * investigations take minutes instead of hours (you no longer have to
 * reconstruct where an account originated from log spelunking).
 *
 * NULL for every pre-existing user — only new signups populate the columns,
 * and a later login never overwrites them (see utils/clientContext.ts). Fully
 * backwards compatible: nothing reads these columns as required.
 */
async function addSignupGeo() {
  try {
    await sequelize.query(
      `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS signup_ip VARCHAR(45)`,
    );
    await sequelize.query(
      `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS signup_country VARCHAR(64)`,
    );
    console.log('✅ signup_ip + signup_country columns added to tbl_user');
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
      console.log('✅ signup geo columns already exist');
    } else {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addSignupGeo();
