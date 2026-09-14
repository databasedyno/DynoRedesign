require('dotenv').config();
const { Client } = require('pg');

const q = process.argv[2];
const c = new Client({
  host: process.env.HOST,
  port: +process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.USER_NAME,
  password: process.env.PASSWORD,
  ssl: { rejectUnauthorized: false },
});
c.connect()
  .then(async () => {
    const r = await c.query(q);
    console.log(JSON.stringify(r.rows, null, 1));
    await c.end();
  })
  .catch((e) => { console.error('ERR', e.message); process.exit(1); });
