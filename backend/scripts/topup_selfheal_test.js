/**
 * Test helper for the SafeDeal top-up self-heal (syncTopupFromLedger).
 * Reproduces "confirmed on-chain but webhook missed": seeds a 'waiting' top-up plus a
 * matching SUCCESSFUL tbl_user_transaction, so that hitting GET /api/safedeal/wallet/topup/:id
 * should auto-credit the wallet. Self-cleaning.
 *
 * Usage (run from /app/backend):
 *   node -r dotenv/config scripts/topup_selfheal_test.js seed    <customer_id>
 *   node -r dotenv/config scripts/topup_selfheal_test.js verify  <topup_id> <customer_id>
 *   node -r dotenv/config scripts/topup_selfheal_test.js cleanup <topup_id> <payment_id> <customer_id>
 *
 * Output: a single line "RESULT: {json}".
 */
const crypto = require("crypto");
const { Client } = require("pg");

const AMOUNT = 12.34; // distinctive credit amount

async function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  let c = new Client({ connectionString: url, ssl: false });
  try { await c.connect(); return c; }
  catch { c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } }); await c.connect(); return c; }
}
const out = (o) => console.log("RESULT: " + JSON.stringify(o));

async function walletAmount(c, customerId) {
  const r = await c.query(`SELECT amount FROM tbl_customer_wallet WHERE customer_id=$1 ORDER BY wallet_id ASC LIMIT 1`, [customerId]);
  return r.rows[0] ? Number(r.rows[0].amount) : 0;
}

async function seed(customerId) {
  const c = await connect();
  try {
    const cust = await c.query(`SELECT company_id FROM tbl_customer WHERE customer_id=$1`, [customerId]);
    if (!cust.rows[0]) throw new Error(`customer ${customerId} not found`);
    const companyId = cust.rows[0].company_id;
    const u = await c.query(`SELECT user_id FROM tbl_user_transaction WHERE company_id=$1 AND user_id IS NOT NULL ORDER BY transaction_id DESC LIMIT 1`, [companyId]);
    const userId = u.rows[0] ? u.rows[0].user_id : (await c.query(`SELECT user_id FROM tbl_user_transaction WHERE user_id IS NOT NULL LIMIT 1`)).rows[0]?.user_id;
    if (!userId) throw new Error("no user_id available to attach synthetic tx");

    const paymentId = crypto.randomUUID();
    const txHash = "SELFHEAL-TEST-" + crypto.randomBytes(8).toString("hex");
    const walletBefore = await walletAmount(c, customerId);

    const t = await c.query(
      `INSERT INTO tbl_safedeal_topup (company_id, customer_id, coin, amount_usd, network_fee_usd, conversion_fee_usd, exchange_fee_usd, pays_usd, status, payment_id, address, crypto_amount, expires_at, created_at, updated_at)
       VALUES ($1,$2,'USDT-TRC20',$3::numeric,0,0,0,$3::numeric,'waiting',$4,'TEST-ADDR',$3::text, NOW() + interval '2 hours', NOW(), NOW()) RETURNING topup_id`,
      [companyId, customerId, AMOUNT.toFixed(2), paymentId]
    );
    const topupId = t.rows[0].topup_id;

    await c.query(
      `INSERT INTO tbl_user_transaction (id, user_id, company_id, customer_id, payment_mode, base_amount, base_currency, crypto_amount, crypto_currency, usd_value, transaction_fee, confirmations, required_confirmations, transaction_reference, incoming_tx_hash, transaction_type, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'CRYPTO',$5::numeric,'USD',$5::numeric,'USDT-TRC20',$5::numeric,0,30,6,$6,$6,'CREDIT','successful', NOW(), NOW())`,
      [paymentId, userId, companyId, customerId, AMOUNT.toFixed(2), txHash]
    );
    out({ ok: true, topup_id: topupId, payment_id: paymentId, user_id: userId, company_id: companyId, wallet_before: walletBefore, amount: AMOUNT });
  } finally { await c.end(); }
}

async function verify(topupId, customerId) {
  const c = await connect();
  try {
    const t = await c.query(`SELECT status, credited_at FROM tbl_safedeal_topup WHERE topup_id=$1`, [topupId]);
    const led = await c.query(`SELECT COUNT(*)::int AS n FROM tbl_customer_transaction WHERE transaction_reference=$1`, [`topup:${topupId}:credit`]);
    out({ ok: true, topup_status: t.rows[0]?.status || null, credited_at: t.rows[0]?.credited_at || null, wallet_amount: await walletAmount(c, customerId), ledger_entries: led.rows[0].n });
  } finally { await c.end(); }
}

async function cleanup(topupId, paymentId, customerId) {
  const c = await connect();
  const deleted = {};
  const del = async (label, sql, params) => { try { const r = await c.query(sql, params); deleted[label] = r.rowCount; } catch (e) { deleted[label] = `err:${e.message}`; } };
  try {
    await del("ledger", `DELETE FROM tbl_customer_transaction WHERE transaction_reference=$1`, [`topup:${topupId}:credit`]);
    await del("topup", `DELETE FROM tbl_safedeal_topup WHERE topup_id=$1`, [topupId]);
    await del("user_tx", `DELETE FROM tbl_user_transaction WHERE id=$1`, [paymentId]);
    await del("wallet", `DELETE FROM tbl_customer_wallet WHERE customer_id=$1`, [customerId]);
    await del("profile", `DELETE FROM tbl_safedeal_profile WHERE customer_id=$1`, [customerId]);
    await del("customer", `DELETE FROM tbl_customer WHERE customer_id=$1`, [customerId]);
    out({ ok: true, deleted });
  } finally { await c.end(); }
}

(async () => {
  const [cmd, a, b, d] = process.argv.slice(2);
  try {
    if (cmd === "seed") await seed(Number(a));
    else if (cmd === "verify") await verify(Number(a), Number(b));
    else if (cmd === "cleanup") await cleanup(Number(a), b, Number(d));
    else { console.error("unknown command"); process.exit(2); }
  } catch (e) { out({ ok: false, error: e.message }); process.exit(1); }
})();
