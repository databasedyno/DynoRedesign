/* READ-ONLY forensics for The Dev Store (company_id = 1). SELECT-only. Secrets masked.
   Temporary investigation script — safe to delete. */
const fs = require('fs');
const { Client } = require('pg');

// Load DATABASE_URL from backend/.env without pulling in the app.
const envTxt = fs.readFileSync(__dirname + '/.env', 'utf8');
const m = envTxt.match(/^DATABASE_URL=(.*)$/m);
if (!m) { console.error('DATABASE_URL not found in .env'); process.exit(1); }
const DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');

const CID = 1; // The Dev Store per recover_devstore_125usdt.ts

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run(label, sql, params = []) {
  try {
    const res = await client.query(sql, params);
    console.log(`\n===== ${label} (${res.rowCount} rows) =====`);
    console.table(res.rows);
  } catch (e) {
    console.log(`\n===== ${label} — ERROR: ${e.message} =====`);
  }
}

process.on('unhandledRejection', (e) => { console.error('UNHANDLED:', e && e.message ? e.message : e); });

(async () => {
  console.log('Host:', DATABASE_URL.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
  console.log('Connecting...');
  await client.connect();
  console.log('Connected. Enforcing read-only...');
  await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;').catch((e) => console.log('ro set warn:', e.message));
  console.log('Investigating company_id =', CID);

  // Confirm read-only mode
  await run('session read-only?', "SHOW default_transaction_read_only;");

  // 1. Company webhook configuration
  await run('tbl_company webhook config', `
    SELECT company_id, company_name, webhook_url,
           webhook_disabled, webhook_disabled_at,
           LEFT(COALESCE(webhook_disabled_reason,''),160) AS webhook_disabled_reason,
           (webhook_secret IS NOT NULL) AS has_secret,
           webhook_events
    FROM tbl_company WHERE company_id = $1`, [CID]);

  // Column introspection
  await run('tbl_api columns', `SELECT column_name FROM information_schema.columns WHERE table_name='tbl_api' ORDER BY ordinal_position`);
  await run('tbl_webhook_delivery_log columns', `SELECT column_name FROM information_schema.columns WHERE table_name='tbl_webhook_delivery_log' ORDER BY ordinal_position`);

  // 2. API keys for this company
  await run('tbl_api keys', `
    SELECT api_id, status, webhook_url,
           (webhook_secret IS NOT NULL) AS has_secret
    FROM tbl_api WHERE company_id = $1 ORDER BY api_id DESC`, [CID]);

  // 3. Recent webhook delivery attempts (real merchant targets only, skip loopback probes)
  await run('recent NON-loopback deliveries (last 25)', `
    SELECT event_type, status, response_status,
           LEFT(COALESCE(error_message,''),120) AS error_message,
           retry_count, LEFT(webhook_url,60) AS webhook_url, created_at
    FROM tbl_webhook_delivery_log
    WHERE company_id = $1
      AND webhook_url NOT LIKE '%127.0.0.1%'
      AND webhook_url NOT LIKE '%localhost%'
    ORDER BY created_at DESC LIMIT 25`, [CID]);

  // 3b. Distinct destination URLs recently targeted for this company
  await run('distinct webhook URLs (30d) with success/fail counts', `
    SELECT LEFT(webhook_url,70) AS webhook_url,
           COUNT(*) FILTER (WHERE status='success') AS ok,
           COUNT(*) FILTER (WHERE status='failed')  AS failed,
           MAX(created_at) AS last_seen
    FROM tbl_webhook_delivery_log
    WHERE company_id = $1 AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY LEFT(webhook_url,70)
    ORDER BY (COUNT(*) FILTER (WHERE status='failed')) DESC LIMIT 25`, [CID]);

  // 4. Failure fingerprint (last 60 days)
  await run('webhook failure fingerprint (60d)', `
    SELECT status, response_status,
           LEFT(COALESCE(error_message,''),120) AS err, COUNT(*) AS n,
           MAX(created_at) AS last_seen
    FROM tbl_webhook_delivery_log
    WHERE company_id = $1 AND created_at > NOW() - INTERVAL '60 days'
    GROUP BY status, response_status, LEFT(COALESCE(error_message,''),120)
    ORDER BY n DESC LIMIT 25`, [CID]);

  await client.end();
})().catch(async (e) => { console.error('FATAL:', e.message); try { await client.end(); } catch(_){} process.exit(1); });
