#!/usr/bin/env node
/**
 * READ-ONLY SQL runner for investigations (prod DB via backend/.env).
 * Usage: node scripts/ro_query.js "select ..."   (only SELECT/WITH statements are allowed)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const sql = process.argv.slice(2).join(" ").trim();
if (!/^(select|with|show|explain)\b/i.test(sql) || /;\s*\S/.test(sql)) {
  console.error("Refusing: only a single SELECT/WITH statement is allowed.");
  process.exit(2);
}
const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });
(async () => {
  await client.connect();
  await client.query("SET TRANSACTION READ ONLY").catch(() => {});
  await client.query("BEGIN READ ONLY");
  const r = await client.query(sql);
  await client.query("ROLLBACK");
  if (process.env.RO_JSON) console.log(JSON.stringify(r.rows, null, 1));
  else {
    if (!r.rows.length) console.log("(0 rows)");
    else {
      const cols = Object.keys(r.rows[0]);
      const w = cols.map((c) => Math.min(60, Math.max(c.length, ...r.rows.map((x) => String(x[c] ?? "").length))));
      console.log(cols.map((c, i) => c.padEnd(w[i])).join(" | "));
      console.log(w.map((n) => "-".repeat(n)).join("-+-"));
      for (const row of r.rows) console.log(cols.map((c, i) => String(row[c] ?? "").slice(0, 60).padEnd(w[i])).join(" | "));
      console.log(`(${r.rows.length} rows)`);
    }
  }
  await client.end();
})().catch((e) => { console.error("ERR", e.message); client.end(); process.exit(1); });
