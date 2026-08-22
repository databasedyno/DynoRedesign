require('dotenv').config();
const { Client } = require('pg');
const ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
const c = process.env.DATABASE_URL
  ? new Client({ connectionString: process.env.DATABASE_URL, ssl })
  : new Client({ host: process.env.HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.USER_NAME, password: process.env.PASSWORD, ssl });
(async () => {
  await c.connect();
  const wt = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%wallet%' ORDER BY table_name`);
  console.log('wallet-ish tables:', wt.rows.map(r=>r.table_name).join(', '));
  const r = await c.query(
    `SELECT company_id, user_id, company_name, account_type, country, settlement_currency,
      to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS created_utc
     FROM tbl_company WHERE user_id BETWEEN 16 AND 25 ORDER BY user_id`);
  console.log('\n=== companies for users 16-25 ===');
  r.rows.forEach(x => console.log(JSON.stringify(x)));
  await c.end();
})().catch(e=>{console.log('ERR', e.message); process.exit(0);});
