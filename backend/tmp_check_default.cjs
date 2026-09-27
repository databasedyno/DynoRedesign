/* READ-ONLY: is example.com/wh a DB-level default? how widespread? */
const fs = require('fs');
const { Client } = require('pg');
const envTxt = fs.readFileSync(__dirname + '/.env', 'utf8');
const DATABASE_URL = envTxt.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run(label, sql) {
  try { const r = await client.query(sql); console.log(`\n=== ${label} (${r.rowCount}) ===`); console.table(r.rows); }
  catch (e) { console.log(`\n=== ${label} ERR: ${e.message} ===`); }
}
(async () => {
  await client.connect();
  await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;').catch(() => {});

  await run('column default for tbl_company.webhook_url',
    `SELECT column_name, data_type, column_default, is_nullable
     FROM information_schema.columns
     WHERE table_name='tbl_company' AND column_name IN ('webhook_url','webhook_secret','webhook_events')`);

  await run('how many companies carry example.com/wh',
    `SELECT COUNT(*) AS companies_with_example
     FROM tbl_company WHERE webhook_url LIKE '%example.com%'`);

  await run('distinct company webhook_url values (top 15)',
    `SELECT LEFT(COALESCE(webhook_url,'(null)'),50) AS webhook_url, COUNT(*) AS n
     FROM tbl_company GROUP BY LEFT(COALESCE(webhook_url,'(null)'),50) ORDER BY n DESC LIMIT 15`);

  await client.end();
})().catch(async (e) => { console.error('ERR:', e.message); try { await client.end(); } catch(_){} process.exit(1); });
