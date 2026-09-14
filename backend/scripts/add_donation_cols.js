/* One-off additive migration: donation / crowdfunding columns on tbl_payment_link.
 * Safe: ADD COLUMN IF NOT EXISTS, nullable or defaulted, no rewrites.
 *
 * link_type:        'standard' (default) | 'donation' (campaign parent) | 'contribution' (child payment row)
 * parent_link_id:   set on contribution rows -> points at the donation parent link_id
 * donor_* fields:   only used on contribution rows
 */
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
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS link_type VARCHAR(24) DEFAULT 'standard'",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS parent_link_id INTEGER",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS title VARCHAR(255)",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS goal_amount DOUBLE PRECISION",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS preset_amounts VARCHAR(255)",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS min_amount DOUBLE PRECISION",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS allow_custom_amount BOOLEAN DEFAULT TRUE",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS show_progress BOOLEAN DEFAULT TRUE",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS show_supporters BOOLEAN DEFAULT TRUE",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS auto_close_at_goal BOOLEAN DEFAULT FALSE",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS campaign_image VARCHAR(512)",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donor_name VARCHAR(255)",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS donor_message TEXT",
    "ALTER TABLE tbl_payment_link ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE",
    "CREATE INDEX IF NOT EXISTS idx_payment_link_parent ON tbl_payment_link(parent_link_id)",
  ];
  for (const s of stmts) {
    await client.query(s);
    console.log("OK:", s);
  }
  const res = await client.query(
    "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='tbl_payment_link' AND column_name IN ('link_type','parent_link_id','title','goal_amount','preset_amounts','min_amount','allow_custom_amount','show_progress','show_supporters','auto_close_at_goal','campaign_image','donor_name','donor_message','is_anonymous') ORDER BY column_name"
  );
  console.table(res.rows);
  await client.end();
})().catch((e) => {
  console.error("MIGRATION FAILED:", e.message);
  process.exit(1);
});
