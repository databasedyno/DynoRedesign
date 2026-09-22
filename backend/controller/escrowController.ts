/**
 * Escrow engine + Dynopay admin handlers.
 *
 * The engine (state machine, fee math, custody ledger, two-phase settlement,
 * dispute negotiation) is exported as `escrowEngine` and driven by SafeDeal
 * (controller/safedealController.ts). The Dynopay admin console consumes the
 * admin handlers (oversight, dispute arbitration, maintenance scans).
 * Merchant-dashboard and public-invite handlers were retired when escrow moved
 * to the standalone SafeDeal product.
 *
 * Money-safety: funding, stablecoin conversion, custody and payouts are
 * SIMULATED unless ESCROW_LIVE_SETTLEMENT=true.
 */
import { raw as envRaw } from "../utils/config";
import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { companyModel, userModel } from "../models";
import { listAttachmentsForDeals } from "../services/safedeal/safedealAttachments";
import escrowDealModel from "../models/escrowDealModel";
import {
  EscrowRole,
  SettlementOutcome,
  DEFAULT_ESCROW_STABLECOIN,
  CUSTODY_STABLECOIN,
  ESCROW_STABLECOINS,
  appendActivity,
  assertTransition,
  computeFeeBreakdown,
  computeSettlementAmounts,
  round2,
  describeSettlement,
  deriveSettlement,
  isLiveSettlementEnabled,
  outcomeToStatus,
  resolveRoles,
  dealFeeBreakdown,
  isCancellationRefund,
  cancellationFeePercent,
} from "./escrow/escrowShared";
import { refreshEscrowCostRates } from "../services/escrow/escrowCosts";
import { recordFundingReceived, fundFromBalance, settleToWallets } from "../services/safedeal/safedealEscrowLedger";
import { getBalances } from "../services/safedeal/safedealWallet";
import { settlementPayout, addWithdrawalFeeCredit, type SettlementPayoutResult } from "../services/safedeal/safedealWithdrawals";
import { explorerTxUrl } from "../services/receiptLinkService";
import { FUNDING_COIN_META } from "../services/safedeal/safedealCheckout";
import {
  sendEscrowInviteEmail,
  sendEscrowAcceptedEmail,
  sendEscrowDeclinedEmail,
  sendEscrowCancelledEmail,
  sendEscrowFundedEmail,
  sendEscrowFundingReceiptEmail,
  sendEscrowDeliveredEmail,
  sendEscrowReleasedEmail,
  sendEscrowRefundedEmail,
  sendEscrowDisputeResolvedEmail,
  sendEscrowDisputeProposalEmail,
  sendEscrowDisputeEscalatedEmail,
  sendEscrowDisputeAgreedEmail,
  sendEscrowPayoutPendingEmail,
  sendEscrowPaidEmail,
  sendEscrowChangesRequestedEmail,
} from "../services/email/escrowEmails";

// ── error type + utilities ───────────────────────────────────────────────────

class EscrowError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}
const fail = (code: number, message: string): never => {
  throw new EscrowError(code, message);
};

const REMINDER_REVIEW_THRESHOLD = 3;
// How long a dispute proposal can sit unanswered before it auto-escalates to admin.
const DISPUTE_AUTO_ESCALATE_HOURS = Number(envRaw("ESCROW_DISPUTE_AUTO_ESCALATE_HOURS")) || 72;
// Platform escrow fee — ADMIN-CONTROLLED via .env only (never client-supplied).
const ESCROW_FEE_PERCENT = Number(envRaw("ESCROW_FEE_PERCENT")) || 5;
const ESCROW_FEE_MIN_USD = Number(envRaw("ESCROW_FEE_MIN_USD")) || 10;
// Smallest deal we escrow (USD). Below this the fee floor dominates the economics.
const ESCROW_MIN_DEAL_USD = Number(envRaw("ESCROW_MIN_DEAL_USD")) || 30;
// Largest deal we escrow, expressed in EUR (resolved to USD at the live rate on validation).
const ESCROW_MAX_DEAL_EUR = Number(envRaw("ESCROW_MAX_DEAL_EUR")) || 2999;
// Auto-release presets offered to merchants (days). Any other value clamps to the default.
const ESCROW_AUTO_RELEASE_PRESETS = [3, 5, 7, 14];
const ESCROW_AUTO_RELEASE_DEFAULT = 3;
const clampAutoReleaseDays = (v: unknown): number => {
  const n = Math.round(Number(v));
  return ESCROW_AUTO_RELEASE_PRESETS.includes(n) ? n : ESCROW_AUTO_RELEASE_DEFAULT;
};
// How many times a buyer can send a delivery back for changes before they must release or dispute.
const MAX_REVISION_ROUNDS = Number(envRaw("ESCROW_MAX_REVISION_ROUNDS")) || 2;
// Minimum gap between two "resend invite" emails for the same deal.
const RESEND_INVITE_COOLDOWN_MS = 10 * 60 * 1000;
export const DEAL_TYPES = ["goods", "service", "digital", "other"] as const;
export const normalizeDealType = (v: unknown): string | null => (DEAL_TYPES.includes(String(v || "") as any) ? String(v) : null);


const frontendBase = (): string =>
  (envRaw("SERVER_URL") || envRaw("FRONTEND_URL") || envRaw("CHECKOUT_URL") || "").trim().replace(/\/$/, "");
/** SafeDeal public base (prod: https://safedeal.sh; preview: <dynopay>/safedeal). */
const safedealBase = (): string => (envRaw("SAFEDEAL_URL") || `${frontendBase()}/safedeal`).trim().replace(/\/$/, "");
const inviteUrl = (token: string): string => `${frontendBase()}/escrow/invite/${token}`;
/** Where a party opens this deal — SafeDeal deals live on the SafeDeal site. */
const dealUrl = (deal: any): string =>
  deal?.source === "safedeal" ? `${safedealBase()}/deal/${deal.deal_token}` : inviteUrl(deal.deal_token);
const isSafeDeal = (deal: any): boolean => deal?.source === "safedeal";
const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase();

interface ActorInfo {
  isCreator: boolean;
  isCounterparty: boolean;
  role: EscrowRole;
  label: string;
  signedIn: boolean; // true = authenticated Dynopay account (may reuse saved wallet)
}

async function loadCreatorAndCompany(deal: any): Promise<{ creatorEmail: string; creatorName: string; companyName: string }> {
  let creatorEmail = deal.creator_email ? String(deal.creator_email) : "";
  let creatorName = creatorEmail || "there";
  let companyName = isSafeDeal(deal) ? "SafeDeal" : "Dynopay";
  if (deal.creator_user_id) {
    try {
      const u: any = await userModel.findByPk(deal.creator_user_id, { attributes: ["user_id", "email", "first_name", "last_name"] });
      if (u) {
        creatorEmail = u.dataValues.email || creatorEmail;
        creatorName = [u.dataValues.first_name, u.dataValues.last_name].filter(Boolean).join(" ") || creatorEmail || "there";
      }
    } catch { /* non-fatal */ }
  }
  try {
    const c: any = await companyModel.findByPk(deal.company_id, { attributes: ["company_id", "company_name"] });
    if (c) companyName = c.dataValues.company_name || companyName;
  } catch { /* non-fatal */ }
  return { creatorEmail, creatorName, companyName };
}

async function partyEmails(deal: any): Promise<{ buyerEmail: string; sellerEmail: string }> {
  const { creatorEmail } = await loadCreatorAndCompany(deal);
  if (deal.creator_role === "buyer") return { buyerEmail: creatorEmail, sellerEmail: deal.counterparty_email };
  return { buyerEmail: deal.counterparty_email, sellerEmail: creatorEmail };
}

function serializeDeal(deal: any, includePrivate = true): Record<string, unknown> {
  const d = deal.dataValues ? deal.dataValues : deal;
  const breakdown = dealFeeBreakdown(d);
  const settlement = deriveSettlement(d);
  const base: Record<string, unknown> = {
    escrow_id: d.escrow_id,
    deal_token: d.deal_token,
    company_id: d.company_id,
    source: d.source || "merchant",
    creator_email: d.creator_email || null,
    creator_role: d.creator_role,
    counterparty_email: d.counterparty_email,
    counterparty_verified: !!d.counterparty_verified_at,
    // Invitation model (0045): 'email' (addressed) | 'link' (open seat claimed by first visitor).
    invite_kind: d.invite_kind || "email",
    counterparty_claimed_at: d.counterparty_claimed_at || null,
    funding_method: d.funding_method || null,
    funding_link_ref: d.funding_link_ref || null,
    checkout_url: d.funding_link_ref ? `${(envRaw("CHECKOUT_URL") || frontendBase()).trim().replace(/\/$/, "")}/pay?d=${d.funding_link_ref}` : null,
    title: d.title,
    description: d.description,
    amount: Number(d.amount),
    currency: d.currency,
    accepted_coins: d.accepted_coins,
    terms: d.terms,
    fee_percent: Number(d.fee_percent),
    fee_payer: d.fee_payer,
    auto_release_days: d.auto_release_days,
    status: d.status,
    status_label: settlement.label,
    settlement_phase: settlement.phase,
    outcome: d.outcome,
    invited_at: d.invited_at,
    accepted_at: d.accepted_at,
    declined_at: d.declined_at,
    funded_at: d.funded_at,
    delivered_at: d.delivered_at,
    auto_release_at: d.auto_release_at,
    outcome_authorized_at: d.outcome_authorized_at,
    completed_at: d.completed_at,
    refunded_at: d.refunded_at,
    cancelled_at: d.cancelled_at,
    disputed_at: d.disputed_at,
    dispute_resolved_at: d.dispute_resolved_at,
    fully_paid_at: d.fully_paid_at,
    delivery_note: d.delivery_note,
    delivery_proof: d.delivery_proof || null,
    // Multi-fiat pricing (SafeDeal): amount is USD; price_* is what the parties agreed in their currency.
    price_currency: d.price_currency || null,
    price_amount: d.price_amount != null ? Number(d.price_amount) : null,
    fx_rate: d.fx_rate != null ? Number(d.fx_rate) : null,
    fx_locked_at: d.fx_locked_at || null,
    // Deal terms (SafeDeal Batch 2)
    deal_type: d.deal_type || null,
    delivery_due_at: d.delivery_due_at || null,
    revision_round: Number(d.revision_round || 0),
    revision_note: d.revision_note || null,
    max_revision_rounds: MAX_REVISION_ROUNDS,
    amended_at: d.amended_at || null,
    invite_resent_at: d.invite_resent_at || null,
    dispute_reason: d.dispute_reason,
    dispute_raised_by: d.dispute_raised_by,
    dispute_resolution: d.dispute_resolution,
    // Dispute negotiation (two-tier: parties settle first, admin fallback)
    dispute_stage: d.dispute_stage,
    dispute_proposal: d.dispute_proposal || null,
    dispute_proposal_by: d.dispute_proposal_by,
    dispute_escalated_at: d.dispute_escalated_at,
    dispute_auto_escalate_at: d.dispute_auto_escalate_at,
    dispute_thread: Array.isArray(d.dispute_thread) ? d.dispute_thread : [],
    split_percent_seller: d.split_percent_seller != null ? Number(d.split_percent_seller) : null,
    // custody (simulated)
    custody_stablecoin: d.custody_stablecoin,
    custody_amount_stable: d.custody_amount_stable != null ? Number(d.custody_amount_stable) : null,
    converted_at: d.converted_at,
    // legs
    seller_entitlement_stable: d.seller_entitlement_stable != null ? Number(d.seller_entitlement_stable) : null,
    seller_payout_state: d.seller_payout_state,
    seller_paid_at: d.seller_paid_at,
    seller_payout_coin: d.seller_payout_coin,
    buyer_entitlement_stable: d.buyer_entitlement_stable != null ? Number(d.buyer_entitlement_stable) : null,
    buyer_payout_state: d.buyer_payout_state,
    buyer_paid_at: d.buyer_paid_at,
    buyer_refund_coin: d.buyer_refund_coin,
    needs_admin_review: d.needs_admin_review,
    funding_coin: d.funding_coin,
    funded_amount_usd: d.funded_amount_usd != null ? Number(d.funded_amount_usd) : null,
    funding_payment: d.funding_payment ? { ...d.funding_payment, qr_code: undefined } : null,
    funding_settled_at: d.funding_settled_at,
    custody_realized_usd: d.custody_realized_usd != null ? Number(d.custody_realized_usd) : null,
    payout_prefs: d.payout_prefs || null,
    simulated: d.simulated,
    invite_url: dealUrl(d),
    stablecoins: ESCROW_STABLECOINS,
    breakdown,
    fee_locked: !!d.fee_breakdown_locked,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
  if (includePrivate) {
    base.seller_payout_address = d.seller_payout_address;
    base.buyer_refund_address = d.buyer_refund_address;
    base.seller_payout_tx = d.seller_payout_tx;
    base.buyer_payout_tx = d.buyer_payout_tx;
    base.settlement_note = d.settlement_note;
    base.activity_log = d.activity_log;
  } else {
    // Public counterparty view: whether THEIR destination is on file (not the value).
    base.seller_address_on_file = !!d.seller_payout_address;
    base.buyer_address_on_file = !!d.buyer_refund_address;
  }
  return base;
}

// ── two-phase settlement ─────────────────────────────────────────────────────
// Fee math for a deal row lives in escrowShared.dealFeeBreakdown(): after funding it is
// pinned to `fee_breakdown_locked` (quote == charged); a mutually-agreed cancellation
// charges the cancellation fee (SAFEDEAL_CANCELLATION_FEE_PERCENT) instead of the escrow fee.

/** Phase 1 — authorize an outcome and lock entitlements in stable (no payout). */
async function authorizeOutcome(
  deal: any,
  outcome: SettlementOutcome,
  opts: { splitPercentSeller?: number; actorLabel: string; actorRole: string }
): Promise<{ summary: string }> {
  // Use the seller's chosen payout coin + the coin actually funded so the
  // withdrawal/network estimates baked into sellerReceives/buyerPays match the
  // quote the parties saw and the coin funded (consistent with serializeDeal
  // and actFund). Falls back to defaults when not yet set.
  // A mutually-agreed cancellation after funding is charged a cancellation fee
  // (SAFEDEAL_CANCELLATION_FEE_PERCENT, default 5%) and settled exactly like a refund:
  // the buyer is refunded the net pool, and the platform keeps the fee + real costs.
  const breakdown = dealFeeBreakdown(deal, outcome);
  const amounts = computeSettlementAmounts(breakdown, outcome, opts.splitPercentSeller);
  const nextStatus = outcomeToStatus(outcome);
  assertTransition(deal.status, nextStatus as any);

  const now = new Date();
  deal.status = nextStatus;
  deal.simulated = true;
  deal.outcome = outcome;
  deal.outcome_authorized_at = now;
  if (!deal.custody_stablecoin) deal.custody_stablecoin = CUSTODY_STABLECOIN;

  // Reset then set the applicable legs to pending.
  deal.seller_payout_state = "na";
  deal.buyer_payout_state = "na";
  deal.seller_entitlement_stable = null;
  deal.buyer_entitlement_stable = null;
  if (amounts.sellerAmount > 0) {
    deal.seller_entitlement_stable = amounts.sellerAmount;
    deal.seller_payout_state = "pending";
  }
  if (amounts.buyerRefund > 0) {
    deal.buyer_entitlement_stable = amounts.buyerRefund;
    deal.buyer_payout_state = "pending";
  }
  if (nextStatus === "completed") deal.completed_at = now;
  if (nextStatus === "refunded") deal.refunded_at = now;
  deal.dispute_resolution = outcome === "split" ? "split" : outcome;
  if (outcome === "split") deal.split_percent_seller = opts.splitPercentSeller ?? 50;

  const summary = describeSettlement(amounts, deal.currency) + " (authorized)";
  deal.settlement_note = summary;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: `outcome_${outcome}`,
    actor: opts.actorLabel,
    role: opts.actorRole,
    note: summary,
    meta: { amounts, entitlement_stablecoin: deal.custody_stablecoin, simulated: !isLiveSettlementEnabled() },
  });
  await deal.save();
  return { summary };
}

/** Phase 2 — execute any payable legs (idempotent). Returns which legs paid. */
async function attemptPayouts(deal: any, actorLabel = "system"): Promise<{ sellerPaid: boolean; buyerPaid: boolean }> {
  let sellerPaid = false;
  let buyerPaid = false;
  if (!["completed", "refunded", "split"].includes(deal.status)) return { sellerPaid, buyerPaid };

  // SafeDeal: settlement lands in the parties' SafeDeal wallets (no on-chain leg).
  if (isSafeDeal(deal)) {
    const legsPending = deal.seller_payout_state === "pending" || deal.buyer_payout_state === "pending";
    if (!legsPending) return { sellerPaid, buyerPaid };
    const breakdown = dealFeeBreakdown(deal);
    const amounts = { sellerAmount: Number(deal.seller_entitlement_stable || 0), buyerRefund: Number(deal.buyer_entitlement_stable || 0) };
    try {
      await settleToWallets(deal, amounts, breakdown);
    } catch (err) {
      apiLogger.error(`[escrow.safedeal] wallet settlement failed for deal ${deal.escrow_id}: ${(err as Error).message}`);
      deal.needs_admin_review = true;
      await deal.save();
      return { sellerPaid, buyerPaid };
    }
    const now = new Date();
    const prefs = (deal.payout_prefs || {}) as Record<string, any>;
    const sellerCid = deal.creator_role === "seller" ? deal.creator_customer_id : deal.counterparty_customer_id;
    const buyerCid = deal.creator_role === "buyer" ? deal.creator_customer_id : deal.counterparty_customer_id;
    let feeCreditTo: number | null = null;
    const describe = (r: SettlementPayoutResult, amount: number, who: string): string => {
      if (r.mode === "sent") {
        const w = r.withdrawal;
        const where = `${w.payout_key} ${w.address.slice(0, 6)}…${w.address.slice(-4)}`;
        return w.status === "pending_approval"
          ? `${amount} USD payout to the ${who} (${where}) is queued for review — sent once approved.`
          : `${amount} USDT is on its way to the ${who}'s address ${where} — the blockchain transaction hash follows by email once the network confirms it.`;
      }
      if (r.mode === "kept") return `${amount} USD credited to the ${who}'s SafeDeal balance (auto-cashout is off — it stays there until they cash out).`;
      if (r.reason === "cooling") return `${amount} USD for the ${who} is held in their SafeDeal balance — their payout address is in its safety hold and will be paid automatically once usable.`;
      return `${amount} USD credited to the ${who}'s SafeDeal balance (automatic payout failed: ${r.detail || "unknown"}).`;
    };
    if (deal.seller_payout_state === "pending") {
      const amount = Number(deal.seller_entitlement_stable || 0);
      const r = sellerCid && amount > 0 ? await settlementPayout(Number(sellerCid), amount, deal, prefs.seller) : null;
      deal.seller_payout_state = "paid";
      deal.seller_paid_at = now;
      deal.seller_payout_tx = r?.mode === "sent" ? r.withdrawal.tx_hash || `WITHDRAWAL-${r.withdrawal.withdrawal_id}` : `WALLET-CREDIT-${deal.escrow_id}`;
      deal.activity_log = appendActivity(deal.activity_log, { type: "payout_seller", actor: actorLabel, role: "system", note: r ? describe(r, amount, "seller") : `Nothing due to the seller.`, meta: r?.mode === "sent" ? { withdrawal_id: r.withdrawal.withdrawal_id, simulated: !!r.withdrawal.simulated } : undefined });
      if (r?.mode === "kept") feeCreditTo = Number(sellerCid);
      sellerPaid = true;
    }
    if (deal.buyer_payout_state === "pending") {
      const amount = Number(deal.buyer_entitlement_stable || 0);
      const r = buyerCid && amount > 0 ? await settlementPayout(Number(buyerCid), amount, deal, prefs.buyer) : null;
      deal.buyer_payout_state = "paid";
      deal.buyer_paid_at = now;
      deal.buyer_payout_tx = r?.mode === "sent" ? r.withdrawal.tx_hash || `WITHDRAWAL-${r.withdrawal.withdrawal_id}` : `WALLET-CREDIT-${deal.escrow_id}`;
      const keptNote = isCancellationRefund(deal) ? "Cancellation fee, network & exchange costs were kept." : "Fees & costs were kept.";
      deal.activity_log = appendActivity(deal.activity_log, { type: "payout_buyer", actor: actorLabel, role: "system", note: r ? `Refund: ${describe(r, amount, "buyer")} ${keptNote}` : `Nothing refunded to the buyer (${isCancellationRefund(deal) ? "cancellation fee, network & exchange costs kept" : "fees & costs kept"}).`, meta: r?.mode === "sent" ? { withdrawal_id: r.withdrawal.withdrawal_id, simulated: !!r.withdrawal.simulated } : undefined });
      if (r?.mode === "kept" && !feeCreditTo) feeCreditTo = Number(buyerCid);
      buyerPaid = true;
    }
    // The quote reserved ONE exchange-withdrawal fee. When the money stays in a SafeDeal
    // balance instead of being paid out, that fee was never spent — credit it to that party so
    // their later manual withdrawal isn't charged twice.
    const reservedWithdrawalFee = round2(Number(breakdown.withdrawalFeeUsd || 0));
    if (feeCreditTo && reservedWithdrawalFee > 0) {
      await addWithdrawalFeeCredit(feeCreditTo, reservedWithdrawalFee);
      deal.activity_log = appendActivity(deal.activity_log, {
        type: "withdrawal_fee_credit",
        actor: actorLabel,
        role: "system",
        note: `${reservedWithdrawalFee.toFixed(2)} USD cashout fee reserved in the quote was not needed (funds kept in balance) — credited towards that party's next cashout.`,
        meta: { customer_id: feeCreditTo, amount: reservedWithdrawalFee },
      });
    }
    deal.fully_paid_at = now;
    deal.needs_admin_review = false;
    await deal.save();
    return { sellerPaid, buyerPaid };
  }

  if (isLiveSettlementEnabled()) {
    // Live wiring is a follow-up; never broadcast in v1.
    return { sellerPaid, buyerPaid };
  }

  if (deal.seller_payout_state === "pending" && deal.seller_payout_address) {
    const coin = deal.seller_payout_coin || deal.custody_stablecoin || DEFAULT_ESCROW_STABLECOIN;
    deal.seller_payout_state = "paid";
    deal.seller_paid_at = new Date();
    deal.seller_payout_tx = `SIMULATED-PAYOUT-${crypto.randomBytes(12).toString("hex")}`;
    deal.activity_log = appendActivity(deal.activity_log, {
      type: "payout_seller",
      actor: actorLabel,
      role: "system",
      note: `Paid seller ${deal.seller_entitlement_stable} ${coin} to ${deal.seller_payout_address}.`,
      meta: { simulated: true },
    });
    sellerPaid = true;
  }
  if (deal.buyer_payout_state === "pending" && deal.buyer_refund_address) {
    const coin = deal.buyer_refund_coin || deal.custody_stablecoin || DEFAULT_ESCROW_STABLECOIN;
    deal.buyer_payout_state = "paid";
    deal.buyer_paid_at = new Date();
    deal.buyer_payout_tx = `SIMULATED-PAYOUT-${crypto.randomBytes(12).toString("hex")}`;
    deal.activity_log = appendActivity(deal.activity_log, {
      type: "payout_buyer",
      actor: actorLabel,
      role: "system",
      note: `Refunded buyer ${deal.buyer_entitlement_stable} ${coin} to ${deal.buyer_refund_address}.`,
      meta: { simulated: true },
    });
    buyerPaid = true;
  }

  // "payout paid" milestone once every applicable leg is paid.
  const legs = [deal.seller_payout_state, deal.buyer_payout_state].filter((s) => s !== "na");
  if (legs.length > 0 && legs.every((s) => s === "paid")) {
    deal.fully_paid_at = new Date();
    deal.needs_admin_review = false;
  }
  if (sellerPaid || buyerPaid) await deal.save();
  return { sellerPaid, buyerPaid };
}

/** Notify parties of an outcome: "paid" if their leg executed, else "payout pending". */
async function notifyOutcome(deal: any, summary: string): Promise<void> {
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const url = dealUrl(deal);
  if (isSafeDeal(deal)) {
    // Funds land in wallets — one clear email per party, no "paste an address" nudges.
    if (deal.seller_payout_state === "paid" && sellerEmail) void sendEscrowReleasedEmail(sellerEmail, sellerEmail, deal, summary);
    if (deal.buyer_payout_state === "paid" && buyerEmail) void sendEscrowRefundedEmail(buyerEmail, buyerEmail, deal, summary);
    // Branded SafeDeal invoice PDF (SD-<id>) to each party, on settlement.
    void import("../services/safedeal/safedealInvoiceEmail")
      .then((m) => m.emailSafeDealDealInvoices(deal, buyerEmail, sellerEmail))
      .catch(() => undefined);
    return;
  }
  if (deal.seller_payout_state === "paid" && sellerEmail) {
    void sendEscrowReleasedEmail(sellerEmail, sellerEmail, deal, summary);
    void sendEscrowPaidEmail(sellerEmail, sellerEmail, deal, summary);
  } else if (deal.seller_payout_state === "pending" && sellerEmail) {
    void sendEscrowPayoutPendingEmail(sellerEmail, sellerEmail, deal, "seller", url);
  }
  if (deal.buyer_payout_state === "paid" && buyerEmail) {
    void sendEscrowRefundedEmail(buyerEmail, buyerEmail, deal, summary);
    void sendEscrowPaidEmail(buyerEmail, buyerEmail, deal, summary);
  } else if (deal.buyer_payout_state === "pending" && buyerEmail) {
    void sendEscrowPayoutPendingEmail(buyerEmail, buyerEmail, deal, "buyer", url);
  }
}

async function settleOutcome(
  deal: any,
  outcome: SettlementOutcome,
  opts: { splitPercentSeller?: number; actorLabel: string; actorRole: string }
): Promise<{ summary: string }> {
  const { summary } = await authorizeOutcome(deal, outcome, opts);
  await attemptPayouts(deal, opts.actorLabel);
  await notifyOutcome(deal, summary);
  return { summary };
}

// ── internal party actions (shared by authed + public paths) ─────────────────

async function actAccept(deal: any, actor: ActorInfo): Promise<any> {
  if (!actor.isCounterparty) fail(403, "Only the invited counterparty can accept.");
  if (deal.status !== "invited") fail(409, `This invitation is no longer open (status '${deal.status}').`);
  assertTransition(deal.status, "awaiting_payment");
  deal.status = "awaiting_payment";
  deal.accepted_at = new Date();
  if (actor.signedIn) deal.counterparty_user_id = deal.counterparty_user_id;
  deal.activity_log = appendActivity(deal.activity_log, { type: "accepted", actor: actor.label, role: actor.role, note: "Counterparty accepted the terms." });
  await deal.save();
  const { creatorEmail, creatorName } = await loadCreatorAndCompany(deal);
  if (creatorEmail) void sendEscrowAcceptedEmail(creatorEmail, creatorName, deal, actor.label);
  return deal;
}

async function actDecline(deal: any, actor: ActorInfo, reason?: string): Promise<any> {
  if (!actor.isCounterparty) fail(403, "Only the invited counterparty can decline.");
  if (deal.status !== "invited") fail(409, `This invitation is no longer open (status '${deal.status}').`);
  assertTransition(deal.status, "declined");
  deal.status = "declined";
  deal.declined_at = new Date();
  deal.activity_log = appendActivity(deal.activity_log, { type: "declined", actor: actor.label, role: actor.role, note: reason || "Counterparty declined." });
  await deal.save();
  const { creatorEmail, creatorName } = await loadCreatorAndCompany(deal);
  if (creatorEmail) void sendEscrowDeclinedEmail(creatorEmail, creatorName, deal, actor.label);
  return deal;
}

const PRE_FUNDING_STATUSES = ["draft", "invited", "awaiting_payment"];
const FUNDED_STATUSES = ["funded", "delivered"];

/**
 * Cancellation policy:
 *  - BEFORE funding: free — either participant voids the deal instantly.
 *  - AFTER funding: needs mutual agreement — becomes a cancellation request that
 *    runs through the dispute engine as a `refund` proposal (fees/costs are kept).
 */
async function actCancel(deal: any, actor: ActorInfo, body: any): Promise<{ deal: any; requested: boolean }> {
  if (FUNDED_STATUSES.includes(deal.status)) {
    await actRaiseDispute(deal, actor, { proposed_outcome: "refund", kind: "cancellation", message: body?.reason || body?.message });
    return { deal, requested: true };
  }
  if (!PRE_FUNDING_STATUSES.includes(deal.status)) {
    fail(409, `This deal can no longer be cancelled (status '${deal.status}').`);
  }
  if (deal.status === "draft" && !actor.isCreator) fail(403, "Only the creator can cancel a draft.");
  assertTransition(deal.status, "cancelled");
  deal.status = "cancelled";
  deal.cancelled_at = new Date();
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "cancelled",
    actor: actor.label,
    role: actor.role,
    note: body?.reason ? String(body.reason).slice(0, 500) : `Deal cancelled by the ${actor.role} before funding (no charge).`,
  });
  await deal.save();
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const otherEmail = actor.role === "buyer" ? sellerEmail : buyerEmail;
  if (otherEmail) void sendEscrowCancelledEmail(otherEmail, otherEmail, deal, actor.role);
  return { deal, requested: false };
}

async function actFund(deal: any, actor: ActorInfo, coinIn?: string): Promise<any> {
  if (isLiveSettlementEnabled()) fail(403, "Simulated funding is disabled when live settlement is on. Fund via the hosted checkout.");
  if (actor.role !== "buyer") fail(403, "Only the buyer funds the escrow.");
  if (deal.status !== "awaiting_payment") fail(409, `Cannot fund from status '${deal.status}'.`);
  const coin = (coinIn ? String(coinIn) : (deal.accepted_coins || "USDT-TRC20").split(",")[0]).trim();
  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: coin, acceptedCoins: deal.accepted_coins });
  const now = new Date();
  assertTransition(deal.status, "funded");
  deal.status = "funded";
  deal.funded_at = now;
  deal.simulated = true;
  deal.funding_coin = coin;
  deal.funding_method = "simulated";
  deal.funding_crypto_amount = breakdown.buyerPays;
  deal.funded_amount_usd = breakdown.buyerPays;
  deal.funding_deposit_address = `SIMULATED-${crypto.randomBytes(8).toString("hex")}`;
  deal.funding_tx_hash = `SIMULATED-${crypto.randomBytes(16).toString("hex")}`;
  // Simulated sweep + convert-to-stable into pooled custody (per-deal ledger).
  deal.custody_stablecoin = CUSTODY_STABLECOIN;
  deal.custody_amount_stable = breakdown.buyerPays;
  deal.converted_at = now;
  deal.fee_breakdown_locked = breakdown;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: actor.label,
    role: "buyer",
    note: `Buyer funded ${breakdown.buyerPays} ${deal.currency} in ${coin}; ${breakdown.buyerPays} ${CUSTODY_STABLECOIN} held securely in escrow.`,
    meta: { breakdown, simulated: true },
  });
  if (isSafeDeal(deal)) await recordFundingReceived(deal, breakdown.buyerPays, "simulated");
  await deal.save();
  const { sellerEmail } = await partyEmails(deal);
  if (sellerEmail) void sendEscrowFundedEmail(sellerEmail, sellerEmail, deal);
  return deal;
}

/** SafeDeal only — the buyer pays the full quote from their available wallet balance. */
async function actFundFromBalance(deal: any, actor: ActorInfo): Promise<any> {
  if (!isSafeDeal(deal)) fail(400, "Paying from balance is only available on SafeDeal.");
  if (actor.role !== "buyer") fail(403, "Only the buyer funds the escrow.");
  if (deal.status !== "awaiting_payment") fail(409, `Cannot fund from status '${deal.status}'.`);
  if (!deal.creator_customer_id && !deal.counterparty_customer_id) fail(409, "Buyer wallet not found.");
  const buyerCustomerId = deal.creator_role === "buyer" ? deal.creator_customer_id : deal.counterparty_customer_id;
  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: CUSTODY_STABLECOIN, acceptedCoins: deal.accepted_coins });
  const bal = buyerCustomerId ? await getBalances(Number(buyerCustomerId)) : { available: 0 };
  if (bal.available < breakdown.buyerPays) {
    fail(400, `Your available balance (${bal.available.toFixed(2)} USD) is below the ${breakdown.buyerPays.toFixed(2)} USD due for this deal.`);
  }
  await fundFromBalance(deal, breakdown.buyerPays);
  const now = new Date();
  assertTransition(deal.status, "funded");
  deal.status = "funded";
  deal.funded_at = now;
  deal.simulated = false;
  deal.funding_coin = CUSTODY_STABLECOIN;
  deal.funding_method = "balance";
  deal.funding_crypto_amount = breakdown.buyerPays;
  deal.funded_amount_usd = breakdown.buyerPays;
  deal.custody_stablecoin = CUSTODY_STABLECOIN;
  deal.custody_amount_stable = breakdown.buyerPays;
  deal.converted_at = now;
  deal.fee_breakdown_locked = breakdown;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: actor.label,
    role: "buyer",
    note: `Buyer paid ${breakdown.buyerPays} ${deal.currency} from their SafeDeal balance; held in escrow as ${CUSTODY_STABLECOIN}.`,
    meta: { breakdown },
  });
  await deal.save();
  {
    const { sellerEmail, buyerEmail } = await partyEmails(deal);
    if (sellerEmail) void sendEscrowFundedEmail(sellerEmail, sellerEmail, deal);
    if (buyerEmail) void sendEscrowFundingReceiptEmail(buyerEmail, buyerEmail, deal, { paidUsd: breakdown.buyerPays, method: "balance" }, dealUrl(deal));
  }
  return deal;
}

/** Live path — a hosted-checkout payment for this deal was confirmed on-chain. */
async function actFundFromCheckout(deal: any, paidUsd: number, coin: string, txHash: string): Promise<any> {
  if (deal.status !== "awaiting_payment") return deal; // already funded / cancelled — idempotent
  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: coin, acceptedCoins: deal.accepted_coins });
  const now = new Date();
  assertTransition(deal.status, "funded");
  deal.status = "funded";
  deal.funded_at = now;
  deal.simulated = false;
  deal.funding_coin = coin;
  deal.funding_method = deal.funding_method === "dynopay_api" ? "dynopay_api" : "checkout";
  deal.funding_tx_hash = txHash;
  deal.funded_amount_usd = breakdown.buyerPays;
  deal.custody_stablecoin = CUSTODY_STABLECOIN;
  deal.custody_amount_stable = breakdown.buyerPays;
  deal.converted_at = now;
  deal.fee_breakdown_locked = breakdown;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: "dynopay",
    role: "buyer",
    note: isSafeDeal(deal)
      ? `Buyer paid ${paidUsd} ${deal.currency} in ${coin}${txHash ? ` (tx ${txHash})` : ""}; ${breakdown.buyerPays} ${CUSTODY_STABLECOIN} held securely in escrow.`
      : `Buyer paid ${paidUsd} ${deal.currency} in ${coin} via Dynopay${txHash ? ` (tx ${txHash})` : ""}; ${breakdown.buyerPays} ${CUSTODY_STABLECOIN} held securely in escrow.`,
    meta: { breakdown, paidUsd },
  });
  if (isSafeDeal(deal)) await recordFundingReceived(deal, breakdown.buyerPays, deal.funding_method);
  await deal.save();
  {
    const { sellerEmail, buyerEmail } = await partyEmails(deal);
    if (sellerEmail) void sendEscrowFundedEmail(sellerEmail, sellerEmail, deal);
    // The buyer just sent crypto — confirm it landed, with the on-chain transaction.
    if (buyerEmail) {
      const realHash = txHash && !/^(SIMULATED-|WALLET-CREDIT|BINANCE-)/i.test(txHash) ? txHash : null;
      const meta = FUNDING_COIN_META[String(coin || "").toUpperCase()];
      const coinLabel = meta ? `${meta.label} on ${meta.network}` : coin;
      void sendEscrowFundingReceiptEmail(
        buyerEmail, buyerEmail, deal,
        { paidUsd, coin: coinLabel, txHash: realHash, explorerUrl: realHash ? explorerTxUrl(coin, realHash) : null, method: deal.funding_method },
        dealUrl(deal)
      );
    }
  }
  return deal;
}

export interface DeliveryProofInput {
  links?: unknown;
  tracking?: { carrier?: unknown; number?: unknown } | null;
  attachment_ids?: number[];
}

const MAX_PROOF_LINKS = 5;
function normalizeProof(note: string | null, proof?: DeliveryProofInput | null): Record<string, unknown> | null {
  const links = Array.isArray(proof?.links)
    ? proof!.links
        .map((l) => String(l ?? "").trim())
        .filter((l) => /^https?:\/\/\S+$/i.test(l) && l.length <= 500)
        .slice(0, MAX_PROOF_LINKS)
    : [];
  const carrier = String(proof?.tracking?.carrier ?? "").trim().slice(0, 60);
  const number = String(proof?.tracking?.number ?? "").trim().slice(0, 80);
  const attachment_ids = Array.isArray(proof?.attachment_ids) ? proof!.attachment_ids.slice(0, 5) : [];
  if (!note && !links.length && !number && !attachment_ids.length) return null;
  return { note, links, tracking: number ? { carrier: carrier || null, number } : null, attachment_ids };
}

async function actDeliver(deal: any, actor: ActorInfo, note?: string, proof?: DeliveryProofInput | null): Promise<any> {
  if (actor.role !== "seller") fail(403, "Only the seller can mark a deal as delivered.");
  if (deal.status !== "funded") fail(409, `Cannot mark delivered from status '${deal.status}'.`);
  assertTransition(deal.status, "delivered");
  const now = new Date();
  deal.status = "delivered";
  deal.delivered_at = now;
  const cleanNote = note ? String(note).slice(0, 5000) : null;
  if (cleanNote) deal.delivery_note = cleanNote;
  const p = normalizeProof(cleanNote, proof);
  deal.delivery_proof = p;
  deal.auto_release_at = new Date(now.getTime() + Number(deal.auto_release_days || 3) * 86400000);
  const bits: string[] = [];
  if (p?.tracking) bits.push(`tracking ${(p.tracking as any).carrier ? `${(p.tracking as any).carrier} ` : ""}${(p.tracking as any).number}`);
  if ((p?.links as string[] | undefined)?.length) bits.push(`${(p!.links as string[]).length} link(s)`);
  if ((p?.attachment_ids as number[] | undefined)?.length) bits.push(`${(p!.attachment_ids as number[]).length} file(s)`);
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "delivered",
    actor: actor.label,
    role: "seller",
    note: `${deal.delivery_note || "Marked as delivered."}${bits.length ? ` · Proof: ${bits.join(", ")}` : ""}`,
  });
  await deal.save();
  const { buyerEmail } = await partyEmails(deal);
  if (buyerEmail) void sendEscrowDeliveredEmail(buyerEmail, buyerEmail, deal, Number(deal.auto_release_days || 3));
  return deal;
}

async function actRelease(deal: any, actor: ActorInfo): Promise<any> {
  if (actor.role !== "buyer") fail(403, "Only the buyer can release funds.");
  if (!["funded", "delivered"].includes(deal.status)) fail(409, `Cannot release from status '${deal.status}' (already settled?).`);
  await settleOutcome(deal, "release", { actorLabel: actor.label, actorRole: "buyer" });
  return deal;
}

/** Buyer sends a delivery back for changes (capped) — deal returns to funded, timer cleared, seller re-delivers. */
async function actRequestChanges(deal: any, actor: ActorInfo, message?: string): Promise<any> {
  if (actor.role !== "buyer") fail(403, "Only the buyer can ask for changes.");
  if (deal.status !== "delivered") fail(409, `You can only ask for changes on a delivered deal (current: '${deal.status}').`);
  const text = String(message || "").trim();
  if (text.length < 10) fail(400, "Tell the seller what needs to change (at least 10 characters).");
  if (text.length > 2000) fail(400, "Keep the request under 2000 characters.");
  const round = Number(deal.revision_round || 0);
  if (round >= MAX_REVISION_ROUNDS) fail(409, `You've already asked for changes ${MAX_REVISION_ROUNDS} times. Release the funds or open a dispute.`);
  assertTransition(deal.status, "funded");
  const now = new Date();
  deal.status = "funded";
  deal.auto_release_at = null;
  deal.revision_round = round + 1;
  deal.revision_note = text;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "changes_requested",
    actor: actor.label,
    role: "buyer",
    note: `Changes requested (round ${round + 1} of ${MAX_REVISION_ROUNDS}): ${text}`,
    meta: { previous_proof: deal.delivery_proof || null, delivered_at: deal.delivered_at || null },
  });
  deal.delivered_at = null;
  deal.delivery_proof = null;
  await deal.save();
  const { sellerEmail } = await partyEmails(deal);
  if (sellerEmail) void sendEscrowChangesRequestedEmail(sellerEmail, sellerEmail, deal, text, round + 1, MAX_REVISION_ROUNDS, dealUrl(deal));
  return deal;
}

/** Creator re-sends the invite email (rate-limited) while the deal is still waiting for an answer. */
async function actResendInvite(deal: any, actor: ActorInfo): Promise<any> {
  if (!actor.isCreator) fail(403, "Only the creator can resend the invite.");
  if (deal.status !== "invited") fail(409, "The invite has already been answered.");
  const last = deal.invite_resent_at ? new Date(deal.invite_resent_at).getTime() : 0;
  const wait = RESEND_INVITE_COOLDOWN_MS - (Date.now() - last);
  if (wait > 0) fail(429, `Invite already resent recently — try again in ${Math.ceil(wait / 60000)} min.`);
  const { counterparty } = resolveRoles(deal.creator_role);
  deal.invite_resent_at = new Date();
  deal.activity_log = appendActivity(deal.activity_log, { type: "invite_resent", actor: actor.label, role: actor.role, note: `Invite re-sent to ${deal.counterparty_email}.` });
  await deal.save();
  void sendEscrowInviteEmail(deal.counterparty_email, deal.counterparty_email, deal, actor.label, counterparty, dealUrl(deal));
  return deal;
}

// ── dispute negotiation helpers + actions (two-tier: parties first, admin fallback) ─

function appendDisputeThread(deal: any, entry: Record<string, unknown>): void {
  const list = Array.isArray(deal.dispute_thread) ? deal.dispute_thread : [];
  deal.dispute_thread = [...list, { at: new Date().toISOString(), ...entry }];
}

function describeProposalShort(outcome: SettlementOutcome, splitPct?: number | null, kind?: string | null): string {
  if (kind === "cancellation") return "cancel the deal — refund to the buyer, minus a cancellation fee and real network/exchange costs";
  if (outcome === "release") return "full release to the seller";
  if (outcome === "refund") return "full refund to the buyer";
  const s = Number(splitPct ?? 50);
  return `a ${s}%/${100 - s}% split (seller/buyer)`;
}

const proposalKind = (body: any): "cancellation" | null => (String(body?.kind || "") === "cancellation" ? "cancellation" : null);

/** Validate + normalise a proposed resolution from a request body (decision 2a). */
function normalizeProposal(body: any): { outcome: SettlementOutcome; split_percent_seller: number | null } {
  const raw = String(body?.proposed_outcome ?? body?.outcome ?? "").toLowerCase().trim();
  const outcome =
    raw === "release" ? "release" : raw === "refund" ? "refund" : raw === "split" || raw === "partial" ? "split" : "";
  if (!outcome) fail(400, "A proposed resolution is required: 'release', 'refund' or 'split' (partial refund).");
  let pct: number | null = null;
  if (outcome === "split") {
    let n = Number(body?.split_percent_seller);
    // Also accept a buyer-centric "refund_percent" (seller keeps the remainder).
    if (!Number.isFinite(n) && Number.isFinite(Number(body?.refund_percent))) n = 100 - Number(body.refund_percent);
    if (!Number.isFinite(n) || n < 0 || n > 100) fail(400, "For a partial refund, provide split_percent_seller (0–100).");
    pct = Math.round(n);
  }
  return { outcome: outcome as SettlementOutcome, split_percent_seller: pct };
}

const escalateWindowMs = () => DISPUTE_AUTO_ESCALATE_HOURS * 3600000;

/** Open a dispute WITH a proposed resolution (decision 2a). Enters party negotiation. */
async function actRaiseDispute(deal: any, actor: ActorInfo, body: any): Promise<any> {
  if (!FUNDED_STATUSES.includes(deal.status)) fail(409, `A dispute can only be raised on a funded or delivered deal (current: '${deal.status}').`);
  const kind = proposalKind(body);
  // A cancellation request is always "refund the buyer"; fees/costs are never returned.
  const { outcome, split_percent_seller } = kind === "cancellation" ? { outcome: "refund" as SettlementOutcome, split_percent_seller: null } : normalizeProposal(body);
  assertTransition(deal.status, "disputed");
  const now = new Date();
  const message = body?.message ? String(body.message).slice(0, 2000) : null;
  deal.status = "disputed";
  deal.disputed_at = now;
  deal.dispute_raised_by = actor.role;
  if (body?.reason) deal.dispute_reason = String(body.reason);
  else if (kind === "cancellation") deal.dispute_reason = "Cancellation requested after funding";
  deal.auto_release_at = null;
  deal.dispute_stage = "negotiation";
  deal.dispute_proposal = { outcome, split_percent_seller, by: actor.role, at: now.toISOString(), message, kind };
  deal.dispute_proposal_by = actor.role;
  deal.dispute_auto_escalate_at = new Date(now.getTime() + escalateWindowMs());
  appendDisputeThread(deal, { by: actor.role, type: "open", kind, outcome, split_percent_seller, message, reason: deal.dispute_reason || null, attachment_ids: threadAttachments(body) });
  deal.activity_log = appendActivity(deal.activity_log, {
    type: kind === "cancellation" ? "cancellation_requested" : "dispute_opened",
    actor: actor.label,
    role: actor.role,
    note: kind === "cancellation"
      ? `Cancellation requested — needs the other party's agreement: ${describeProposalShort(outcome, null, kind)}.`
      : `Dispute opened with proposal: ${describeProposalShort(outcome, split_percent_seller)}. ${deal.dispute_reason || ""}`.trim(),
  });
  await deal.save();
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const otherEmail = actor.role === "buyer" ? sellerEmail : buyerEmail;
  if (otherEmail) void sendEscrowDisputeProposalEmail(otherEmail, otherEmail, deal, actor.role, outcome, split_percent_seller, message || undefined, dealUrl(deal), false, kind);
  return deal;
}

/** Counter-offer a different resolution (decision 1b — full back-and-forth). Turn flips. */
async function actCounterDispute(deal: any, actor: ActorInfo, body: any): Promise<any> {
  if (deal.status !== "disputed") fail(409, `No open dispute to counter (status '${deal.status}').`);
  if ((deal.dispute_stage || "negotiation") !== "negotiation") fail(409, "This dispute has been escalated to an admin — counter-offers are closed.");
  if (deal.dispute_proposal_by === actor.role) fail(403, "It's the other party's turn — you can't counter your own proposal.");
  const { outcome, split_percent_seller } = normalizeProposal(body);
  const now = new Date();
  const message = body?.message ? String(body.message).slice(0, 2000) : null;
  deal.dispute_proposal = { outcome, split_percent_seller, by: actor.role, at: now.toISOString(), message };
  deal.dispute_proposal_by = actor.role;
  deal.dispute_auto_escalate_at = new Date(now.getTime() + escalateWindowMs());
  appendDisputeThread(deal, { by: actor.role, type: "counter", outcome, split_percent_seller, message, attachment_ids: threadAttachments(body) });
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "dispute_counter",
    actor: actor.label,
    role: actor.role,
    note: `Counter-offer: ${describeProposalShort(outcome, split_percent_seller)}.`,
  });
  await deal.save();
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const otherEmail = actor.role === "buyer" ? sellerEmail : buyerEmail;
  if (otherEmail) void sendEscrowDisputeProposalEmail(otherEmail, otherEmail, deal, actor.role, outcome, split_percent_seller, message || undefined, dealUrl(deal), true);
  return deal;
}

/** Accept the current proposal → auto-resolve via the two-phase engine (no admin). */
async function actAcceptDispute(deal: any, actor: ActorInfo): Promise<any> {
  if (deal.status !== "disputed") fail(409, `No open dispute to accept (status '${deal.status}').`);
  if ((deal.dispute_stage || "negotiation") !== "negotiation") fail(409, "This dispute is no longer open for a party agreement (it was escalated to an admin).");
  const prop = deal.dispute_proposal;
  if (!prop || !prop.outcome) fail(409, "There is no active proposal to accept.");
  if (deal.dispute_proposal_by === actor.role) fail(403, "You can't accept your own proposal — wait for the other party, counter, or escalate.");
  const outcome = String(prop.outcome) as SettlementOutcome;
  const splitPct = outcome === "split" ? Number(prop.split_percent_seller) : undefined;
  const kind = prop.kind === "cancellation" ? "cancellation" : null;
  deal.dispute_stage = "resolved";
  deal.dispute_resolved_at = new Date();
  deal.dispute_auto_escalate_at = null;
  appendDisputeThread(deal, { by: actor.role, type: "accept", kind, outcome, split_percent_seller: splitPct ?? null });
  deal.activity_log = appendActivity(deal.activity_log, {
    type: kind === "cancellation" ? "cancellation_agreed" : "dispute_agreed",
    actor: actor.label,
    role: actor.role,
    note: kind === "cancellation"
      ? "Agreed to cancel the deal — buyer refunded (cancellation fee and real network/exchange costs kept)."
      : `Accepted ${describeProposalShort(outcome, splitPct)} — resolved by agreement.`,
  });
  const { summary } = await settleOutcome(deal, outcome, { splitPercentSeller: splitPct, actorLabel: actor.label, actorRole: actor.role });
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const msg = kind === "cancellation" ? `Deal cancelled by mutual agreement — ${summary}` : `Resolved by agreement — ${summary}`;
  if (buyerEmail) void sendEscrowDisputeAgreedEmail(buyerEmail, buyerEmail, deal, msg);
  if (sellerEmail) void sendEscrowDisputeAgreedEmail(sellerEmail, sellerEmail, deal, msg);
  return deal;
}

const threadAttachments = (body: any): number[] =>
  Array.isArray(body?.attachment_ids) ? body.attachment_ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 5) : [];

/** Add a message / evidence (text and/or files) to the dispute thread (decision 5b). */
async function actDisputeMessage(deal: any, actor: ActorInfo, message?: string, attachmentIds: number[] = []): Promise<any> {
  if (deal.status !== "disputed") fail(409, "There is no open dispute to add a message to.");
  const text = String(message || "").trim();
  if (!text && !attachmentIds.length) fail(400, "Write a message or attach a file.");
  if (text.length > 2000) fail(400, "Message is too long (2000 characters max).");
  appendDisputeThread(deal, { by: actor.role, type: "message", message: text || null, attachment_ids: attachmentIds });
  await deal.save();
  return deal;
}

/** Escalate to admin arbitration (manual). Either party, during negotiation. */
async function actEscalateDispute(deal: any, actor: ActorInfo): Promise<any> {
  if (deal.status !== "disputed") fail(409, `No open dispute to escalate (status '${deal.status}').`);
  if ((deal.dispute_stage || "negotiation") === "escalated") fail(409, "This dispute is already with a Dynopay admin.");
  const now = new Date();
  deal.dispute_stage = "escalated";
  deal.dispute_escalated_at = now;
  deal.dispute_auto_escalate_at = null;
  appendDisputeThread(deal, { by: actor.role, type: "escalate" });
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "dispute_escalated",
    actor: actor.label,
    role: actor.role,
    note: "Escalated to a Dynopay admin — no agreement reached.",
  });
  await deal.save();
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  if (buyerEmail) void sendEscrowDisputeEscalatedEmail(buyerEmail, buyerEmail, deal, actor.role);
  if (sellerEmail) void sendEscrowDisputeEscalatedEmail(sellerEmail, sellerEmail, deal, actor.role);
  return deal;
}

/**
 * Set a settlement destination (seller stable address / buyer refund address) and
 * try to pay any pending leg. `signedIn` marks that an authenticated account set
 * it (allowed to reuse a saved wallet); OTP-only actors must paste an address.
 */
async function actSetDestination(
  deal: any,
  actor: ActorInfo,
  body: { payout_address?: string; payout_coin?: string; refund_address?: string; refund_coin?: string }
): Promise<any> {
  if (actor.role === "seller") {
    if (body.payout_address) deal.seller_payout_address = String(body.payout_address).trim();
    if (body.payout_coin) deal.seller_payout_coin = String(body.payout_coin).trim();
    if (!deal.seller_payout_coin) deal.seller_payout_coin = deal.custody_stablecoin || DEFAULT_ESCROW_STABLECOIN;
    if (actor.signedIn) deal.seller_signed_in = true;
  }
  if (actor.role === "buyer") {
    if (body.refund_address) deal.buyer_refund_address = String(body.refund_address).trim();
    if (body.refund_coin) deal.buyer_refund_coin = String(body.refund_coin).trim();
    if (!deal.buyer_refund_coin) deal.buyer_refund_coin = deal.custody_stablecoin || DEFAULT_ESCROW_STABLECOIN;
    if (actor.signedIn) deal.buyer_signed_in = true;
  }
  deal.activity_log = appendActivity(deal.activity_log, { type: "destination_set", actor: actor.label, role: actor.role, note: "Settlement destination updated." });
  await deal.save();
  // Trigger pending payout for this actor's leg if the outcome is already authorized.
  const { sellerPaid, buyerPaid } = await attemptPayouts(deal, actor.label);
  if (sellerPaid || buyerPaid) {
    const summary = deal.settlement_note || "Payout executed.";
    await notifyOutcome(deal, summary);
  }
  return deal;
}

// ── request wrappers ─────────────────────────────────────────────────────────

const respond = (res: express.Response, deal: any, code: number, msg: string, actor?: ActorInfo, includePrivate = true) => {
  const view = serializeDeal(deal, includePrivate);
  if (actor) {
    (view as any).my_role = actor.role;
    (view as any).is_creator = actor.isCreator;
  }
  return successResponseHelper(res, code, msg, view);
};

const handle = (res: express.Response, e: unknown, context: string) => {
  if (e instanceof EscrowError) return errorResponseHelper(res, e.code, e.message);
  apiLogger.error(`[escrow.${context}] ${(e as Error).message}`);
  return errorResponseHelper(res, 500, "Something went wrong with this escrow action.");
};

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN endpoints
// ═══════════════════════════════════════════════════════════════════════════

const adminListDeals = async (req: express.Request, res: express.Response) => {
  try {
    const { status, company_id } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (company_id) where.company_id = Number(company_id);
    const deals: any[] = await escrowDealModel.findAll({ where, order: [["created_at", "DESC"]], limit: 500 });
    const files = await listAttachmentsForDeals(deals.map((d) => Number(d.escrow_id)));
    const out = deals.map((d) => ({ ...serializeDeal(d), attachments: files[Number(d.escrow_id)] || [] }));
    return successResponseHelper(res, 200, "Escrow deals fetched.", out, out.length);
  } catch (e) {
    return handle(res, e, "adminListDeals");
  }
};

const adminDisputeQueue = async (req: express.Request, res: express.Response) => {
  try {
    const { stage } = req.query as Record<string, string>;
    const where: any = { status: "disputed" };
    if (stage === "negotiation" || stage === "escalated" || stage === "resolved") where.dispute_stage = stage;
    const deals: any[] = await escrowDealModel.findAll({ where, order: [["disputed_at", "ASC"]] });
    const files = await listAttachmentsForDeals(deals.map((d) => Number(d.escrow_id)));
    const out = deals.map((d) => ({ ...serializeDeal(d), attachments: files[Number(d.escrow_id)] || [] }));
    return successResponseHelper(res, 200, "Dispute queue fetched.", out, out.length);
  } catch (e) {
    return handle(res, e, "adminDisputeQueue");
  }
};

/** Auto-escalate disputes whose negotiation window elapsed with no agreement. */
async function runDisputeEscalations(): Promise<number[]> {
  const now = new Date();
  const deals: any[] = await escrowDealModel.findAll({
    where: {
      status: "disputed",
      dispute_stage: "negotiation",
      dispute_auto_escalate_at: { [Op.ne]: null, [Op.lte]: now } as any,
    },
    limit: 200,
  });
  const escalated: number[] = [];
  for (const deal of deals) {
    try {
      deal.dispute_stage = "escalated";
      deal.dispute_escalated_at = now;
      deal.dispute_auto_escalate_at = null;
      appendDisputeThread(deal, { by: "system", type: "auto_escalate" });
      deal.activity_log = appendActivity(deal.activity_log, {
        type: "dispute_escalated",
        actor: "system(auto-escalate)",
        role: "system",
        note: `No agreement within ${DISPUTE_AUTO_ESCALATE_HOURS}h — auto-escalated to admin.`,
      });
      await deal.save();
      const { buyerEmail, sellerEmail } = await partyEmails(deal);
      if (buyerEmail) void sendEscrowDisputeEscalatedEmail(buyerEmail, buyerEmail, deal, "system");
      if (sellerEmail) void sendEscrowDisputeEscalatedEmail(sellerEmail, sellerEmail, deal, "system");
      escalated.push(deal.escrow_id);
    } catch (err) {
      apiLogger.error(`[escrow.autoEscalate] deal ${deal.escrow_id}: ${(err as Error).message}`);
    }
  }
  return escalated;
}

/** Authorize release on elapsed inspection timers. */
async function runAutoRelease(): Promise<number[]> {
  const now = new Date();
  const deals: any[] = await escrowDealModel.findAll({
    where: { status: "delivered", auto_release_at: { [Op.ne]: null, [Op.lte]: now } as any },
    limit: 200,
  });
  const processed: number[] = [];
  for (const deal of deals) {
    try {
      await settleOutcome(deal, "release", { actorLabel: "system(auto-release)", actorRole: "system" });
      processed.push(deal.escrow_id);
    } catch (err) {
      apiLogger.error(`[escrow.autoRelease] deal ${deal.escrow_id}: ${(err as Error).message}`);
    }
  }
  return processed;
}

/**
 * POST /api/escrow/admin/run-dispute-escalations — auto-escalate disputes whose
 * negotiation window elapsed with no agreement (decision 3b). Same maintenance-scan
 * pattern as run-auto-release; the hourly SafeDeal maintenance cron also runs it.
 */
const adminRunDisputeEscalations = async (_req: express.Request, res: express.Response) => {
  try {
    const escalated = await runDisputeEscalations();
    return successResponseHelper(res, 200, `Auto-escalated ${escalated.length} dispute(s).`, { escalated, count: escalated.length });
  } catch (e) {
    return handle(res, e, "adminRunDisputeEscalations");
  }
};

const adminResolveDispute = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findByPk(Number(req.params.id));
    if (!deal) return errorResponseHelper(res, 404, "Escrow deal not found.");
    if (deal.status !== "disputed") return errorResponseHelper(res, 409, `Only a disputed deal can be resolved (current: '${deal.status}').`);
    const { outcome, split_percent_seller, note } = req.body || {};
    if (!["release", "refund", "split"].includes(String(outcome))) return errorResponseHelper(res, 400, "outcome must be 'release', 'refund' or 'split'.");
    if (outcome === "split") {
      const pct = Number(split_percent_seller);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return errorResponseHelper(res, 400, "split_percent_seller must be between 0 and 100 for a split.");
    }
    deal.dispute_resolved_at = new Date();
    deal.dispute_stage = "resolved";
    deal.dispute_auto_escalate_at = null;
    appendDisputeThread(deal, {
      by: "admin",
      type: "resolve",
      outcome,
      split_percent_seller: outcome === "split" ? Number(split_percent_seller) : null,
      message: note ? String(note) : null,
    });
    if (note) deal.activity_log = appendActivity(deal.activity_log, { type: "admin_note", actor: "admin", role: "admin", note: String(note) });
    await settleOutcome(deal, outcome as SettlementOutcome, {
      splitPercentSeller: outcome === "split" ? Number(split_percent_seller) : undefined,
      actorLabel: "admin",
      actorRole: "admin",
    });
    const { buyerEmail, sellerEmail } = await partyEmails(deal);
    const resolvedMsg = `Resolution: ${deal.settlement_note}`;
    if (sellerEmail) void sendEscrowDisputeResolvedEmail(sellerEmail, sellerEmail, deal, resolvedMsg);
    if (buyerEmail) void sendEscrowDisputeResolvedEmail(buyerEmail, buyerEmail, deal, resolvedMsg);
    return respond(res, deal, 200, "Dispute resolved.");
  } catch (e) {
    return handle(res, e, "adminResolveDispute");
  }
};

/** POST /api/escrow/admin/run-auto-release — authorize release on elapsed timers. */
const adminRunAutoRelease = async (_req: express.Request, res: express.Response) => {
  try {
    const processed = await runAutoRelease();
    return successResponseHelper(res, 200, `Auto-release processed ${processed.length} deal(s).`, { processed, count: processed.length });
  } catch (e) {
    return handle(res, e, "adminRunAutoRelease");
  }
};

/** POST /api/escrow/admin/run-payout-reminders — nudge payout-pending parties. */
const adminRunPayoutReminders = async (_req: express.Request, res: express.Response) => {
  try {
    const deals: any[] = await escrowDealModel.findAll({
      where: {
        status: { [Op.in]: ["completed", "refunded", "split"] },
        source: { [Op.ne]: "safedeal" }, // SafeDeal legs land in wallets automatically
        [Op.or]: [{ seller_payout_state: "pending" }, { buyer_payout_state: "pending" }],
      },
      limit: 300,
    });
    const reminded: number[] = [];
    const flagged: number[] = [];
    for (const deal of deals) {
      const { buyerEmail, sellerEmail } = await partyEmails(deal);
      const url = dealUrl(deal);
      if (deal.seller_payout_state === "pending" && sellerEmail) void sendEscrowPayoutPendingEmail(sellerEmail, sellerEmail, deal, "seller", url);
      if (deal.buyer_payout_state === "pending" && buyerEmail) void sendEscrowPayoutPendingEmail(buyerEmail, buyerEmail, deal, "buyer", url);
      deal.payout_reminder_count = Number(deal.payout_reminder_count || 0) + 1;
      deal.payout_reminder_last_at = new Date();
      if (deal.payout_reminder_count >= REMINDER_REVIEW_THRESHOLD) {
        deal.needs_admin_review = true;
        flagged.push(deal.escrow_id);
      }
      await deal.save();
      reminded.push(deal.escrow_id);
    }
    return successResponseHelper(res, 200, `Reminded ${reminded.length} deal(s); ${flagged.length} flagged for review.`, { reminded, flagged });
  } catch (e) {
    return handle(res, e, "adminRunPayoutReminders");
  }
};

/**
 * Engine surface for SafeDeal (controller/safedealController.ts). Same state
 * machine, same money rules — only the actor/session layer differs.
 */
export const escrowEngine = {
  EscrowError,
  fail,
  ESCROW_FEE_PERCENT,
  CANCELLATION_FEE_PERCENT: cancellationFeePercent(),
  ESCROW_FEE_MIN_USD,
  ESCROW_MIN_DEAL_USD,
  ESCROW_MAX_DEAL_EUR,
  ESCROW_AUTO_RELEASE_PRESETS,
  ESCROW_AUTO_RELEASE_DEFAULT,
  clampAutoReleaseDays,
  serializeDeal,
  loadCreatorAndCompany,
  partyEmails,
  dealUrl,
  actAccept,
  actDecline,
  actCancel,
  actFund,
  actFundFromBalance,
  actFundFromCheckout,
  actDeliver,
  actRelease,
  actRequestChanges,
  actResendInvite,
  actRaiseDispute,
  actCounterDispute,
  actAcceptDispute,
  actDisputeMessage,
  actEscalateDispute,
  runAutoRelease,
  runDisputeEscalations,
  MAX_REVISION_ROUNDS,
};
export type { ActorInfo };

export default {
  adminListDeals,
  adminDisputeQueue,
  adminResolveDispute,
  adminRunAutoRelease,
  adminRunPayoutReminders,
  adminRunDisputeEscalations,
};
