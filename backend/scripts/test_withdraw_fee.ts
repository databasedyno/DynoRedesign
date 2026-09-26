/* Standalone check of the cashout-fee floor (no DB needed). */
import { customerWithdrawFeeUsd, withdrawFeeUsdFor, getEscrowCostRates } from "../services/escrow/escrowCosts";

const rates = getEscrowCostRates();
const keys = ["USDT-TRON", "USDT-ERC20", "USDT-POLYGON", "USDC-ERC20", "USDC-POLYGON"];
console.log("payout_key        real(withdrawFeeUsdFor)   customer(floored $5)");
for (const k of keys) {
  const real = withdrawFeeUsdFor(k);
  const cust = customerWithdrawFeeUsd(k);
  const ok = cust >= 5 && cust >= real;
  console.log(`${k.padEnd(16)}  ${String(real).padEnd(22)}  ${String(cust).padEnd(10)}  ${ok ? "PASS" : "FAIL"}`);
}
// Simulate a live Binance fee ABOVE the floor to prove we never undercharge.
rates.withdraw["USDT-ERC20"] = 7.25;
const high = customerWithdrawFeeUsd("USDT-ERC20");
console.log(`\nWith live ERC20 fee=7.25 -> customer=${high} (${high === 7.25 ? "PASS: rises above floor" : "FAIL"})`);
