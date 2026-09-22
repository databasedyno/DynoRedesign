/**
 * Run the pool crumb consolidation from the CLI.
 *   npx ts-node --transpile-only scripts/run_crumb_sweep.ts            # dry run
 *   npx ts-node --transpile-only scripts/run_crumb_sweep.ts --apply    # live sweep
 */
import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { connectRedis } from "../utils/redisInstance";
import { consolidatePoolCrumbs } from "../services/merchantPool/poolCrumbSweeper";

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectRedis();
  const report = await consolidatePoolCrumbs({ dryRun: !APPLY });
  console.log(JSON.stringify(report, null, 2));
  await sequelize.close();
  process.exit(0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
