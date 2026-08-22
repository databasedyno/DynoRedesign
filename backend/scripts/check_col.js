require('dotenv').config();
const { Client } = require('pg');
const ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
const c = process.env.DATABASE_URL ? new Client({ connectionString: process.env.DATABASE_URL, ssl })
  : new Client({ host: process.env.HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.USER_NAME, password: process.env.PASSWORD, ssl });
(async () => {
  await c.connect();
  const comp = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tbl_company' AND column_name='display_currency'`);
  console.log("tbl_company.display_currency exists?", comp.rows.length>0);
  const usr = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='tbl_user' AND column_name='display_currency'`);
  console.log("tbl_user.display_currency exists?", usr.rows.length>0);
  // reproduce the failing query
  try { await c.query(`SELECT display_currency FROM tbl_company WHERE company_id=38 LIMIT 1`); console.log("query OK"); }
  catch(e){ console.log("REPRO getCompanyDisplayCurrency error =>", e.message); }
  await c.end();
})().catch(e=>{console.log('FATAL',e.message);process.exit(0);});
