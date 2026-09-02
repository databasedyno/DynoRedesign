// READ-ONLY: per-company wallet currency coverage for user 1 (to pick a reuse/smart-paste test target).
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const companies = await c.query(`SELECT company_id, company_name FROM tbl_company WHERE user_id=1 ORDER BY company_id`);
  const wallets = await c.query(`SELECT company_id, wallet_type FROM tbl_user_wallet WHERE user_id=1 AND wallet_address IS NOT NULL`);
  const byCo = new Map();
  wallets.rows.forEach((w) => {
    if (!byCo.has(w.company_id)) byCo.set(w.company_id, new Set());
    byCo.get(w.company_id).add(w.wallet_type);
  });
  const EVM = ["ETH", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"];
  companies.rows.forEach((co) => {
    const set = byCo.get(co.company_id) || new Set();
    const missingEvm = EVM.filter((x) => !set.has(x));
    console.log(`company ${co.company_id} "${co.company_name}": ${set.size} wallets | missingEVM=[${missingEvm.join(",")}]`);
  });
  await c.end();
})();
