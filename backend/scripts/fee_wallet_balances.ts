/**
 * Read-only: print live on-chain balances of every gas/fee wallet + XRP master.
 * Run: cd /app/backend && node_modules/.bin/ts-node --transpile-only scripts/fee_wallet_balances.ts
 */
import dotenv from "dotenv";
dotenv.config();
import tatumApi from "../apis/tatumApi";

const WALLETS: Array<{ label: string; chain: string; address: string; healthy: number }> = [
  { label: "TRX fee wallet (gas for USDT-TRC20)", chain: "TRX", address: process.env.TRX_FEE_WALLET || "", healthy: 120 },
  { label: "ETH fee wallet (gas for USDT/USDC/RLUSD-ERC20)", chain: "ETH", address: process.env.ETH_FEE_WALLET || "", healthy: 0.05 },
  { label: "POL fee wallet (gas for USDT-POLYGON)", chain: "POLYGON", address: process.env.POLYGON_FEE_WALLET || "", healthy: 10 },
  { label: "XRP fee wallet (legacy per-address activation)", chain: "XRP", address: process.env.XRP_FEE_WALLET || "", healthy: 5 },
  { label: "XRP master wallet (tag-based XRP/RLUSD receiving)", chain: "XRP", address: process.env.XRP_MASTER_WALLET || "", healthy: 5 },
];

(async () => {
  for (const w of WALLETS) {
    if (!w.address) {
      console.log(`${w.label}: NOT CONFIGURED`);
      continue;
    }
    try {
      const r = (await tatumApi.getAddressBalance(w.address, w.chain, true)) as Record<string, unknown> | null;
      const bal = Number((r?.total ?? r?.balance) as string);
      const flag = !Number.isFinite(bal) ? "??" : bal === 0 ? "EMPTY" : bal < w.healthy ? "LOW" : "OK";
      console.log(`${w.label}\n   ${w.address}\n   balance=${Number.isFinite(bal) ? bal : JSON.stringify(r)} ${w.chain === "POLYGON" ? "POL" : w.chain}  [${flag}] (healthy >= ${w.healthy})`);
    } catch (e) {
      console.log(`${w.label}\n   ${w.address}\n   ERROR: ${(e as Error).message}`);
    }
  }
  process.exit(0);
})();
