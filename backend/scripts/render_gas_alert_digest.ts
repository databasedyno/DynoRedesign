/**
 * Read-only: render the consolidated gas-wallet alert email to a file (no send,
 * no Redis, no DB). Run:
 *   cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/render_gas_alert_digest.ts [/tmp/out.html]
 */
import dotenv from "dotenv";
dotenv.config();
import { writeFileSync } from "fs";
import { renderFeeWalletDigest, FEE_WALLET_CONFIGS, type WalletStatus } from "../services/feeWalletMonitor";

const now = new Date();
const statuses: WalletStatus[] = [
  { id: "TRX", chain: "TRX", balance: 42.206068, liquid: 42.206068, frozen: 0, status: "warning", lastChecked: now, usdValue: 14.2 },
  { id: "ETH", chain: "ETH", balance: 0.000224023548534, status: "critical", lastChecked: now, usdValue: 0.6 },
  { id: "POLYGON", chain: "POLYGON", balance: 44.81818288, status: "healthy", lastChecked: now, usdValue: 4.88 },
  { id: "XRP_MASTER", chain: "XRP", balance: 3.52222, status: "warning", lastChecked: now, usdValue: null },
];

const { subject, html } = renderFeeWalletDigest(statuses, ["ETH", "TRX"], FEE_WALLET_CONFIGS);
const out = process.argv[2] || "/tmp/gas_alert_digest.html";
writeFileSync(out, html);
console.log("SUBJECT:", subject);
console.log("HTML bytes:", html.length, "->", out);
for (const must of ["0.000224 ETH", "0.049776 ETH", "42.21 TRX", "77.79 TRX", "44.818183 POL", "n/a", "0x2b29aa060c6c15c50c02999ba7d7d090105e1a6b", "TMHECc7emykw5XwX2njp5Y2K4FXLwsTZtC"]) {
  console.log(html.includes(must) ? "  ✓" : "  ✗ MISSING", must);
}
