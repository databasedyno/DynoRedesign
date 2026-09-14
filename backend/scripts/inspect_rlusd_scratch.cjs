// READ-ONLY inspection of the scratch RLUSD artifacts from the batch test.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

(async () => {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const q = async (label, sql, params = []) => {
    try {
      const r = await c.query(sql, params);
      console.log(`\n== ${label} (${r.rowCount}) ==`);
      r.rows.forEach((row) => console.log(JSON.stringify(row)));
    } catch (e) {
      console.log(`\n== ${label} ERROR: ${e.message}`);
    }
  };
  await q("tbl_user_wallet id 144", `SELECT wallet_id,user_id,company_id,wallet_type,wallet_address,wallet_name,"createdAt" FROM tbl_user_wallet WHERE wallet_id=144`);
  await q("tbl_user_wallet RLUSD user 1 (all)", `SELECT wallet_id,company_id,wallet_type,wallet_address,wallet_name,"createdAt" FROM tbl_user_wallet WHERE user_id=1 AND wallet_type IN ('RLUSD','RLUSD-ERC20') ORDER BY wallet_id`);
  await q("tbl_merchant_wallet RLUSD user 1", `SELECT * FROM tbl_merchant_wallet WHERE user_id=1 AND (currency='RLUSD' OR wallet_type='RLUSD') ORDER BY 1 LIMIT 20`);
  await q("names 1 & 8 now", `SELECT wallet_id,wallet_type,wallet_name FROM tbl_user_wallet WHERE wallet_id IN (1,8)`);
  await c.end();
})();
