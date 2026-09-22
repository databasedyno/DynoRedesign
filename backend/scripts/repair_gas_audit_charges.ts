/** One-off: re-derive charged network fees for backfilled gas-audit rows.  npx ts-node --transpile-only scripts/repair_gas_audit_charges.ts */
import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { repairBackfillCharges } from "../services/payoutGasAudit";

(async () => {
  console.log(JSON.stringify(await repairBackfillCharges()));
  await sequelize.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
