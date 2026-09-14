/**
 * Manual Admin Fee Sweep for ETH temp address #44
 * Calls the existing sweepPoolAddress function to sweep admin fees to admin wallet.
 * 
 * Usage: cd /app/backend && npx ts-node --transpile-only scripts/sweep_admin_fee_44.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { sweepPoolAddress } from "../services/merchantPool/merchantPoolSweep";

async function main() {
  console.log(`\n=== Manual Admin Fee Sweep: Temp Address #44 ===\n`);
  
  try {
    const result = await sweepPoolAddress(44);
    console.log("\n=== Sweep Result ===");
    console.log(JSON.stringify(result, null, 2));
    
    if ((result as any)?.txHash || (result as any)?.txId) {
      const txHash = (result as any)?.txHash || (result as any)?.txId;
      console.log(`\n✅ SUCCESS! TX Hash: ${txHash}`);
      console.log(`View on Etherscan: https://etherscan.io/tx/${txHash}`);
    } else if ((result as any)?.skipped) {
      console.log(`\n⏭️ Sweep skipped: ${(result as any)?.reason}`);
    } else {
      console.log(`\n✅ Sweep completed`);
    }
  } catch (error: any) {
    console.error("\n❌ Sweep failed:", error.message || error);
  }
  
  process.exit(0);
}

main();
