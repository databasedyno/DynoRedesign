/* TEST-ONLY hard-delete of a throwaway merchant created through the REAL sign-up flow
 * (Checkpoint 4.6 fresh-account walkthrough). Removes every row that references the
 * user (user_id) or any of the user's brands (company_id) across the schema, then the
 * brands, then the user. Refuses to touch anything unless the email starts with the
 * scratch prefix.
 * Usage: node scratch_fresh_signup_cleanup.js <email>      (dry run: --dry)
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

const PREFIX = "qa_fresh_walkthrough_";

(async () => {
  const email = (process.argv[2] || "").toLowerCase();
  const dry = process.argv.includes("--dry");
  if (!email.startsWith(PREFIX)) { console.error(`Refusing: email must start with ${PREFIX}`); process.exit(2); }
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();
  const u = await c.query(`SELECT user_id FROM tbl_user WHERE lower(email) = $1`, [email]);
  if (!u.rows.length) { console.log("no such user"); await c.end(); return; }
  const userId = u.rows[0].user_id;
  const comps = await c.query(`SELECT company_id FROM tbl_company WHERE user_id = $1`, [userId]);
  const companyIds = comps.rows.map((r) => r.company_id);
  console.log(`user_id=${userId} companies=${companyIds.join(",") || "-"}`);

  const cols = await c.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('user_id','company_id') AND table_name NOT IN ('tbl_user','tbl_company')`);
  const byTable = {};
  for (const r of cols.rows) (byTable[r.table_name] ||= new Set()).add(r.column_name);

  await c.query("BEGIN");
  try {
    // Tatum webhook subscriptions behind the merchant's pool addresses must go first (they cost credits).
    const temp = await c.query(`SELECT temp_address_id, subscription_id FROM tbl_merchant_temp_address WHERE owner_user_id = $1`, [userId]);
    const testnet = process.env.TATUM_TESTNET === "true";
    const tatumKey = (testnet && process.env.TATUM_TESTNET_KEY) || process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
    for (const row of temp.rows) {
      if (!row.subscription_id) continue;
      if (dry) { console.log(`tatum subscription ${row.subscription_id}: would delete`); continue; }
      const r = await fetch(`https://api.tatum.io/v4/subscription/${row.subscription_id}?type=${testnet ? "testnet" : "mainnet"}`, { method: "DELETE", headers: { "x-api-key": tatumKey, ...(testnet ? { "x-testnet-type": process.env.TATUM_TESTNET_TYPE || "ethereum-sepolia" } : {}) } });
      console.log(`tatum subscription ${row.subscription_id}: ${r.status}`);
    }
    if (!dry && temp.rows.length) console.log(`tbl_merchant_temp_address: -${(await c.query(`DELETE FROM tbl_merchant_temp_address WHERE owner_user_id = $1`, [userId])).rowCount}`);
    for (const [t, col] of [["tbl_account_member", "invited_by"], ["tbl_referee_code", "used_by_user_id"], ["tbl_referee_code", "referrer_user_id"], ["tbl_referral", "referrer_user_id"], ["tbl_referral", "referred_user_id"], ["tbl_user_exchange", "user1_id"], ["tbl_user_exchange", "user2_id"]]) {
      const r = await c.query(`${dry ? "SELECT count(*) FROM" : "DELETE FROM"} ${t} WHERE ${col} = $1`, [userId]);
      const n = dry ? Number(r.rows[0].count) : r.rowCount;
      if (n) console.log(`${t}.${col}: ${dry ? "would delete" : "-"}${n}`);
    }
    let pending = Object.keys(byTable);
    for (let pass = 0; pass < 6 && pending.length; pass++) {
      const next = [];
      for (const t of pending) {
        const conds = [];
        const params = [];
        if (byTable[t].has("user_id")) { params.push(userId); conds.push(`user_id = $${params.length}`); }
        if (byTable[t].has("company_id") && companyIds.length) { params.push(companyIds); conds.push(`company_id = ANY($${params.length}::int[])`); }
        if (!conds.length) continue;
        try {
          await c.query("SAVEPOINT sp");
          const r = await c.query(`${dry ? "SELECT count(*) FROM" : "DELETE FROM"} ${t} WHERE ${conds.join(" OR ")}`, params);
          const n = dry ? Number(r.rows[0].count) : r.rowCount;
          if (n) console.log(`${t}: ${dry ? "would delete" : "-"}${n}`);
          await c.query("RELEASE SAVEPOINT sp");
        } catch (e) {
          await c.query("ROLLBACK TO SAVEPOINT sp");
          next.push(t);
          if (pass === 5) console.log(`${t}: FAILED ${e.message.split("\n")[0]}`);
        }
      }
      pending = next;
    }
    if (!dry) {
      if (companyIds.length) console.log(`tbl_company: -${(await c.query(`DELETE FROM tbl_company WHERE company_id = ANY($1::int[])`, [companyIds])).rowCount}`);
      console.log(`tbl_user: -${(await c.query(`DELETE FROM tbl_user WHERE user_id = $1`, [userId])).rowCount}`);
    }
    await c.query(dry ? "ROLLBACK" : "COMMIT");
    console.log(dry ? "DRY RUN — nothing changed" : "DONE");
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("ROLLED BACK:", e.message);
    process.exit(1);
  }
  await c.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
