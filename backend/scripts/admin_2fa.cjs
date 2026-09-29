// Admin console 2FA helpers (SEC-002).
//
// print current admin TOTP:   node scripts/admin_2fa.cjs totp [admin_id]
// reset admin 2FA (re-enroll): node scripts/admin_2fa.cjs reset [admin_id]
// show admin 2FA status:       node scripts/admin_2fa.cjs status [admin_id]
//
// Reads the live DB connection from backend/.env (DATABASE_URL preferred).
// `reset` clears totp_secret/totp_enabled/backup codes + revokes sessions so the
// admin re-enrolls on next login — the recovery path if an authenticator is lost.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const { generateSync } = require("otplib");

function makeClient() {
  const url = process.env.DATABASE_URL;
  const reject = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";
  if (url) return new Client({ connectionString: url, ssl: { rejectUnauthorized: reject } });
  return new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: reject },
  });
}

(async () => {
  const cmd = (process.argv[2] || "totp").toLowerCase();
  const adminId = Number(process.argv[3] || 1);
  const c = makeClient();
  await c.connect();
  try {
    if (cmd === "reset") {
      await c.query(
        `UPDATE tbl_admin SET totp_secret=NULL, totp_enabled=false, totp_enrolled_at=NULL,
           totp_backup_codes=NULL, tokens_valid_after=NOW(), failed_login_count=0, locked_until=NULL
         WHERE admin_id=$1`,
        [adminId]
      );
      await c.query(
        `UPDATE tbl_admin_session SET revoked_at=NOW(), revoke_reason='2fa_reset'
         WHERE admin_id=$1 AND revoked_at IS NULL`,
        [adminId]
      );
      console.log(`Admin ${adminId}: 2FA reset. They will re-enroll on next login.`);
      return;
    }
    const r = await c.query(
      "select email, totp_secret, totp_enabled, totp_backup_codes from tbl_admin where admin_id=$1",
      [adminId]
    );
    if (!r.rows.length) {
      console.error(`No admin with admin_id=${adminId}`);
      process.exit(1);
    }
    const row = r.rows[0];
    if (cmd === "status") {
      console.log(
        JSON.stringify(
          {
            admin_id: adminId,
            email: row.email,
            totp_enabled: row.totp_enabled,
            backup_codes_remaining: Array.isArray(row.totp_backup_codes)
              ? row.totp_backup_codes.length
              : 0,
          },
          null,
          2
        )
      );
      return;
    }
    // totp
    if (!row.totp_secret) {
      console.error(`admin_id=${adminId} has not enrolled TOTP yet.`);
      process.exit(1);
    }
    console.log(generateSync({ secret: row.totp_secret, strategy: "totp" }));
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
