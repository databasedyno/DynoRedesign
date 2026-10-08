/**
 * SafeDeal rewards self-test (math + DB service paths). Settlement can't be funded on a preview
 * pod (simulation off; shared prod DB), so release is exercised on an IN-MEMORY deal row.
 *   DOTENV_CONFIG_PATH=/app/backend/.env node -r dotenv/config node_modules/.bin/ts-node --transpile-only \
 *     scripts/safedeal_rewards_selftest.ts <referrerCid> <refereeCid> [<refereeCid2> <refereeCid3>]
 * Only touches the given throwaway (@example.com) customers' credit/referral rows.
 */
import { computeFeeBreakdown, computeSettlementAmounts, dealFeeBreakdown, lockedCostsFrom } from "../controller/escrow/escrowShared";
import { applyReleaseFeeCredits, creditBalance, levelFromStats, levelPercent, onDealCompleted } from "../services/safedeal/safedealRewards";
import sequelize from "../utils/dbInstance";

let failures = 0;
const ok = (cond: boolean, label: string, extra: unknown = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra !== "" ? `  ${JSON.stringify(extra)}` : ""}`);
};
const near = (a: number, b: number) => Math.abs(a - b) < 0.011;

function mathChecks() {
  for (const amount of [30, 120, 500, 2999]) {
    for (const feePayer of ["buyer", "seller", "split"]) {
      const funded = computeFeeBreakdown({ amount, feePercent: 5, feeMinUsd: 10, feePayer, fundingCoin: "USDT-TRC20" });
      const locked = lockedCostsFrom(funded);
      const credits = { buyer: 4, seller: 3 };
      const b = computeFeeBreakdown({ amount, feePercent: 5, feeMinUsd: 10, feePayer, lockedCosts: locked, feeCredits: credits });
      const held = funded.buyerPays;
      const amts = computeSettlementAmounts(b, "release");
      const consumed = amts.sellerAmount + b.escrowFee + b.exchangeFeeUsd + b.passThroughCosts;
      const leftover = held - consumed;
      const tag = `${feePayer} $${amount}`;
      ok(near(b.escrowFee, funded.escrowFee - b.feeCreditBuyerUsd - b.feeCreditSellerUsd), `${tag}: net escrow fee = gross - credits`, [funded.escrowFee, b.escrowFee]);
      ok(near(leftover, b.feeCreditBuyerUsd) && near(amts.buyerRefund, 0), `${tag}: buyer credit stays in buyer balance (no drift)`, [leftover, b.feeCreditBuyerUsd]);
      ok(near(amts.sellerAmount - funded.sellerReceives, b.feeCreditSellerUsd), `${tag}: seller gets +seller credit`, [amts.sellerAmount, funded.sellerReceives]);
      ok(feePayer !== "buyer" || b.feeCreditSellerUsd === 0, `${tag}: seller credit unused when buyer pays`);
      ok(feePayer !== "seller" || b.feeCreditBuyerUsd === 0, `${tag}: buyer credit unused when seller pays`);
    }
  }
  const big = computeFeeBreakdown({ amount: 40, feePercent: 5, feeMinUsd: 10, feePayer: "buyer", feeCredits: { buyer: 50 } });
  ok(big.feeCreditBuyerUsd === 10 && big.escrowFee === 0, "credit capped at the escrow fee share", [big.feeCreditBuyerUsd, big.escrowFee]);
  ok(levelFromStats({ deals: 0, volume: 0 }).key === "member", "level: member");
  ok(levelFromStats({ deals: 3, volume: 0 }).key === "silver" && levelFromStats({ deals: 0, volume: 1000 }).key === "silver", "level: silver by deals OR volume");
  ok(levelFromStats({ deals: 10, volume: 0 }).key === "gold" && levelFromStats({ deals: 2, volume: 5000 }).key === "gold", "level: gold");
  ok(levelFromStats({ deals: 25, volume: 0 }).key === "platinum" && levelFromStats({ deals: 0, volume: 20000 }).key === "platinum", "level: platinum");
  ok(levelFromStats({ deals: 2, volume: 999.99 }).key === "member", "level: just below silver stays member");
  ok(levelPercent(levelFromStats({ deals: 10, volume: 0 }), 5) === 4 && levelPercent(levelFromStats({ deals: 25, volume: 0 }), 5) === 3.5, "level fee: gold 4%, platinum 3.5%");
  const gold = computeFeeBreakdown({ amount: 1000, feePercent: 4, feeMinUsd: 10, feePayer: "buyer" });
  ok(gold.escrowFee === 40, "gold 4% on $1000 = $40", gold.escrowFee);
  const floor = computeFeeBreakdown({ amount: 100, feePercent: 3.5, feeMinUsd: 10, feePayer: "buyer" });
  ok(floor.escrowFee === 10, "minimum $10 fee still applies at a loyalty rate", floor.escrowFee);
}

const fakeDeal = (escrowId: number, sellerCid: number, buyerCid: number, amount: number) => ({
  escrow_id: escrowId,
  source: "safedeal",
  title: "QA rewards self-test",
  creator_role: "seller",
  creator_customer_id: sellerCid,
  counterparty_customer_id: buyerCid,
  fee_payer: "buyer",
  amount,
  currency: "USD",
  fee_percent: 5,
  fee_min_usd: 10,
  status: "completed",
  outcome: "release",
  simulated: false,
  fee_credit_buyer_usd: 0,
  fee_credit_seller_usd: 0,
});

async function dbChecks(referrer: number, referee: number, extra: number[]) {
  const base = 900000000 + (Date.now() % 1000000);
  const startA = await creditBalance(referrer);
  const startB = await creditBalance(referee);
  ok(startB === 5, "referee holds the $5 welcome credit", startB);

  const deal: any = fakeDeal(base, referrer, referee, 120);
  const gross = dealFeeBreakdown(deal).escrowFee;
  await applyReleaseFeeCredits(deal, gross);
  ok(Number(deal.fee_credit_buyer_usd) === 5 && Number(deal.fee_credit_seller_usd) === 0, "release spends the buyer's credit on their fee", [deal.fee_credit_buyer_usd, deal.fee_credit_seller_usd]);
  ok((await creditBalance(referee)) === 0, "referee balance now 0");
  await applyReleaseFeeCredits(deal, gross);
  ok(Number(deal.fee_credit_buyer_usd) === 5 && (await creditBalance(referee)) === 0, "re-applying is idempotent (same amount, no double spend)");
  const net = dealFeeBreakdown(deal);
  ok(net.escrowFee === gross - 5 && net.feeCreditBuyerUsd === 5, "deal breakdown shows net fee after credit", [gross, net.escrowFee]);

  const small: any = fakeDeal(base + 1, referrer, referee, 40);
  await onDealCompleted(small);
  ok((await creditBalance(referrer)) === startA, "a $40 deal does not qualify the referral");

  await onDealCompleted(deal);
  ok((await creditBalance(referrer)) === startA + 5, "referrer earns $5 after the friend's first $50+ release", await creditBalance(referrer));
  await onDealCompleted(deal);
  ok((await creditBalance(referrer)) === startA + 5, "reward is paid once");

  if (extra.length >= 2) {
    for (const [i, cid] of extra.entries()) await onDealCompleted(fakeDeal(base + 10 + i, referrer, cid, 75));
    ok((await creditBalance(referrer)) === startA + 15 + 15, "3 rewarded friends → $15 + $15 milestone bonus", await creditBalance(referrer));
  }
}

(async () => {
  mathChecks();
  const [referrer, referee, ...extra] = process.argv.slice(2).map(Number);
  if (referrer && referee) await dbChecks(referrer, referee, extra);
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  await sequelize.close();
  process.exit(failures ? 1 : 0);
})();
