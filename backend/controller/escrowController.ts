/**
 * Escrow controller — merchant dashboard, public counterparty (email-OTP), and
 * admin handlers.
 *
 * Counterparty model (v1): the invited party may NOT have a DynoPay account. They
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
import {
  sendEscrowInviteEmail,
  sendEscrowAcceptedEmail,
  sendEscrowDeclinedEmail,
  sendEscrowFundedEmail,
  sendEscrowDeliveredEmail,
  sendEscrowReleasedEmail,
  sendEscrowRefundedEmail,
  sendEscrowDisputeOpenedEmail,
  sendEscrowDisputeResolvedEmail,
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

const otpKey = (escrowId: number | string, email: string) => `escrow:otp:${escrowId}:${norm(email)}`;
const sessionKey = (tok: string) => `escrow:session:${tok}`;
const emailDisabled = () => String(envRaw("DISABLE_OUTBOUND_EMAIL") || "").toLowerCase() === "true";

const frontendBase = (): string =>
  (envRaw("SERVER_URL") || envRaw("FRONTEND_URL") || envRaw("CHECKOUT_URL") || "").trim().replace(/\/$/, "");
const inviteUrl = (token: string): string => `${frontendBase()}/escrow/invite/${token}`;
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
  signedIn: boolean; // true = authenticated DynoPay account (may reuse saved wallet)
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
  let creatorEmail = "";
  let creatorName = "there";
  let companyName = "DynoPay";
  try {
    const u: any = await userModel.findByPk(deal.creator_user_id, { attributes: ["user_id", "email", "first_name", "last_name"] });
    if (u) {
      creatorEmail = u.dataValues.email || "";
      creatorName = [u.dataValues.first_name, u.dataValues.last_name].filter(Boolean).join(" ") || creatorEmail || "there";
    }
  } catch { /* non-fatal */ }
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
  const breakdown = computeFeeBreakdown({ amount: d.amount, currency: d.currency, feePercent: d.fee_percent, feeMinUsd: d.fee_min_usd, feePayer: d.fee_payer });
  const settlement = deriveSettlement(d);
  const base: Record<string, unknown> = {
    escrow_id: d.escrow_id,
    deal_token: d.deal_token,
    company_id: d.company_id,
    creator_role: d.creator_role,
    counterparty_email: d.counterparty_email,
    counterparty_verified: !!d.counterparty_verified_at,
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
    invite_url: inviteUrl(d.deal_token),
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
  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer });
  const amounts = computeSettlementAmounts(breakdown, outcome, opts.splitPercentSeller);
  const nextStatus = outcomeToStatus(outcome);
  assertTransition(deal.status, nextStatus as any);

  const now = new Date();
  deal.status = nextStatus;
  deal.simulated = true;
  deal.outcome = outcome;
  deal.outcome_authorized_at = now;
  if (!deal.custody_stablecoin) deal.custody_stablecoin = DEFAULT_ESCROW_STABLECOIN;

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
  const url = inviteUrl(deal.deal_token);
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

async function actFund(deal: any, actor: ActorInfo, coinIn?: string): Promise<any> {
  if (isLiveSettlementEnabled()) fail(403, "Simulated funding is disabled when live settlement is on. Fund via the hosted checkout.");
  if (actor.role !== "buyer") fail(403, "Only the buyer funds the escrow.");
  if (deal.status !== "awaiting_payment") fail(409, `Cannot fund from status '${deal.status}'.`);
  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer });
  const coin = (coinIn ? String(coinIn) : (deal.accepted_coins || "USDT-TRC20").split(",")[0]).trim();
  const now = new Date();
  assertTransition(deal.status, "funded");
  deal.status = "funded";
  deal.funded_at = now;
  deal.simulated = true;
  deal.funding_coin = coin;
  deal.funding_crypto_amount = breakdown.buyerPays;
  deal.funded_amount_usd = breakdown.buyerPays;
  deal.funding_deposit_address = `SIMULATED-${crypto.randomBytes(8).toString("hex")}`;
  deal.funding_tx_hash = `SIMULATED-${crypto.randomBytes(16).toString("hex")}`;
  // Simulated sweep + convert-to-stable into pooled custody (per-deal ledger).
  deal.custody_stablecoin = DEFAULT_ESCROW_STABLECOIN;
  deal.custody_amount_stable = breakdown.buyerPays;
  deal.converted_at = now;
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funded",
    actor: actor.label,
    role: "buyer",
    note: `[SIMULATED] Buyer funded ${breakdown.buyerPays} ${deal.currency} in ${coin}; converted to ${breakdown.buyerPays} ${DEFAULT_ESCROW_STABLECOIN} held in custody.`,
    meta: { breakdown },
  });
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

async function actDispute(deal: any, actor: ActorInfo, reason?: string): Promise<any> {
  if (!["funded", "delivered"].includes(deal.status)) fail(409, `A dispute can only be raised on a funded or delivered deal (current: '${deal.status}').`);
  assertTransition(deal.status, "disputed");
  deal.status = "disputed";
  deal.disputed_at = new Date();
  deal.dispute_raised_by = actor.role;
  if (reason) deal.dispute_reason = String(reason);
  deal.auto_release_at = null;
  deal.activity_log = appendActivity(deal.activity_log, { type: "dispute_opened", actor: actor.label, role: actor.role, note: deal.dispute_reason || "Dispute opened." });
  await deal.save();
  const { buyerEmail, sellerEmail } = await partyEmails(deal);
  const otherEmail = actor.role === "buyer" ? sellerEmail : buyerEmail;
  if (otherEmail) void sendEscrowDisputeOpenedEmail(otherEmail, otherEmail, deal, actor.role, deal.dispute_reason || "");
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
    const { amount, currency, fee_percent, fee_min_usd, fee_payer } = req.body || {};
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "A positive 'amount' is required.");
    const breakdown = computeFeeBreakdown({ amount, currency, feePercent: fee_percent, feeMinUsd: fee_min_usd, feePayer: fee_payer });
    return successResponseHelper(res, 200, "Fee breakdown computed.", breakdown);
  } catch (e) {
    return handle(res, e, "previewFee");
  }
};

const createDeal = async (req: express.Request, res: express.Response) => {
  try {
    const auth = getAuthUser(res);
    const {
      company_id, title, description, amount, currency = "USD", accepted_coins, terms,
      counterparty_email, creator_role = "seller", fee_percent = 5, fee_min_usd = 1,
      fee_payer = "buyer", auto_release_days = 3, send_invite = true,
    } = req.body || {};

    if (!company_id) return errorResponseHelper(res, 400, "company_id is required.");
    if (!title || String(title).trim().length < 2) return errorResponseHelper(res, 400, "A deal title is required.");
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "A positive amount is required.");
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
      fee_percent: Number(fee_percent),
      fee_min_usd: Number(fee_min_usd),
      fee_payer,
      auto_release_days: Number(auto_release_days) || 3,
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
    await actDispute(deal, actor, req.body?.reason);
    return respond(res, deal, 200, "Dispute opened. A DynoPay admin will review it.", actor);
  } catch (e) {
    return handle(res, e, "raiseDispute");
  }
};

const cancelDeal = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadAuthedDealActor(req, res);
    if (!actor.isCreator) return errorResponseHelper(res, 403, "Only the creator can cancel this deal.");
    if (!["draft", "invited", "awaiting_payment"].includes(deal.status)) {
      return errorResponseHelper(res, 409, `A funded deal cannot be cancelled (current: '${deal.status}'). Use a refund/dispute instead.`);
    }
    assertTransition(deal.status, "cancelled");
    deal.status = "cancelled";
    deal.cancelled_at = new Date();
    deal.activity_log = appendActivity(deal.activity_log, { type: "cancelled", actor: actor.label, role: actor.role, note: req.body?.reason ? String(req.body.reason) : "Deal cancelled by creator." });
    await deal.save();
    return respond(res, deal, 200, "Escrow deal cancelled.", actor);
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
        await actDispute(deal, actor, req.body?.reason);
        return respond(res, deal, 200, "Dispute opened. A DynoPay admin will review it.", actor, false);
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

const adminDisputeQueue = async (_req: express.Request, res: express.Response) => {
  try {
    const deals: any[] = await escrowDealModel.findAll({ where: { status: "disputed" }, order: [["disputed_at", "ASC"]] });
    const out = deals.map((d) => serializeDeal(d));
    return successResponseHelper(res, 200, "Dispute queue fetched.", out, out.length);
  } catch (e) {
    return handle(res, e, "adminDisputeQueue");
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
        [Op.or]: [{ seller_payout_state: "pending" }, { buyer_payout_state: "pending" }],
      },
      limit: 300,
    });
    const reminded: number[] = [];
    const flagged: number[] = [];
    for (const deal of deals) {
      const { buyerEmail, sellerEmail } = await partyEmails(deal);
      const url = inviteUrl(deal.deal_token);
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

export default {
  previewFee,
  createDeal,
  listDeals,
  getDeal,
  setPayoutInfo,
  markDelivered,
  confirmRelease,
  raiseDispute,
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
};
