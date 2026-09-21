import "dotenv/config";
import { recoverWrongAssetDeposits } from "../services/merchantPool/wrongAssetRecovery";
import { connectRedis } from "../utils/redisInstance";

// Usage: ts-node scripts/wrong_asset_scan.ts [address] [--live]   (dry-run by default)
(async () => {
  const onlyAddress = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const live = process.argv.includes("--live");
  await connectRedis();
  const r = await recoverWrongAssetDeposits({ dryRun: !live, onlyAddress, force: true });
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e?.message || e); process.exit(1); });
