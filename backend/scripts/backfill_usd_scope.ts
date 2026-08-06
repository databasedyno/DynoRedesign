/**
 * READ-ONLY scoping for the usd_value backfill. Runs SELECTs only — NO writes.
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/backfill_usd_scope.ts
 */
import dotenv from "dotenv";
dotenv.config();
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const STABLE = `('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON')`;

async function main() {
  const q = async (sql: string) =>
    (await sequelize.query(sql, { type: QueryTypes.SELECT })) as any[];

  const [total] = await q(`SELECT COUNT(*)::int AS n FROM tbl_user_transaction`);
  const [missing] = await q(
    `SELECT COUNT(*)::int AS n FROM tbl_user_transaction ut
     WHERE (ut.usd_value IS NULL OR ut.usd_value = 0) AND COALESCE(ut.base_amount,0) > 0`
  );
  const [missingStable] = await q(
    `SELECT COUNT(*)::int AS n FROM tbl_user_transaction ut
     WHERE (ut.usd_value IS NULL OR ut.usd_value = 0) AND COALESCE(ut.base_amount,0) > 0
       AND UPPER(ut.base_currency) IN ${STABLE}`
  );
  const [missingCrypto] = await q(
    `SELECT COUNT(*)::int AS n FROM tbl_user_transaction ut
     WHERE (ut.usd_value IS NULL OR ut.usd_value = 0) AND COALESCE(ut.base_amount,0) > 0
       AND UPPER(ut.base_currency) NOT IN ${STABLE}`
  );
  const [missingCryptoWithConv] = await q(
    `SELECT COUNT(*)::int AS n FROM tbl_user_transaction ut
     JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id
     WHERE (ut.usd_value IS NULL OR ut.usd_value = 0) AND COALESCE(ut.base_amount,0) > 0
       AND UPPER(ut.base_currency) NOT IN ${STABLE}
       AND COALESCE(sc.source_amount_usd,0) > 0`
  );
  const byCurrency = await q(
    `SELECT UPPER(ut.base_currency) AS cur, COUNT(*)::int AS n,
            ROUND(SUM(ut.base_amount)::numeric, 4) AS total_base
     FROM tbl_user_transaction ut
     WHERE (ut.usd_value IS NULL OR ut.usd_value = 0) AND COALESCE(ut.base_amount,0) > 0
     GROUP BY UPPER(ut.base_currency) ORDER BY n DESC`
  );
  const byStatus = await q(
    `SELECT ut.status, COUNT(*)::int AS n FROM tbl_user_transaction ut
     WHERE (ut.usd_value IS NULL OR ut.usd_value = 0) AND COALESCE(ut.base_amount,0) > 0
       AND UPPER(ut.base_currency) NOT IN ${STABLE}
     GROUP BY ut.status ORDER BY n DESC`
  );

  console.log("=== usd_value backfill scope (READ-ONLY) ===");
  console.log("Total transactions:", total.n);
  console.log("Missing usd_value (null/0, base_amount>0):", missing.n);
  console.log("  -> stablecoin rows (SQL-backfillable, exact):", missingStable.n);
  console.log("  -> non-stablecoin/crypto rows:", missingCrypto.n);
  console.log("       of which have a stablecoin_conversion USD (exact):", missingCryptoWithConv.n);
  console.log("\nBy currency:");
  byCurrency.forEach((r) => console.log(`  ${r.cur}: ${r.n} rows, total_base=${r.total_base}`));
  console.log("\nCrypto rows by status:");
  byStatus.forEach((r) => console.log(`  ${r.status}: ${r.n}`));

  await sequelize.close();
}
main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
