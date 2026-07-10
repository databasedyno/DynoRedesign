/* One-off additive migration: attachment columns on tbl_support_chat_message.
 * Safe: ADD COLUMN IF NOT EXISTS, nullable, no defaults, no rewrites. */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

(async () => {
  const client = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const stmts = [
    'ALTER TABLE tbl_support_chat_message ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(512)',
    'ALTER TABLE tbl_support_chat_message ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)',
    'ALTER TABLE tbl_support_chat_message ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(64)',
  ];
  for (const s of stmts) {
    await client.query(s);
    console.log("OK:", s);
  }
  const res = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tbl_support_chat_message' ORDER BY ordinal_position"
  );
  console.table(res.rows);
  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
