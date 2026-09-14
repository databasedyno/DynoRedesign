#!/usr/bin/env node
/**
 * One-off migration runner (prod DB via backend/.env).
 * Usage: node scripts/run_migration.js migrations/012_company_soft_delete.sql
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const rel = process.argv[2];
if (!rel) {
  console.error("Usage: node scripts/run_migration.js <path-to-sql>");
  process.exit(2);
}
const file = path.isAbsolute(rel) ? rel : path.join(__dirname, "..", rel);
const sql = fs.readFileSync(file, "utf8");
const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
(async () => {
  await client.connect();
  console.log(`Running migration: ${file}`);
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Migration applied successfully.");
  await client.end();
})().catch(async (e) => {
  console.error("MIGRATION ERROR:", e.message);
  try { await client.query("ROLLBACK"); } catch (_) {}
  await client.end();
  process.exit(1);
});
