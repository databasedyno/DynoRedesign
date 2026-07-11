// Helper: inspect the current pk / secret / buy button state for hostbay@moxx.co
require('dotenv').config({ path: '/app/backend/.env' });
const { Client } = require('pg');
async function main() {
  const c = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const uRes = await c.query(`SELECT user_id, email FROM tbl_user WHERE email='hostbay@moxx.co'`);
  const user = uRes.rows[0];
  console.log('user:', user);
  const cRes = await c.query(`SELECT company_id, company_name FROM tbl_company WHERE user_id=$1 ORDER BY company_id`, [user.user_id]);
  console.log('companies:', cRes.rows);
  const company_id = cRes.rows[0]?.company_id;
  const skRes = await c.query(`SELECT api_id, "apiKey", environment, status, base_currency FROM tbl_api WHERE company_id=$1 ORDER BY api_id`, [company_id]);
  console.log('secret keys:', skRes.rows.map(r => ({ api_id: r.api_id, environment: r.environment, status: r.status, base_currency: r.base_currency, keyPrefix: (r.apiKey || '').slice(0, 15) })));
  const pkRes = await c.query(`SELECT pub_key_id, environment, status, key_prefix, allowed_domains, max_amount, allowed_currencies FROM tbl_publishable_key WHERE company_id=$1 ORDER BY pub_key_id`, [company_id]);
  console.log('publishable keys:', pkRes.rows);
  const bbRes = await c.query(`SELECT button_id, label, price_type, amount, status, allowed_currencies FROM tbl_buy_button WHERE company_id=$1 ORDER BY button_id`, [company_id]);
  console.log('buy buttons:', bbRes.rows);
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
