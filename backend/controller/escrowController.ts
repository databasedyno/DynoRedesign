/**
 * Escrow controller — merchant dashboard, public counterparty (email-OTP), and
 * admin handlers.
 *
 * Counterparty model (v1): the invited party may NOT have a Dynopay account. They
 * verify their email once with a 6-digit OTP and receive a short-lived escrow
 * session token (x-escrow-token) used for every public action.
 *
 * Money-safety (v1): funding, stablecoin conversion, custody and payouts are all
 * SIMULATED (no on-chain broadcast / no real conversion). The two-phase
 * settlement (authorize -> payout pending -> paid) is fully modelled so the flow
 * is exercised end-to-end. Live wiring is gated behind ESCROW_LIVE_SETTLEMENT.
 */
import { raw as envRaw } from "../utils/config";
import express from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { companyModel, userModel } from "../models";
import escrowDealModel from "../models/escrowDealModel";
import { PaymentUserJwtPayload } from "../utils/types";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
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
  describeSettlement,
  deriveSettlement,
  isLiveSettlementEnabled,
  outcomeToStatus,
  resolveRoles,
} from "./escrow/escrowShared";
import { refreshEscrowCostRates } from "../services/escrow/escrowCosts";
import { recordFundingReceived, fundFromBalance, settleToWallets } from "../services/safedeal/safedealEscrowLedger";
import { getBalances } from "../services/safedeal/safedealWallet";
import { maybeAutoWithdraw } from "../services/safedeal/safedealWithdrawals";
import {
  sendEscrowInviteEmail,
  sendEscrowAcceptedEmail,
  sendEscrowDeclinedEmail,
  sendEscrowCancelledEmail,
  sendEscrowFundedEmail,
  sendEscrowDeliveredEmail,
  sendEscrowReleasedEmail,
  sendEscrowRefundedEmail,
  sendEscrowDisputeResolvedEmail,
  sendEscrowDisputeProposalEmail,
  sendEscrowDisputeEscalatedEmail,
  sendEscrowDisputeAgreedEmail,
  sendEscrowOtpEmail,
  sendEscrowPayoutPendingEmail,
  sendEscrowPaidEmail,
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

const OTP_TTL = 600; // 10 min
const SESSION_TTL = 3600; // 1 h
const REMINDER_REVIEW_THRESHOLD = 3;
// How long a dispute proposal can sit unanswered before it auto-escalates to admin.
const DISPUTE_AUTO_ESCALATE_HOURS = Number(envRaw("ESCROW_DISPUTE_AUTO_ESCALATE_HOURS")) || 72;
// Platform escrow fee — ADMIN-CONTROLLED via .env only (never client-supplied).
const ESCROW_FEE_PERCENT = Number(envRaw("ESCROW_FEE_PERCENT")) || 5;
const ESCROW_FEE_MIN_USD = Number(envRaw("ESCROW_FEE_MIN_USD")) || 10;
// Smallest deal we escrow (USD). Below this the fee floor dominates the economics.
const ESCROW_MIN_DEAL_USD = Number(envRaw("ESCROW_MIN_DEAL_USD")) || 30;
// Auto-release presets offered to merchants (days). Any other value clamps to the default.
const ESCROW_AUTO_RELEASE_PRESETS = [3, 5, 7, 14];
const ESCROW_AUTO_RELEASE_DEFAULT = 3;
const clampAutoReleaseDays = (v: unknown): number => {
  const n = Math.round(Number(v));
  return ESCROW_AUTO_RELEASE_PRESETS.includes(n) ? n : ESCROW_AUTO_RELEASE_DEFAULT;
};

const otpKey = (escrowId: number | string, email: string) => `escrow:otp:${escrowId}:${norm(email)}`;
const sessionKey = (tok: string) => `escrow:session:${tok}`;
const emailDisabled = () => String(envRaw("DISABLE_OUTBOUND_EMAIL") || "").toLowerCase() === "true";

const frontendBase = (): string =>
  (envRaw("SERVER_URL") || envRaw("FRONTEND_URL") || envRaw("CHECKOUT_URL") || "").trim().replace(/\/$/, "");
/** SafeDeal public base (prod: https://safedeal.sh; preview: <dynopay>/safedeal). */
const safedealBase = (): string => (envRaw("SAFEDEAL_URL") || `${frontendBase()}/safedeal`).trim().replace(/\/$/, "");
const inviteUrl = (token: string): string => `${frontendBase()}/escrow/invite/${token}`;
/** Where a party opens this deal — SafeDeal deals live on the SafeDeal site. */
const dealUrl = (deal: any): string =>
  deal?.source === "safedeal" ? `${safedealBase()}/deal/${deal.deal_token}` : dealUrl(deal);
const isSafeDeal = (deal: any): boolean => deal?.source === "safedeal";
const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase();

const getAuthUser = (res: express.Response): { user_id: number; email: string | null } => {
  const u = res.locals.user as PaymentUserJwtPayload;
  const authUser = res.locals.authUser as { email?: string | null } | undefined;
  return { user_id: Number(u?.user_id), email: (authUser?.email ?? null) as string | null };
};

interface ActorInfo {
  isCreator: boolean;
  isCounterparty: boolean;
  role: EscrowRole;
  label: string;
  signedIn: boolean; // true = authenticated Dynopay account (may reuse saved wallet)
}

function resolveAuthedActor(deal: any, auth: { user_id: number; email: string | null }): ActorInfo | null {
  const { creator, counterparty } = resolveRoles(deal.creator_role);
  const isCreator = Number(deal.creator_user_id) === Number(auth.user_id);
  const isCounterparty =
    (deal.counterparty_user_id && Number(deal.counterparty_user_id) === Number(auth.user_id)) ||
    (!!auth.email && norm(deal.counterparty_email) === norm(auth.email));
  if (isCreator) return { isCreator: true, isCounterparty: false, role: creator, label: auth.email || `user:${auth.user_id}`, signedIn: true };
  if (isCounterparty) return { isCreator: false, isCounterparty: true, role: counterparty, label: auth.email || `user:${auth.user_id}`, signedIn: true };
  return null;
}

/** Build the counterparty actor from a verified escrow session token (OTP path). */
async function resolvePublicActor(req: express.Request, deal: any): Promise<ActorInfo> {
  const tok = (req.headers["x-escrow-token"] as string) || (req.body && req.body.escrow_session);
  if (!tok) fail(401, "Please verify your email to continue — request a code first.");
  const sess: any = await getRedisItem(sessionKey(String(tok)));
  if (!sess) fail(401, "Your verification session expired. Please request a new code.");
  if (Number(sess.escrow_id) !== Number(deal.escrow_id) || norm(sess.email) !== norm(deal.counterparty_email)) {
    fail(403, "This verification does not match the invitation.");
  }
  const { counterparty } = resolveRoles(deal.creator_role);
  return { isCreator: false, isCounterparty: true, role: counterparty, label: String(sess.email), signedIn: false };
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

async function hasAccount(email: string): Promise<boolean> {
  try {
    const u = await userModel.findOne({ where: { email: String(email) }, attributes: ["user_id"] });
    return !!u;
  } catch {
    return false;
  }
}

function serializeDeal(deal: any, includePrivate = true): Record<string, unknown> {
  const d = deal.dataValues ? deal.dataValues : deal;
  const breakdown = computeFeeBreakdown({ amount: d.amount, currency: d.currency, feePercent: d.fee_percent, feeMinUsd: d.fee_min_usd, feePayer: d.fee_payer, payoutCoin: d.seller_payout_coin, fundingCoin: d.funding_coin, acceptedCoins: d.accepted_coins });
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
    simulated: d.simulated,
    invite_url: dealUrl(d),
    stablecoins: ESCROW_STABLECOINS,
    breakdown,
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
  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: deal.funding_coin, acceptedCoins: deal.accepted_coins });
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

  const summary = describeSettlement(amounts, deal.currency, true) + " (authorized)";
  deal.settlement_note = summary;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: `outcome_${outcome}`,
    actor: opts.actorLabel,
    role: opts.actorRole,
    note: summary,
    meta: { amounts, entitlement_stablecoin: deal.custody_stablecoin },
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
    const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: deal.funding_coin, acceptedCoins: deal.accepted_coins });
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
    if (deal.seller_payout_state === "pending") {
      deal.seller_payout_state = "paid";
      deal.seller_paid_at = now;
      deal.seller_payout_tx = `WALLET-CREDIT-${deal.escrow_id}`;
      deal.activity_log = appendActivity(deal.activity_log, {
        type: "payout_seller",
        actor: actorLabel,
        role: "system",
        note: `Credited ${deal.seller_entitlement_stable} USD to the seller's SafeDeal wallet.`,
      });
      sellerPaid = true;
    }
    if (deal.buyer_payout_state === "pending") {
      deal.buyer_payout_state = "paid";
      deal.buyer_paid_at = now;
      deal.buyer_payout_tx = `WALLET-CREDIT-${deal.escrow_id}`;
      deal.activity_log = appendActivity(deal.activity_log, {
        type: "payout_buyer",
        actor: actorLabel,
        role: "system",
        note: `Refunded ${deal.buyer_entitlement_stable} USD to the buyer's SafeDeal wallet (fees & costs kept).`,
      });
      buyerPaid = true;
    }
    deal.fully_paid_at = now;
    deal.needs_admin_review = false;
    await deal.save();
    // Opt-in auto-withdraw for whoever just got credited.
    const creditedIds = [
      sellerPaid ? (deal.creator_role === "seller" ? deal.creator_customer_id : deal.counterparty_customer_id) : null,
      buyerPaid && amounts.buyerRefund > 0 ? (deal.creator_role === "buyer" ? deal.creator_customer_id : deal.counterparty_customer_id) : null,
    ].filter(Boolean) as number[];
    for (const cid of creditedIds) void maybeAutoWithdraw(Number(cid));
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
      note: `[SIMULATED] Paid seller ${deal.seller_entitlement_stable} ${coin} to ${deal.seller_payout_address}.`,
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
      note: `[SIMULATED] Refunded buyer ${deal.buyer_entitlement_stable} ${coin} to ${deal.buyer_refund_address}.`,
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
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: actor.label,
    role: "buyer",
    note: `[SIMULATED] Buyer funded ${breakdown.buyerPays} ${deal.currency} in ${coin}; converted to ${breakdown.buyerPays} ${CUSTODY_STABLECOIN} held in custody.`,
    meta: { breakdown },
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
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: actor.label,
    role: "buyer",
    note: `Buyer paid ${breakdown.buyerPays} ${deal.currency} from their SafeDeal balance; held in escrow as ${CUSTODY_STABLECOIN}.`,
    meta: { breakdown },
  });
  await deal.save();
  const { sellerEmail } = await partyEmails(deal);
  if (sellerEmail) void sendEscrowFundedEmail(sellerEmail, sellerEmail, deal);
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
  deal.funding_method = "checkout";
  deal.funding_tx_hash = txHash;
  deal.funded_amount_usd = breakdown.buyerPays;
  deal.custody_stablecoin = CUSTODY_STABLECOIN;
  deal.custody_amount_stable = breakdown.buyerPays;
  deal.converted_at = now;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: "checkout",
    role: "buyer",
    note: `Buyer paid ${paidUsd} ${deal.currency} via hosted checkout in ${coin} (tx ${txHash}); ${breakdown.buyerPays} ${CUSTODY_STABLECOIN} held in custody.`,
    meta: { breakdown, paidUsd },
  });
  if (isSafeDeal(deal)) await recordFundingReceived(deal, breakdown.buyerPays, "checkout");
  await deal.save();
  const { sellerEmail } = await partyEmails(deal);
  if (sellerEmail) void sendEscrowFundedEmail(sellerEmail, sellerEmail, deal);
  return deal;
}

async function actDeliver(deal: any, actor: ActorInfo, note?: string): Promise<any> {
  if (actor.role !== "seller") fail(403, "Only the seller can mark a deal as delivered.");
  if (deal.status !== "funded") fail(409, `Cannot mark delivered from status '${deal.status}'.`);
  assertTransition(deal.status, "delivered");
  const now = new Date();
  deal.status = "delivered";
  deal.delivered_at = now;
  if (note) deal.delivery_note = String(note);
  deal.auto_release_at = new Date(now.getTime() + Number(deal.auto_release_days || 3) * 86400000);
  deal.activity_log = appendActivity(deal.activity_log, { type: "delivered", actor: actor.label, role: "seller", note: deal.delivery_note || "Marked as delivered." });
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

// ── dispute negotiation helpers + actions (two-tier: parties first, admin fallback) ─

function appendDisputeThread(deal: any, entry: Record<string, unknown>): void {
  const list = Array.isArray(deal.dispute_thread) ? deal.dispute_thread : [];
  deal.dispute_thread = [...list, { at: new Date().toISOString(), ...entry }];
}

function describeProposalShort(outcome: SettlementOutcome, splitPct?: number | null, kind?: string | null): string {
  if (kind === "cancellation") return "cancel the deal — full refund to the buyer (fees & costs kept)";
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
  appendDisputeThread(deal, { by: actor.role, type: "open", kind, outcome, split_percent_seller, message, reason: deal.dispute_reason || null });
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
  appendDisputeThread(deal, { by: actor.role, type: "counter", outcome, split_percent_seller, message });
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
      ? "Agreed to cancel the deal — buyer refunded minus escrow fee & costs."
      : `Accepted ${describeProposalShort(outcome, splitPct)} — resolved by agreement.`,
  });
  const { summary } = await settleOutcome(deal, outcome, { splitPercentSeller: splitPct, actorLabel: actor.label, actorRole: actor.role });
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const msg = kind === "cancellation" ? `Deal cancelled by mutual agreement — ${summary}` : `Resolved by agreement — ${summary}`;
  if (buyerEmail) void sendEscrowDisputeAgreedEmail(buyerEmail, buyerEmail, deal, msg);
  if (sellerEmail) void sendEscrowDisputeAgreedEmail(sellerEmail, sellerEmail, deal, msg);
  return deal;
}

/** Add a message / evidence note to the dispute thread (decision 5b). */
async function actDisputeMessage(deal: any, actor: ActorInfo, message?: string): Promise<any> {
  if (deal.status !== "disputed") fail(409, "There is no open dispute to add a message to.");
  const text = String(message || "").trim();
  if (!text) fail(400, "A message is required.");
  if (text.length > 2000) fail(400, "Message is too long (2000 characters max).");
  appendDisputeThread(deal, { by: actor.role, type: "message", message: text });
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

async function loadAuthedDealActor(req: express.Request, res: express.Response): Promise<{ deal: any; actor: ActorInfo }> {
  const auth = getAuthUser(res);
  const deal: any = await escrowDealModel.findByPk(Number(req.params.id));
  if (!deal) fail(404, "Escrow deal not found.");
  const actor = resolveAuthedActor(deal, auth);
  if (!actor) fail(403, "You are not a participant in this deal.");
  return { deal, actor };
}

// ═══════════════════════════════════════════════════════════════════════════
// MERCHANT (authenticated) endpoints
// ═══════════════════════════════════════════════════════════════════════════

const previewFee = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, currency, fee_payer, payout_coin, accepted_coins } = req.body || {};
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "A positive 'amount' is required.");
    void refreshEscrowCostRates(); // best-effort live rates; static estimates used until it lands
    // Escrow fee % is admin-controlled (env) — never taken from the client.
    const breakdown = computeFeeBreakdown({ amount, currency, feePercent: ESCROW_FEE_PERCENT, feeMinUsd: ESCROW_FEE_MIN_USD, feePayer: fee_payer, payoutCoin: payout_coin, acceptedCoins: accepted_coins });
    return successResponseHelper(res, 200, "Fee breakdown computed.", {
      ...breakdown,
      minDealUsd: ESCROW_MIN_DEAL_USD,
      belowMinimum: Number(amount) < ESCROW_MIN_DEAL_USD,
    });
  } catch (e) {
    return handle(res, e, "previewFee");
  }
};

const createDeal = async (req: express.Request, res: express.Response) => {
  try {
    const auth = getAuthUser(res);
    const {
      company_id, title, description, amount, currency = "USD", accepted_coins, terms,
      counterparty_email, creator_role = "seller",
      fee_payer = "buyer", auto_release_days = ESCROW_AUTO_RELEASE_DEFAULT, send_invite = true,
    } = req.body || {};

    if (!company_id) return errorResponseHelper(res, 400, "company_id is required.");
    if (!title || String(title).trim().length < 2) return errorResponseHelper(res, 400, "A deal title is required.");
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "A positive amount is required.");
    if (Number(amount) < ESCROW_MIN_DEAL_USD) {
      return errorResponseHelper(res, 400, `The minimum escrow deal is $${ESCROW_MIN_DEAL_USD} (escrow fee ${ESCROW_FEE_PERCENT}%, min $${ESCROW_FEE_MIN_USD}).`);
    }
    if (!counterparty_email || !/.+@.+\..+/.test(String(counterparty_email))) return errorResponseHelper(res, 400, "A valid counterparty email is required.");
    if (!["buyer", "seller"].includes(String(creator_role))) return errorResponseHelper(res, 400, "creator_role must be 'buyer' or 'seller'.");
    if (!["buyer", "seller", "split"].includes(String(fee_payer))) return errorResponseHelper(res, 400, "fee_payer must be 'buyer', 'seller' or 'split'.");
    if (norm(counterparty_email) === norm(auth.email)) return errorResponseHelper(res, 400, "You cannot invite yourself as the counterparty.");

    const access = await validateCompanyOwnership(res, company_id, auth.user_id, "manage_payment_links");
    if (!access) return;

    const status = send_invite ? "invited" : "draft";
    const deal_token = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const deal: any = await escrowDealModel.create({
      deal_token,
      company_id: Number(company_id),
      creator_user_id: auth.user_id,
      creator_role,
      counterparty_email: String(counterparty_email).trim(),
      title: String(title).trim(),
      description: description ? String(description) : null,
      amount: Number(amount),
      currency: String(currency).toUpperCase().slice(0, 10),
      accepted_coins: accepted_coins ? String(accepted_coins) : null,
      terms: terms ? String(terms) : null,
      // Escrow fee is admin-controlled via .env — client-sent values are ignored.
      fee_percent: ESCROW_FEE_PERCENT,
      fee_min_usd: ESCROW_FEE_MIN_USD,
      fee_payer,
      auto_release_days: clampAutoReleaseDays(auto_release_days),
      status,
      invited_at: send_invite ? now : null,
      activity_log: appendActivity([], {
        type: "created",
        actor: auth.email || `user:${auth.user_id}`,
        role: creator_role,
        note: send_invite ? "Deal created and counterparty invited." : "Deal drafted.",
      }),
    });

    if (send_invite) {
      const { creatorName } = await loadCreatorAndCompany(deal);
      const { counterparty } = resolveRoles(creator_role);
      void sendEscrowInviteEmail(deal.counterparty_email, deal.counterparty_email, deal, creatorName, counterparty, inviteUrl(deal_token));
    }
    return respond(res, deal, 201, "Escrow deal created.");
  } catch (e) {
    return handle(res, e, "createDeal");
  }
};

const listDeals = async (req: express.Request, res: express.Response) => {
  try {
    const auth = getAuthUser(res);
    const { company_id, status, role } = req.query as Record<string, string>;
    const participantOr: any[] = [{ creator_user_id: auth.user_id }];
    if (auth.email) participantOr.push({ counterparty_email: { [Op.iLike]: auth.email } });
    const where: any = { [Op.or]: participantOr };
    if (company_id) where.company_id = Number(company_id);
    if (status) where.status = status;

    const deals: any[] = await escrowDealModel.findAll({ where, order: [["created_at", "DESC"]], limit: 200 });
    let out = deals.map((d) => {
      const view = serializeDeal(d, false);
      const isCreator = Number(d.dataValues.creator_user_id) === Number(auth.user_id);
      const { creator, counterparty } = resolveRoles(d.dataValues.creator_role);
      (view as any).my_role = isCreator ? creator : counterparty;
      (view as any).is_creator = isCreator;
      return view;
    });
    if (role === "buyer" || role === "seller") out = out.filter((d: any) => d.my_role === role);
    return successResponseHelper(res, 200, "Escrow deals fetched.", out, out.length);
  } catch (e) {
    return handle(res, e, "listDeals");
  }
};

const getDeal = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    return respond(res, deal, 200, "Escrow deal fetched.", actor);
  } catch (e) {
    return handle(res, e, "getDeal");
  }
};

const setPayoutInfo = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actSetDestination(deal, actor, req.body || {});
    return respond(res, deal, 200, "Settlement details saved.", actor);
  } catch (e) {
    return handle(res, e, "setPayoutInfo");
  }
};

const markDelivered = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actDeliver(deal, actor, req.body?.delivery_note);
    return respond(res, deal, 200, "Deal marked as delivered.", actor);
  } catch (e) {
    return handle(res, e, "markDelivered");
  }
};

const confirmRelease = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actRelease(deal, actor);
    const msg = deal.seller_payout_state === "paid" ? "Funds released to seller." : "Release authorized — payout pending (seller must add a payout address).";
    return respond(res, deal, 200, msg, actor);
  } catch (e) {
    return handle(res, e, "confirmRelease");
  }
};

const raiseDispute = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actRaiseDispute(deal, actor, req.body || {});
    return respond(res, deal, 200, "Dispute opened — your proposal was sent to the counterparty.", actor);
  } catch (e) {
    return handle(res, e, "raiseDispute");
  }
};

const counterDispute = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actCounterDispute(deal, actor, req.body || {});
    return respond(res, deal, 200, "Counter-offer sent to the counterparty.", actor);
  } catch (e) {
    return handle(res, e, "counterDispute");
  }
};

const acceptDispute = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actAcceptDispute(deal, actor);
    return respond(res, deal, 200, "Proposal accepted — the dispute is resolved by agreement.", actor);
  } catch (e) {
    return handle(res, e, "acceptDispute");
  }
};

const disputeMessage = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actDisputeMessage(deal, actor, req.body?.message);
    return respond(res, deal, 200, "Message added to the dispute.", actor);
  } catch (e) {
    return handle(res, e, "disputeMessage");
  }
};

const escalateDispute = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actEscalateDispute(deal, actor);
    return respond(res, deal, 200, "Dispute escalated to a Dynopay admin.", actor);
  } catch (e) {
    return handle(res, e, "escalateDispute");
  }
};

const cancelDeal = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    const { requested } = await actCancel(deal, actor, req.body || {});
    return respond(
      res,
      deal,
      200,
      requested ? "Cancellation requested — the other party must agree before the buyer is refunded." : "Escrow deal cancelled (no charge).",
      actor
    );
  } catch (e) {
    return handle(res, e, "cancelDeal");
  }
};

const simulateFund = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    await actFund(deal, actor, req.body?.coin);
    return respond(res, deal, 200, "Escrow funded (SIMULATED — converted to stable, no real crypto moved).", actor);
  } catch (e) {
    return handle(res, e, "simulateFund");
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC (counterparty) endpoints — email OTP + session token
// ═══════════════════════════════════════════════════════════════════════════

const getPublicDeal = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token) } });
    if (!deal) return errorResponseHelper(res, 404, "Escrow invitation not found.");
    const { creator, counterparty } = resolveRoles(deal.creator_role);
    const { creatorName, companyName } = await loadCreatorAndCompany(deal);
    const view = serializeDeal(deal, false);
    (view as any).counterparty_role = counterparty;
    (view as any).creator_role_side = creator;
    (view as any).created_by = creatorName;
    (view as any).brand = companyName;
    (view as any).has_account = await hasAccount(deal.counterparty_email);
    return successResponseHelper(res, 200, "Escrow invitation fetched.", view);
  } catch (e) {
    return handle(res, e, "getPublicDeal");
  }
};

/** POST /api/escrow/public/:token/send-otp {email} */
const sendOtp = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token) } });
    if (!deal) return errorResponseHelper(res, 404, "Escrow invitation not found.");
    const { email } = req.body || {};
    if (!email || norm(email) !== norm(deal.counterparty_email)) {
      return errorResponseHelper(res, 403, "Please use the email address this invitation was sent to.");
    }
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setRedisItemWithTTL(otpKey(deal.escrow_id, email), { otp }, OTP_TTL);
    void sendEscrowOtpEmail(String(email), deal, otp);
    const payload: Record<string, unknown> = { has_account: await hasAccount(String(email)) };
    if (emailDisabled()) payload.preview_otp = otp; // preview only (outbound email disabled)
    return successResponseHelper(res, 200, "Verification code sent.", payload);
  } catch (e) {
    return handle(res, e, "sendOtp");
  }
};

/** POST /api/escrow/public/:token/verify-otp {email, otp} -> {escrow_session} */
const verifyOtp = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token) } });
    if (!deal) return errorResponseHelper(res, 404, "Escrow invitation not found.");
    const { email, otp } = req.body || {};
    if (!email || norm(email) !== norm(deal.counterparty_email)) return errorResponseHelper(res, 403, "Please use the invited email address.");
    const stored: any = await getRedisItem(otpKey(deal.escrow_id, email));
    if (!stored || String(stored.otp) !== String(otp)) return errorResponseHelper(res, 400, "Invalid or expired code. Request a new one.");
    await deleteRedisItem(otpKey(deal.escrow_id, email));
    const sessionToken = crypto.randomBytes(24).toString("hex");
    await setRedisItemWithTTL(sessionKey(sessionToken), { escrow_id: deal.escrow_id, email: norm(email) }, SESSION_TTL);
    if (!deal.counterparty_verified_at) {
      deal.counterparty_verified_at = new Date();
      try { await deal.save(); } catch { /* non-fatal */ }
    }
    return successResponseHelper(res, 200, "Email verified.", {
      escrow_session: sessionToken,
      expires_in: SESSION_TTL,
      has_account: await hasAccount(String(email)),
    });
  } catch (e) {
    return handle(res, e, "verifyOtp");
  }
};

/** POST /api/escrow/public/:token/respond {action:accept|decline, reason?} (x-escrow-token) */
const respondInvite = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token) } });
    if (!deal) return errorResponseHelper(res, 404, "Escrow invitation not found.");
    const { action, reason } = req.body || {};
    if (!["accept", "decline"].includes(String(action))) return errorResponseHelper(res, 400, "action must be 'accept' or 'decline'.");
    const actor = await resolvePublicActor(req, deal);
    if (action === "accept") {
      await actAccept(deal, actor);
      return respond(res, deal, 200, "Invitation accepted. The buyer can now fund the escrow.", actor, false);
    }
    await actDecline(deal, actor, reason);
    return respond(res, deal, 200, "Invitation declined.", actor, false);
  } catch (e) {
    return handle(res, e, "respondInvite");
  }
};

/**
 * POST /api/escrow/public/:token/action {action, ...} (x-escrow-token)
 * fund (buyer) | deliver (seller) | release (buyer) | dispute (either) |
 * payout-info (seller stable address / buyer refund address).
 */
const publicAction = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token) } });
    if (!deal) return errorResponseHelper(res, 404, "Escrow deal not found.");
    const actor = await resolvePublicActor(req, deal);
    switch (String(req.body?.action)) {
      case "fund":
        await actFund(deal, actor, req.body?.coin);
        return respond(res, deal, 200, "Escrow funded (SIMULATED — no real crypto moved).", actor, false);
      case "deliver":
        await actDeliver(deal, actor, req.body?.delivery_note);
        return respond(res, deal, 200, "Deal marked as delivered.", actor, false);
      case "release": {
        await actRelease(deal, actor);
        const msg = deal.seller_payout_state === "paid" ? "Funds released to seller." : "Release authorized — payout pending.";
        return respond(res, deal, 200, msg, actor, false);
      }
      case "dispute":
        await actRaiseDispute(deal, actor, req.body || {});
        return respond(res, deal, 200, "Dispute opened — your proposal was sent to the other party.", actor, false);
      case "cancel": {
        const { requested } = await actCancel(deal, actor, req.body || {});
        return respond(
          res,
          deal,
          200,
          requested ? "Cancellation requested — the other party must agree before the buyer is refunded." : "Deal cancelled (no charge).",
          actor,
          false
        );
      }
      case "dispute-counter":
        await actCounterDispute(deal, actor, req.body || {});
        return respond(res, deal, 200, "Counter-offer sent.", actor, false);
      case "dispute-accept":
        await actAcceptDispute(deal, actor);
        return respond(res, deal, 200, "Proposal accepted — the dispute is resolved by agreement.", actor, false);
      case "dispute-message":
        await actDisputeMessage(deal, actor, req.body?.message);
        return respond(res, deal, 200, "Message added to the dispute.", actor, false);
      case "dispute-escalate":
        await actEscalateDispute(deal, actor);
        return respond(res, deal, 200, "Dispute escalated to a Dynopay admin.", actor, false);
      case "payout-info": {
        // OTP-only party MUST paste an explicit address (no account-wallet reuse).
        if (actor.role === "seller" && !req.body?.payout_address) return errorResponseHelper(res, 400, "A stablecoin payout address is required.");
        if (actor.role === "buyer" && !req.body?.refund_address) return errorResponseHelper(res, 400, "A refund address is required.");
        await actSetDestination(deal, actor, req.body || {});
        const paid = actor.role === "seller" ? deal.seller_payout_state === "paid" : deal.buyer_payout_state === "paid";
        return respond(res, deal, 200, paid ? "Address saved — funds sent." : "Address saved.", actor, false);
      }
      default:
        return errorResponseHelper(res, 400, "Unknown action.");
    }
  } catch (e) {
    return handle(res, e, "publicAction");
  }
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
    const out = deals.map((d) => serializeDeal(d));
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
    const out = deals.map((d) => serializeDeal(d));
    return successResponseHelper(res, 200, "Dispute queue fetched.", out, out.length);
  } catch (e) {
    return handle(res, e, "adminDisputeQueue");
  }
};

/**
 * POST /api/escrow/admin/run-dispute-escalations — auto-escalate disputes whose
 * negotiation window elapsed with no agreement (decision 3b). Same maintenance-scan
 * pattern as run-auto-release; a scheduler calls it in production (jobs off in preview).
 */
const adminRunDisputeEscalations = async (_req: express.Request, res: express.Response) => {
  try {
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
  ESCROW_FEE_MIN_USD,
  ESCROW_MIN_DEAL_USD,
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
  actRaiseDispute,
  actCounterDispute,
  actAcceptDispute,
  actDisputeMessage,
  actEscalateDispute,
};
export type { ActorInfo };

export default {
  previewFee,
  createDeal,
  listDeals,
  getDeal,
  setPayoutInfo,
  markDelivered,
  confirmRelease,
  raiseDispute,
  counterDispute,
  acceptDispute,
  disputeMessage,
  escalateDispute,
  cancelDeal,
  simulateFund,
  getPublicDeal,
  sendOtp,
  verifyOtp,
  respondInvite,
  publicAction,
  adminListDeals,
  adminDisputeQueue,
  adminResolveDispute,
  adminRunAutoRelease,
  adminRunPayoutReminders,
  adminRunDisputeEscalations,
};
