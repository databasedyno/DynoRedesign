import { computeFeeBreakdown } from "../controller/escrow/escrowShared";
import { getEscrowCostRates } from "../services/escrow/escrowCosts";

const coins = ["USDT-TRC20", "USDT-POLYGON", "USDC-ERC20", "USDT-ERC20", "BTC", "ETH", "SOL", "LTC", "DOGE"];
const deal = { amount: 30, currency: "USD", fee_percent: 5, fee_min_usd: 10, fee_payer: "buyer", seller_payout_coin: "USDT-TRON", accepted_coins: "" };

console.log("Conversion pct in rate table:", getEscrowCostRates().conversionPct, "%");
console.log("");
console.log("coin".padEnd(14), "stable".padEnd(7), "buyerPays".padEnd(11), "network".padEnd(9), "conversion".padEnd(11), "withdrawal");
for (const coin of coins) {
  const b = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: coin, acceptedCoins: deal.accepted_coins });
  const stable = /usdt|usdc/i.test(coin) ? "yes" : "NO";
  console.log(
    coin.padEnd(14),
    stable.padEnd(7),
    ("$" + b.buyerPays.toFixed(2)).padEnd(11),
    ("$" + b.networkFeeUsd.toFixed(2)).padEnd(9),
    ("$" + b.conversionFeeUsd.toFixed(2)).padEnd(11),
    "$" + b.withdrawalFeeUsd.toFixed(2)
  );
}
