#!/usr/bin/env node
// Ad-hoc read-only SQL helper: node scripts/q.js "SELECT ..."
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 60000 });
(async () => {
  await client.connect();
  const r = await client.query(process.argv[2]);
  console.log(JSON.stringify(r.rows, null, 1));
  await client.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
