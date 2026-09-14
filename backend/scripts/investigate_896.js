/* READ-ONLY investigation for support session df0936d9 (Armin, USDT-ERC20 settlements).
 * Runs ONLY SELECT queries. No writes. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");

const EMAIL = "armin.blzz2@gmail.com";

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { require: true, rejectUnauthorized: false },
    statement_timeout: 30000,
  });
  await client.connect();

  const q = (sql, params) => client.query(sql, params);

  // 1) The user
  const user = await q(
    `SELECT user_id, email, first_name, last_name, "createdAt" AS created_at FROM tbl_user WHERE lower(email)=lower($1)`,
    [EMAIL]
  );
  console.log("=== USER ===");
  console.table(user.rows);
  if (!user.rows.length) { await client.end(); return; }
  const userId = user.rows[0].user_id;

  // 2) Transaction 896 full detail
  const t896 = await q(`SELECT * FROM tbl_user_transaction WHERE transaction_id = 896`);
  console.log("\n=== TRANSACTION 896 (full) ===");
  console.dir(t896.rows[0], { depth: null, maxArrayLength: null });

  // 3) All this user's transactions (key columns)
  const all = await q(
    `SELECT transaction_id, id, status, payment_mode, crypto_currency, crypto_amount,
            base_amount, base_currency, usd_value, transaction_type,
            incoming_tx_hash, outgoing_tx_hash, wallet_id, company_id,
            "createdAt" AS created_at, "updatedAt" AS updated_at
       FROM tbl_user_transaction
      WHERE user_id = $1
      ORDER BY transaction_id DESC`,
    [userId]
  );
  console.log(`\n=== ALL TRANSACTIONS for user_id=${userId} (${all.rows.length}) ===`);
  console.table(all.rows.map(r => ({
    tid: r.transaction_id, status: r.status, mode: r.payment_mode,
    coin: r.crypto_currency, amt: r.crypto_amount, usd: r.usd_value,
    in_hash: r.incoming_tx_hash ? r.incoming_tx_hash.slice(0, 16) + "…" : null,
    out_hash: r.outgoing_tx_hash ? r.outgoing_tx_hash.slice(0, 16) + "…" : null,
    wallet: r.wallet_id, created: r.created_at,
  })));

  // 4) Wallet(s) for this user (settlement addresses)
  const wallets = await q(
    `SELECT * FROM tbl_user_wallet WHERE user_id = $1`, [userId]
  );
  console.log(`\n=== USER WALLETS (${wallets.rows.length}) ===`);
  console.dir(wallets.rows, { depth: null });

  await client.end();
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
