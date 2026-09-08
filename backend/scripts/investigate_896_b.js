/* READ-ONLY deep dive for Armin's USDT-ERC20 deposits. SELECT only. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

const UID = 139, COMP = 142;
const T896 = "23ee350c-d09c-4567-b7d2-e9c8bb6cbea5";

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();

  let r = await c.query(
    `SELECT temp_id, wallet_type, wallet_address, status, admin_status, "txId", "adminTxId",
            amount, merchant_amount, check_count, subscription_id, "createdAt", "updatedAt"
       FROM tbl_user_temp_address WHERE user_id=$1 ORDER BY temp_id DESC`, [UID]);
  console.log("== tbl_user_temp_address (user 139) count=" + r.rows.length + " ==");
  console.table(r.rows);

  r = await c.query(
    `SELECT temp_address_id, wallet_type, wallet_address, status, expected_amount, received_amount,
            total_transactions, current_payment_id, current_company_id, gas_balance, last_swept_at,
            reserved_until, created_at, updated_at
       FROM tbl_merchant_temp_address WHERE owner_user_id=$1 ORDER BY temp_address_id DESC`, [UID]);
  console.log("\n== tbl_merchant_temp_address (owner 139) count=" + r.rows.length + " ==");
  console.table(r.rows);

  r = await c.query(
    `SELECT id, provider, event_type, payment_id, status, error, received_at, processed_at
       FROM tbl_inbound_events WHERE payment_id=$1 ORDER BY received_at DESC`, [T896]);
  console.log("\n== inbound_events for txn896 (" + T896 + ") count=" + r.rows.length + " ==");
  console.table(r.rows);

  r = await c.query(
    `SELECT id, payment_id, tx_id, address, currency, event, from_state, to_state, amount,
            settlement_tx_id, company_id, created_at
       FROM tbl_payment_journal WHERE payment_id=$1 OR tx_id=$1 ORDER BY created_at`, [T896]);
  console.log("\n== payment_journal for txn896 count=" + r.rows.length + " ==");
  console.table(r.rows);

  // Any inbound events / journal at all for this company (last 20)?
  r = await c.query(
    `SELECT event, currency, address, from_state, to_state, amount, payment_id, created_at
       FROM tbl_payment_journal WHERE company_id=$1 ORDER BY created_at DESC LIMIT 20`, [COMP]);
  console.log("\n== payment_journal (company 142, last 20) count=" + r.rows.length + " ==");
  console.table(r.rows);

  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
