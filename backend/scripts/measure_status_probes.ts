/**
 * One-off benchmark: proves the status-page probe optimization (2026-06).
 * Times the OLD (N sequential SELECTs) vs NEW (single scalar-subquery) wallet
 * probe against the live DB. Run: `cd backend && npx ts-node scripts/measure_status_probes.ts`
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const RUNS = 6;

async function timeIt(label: string, fn: () => Promise<void>): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = Date.now();
    await fn();
    samples.push(Date.now() - t);
  }
  samples.sort((a, b) => a - b);
  const min = samples[0];
  const avg = Math.round(samples.reduce((s, x) => s + x, 0) / samples.length);
  console.log(`${label.padEnd(34)} min=${min}ms  avg=${avg}ms  samples=[${samples.join(", ")}]`);
  return avg;
}

async function main() {
  await sequelize.authenticate();
  console.log("DB connected. Warming up...");
  await sequelize.query("SELECT 1", { type: QueryTypes.SELECT }); // warm pool

  const oldWallet = async () => {
    await sequelize.query("SELECT 1 FROM tbl_user_wallet LIMIT 1", { type: QueryTypes.SELECT });
    await sequelize.query("SELECT 1 FROM tbl_user_addresses LIMIT 1", { type: QueryTypes.SELECT });
    await sequelize.query("SELECT 1 FROM tbl_admin_wallet LIMIT 1", { type: QueryTypes.SELECT });
  };
  const newWallet = async () => {
    await sequelize.query(
      "SELECT (SELECT 1 FROM tbl_user_wallet LIMIT 1) AS uw, (SELECT 1 FROM tbl_user_addresses LIMIT 1) AS ua, (SELECT 1 FROM tbl_admin_wallet LIMIT 1) AS aw",
      { type: QueryTypes.SELECT }
    );
  };

  console.log(`\nRTT baseline:`);
  await timeIt("single SELECT 1 (1 round-trip)", async () => {
    await sequelize.query("SELECT 1", { type: QueryTypes.SELECT });
  });
  console.log(`\nWallet probe:`);
  await timeIt("OLD wallet (3 sequential)", oldWallet);
  const newAvg = await timeIt("NEW wallet (1 combined)", newWallet);

  console.log(`\nResult: NEW wallet avg ${newAvg}ms ${newAvg < 300 ? "✅ under 300ms" : "⚠️ still >= 300ms"}`);
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("bench failed:", e?.message || e);
  process.exit(1);
});
