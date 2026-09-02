// TEST-ONLY reversible imbalance: temporarily unset ETH+POLYGON on company 1 so the
// reuse + smart-paste UIs surface, then restore EXACTLY. Values are snapshotted to
// /tmp/imbalance_snapshot.json. SAFE MODE only (background jobs OFF). Usage:
//   node imbalance_test.cjs remove
//   node imbalance_test.cjs restore
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");
const fs = require("fs");
const SNAP = "/tmp/imbalance_snapshot.json";
const TARGETS = ["ETH", "POLYGON"];

(async () => {
  const mode = process.argv[2];
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  if (mode === "remove") {
    const r = await c.query(
      `SELECT wallet_id, wallet_type, wallet_address, wallet_name, company_id, destination_tag
       FROM tbl_user_wallet WHERE user_id=1 AND company_id=1 AND wallet_type = ANY($1)`, [TARGETS]);
    fs.writeFileSync(SNAP, JSON.stringify(r.rows, null, 2));
    console.log("snapshot saved:", r.rows.map((x) => `${x.wallet_type}#${x.wallet_id}`).join(", "));
    for (const row of r.rows) {
      await c.query(
        `UPDATE tbl_user_wallet SET wallet_address=NULL, wallet_name=NULL, company_id=NULL WHERE wallet_id=$1`,
        [row.wallet_id]);
    }
    console.log("removed (nulled) targets on company 1");
  } else if (mode === "restore") {
    const rows = JSON.parse(fs.readFileSync(SNAP, "utf8"));
    for (const row of rows) {
      await c.query(
        `UPDATE tbl_user_wallet SET wallet_address=$1, wallet_name=$2, company_id=$3, destination_tag=$4 WHERE wallet_id=$5`,
        [row.wallet_address, row.wallet_name, row.company_id, row.destination_tag, row.wallet_id]);
    }
    console.log("restored:", rows.map((x) => `${x.wallet_type}#${x.wallet_id}`).join(", "));
    const chk = await c.query(
      `SELECT COUNT(*)::int n FROM tbl_user_wallet WHERE user_id=1 AND company_id=1 AND wallet_address IS NOT NULL`);
    console.log("company_1 wallets now:", chk.rows[0].n);
  } else {
    console.log("usage: node imbalance_test.cjs remove|restore");
  }
  await c.end();
})();
