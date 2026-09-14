require('dotenv').config({ path: '/app/backend/.env' });
const { Client } = require('pg');
(async () => {
  const c = new Client({ host: process.env.HOST, port: Number(process.env.DB_PORT), user: process.env.USER_NAME, password: process.env.PASSWORD, database: process.env.DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(`SELECT pub_key_id, publishable_key, max_amount, allowed_currencies, allowed_domains FROM tbl_publishable_key WHERE company_id=1 AND status='active' AND environment='production' LIMIT 1`);
  console.log(JSON.stringify(r.rows[0], null, 2));
  await c.end();
})();
