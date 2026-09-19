/**
 * SafeDeal controller — the standalone escrow product (safedeal.sh) running on
 * Dynopay's engine. Users are CUSTOMERS of the SafeDeal brand (tbl_customer under
 * SAFEDEAL_COMPANY_ID); they sign in with email + one-time code and get a
 * SafeDeal session (JWT). Deals reuse the escrow engine verbatim; settlement
 * lands in each party's SafeDeal wallet (customer wallet ledger).
 */
import { raw as envRaw } from "../utils/config";
import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { PaymentUserJwtPayload } from "../utils/types";
import escrowDealModel from "../models/escrowDealModel";
import { escrowEngine, ActorInfo } from "./escrowController";
import { EscrowRole, appendActivity, computeFeeBreakdown, isLiveSettlementEnabled, resolveRoles } from "./escrow/escrowShared";
import { ESCROW_PAYOUT_OPTIONS, refreshEscrowCostRates } from "../services/escrow/escrowCosts";
import { resolveCustomerForBrand, CustomerRow, CustomerWalletError } from "../services/customerWalletService";
import { getBalances, getStatement, statementToCsv, brandWalletTotals } from "../services/safedeal/safedealWallet";
import {
  MIN_WITHDRAWAL_USD,
  APPROVAL_THRESHOLD_USD,
  listAddresses,
  addAddress,
  removeAddress,
  quoteWithdrawal,
  requestWithdrawal,
  listWithdrawals,
  adminListWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} from "../services/safedeal/safedealWithdrawals";
import { createFundingLink } from "../services/safedeal/safedealCheckout";
import { sendSafeDealCodeEmail, sendSafeDealAddressAlertEmail } from "../services/email/safedealEmails";
import { sendEscrowInviteEmail } from "../services/email/escrowEmails";
import { companyModel, userWalletModel } from "../models";
import { getAdminWalletAddress } from "../utils/adminUtils";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const { EscrowError, fail } = escrowEngine;

const OTP_TTL = 600; // 10 min
const SESSION_DAYS = 7;
const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase();
const emailOk = (e: string) => /.+@.+\..+/.test(e);
const emailDisabled = () => String(envRaw("DISABLE_OUTBOUND_EMAIL") || "").toLowerCase() === "true";
const companyId = (): number => {
  const id = Number(envRaw("SAFEDEAL_COMPANY_ID"));
  if (!id) throw new EscrowError(503, "SafeDeal is not configured (SAFEDEAL_COMPANY_ID).");
  return id;
};
const secret = (): string => {
  const s = envRaw("ACCESS_TOKEN_SECRET");
  if (!s) throw new EscrowError(500, "Server auth secret missing.");
  return s;
};
const otpKey = (purpose: string, key: string) => `safedeal:${purpose}:${norm(key)}`;
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

export interface SafeDealSession {
  customer_id: number;
  company_id: number;
  email: string;
}

const handle = (res: express.Response, e: unknown, context: string) => {
  if (e instanceof EscrowError) return errorResponseHelper(res, e.code, e.message);
  if (e instanceof CustomerWalletError) return errorResponseHelper(res, e.statusCode, e.message);
  apiLogger.error(`[safedeal.${context}] ${(e as Error).message}`);
  return errorResponseHelper(res, 500, "Something went wrong. Please try again.");
};

// ── session middleware ───────────────────────────────────────────────────────

export const safedealAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const header = (req.headers["x-safedeal-token"] as string) || String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!header) return errorResponseHelper(res, 401, "Please sign in to continue.");
    const payload = jwt.verify(header, secret()) as any;
    if (!payload || payload.kind !== "safedeal") return errorResponseHelper(res, 401, "Please sign in to continue.");
    res.locals.sd = { customer_id: Number(payload.cid), company_id: Number(payload.coid), email: String(payload.email) } as SafeDealSession;
    return next();
  } catch {
    return errorResponseHelper(res, 401, "Your session has expired. Please sign in again.");
  }
};

const session = (res: express.Response): SafeDealSession => res.locals.sd as SafeDealSession;

async function customerFor(sess: SafeDealSession): Promise<CustomerRow> {
  return resolveCustomerForBrand({ companyId: sess.company_id, customerId: sess.customer_id });
}

async function ensureProfile(customer: CustomerRow): Promise<Record<string, any>> {
  const rows = await sequelize.query<Record<string, any>>(
    `INSERT INTO tbl_safedeal_profile (customer_id, company_id, last_login_at)
     VALUES (:cid, :coid, NOW())
     ON CONFLICT (customer_id) DO UPDATE SET last_login_at = NOW(), updated_at = NOW()
     RETURNING *`,
    { replacements: { cid: customer.customer_id, coid: customer.company_id }, type: QueryTypes.SELECT }
  );
  return rows[0];
}

async function loadProfile(customerId: number): Promise<Record<string, any> | null> {
  const rows = await sequelize.query<Record<string, any>>(`SELECT * FROM tbl_safedeal_profile WHERE customer_id = :id LIMIT 1`, {
    replacements: { id: customerId },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

/** Step-up: sensitive wallet actions need a fresh one-time code. */
async function requireStepUp(sess: SafeDealSession, code: unknown): Promise<void> {
  const stored: any = await getRedisItem(otpKey("stepup", String(sess.customer_id)));
  if (!stored || String(stored.code) !== String(code || "")) fail(400, "Invalid or expired confirmation code. Request a new one.");
  await deleteRedisItem(otpKey("stepup", String(sess.customer_id)));
}

// ── auth ─────────────────────────────────────────────────────────────────────

const sendCode = async (req: express.Request, res: express.Response) => {
  try {
    const email = norm(req.body?.email);
    if (!emailOk(email)) return errorResponseHelper(res, 400, "Enter a valid email address.");
    companyId();
    const code = genCode();
    await setRedisItemWithTTL(otpKey("signin", email), { code, attempts: 0 }, OTP_TTL);
    void sendSafeDealCodeEmail(email, code, "signin");
    const payload: Record<string, unknown> = { email, expires_in: OTP_TTL };
    if (emailDisabled()) payload.preview_code = code; // preview only (outbound email disabled)
    return successResponseHelper(res, 200, "We emailed you a sign-in code.", payload);
  } catch (e) {
    return handle(res, e, "sendCode");
  }
};

const verifyCode = async (req: express.Request, res: express.Response) => {
  try {
    const email = norm(req.body?.email);
    const code = String(req.body?.code || "").trim();
    if (!emailOk(email) || !code) return errorResponseHelper(res, 400, "Email and code are required.");
    const key = otpKey("signin", email);
    const stored: any = await getRedisItem(key);
    if (!stored) return errorResponseHelper(res, 400, "That code has expired. Request a new one.");
    if (String(stored.code) !== code) {
      const attempts = Number(stored.attempts || 0) + 1;
      if (attempts >= 5) await deleteRedisItem(key);
      else await setRedisItemWithTTL(key, { ...stored, attempts }, OTP_TTL);
      return errorResponseHelper(res, 400, "Incorrect code. Please check and try again.");
    }
    await deleteRedisItem(key);
    const customer = await resolveCustomerForBrand({ companyId: companyId(), email, createIfMissing: true });
    const profile = await ensureProfile(customer);
    // Link any deals this email was invited to / created.
    await escrowDealModel.update(
      { counterparty_customer_id: customer.customer_id, counterparty_verified_at: new Date() } as any,
      { where: { source: "safedeal", counterparty_email: { [Op.iLike]: email }, counterparty_customer_id: null } as any }
    );
    const token = jwt.sign({ kind: "safedeal", cid: customer.customer_id, coid: customer.company_id, email }, secret(), { expiresIn: `${SESSION_DAYS}d` });
    return successResponseHelper(res, 200, "Signed in.", {
      token,
      user: { email, customer_id: customer.customer_id, display_name: profile?.display_name || null },
    });
  } catch (e) {
    return handle(res, e, "verifyCode");
  }
};

const sendStepUp = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const code = genCode();
    await setRedisItemWithTTL(otpKey("stepup", String(sess.customer_id)), { code }, OTP_TTL);
    void sendSafeDealCodeEmail(sess.email, code, "stepup");
    const payload: Record<string, unknown> = { expires_in: OTP_TTL };
    if (emailDisabled()) payload.preview_code = code;
    return successResponseHelper(res, 200, "Confirmation code sent to your email.", payload);
  } catch (e) {
    return handle(res, e, "sendStepUp");
  }
};

const me = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const customer = await customerFor(sess);
    const [profile, balances, addresses] = await Promise.all([loadProfile(customer.customer_id), getBalances(customer.customer_id), listAddresses(customer.customer_id)]);
    return successResponseHelper(res, 200, "OK", {
      user: { email: customer.email, customer_id: customer.customer_id, display_name: profile?.display_name || null },
      wallet: balances,
      profile: {
        auto_withdraw: !!profile?.auto_withdraw,
        auto_withdraw_address_id: profile?.auto_withdraw_address_id || null,
      },
      addresses_count: addresses.length,
    });
  } catch (e) {
    return handle(res, e, "me");
  }
};

const updateProfile = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { auto_withdraw, auto_withdraw_address_id, display_name } = req.body || {};
    let addrId: number | null = null;
    if (auto_withdraw) {
      addrId = Number(auto_withdraw_address_id);
      const addrs = await listAddresses(sess.customer_id);
      if (!addrs.some((a) => a.address_id === addrId)) return errorResponseHelper(res, 400, "Pick a saved payout address for auto-withdraw.");
    }
    await sequelize.query(
      `UPDATE tbl_safedeal_profile SET auto_withdraw = :aw, auto_withdraw_address_id = :addr,
              display_name = COALESCE(:name, display_name), updated_at = NOW() WHERE customer_id = :cid`,
      {
        replacements: { aw: !!auto_withdraw, addr: addrId, name: display_name != null ? String(display_name).slice(0, 120) : null, cid: sess.customer_id },
        type: QueryTypes.UPDATE,
      }
    );
    return me(req, res);
  } catch (e) {
    return handle(res, e, "updateProfile");
  }
};

// ── config + fee preview (public) ────────────────────────────────────────────

const config = async (_req: express.Request, res: express.Response) => {
  return successResponseHelper(res, 200, "OK", {
    fee_percent: escrowEngine.ESCROW_FEE_PERCENT,
    fee_min_usd: escrowEngine.ESCROW_FEE_MIN_USD,
    min_deal_usd: escrowEngine.ESCROW_MIN_DEAL_USD,
    auto_release_presets: escrowEngine.ESCROW_AUTO_RELEASE_PRESETS,
    auto_release_default: escrowEngine.ESCROW_AUTO_RELEASE_DEFAULT,
    payout_options: ESCROW_PAYOUT_OPTIONS,
    min_withdrawal_usd: MIN_WITHDRAWAL_USD,
    withdrawal_approval_usd: APPROVAL_THRESHOLD_USD,
    live_settlement: isLiveSettlementEnabled(),
    dispute_auto_escalate_hours: Number(envRaw("ESCROW_DISPUTE_AUTO_ESCALATE_HOURS")) || 72,
  });
};

const feePreview = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, fee_payer, payout_coin } = req.body || {};
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "A positive amount is required.");
    void refreshEscrowCostRates();
    const breakdown = computeFeeBreakdown({ amount, currency: "USD", feePercent: escrowEngine.ESCROW_FEE_PERCENT, feeMinUsd: escrowEngine.ESCROW_FEE_MIN_USD, feePayer: fee_payer, payoutCoin: payout_coin });
    return successResponseHelper(res, 200, "Fee breakdown computed.", {
      ...breakdown,
      minDealUsd: escrowEngine.ESCROW_MIN_DEAL_USD,
      belowMinimum: Number(amount) < escrowEngine.ESCROW_MIN_DEAL_USD,
    });
  } catch (e) {
    return handle(res, e, "feePreview");
  }
};

// ── deals ────────────────────────────────────────────────────────────────────

function actorFor(deal: any, sess: SafeDealSession): ActorInfo | null {
  const { creator, counterparty } = resolveRoles(deal.creator_role);
  const email = norm(sess.email);
  if (norm(deal.creator_email) === email || (deal.creator_customer_id && Number(deal.creator_customer_id) === sess.customer_id)) {
    return { isCreator: true, isCounterparty: false, role: creator, label: sess.email, signedIn: true };
  }
  if (norm(deal.counterparty_email) === email || (deal.counterparty_customer_id && Number(deal.counterparty_customer_id) === sess.customer_id)) {
    return { isCreator: false, isCounterparty: true, role: counterparty, label: sess.email, signedIn: true };
  }
  return null;
}

async function loadDealActor(token: string, sess: SafeDealSession): Promise<{ deal: any; actor: ActorInfo }> {
  const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(token), source: "safedeal" } });
  if (!deal) fail(404, "Deal not found.");
  const actor = actorFor(deal, sess);
  if (!actor) fail(403, `This deal is between other parties. Sign in with the email that was invited (${maskEmail(deal.counterparty_email)}).`);
  // Link the counterparty's customer row the first time they open the deal.
  if (actor.isCounterparty && !deal.counterparty_customer_id) {
    deal.counterparty_customer_id = sess.customer_id;
    deal.counterparty_verified_at = deal.counterparty_verified_at || new Date();
    await deal.save();
  }
  return { deal, actor };
}

const maskEmail = (e: string) => {
  const [u, d] = String(e || "").split("@");
  if (!d) return "";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(2, u.length - 2))}@${d}`;
};

const view = (deal: any, actor?: ActorInfo) => {
  const v = escrowEngine.serializeDeal(deal, true) as Record<string, unknown>;
  if (actor) {
    v.my_role = actor.role;
    v.is_creator = actor.isCreator;
  }
  const { buyerEmail, sellerEmail } = partiesOf(deal);
  v.buyer_email = buyerEmail;
  v.seller_email = sellerEmail;
  return v;
};

const partiesOf = (deal: any) =>
  deal.creator_role === "buyer"
    ? { buyerEmail: deal.creator_email, sellerEmail: deal.counterparty_email }
    : { buyerEmail: deal.counterparty_email, sellerEmail: deal.creator_email };

const listDeals = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { status, role } = req.query as Record<string, string>;
    const email = norm(sess.email);
    const where: any = {
      source: "safedeal",
      company_id: sess.company_id,
      [Op.or]: [
        { creator_email: { [Op.iLike]: email } },
        { counterparty_email: { [Op.iLike]: email } },
        { creator_customer_id: sess.customer_id },
        { counterparty_customer_id: sess.customer_id },
      ],
    };
    if (status && status !== "all") {
      const groups: Record<string, string[]> = {
        open: ["invited", "awaiting_payment", "funded", "delivered", "disputed"],
        closed: ["completed", "refunded", "split", "cancelled", "declined", "expired"],
        action: ["invited", "awaiting_payment", "delivered", "disputed"],
      };
      where.status = groups[status] ? { [Op.in]: groups[status] } : status;
    }
    const deals: any[] = await escrowDealModel.findAll({ where, order: [["updated_at", "DESC"]], limit: 300 });
    const out = deals
      .map((d) => {
        const actor = actorFor(d, sess);
        return actor ? view(d, actor) : null;
      })
      .filter(Boolean)
      .filter((v: any) => !role || role === "all" || v.my_role === role);
    return successResponseHelper(res, 200, "Deals fetched.", out, out.length);
  } catch (e) {
    return handle(res, e, "listDeals");
  }
};

const createDeal = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const {
      title, description, amount, terms, counterparty_email, my_role = "seller",
      fee_payer = "buyer", auto_release_days = escrowEngine.ESCROW_AUTO_RELEASE_DEFAULT,
    } = req.body || {};
    if (!title || String(title).trim().length < 2) return errorResponseHelper(res, 400, "Give the deal a short title.");
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "Enter the deal amount.");
    if (Number(amount) < escrowEngine.ESCROW_MIN_DEAL_USD) {
      return errorResponseHelper(res, 400, `The minimum deal is $${escrowEngine.ESCROW_MIN_DEAL_USD} (escrow fee ${escrowEngine.ESCROW_FEE_PERCENT}%, min $${escrowEngine.ESCROW_FEE_MIN_USD}).`);
    }
    if (Number(amount) > 1000000) return errorResponseHelper(res, 400, "Deals above $1,000,000 need to be arranged with support.");
    if (!counterparty_email || !emailOk(String(counterparty_email))) return errorResponseHelper(res, 400, "Enter the other party's email.");
    if (!["buyer", "seller"].includes(String(my_role))) return errorResponseHelper(res, 400, "Your role must be buyer or seller.");
    if (!["buyer", "seller", "split"].includes(String(fee_payer))) return errorResponseHelper(res, 400, "fee_payer must be buyer, seller or split.");
    if (norm(counterparty_email) === norm(sess.email)) return errorResponseHelper(res, 400, "You can't invite yourself as the other party.");

    const customer = await customerFor(sess);
    const now = new Date();
    const deal: any = await escrowDealModel.create({
      deal_token: crypto.randomBytes(24).toString("hex"),
      company_id: sess.company_id,
      creator_user_id: null,
      source: "safedeal",
      creator_email: customer.email || sess.email,
      creator_customer_id: customer.customer_id,
      creator_role: my_role,
      counterparty_email: String(counterparty_email).trim(),
      title: String(title).trim().slice(0, 255),
      description: description ? String(description).slice(0, 5000) : null,
      amount: Number(amount),
      currency: "USD",
      accepted_coins: null,
      terms: terms ? String(terms).slice(0, 10000) : null,
      fee_percent: escrowEngine.ESCROW_FEE_PERCENT,
      fee_min_usd: escrowEngine.ESCROW_FEE_MIN_USD,
      fee_payer,
      auto_release_days: escrowEngine.clampAutoReleaseDays(auto_release_days),
      status: "invited",
      invited_at: now,
      activity_log: appendActivity([], { type: "created", actor: sess.email, role: my_role, note: "Deal created on SafeDeal and the other party invited." }),
    } as any);
    // If the counterparty already has a SafeDeal account, link them right away.
    try {
      const cp = await resolveCustomerForBrand({ companyId: sess.company_id, email: deal.counterparty_email, createIfMissing: false });
      deal.counterparty_customer_id = cp.customer_id;
      await deal.save();
    } catch { /* not a customer yet — linked on first sign-in */ }
    const { counterparty } = resolveRoles(my_role as EscrowRole);
    void sendEscrowInviteEmail(deal.counterparty_email, deal.counterparty_email, deal, sess.email, counterparty, escrowEngine.dealUrl(deal));
    return successResponseHelper(res, 201, "Deal created — invite sent.", view(deal, actorFor(deal, sess)!));
  } catch (e) {
    return handle(res, e, "createDeal");
  }
};

/** Public preview of an invite link (no session): enough to decide to sign in. */
const previewDeal = async (req: express.Request, res: express.Response) => {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token), source: "safedeal" } });
    if (!deal) return errorResponseHelper(res, 404, "Deal not found.");
    const { buyerEmail, sellerEmail } = partiesOf(deal);
    const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin });
    return successResponseHelper(res, 200, "OK", {
      deal_token: deal.deal_token,
      title: deal.title,
      amount: Number(deal.amount),
      currency: deal.currency,
      status: deal.status,
      creator_role: deal.creator_role,
      fee_payer: deal.fee_payer,
      auto_release_days: deal.auto_release_days,
      buyer_email_masked: maskEmail(buyerEmail),
      seller_email_masked: maskEmail(sellerEmail),
      counterparty_email_masked: maskEmail(deal.counterparty_email),
      counterparty_email_hint: deal.counterparty_email, // the invite is a bearer link — the invitee needs to know which inbox to use
      buyer_pays: breakdown.buyerPays,
      seller_receives: breakdown.sellerReceives,
      created_at: deal.created_at,
    });
  } catch (e) {
    return handle(res, e, "previewDeal");
  }
};

const getDeal = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadDealActor(req.params.token, session(res));
    const v = view(deal, actor);
    if (actor.role === "buyer" && deal.status === "awaiting_payment") {
      const cid = deal.creator_role === "buyer" ? deal.creator_customer_id : deal.counterparty_customer_id;
      if (cid) (v as any).buyer_balance = await getBalances(Number(cid));
    }
    return successResponseHelper(res, 200, "OK", v);
  } catch (e) {
    return handle(res, e, "getDeal");
  }
};

const dealAction = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { deal, actor } = await loadDealActor(req.params.token, sess);
    const body = req.body || {};
    const action = String(body.action || "");
    let msg = "Done.";
    switch (action) {
      case "accept":
        await escrowEngine.actAccept(deal, actor);
        msg = "You accepted the deal. The buyer can now fund the escrow.";
        break;
      case "decline":
        await escrowEngine.actDecline(deal, actor, body.reason);
        msg = "You declined the deal.";
        break;
      case "cancel": {
        const { requested } = await escrowEngine.actCancel(deal, actor, body);
        msg = requested ? "Cancellation requested — the other party must agree before the buyer is refunded." : "Deal cancelled (no charge).";
        break;
      }
      case "fund":
        if (isLiveSettlementEnabled()) fail(400, "Use the hosted checkout or your balance to fund this deal.");
        await escrowEngine.actFund(deal, actor, body.coin);
        msg = "Escrow funded (simulated). The seller has been notified.";
        break;
      case "fund-balance":
        await escrowEngine.actFundFromBalance(deal, actor);
        msg = "Paid from your balance — the escrow is funded.";
        break;
      case "checkout": {
        if (actor.role !== "buyer") fail(403, "Only the buyer funds the escrow.");
        if (deal.status !== "awaiting_payment") fail(409, `Cannot fund from status '${deal.status}'.`);
        const link = await createFundingLink(deal, sess.email);
        return successResponseHelper(res, 200, "Checkout ready.", { ...view(deal, actor), checkout: link });
      }
      case "deliver":
        await escrowEngine.actDeliver(deal, actor, body.delivery_note);
        msg = "Marked as delivered. The buyer has been asked to confirm.";
        break;
      case "release":
        await escrowEngine.actRelease(deal, actor);
        msg = "Funds released to the seller's SafeDeal wallet.";
        break;
      case "dispute":
        await escrowEngine.actRaiseDispute(deal, actor, body);
        msg = "Dispute opened — your proposal was sent to the other party.";
        break;
      case "dispute-counter":
        await escrowEngine.actCounterDispute(deal, actor, body);
        msg = "Counter-offer sent.";
        break;
      case "dispute-accept":
        await escrowEngine.actAcceptDispute(deal, actor);
        msg = "Agreed — the deal has been settled.";
        break;
      case "dispute-message":
        await escrowEngine.actDisputeMessage(deal, actor, body.message);
        msg = "Message added.";
        break;
      case "dispute-escalate":
        await escrowEngine.actEscalateDispute(deal, actor);
        msg = "Escalated to Dynopay — an admin will review and decide.";
        break;
      default:
        return errorResponseHelper(res, 400, `Unknown action '${action}'.`);
    }
    await deal.reload();
    return successResponseHelper(res, 200, msg, view(deal, actor));
  } catch (e) {
    return handle(res, e, "dealAction");
  }
};

// ── wallet ───────────────────────────────────────────────────────────────────

const wallet = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const [balances, addresses, withdrawals, profile] = await Promise.all([
      getBalances(sess.customer_id),
      listAddresses(sess.customer_id),
      listWithdrawals(sess.customer_id, 20),
      loadProfile(sess.customer_id),
    ]);
    return successResponseHelper(res, 200, "OK", {
      ...balances,
      wallet: balances,
      addresses,
      withdrawals,
      profile: { auto_withdraw: !!profile?.auto_withdraw, auto_withdraw_address_id: profile?.auto_withdraw_address_id || null },
      limits: { min_withdrawal_usd: MIN_WITHDRAWAL_USD, approval_threshold_usd: APPROVAL_THRESHOLD_USD },
      payout_options: ESCROW_PAYOUT_OPTIONS,
    });
  } catch (e) {
    return handle(res, e, "wallet");
  }
};

const statement = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { from, to, limit } = req.query as Record<string, string>;
    const rows = await getStatement([sess.customer_id], { from: from || null, to: to || null, limit: Number(limit) || 200 });
    const balances = await getBalances(sess.customer_id);
    return successResponseHelper(res, 200, "OK", { wallet: balances, entries: rows }, rows.length);
  } catch (e) {
    return handle(res, e, "statement");
  }
};

const statementCsv = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { from, to } = req.query as Record<string, string>;
    const rows = await getStatement([sess.customer_id], { from: from || null, to: to || null, limit: 2000 });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="safedeal-statement-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(statementToCsv(rows));
  } catch (e) {
    return handle(res, e, "statementCsv");
  }
};

const addresses = async (_req: express.Request, res: express.Response) => {
  try {
    const rows = await listAddresses(session(res).customer_id);
    return successResponseHelper(res, 200, "OK", rows, rows.length);
  } catch (e) {
    return handle(res, e, "addresses");
  }
};

const createAddress = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    await requireStepUp(sess, req.body?.code);
    const customer = await customerFor(sess);
    const row = await addAddress(customer, { payout_key: req.body?.payout_key, address: req.body?.address, label: req.body?.label });
    const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === row.payout_key);
    void sendSafeDealAddressAlertEmail(sess.email, "added", `${row.label ? `${row.label} · ` : ""}${opt?.label || row.payout_key}`, row.address);
    return successResponseHelper(res, 201, "Payout address saved.", row);
  } catch (e) {
    return handle(res, e, "createAddress");
  }
};

const deleteAddress = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    await requireStepUp(sess, req.body?.code);
    const row = await removeAddress(sess.customer_id, Number(req.params.id));
    const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === row.payout_key);
    void sendSafeDealAddressAlertEmail(sess.email, "removed", `${row.label ? `${row.label} · ` : ""}${opt?.label || row.payout_key}`, row.address);
    return successResponseHelper(res, 200, "Payout address removed.", row);
  } catch (e) {
    return handle(res, e, "deleteAddress");
  }
};

const withdrawQuote = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { address_id, payout_key, amount } = req.body || {};
    let key = payout_key;
    if (address_id) {
      const addrs = await listAddresses(sess.customer_id);
      key = addrs.find((a) => a.address_id === Number(address_id))?.payout_key || key;
    }
    if (!key) return errorResponseHelper(res, 400, "Choose a payout address.");
    const q = quoteWithdrawal(String(key), Number(amount || 0));
    const bal = await getBalances(sess.customer_id);
    return successResponseHelper(res, 200, "OK", { ...q, available: bal.available, requires_approval: q.amount > APPROVAL_THRESHOLD_USD });
  } catch (e) {
    return handle(res, e, "withdrawQuote");
  }
};

const withdraw = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    await requireStepUp(sess, req.body?.code);
    const customer = await customerFor(sess);
    const w = await requestWithdrawal(customer, { address_id: Number(req.body?.address_id), amount: Number(req.body?.amount) });
    const msg =
      w.status === "sent"
        ? `Withdrawal sent${w.simulated ? " (simulated)" : ""}.`
        : w.status === "pending_approval"
        ? `Withdrawals above $${APPROVAL_THRESHOLD_USD} are reviewed by our team first — you'll get an email once it's sent.`
        : "Withdrawal queued.";
    return successResponseHelper(res, 201, msg, { withdrawal: w, wallet: await getBalances(sess.customer_id) });
  } catch (e) {
    return handle(res, e, "withdraw");
  }
};

const withdrawals = async (_req: express.Request, res: express.Response) => {
  try {
    const rows = await listWithdrawals(session(res).customer_id, 100);
    return successResponseHelper(res, 200, "OK", rows, rows.length);
  } catch (e) {
    return handle(res, e, "withdrawals");
  }
};

// ── Dynopay admin (ops): withdrawal approvals ────────────────────────────────

const adminWithdrawals = async (req: express.Request, res: express.Response) => {
  try {
    const { status, company_id } = req.query as Record<string, string>;
    const rows = await adminListWithdrawals({ status: status || null, companyId: company_id ? Number(company_id) : null });
    return successResponseHelper(res, 200, "OK", rows, rows.length);
  } catch (e) {
    return handle(res, e, "adminWithdrawals");
  }
};

const adminApproveWithdrawal = async (req: express.Request, res: express.Response) => {
  try {
    const admin = (res.locals.user as any)?.email || "admin";
    const w = await approveWithdrawal(Number(req.params.id), String(admin));
    return successResponseHelper(res, 200, "Withdrawal approved and sent.", w);
  } catch (e) {
    return handle(res, e, "adminApproveWithdrawal");
  }
};

const adminRejectWithdrawal = async (req: express.Request, res: express.Response) => {
  try {
    const admin = (res.locals.user as any)?.email || "admin";
    const w = await rejectWithdrawal(Number(req.params.id), String(admin), String(req.body?.reason || ""));
    return successResponseHelper(res, 200, "Withdrawal rejected — funds returned to the customer.", w);
  } catch (e) {
    return handle(res, e, "adminRejectWithdrawal");
  }
};

// ── Dynopay admin (ops): production readiness of the SafeDeal brand ─────────

const FUNDING_COINS = ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "SOL", "XRP", "POLYGON", "USDT-POLYGON"];
const maskAddr = (a?: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "");

const adminReadiness = async (_req: express.Request, res: express.Response) => {
  try {
    const cid = Number(envRaw("SAFEDEAL_COMPANY_ID")) || 0;
    const live = isLiveSettlementEnabled();
    const safedealUrl = (envRaw("SAFEDEAL_URL") || "").trim();
    const brand: any = cid ? await companyModel.findByPk(cid) : null;
    const b = brand?.dataValues || null;
    const wallets = cid
      ? await userWalletModel.findAll({ where: { company_id: cid, wallet_type: { [Op.in]: FUNDING_COINS }, wallet_address: { [Op.not]: null } } as any, attributes: ["wallet_type", "wallet_address"] })
      : [];
    const configured = wallets.map((w: any) => ({ coin: String(w.dataValues.wallet_type), address: String(w.dataValues.wallet_address) }));
    const custodyCoins = configured.filter((w) => {
      const admin = getAdminWalletAddress(w.coin);
      return admin && admin.toLowerCase() === w.address.toLowerCase();
    });
    const [totals, pending, stats] = await Promise.all([
      cid ? brandWalletTotals(cid) : Promise.resolve(null),
      cid ? adminListWithdrawals({ status: "pending_approval", companyId: cid }, 500) : Promise.resolve([]),
      cid
        ? sequelize.query<Record<string, string>>(
            `SELECT COUNT(*) AS deals, COUNT(*) FILTER (WHERE status IN ('funded','delivered','disputed')) AS active,
                    COUNT(*) FILTER (WHERE status = 'disputed') AS disputed, COALESCE(SUM(custody_amount_stable) FILTER (WHERE status IN ('funded','delivered','disputed')),0) AS in_custody
               FROM tbl_escrow_deal WHERE source = 'safedeal' AND company_id = :cid`,
            { replacements: { cid }, type: QueryTypes.SELECT }
          ).then((r) => r[0])
        : Promise.resolve(null),
    ]);
    const checks = [
      { key: "brand", ok: !!b, label: "SafeDeal brand configured", detail: b ? `SAFEDEAL_COMPANY_ID=${cid} → "${b.company_name}" (owner user ${b.user_id})` : "Set SAFEDEAL_COMPANY_ID to the SafeDeal brand's company_id." },
      { key: "url", ok: !!safedealUrl && (!live || /^https:\/\/(www\.)?safedeal\.sh/.test(safedealUrl)), label: "Public URL (invite links, emails, checkout redirect)", detail: safedealUrl ? `SAFEDEAL_URL=${safedealUrl}${live && !/safedeal\.sh/.test(safedealUrl) ? " — live mode should point at https://safedeal.sh" : ""}` : "SAFEDEAL_URL is not set; links fall back to <FRONTEND_URL>/safedeal." },
      { key: "live", ok: true, warn: !live, label: live ? "Live settlement ON — real money moves" : "Live settlement OFF — funding & withdrawals are simulated", detail: `ESCROW_LIVE_SETTLEMENT=${live ? "true" : "false"}` },
      { key: "wallets", ok: configured.length > 0, label: "Checkout coins on the SafeDeal brand", detail: configured.length ? `${configured.length} coin(s): ${configured.map((w) => w.coin).join(", ")}` : "No crypto wallets on the brand — 'Pay with crypto' (hosted checkout) cannot create a payment link. Add wallets to brand " + cid + " in the Dynopay dashboard." },
      { key: "custody", ok: configured.length > 0 && custodyCoins.length === configured.length, warn: configured.length > 0 && custodyCoins.length !== configured.length, label: "Brand wallets point at Dynopay custody", detail: configured.length ? `${custodyCoins.length}/${configured.length} brand wallets match the platform custody address for their coin. Buyer payments forward to these addresses — they must be Dynopay-controlled (Binance deposit), never a third party.` : "Add wallets first." },
      { key: "autoconvert", ok: !!b?.auto_convert_enabled, warn: !b?.auto_convert_enabled, label: "Auto-convert volatile coins to stablecoin", detail: b?.auto_convert_enabled ? `${b.settlement_currency} on ${b.settlement_chain} → ${maskAddr(b.settlement_wallet_address)}` : "Off — BTC/ETH funding would stay volatile instead of being converted to USDT custody. Enable auto-convert on the brand (Settings → Payouts)." },
      { key: "fees", ok: escrowEngine.ESCROW_FEE_PERCENT > 0 && escrowEngine.ESCROW_FEE_MIN_USD > 0 && escrowEngine.ESCROW_MIN_DEAL_USD >= escrowEngine.ESCROW_FEE_MIN_USD, label: "Fee & minimums", detail: `fee ${escrowEngine.ESCROW_FEE_PERCENT}% (min $${escrowEngine.ESCROW_FEE_MIN_USD}) · min deal $${escrowEngine.ESCROW_MIN_DEAL_USD} · min withdrawal $${MIN_WITHDRAWAL_USD} · approval above $${APPROVAL_THRESHOLD_USD}` },
      { key: "email", ok: true, warn: emailDisabled(), label: emailDisabled() ? "Outbound email OFF — codes are shown in the UI instead" : "Outbound email ON", detail: `DISABLE_OUTBOUND_EMAIL=${emailDisabled() ? "true" : "false"}` },
    ];
    return successResponseHelper(res, 200, "OK", {
      ready: checks.every((c) => c.ok),
      live_settlement: live,
      safedeal_url: safedealUrl || null,
      brand: b ? { company_id: cid, name: b.company_name, owner_user_id: Number(b.user_id), auto_convert: { enabled: !!b.auto_convert_enabled, currency: b.settlement_currency || null, chain: b.settlement_chain || null, address: maskAddr(b.settlement_wallet_address) || null } } : null,
      wallets: configured.map((w) => ({ coin: w.coin, address: maskAddr(w.address), custody: custodyCoins.some((c) => c.coin === w.coin) })),
      totals: totals ? { ...totals, pending_approvals: pending.length } : null,
      deals: stats ? { count: Number(stats.deals || 0), active: Number(stats.active || 0), disputed: Number(stats.disputed || 0), in_custody: Number(stats.in_custody || 0) } : null,
      checks,
    });
  } catch (e) {
    return handle(res, e, "adminReadiness");
  }
};

// ── Dynopay brand owner (dashboard): totals + per-customer statement ─────────

const brandUser = (res: express.Response) => {
  const u = res.locals.user as PaymentUserJwtPayload;
  return Number(u?.user_id);
};

const brandTotals = async (req: express.Request, res: express.Response) => {
  try {
    const cid = Number(req.params.companyId);
    const access = await validateCompanyOwnership(res, cid, brandUser(res));
    if (!access) return;
    const totals = await brandWalletTotals(cid);
    const pending = await adminListWithdrawals({ status: "pending_approval", companyId: cid }, 50);
    return successResponseHelper(res, 200, "OK", { ...totals, pending_approvals: pending.length, is_safedeal_brand: cid === Number(envRaw("SAFEDEAL_COMPANY_ID")) });
  } catch (e) {
    return handle(res, e, "brandTotals");
  }
};

const brandCustomerStatement = async (req: express.Request, res: express.Response) => {
  try {
    const cid = Number(req.params.companyId);
    const access = await validateCompanyOwnership(res, cid, brandUser(res));
    if (!access) return;
    const customer = await resolveCustomerForBrand({ companyId: cid, customerId: Number(req.params.customerId) });
    const { from, to, limit, format } = req.query as Record<string, string>;
    const rows = await getStatement([customer.customer_id], { from: from || null, to: to || null, limit: format === "csv" ? 2000 : Number(limit) || 200 });
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="customer-${customer.customer_id}-statement.csv"`);
      return res.status(200).send(statementToCsv(rows));
    }
    const balances = await getBalances(customer.customer_id);
    const [dealStats] = await sequelize.query<Record<string, string>>(
      `SELECT COUNT(*) AS deals, COALESCE(SUM(amount),0) AS volume,
              COUNT(*) FILTER (WHERE status IN ('funded','delivered','disputed')) AS active
         FROM tbl_escrow_deal WHERE source = 'safedeal' AND (creator_customer_id = :id OR counterparty_customer_id = :id)`,
      { replacements: { id: customer.customer_id }, type: QueryTypes.SELECT }
    );
    const wds = await listWithdrawals(customer.customer_id, 20);
    const addrs = await listAddresses(customer.customer_id);
    return successResponseHelper(res, 200, "OK", {
      customer: { customer_id: customer.customer_id, email: customer.email, name: customer.customer_name },
      wallet: balances,
      deals: { count: Number(dealStats?.deals || 0), volume: Number(dealStats?.volume || 0), active: Number(dealStats?.active || 0) },
      entries: rows,
      withdrawals: wds,
      addresses: addrs.map((a) => ({ address_id: a.address_id, payout_key: a.payout_key, address: a.address, label: a.label })),
    });
  } catch (e) {
    return handle(res, e, "brandCustomerStatement");
  }
};

export default {
  sendCode,
  verifyCode,
  sendStepUp,
  me,
  updateProfile,
  config,
  feePreview,
  listDeals,
  createDeal,
  previewDeal,
  getDeal,
  dealAction,
  wallet,
  statement,
  statementCsv,
  addresses,
  createAddress,
  deleteAddress,
  withdrawQuote,
  withdraw,
  withdrawals,
  adminWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminReadiness,
  brandTotals,
  brandCustomerStatement,
};
