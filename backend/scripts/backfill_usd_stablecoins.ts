/**
 * Backfill usd_value for STABLECOIN transactions that are missing it.
 * For stablecoins, usd_value === base_amount (face value) — exact, no rates.
 * Scope is strictly limited to stablecoin base_currency rows with null/0
 * usd_value; crypto/pending rows are intentionally NOT touched.
 *
 * Usage:
 *   Dry run (default, NO write):  npx ts-node --transpile-only scripts/backfill_usd_stablecoins.ts
 *   Apply:                        npx ts-node --transpile-only scripts/backfill_usd_stablecoins.ts --apply
 */
import dotenv from "dotenv";
dotenv.config();
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";

const STABLE = `('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON')`;
const WHERE = `(usd_value IS NULL OR usd_value = 0) AND COALESCE(base_amount,0) > 0 AND UPPER(base_currency) IN ${STABLE}`;
const APPLY = process.argv.includes("--apply");

async function main() {
  const rows = (await sequelize.query(
    `SELECT COUNT(*)::int AS n, ROUND(SUM(base_amount)::numeric,2) AS total_usd
     FROM tbl_user_transaction WHERE ${WHERE}`,
    { type: QueryTypes.SELECT }
  )) as any[];
  const target = rows[0];
  console.log(`Target stablecoin rows to backfill: ${target.n} (total usd = ${target.total_usd})`);

  if (!APPLY) {
    console.log("DRY RUN — no changes written. Re-run with --apply to update.");
    await sequelize.close();
    return;
  }

  const [, meta] = await sequelize.query(
    `UPDATE tbl_user_transaction SET usd_value = base_amount WHERE ${WHERE}`
  );
  // pg returns affected row count on the query result
  const affected = (meta as any)?.rowCount ?? "unknown";
  console.log(`✅ APPLIED — rows updated: ${affected}`);

  const [check] = (await sequelize.query(
    `SELECT COUNT(*)::int AS n FROM tbl_user_transaction WHERE ${WHERE}`,
    { type: QueryTypes.SELECT }
  )) as any[];
  console.log(`Remaining stablecoin rows still missing usd_value (should be 0): ${check.n}`);

  await sequelize.close();
}
main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
