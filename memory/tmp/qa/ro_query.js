// Read-only forensics helper: node ro_query.js "<SQL>"  (SELECT only)
require('/app/backend/node_modules/dotenv').config({ path: '/app/backend/.env' });
const { Client } = require('/app/backend/node_modules/pg');
const sql = process.argv[2];
if (!/^\s*(select|with|explain)\b/i.test(sql)) { console.error('SELECT only'); process.exit(2); }
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('SET default_transaction_read_only = on');
  const r = await c.query(sql);
  console.log(JSON.stringify(r.rows, null, 1));
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
