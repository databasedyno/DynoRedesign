#!/usr/bin/env node
/**
 * One-off cleanup (user-approved 2026-06): hard-delete The Dev Store's (company 1)
 * four REVOKED test Buy Button (publishable) keys and the leftover QA dev API key
 * "QaTest" (api_id 225, created by a QA run, never used). Transactional; writes a
 * pre-mutation JSON backup to /app/memory/backups/ first.
 *   node scripts/cleanup_devstore_test_keys.js            (dry run)
 *   node scripts/cleanup_devstore_test_keys.js --apply    (commit)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const COMPANY_ID = 1;
const PUB_KEY_IDS = [5, 7, 8, 9];
const API_IDS = [225];
const apply = process.argv.includes("--apply");

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("BEGIN");
    const pks = await client.query(
      "select * from tbl_publishable_key where company_id=$1 and pub_key_id = any($2) and status='revoked'",
      [COMPANY_ID, PUB_KEY_IDS],
    );
    const apis = await client.query(
      "select * from tbl_api where company_id=$1 and api_id = any($2) and api_name='QaTest' and usage_count=0",
      [COMPANY_ID, API_IDS],
    );
    console.log(`publishable keys matched: ${pks.rowCount}/${PUB_KEY_IDS.length}`, pks.rows.map((r) => `${r.pub_key_id}:${r.key_name}:${r.status}`));
    console.log(`api keys matched: ${apis.rowCount}/${API_IDS.length}`, apis.rows.map((r) => `${r.api_id}:${r.api_name}:${r.environment}`));
    if (pks.rowCount !== PUB_KEY_IDS.length || apis.rowCount !== API_IDS.length) {
      throw new Error("Row set differs from the approved list — aborting without changes.");
    }
    if (!apply) {
      await client.query("ROLLBACK");
      console.log("DRY RUN — nothing changed. Re-run with --apply.");
      return;
    }
    const dir = "/app/memory/backups";
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
    const file = path.join(dir, `devstore_test_keys_backup_${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify({ publishable_keys: pks.rows, api_keys: apis.rows }, null, 2));
    await client.query("delete from tbl_api_rate_limit where api_id = any($1)", [API_IDS]);
    await client.query("delete from tbl_api_usage_log where api_id = any($1)", [API_IDS]);
    const d1 = await client.query("delete from tbl_publishable_key where company_id=$1 and pub_key_id = any($2) and status='revoked'", [COMPANY_ID, PUB_KEY_IDS]);
    const d2 = await client.query("delete from tbl_api where company_id=$1 and api_id = any($2)", [COMPANY_ID, API_IDS]);
    await client.query("COMMIT");
    console.log(`DELETED publishable keys: ${d1.rowCount}, api keys: ${d2.rowCount}. Backup: ${file}`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ABORTED:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
