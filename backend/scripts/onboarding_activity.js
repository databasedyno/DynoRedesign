require('dotenv').config();
const { Client } = require('pg');
const ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
const c = process.env.DATABASE_URL
  ? new Client({ connectionString: process.env.DATABASE_URL, ssl })
  : new Client({ host: process.env.HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.USER_NAME, password: process.env.PASSWORD, ssl });
(async () => {
  await c.connect();
  const q = await c.query(`
    SELECT co.company_id, co.user_id, co.company_name,
      (SELECT COUNT(*) FROM tbl_user_wallet w WHERE w.company_id=co.company_id) AS wallets,
      (SELECT COUNT(*) FROM tbl_user_transaction t WHERE t.company_id=co.company_id) AS txns,
      (SELECT COUNT(*) FROM tbl_payment_link p WHERE p.company_id=co.company_id) AS paylinks
    FROM tbl_company co WHERE co.user_id BETWEEN 16 AND 25 ORDER BY co.user_id`).catch(e=>({error:e.message,rows:[]}));
  if (q.error) { console.log('ERR', q.error); }
  q.rows && q.rows.forEach(x=>console.log(JSON.stringify(x)));
  await c.end();
})().catch(e=>{console.log('FATAL',e.message);process.exit(0);});
