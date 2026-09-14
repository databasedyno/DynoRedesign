/* Idempotent creation of tbl_support_session (admin live-chat inbox state).
 * Safe to re-run. Does NOT touch tbl_support_chat_message. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS tbl_support_session (
      session_id      VARCHAR(64) PRIMARY KEY,
      mode            VARCHAR(16) NOT NULL DEFAULT 'ai',
      status          VARCHAR(16) NOT NULL DEFAULT 'open',
      contact_email   VARCHAR(160),
      user_id         INTEGER,
      escalated       BOOLEAN NOT NULL DEFAULT false,
      admin_unread    INTEGER NOT NULL DEFAULT 0,
      last_message_at TIMESTAMPTZ,
      last_agent_at   TIMESTAMPTZ,
      last_email_at   TIMESTAMPTZ,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_support_session_status ON tbl_support_session (status)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_support_session_mode ON tbl_support_session (mode)`);
  await c.query(`CREATE INDEX IF NOT EXISTS idx_support_session_last_msg ON tbl_support_session (last_message_at)`);

  const n = await c.query(`SELECT count(*)::int AS n FROM tbl_support_session`);
  console.log("✅ tbl_support_session ready. rows:", n.rows[0].n);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
