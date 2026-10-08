/**
 * Paying a SafeDeal from the wallet balance must not charge the inbound network/exchange
 * costs again — the top-up already paid them when the coins reached custody.
 */
import { balanceFundingBreakdown, computeFeeBreakdown } from "../controller/escrow/escrowShared";

// Deal #351 (prod, 2026-10-08): $70, 5% fee with $10 minimum, buyer pays fees.
const deal = { amount: "70.00", currency: "USD", fee_percent: "5.00", fee_min_usd: "10.00", fee_payer: "buyer", seller_payout_coin: null, accepted_coins: null };

describe("SafeDeal balance funding quote", () => {
  it("charges only the deal amount + escrow fee when paid from balance", () => {
    const b = balanceFundingBreakdown(deal);
    expect(b.networkFeeUsd).toBe(0);
    expect(b.exchangeFeeUsd).toBe(0);
    expect(b.conversionFeeUsd).toBe(0);
    expect(b.escrowFee).toBe(10);
    expect(b.buyerPays).toBe(80);
    expect(b.costItems.find((c) => c.key === "network_fee")?.note).toMatch(/SafeDeal balance/);
  });

  it("still prices the inbound network fee for an on-chain checkout", () => {
    const b = computeFeeBreakdown({ amount: 70, currency: "USD", feePercent: 5, feeMinUsd: 10, feePayer: "buyer", fundingCoin: "USDT-TRC20" });
    expect(b.networkFeeUsd).toBeGreaterThan(0);
    expect(b.buyerPays).toBeGreaterThan(80);
  });

  it("frozen costs win over fromBalance once a deal is funded", () => {
    const b = computeFeeBreakdown({
      amount: 65, feePercent: 5, feeMinUsd: 10, feePayer: "buyer", fromBalance: true,
      lockedCosts: { networkFeeUsd: 4.38, conversionFeeUsd: 0, exchangeFeeUsd: 0, withdrawalFeeUsd: 5, exchangeFeePercent: 2, payoutCoin: "USDT-TRON", quotedFundingCoin: "USDT", feeModel: "v2" } as any,
    });
    expect(b.buyerPays).toBe(79.38);
  });
});
