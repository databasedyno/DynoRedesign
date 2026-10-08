/**
 * Bridge between the escrow engine and SafeDeal customer wallets.
 * Only used for deals with source = 'safedeal'.
 */
import { resolveCustomerForBrand, CustomerRow } from "../customerWalletService";
import { adminNotifyOnCreate } from "./safedealAdminNotify";
import { applyEntries, EntryInput } from "./safedealWallet";
import { toFixedStr } from "../../utils/money";
import { round2Float as round2 } from "../../utils/money";


export interface DealParties {
  buyer: CustomerRow;
  seller: CustomerRow;
}

export async function resolveDealParties(deal: any): Promise<DealParties> {
  const companyId = Number(deal.company_id);
  const creatorIsBuyer = deal.creator_role === "buyer";
  const onCreate = adminNotifyOnCreate("deal", `deal #${deal.escrow_id}`);
  const creator = await resolveCustomerForBrand({
    companyId,
    customerId: deal.creator_customer_id || null,
    email: deal.creator_email,
    createIfMissing: true,
    onCreate,
  });
  const counterparty = await resolveCustomerForBrand({
    companyId,
    customerId: deal.counterparty_customer_id || null,
    email: deal.counterparty_email,
    createIfMissing: true,
    onCreate,
  });
  if (!deal.creator_customer_id) deal.creator_customer_id = creator.customer_id;
  if (!deal.counterparty_customer_id) deal.counterparty_customer_id = counterparty.customer_id;
  return creatorIsBuyer ? { buyer: creator, seller: counterparty } : { buyer: counterparty, seller: creator };
}

const dealRef = (deal: any) => `#${deal.escrow_id}`;

/** Buyer paid from outside (hosted checkout or simulated) — money lands straight in the held bucket. */
export async function recordFundingReceived(deal: any, amountUsd: number, method: string): Promise<void> {
  const { buyer } = await resolveDealParties(deal);
  await applyEntries([
    {
      customer: buyer,
      type: "CREDIT",
      amount: amountUsd,
      kind: "escrow_funding",
      description: `Escrow funding received — deal ${dealRef(deal)} "${deal.title}" (held in escrow)`,
      reference: `escrow:${deal.escrow_id}:funding`,
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      meta: { bucket: "held", method, simulated: method === "simulated" || !!deal.simulated },
    },
  ]);
}

/** Buyer funds from their available balance — available → held. */
export async function fundFromBalance(deal: any, amountUsd: number): Promise<void> {
  const { buyer } = await resolveDealParties(deal);
  await applyEntries([
    {
      customer: buyer,
      type: "HOLD",
      amount: amountUsd,
      kind: "escrow_hold",
      description: `Paid from balance into escrow — deal ${dealRef(deal)} "${deal.title}"`,
      reference: `escrow:${deal.escrow_id}:funding`,
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      meta: { method: "balance" },
    },
  ]);
  // The deposit just moved into escrow — release its auto-withdraw protection for whatever's left.
  try {
    const { clampDepositReserve } = await import("./safedealWithdrawals");
    await clampDepositReserve(buyer.customer_id);
  } catch { /* non-fatal */ }
}

/**
 * Settle a funded SafeDeal into wallets. The buyer's hold (X = buyerPays) is released
 * and consumed by: paid-to-seller, escrow fee, network/exchange costs. The seller is
 * credited their share. Everything is idempotent per deal.
 */
export async function settleToWallets(
  deal: any,
  amounts: { sellerAmount: number; buyerRefund: number },
  breakdown: { buyerPays: number; escrowFee: number; exchangeFeeUsd?: number; passThroughCosts: number; totalCost: number; feeCreditBuyerUsd?: number; feeCreditSellerUsd?: number }
): Promise<{ sellerCredited: boolean; buyerRefunded: boolean }> {
  const { buyer, seller } = await resolveDealParties(deal);
  const held = round2(Number(deal.custody_amount_stable ?? deal.funded_amount_usd ?? breakdown.buyerPays));
  const outcome = String(deal.outcome || "release");
  const exchangeFee = round2(Number(breakdown.exchangeFeeUsd || 0));
  // Buyer's SafeDeal fee credit (release): that part of the fee is never debited, so it stays
  // in the buyer's available balance after the hold is released.
  const buyerFeeCredit = round2(Number(breakdown.feeCreditBuyerUsd || 0));
  const totalFeeCredit = round2(buyerFeeCredit + Number(breakdown.feeCreditSellerUsd || 0));
  const ref = (k: string) => `escrow:${deal.escrow_id}:settle:${k}`;
  const title = `deal ${dealRef(deal)} "${deal.title}"`;
  // Money that entered escrow as a simulated payment stays flagged all the way through settlement.
  const simulated = !!deal.simulated || String(deal.funding_method || "") === "simulated";
  const entries: EntryInput[] = [
    {
      customer: buyer,
      type: "UNHOLD",
      amount: held,
      kind: "hold_released",
      description:
        outcome === "refund"
          ? `Refund — escrow hold released back to your balance, ${title}`
          : outcome === "split"
          ? `Split settlement — escrow hold released, ${title}`
          : `Deal completed — escrow hold released for settlement, ${title}`,
      reference: ref("unhold"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      meta: { outcome, simulated },
    },
  ];
  if (amounts.sellerAmount > 0) {
    entries.push({
      customer: buyer,
      type: "DEBIT",
      amount: amounts.sellerAmount,
      kind: "paid_to_seller",
      description: `Paid to seller (${seller.email}) — ${title}`,
      reference: ref("paid_to_seller"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      allowNegative: true,
      meta: { outcome, counterparty: seller.email },
    });
  }
  if (breakdown.escrowFee > 0) {
    entries.push({
      customer: buyer,
      type: "DEBIT",
      amount: breakdown.escrowFee,
      kind: "escrow_fee",
      description: `Escrow fee — ${title}${totalFeeCredit > 0 ? ` (after $${totalFeeCredit.toFixed(2)} SafeDeal fee credit)` : ""}`,
      reference: ref("fee"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      allowNegative: true,
      meta: { outcome, ...(totalFeeCredit > 0 ? { fee_credit_usd: totalFeeCredit } : {}) },
    });
  }
  if (exchangeFee > 0) {
    entries.push({
      customer: buyer,
      type: "DEBIT",
      amount: exchangeFee,
      kind: "exchange_fee",
      description: `Exchange fee (non-stablecoin funding) — ${title}`,
      reference: ref("exchange_fee"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      allowNegative: true,
      meta: { outcome },
    });
  }
  if (breakdown.passThroughCosts > 0) {
    entries.push({
      customer: buyer,
      type: "DEBIT",
      amount: breakdown.passThroughCosts,
      kind: "escrow_costs",
      description: `Network & conversion costs — ${title}`,
      reference: ref("costs"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      allowNegative: true,
      meta: { outcome },
    });
  }
  // Rounding guard: whatever is left of the hold after the debits above is the buyer's refund;
  // if the pieces don't sum exactly to the hold (cents), true it up on the buyer side.
  const consumed = round2((amounts.sellerAmount > 0 ? amounts.sellerAmount : 0) + breakdown.escrowFee + exchangeFee + breakdown.passThroughCosts);
  const leftover = round2(held - consumed);
  const drift = round2(leftover - amounts.buyerRefund - buyerFeeCredit);
  if (Math.abs(drift) >= 0.01) {
    entries.push({
      customer: buyer,
      type: drift > 0 ? "DEBIT" : "CREDIT",
      amount: Math.abs(drift),
      kind: "rounding",
      description: `Rounding adjustment — ${title}`,
      reference: ref("rounding"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      allowNegative: true,
      meta: { outcome, simulated },
    });
  }
  if (amounts.sellerAmount > 0) {
    entries.push({
      customer: seller,
      type: "CREDIT",
      amount: amounts.sellerAmount,
      kind: "release_received",
      description: `Release received from buyer (${buyer.email}) — ${title}${
        Number(breakdown.totalCost) > 0 ? ` (net of your share of fees)` : ""
      }`,
      reference: ref("release"),
      escrowId: deal.escrow_id,
      dealTitle: deal.title,
      meta: { outcome, counterparty: buyer.email, gross: toFixedStr(deal.amount, 2), simulated },
    });
  }
  await applyEntries(entries);
  return { sellerCredited: amounts.sellerAmount > 0, buyerRefunded: amounts.buyerRefund > 0 };
}
