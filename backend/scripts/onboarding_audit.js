/* READ-ONLY onboarding audit — no writes. */
require('dotenv').config();
const { Client } = require('pg');

function makeClient() {
  const url = process.env.DATABASE_URL;
  const ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  if (url) return new Client({ connectionString: url, ssl });
  return new Client({
    host: process.env.HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.USER_NAME,
    password: process.env.PASSWORD, ssl,
  });
}

(async () => {
  const c = makeClient();
  await c.connect();
  try {
    const users = await c.query(
      `SELECT user_id, name, email, username, mobile, login_type, status,
              email_verified, last_login_ip, google_id IS NOT NULL AS has_google,
              referral_code, referred_by_code, merchant_country_code, purpose_vertical,
              to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS created_utc
       FROM tbl_user
       WHERE "createdAt" > NOW() - INTERVAL '6 days'
       ORDER BY "createdAt" ASC`
    );
    console.log('=== RECENT USERS (last 6 days) — count:', users.rows.length, '===');
    users.rows.forEach((r) => console.log(JSON.stringify(r)));

    // Group by last_login_ip to spot shared IPs
    console.log('\n=== last_login_ip frequency among recent users ===');
    const byIp = {};
    users.rows.forEach((r) => { const ip = r.last_login_ip || '(null)'; (byIp[ip] = byIp[ip] || []).push(r.user_id); });
    Object.entries(byIp).sort((a,b)=>b[1].length-a[1].length).forEach(([ip, ids]) => console.log(`${ip}: users [${ids.join(', ')}]`));

    // Companies for these users
    const ids = users.rows.map((r) => r.user_id);
    if (ids.length) {
      const comps = await c.query(
        `SELECT company_id, user_id, company_name, account_type, country, business_type,
                to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS created_utc
         FROM tbl_company WHERE user_id = ANY($1::int[]) ORDER BY user_id`, [ids]
      ).catch((e)=>({error:e.message}));
      console.log('\n=== COMPANIES for recent users ===');
      if (comps.error) console.log('ERR:', comps.error);
      else comps.rows.forEach((r) => console.log(JSON.stringify(r)));
    }
  } catch (e) {
    console.log('FATAL:', e.message);
  } finally {
    await c.end();
  }
})();
