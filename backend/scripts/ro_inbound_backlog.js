#!/usr/bin/env node
/** READ-ONLY: characterize the tbl_inbound_events 'received'/unprocessed backlog. */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const Q = {
  by_status_all: `select status, count(*) n, count(*) filter (where processed_at is null) null_proc, min(received_at) oldest, max(received_at) newest from tbl_inbound_events group by 1 order by n desc`,
  unprocessed_age: `select date_trunc('day', received_at) d, count(*) n from tbl_inbound_events where processed_at is null and status not in ('duplicate','ignored') group by 1 order by 1 desc limit 20`,
  unprocessed_status: `select status, event_type, count(*) n, min(received_at) oldest, max(received_at) newest from tbl_inbound_events where processed_at is null and status not in ('duplicate','ignored') group by 1,2 order by n desc limit 15`,
  recent_received_still_open: `select count(*) n, max(received_at) last from tbl_inbound_events where status='received' and processed_at is null and received_at > now() - interval '7 days'`,
};
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });
  await c.connect();
  await c.query("BEGIN READ ONLY");
  for (const [name, sql] of Object.entries(Q)) {
    try {
      const r = await c.query(sql);
      console.log(`\n### ${name} (${r.rowCount} rows)`);
      for (const row of r.rows) console.log("  " + JSON.stringify(row));
    } catch (e) {
      console.log(`\n### ${name} — ERR ${e.message.split("\n")[0]}`);
      await c.query("ROLLBACK"); await c.query("BEGIN READ ONLY");
    }
  }
  await c.query("ROLLBACK");
  await c.end();
})();
