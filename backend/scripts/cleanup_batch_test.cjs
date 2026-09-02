// Reversible cleanup of the batch-test scratch artifacts on the LIVE DB.
// - revert wallet_name on ids 1 & 8 back to NULL (original)
// - hard-delete scratch RLUSD wallet id 144 (address 'notanaddress')
// - delete any RLUSD merchant-pool wallet row for user 1 created by the failed pool init
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const show = async (label, sql, p = []) => {
    const r = await c.query(sql, p).catch((e) => ({ rows: [{ err: e.message }], rowCount: 0 }));
    console.log(`\n== ${label} (${r.rowCount ?? r.rows.length}) ==`);
    r.rows.forEach((x) => console.log(JSON.stringify(x)));
    return r;
  };

  console.log("---- BEFORE ----");
  await show("merchant_wallet RLUSD user1", `SELECT wallet_id,user_id,wallet_type,created_at FROM tbl_merchant_wallet WHERE user_id=1 AND wallet_type='RLUSD'`);

  console.log("\n---- CLEANUP ----");
  const r1 = await c.query(`UPDATE tbl_user_wallet SET wallet_name=NULL WHERE wallet_id IN (1,8) AND user_id=1`);
  console.log("reverted names on 1,8:", r1.rowCount);
  const r2 = await c.query(`DELETE FROM tbl_user_wallet WHERE wallet_id=144 AND user_id=1 AND wallet_type='RLUSD' AND wallet_address='notanaddress'`);
  console.log("deleted scratch wallet 144:", r2.rowCount);
  const r3 = await c.query(`DELETE FROM tbl_merchant_wallet WHERE user_id=1 AND wallet_type='RLUSD' AND created_at > NOW() - INTERVAL '30 minutes'`);
  console.log("deleted scratch RLUSD merchant_wallet rows:", r3.rowCount);

  console.log("\n---- AFTER (verify restored) ----");
  await show("names 1 & 8 (expect null)", `SELECT wallet_id,wallet_type,wallet_name FROM tbl_user_wallet WHERE wallet_id IN (1,8)`);
  await show("any RLUSD user1 wallet (expect 0)", `SELECT wallet_id,wallet_type,wallet_address FROM tbl_user_wallet WHERE user_id=1 AND wallet_type IN ('RLUSD','RLUSD-ERC20')`);
  await show("RLUSD merchant_wallet user1 (expect 0)", `SELECT wallet_id FROM tbl_merchant_wallet WHERE user_id=1 AND wallet_type='RLUSD'`);
  await show("total user1 wallets w/ address (expect 13)", `SELECT COUNT(*)::int AS n FROM tbl_user_wallet WHERE user_id=1 AND wallet_address IS NOT NULL`);
  await c.end();
})();
