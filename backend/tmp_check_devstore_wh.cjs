/* READ-ONLY check of The Dev Store (company 1) webhook_url + recent deliveries. */
const fs = require('fs');
const { Client } = require('pg');
const envTxt = fs.readFileSync(__dirname + '/.env', 'utf8');
const DATABASE_URL = envTxt.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, '');
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;').catch(() => {});

  const cfg = await client.query(`
    SELECT company_id, company_name, webhook_url,
           webhook_disabled, (webhook_secret IS NOT NULL) AS has_secret, webhook_events
    FROM tbl_company WHERE company_id = 1`);
  console.log('\n=== tbl_company (company 1) NOW ===');
  console.table(cfg.rows);

  const recent = await client.query(`
    SELECT event_type, status, response_status,
           LEFT(COALESCE(error_message,''),60) AS error_message,
           LEFT(webhook_url,55) AS webhook_url, created_at
    FROM tbl_webhook_delivery_log
    WHERE company_id = 1 AND webhook_url LIKE '%example.com%'
    ORDER BY created_at DESC LIMIT 5`);
  console.log('\n=== most recent deliveries to example.com (if any) ===');
  console.table(recent.rows);

  await client.end();
})().catch(async (e) => { console.error('ERR:', e.message); try { await client.end(); } catch(_){} process.exit(1); });
