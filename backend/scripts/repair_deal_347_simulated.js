#!/usr/bin/env node
/**
 * One-off data repair for deal #347 (SafeDeal escrow, company 262).
 *
 * Root cause (fixed in code): authorizeOutcome() unconditionally set deal.simulated=true,
 * tainting this REAL, on-chain-funded deal. That flagged the seller's $100 release credit
 * as "test funds" and blocked a legitimate cashout.
 *
 * This script clears the erroneous simulated flag on the deal AND on its tainted ledger
 * entries so the seller (fluscri@gmail.com, customer 984) can cash out.
 *
 * SAFE BY DEFAULT: runs in a transaction and ROLLS BACK (dry-run) unless APPLY=1 is set.
 *   Dry-run : node scripts/repair_deal_347_simulated.js
 *   Apply   : APPLY=1 node scripts/repair_deal_347_simulated.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { Client } = require("pg");

const DEAL_ID = 347;
const APPLY = String(process.env.APPLY || "") === "1";
const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL;

(async () => {
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await client.connect();
  try {
    await client.query("BEGIN");

    const before = await client.query(
      `SELECT escrow_id, status, simulated, left(funding_tx_hash,18) AS tx FROM tbl_escrow_deal WHERE escrow_id = $1`,
      [DEAL_ID]
    );
    console.log("DEAL before:", before.rows[0]);

    const ledgerBefore = await client.query(
      `SELECT transaction_id, customer_id, transaction_type, paid_amount, meta->>'kind' AS kind, meta->>'simulated' AS simulated
         FROM tbl_customer_transaction
        WHERE meta->>'escrow_id' = $1 AND meta->>'simulated' = 'true'
        ORDER BY customer_id, transaction_id`,
      [String(DEAL_ID)]
    );
    console.log(`Tainted ledger rows (simulated=true) for deal ${DEAL_ID}:`, ledgerBefore.rowCount);
    for (const r of ledgerBefore.rows) console.log("  ", r);

    // 1) Deal flag
    const d = await client.query(
      `UPDATE tbl_escrow_deal SET simulated = false, updated_at = NOW()
        WHERE escrow_id = $1 AND simulated = true`,
      [DEAL_ID]
    );
    // 2) Ledger meta.simulated -> false (only rows currently flagged true for THIS deal)
    const l = await client.query(
      `UPDATE tbl_customer_transaction
          SET meta = jsonb_set(meta, '{simulated}', 'false'::jsonb), "updatedAt" = NOW()
        WHERE meta->>'escrow_id' = $1 AND meta->>'simulated' = 'true'`,
      [String(DEAL_ID)]
    );
    console.log(`Updated: deal rows=${d.rowCount}, ledger rows=${l.rowCount}`);

    // Verify the seller's simulated-credit total is now zero.
    const seller = await client.query(
      `SELECT COALESCE(SUM(paid_amount),0) AS simulated_usd
         FROM tbl_customer_transaction
        WHERE customer_id = 984 AND transaction_type = 'CREDIT'
          AND payment_mode IN ('ESCROW','WITHDRAWAL','MERCHANT','ADJUSTMENT','TOPUP')
          AND (meta->>'simulated' = 'true' OR meta->>'method' = 'simulated')`
    );
    console.log("Seller 984 simulated credits after repair (should be 0):", seller.rows[0].simulated_usd);

    if (APPLY) {
      await client.query("COMMIT");
      console.log("\n✅ COMMITTED — deal #347 funds reclassified as real. Seller can now cash out.");
    } else {
      await client.query("ROLLBACK");
      console.log("\n🔎 DRY-RUN (rolled back). Re-run with APPLY=1 to commit.");
    }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Repair FAILED (rolled back):", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
