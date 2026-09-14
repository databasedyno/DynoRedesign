// Mint JWTs for UX audit (bypasses OTP login)
const path = require('path');
require('/app/backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { Client } = require('/app/backend/node_modules/pg');
const jwt = require('/app/backend/node_modules/jsonwebtoken');

const SECRET = process.env.ACCESS_TOKEN_SECRET;
if (!SECRET) { console.error('ACCESS_TOKEN_SECRET missing'); process.exit(1); }

const EMAILS = [
  'hostbay@moxx.co',                       // data-rich
  'qa.empty.1782626169@dynopaytest.com',   // empty
  'qa.onboard.1782585233@dynopaytest.com', // mid
];

(async () => {
  const client = new Client({
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' },
  });
  await client.connect();
  const out = {};
  for (const email of EMAILS) {
    const r = await client.query('SELECT * FROM tbl_user WHERE email=$1 LIMIT 1', [email]);
    if (!r.rows.length) { console.error('NOT FOUND', email); continue; }
    const row = r.rows[0];
    delete row.password; delete row.telegram_id;
    out[email] = jwt.sign(row, SECRET, { expiresIn: '30d' });
  }
  await client.end();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
