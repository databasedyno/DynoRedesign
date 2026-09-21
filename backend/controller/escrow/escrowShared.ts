/**
 * Escrow shared helpers — fee math, the deal state machine, role resolution,
 * activity-log helpers and the (gated) settlement executor.
 *
 * Money-safety: on-chain settlement is gated behind ESCROW_LIVE_SETTLEMENT. When
 * OFF (the default, and always in the SAFE-MODE preview) settlement is SIMULATED:
 * amounts are computed and recorded and the deal advances state, but NO crypto is
 * moved. This lets the full lifecycle be exercised without touching real funds.
 */
import { raw as envRaw, num as envNum } from "../../utils/config";
import {
  getEscrowCostRates,
  sweepFeeUsdFor,
  withdrawFeeUsdFor,
  normalizePayoutKey,
  isStableFundingCoin,
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
 * Custody is ALWAYS held as USDT on Binance: funded crypto is swept to the
 * exchange and instantly converted to USDT. The specific network/stablecoin is
 * only chosen at withdrawal (cashout).
 */
export const CUSTODY_STABLECOIN = "USDT";

/**
 * Allowed forward transitions. An invalid jump (e.g. a disputed deal silently
 * becoming active) is rejected by assertTransition().
 */
export const ALLOWED_TRANSITIONS: Record<EscrowStatus, EscrowStatus[]> = {
  draft: ["invited", "cancelled"],
  invited: ["awaiting_payment", "declined", "cancelled", "expired"],
  declined: [],
  // → invited: the creator amended the terms, so the counterparty must re-accept.
  awaiting_payment: ["funded", "cancelled", "expired", "invited"],
  funded: ["delivered", "disputed", "completed", "refunded", "split"],
  // → funded: the buyer asked for changes; the seller re-delivers.
  delivered: ["completed", "disputed", "refunded", "split", "funded"],
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
  key: "escrow_fee" | "exchange_fee" | "network_fee" | "conversion_fee" | "withdrawal_fee";
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
  exchangeFeePercent: number; // SafeDeal margin on non-stablecoin funding
  exchangeFeeUsd: number; // platform revenue (0 when funded in USDT/USDC)
  // pass-through settlement costs (estimated; folded into the price)
  networkFeeUsd: number; // inbound sweep of the funded crypto to custody
  conversionFeeUsd: number; // Binance conversion crypto -> stablecoin
  withdrawalFeeUsd: number; // Binance withdrawal at cashout (per payout network)
  passThroughCosts: number; // network + conversion + withdrawal
  totalCost: number; // escrowFee + exchangeFee + passThroughCosts (what the fee_payer bears beyond `amount`)
  payoutCoin: string; // stablecoin the withdrawal fee was estimated for
  costsEstimated: boolean; // true — refined at funding when the real coin is known
  quotedFundingCoin: string; // coin the network/exchange/conversion lines were priced for
  fundingCoinAssumed: boolean; // true until the buyer picks a coin (quote assumes a stablecoin)
  nonStableSurchargeUsd: number; // extra the buyer pays if they fund with BTC/ETH… instead (0 once coin is known)
  costItems: CostItem[]; // itemised, for UI
  buyerPays: number; // what the buyer funds into escrow
  sellerReceives: number; // net to seller after their share of costs
  platformFee: number; // == escrowFee (kept by platform)
  networkNote: string;
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** True when a coin string represents USDT on any network (already the custody asset). */
function isUsdtCoin(coin?: string | null): boolean {
  return !!coin && /usdt/i.test(String(coin));
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

/** Stablecoin the pre-funding quote assumes the buyer will pay with (USDT on Tron). */
export const QUOTE_ASSUMED_FUNDING_COIN = "USDT-TRC20";
/** Representative non-stablecoin used to size the "pay with BTC/ETH…" surcharge hint. */
const SURCHARGE_REFERENCE_COIN = "ETH";

/**
 * Resolve the coin the fee math should price. Once the buyer has picked a coin it is used
 * as-is. Before that, the quote assumes STABLECOIN funding (no exchange / conversion fee):
 * the cheapest stablecoin the seller accepts, or USDT-TRC20 when there is no restriction.
 * Only when the seller accepts no stablecoin at all does the quote fall back to the cheapest
 * accepted (volatile) coin — and then the exchange + conversion fees are included.
 */
function resolveQuoteCoin(fundingCoin?: string | null, acceptedCoins?: string | null): { coin: string; assumed: boolean } {
  if (fundingCoin) return { coin: String(fundingCoin), assumed: false };
  const coins = String(acceptedCoins || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!coins.length) return { coin: QUOTE_ASSUMED_FUNDING_COIN, assumed: true };
  const stable = coins.filter((c) => isStableFundingCoin(c));
  const pool = (stable.length ? stable : coins).slice().sort((a, b) => sweepFeeUsdFor(a) - sweepFeeUsdFor(b));
  return { coin: pool[0], assumed: true };
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
/** Pass-through cost lines frozen at funding time (what the buyer actually paid for). */
export interface LockedCosts {
  networkFeeUsd: number;
  conversionFeeUsd: number;
  withdrawalFeeUsd: number;
  exchangeFeeUsd: number;
  exchangeFeePercent?: number;
  payoutCoin?: string;
  quotedFundingCoin?: string;
}

export function lockedCostsFrom(b: FeeBreakdown): LockedCosts {
  return {
    networkFeeUsd: b.networkFeeUsd,
    conversionFeeUsd: b.conversionFeeUsd,
    withdrawalFeeUsd: b.withdrawalFeeUsd,
    exchangeFeeUsd: b.exchangeFeeUsd,
    exchangeFeePercent: b.exchangeFeePercent,
    payoutCoin: b.payoutCoin,
    quotedFundingCoin: b.quotedFundingCoin,
  };
}

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
  waiveEscrowFee?: boolean;
  /** Relabels the escrow-fee line as a "Cancellation fee" (fee is still charged, not waived). */
  cancellationFee?: boolean;
  /** Costs frozen at funding — used instead of the live rate table so quote == charged. */
  lockedCosts?: LockedCosts | null;
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

  const pctFee = round2((amount * feePercent) / 100);
  const grossEscrowFee = round2(Math.max(pctFee, feeMinUsd));
  const waiveFee = input.waiveEscrowFee === true;
  const escrowFee = waiveFee ? 0 : grossEscrowFee;
  const feeFloorApplied = !waiveFee && grossEscrowFee > pctFee;

  // ── settlement cost estimate (all via Binance; custody held in USDT) ────────
  const includeCosts = input.includeCosts !== false;
  const locked = input.lockedCosts || null;
  const payoutKey = normalizePayoutKey(input.payoutCoin || locked?.payoutCoin || DEFAULT_PAYOUT_KEY);
  const rates = getEscrowCostRates();
  const convPct = rates.conversionPct || 0;
  const exchangePct = locked?.exchangeFeePercent ?? (rates.exchangePct || 0);
  // Inbound: sweep the funded crypto to Binance + convert it to USDT (custody).
  // The conversion is skipped when the buyer already funds in USDT (any network).
  // The exchange fee (SafeDeal margin) applies to any non-stablecoin funding.
  // Before the buyer picks a coin the quote prices a STABLECOIN (see resolveQuoteCoin), so
  // "Buyer pays" on the deal page equals the USDT tile in the coin picker.
  const quoteCoin = resolveQuoteCoin(input.fundingCoin || locked?.quotedFundingCoin, input.acceptedCoins);
  const fundedIsUsdt = isUsdtCoin(quoteCoin.coin);
  const fundedIsStable = isStableFundingCoin(quoteCoin.coin);
  const networkFeeUsd = !includeCosts ? 0 : locked ? round2(locked.networkFeeUsd) : round2(estimateInboundFee(quoteCoin.coin, input.acceptedCoins));
  const conversionFeeUsd = !includeCosts ? 0 : locked ? round2(locked.conversionFeeUsd) : !fundedIsUsdt ? round2((amount * convPct) / 100) : 0;
  const exchangeFeeUsd = !includeCosts ? 0 : locked ? round2(locked.exchangeFeeUsd) : !fundedIsStable ? round2((amount * exchangePct) / 100) : 0;
  // What a volatile-coin payer would add on top of the stablecoin quote (hint for the UI).
  const nonStableSurchargeUsd =
    includeCosts && !locked && quoteCoin.assumed && fundedIsStable
      ? round2(
          (amount * exchangePct) / 100 +
            (amount * convPct) / 100 +
            Math.max(0, sweepFeeUsdFor(SURCHARGE_REFERENCE_COIN) - networkFeeUsd)
        )
      : 0;
  // Outbound: withdraw USDT to the payout network. A USDC cash-out needs an extra
  // USDT->USDC conversion on Binance — merged into the single withdrawal figure.
  const payoutIsUsdc = payoutKey.startsWith("USDC");
  const payoutConversionUsd = includeCosts && !locked && payoutIsUsdc ? round2((amount * convPct) / 100) : 0;
  const withdrawalFeeUsd = !includeCosts ? 0 : locked ? round2(locked.withdrawalFeeUsd) : round2(withdrawFeeUsdFor(payoutKey) + payoutConversionUsd);
  const passThroughCosts = round2(networkFeeUsd + conversionFeeUsd + withdrawalFeeUsd);
  const totalCost = round2(escrowFee + exchangeFeeUsd + passThroughCosts);

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

  const isCancel = input.cancellationFee === true && !waiveFee;
  const feeKind = isCancel ? "Cancellation fee" : "Escrow fee";
  const feeLabel = waiveFee
    ? "Escrow fee (waived)"
    : feeFloorApplied
    ? `${feeKind} (min $${feeMinUsd})`
    : `${feeKind} (${feePercent}%)`;
  const feeNote = waiveFee
    ? "Escrow fee waived for this mutually-agreed cancellation — only real network/exchange costs are kept."
    : isCancel
    ? `Cancellation fee (${feePercent}%) is kept on this cancelled deal; the buyer is refunded the rest after real network/exchange costs.`
    : feeFloorApplied
    ? `${feePercent}% of ${amount} is below the $${feeMinUsd} minimum escrow fee, so the minimum applies.`
    : "";
  const costItems: CostItem[] = [
    {
      key: "escrow_fee",
      label: feeLabel,
      amount: escrowFee,
      ...(feeNote ? { note: feeNote } : {}),
    },
  ];
  if (includeCosts) {
    const est = locked ? "" : " (est.)";
    const stableNote = quoteCoin.assumed
      ? `No exchange fee when paying with a stablecoin (USDT/USDC). Paying with BTC, ETH or another non-stablecoin adds SafeDeal's ${exchangePct}% exchange fee at checkout.`
      : "No exchange fee — funded in a stablecoin.";
    costItems.push(
      {
        key: "exchange_fee",
        label: `Exchange fee (${exchangePct}%)`,
        amount: exchangeFeeUsd,
        note: exchangeFeeUsd <= 0 ? stableNote : `SafeDeal's ${exchangePct}% fee for exchanging non-stablecoin funding into USDT (covers spread and slippage).`,
      },
      { key: "network_fee", label: `Network fee${est}`, amount: networkFeeUsd, note: locked ? "On-chain fee to move the funded crypto to the exchange (custody) — fixed at funding." : quoteCoin.assumed ? `On-chain fee to move the funded crypto to the exchange (custody) — estimated for ${quoteCoin.coin}; the exact fee depends on the coin the buyer picks.` : "On-chain fee to move the funded crypto to the exchange (custody)." },
      { key: "conversion_fee", label: `Conversion fee${est}`, amount: conversionFeeUsd, note: conversionFeeUsd <= 0 ? (quoteCoin.assumed && !locked ? "No conversion when funded in USDT; other coins are converted on the exchange at checkout." : "No conversion — funded directly in USDT.") : "Converting the funded crypto to USDT on the exchange." },
      {
        key: "withdrawal_fee",
        label: locked ? `Withdrawal fee (${payoutKey})` : `Withdrawal fee (est., ${payoutKey})`,
        amount: withdrawalFeeUsd,
        note: locked
          ? "Exchange withdrawal fee reserved at funding — covers the payout to a saved address (or is credited back to whoever keeps the funds in their balance)."
          : payoutIsUsdc
          ? "Binance withdrawal to this network, incl. the USDT→USDC conversion at cashout."
          : "Binance withdrawal to pay the USDT out at cashout.",
      }
    );
  }

  return {
    amount,
    currency,
    feePercent,
    feeMinUsd,
    feePayer,
    escrowFee,
    exchangeFeePercent: exchangePct,
    exchangeFeeUsd,
    networkFeeUsd,
    conversionFeeUsd,
    withdrawalFeeUsd,
    passThroughCosts,
    totalCost,
    payoutCoin: payoutKey,
    costsEstimated: includeCosts && !locked,
    quotedFundingCoin: quoteCoin.coin,
    fundingCoinAssumed: quoteCoin.assumed && !locked,
    nonStableSurchargeUsd,
    costItems,
    buyerPays,
    sellerReceives,
    platformFee: escrowFee,
    networkNote: locked
      ? "Network, conversion and withdrawal costs were fixed when the deal was funded and are settled from the funded amount."
      : quoteCoin.assumed && fundedIsStable
      ? `Priced for a stablecoin payment (${quoteCoin.coin}). Paying with a non-stablecoin adds ≈ $${nonStableSurchargeUsd.toFixed(2)} (${exchangePct}% exchange fee, conversion and network costs); the exact total is shown per coin at checkout.`
      : "Network, conversion and withdrawal costs are estimates folded into the price and settled from the funded amount; the exact withdrawal fee depends on the payout coin/network chosen at cashout.",
  };
}

/** Whether live on-chain settlement is enabled. Default OFF (simulated). */
export function isLiveSettlementEnabled(): boolean {
  return String(envRaw("ESCROW_LIVE_SETTLEMENT") || "").toLowerCase() === "true";
}

/**
 * A mutually-agreed cancellation (a `refund` proposal with kind `cancellation` that the
 * OTHER party accepted) is charged a CANCELLATION FEE after funding — it is NOT waived.
 */
export function isCancellationRefund(deal: any, outcome?: SettlementOutcome): boolean {
  const oc = String(outcome ?? deal?.outcome ?? "");
  return oc === "refund" && String(deal?.dispute_proposal?.kind || "") === "cancellation";
}

/** Cancellation fee percent (SAFEDEAL_CANCELLATION_FEE_PERCENT, default 5%). */
export function cancellationFeePercent(): number {
  const p = envNum("SAFEDEAL_CANCELLATION_FEE_PERCENT", 5);
  return Number.isFinite(p) && p >= 0 ? p : 5;
}

/**
 * THE fee breakdown for a deal row. After funding it is pinned to the costs frozen in
 * `fee_breakdown_locked` (quote == charged); before funding it is the live estimate.
 * A mutually-agreed cancellation swaps the escrow-fee line for the cancellation fee while
 * keeping the frozen pass-through costs.
 */
export function dealFeeBreakdown(deal: any, outcome?: SettlementOutcome): FeeBreakdown {
  const cancellation = isCancellationRefund(deal, outcome);
  const locked = (deal?.fee_breakdown_locked || null) as FeeBreakdown | null;
  return computeFeeBreakdown({
    amount: deal.amount,
    currency: deal.currency,
    feePercent: cancellation ? cancellationFeePercent() : deal.fee_percent,
    feeMinUsd: deal.fee_min_usd,
    feePayer: deal.fee_payer,
    payoutCoin: deal.seller_payout_coin,
    fundingCoin: deal.funding_coin,
    acceptedCoins: deal.accepted_coins,
    cancellationFee: cancellation,
    lockedCosts: locked ? lockedCostsFrom(locked) : null,
  });
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
 *
 * Fee policy (all outcomes): the platform ALWAYS retains the full cost
 * (escrow fee + network + conversion + withdrawal = totalCost). The distributable
 * pool is therefore `P = sellerReceives` (== buyerPays − totalCost, which holds for
 * every fee_payer). Each outcome splits P between the parties; the retained
 * `platformFee` shown is the escrow-fee revenue line (pass-through costs are also
 * retained but are not platform revenue).
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
  // Distributable pool after the platform keeps every fee/cost, on ANY outcome.
  const pool = round2(breakdown.sellerReceives);
  if (outcome === "release") {
    return {
      outcome,
      sellerAmount: pool,
      buyerRefund: 0,
      platformFee: breakdown.platformFee,
    };
  }
  if (outcome === "refund") {
    // Fees are NOT waived on a refund — the buyer is refunded the net pool and the
    // platform keeps the escrow fee + settlement costs (decision: always charge).
    return {
      outcome,
      sellerAmount: 0,
      buyerRefund: pool,
      platformFee: breakdown.platformFee,
    };
  }
  // split — sellerPct of the NET POOL goes to the seller, the remainder is refunded.
  const pct = Math.max(0, Math.min(100, Number(splitPercentSeller ?? 50)));
  const sellerShare = round2((pool * pct) / 100);
  const buyerShare = round2(pool - sellerShare);
  return {
    outcome,
    sellerAmount: sellerShare,
    buyerRefund: buyerShare,
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
  dispute_stage?: string | null;
}): { phase: "none" | "pending" | "partial" | "paid"; label: string } {
  // An open dispute reflects its negotiation stage in the label.
  if (d.status === "disputed") {
    const stage = d.dispute_stage || "negotiation";
    const label =
      stage === "escalated"
        ? "In dispute — admin review"
        : stage === "resolved"
        ? "Dispute resolved"
        : "In dispute — awaiting response";
    return { phase: "none", label };
  }

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
