/**
 * SafeDeal referral fee credits: applied at release, each side's credit lowers only its own
 * share of the escrow fee, and custody still balances (buyer credit stays in their balance).
 */
import { computeFeeBreakdown, computeSettlementAmounts, dealFeeBreakdown, feeLevelNote, lockedCostsFrom } from "../controller/escrow/escrowShared";

const quote = (amount: number, feePayer: string, credits?: { buyer?: number; seller?: number }) => {
  const funded = computeFeeBreakdown({ amount, feePercent: 5, feeMinUsd: 10, feePayer, fundingCoin: "USDT-TRC20" });
  const atRelease = computeFeeBreakdown({ amount, feePercent: 5, feeMinUsd: 10, feePayer, lockedCosts: lockedCostsFrom(funded), feeCredits: credits });
  return { funded, atRelease };
};

describe("SafeDeal fee credits", () => {
  it.each(["buyer", "seller", "split"])("custody balances on release when %s pays the fee", (feePayer) => {
    const { funded, atRelease: b } = quote(120, feePayer, { buyer: 4, seller: 3 });
    const amts = computeSettlementAmounts(b, "release");
    const consumed = amts.sellerAmount + b.escrowFee + b.exchangeFeeUsd + b.passThroughCosts;
    expect(funded.buyerPays - consumed).toBeCloseTo(b.feeCreditBuyerUsd, 2);
    expect(amts.buyerRefund).toBe(0);
    expect(b.escrowFee).toBeCloseTo(funded.escrowFee - b.feeCreditBuyerUsd - b.feeCreditSellerUsd, 2);
  });

  it("only the fee payer's credit is used", () => {
    expect(quote(120, "buyer", { buyer: 5, seller: 5 }).atRelease.feeCreditSellerUsd).toBe(0);
    expect(quote(120, "seller", { buyer: 5, seller: 5 }).atRelease.feeCreditBuyerUsd).toBe(0);
    const split = quote(120, "split", { buyer: 9, seller: 9 }).atRelease;
    expect(split.feeCreditBuyerUsd).toBe(5);
    expect(split.feeCreditSellerUsd).toBe(5);
  });

  it("caps the credit at the escrow fee and labels the line", () => {
    const b = computeFeeBreakdown({ amount: 40, feePercent: 5, feeMinUsd: 10, feePayer: "buyer", feeCredits: { buyer: 50 } });
    expect(b.feeCreditBuyerUsd).toBe(10);
    expect(b.escrowFee).toBe(0);
    expect(b.grossEscrowFee).toBe(10);
    expect(b.costItems.find((c) => c.key === "escrow_fee")?.label).toMatch(/credit/);
  });

  it("never applies credits to a cancellation fee", () => {
    const deal = { amount: 100, currency: "USD", fee_percent: 5, fee_min_usd: 10, fee_payer: "buyer", outcome: "refund", dispute_proposal: { kind: "cancellation" }, fee_credit_buyer_usd: 5, fee_credit_seller_usd: 0 };
    const b = dealFeeBreakdown(deal, "refund");
    expect(b.costItems.find((c) => c.key === "escrow_fee")?.label).toMatch(/^Cancellation fee/);
    expect(b.feeCreditBuyerUsd).toBe(0);
  });

  it("describes a loyalty rate on the fee line", () => {
    expect(feeLevelNote("gold", 4, 5)).toMatch(/Gold level rate 4%/);
    expect(feeLevelNote("gold/member", 4.5, 5)).toMatch(/blended/);
    expect(feeLevelNote(null, 5, 5)).toBeNull();
  });
});
