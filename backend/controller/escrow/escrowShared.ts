/**
 * Escrow shared helpers — fee math, the deal state machine, role resolution,
 * activity-log helpers and the (gated) settlement executor.
 *
 * Money-safety: on-chain settlement is gated behind ESCROW_LIVE_SETTLEMENT. When
 * OFF (the default, and always in the SAFE-MODE preview) settlement is SIMULATED:
 * amounts are computed and recorded and the deal advances state, but NO crypto is
 * moved. This lets the full lifecycle be exercised without touching real funds.
 */
import { raw as envRaw } from "../../utils/config";
import {
  getEscrowCostRates,
  sweepFeeUsdFor,
  withdrawFeeUsdFor,
  normalizePayoutKey,
  DEFAULT_PAYOUT_KEY,
} from "../../services/escrow/escrowCosts";

export type EscrowRole = "buyer" | "seller";
export type FeePayer = "buyer" | "seller" | "split";
export type SettlementOutcome = "release" | "refund" | "split";

export const ESCROW_STATUSES = [
  "draft",
  "invited",
  "declined",
  "awaiting_payment",
  "funded",
  "delivered",
  "disputed",
  "completed", // release authorized (seller entitled) — payout may be pending
  "refunded", // refund authorized (buyer entitled) — payout may be pending
  "split", // split authorized (both entitled) — legs settle independently
  "cancelled",
  "expired",
] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

/** Terminal LIFECYCLE states (payout legs may still move pending→paid after). */
export const TERMINAL_STATUSES: EscrowStatus[] = [
  "declined",
  "completed",
  "refunded",
  "split",
  "cancelled",
  "expired",
];

/** Default hold/payout stablecoins (decision 6). */
export const ESCROW_STABLECOINS = ["USDT-TRON", "USDC"] as const;
export const DEFAULT_ESCROW_STABLECOIN = "USDT-TRON";

/**
 * Allowed forward transitions. An invalid jump (e.g. a disputed deal silently
 * becoming active) is rejected by assertTransition().
 */
export const ALLOWED_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  draft: ["invited", "cancelled"],
  invited: ["awaiting_payment", "declined", "cancelled", "expired"],
  declined: [],
  awaiting_payment: ["funded", "cancelled", "expired"],
  funded: ["delivered", "disputed", "completed", "refunded", "split"],
  delivered: ["completed", "disputed", "refunded", "split"],
  disputed: ["completed", "refunded", "split"],
  completed: [],
  refunded: [],
  split: [],
  cancelled: [],
  expired: [],
};

/** Map a settlement outcome to the deal status it authorizes. */
export function outcomeToStatus(outcome: SettlementOutcome): EscrowStatus {
  return outcome === "refund" ? "refunded" : outcome === "split" ? "split" : "completed";
}

export function canTransition(from: string, to: EscrowStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as EscrowStatus];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function assertTransition(from: string, to: EscrowStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid escrow transition: ${from} → ${to}`);
  }
}

export function opposite(role: EscrowRole): EscrowRole {
  return role === "buyer" ? "seller" : "buyer";
}

/** Resolve which side (buyer/seller) the creator and counterparty each are. */
export function resolveRoles(creatorRole: string): {
  creator: EscrowRole;
  counterparty: EscrowRole;
} {
  const creator: EscrowRole = creatorRole === "buyer" ? "buyer" : "seller";
  return { creator, counterparty: opposite(creator) };
}

export interface CostItem {
  key: "escrow_fee" | "network_fee" | "conversion_fee" | "withdrawal_fee";
  label: string;
  amount: number; // USD
  note?: string;
}

export interface FeeBreakdown {
  amount: number; // deal value (fiat display currency)
  currency: string;
  feePercent: number;
  feeMinUsd: number;
  feePayer: FeePayer;
  escrowFee: number; // platform escrow fee (platform revenue)
  // pass-through settlement costs (estimated; folded into the price)
  networkFeeUsd: number; // inbound sweep of the funded crypto to custody
  conversionFeeUsd: number; // Binance conversion crypto -> stablecoin
  withdrawalFeeUsd: number; // Binance withdrawal at cashout (per payout network)
  passThroughCosts: number; // network + conversion + withdrawal
  totalCost: number; // escrowFee + passThroughCosts (what the fee_payer bears beyond `amount`)
  payoutCoin: string; // stablecoin the withdrawal fee was estimated for
  costsEstimated: boolean; // true — refined at funding when the real coin is known
  costItems: CostItem[]; // itemised, for UI
  buyerPays: number; // what the buyer funds into escrow
  sellerReceives: number; // net to seller after their share of costs
  platformFee: number; // == escrowFee (kept by platform)
  networkNote: string;
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Cheapest inbound sweep among a comma-list of accepted coins (for the quote). */
function estimateInboundFee(fundingCoin?: string | null, acceptedCoins?: string | null): number {
  if (fundingCoin) return sweepFeeUsdFor(fundingCoin);
  const coins = String(acceptedCoins || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!coins.length) return sweepFeeUsdFor(null);
  return Math.min(...coins.map((c) => sweepFeeUsdFor(c)));
}

/**
 * Compute the itemised escrow fee + settlement-cost breakdown for a deal.
 * - escrow fee: max(amount * feePercent/100, feeMinUsd), default 5% floor $1.
 * - settlement costs (inbound network sweep + Binance conversion + outbound
 *   withdrawal) are ESTIMATED and folded into the price.
 * - the TOTAL (escrow fee + costs) is allocated to whoever pays the fee:
 *     buyer  -> added on top of the amount the buyer funds; seller nets full amount.
 *     seller -> deducted from the seller's payout; buyer funds only the amount.
 *     split  -> 50/50.
 * Costs are refined at funding time once the real funding coin is known.
 */
export function computeFeeBreakdown(input: {
  amount: number | string;
  currency?: string;
  feePercent?: number | string;
  feeMinUsd?: number | string;
  feePayer?: string;
  payoutCoin?: string | null;
  fundingCoin?: string | null;
  acceptedCoins?: string | null;
  includeCosts?: boolean;
}): FeeBreakdown {
  const amount = round2(Number(input.amount) || 0);
  const currency = (input.currency || "USD").toUpperCase();
  const feePercent = Number(input.feePercent ?? 5) || 0;
  const feeMinUsd = Number(input.feeMinUsd ?? 1) || 0;
  const feePayer: FeePayer =
    input.feePayer === "seller"
      ? "seller"
      : input.feePayer === "split"
      ? "split"
      : "buyer";

  const escrowFee = round2(Math.max((amount * feePercent) / 100, feeMinUsd));

  // ── settlement cost estimate ───────────────────────────────────────────────
  const includeCosts = input.includeCosts !== false;
  const payoutKey = normalizePayoutKey(input.payoutCoin || DEFAULT_PAYOUT_KEY);
  const rates = getEscrowCostRates();
  const networkFeeUsd = includeCosts ? round2(estimateInboundFee(input.fundingCoin, input.acceptedCoins)) : 0;
  const conversionFeeUsd = includeCosts ? round2((amount * (rates.conversionPct || 0)) / 100) : 0;
  const withdrawalFeeUsd = includeCosts ? round2(withdrawFeeUsdFor(payoutKey)) : 0;
  const passThroughCosts = round2(networkFeeUsd + conversionFeeUsd + withdrawalFeeUsd);
  const totalCost = round2(escrowFee + passThroughCosts);

  let buyerPays = amount;
  let sellerReceives = amount;
  if (feePayer === "buyer") {
    buyerPays = round2(amount + totalCost);
    sellerReceives = amount;
  } else if (feePayer === "seller") {
    buyerPays = amount;
    sellerReceives = round2(Math.max(0, amount - totalCost));
  } else {
    const half = round2(totalCost / 2);
    buyerPays = round2(amount + half);
    sellerReceives = round2(Math.max(0, amount - (totalCost - half)));
  }

  const costItems: CostItem[] = [
    { key: "escrow_fee", label: `Escrow fee (${feePercent}%)`, amount: escrowFee },
  ];
  if (includeCosts) {
    costItems.push(
      { key: "network_fee", label: "Network fee (est.)", amount: networkFeeUsd, note: "On-chain fee to move the funded crypto into custody." },
      { key: "conversion_fee", label: "Conversion fee (est.)", amount: conversionFeeUsd, note: "Converting the crypto to a stablecoin on the exchange." },
      { key: "withdrawal_fee", label: `Withdrawal fee (est., ${payoutKey})`, amount: withdrawalFeeUsd, note: "Exchange withdrawal fee to pay the stablecoin out at cashout." }
    );
  }

  return {
    amount,
    currency,
    feePercent,
    feeMinUsd,
    feePayer,
    escrowFee,
    networkFeeUsd,
    conversionFeeUsd,
    withdrawalFeeUsd,
    passThroughCosts,
    totalCost,
    payoutCoin: payoutKey,
    costsEstimated: includeCosts,
    costItems,
    buyerPays,
    sellerReceives,
    platformFee: escrowFee,
    networkNote:
      "Network, conversion and withdrawal costs are estimates folded into the price and settled from the funded amount; the exact withdrawal fee depends on the payout coin/network chosen at cashout.",
  };
}

/** Whether live on-chain settlement is enabled. Default OFF (simulated). */
export function isLiveSettlementEnabled(): boolean {
  return String(envRaw("ESCROW_LIVE_SETTLEMENT") || "").toLowerCase() === "true";
}

export interface ActivityEntry {
  at: string;
  type: string;
  actor?: string; // email or "system"/"admin"
  role?: string; // buyer | seller | admin | system
  note?: string;
  meta?: Record<string, unknown>;
}

export function appendActivity(
  log: unknown,
  entry: Omit<ActivityEntry, "at"> & { at?: string }
): ActivityEntry[] {
  const list: ActivityEntry[] = Array.isArray(log) ? (log as ActivityEntry[]) : [];
  return [
    ...list,
    { at: entry.at || new Date().toISOString(), ...entry },
  ];
}

/**
 * Compute the settlement amounts for an outcome (does NOT move money).
 * splitPercentSeller only applies to outcome === "split".
 */
export function computeSettlementAmounts(
  breakdown: FeeBreakdown,
  outcome: SettlementOutcome,
  splitPercentSeller?: number
): {
  outcome: SettlementOutcome;
  sellerAmount: number;
  buyerRefund: number;
  platformFee: number;
} {
  if (outcome === "release") {
    return {
      outcome,
      sellerAmount: breakdown.sellerReceives,
      buyerRefund: 0,
      platformFee: breakdown.platformFee,
    };
  }
  if (outcome === "refund") {
    // Full refund to buyer — platform waives the escrow fee on a refund.
    return {
      outcome,
      sellerAmount: 0,
      buyerRefund: breakdown.buyerPays,
      platformFee: 0,
    };
  }
  // split — sellerPct of the deal amount goes to the seller, remainder refunded.
  const pct = Math.max(0, Math.min(100, Number(splitPercentSeller ?? 50)));
  const sellerShare = round2((breakdown.amount * pct) / 100);
  const buyerShare = round2(breakdown.amount - sellerShare);
  return {
    outcome,
    sellerAmount: sellerShare,
    buyerRefund: round2(buyerShare + (breakdown.buyerPays - breakdown.amount)),
    platformFee: breakdown.platformFee,
  };
}

/** A short, human-readable summary of a (simulated or live) settlement. */
export function describeSettlement(
  amounts: ReturnType<typeof computeSettlementAmounts>,
  currency: string,
  simulated: boolean
): string {
  const tag = simulated ? "[SIMULATED — no on-chain transaction]" : "[LIVE]";
  const parts: string[] = [];
  if (amounts.sellerAmount > 0)
    parts.push(`seller +${amounts.sellerAmount} ${currency}`);
  if (amounts.buyerRefund > 0)
    parts.push(`buyer refund ${amounts.buyerRefund} ${currency}`);
  if (amounts.platformFee > 0)
    parts.push(`platform fee ${amounts.platformFee} ${currency}`);
  return `${tag} ${amounts.outcome}: ${parts.join(", ")}`;
}

export { round2 };

/**
 * Derive the human settlement phase + label from a deal row for the UI.
 * phase: 'none' (no outcome yet) | 'pending' | 'partial' | 'paid'.
 */
export function deriveSettlement(d: {
  status?: string;
  outcome?: string | null;
  seller_payout_state?: string | null;
  buyer_payout_state?: string | null;
}): { phase: "none" | "pending" | "partial" | "paid"; label: string } {
  const legStates = [d.seller_payout_state, d.buyer_payout_state].filter(
    (s) => s && s !== "na"
  ) as string[];
  const base =
    d.status === "completed"
      ? "Completed"
      : d.status === "refunded"
      ? "Refunded"
      : d.status === "split"
      ? "Split resolved"
      : (d.status || "").charAt(0).toUpperCase() + (d.status || "").slice(1);

  if (!d.outcome || legStates.length === 0) {
    return { phase: "none", label: base };
  }
  const paid = legStates.filter((s) => s === "paid").length;
  if (paid === legStates.length) return { phase: "paid", label: `${base} — payout paid` };
  if (paid === 0) return { phase: "pending", label: `${base} — payout pending` };
  return { phase: "partial", label: `${base} — partially paid` };
}
