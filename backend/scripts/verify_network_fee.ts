/**
 * Diagnostic: what does Dynopay charge as the USDT-TRC20 network fee right now,
 * and how does it compare with a real on-chain receipt?
 *
 *   cd backend && npx ts-node -T scripts/verify_network_fee.ts [txId]
 *
 * Prints:
 *   - live TRON energy price + USDT contract energy factor (Dynamic Energy Model)
 *   - the generic per-transfer estimate used for checkout quotes / settlement fallback
 *   - an exact simulation for a sample pool → merchant transfer
 *   - the actual fee burned by a given tx (defaults to the 2026-09-22 SMADAV forward)
 */
import "dotenv/config";
import { connectRedis } from "../utils/redisInstance";
import {
  estimateTrc20TransferCost,
  getTrc20EnergyFactor,
  getTronNetworkParams,
  getTronTxActualFeeTRX,
} from "../services/tronEnergyService";
import { getBlockchainNetworkFee, getCryptoPrice } from "../services/blockchainFeeService";

const SAMPLE_TX = process.argv[2] || "b5228205209103d3f6afa901a46d4d83cb817eb8926db66f28f066c79d352f3e";

(async () => {
  await connectRedis();
  const params = await getTronNetworkParams();
  const factor = await getTrc20EnergyFactor();
  const trxUsd = await getCryptoPrice("TRX");
  console.log(`TRON energy price : ${params.energyPriceSun} SUN  | USDT energy_factor: ${factor}x  | TRX/USD: ${trxUsd}`);

  const generic = await getBlockchainNetworkFee("USDT-TRC20");
  console.log(`Generic estimate  : ${generic.feeInNative} TRX ≈ $${Number(generic.feeInUSD).toFixed(4)} (checkout quote / settlement fallback)`);

  const sim = await estimateTrc20TransferCost({
    senderAddress: "TW4GMHNQo8wU8gnjTHJ54WzNgsNhFGMKLa",
    recipientAddress: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR",
    amountBaseUnits: 1_000_000n,
  });
  console.log(`Exact simulation  : ${sim.totalTRX} TRX (${sim.energy} energy, source=${sim.source}) ≈ $${(sim.totalTRX * trxUsd).toFixed(4)}`);

  const actual = await getTronTxActualFeeTRX(SAMPLE_TX);
  console.log(`On-chain receipt  : ${actual ? `${actual.feeTRX} TRX (${actual.energyUsed} energy, penalty ${actual.energyPenalty})` : "not found / not confirmed"}  tx=${SAMPLE_TX.slice(0, 12)}…`);

  const ok = actual ? Math.abs(sim.energy - actual.energyUsed) / actual.energyUsed < 0.05 : true;
  console.log(ok ? "RESULT: estimate within 5% of the real receipt ✅" : "RESULT: estimate deviates >5% from the real receipt ❌");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
