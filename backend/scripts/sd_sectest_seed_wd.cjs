// Seed/remove a throwaway pending_approval withdrawal to screenshot the admin panel.
// Usage: node sd_sectest_seed_wd.cjs <insert|remove> <customer_email>
const { Client } = require("pg");
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

async function main() {
  const [, , cmd, email] = process.argv;
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const cust = await c.query(`SELECT customer_id, company_id FROM tbl_customer WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
    if (!cust.rows.length) { console.log("customer not found"); return; }
    const { customer_id, company_id } = cust.rows[0];
    if (cmd === "insert") {
      const r = await c.query(
        `INSERT INTO tbl_customer_withdrawal
           (company_id, customer_id, address_id, payout_key, address, amount_usd, fee_usd, net_usd, status, requires_approval, approval_reason, ledger_reference, source)
         VALUES ($1,$2,NULL,'USDT-TRON','TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',750.00,1.00,749.00,'pending_approval',true,
                 '24h velocity over $1000 (rolling 600.00 + 750.00 USD)', 'sectest:wd:'||extract(epoch from now()), 'settlement')
         RETURNING withdrawal_id`,
        [company_id, customer_id]
      );
      console.log("inserted withdrawal_id", r.rows[0].withdrawal_id);
    } else {
      await c.query(`DELETE FROM tbl_customer_withdrawal WHERE customer_id=$1`, [customer_id]);
      console.log("removed withdrawals for", customer_id);
    }
  } finally { await c.end(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
