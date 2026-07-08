const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config({ path: '/app/backend/.env' });
const s = new Sequelize(process.env.DB_NAME, process.env.USER_NAME, process.env.PASSWORD, {
  host: process.env.HOST, port: process.env.DB_PORT, dialect: 'postgres', logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});
(async () => {
  const rows = await s.query(`SELECT transaction_id, base_currency, base_amount, usd_value, status, company_id, customer_id, "createdAt" FROM tbl_user_transaction WHERE user_id=1 ORDER BY "createdAt" DESC LIMIT 12`, { type: QueryTypes.SELECT });
  console.table(rows.map(r => ({...r, createdAt: String(r.createdAt).slice(0,24)})));
  const agg = await s.query(`SELECT COUNT(*) c, SUM(CASE WHEN usd_value IS NULL OR usd_value=0 THEN 1 ELSE 0 END) zero_usd FROM tbl_user_transaction WHERE user_id=1 AND "createdAt" >= NOW() - INTERVAL '7 days'`, { type: QueryTypes.SELECT });
  console.log('last7d:', agg);
  await s.close();
})().catch(e => { console.error(e.message); process.exit(1); });
