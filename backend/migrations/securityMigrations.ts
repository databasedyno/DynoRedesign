import type { Migration } from "../utils/migrationRunner";

/**
 * 0031 — Mandatory 2FA + Binance-style sessions.
 *   - tbl_user.mfa_deadline_at: 14-day grace deadline for existing accounts (set on first sign-in).
 *   - tbl_user_2fa.secret nullable: the EMAIL-CODE baseline has no TOTP secret.
 *   - tbl_trusted_device: browsers that skip the 2FA challenge (90 rolling days).
 *   - tbl_security_event: admin timeline (2FA resets, wallet freeze/unfreeze).
 */
async function upMandatory2FA(): Promise<void> {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS mfa_deadline_at TIMESTAMPTZ`);
  await sequelize.query(`ALTER TABLE tbl_user_2fa ALTER COLUMN secret DROP NOT NULL`);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS tbl_trusted_device (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      device_name VARCHAR(120),
      browser VARCHAR(60),
      os VARCHAR(60),
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    )`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_trusted_device_user ON tbl_trusted_device(user_id, revoked_at)`);
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS tbl_security_event (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type VARCHAR(40) NOT NULL,
      severity VARCHAR(10) NOT NULL DEFAULT 'info',
      summary VARCHAR(500) NOT NULL,
      meta JSONB,
      freeze_until TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolved_by VARCHAR(120),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_security_event_created ON tbl_security_event(created_at DESC)`);
  await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_security_event_user ON tbl_security_event(user_id)`);
}

export const securityMigrations: Migration[] = [
  { version: "0031_mandatory_2fa_trusted_devices", up: upMandatory2FA },
];
