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
  customerWithdrawFeeUsd,
  normalizePayoutKey,
  isStableFundingCoin,
  DEFAULT_PAYOUT_KEY,
} from "../../services/escrow/escrowCosts";
import { round2Float as round2 } from "../../utils/money";

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
  // Which side this cost is charged to (for role-aware breakdowns). The cashout
  // (withdrawal) fee is always "seller" under fee model v2; the rest follow fee_payer.
  borneBy: "buyer" | "seller" | "split";
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
  // SafeDeal fee credit applied at release, per side (0 until a deal is released).
  // escrowFee above is NET of these; grossEscrowFee is the fee before credits.
  grossEscrowFee: number;
  feeCreditBuyerUsd: number;
  feeCreditSellerUsd: number;
  // Fee-allocation model, FROZEN at funding so already-funded deals never re-split:
  //   v2 (current) — the cashout/withdrawal fee is ALWAYS the seller's cost (the seller
  //                  cashes out); the buyer never funds it. Escrow + inbound funding costs
  //                  are still allocated by fee_payer.
  //   v1 (legacy)  — every cost (incl. cashout) is allocated by fee_payer.
  // Live quotes and new fundings are v2; deals funded before this change stay v1.
  feeModel: "v1" | "v2";
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
  // Frozen fee-allocation model (see FeeBreakdown.feeModel). Absent on deals funded
  // before the model existed → treated as v1 so their split never changes.
  feeModel?: "v1" | "v2";
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
    feeModel: b.feeModel,
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
  /** Paid from the SafeDeal wallet — funds already sit in custody (USDT), so no inbound costs. */
  fromBalance?: boolean;
  /** SafeDeal fee credits spent at release, per side (each capped at that side's escrow-fee share). */
  feeCredits?: { buyer?: number | string | null; seller?: number | string | null } | null;
  /** Extra note on the escrow-fee line (e.g. the loyalty level rate). */
  rateNote?: string | null;
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
  // The top-up already paid the inbound sweep, so wallet funding must not charge it twice.
  const fromBalance = input.fromBalance === true && !locked;
  const networkFeeUsd = !includeCosts || fromBalance ? 0 : locked ? round2(locked.networkFeeUsd) : round2(estimateInboundFee(quoteCoin.coin, input.acceptedCoins));
  const conversionFeeUsd = !includeCosts || fromBalance ? 0 : locked ? round2(locked.conversionFeeUsd) : !fundedIsUsdt ? round2((amount * convPct) / 100) : 0;
  const exchangeFeeUsd = !includeCosts || fromBalance ? 0 : locked ? round2(locked.exchangeFeeUsd) : !fundedIsStable ? round2((amount * exchangePct) / 100) : 0;
  // What a volatile-coin payer would add on top of the stablecoin quote (hint for the UI).
  const nonStableSurchargeUsd =
    includeCosts && !locked && !fromBalance && quoteCoin.assumed && fundedIsStable
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
  const withdrawalFeeUsd = !includeCosts ? 0 : locked ? round2(locked.withdrawalFeeUsd) : round2(customerWithdrawFeeUsd(payoutKey) + payoutConversionUsd);
  const passThroughCosts = round2(networkFeeUsd + conversionFeeUsd + withdrawalFeeUsd);
  const totalCost = round2(escrowFee + exchangeFeeUsd + passThroughCosts);

  // Fee-allocation model (frozen at funding via lockedCosts; live quotes use v2).
  // v2: the cashout (withdrawal) fee is ALWAYS the seller's cost — the seller is the
  //     party who cashes out — so it is deducted from the seller and the buyer never
  //     funds it. Escrow fee + inbound funding costs (network/conversion/exchange) are
  //     still allocated by fee_payer.
  // v1: legacy — every cost, incl. cashout, is allocated by fee_payer.
  const feeModel: "v1" | "v2" = input.lockedCosts
    ? input.lockedCosts.feeModel === "v2"
      ? "v2"
      : "v1"
    : "v2";

  // Costs shared per the fee_payer selector, and the seller-only cashout cost.
  const feePayerCost = feeModel === "v2" ? round2(escrowFee + exchangeFeeUsd + networkFeeUsd + conversionFeeUsd) : totalCost;
  const sellerOnlyCost = feeModel === "v2" ? withdrawalFeeUsd : 0;

  let buyerPays = amount;
  let sellerReceives = amount;
  if (feePayer === "buyer") {
    buyerPays = round2(amount + feePayerCost);
    sellerReceives = round2(Math.max(0, amount - sellerOnlyCost));
  } else if (feePayer === "seller") {
    buyerPays = amount;
    sellerReceives = round2(Math.max(0, amount - feePayerCost - sellerOnlyCost));
  } else {
    const half = round2(feePayerCost / 2);
    buyerPays = round2(amount + half);
    sellerReceives = round2(Math.max(0, amount - (feePayerCost - half) - sellerOnlyCost));
  }

  // Fee credits (release only): each side's credit lowers its own share of the escrow fee.
  const buyerFeeShare = feePayer === "buyer" ? escrowFee : feePayer === "split" ? round2(escrowFee / 2) : 0;
  const sellerFeeShare = round2(escrowFee - buyerFeeShare);
  const feeCreditBuyerUsd = round2(Math.min(Math.max(0, Number(input.feeCredits?.buyer) || 0), buyerFeeShare));
  const feeCreditSellerUsd = round2(Math.min(Math.max(0, Number(input.feeCredits?.seller) || 0), sellerFeeShare));
  const feeCreditTotal = round2(feeCreditBuyerUsd + feeCreditSellerUsd);
  buyerPays = round2(buyerPays - feeCreditBuyerUsd);
  sellerReceives = round2(sellerReceives + feeCreditSellerUsd);
  const netEscrowFee = round2(escrowFee - feeCreditTotal);

  const isCancel = input.cancellationFee === true && !waiveFee;
  const feeKind = isCancel ? "Cancellation fee" : "Escrow fee";
  const baseFeeLabel = waiveFee
    ? "Escrow fee (waived)"
    : feeFloorApplied
    ? `${feeKind} (min $${feeMinUsd})`
    : `${feeKind} (${feePercent}%)`;
  const feeLabel = feeCreditTotal > 0 ? `${baseFeeLabel} − $${feeCreditTotal.toFixed(2)} credit` : baseFeeLabel;
  const baseFeeNote = waiveFee
    ? "Escrow fee waived for this mutually-agreed cancellation — only real network/exchange costs are kept."
    : isCancel
    ? `Cancellation fee (${feePercent}%) is kept on this cancelled deal; the buyer is refunded the rest after real network/exchange costs.`
    : feeFloorApplied
    ? `${feePercent}% of ${amount} is below the $${feeMinUsd} minimum escrow fee, so the minimum applies.`
    : "";
  const feeNote = [
    baseFeeNote,
    !waiveFee && !isCancel ? input.rateNote || "" : "",
    feeCreditTotal > 0 ? `$${feeCreditTotal.toFixed(2)} SafeDeal fee credit applied (escrow fee $${escrowFee.toFixed(2)} before credit).` : "",
  ].filter(Boolean).join(" ");
  const cashoutBorneBy: "buyer" | "seller" | "split" = feeModel === "v2" ? "seller" : feePayer;
  const costItems: CostItem[] = [
    {
      key: "escrow_fee",
      label: feeLabel,
      amount: netEscrowFee,
      borneBy: feePayer,
      ...(feeNote ? { note: feeNote } : {}),
    },
  ];
  if (includeCosts) {
    const est = locked || fromBalance ? "" : " (est.)";
    const balanceNote = "None — paid from the SafeDeal balance, which is already held in custody as USDT.";
    const stableNote = fromBalance
      ? balanceNote
      : quoteCoin.assumed
      ? `No exchange fee when paying with a stablecoin (USDT/USDC). Paying with BTC, ETH or another non-stablecoin adds SafeDeal's ${exchangePct}% exchange fee at checkout.`
      : "No exchange fee — funded in a stablecoin.";
    costItems.push(
      {
        key: "exchange_fee",
        label: `Exchange fee (${exchangePct}%)`,
        amount: exchangeFeeUsd,
        borneBy: feePayer,
        note: exchangeFeeUsd <= 0 ? stableNote : `SafeDeal's ${exchangePct}% fee for exchanging non-stablecoin funding into USDT (covers spread and slippage).`,
      },
      { key: "network_fee", label: `Network fee${est}`, amount: networkFeeUsd, borneBy: feePayer, note: fromBalance ? balanceNote : locked ? "On-chain fee to move the funded crypto to the exchange (custody) — fixed at funding." : quoteCoin.assumed ? `On-chain fee to move the funded crypto to the exchange (custody) — estimated for ${quoteCoin.coin}; the exact fee depends on the coin the buyer picks.` : "On-chain fee to move the funded crypto to the exchange (custody)." },
      { key: "conversion_fee", label: `Conversion fee${est}`, amount: conversionFeeUsd, borneBy: feePayer, note: fromBalance ? balanceNote : conversionFeeUsd <= 0 ? (quoteCoin.assumed && !locked ? "No conversion when funded in USDT; other coins are converted on the exchange at checkout." : "No conversion — funded directly in USDT.") : "Converting the funded crypto to USDT on the exchange." },
      {
        key: "withdrawal_fee",
        label: locked ? `Cashout fee (${payoutKey})` : `Cashout fee (est., ${payoutKey})`,
        amount: withdrawalFeeUsd,
        borneBy: cashoutBorneBy,
        note: locked
          ? "Cashout network fee — the seller's cost to cash out; reserved at funding and covered on payout (or credited back if the funds stay in the balance)."
          : payoutIsUsdc
          ? "The seller's cashout to this network, incl. the USDT→USDC conversion — deducted from the seller's payout."
          : "The seller's cashout to this network — deducted from the seller's payout.",
      }
    );
  }

  return {
    amount,
    currency,
    feePercent,
    feeMinUsd,
    feePayer,
    escrowFee: netEscrowFee,
    exchangeFeePercent: exchangePct,
    exchangeFeeUsd,
    networkFeeUsd,
    conversionFeeUsd,
    withdrawalFeeUsd,
    passThroughCosts,
    totalCost: round2(totalCost - feeCreditTotal),
    payoutCoin: payoutKey,
    costsEstimated: includeCosts && !locked,
    quotedFundingCoin: quoteCoin.coin,
    fundingCoinAssumed: quoteCoin.assumed && !locked,
    nonStableSurchargeUsd,
    costItems,
    buyerPays,
    sellerReceives,
    platformFee: netEscrowFee,
    feeModel,
    grossEscrowFee: escrowFee,
    feeCreditBuyerUsd,
    feeCreditSellerUsd,
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
 * Simulated money (fake deal funding, fake deposits) is an explicit opt-in: live settlement
 * must be OFF **and** SAFEDEAL_ALLOW_SIMULATION=true. Never set it on a pod that shares the
 * production database — simulated credits land in real wallets.
 */
export function isSimulationAllowed(): boolean {
  return !isLiveSettlementEnabled() && String(envRaw("SAFEDEAL_ALLOW_SIMULATION") || "").toLowerCase() === "true";
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
    feeCredits: cancellation ? null : { buyer: deal.fee_credit_buyer_usd, seller: deal.fee_credit_seller_usd },
    rateNote: feeLevelNote(deal.fee_level, Number(deal.fee_percent), standardEscrowFeePercent()),
  });
}

/** The standard (Member) escrow fee percent — ESCROW_FEE_PERCENT, default 5. */
export const standardEscrowFeePercent = (): number => Number(envRaw("ESCROW_FEE_PERCENT")) || 5;

export const FEE_LEVEL_LABELS: Record<string, string> = { member: "Member", silver: "Silver", gold: "Gold", platinum: "Platinum" };

/** Note for the escrow-fee line when a SafeDeal loyalty rate applies (fee_level 'gold' or split 'gold/member'). */
export function feeLevelNote(feeLevel: string | null | undefined, feePercent: number, basePercent: number): string | null {
  if (!feeLevel || !(feePercent < basePercent)) return null;
  const label = (k: string) => FEE_LEVEL_LABELS[k] || "Member";
  if (feeLevel.includes("/")) {
    const [b, s] = feeLevel.split("/");
    return `Loyalty rate ${feePercent}% (standard ${basePercent}%) — blended from the buyer's ${label(b)} and the seller's ${label(s)} level.`;
  }
  return `${label(feeLevel)} level rate ${feePercent}% (standard ${basePercent}%).`;
}

/** Quote for paying a SafeDeal from the buyer's wallet balance (no inbound network/exchange costs). */
export function balanceFundingBreakdown(deal: any): FeeBreakdown {
  return computeFeeBreakdown({
    amount: deal.amount,
    currency: deal.currency,
    feePercent: deal.fee_percent,
    feeMinUsd: deal.fee_min_usd,
    feePayer: deal.fee_payer,
    payoutCoin: deal.seller_payout_coin,
    fundingCoin: CUSTODY_STABLECOIN,
    acceptedCoins: deal.accepted_coins,
    fromBalance: true,
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

/** A short, human-readable summary of a settlement (simulated/live lives in activity meta, never in the text). */
export function describeSettlement(amounts: ReturnType<typeof computeSettlementAmounts>, currency: string): string {
  const parts: string[] = [];
  if (amounts.sellerAmount > 0)
    parts.push(`seller +${amounts.sellerAmount} ${currency}`);
  if (amounts.buyerRefund > 0)
    parts.push(`buyer refund ${amounts.buyerRefund} ${currency}`);
  if (amounts.platformFee > 0)
    parts.push(`platform fee ${amounts.platformFee} ${currency}`);
  const outcome = String(amounts.outcome || "");
  return `${outcome.charAt(0).toUpperCase()}${outcome.slice(1)}: ${parts.join(", ")}`;
}

/** Internal bookkeeping references (simulated payouts, exchange withdrawal ids, wallet credits) — never shown as a "tx". */
export function isInternalTxRef(ref?: string | null): boolean {
  return /^(SIMULATED-|BINANCE-|WALLET-CREDIT|WITHDRAWAL-)/i.test(String(ref || ""));
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
