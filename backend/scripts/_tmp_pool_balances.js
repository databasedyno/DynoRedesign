require('dotenv').config({ path: '/app/backend/.env' });
const { Client } = require('pg');
const axios = require('axios');
const KEY = process.env.TRONGRID_API_KEY;
const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
(async () => {
  const c = new Client({ host: process.env.HOST, port: Number(process.env.DB_PORT), user: process.env.USER_NAME, password: process.env.PASSWORD, database: process.env.DB_NAME, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(`SELECT temp_address_id, wallet_address, admin_fee_balance, status FROM tbl_merchant_temp_address WHERE wallet_type='USDT-TRC20' ORDER BY temp_address_id`);
  await c.end();
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const res = await axios.get(`https://api.trongrid.io/v1/accounts/${r.wallet_address}`, { headers: { 'TRON-PRO-API-KEY': KEY }, timeout: 10000 });
      const d = res.data?.data?.[0] || {};
      const trc = (d.trc20 || []).find((t) => t[USDT]);
      const usdt = trc ? Number(trc[USDT]) / 1e6 : 0;
      out.push({ id: r.temp_address_id, addr: r.wallet_address, usdt, trx: (d.balance || 0) / 1e6, db_fee: Number(r.admin_fee_balance), status: r.status });
    } catch (e) { out.push({ id: r.temp_address_id, addr: r.wallet_address, err: e.message.slice(0, 60) }); }
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 600));
  }
  require('fs').writeFileSync('/tmp/pool_balances.json', JSON.stringify(out));
  console.log('done', out.length);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
