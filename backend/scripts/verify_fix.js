/**
 * Lightweight regression check for the isOwnOutgoingTransaction fix.
 * Plain Node — no ts-node, no jest, no sequelize models. Uses pg directly.
 * Mirrors the exact three DB lookups the fixed function performs.
 *
 * READ-ONLY. Runs in a few seconds.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

const CASES = [
  {
    name: "Bug regression — historical customer→pool INCOMING tx (should NOT be flagged)",
    txId: "0x8241d24eaa35aeac32990638872322488bb2f8373670f40b4da32da557e7ca59",
    expected: null,
  },
  {
    name: "Own settlement — recovery pool→merchant OUTGOING tx (should be flagged as known_merchant_settlement)",
    txId: "0x1b59674f06279214d36b3bb0159f534b80b24e4f4d97ea839c736aac7875d630",
    expected: "known_merchant_settlement",
  },
  {
    name: "Own gas funding — fee wallet→pool tx (should be flagged as known_gas_funding)",
    txId: "0x0f881754102977d47e68161ad59e3301a84ce8b8daf648b6316608d4dd022596",
    expected: "known_gas_funding",
  },
  {
    name: "Second recovery settlement (should be flagged as known_merchant_settlement)",
    txId: "0x9cf047f2a280b2c107394dedd1e53ae4eab6b9ee01437cddec572de42496a9ad",
    expected: "known_merchant_settlement",
  },
  {
    name: "Unknown / random tx (should NOT be flagged)",
    txId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    expected: null,
  },
];

async function classifyByFixLogic(client, txId) {
  // Signal A + B: tbl_merchant_pool_transaction
  const r1 = await client.query(
    `SELECT merchant_tx_id, gas_funding_tx_id
       FROM tbl_merchant_pool_transaction
      WHERE merchant_tx_id = $1 OR gas_funding_tx_id = $1
      LIMIT 1`,
    [txId]
  );
  if (r1.rows.length) {
    if (r1.rows[0].merchant_tx_id === txId) return "known_merchant_settlement";
    if (r1.rows[0].gas_funding_tx_id === txId) return "known_gas_funding";
    return "known_settlement_tx";
  }
  // Signal C: tbl_merchant_pool_sweep
  const r2 = await client.query(
    `SELECT sweep_id
       FROM tbl_merchant_pool_sweep
      WHERE sweep_tx_id = $1 OR gas_funding_tx_id = $1
      LIMIT 1`,
    [txId]
  );
  if (r2.rows.length) return "known_admin_sweep";
  return null;
}

async function main() {
  const client = new Client({
    host: process.env.HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.USER_NAME,
    password: process.env.PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let allPassed = true;
  console.log("=".repeat(70));
  console.log("isOwnOutgoingTransaction fix — production data verification");
  console.log("=".repeat(70));

  for (const c of CASES) {
    const actual = await classifyByFixLogic(client, c.txId);
    const pass = actual === c.expected;
    if (!pass) allPassed = false;
    console.log(`\n${pass ? "✅ PASS" : "❌ FAIL"}: ${c.name}`);
    console.log(`   txId:     ${c.txId.substring(0, 22)}...`);
    console.log(`   expected: ${c.expected}`);
    console.log(`   actual:   ${actual}`);
  }

  // Bonus: sanity-check that the two recovered payments are in `completed` status
  console.log("\n" + "=".repeat(70));
  console.log("Recovery reconciliation state");
  console.log("=".repeat(70));
  const utx = await client.query(
    `SELECT id, status, incoming_tx_hash, outgoing_tx_hash, usd_value
       FROM tbl_user_transaction
      WHERE id IN ('3264a681-f0e6-4a69-a8a1-a01cf865d788','780ebded-20af-4df4-999c-f47b1a4c6f9b')`
  );
  for (const row of utx.rows) {
    const ok = row.status === "completed" && row.incoming_tx_hash && row.outgoing_tx_hash;
    if (!ok) allPassed = false;
    console.log(`\n${ok ? "✅" : "❌"} payment ${row.id.substring(0, 8)}...`);
    console.log(`   status=${row.status}  usd=${row.usd_value}`);
    console.log(`   incoming=${row.incoming_tx_hash}`);
    console.log(`   outgoing=${row.outgoing_tx_hash}`);
  }

  await client.end();
  console.log("\n" + "=".repeat(70));
  console.log(allPassed ? "🎉 ALL PASSED" : "❌ SOME FAILED");
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
