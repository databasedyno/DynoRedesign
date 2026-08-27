/* One-off admin helper to read / clear a user's creator handle on the
 * Railway Postgres (used ONLY to release the test handle after verifying the
 * reserve-confirmation fix — user approved reserve-then-release on hostbay).
 *
 * Usage (run from /app/backend so `pg` resolves):
 *   node ../scripts/creator_handle_admin.js read  <user_id>
 *   node ../scripts/creator_handle_admin.js clear <user_id>
 */
const path = require("path");
const fs = require("fs");

// Read DATABASE_URL straight from backend/.env (avoids dotenv dependency
// resolution issues when running this script from /app/scripts).
function readEnv(key) {
  const envPath = path.join(__dirname, "..", "backend", ".env");
  const txt = fs.readFileSync(envPath, "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) {
      return m[2].replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}
const DATABASE_URL = readEnv("DATABASE_URL");
const { Client } = require(path.join(__dirname, "..", "backend", "node_modules", "pg"));

const [, , cmd, userIdArg] = process.argv;
const userId = parseInt(userIdArg, 10);

(async () => {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  if (!["read", "clear"].includes(cmd) || !Number.isFinite(userId)) {
    console.error("Usage: node creator_handle_admin.js <read|clear> <user_id>");
    process.exit(1);
  }
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    if (cmd === "read") {
      const r = await client.query(
        'SELECT user_id, email, handle, creator_page_enabled FROM tbl_user WHERE user_id = $1',
        [userId],
      );
      console.log(JSON.stringify(r.rows[0] || null));
    } else if (cmd === "clear") {
      const before = await client.query(
        'SELECT handle, creator_page_enabled FROM tbl_user WHERE user_id = $1',
        [userId],
      );
      const r = await client.query(
        'UPDATE tbl_user SET handle = NULL, creator_page_enabled = false WHERE user_id = $1 RETURNING user_id, handle, creator_page_enabled',
        [userId],
      );
      console.log("BEFORE:", JSON.stringify(before.rows[0] || null));
      console.log("AFTER :", JSON.stringify(r.rows[0] || null));
    }
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
