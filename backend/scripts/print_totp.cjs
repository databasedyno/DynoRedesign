// Prints the CURRENT 6-digit TOTP code for a user (QA login helper).
// Usage: node scripts/print_totp.cjs [user_id]   (defaults to user_id=1)
// Codes rotate every 30s — run immediately before typing the code.
const { Client } = require("pg");
const { generateSync } = require("otplib");

const DBURL =
  "postgresql://postgres:IHCzCDslIsUZlzCvvjxfSWcChEiBtiCU@roundhouse.proxy.rlwy.net:23599/railway";

(async () => {
  const userId = Number(process.argv[2] || 1);
  const c = new Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query("select secret from tbl_user_2fa where user_id=$1", [userId]);
  await c.end();
  if (!r.rows.length || !r.rows[0].secret) {
    console.error(`No TOTP secret for user_id=${userId}`);
    process.exit(1);
  }
  console.log(generateSync({ secret: r.rows[0].secret, strategy: "totp" }));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
