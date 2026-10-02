/**
 * SafeDeal controller — the standalone escrow product (safedeal.sh) running on
 * Dynopay's engine. Users are CUSTOMERS of the SafeDeal brand (tbl_customer under
 * SAFEDEAL_COMPANY_ID); they sign in with email + one-time code and get a
 * SafeDeal session (JWT). Deals reuse the escrow engine verbatim; settlement
 * lands in each party's SafeDeal wallet (customer wallet ledger).
 */
import { raw as envRaw } from "../utils/config";
import { safedealLegalName } from "../utils/emailTemplate";
import express from "express";
import { shareCopyFor } from "./safedeal/safedealOgImage";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { getRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../utils/redisInstance";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { PaymentUserJwtPayload } from "../utils/types";
import escrowDealModel from "../models/escrowDealModel";
import { escrowEngine, ActorInfo, DEAL_TYPES, normalizeDealType } from "./escrowController";
import { EscrowRole, appendActivity, computeFeeBreakdown, dealFeeBreakdown, isLiveSettlementEnabled, isSimulationAllowed, resolveRoles } from "./escrow/escrowShared";
import { ESCROW_PAYOUT_OPTIONS, refreshEscrowCostRates } from "../services/escrow/escrowCosts";
import { resolveCustomerForBrand, resolveCustomerByTelegram, CustomerRow, CustomerWalletError } from "../services/customerWalletService";
import { getBalances, getStatement, statementToCsv, brandWalletTotals, DEAL_STATS_SELECT, toDealStats } from "../services/safedeal/safedealWallet";
import {
  MIN_WITHDRAWAL_USD,
  APPROVAL_THRESHOLD_USD,
  ADDRESS_COOLING_HOURS,
  listAddresses,
  addAddress,
  removeAddress,
  quoteWithdrawal,
  requestWithdrawal,
  listWithdrawals,
  adminListWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  releaseParkedPayouts,
  sweepBalanceToAutoWithdraw,
  clearParked,
  payoutEligibleUsd,
  listDealPayouts,
  getWithdrawalFeeCredit,
  type PayoutPref,
} from "../services/safedeal/safedealWithdrawals";
import { MIN_TOPUP_USD, MAX_TOPUP_USD, createTopup, getTopup, listTopups, simulateTopup, topupQuotes } from "../services/safedeal/safedealTopup";
import {
  FUNDING_COIN_META,
  apiKeyStatus,
  createFundingPayment,
  fundingCoins,
  handleDynopayWebhook,
  syncFundingFromLedger,
  syncSafeDealApiKey,
  verifyDynopaySignature,
  webhookUrl as safedealWebhookUrl,
} from "../services/safedeal/safedealCheckout";
import { isPlatformFeeExemptCompany } from "../services/feeService";
import { sendSafeDealCodeEmail, sendSafeDealAddressAlertEmail, sendSafeDealEmailChangedAlertEmail } from "../services/email/safedealEmails";
import { notifyAdminNewSafeDealUser } from "../services/safedeal/safedealAdminNotify";
import { isTokenIssuedBeforeCutoff } from "../middleware/authMiddleware";
import { sendEscrowInviteEmail, sendEscrowAmendedEmail } from "../services/email/escrowEmails";
import { runSafeDealReminders } from "../services/safedeal/safedealReminders";
import { generateDealSummaryPdf, feeShares, generateTopupReceiptPdf } from "../services/safedeal/safedealPdf";
import { toFixedStr } from "../utils/money";
import { companyModel, userWalletModel } from "../models";
import { getAdminWalletAddress } from "../utils/adminUtils";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { botUsername as telegramBotUsername, telegramConfigured, telegramIdFor, sendTelegramTest, linkTelegram, unlinkTelegram } from "../services/safedeal/safedealTelegram";
import { SUPPORTED_BASE_CURRENCIES, convertToFiat } from "../utils/currencyUtils";
import {
  AttachmentError,
  bindAttachments,
  getAttachment,
  getAttachmentById,
  listAttachments,
  storeUpload,
  streamAttachment,
  validatePendingIds,
} from "../services/safedeal/safedealAttachments";
import { round2Float as round2 } from "../utils/money";

const { EscrowError, fail } = escrowEngine;

const OTP_TTL = 600; // 10 min
const SESSION_DAYS = 7;
const norm = (s: unknown): string => String(s ?? "").trim().toLowerCase();
const emailOk = (e: string) => /.+@.+\..+/.test(e);
/** Telegram sign-ins get a non-routable synthetic address (tg<id>@telegram.safedeal).
 *  Such users can't receive email invites or log in by email until they add a real one. */
const isPlaceholderEmail = (e: unknown): boolean => /@telegram\.safedeal$/i.test(String(e ?? ""));
const emailDisabled = () => String(envRaw("DISABLE_OUTBOUND_EMAIL") || "").toLowerCase() === "true";
/**
 * One-time codes are only ever echoed back in the API response for RFC 2606/6761 reserved
 * (non-routable) test addresses, and only while outbound email is off. A real mailbox never
 * gets its code in a response — even on a preview pod that shares the production database —
 * so nobody can sign in as (or step-up for) an existing customer without reading their email.
 */
const TEST_EMAIL_DOMAIN = /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/i;
const isTestEmail = (email: unknown): boolean => {
  const domain = String(email ?? "").split("@")[1] || "";
  return !!domain && TEST_EMAIL_DOMAIN.test(domain);
};
const previewCodeFor = (email: unknown, code: string): string | undefined => (emailDisabled() && isTestEmail(email) ? code : undefined);
const codeMatches = (stored: unknown, given: unknown): boolean => {
  const a = Buffer.from(String(stored ?? ""));
  const b = Buffer.from(String(given ?? ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
const MAX_CODE_ATTEMPTS = 5;
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
const genCode = () => String(crypto.randomInt(100000, 1000000));

export interface SafeDealSession {
  customer_id: number;
  company_id: number;
  email: string;
}

const handle = (res: express.Response, e: unknown, context: string) => {
  if (e instanceof AttachmentError) return errorResponseHelper(res, e.status, e.message);
  if (e instanceof EscrowError) return errorResponseHelper(res, e.code, e.message);
  if (e instanceof CustomerWalletError) return errorResponseHelper(res, e.statusCode, e.message);
  apiLogger.error(`[safedeal.${context}] ${(e as Error).message}`);
  return errorResponseHelper(res, 500, "Something went wrong. Please try again.");
};

// ── session middleware ───────────────────────────────────────────────────────

// Global session invalidation ("sign out everywhere"): a per-customer cutoff stored on
// tbl_safedeal_profile.tokens_valid_after. Any SafeDeal JWT issued before it is dead. Set on
// a sensitive change (email change) so a stolen session token is killed the moment the real
// owner (or the flow) rotates the account. Redis-cached (5 min) with the DB as source of truth.
const SESSION_EPOCH_TTL = 300;
const sessionEpochKey = (cid: number) => `safedeal:tva:${cid}`;

async function sdTokensValidAfter(customerId: number): Promise<string | null> {
  if (!customerId) return null;
  const key = sessionEpochKey(customerId);
  try {
    const cached: any = await getRedisItem(key);
    if (cached && "iso" in cached) return cached.iso ?? null;
  } catch { /* Redis down — fall through to the authoritative DB read */ }
  try {
    const rows = await sequelize.query<{ tokens_valid_after: string | null }>(
      `SELECT tokens_valid_after FROM tbl_safedeal_profile WHERE customer_id = :id LIMIT 1`,
      { replacements: { id: customerId }, type: QueryTypes.SELECT }
    );
    const iso = rows[0]?.tokens_valid_after ? new Date(rows[0].tokens_valid_after).toISOString() : null;
    try { await setRedisItemWithTTL(key, { iso }, SESSION_EPOCH_TTL); } catch { /* non-critical */ }
    return iso;
  } catch (e) {
    // Infra failure: don't lock every SafeDeal user out. Money can't move during a DB outage
    // anyway (every cashout query needs the DB), so allowing read requests through is safe.
    apiLogger.warn(`[safedeal] tokens_valid_after lookup failed for customer ${customerId}: ${(e as Error).message}`);
    return null;
  }
}

async function invalidateSdSessionEpochCache(customerId: number): Promise<void> {
  try { await deleteRedisItem(sessionEpochKey(customerId)); } catch { /* non-critical */ }
}

export const safedealAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const header = (req.headers["x-safedeal-token"] as string) || String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!header) return errorResponseHelper(res, 401, "Please sign in to continue.");
    const payload = jwt.verify(header, secret()) as any;
    if (!payload || payload.kind !== "safedeal") return errorResponseHelper(res, 401, "Please sign in to continue.");
    const customerId = Number(payload.cid);
    const cutoff = await sdTokensValidAfter(customerId);
    if (isTokenIssuedBeforeCutoff(payload.iat, cutoff)) {
      return errorResponseHelper(res, 401, "Your session was signed out for your security. Please sign in again.");
    }
    res.locals.sd = { customer_id: customerId, company_id: Number(payload.coid), email: String(payload.email) } as SafeDealSession;
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

/** Step-up: sensitive wallet actions need a fresh one-time code (single use, 5 attempts). */
async function requireStepUp(sess: SafeDealSession, code: unknown): Promise<void> {
  const key = otpKey("stepup", String(sess.customer_id));
  const stored: any = await getRedisItem(key);
  if (!stored) fail(400, "Invalid or expired confirmation code. Request a new one.");
  if (!codeMatches(stored.code, code)) {
    const attempts = Number(stored.attempts || 0) + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) await deleteRedisItem(key);
    else await setRedisItemWithTTL(key, { ...stored, attempts }, OTP_TTL);
    fail(400, "Invalid or expired confirmation code. Request a new one.");
  }
  await deleteRedisItem(key);
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
    const preview = previewCodeFor(email, code);
    if (preview) payload.preview_code = preview; // reserved test domains only, outbound email off
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
    if (!codeMatches(stored.code, code)) {
      const attempts = Number(stored.attempts || 0) + 1;
      if (attempts >= MAX_CODE_ATTEMPTS) await deleteRedisItem(key);
      else await setRedisItemWithTTL(key, { ...stored, attempts }, OTP_TTL);
      return errorResponseHelper(res, 400, "Incorrect code. Please check and try again.");
    }
    await deleteRedisItem(key);
    let isNewCustomer = false;
    const customer = await resolveCustomerForBrand({ companyId: companyId(), email, createIfMissing: true, onCreate: () => { isNewCustomer = true; } });
    const profile = await ensureProfile(customer);
    // First-ever sign-in for this email → tell the operator a new SafeDeal user onboarded.
    if (isNewCustomer) notifyAdminNewSafeDealUser({ email, name: customer.customer_name, customerId: customer.customer_id, method: "email" });
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

// Telegram Login Widget: verify the signed payload (HMAC-SHA256, secret = SHA256(bot token)),
// check freshness, then mint the SAME SafeDeal session token as the email-code flow.
const telegramBotToken = (): string => (envRaw("SAFEDEAL_TELEGRAM_BOT_TOKEN") || "").trim();

function verifyTelegramAuth(data: Record<string, any>): { ok: boolean; reason?: string } {
  const token = telegramBotToken();
  if (!token) return { ok: false, reason: "not_configured" };
  const hash = String(data.hash || "");
  if (!hash) return { ok: false, reason: "missing_hash" };
  const dataCheckString = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");
  const secretKey = crypto.createHash("sha256").update(token).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  let match = false;
  try {
    match = computed.length === hash.length && crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(hash, "hex"));
  } catch {
    match = false;
  }
  if (!match) return { ok: false, reason: "bad_signature" };
  const authDate = Number(data.auth_date || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > 86400) return { ok: false, reason: "expired" };
  return { ok: true };
}

const telegramAuth = async (req: express.Request, res: express.Response) => {
  try {
    if (!telegramBotToken()) return errorResponseHelper(res, 503, "Telegram sign-in isn't configured.");
    const data = { ...(req.body || {}) } as Record<string, any>;
    const check = verifyTelegramAuth(data);
    if (!check.ok) {
      if (check.reason === "expired") return errorResponseHelper(res, 401, "This Telegram sign-in has expired. Please try again.");
      return errorResponseHelper(res, 401, "Telegram verification failed. Please try again.");
    }
    const telegramId = String(data.id || "").trim();
    if (!telegramId) return errorResponseHelper(res, 400, "Telegram didn't return a user id.");
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || (data.username ? `@${data.username}` : `Telegram ${telegramId}`);
    let isNewTgCustomer = false;
    const customer = await resolveCustomerByTelegram({ companyId: companyId(), telegramId, name, onCreate: () => { isNewTgCustomer = true; } });
    const profile = await ensureProfile(customer);
    if (isNewTgCustomer)
      notifyAdminNewSafeDealUser({
        email: customer.email,
        name,
        customerId: customer.customer_id,
        method: "telegram",
        telegramId,
        telegramUsername: data.username ? String(data.username) : null,
      });
    // First Telegram sign-in: stamp a friendly display name (never overwrite one the user chose).
    if (!profile?.display_name && name) {
      await sequelize.query(
        `UPDATE tbl_safedeal_profile SET display_name = :n, updated_at = NOW() WHERE customer_id = :cid AND (display_name IS NULL OR display_name = '')`,
        { replacements: { n: name.slice(0, 120), cid: customer.customer_id } }
      );
    }
    const token = jwt.sign({ kind: "safedeal", cid: customer.customer_id, coid: customer.company_id, email: customer.email }, secret(), { expiresIn: `${SESSION_DAYS}d` });
    return successResponseHelper(res, 200, "Signed in with Telegram.", {
      token,
      user: { email: customer.email, customer_id: customer.customer_id, display_name: name || profile?.display_name || null },
    });
  } catch (e) {
    return handle(res, e, "telegramAuth");
  }
};

// ── Telegram alerts (link an existing account, test, unlink) ─────────────────
const telegramStatus = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const tg = await telegramIdFor(sess.customer_id);
    return successResponseHelper(res, 200, "OK", { linked: Boolean(tg), bot: telegramConfigured() ? telegramBotUsername() : null, configured: telegramConfigured() });
  } catch (e) {
    return handle(res, e, "telegramStatus");
  }
};

const telegramLink = async (req: express.Request, res: express.Response) => {
  try {
    if (!telegramBotToken()) return errorResponseHelper(res, 503, "Telegram alerts aren't configured.");
    const sess = session(res);
    const data = { ...(req.body || {}) } as Record<string, any>;
    const check = verifyTelegramAuth(data);
    if (!check.ok) return errorResponseHelper(res, 401, check.reason === "expired" ? "This Telegram confirmation has expired. Please try again." : "Telegram verification failed. Please try again.");
    const telegramId = String(data.id || "").trim();
    if (!telegramId) return errorResponseHelper(res, 400, "Telegram didn't return a user id.");
    const r = await linkTelegram(sess.customer_id, telegramId);
    if (!r.ok) return errorResponseHelper(res, 409, "That Telegram account is already linked to another SafeDeal account.");
    const test = await sendTelegramTest(sess.customer_id);
    return successResponseHelper(res, 200, "Telegram linked.", { linked: true, message_sent: test.ok, bot: telegramBotUsername() });
  } catch (e) {
    return handle(res, e, "telegramLink");
  }
};

const telegramTest = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const r = await sendTelegramTest(sess.customer_id);
    if (r.ok) return successResponseHelper(res, 200, "Test message sent.", { sent: true });
    if (r.error === "not_linked") return errorResponseHelper(res, 400, "Link your Telegram account first.");
    if (r.unreachable) return errorResponseHelper(res, 409, `Telegram won't let us message you yet — open @${telegramBotUsername() || "the bot"} in Telegram, press Start, then try again.`);
    return errorResponseHelper(res, 502, "Telegram didn't accept the message. Please try again in a moment.");
  } catch (e) {
    return handle(res, e, "telegramTest");
  }
};

const telegramUnlink = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const customer = await customerFor(sess);
    if (isPlaceholderEmail(customer.email)) return errorResponseHelper(res, 400, "Add an email to your account before unlinking Telegram — it's your only way to sign in.");
    await unlinkTelegram(sess.customer_id);
    return successResponseHelper(res, 200, "Telegram unlinked.", { linked: false });
  } catch (e) {
    return handle(res, e, "telegramUnlink");
  }
};

const STEP_UP_ACTIONS = new Set(["cashout", "address_add", "address_remove", "payout_destination", "change_email"]);

const sendStepUp = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const code = genCode();
    // Optional `action` tells the email what the user is confirming ("Confirm your cashout"
    // instead of a vague "wallet action").
    const rawAction = String(req.body?.action || "").trim();
    const action = STEP_UP_ACTIONS.has(rawAction) ? rawAction : null;
    await setRedisItemWithTTL(otpKey("stepup", String(sess.customer_id)), { code, attempts: 0 }, OTP_TTL);
    void sendSafeDealCodeEmail(sess.email, code, "stepup", action);
    const payload: Record<string, unknown> = { expires_in: OTP_TTL };
    const preview = previewCodeFor(sess.email, code);
    if (preview) payload.preview_code = preview;
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
      user: { email: customer.email, customer_id: customer.customer_id, display_name: profile?.display_name || null, email_is_placeholder: isPlaceholderEmail(customer.email) },
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
      if (!addrs.some((a) => a.address_id === addrId)) return errorResponseHelper(res, 400, "Pick a saved payout address for auto-cashout.");
    }
    await sequelize.query(
      `UPDATE tbl_safedeal_profile SET auto_withdraw = :aw, auto_withdraw_address_id = :addr,
              display_name = COALESCE(:name, display_name), updated_at = NOW() WHERE customer_id = :cid`,
      {
        replacements: { aw: !!auto_withdraw, addr: addrId, name: display_name != null ? String(display_name).slice(0, 120) : null, cid: sess.customer_id },
        type: QueryTypes.UPDATE,
      }
    );
    // ON → flush any parked legs, then sweep the CURRENT available balance out to the
    //      auto-withdraw address too (turning it on settles what is already in the wallet,
    //      not just future / parked payouts). OFF → nothing is parked any more.
    if (auto_withdraw) {
      await releaseParkedPayouts(sess.customer_id);
      try { await sweepBalanceToAutoWithdraw(sess.customer_id); } catch { /* non-fatal — the toggle itself still succeeds */ }
    } else {
      await clearParked(sess.customer_id);
    }
    return me(req, res);
  } catch (e) {
    return handle(res, e, "updateProfile");
  }
};

// ── config + fee preview (public) ────────────────────────────────────────────

const config = async (_req: express.Request, res: express.Response) => {
  return successResponseHelper(res, 200, "OK", {
    fee_percent: escrowEngine.ESCROW_FEE_PERCENT,
    cancellation_fee_percent: escrowEngine.CANCELLATION_FEE_PERCENT,
    fee_min_usd: escrowEngine.ESCROW_FEE_MIN_USD,
    min_deal_usd: escrowEngine.ESCROW_MIN_DEAL_USD,
    max_deal_eur: escrowEngine.ESCROW_MAX_DEAL_EUR,
    max_deal_usd: await maxDealUsd(),
    telegram_bot: (envRaw("SAFEDEAL_TELEGRAM_BOT_USERNAME") || "").trim() || null,
    auto_release_presets: escrowEngine.ESCROW_AUTO_RELEASE_PRESETS,
    auto_release_default: escrowEngine.ESCROW_AUTO_RELEASE_DEFAULT,
    payout_options: ESCROW_PAYOUT_OPTIONS,
    min_withdrawal_usd: MIN_WITHDRAWAL_USD,
    min_topup_usd: MIN_TOPUP_USD,
    max_topup_usd: MAX_TOPUP_USD,
    withdrawal_approval_usd: APPROVAL_THRESHOLD_USD,
    live_settlement: isLiveSettlementEnabled(),
    simulation_allowed: isSimulationAllowed(),
    dispute_auto_escalate_hours: Number(envRaw("ESCROW_DISPUTE_AUTO_ESCALATE_HOURS")) || 72,
    legal_name: safedealLegalName(),
    price_currencies: PRICE_CURRENCIES,
    attachment_limits: { max_files: 5, max_mb: 10, types: ["PNG", "JPG", "WEBP", "GIF", "PDF"] },
    deal_types: DEAL_TYPES,
    max_revision_rounds: escrowEngine.MAX_REVISION_ROUNDS,
    address_cooling_hours: ADDRESS_COOLING_HOURS,
  });
};

const feePreview = async (req: express.Request, res: express.Response) => {
  try {
    const { amount, fee_payer, payout_coin, price_currency } = req.body || {};
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "A positive amount is required.");
    void refreshEscrowCostRates();
    const cur = String(price_currency || "USD").toUpperCase();
    const { usd, rate } = await fiatToUsd(cur, Number(amount));
    const breakdown = computeFeeBreakdown({ amount: usd, currency: "USD", feePercent: escrowEngine.ESCROW_FEE_PERCENT, feeMinUsd: escrowEngine.ESCROW_FEE_MIN_USD, feePayer: fee_payer, payoutCoin: payout_coin });
    const maxUsd = await maxDealUsd();
    return successResponseHelper(res, 200, "Fee breakdown computed.", {
      ...breakdown,
      minDealUsd: escrowEngine.ESCROW_MIN_DEAL_USD,
      belowMinimum: usd < escrowEngine.ESCROW_MIN_DEAL_USD,
      maxDealUsd: maxUsd,
      maxDealEur: escrowEngine.ESCROW_MAX_DEAL_EUR,
      aboveMaximum: usd > maxUsd,
      price: cur === "USD" ? null : { currency: cur, amount: round2(Number(amount)), rate, usd, indicative: true },
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
  // Short, readable handle ("sd•••@example.com") — never leaks the local-part length.
  return `${u.slice(0, 2)}•••@${d}`;
};

// ── Multi-fiat pricing ───────────────────────────────────────────────────────
// The deal is priced in `price_currency`; `amount` (USD) is indicative until the
// buyer funds, then locked at the live rate so custody (USDT) matches the agreed price.
export const PRICE_CURRENCIES = SUPPORTED_BASE_CURRENCIES;

async function fiatToUsd(currency: string, amount: number): Promise<{ usd: number; rate: number }> {
  const cur = String(currency || "USD").toUpperCase();
  if (cur === "USD") return { usd: round2(amount), rate: 1 };
  if (!PRICE_CURRENCIES.includes(cur)) fail(400, `Currency ${cur} isn't supported. Choose one of ${PRICE_CURRENCIES.join(", ")}.`);
  let usd = 0;
  try {
    usd = Number((await convertToFiat(cur, "USD", amount)).amount) || 0;
  } catch (e) {
    apiLogger.warn(`[safedeal] FX ${cur}→USD failed: ${(e as Error).message}`);
  }
  if (!(usd > 0)) fail(503, "Exchange rate temporarily unavailable — try again in a minute or price the deal in USD.");
  return { usd: round2(usd), rate: usd / amount };
}

/** The largest deal we escrow, set in EUR (env) and resolved to USD at the live rate.
 *  Fails open to a conservative EUR→USD multiple if the FX provider is momentarily down. */
async function maxDealUsd(): Promise<number> {
  const eur = escrowEngine.ESCROW_MAX_DEAL_EUR;
  try {
    const usd = Number((await convertToFiat("EUR", "USD", eur)).amount) || 0;
    if (usd > 0) return round2(usd);
  } catch (e) {
    apiLogger.warn(`[safedeal] FX EUR→USD (max cap) failed: ${(e as Error).message}`);
  }
  return round2(eur * 1.15);
}

const maxDealMessage = (maxUsd: number, priceCur: string, amount: number, usdAmount: number) =>
  `The maximum deal is €${escrowEngine.ESCROW_MAX_DEAL_EUR.toLocaleString("en-US")} (≈ $${maxUsd.toFixed(2)})${priceCur !== "USD" ? ` — your ${Number(amount).toFixed(2)} ${priceCur} ≈ $${usdAmount.toFixed(2)}` : ""}. For larger deals, contact support.`;

/** Buyer is about to pay: lock the USD amount for fiat-priced deals (once). */
async function lockPriceIfNeeded(deal: any, actorLabel: string): Promise<void> {
  const cur = String(deal.price_currency || "USD").toUpperCase();
  if (cur === "USD" || deal.fx_locked_at || deal.status !== "awaiting_payment") return;
  const { usd, rate } = await fiatToUsd(cur, Number(deal.price_amount));
  deal.amount = usd;
  deal.fx_rate = rate;
  deal.fx_locked_at = new Date();
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "price_locked",
    actor: actorLabel,
    role: "buyer",
    note: `Price locked: ${Number(deal.price_amount).toFixed(2)} ${cur} = $${usd.toFixed(2)} (1 ${cur} = ${rate.toFixed(4)} USD).`,
  });
  await deal.save();
}

// ── Counterparty trust card (counts only — no names) ─────────────────────────
async function partyStats(companyId: number, email: string): Promise<{ email_masked: string; verified_email: boolean; member_since: string | null; completed_deals: number }> {
  const e = norm(email);
  const [stats, cust] = await Promise.all([
    sequelize.query<{ completed: string; first_deal: string | null }>(
      `SELECT COUNT(*) FILTER (WHERE status IN ('completed','split')) AS completed, MIN(created_at) AS first_deal
         FROM tbl_escrow_deal WHERE source = 'safedeal' AND company_id = :cid AND (LOWER(creator_email) = :e OR LOWER(counterparty_email) = :e)`,
      { replacements: { cid: companyId, e }, type: QueryTypes.SELECT }
    ),
    sequelize.query<{ created_at: string }>(`SELECT "createdAt" AS created_at FROM tbl_customer WHERE company_id = :cid AND LOWER(email) = :e LIMIT 1`, {
      replacements: { cid: companyId, e },
      type: QueryTypes.SELECT,
    }),
  ]);
  return {
    email_masked: maskEmail(email),
    verified_email: cust.length > 0,
    member_since: cust[0]?.created_at || stats[0]?.first_deal || null,
    completed_deals: Number(stats[0]?.completed || 0),
  };
}

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

/** Deal page payload: view() + evidence files + the other party's trust card + my payout destination. */
const viewFull = async (deal: any, actor: ActorInfo) => {
  const v = view(deal, actor) as Record<string, any>;
  const otherEmail = actor.isCreator ? deal.counterparty_email : deal.creator_email;
  const myCustomerId = actor.isCreator ? deal.creator_customer_id : deal.counterparty_customer_id;
  const [attachments, counterparty, myAddresses] = await Promise.all([
    listAttachments(Number(deal.escrow_id)),
    partyStats(Number(deal.company_id), String(otherEmail || "")),
    myCustomerId ? listAddresses(Number(myCustomerId)) : Promise.resolve([]),
  ]);
  v.attachments = attachments;
  v.counterparty = counterparty;
  v.my_addresses = myAddresses.map((a) => ({ address_id: a.address_id, payout_key: a.payout_key, address: a.address, label: a.label, usable_at: a.usable_at, created_at: a.created_at }));
  const pref = (deal.payout_prefs || {})[actor.role] as PayoutPref | undefined;
  v.my_payout_pref = pref ? { ...pref, address: myAddresses.find((a) => a.address_id === Number(pref.address_id)) || null } : null;
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

const parseDueDate = (v: unknown): Date | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) fail(400, "Delivery due date isn't a valid date.");
  if (d.getTime() < Date.now() - 86400000) fail(400, "Delivery due date must be in the future.");
  return d;
};

const createDeal = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const {
      title, description, amount, terms, counterparty_email, my_role = "seller",
      fee_payer = "buyer", auto_release_days = escrowEngine.ESCROW_AUTO_RELEASE_DEFAULT, price_currency, deal_type, delivery_due_at,
      invite_by_link,
    } = req.body || {};
    const byLink = invite_by_link === true || invite_by_link === "true" || invite_by_link === 1;
    if (!title || String(title).trim().length < 2) return errorResponseHelper(res, 400, "Give the deal a short title.");
    if (amount == null || Number(amount) <= 0) return errorResponseHelper(res, 400, "Enter the deal amount.");
    const dueAt = parseDueDate(delivery_due_at) ?? null;
    const priceCur = String(price_currency || "USD").toUpperCase();
    const { usd: usdAmount, rate: fxRate } = await fiatToUsd(priceCur, Number(amount));
    if (usdAmount < escrowEngine.ESCROW_MIN_DEAL_USD) {
      return errorResponseHelper(res, 400, `The minimum deal is $${escrowEngine.ESCROW_MIN_DEAL_USD}${priceCur !== "USD" ? ` (your ${Number(amount).toFixed(2)} ${priceCur} ≈ $${usdAmount.toFixed(2)})` : ""} — escrow fee ${escrowEngine.ESCROW_FEE_PERCENT}%, min $${escrowEngine.ESCROW_FEE_MIN_USD}.`);
    }
    const maxUsd = await maxDealUsd();
    if (usdAmount > maxUsd) return errorResponseHelper(res, 400, maxDealMessage(maxUsd, priceCur, Number(amount), usdAmount));
    if (!byLink && (!counterparty_email || !emailOk(String(counterparty_email)))) return errorResponseHelper(res, 400, "Enter the other party's email.");
    if (!byLink && isPlaceholderEmail(counterparty_email)) return errorResponseHelper(res, 400, "Enter a real email address for the other party, or invite them by shareable link instead.");
    if (!["buyer", "seller"].includes(String(my_role))) return errorResponseHelper(res, 400, "Your role must be buyer or seller.");
    if (!["buyer", "seller", "split"].includes(String(fee_payer))) return errorResponseHelper(res, 400, "fee_payer must be buyer, seller or split.");
    if (!byLink && norm(counterparty_email) === norm(sess.email)) return errorResponseHelper(res, 400, "You can't invite yourself as the other party.");

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
      counterparty_email: byLink ? null : String(counterparty_email).trim(),
      invite_kind: byLink ? "link" : "email",
      title: String(title).trim().slice(0, 255),
      description: description ? String(description).slice(0, 5000) : null,
      amount: usdAmount,
      currency: "USD",
      price_currency: priceCur,
      price_amount: round2(Number(amount)),
      fx_rate: fxRate,
      fx_locked_at: priceCur === "USD" ? now : null,
      accepted_coins: null,
      terms: terms ? String(terms).slice(0, 10000) : null,
      deal_type: normalizeDealType(deal_type),
      delivery_due_at: dueAt,
      fee_percent: escrowEngine.ESCROW_FEE_PERCENT,
      fee_min_usd: escrowEngine.ESCROW_FEE_MIN_USD,
      fee_payer,
      auto_release_days: escrowEngine.clampAutoReleaseDays(auto_release_days),
      status: "invited",
      invited_at: now,
      activity_log: appendActivity([], { type: "created", actor: sess.email, role: my_role, note: byLink ? "Deal created on SafeDeal — shareable invite link generated." : "Deal created on SafeDeal and the other party invited." }),
    } as any);
    if (!byLink) {
      // If the counterparty already has a SafeDeal account, link them right away.
      try {
        const cp = await resolveCustomerForBrand({ companyId: sess.company_id, email: deal.counterparty_email, createIfMissing: false });
        deal.counterparty_customer_id = cp.customer_id;
        await deal.save();
      } catch { /* not a customer yet — linked on first sign-in */ }
      const { counterparty } = resolveRoles(my_role as EscrowRole);
      void sendEscrowInviteEmail(deal.counterparty_email, deal.counterparty_email, deal, sess.email, counterparty, escrowEngine.dealUrl(deal));
    }
    return successResponseHelper(res, 201, byLink ? "Deal created — share the invite link with the other party." : "Deal created — invite sent.", view(deal, actorFor(deal, sess)!));
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
    const breakdown = dealFeeBreakdown(deal);
    const isLink = (deal.invite_kind || "email") === "link";
    return successResponseHelper(res, 200, "OK", {
      deal_token: deal.deal_token,
      title: deal.title,
      amount: Number(deal.amount),
      currency: deal.currency,
      status: deal.status,
      creator_role: deal.creator_role,
      fee_payer: deal.fee_payer,
      auto_release_days: deal.auto_release_days,
      invite_kind: isLink ? "link" : "email",
      // An open-seat link that anyone can still claim (nobody has yet, and it's pre-funding).
      open_seat: isLink && !deal.counterparty_customer_id && deal.status === "invited",
      claimed: !!deal.counterparty_customer_id,
      buyer_email_masked: maskEmail(buyerEmail),
      seller_email_masked: maskEmail(sellerEmail),
      counterparty_email_masked: maskEmail(deal.counterparty_email),
      // Never the full invitee address: anyone holding the link could read it (E2E audit SD-04).
      counterparty_email_hint: null,
      buyer_pays: breakdown.buyerPays,
      seller_receives: breakdown.sellerReceives,
      // Itemised SafeDeal costs so the guest sees WHY buyer_pays ≠ amount (audit SD-02).
      cost_items: breakdown.costItems,
      total_cost: breakdown.totalCost,
      costs_estimated: breakdown.costsEstimated,
      fee_percent: Number(deal.fee_percent),
      created_at: deal.created_at,
      // Link-preview copy (OG title/description) — same source as the rendered share card.
      share: (() => {
        const c = shareCopyFor({ title: deal.title, amount: Number(deal.amount), currency: deal.currency, status: deal.status, creator_role: deal.creator_role, invite_kind: deal.invite_kind });
        return { title: c.title, description: c.description, state: c.state };
      })(),
    });
  } catch (e) {
    return handle(res, e, "previewDeal");
  }
};

const getDeal = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadDealActor(req.params.token, session(res));
    const v = await viewFull(deal, actor);
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
        if (isLiveSettlementEnabled()) fail(400, "Pay the deposit address shown on the deal page to fund this deal.");
        if (actor.role === "buyer") await lockPriceIfNeeded(deal, sess.email);
        await escrowEngine.actFund(deal, actor, body.coin || deal.funding_coin);
        msg = "Payment received — escrow funded. The seller has been notified.";
        break;
      case "fund-balance":
        if (actor.role === "buyer") await lockPriceIfNeeded(deal, sess.email);
        await escrowEngine.actFundFromBalance(deal, actor);
        msg = "Paid from your balance — the escrow is funded.";
        break;
      case "deliver": {
        const ids = await validatePendingIds(Number(deal.escrow_id), body.attachment_ids, sess.email);
        await escrowEngine.actDeliver(deal, actor, body.delivery_note, { links: body.links, tracking: body.tracking, attachment_ids: ids });
        await bindAttachments(Number(deal.escrow_id), ids, "delivery", "delivery");
        msg = "Marked as delivered. The buyer has been asked to confirm.";
        break;
      }
      case "release":
        await escrowEngine.actRelease(deal, actor);
        msg = "Funds released to the seller's SafeDeal wallet.";
        break;
      case "request-changes":
        await escrowEngine.actRequestChanges(deal, actor, body.message);
        msg = "Sent back for changes — the seller has been notified and the inspection timer is paused.";
        break;
      case "resend-invite":
        await escrowEngine.actResendInvite(deal, actor);
        msg = `Invite re-sent to ${deal.counterparty_email}.`;
        break;
      case "regenerate-link": {
        if (!actor.isCreator) fail(403, "Only the deal creator can regenerate the invite link.");
        if ((deal.invite_kind || "email") !== "link") fail(400, "This deal wasn't created as a shareable link.");
        if (deal.status !== "invited") fail(409, "The invite link can only be changed before the escrow is funded.");
        deal.deal_token = crypto.randomBytes(24).toString("hex");
        deal.counterparty_customer_id = null;
        deal.counterparty_email = null;
        deal.counterparty_claimed_at = null;
        deal.counterparty_verified_at = null;
        deal.activity_log = appendActivity(deal.activity_log, { type: "link_regenerated", actor: sess.email, role: actor.role, note: "Invite link regenerated — the previous link no longer works." });
        await deal.save();
        msg = "New invite link generated — the old link no longer works.";
        break;
      }
      case "amend":
        msg = await amendDeal(deal, actor, body, sess.email);
        break;
      case "dispute": {
        const ids = await validatePendingIds(Number(deal.escrow_id), body.attachment_ids, sess.email);
        await escrowEngine.actRaiseDispute(deal, actor, { ...body, attachment_ids: ids });
        await bindAttachments(Number(deal.escrow_id), ids, "dispute", `thread:${(deal.dispute_thread || []).length - 1}`);
        msg = "Dispute opened — your proposal was sent to the other party.";
        break;
      }
      case "dispute-counter": {
        const ids = await validatePendingIds(Number(deal.escrow_id), body.attachment_ids, sess.email);
        await escrowEngine.actCounterDispute(deal, actor, { ...body, attachment_ids: ids });
        await bindAttachments(Number(deal.escrow_id), ids, "dispute", `thread:${(deal.dispute_thread || []).length - 1}`);
        msg = "Counter-offer sent.";
        break;
      }
      case "dispute-accept":
        await escrowEngine.actAcceptDispute(deal, actor);
        msg = "Agreed — the deal has been settled.";
        break;
      case "dispute-message": {
        const ids = await validatePendingIds(Number(deal.escrow_id), body.attachment_ids, sess.email);
        await escrowEngine.actDisputeMessage(deal, actor, body.message, ids);
        await bindAttachments(Number(deal.escrow_id), ids, "dispute", `thread:${(deal.dispute_thread || []).length - 1}`);
        msg = ids.length ? "Evidence added." : "Message added.";
        break;
      }
      case "dispute-escalate":
        await escrowEngine.actEscalateDispute(deal, actor);
        msg = "Escalated to the SafeDeal team — they will review and decide.";
        break;
      default:
        return errorResponseHelper(res, 400, `Unknown action '${action}'.`);
    }
    await deal.reload();
    return successResponseHelper(res, 200, msg, await viewFull(deal, actor));
  } catch (e) {
    return handle(res, e, "dealAction");
  }
};

// ── funding via Dynopay Merchant API (buyer picks a coin → address + QR on the deal page) ──

const fundingView = async (deal: any) => {
  const fp = deal.funding_payment || null;
  return {
    status: deal.status,
    coins: deal.status === "awaiting_payment" ? await fundingCoins(deal) : [],
    payment: fp,
    funded_at: deal.funded_at,
    funding_coin: deal.funding_coin,
    funding_tx_hash: deal.funding_tx_hash,
    funding_settled_at: deal.funding_settled_at,
    custody_amount_stable: deal.custody_amount_stable != null ? Number(deal.custody_amount_stable) : null,
    live: isLiveSettlementEnabled(),
  };
};

const getFunding = async (req: express.Request, res: express.Response) => {
  try {
    const { deal, actor } = await loadDealActor(req.params.token, session(res));
    if (actor.role !== "buyer") return errorResponseHelper(res, 403, "Only the buyer funds the escrow.");
    await syncFundingFromLedger(deal);
    return successResponseHelper(res, 200, "OK", await fundingView(deal));
  } catch (e) {
    return handle(res, e, "getFunding");
  }
};

const createFunding = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { deal, actor } = await loadDealActor(req.params.token, sess);
    if (actor.role !== "buyer") return errorResponseHelper(res, 403, "Only the buyer funds the escrow.");
    if (deal.status !== "awaiting_payment") return errorResponseHelper(res, 409, `Cannot fund from status '${deal.status}'.`);
    const coin = String(req.body?.coin || "").toUpperCase().trim();
    if (!FUNDING_COIN_META[coin]) return errorResponseHelper(res, 400, "Choose a coin to pay with.");
    await lockPriceIfNeeded(deal, sess.email);
    const payment = await createFundingPayment(deal, coin);
    return successResponseHelper(res, 201, `Send exactly ${payment.crypto_amount} ${FUNDING_COIN_META[coin].label} on ${FUNDING_COIN_META[coin].network}.`, { ...(await fundingView(deal)), payment });
  } catch (e) {
    return handle(res, e, "createFunding");
  }
};

/** Dynopay → SafeDeal payment events (HMAC v2 signed with SAFEDEAL_WEBHOOK_SECRET). */
const dynopayWebhook = async (req: express.Request & { rawBody?: Buffer }, res: express.Response) => {
  try {
    const secret = (envRaw("SAFEDEAL_WEBHOOK_SECRET") || "").trim();
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body || {}));
    if (!secret || !verifyDynopaySignature(raw, String(req.headers["x-dynopay-signature-v2"] || ""), secret)) {
      apiLogger.warn(`[SafeDeal] webhook rejected — bad or missing signature (event ${req.body?.event || "?"})`);
      return res.status(401).json({ status: 401, message: "Invalid signature." });
    }
    const r = await handleDynopayWebhook(req.body || {});
    apiLogger.info(`[SafeDeal] webhook ${req.body?.event}: ${r.note}`);
    return res.status(200).json({ status: 200, received: true, handled: r.handled, note: r.note });
  } catch (e) {
    apiLogger.error(`[SafeDeal] webhook error: ${(e as Error).message}`);
    return res.status(500).json({ status: 500, message: "Webhook processing failed." });
  }
};

// ── payout destination chosen inside the deal (release → seller, refund → buyer) ──

const setPayoutDestination = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { deal, actor } = await loadDealActor(req.params.token, sess);
    if (["completed", "refunded", "split", "cancelled", "declined", "expired"].includes(deal.status)) return errorResponseHelper(res, 409, "This deal is closed.");
    const customer = await customerFor(sess);
    let addressId = Number(req.body?.address_id) || 0;
    if (!addressId) {
      await requireStepUp(sess, req.body?.code);
      const row = await addAddress(customer, { payout_key: req.body?.payout_key, address: req.body?.address, label: req.body?.label || `Deal #${deal.escrow_id}` });
      const opt = ESCROW_PAYOUT_OPTIONS.find((o) => o.key === row.payout_key);
      void sendSafeDealAddressAlertEmail(sess.email, "added", `${row.label ? `${row.label} · ` : ""}${opt?.label || row.payout_key}`, row.address);
      addressId = row.address_id;
    } else {
      const mine = await listAddresses(customer.customer_id);
      if (!mine.some((a) => a.address_id === addressId)) return errorResponseHelper(res, 404, "Saved address not found.");
    }
    const pref: PayoutPref = { address_id: addressId, set_at: new Date().toISOString(), before_funding: !deal.funded_at };
    deal.payout_prefs = { ...(deal.payout_prefs || {}), [actor.role]: pref };
    deal.changed("payout_prefs", true);
    deal.activity_log = appendActivity(deal.activity_log, { type: "payout_destination", actor: sess.email, role: actor.role, note: `${actor.role === "seller" ? "Seller" : "Buyer"} chose where their ${actor.role === "seller" ? "payout" : "refund"} should go.` });
    await deal.save();
    return successResponseHelper(res, 200, "Payout destination saved.", await viewFull(deal, actor));
  } catch (e) {
    return handle(res, e, "setPayoutDestination");
  }
};

// ── evidence files (private; party session or admin) ─────────────────────────

/**
 * Creator edits the terms before funding. Any change after acceptance resets the
 * deal to `invited` so the counterparty re-accepts. Returns the toast message.
 */
async function amendDeal(deal: any, actor: ActorInfo, body: any, actorEmail: string): Promise<string> {
  if (!actor.isCreator) fail(403, "Only the creator can change the terms.");
  if (!["invited", "awaiting_payment"].includes(deal.status)) fail(409, "Terms can only be changed before the escrow is funded.");
  const changes: string[] = [];
  if (body.title !== undefined && String(body.title).trim() !== deal.title) {
    const t = String(body.title).trim().slice(0, 255);
    if (t.length < 2) fail(400, "Give the deal a short title.");
    changes.push(`Title: "${deal.title}" → "${t}"`);
    deal.title = t;
  }
  if (body.amount !== undefined || body.price_currency !== undefined) {
    const cur = String(body.price_currency || deal.price_currency || "USD").toUpperCase();
    const amt = body.amount !== undefined ? Number(body.amount) : Number(deal.price_amount ?? deal.amount);
    if (!(amt > 0)) fail(400, "Enter the deal amount.");
    if (cur !== (deal.price_currency || "USD") || round2(amt) !== round2(Number(deal.price_amount ?? deal.amount))) {
      const { usd, rate } = await fiatToUsd(cur, amt);
      if (usd < escrowEngine.ESCROW_MIN_DEAL_USD) fail(400, `The minimum deal is $${escrowEngine.ESCROW_MIN_DEAL_USD}.`);
      const maxUsd = await maxDealUsd();
      if (usd > maxUsd) fail(400, maxDealMessage(maxUsd, cur, amt, usd));
      changes.push(`Amount: ${Number(deal.price_amount ?? deal.amount).toFixed(2)} ${deal.price_currency || "USD"} → ${round2(amt).toFixed(2)} ${cur}`);
      deal.price_currency = cur;
      deal.price_amount = round2(amt);
      deal.amount = usd;
      deal.fx_rate = rate;
      deal.fx_locked_at = cur === "USD" ? new Date() : null;
    }
  }
  if (body.fee_payer !== undefined && body.fee_payer !== deal.fee_payer) {
    if (!["buyer", "seller", "split"].includes(String(body.fee_payer))) fail(400, "fee_payer must be buyer, seller or split.");
    changes.push(`Escrow fee paid by: ${deal.fee_payer} → ${body.fee_payer}`);
    deal.fee_payer = body.fee_payer;
  }
  if (body.auto_release_days !== undefined) {
    const d = escrowEngine.clampAutoReleaseDays(body.auto_release_days);
    if (d !== Number(deal.auto_release_days)) {
      changes.push(`Inspection period: ${deal.auto_release_days} → ${d} days`);
      deal.auto_release_days = d;
    }
  }
  if (body.deal_type !== undefined && normalizeDealType(body.deal_type) !== (deal.deal_type || null)) {
    changes.push(`Deal type: ${deal.deal_type || "—"} → ${normalizeDealType(body.deal_type) || "—"}`);
    deal.deal_type = normalizeDealType(body.deal_type);
  }
  const due = parseDueDate(body.delivery_due_at);
  if (due !== undefined && (due?.toISOString().slice(0, 10) || null) !== (deal.delivery_due_at ? new Date(deal.delivery_due_at).toISOString().slice(0, 10) : null)) {
    changes.push(`Delivery due: ${deal.delivery_due_at ? new Date(deal.delivery_due_at).toISOString().slice(0, 10) : "—"} → ${due ? due.toISOString().slice(0, 10) : "—"}`);
    deal.delivery_due_at = due;
  }
  if (body.terms !== undefined && String(body.terms || "").trim() !== String(deal.terms || "").trim()) {
    changes.push("Terms updated");
    deal.terms = String(body.terms || "").trim().slice(0, 10000) || null;
  }
  if (body.description !== undefined && String(body.description || "").trim() !== String(deal.description || "").trim()) {
    changes.push("Description updated");
    deal.description = String(body.description || "").trim().slice(0, 5000) || null;
  }
  if (!changes.length) fail(400, "Nothing changed.");
  const needsReaccept = deal.status === "awaiting_payment";
  if (needsReaccept) {
    deal.status = "invited";
    deal.accepted_at = null;
  }
  deal.amended_at = new Date();
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "amended",
    actor: actorEmail,
    role: actor.role,
    note: `Terms changed by the creator${needsReaccept ? " — the other party must accept again" : ""}: ${changes.join("; ")}.`,
  });
  await deal.save();
  void sendEscrowAmendedEmail(deal.counterparty_email, deal.counterparty_email, deal, actorEmail, changes, needsReaccept, escrowEngine.dealUrl(deal));
  return needsReaccept ? "Terms updated — the other party has been asked to accept the new terms." : "Terms updated — the other party has been notified.";
}

/** GET /deals/:token/summary.pdf — a party's printable record of the deal. */
const dealPdf = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { deal, actor } = await loadDealActor(req.params.token, sess);
    const { buyerEmail, sellerEmail } = partiesOf(deal);
    const [attachments, payouts] = await Promise.all([listAttachments(Number(deal.escrow_id)), listDealPayouts(Number(deal.escrow_id))]);
    const closed = ["completed", "refunded", "split"].includes(deal.status) && !!deal.outcome;
    const doc = generateDealSummaryPdf({
      deal: deal.dataValues || deal,
      buyerEmail,
      sellerEmail,
      attachments,
      legalName: safedealLegalName(),
      viewer: { role: actor.role, email: sess.email },
      payouts: payouts.filter((p) => p.customer_id === sess.customer_id),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="safedeal-${closed ? "invoice-" : ""}${deal.escrow_id}.pdf"`);
    doc.pipe(res);
  } catch (e) {
    return handle(res, e, "dealPdf");
  }
};

/** GET /wallet/topup/:id/receipt.pdf — a branded deposit receipt for a wallet top-up. */
const topupReceiptPdf = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const row = await getTopup(sess.customer_id, Number(req.params.id));
    const m = FUNDING_COIN_META[row.coin];
    const doc = generateTopupReceiptPdf({
      topup: row,
      coinLabel: m?.label || row.coin,
      network: m?.network || row.coin,
      customerEmail: sess.email,
      legalName: safedealLegalName(),
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="safedeal-deposit-${row.topup_id}.pdf"`);
    doc.pipe(res);
  } catch (e) {
    return handle(res, e, "topupReceiptPdf");
  }
};

/** GET /invoices — my invoices: closed/funded deals + wallet deposits, each with fees (retrievable any time). */
const invoices = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const email = norm(sess.email);
    const deals: any[] = await escrowDealModel.findAll({
      where: {
        source: "safedeal",
        company_id: sess.company_id,
        status: { [Op.in]: ["awaiting_delivery", "delivered", "disputed", "completed", "refunded", "split"] },
        [Op.or]: [{ creator_email: { [Op.iLike]: email } }, { counterparty_email: { [Op.iLike]: email } }, { creator_customer_id: sess.customer_id }, { counterparty_customer_id: sess.customer_id }],
      },
      order: [["updated_at", "DESC"]],
      limit: 200,
    });
    const payouts = await sequelize.query<{ withdrawal_id: number; escrow_id: number; status: string; net_usd: string; payout_key: string; address: string }>(
      `SELECT withdrawal_id, escrow_id, status, net_usd, payout_key, address FROM tbl_customer_withdrawal WHERE customer_id = :cid AND source = 'settlement' AND escrow_id IS NOT NULL`,
      { replacements: { cid: sess.customer_id }, type: QueryTypes.SELECT }
    );
    const CLOSED = ["completed", "refunded", "split"];
    const dealItems = deals
      .map((d) => {
        const actor = actorFor(d, sess);
        if (!actor) return null;
        const closed = CLOSED.includes(String(d.status)) && !!d.outcome;
        const b = dealFeeBreakdown(d);
        const shares = feeShares(b.totalCost, String(d.fee_payer));
        const mine = actor.role === "buyer" ? Number(d.buyer_entitlement_stable || 0) : Number(d.seller_entitlement_stable || 0);
        const p = payouts.find((x) => Number(x.escrow_id) === Number(d.escrow_id));
        const fromBalance = String(d.funding_method) === "balance";
        const outcomeLabel: Record<string, string> = { release: "Completed", refund: "Refunded", split: "Split" };
        return {
          type: "deal" as const,
          id: `SD-${d.escrow_id}`,
          escrow_id: d.escrow_id,
          deal_token: d.deal_token,
          invoice_no: `SD-${d.escrow_id}`,
          title: d.title,
          status: d.status,
          outcome: d.outcome,
          state: closed ? String(d.outcome) : "funded",
          state_label: closed ? (outcomeLabel[String(d.outcome)] || "Completed") : "Funded",
          date: d.fully_paid_at || d.outcome_authorized_at || d.completed_at || d.refunded_at || d.funding_settled_at || d.updated_at,
          closed_at: d.fully_paid_at || d.outcome_authorized_at || d.completed_at || d.refunded_at || d.updated_at,
          my_role: actor.role,
          amount: Number(d.amount),
          currency: d.currency,
          funding_coin: d.funding_coin,
          funding_method: d.funding_method || null,
          funding_label: fromBalance ? "Wallet balance" : d.funding_coin ? `${d.funding_coin} (crypto)` : "Crypto",
          fee_payer: d.fee_payer,
          total_cost: b.totalCost,
          cost_items: b.costItems,
          my_fee_share: actor.role === "buyer" ? shares.buyer : shares.seller,
          buyer_paid: Number(d.funded_amount_usd ?? b.buyerPays),
          my_amount: mine,
          my_payout: p ? { withdrawal_id: p.withdrawal_id, status: p.status, net_usd: Number(p.net_usd), payout_key: p.payout_key, address: p.address } : null,
        };
      })
      .filter(Boolean) as any[];

    const topups = await listTopups(sess.customer_id, 50);
    const depositItems = topups
      .filter((t) => t.status === "credited")
      .map((t) => {
        const m = FUNDING_COIN_META[t.coin];
        const net = Number(t.network_fee_usd || 0);
        const conv = Number(t.conversion_fee_usd || 0);
        const exch = Number(t.exchange_fee_usd || 0);
        return {
          type: "deposit" as const,
          id: `DEP-${t.topup_id}`,
          topup_id: t.topup_id,
          invoice_no: `DEP-${t.topup_id}`,
          title: "Deposit to wallet balance",
          state: "credited",
          state_label: "Credited",
          date: t.credited_at || t.created_at,
          closed_at: t.credited_at || t.created_at,
          coin: t.coin,
          coin_label: m?.label || t.coin,
          network: m?.network || t.coin,
          amount: Number(t.amount_usd),
          currency: "USD",
          received_usd: Number(t.pays_usd),
          network_fee_usd: net,
          conversion_fee_usd: conv,
          exchange_fee_usd: exch,
          total_fee_usd: Math.round((net + conv + exch) * 100) / 100,
          credited_usd: Number(t.amount_usd),
        };
      });

    const out = [...dealItems, ...depositItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return successResponseHelper(res, 200, "OK", out, out.length);
  } catch (e) {
    return handle(res, e, "invoices");
  }
};

/** POST /admin/run-reminders — the once-only reminder scan (also runs hourly via cron). */
const adminRunReminders = async (_req: express.Request, res: express.Response) => {
  try {
    const r = await runSafeDealReminders();
    const count = Object.values(r).reduce((n, ids) => n + ids.length, 0);
    return successResponseHelper(res, 200, `Sent ${count} reminder(s).`, { ...r, count });
  } catch (e) {
    return handle(res, e, "adminRunReminders");
  }
};

const uploadAttachment = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const { deal, actor } = await loadDealActor(req.params.token, sess);
    if (!["funded", "delivered", "disputed"].includes(deal.status)) fail(409, "Files can be attached once the deal is funded.");
    const file = (req as express.Request & { file?: Express.Multer.File }).file;
    if (!file) return errorResponseHelper(res, 400, "No file uploaded.");
    const out = await storeUpload({ escrow_id: Number(deal.escrow_id), company_id: Number(deal.company_id) }, { role: actor.role, email: sess.email }, file);
    return successResponseHelper(res, 201, "File uploaded.", out);
  } catch (e) {
    return handle(res, e, "uploadAttachment");
  }
};

const downloadAttachment = async (req: express.Request, res: express.Response) => {
  try {
    const { deal } = await loadDealActor(req.params.token, session(res));
    const row = await getAttachment(Number(deal.escrow_id), Number(req.params.id));
    if (!row || row.context === "pending") return errorResponseHelper(res, 404, "File not found.");
    await streamAttachment(res, row);
  } catch (e) {
    return handle(res, e, "downloadAttachment");
  }
};

const adminDownloadAttachment = async (req: express.Request, res: express.Response) => {
  try {
    const row = await getAttachmentById(Number(req.params.id));
    if (!row) return errorResponseHelper(res, 404, "File not found.");
    await streamAttachment(res, row);
  } catch (e) {
    return handle(res, e, "adminDownloadAttachment");
  }
};

// ── wallet ───────────────────────────────────────────────────────────────────

const wallet = async (_req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const [balances, addresses, withdrawals, profile, topups, eligible] = await Promise.all([
      getBalances(sess.customer_id),
      listAddresses(sess.customer_id),
      listWithdrawals(sess.customer_id, 20),
      loadProfile(sess.customer_id),
      listTopups(sess.customer_id, 10),
      payoutEligibleUsd(sess.customer_id),
    ]);
    return successResponseHelper(res, 200, "OK", {
      ...balances,
      wallet: balances,
      addresses,
      withdrawals,
      topups,
      profile: { auto_withdraw: !!profile?.auto_withdraw, auto_withdraw_address_id: profile?.auto_withdraw_address_id || null, parked_payout_usd: Math.min(Number(profile?.parked_payout_usd || 0), eligible), deposit_reserved_usd: Number(profile?.deposit_reserved_usd || 0), withdrawal_fee_credit_usd: round2(Number(profile?.withdrawal_fee_credit_usd || 0)) },
      limits: { min_withdrawal_usd: MIN_WITHDRAWAL_USD, approval_threshold_usd: APPROVAL_THRESHOLD_USD, min_topup_usd: MIN_TOPUP_USD, max_topup_usd: MAX_TOPUP_USD },
      payout_options: ESCROW_PAYOUT_OPTIONS,
      live: isLiveSettlementEnabled(),
      simulation_allowed: isSimulationAllowed(),
    });
  } catch (e) {
    return handle(res, e, "wallet");
  }
};

// ── wallet top-ups (deposit crypto → USD balance) ────────────────────────────

const topupCoins = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const amount = Number((req.query as Record<string, string>).amount || 0);
    if (!(amount > 0)) return errorResponseHelper(res, 400, "Enter an amount to top up.");
    void refreshEscrowCostRates();
    const coins = await topupQuotes(sess.company_id, amount);
    return successResponseHelper(res, 200, "OK", { amount, coins, min_topup_usd: MIN_TOPUP_USD, max_topup_usd: MAX_TOPUP_USD, live: isLiveSettlementEnabled() }, coins.length);
  } catch (e) {
    return handle(res, e, "topupCoins");
  }
};

const topupCreate = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const customer = await customerFor(sess);
    const row = await createTopup(customer, Number(req.body?.amount), String(req.body?.coin || ""));
    const m = FUNDING_COIN_META[row.coin];
    return successResponseHelper(res, 201, `Send exactly ${row.crypto_amount} ${m?.label || row.coin} on ${m?.network || row.coin}. Your balance is credited ${toFixedStr(Number(row.amount_usd), 2)} USD once it confirms.`, { topup: row, live: isLiveSettlementEnabled() });
  } catch (e) {
    return handle(res, e, "topupCreate");
  }
};

const topupList = async (_req: express.Request, res: express.Response) => {
  try {
    const rows = await listTopups(session(res).customer_id, 20);
    return successResponseHelper(res, 200, "OK", rows, rows.length);
  } catch (e) {
    return handle(res, e, "topupList");
  }
};

const topupGet = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const row = await getTopup(sess.customer_id, Number(req.params.id));
    return successResponseHelper(res, 200, "OK", { topup: row, wallet: await getBalances(sess.customer_id), live: isLiveSettlementEnabled() });
  } catch (e) {
    return handle(res, e, "topupGet");
  }
};

/** Preview only (live settlement OFF): pretend the deposit arrived and credit the wallet. */
const topupSimulate = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const row = await simulateTopup(sess.customer_id, Number(req.params.id));
    return successResponseHelper(res, 200, `${toFixedStr(Number(row.amount_usd), 2)} USD credited to your balance.`, { topup: row, wallet: await getBalances(sess.customer_id) });
  } catch (e) {
    return handle(res, e, "topupSimulate");
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
    // A parked deal payout goes out as soon as an address is usable (immediately if the cooling-off is over).
    void releaseParkedPayouts(customer.customer_id);
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

// A cashout held for admin approval (status 'pending_approval') must look like a normal queued
// cashout to the CUSTOMER — approval is invisible to them (admin-only concern). Admin endpoints
// use the raw row; every customer-facing response passes it through this masker first.
const maskWithdrawalForCustomer = <T extends { status?: string; requires_approval?: boolean }>(w: T): T =>
  w && w.status === "pending_approval" ? { ...w, status: "queued", requires_approval: false } : w;

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
    const [bal, feeCredit] = await Promise.all([getBalances(sess.customer_id), getWithdrawalFeeCredit(sess.customer_id)]);
    const q = quoteWithdrawal(String(key), Number(amount || 0), feeCredit);
    return successResponseHelper(res, 200, "OK", { ...q, fee_credit_available: feeCredit, available: bal.available, below_min: q.amount < MIN_WITHDRAWAL_USD, requires_approval: false });
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
    // 'pending_approval' is masked to a normal 'queued' cashout — the customer is never told
    // their cashout is under review (the admin is emailed to approve it behind the scenes).
    const msg = w.status === "sent" ? "Cashout sent." : "Cashout queued.";
    return successResponseHelper(res, 201, msg, { withdrawal: maskWithdrawalForCustomer(w), wallet: await getBalances(sess.customer_id) });
  } catch (e) {
    return handle(res, e, "withdraw");
  }
};

const withdrawals = async (_req: express.Request, res: express.Response) => {
  try {
    const rows = await listWithdrawals(session(res).customer_id, 100);
    return successResponseHelper(res, 200, "OK", rows.map(maskWithdrawalForCustomer), rows.length);
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
    return successResponseHelper(res, 200, "Cashout approved and sent.", w);
  } catch (e) {
    return handle(res, e, "adminApproveWithdrawal");
  }
};

const adminRejectWithdrawal = async (req: express.Request, res: express.Response) => {
  try {
    const admin = (res.locals.user as any)?.email || "admin";
    const w = await rejectWithdrawal(Number(req.params.id), String(admin), String(req.body?.reason || ""));
    return successResponseHelper(res, 200, "Cashout rejected — funds returned to the customer.", w);
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
    const [totals, pending, stats, keyStatus, pool] = await Promise.all([
      cid ? brandWalletTotals(cid) : Promise.resolve(null),
      cid ? adminListWithdrawals({ status: "pending_approval", companyId: cid }, 500) : Promise.resolve([]),
      cid
        ? sequelize.query<Record<string, string>>(
            `SELECT ${DEAL_STATS_SELECT},
                    COUNT(*) FILTER (WHERE status = 'disputed') AS disputed, COALESCE(SUM(custody_amount_stable) FILTER (WHERE status IN ('funded','delivered','disputed')),0) AS in_custody,
                    COALESCE(SUM(custody_realized_usd) FILTER (WHERE status IN ('funded','delivered','disputed')),0) AS realized
               FROM tbl_escrow_deal WHERE source = 'safedeal' AND company_id = :cid`,
            { replacements: { cid }, type: QueryTypes.SELECT }
          ).then((r) => r[0])
        : Promise.resolve(null),
      syncSafeDealApiKey().then(apiKeyStatus),
      b
        ? sequelize.query<{ wallet_type: string; ready: string }>(
            `SELECT wallet_type, COUNT(*) FILTER (WHERE status IN ('AVAILABLE','PRE_RESERVED')) AS ready
               FROM tbl_merchant_temp_address WHERE owner_user_id = :uid GROUP BY wallet_type`,
            { replacements: { uid: Number(b.user_id) }, type: QueryTypes.SELECT }
          )
        : Promise.resolve([]),
    ]);
    const poolByCoin = Object.fromEntries(pool.map((p) => [p.wallet_type, Number(p.ready)]));
    const coinsWithoutPool = configured.filter((w) => !(poolByCoin[w.coin] > 0)).map((w) => w.coin);
    const feeExempt = isPlatformFeeExemptCompany(cid);
    const secretSet = !!(envRaw("SAFEDEAL_WEBHOOK_SECRET") || "").trim();
    // Read-only Binance API key diagnostic (never mutates Binance). Only when live settlement is
    // on — and time-boxed so a blocked network can't hang the admin dashboard.
    let binancePerms: import("../services/binanceService").BinanceApiKeyPermissions | null = null;
    let binancePermsError: string | null = null;
    if (live) {
      try {
        const { getApiKeyPermissions } = await import("../services/binanceService");
        const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
          Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
        binancePerms = await withTimeout(getApiKeyPermissions(), 8000);
      } catch (e) {
        binancePermsError = (e as Error).message;
      }
    }
    const checks = [
      { key: "brand", ok: !!b, label: "SafeDeal brand configured", detail: b ? `SAFEDEAL_COMPANY_ID=${cid} → "${b.company_name}" (owner user ${b.user_id})` : "Set SAFEDEAL_COMPANY_ID to the SafeDeal brand's company_id." },
      {
        key: "api_key",
        ok: keyStatus.configured && keyStatus.resolves && keyStatus.company_match && keyStatus.active,
        label: "Dynopay API key (Merchant API funding)",
        detail: !keyStatus.configured
          ? "SAFEDEAL_API_KEY is not set — create a live key on the SafeDeal brand (Dashboard → API keys) and put it in the env."
          : !keyStatus.resolves
          ? "SAFEDEAL_API_KEY does not match any Dynopay API key (revoked or mistyped)."
          : !keyStatus.company_match
          ? `SAFEDEAL_API_KEY belongs to another brand — it must be a key of brand ${cid}.`
          : !keyStatus.active
          ? `Key ${keyStatus.key_hint || ""} is inactive or expired.`
          : `Key ${keyStatus.key_hint || ""} (${keyStatus.api_name || "unnamed"}) → brand ${cid}. Funding = POST /api/user/cryptoPayment (merchant-pool address per deal).`,
      },
      {
        key: "webhook",
        ok: secretSet && keyStatus.webhook_secret_synced,
        warn: secretSet && !keyStatus.webhook_secret_synced,
        label: "Signed payment webhooks (Dynopay → SafeDeal)",
        detail: !secretSet
          ? "SAFEDEAL_WEBHOOK_SECRET is not set — payment events can't be verified."
          : keyStatus.webhook_secret_synced
          ? `HMAC v2 secret synced onto the API key · ${safedealWebhookUrl()}`
          : "Secret set but not yet synced onto the API key — it syncs at boot once the key resolves.",
      },
      { key: "url", ok: !!safedealUrl && (!live || /^https:\/\/(www\.)?safedeal\.sh/.test(safedealUrl)), label: "Public URL (invite links, emails, redirect)", detail: safedealUrl ? `SAFEDEAL_URL=${safedealUrl}${live && !/safedeal\.sh/.test(safedealUrl) ? " — live mode should point at https://safedeal.sh" : ""}` : "SAFEDEAL_URL is not set; links fall back to <FRONTEND_URL>/safedeal." },
      { key: "live", ok: true, warn: !live, label: live ? "Live settlement ON — real money moves" : "Live settlement OFF — payouts are simulated", detail: `ESCROW_LIVE_SETTLEMENT=${live ? "true" : "false"}${live ? "" : " · deposit addresses are real (Dynopay API); 'Simulate payment' funds the deal without a transfer"}` },
      { key: "wallets", ok: configured.length > 0, label: "Funding coins on the SafeDeal brand", detail: configured.length ? `${configured.length} coin(s): ${configured.map((w) => w.coin).join(", ")}` : "No crypto wallets on the brand — add wallets to brand " + cid + " in the Dynopay dashboard." },
      { key: "custody", ok: configured.length > 0 && custodyCoins.length === configured.length, warn: configured.length > 0 && custodyCoins.length !== configured.length, label: "Brand wallets = Dynopay custody (Binance deposit addresses)", detail: configured.length ? `${custodyCoins.length}/${configured.length} brand wallets match the platform custody address for their coin. Every funded deal forwards there in one transfer; the 5% escrow fee stays on Binance as SafeDeal profit.` : "Add wallets first." },
      { key: "pool", ok: configured.length > 0 && coinsWithoutPool.length === 0, warn: coinsWithoutPool.length > 0, label: "Merchant pool has deposit addresses for every funding coin", detail: coinsWithoutPool.length ? `No pre-warmed pool address for: ${coinsWithoutPool.join(", ")} — the first payment in that coin creates one on the fly (slower).` : `Ready addresses: ${configured.map((w) => `${w.coin} ${poolByCoin[w.coin]}`).join(" · ")}` },
      { key: "fee_exempt", ok: feeExempt, label: "No Dynopay merchant fee on the SafeDeal brand", detail: feeExempt ? "Brand is first-party: 0% + $0 platform fee, no fee-sweep transaction. Only the escrow fee & real network costs apply." : "Brand is being charged the normal Dynopay merchant fee — add it to PLATFORM_FEE_EXEMPT_COMPANY_IDS." },
      { key: "autoconvert", ok: !!b?.auto_convert_enabled, warn: !b?.auto_convert_enabled, label: "Auto-convert volatile coins to USDT on Binance (held, not withdrawn)", detail: b?.auto_convert_enabled ? `${b.settlement_currency} on ${b.settlement_chain} · converted USDT is HELD on Binance as escrow custody (Phase 3 withdrawal skipped for this brand)` : "Off — BTC/ETH funding would stay volatile. Enable auto-convert on the brand (Settings → Payouts); any settlement address works, it's never used for SafeDeal." },
      { key: "fees", ok: escrowEngine.ESCROW_FEE_PERCENT > 0 && escrowEngine.ESCROW_FEE_MIN_USD > 0 && escrowEngine.ESCROW_MIN_DEAL_USD >= escrowEngine.ESCROW_FEE_MIN_USD, label: "Escrow fee & minimums", detail: `fee ${escrowEngine.ESCROW_FEE_PERCENT}% (min $${escrowEngine.ESCROW_FEE_MIN_USD}) · min deal $${escrowEngine.ESCROW_MIN_DEAL_USD} · min withdrawal $${MIN_WITHDRAWAL_USD} · approval above $${APPROVAL_THRESHOLD_USD} · payouts at close via Binance to the party's address` },
      { key: "email", ok: true, warn: emailDisabled(), label: emailDisabled() ? "Outbound email OFF — codes are shown in the UI instead" : "Outbound email ON", detail: `DISABLE_OUTBOUND_EMAIL=${emailDisabled() ? "true" : "false"}` },
      {
        key: "binance_key",
        ok: live ? (!!binancePerms && binancePerms.ipRestrict && binancePerms.enableWithdrawals) : true,
        warn: live && (!binancePerms || !binancePerms.ipRestrict),
        label: "Binance API key — IP allowlist + withdrawals enabled",
        detail: binancePerms
          ? `ipRestrict=${binancePerms.ipRestrict} · withdrawals=${binancePerms.enableWithdrawals} · reading=${binancePerms.enableReading} · spot/margin=${binancePerms.enableSpotAndMarginTrading}`
            + (binancePerms.ipRestrict ? "" : " · ⚠️ NO IP allowlist — restrict the key to your server IP(s) in Binance → API Management")
            + (binancePerms.enableWithdrawals ? "" : " · ⚠️ withdrawals DISABLED — cashouts will fail until enabled")
          : live
            ? `Couldn't read Binance API key restrictions${binancePermsError ? ` (${binancePermsError})` : ""} — check BINANCE_API_KEY/SECRET and that this server's IP is allowed on the key.`
            : "Live settlement OFF — Binance key check skipped.",
      },
    ];
    return successResponseHelper(res, 200, "OK", {
      ready: checks.every((c) => c.ok),
      live_settlement: live,
      safedeal_url: safedealUrl || null,
      brand: b ? { company_id: cid, name: b.company_name, owner_user_id: Number(b.user_id), auto_convert: { enabled: !!b.auto_convert_enabled, currency: b.settlement_currency || null, chain: b.settlement_chain || null, address: maskAddr(b.settlement_wallet_address) || null } } : null,
      api_key: { ...keyStatus, webhook_url: safedealWebhookUrl() },
      binance_key: binancePerms ? { ...binancePerms, error: null } : { error: binancePermsError, checked: live },
      wallets: configured.map((w) => ({ coin: w.coin, address: maskAddr(w.address), custody: custodyCoins.some((c) => c.coin === w.coin), pool_ready: poolByCoin[w.coin] || 0 })),
      totals: totals ? { ...totals, pending_approvals: pending.length } : null,
      deals: stats
        ? (() => {
            const ds = toDealStats(stats);
            return { count: ds.deals_funded, total: ds.deals_total, open: ds.deals_open, closed_unfunded: ds.deals_closed_unfunded, volume: ds.deals_volume, active: ds.deals_active, disputed: Number(stats.disputed || 0), in_custody: Number(stats.in_custody || 0), realized: Number(stats.realized || 0) };
          })()
        : null,
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
      `SELECT ${DEAL_STATS_SELECT}
         FROM tbl_escrow_deal WHERE source = 'safedeal' AND (creator_customer_id = :id OR counterparty_customer_id = :id)`,
      { replacements: { id: customer.customer_id }, type: QueryTypes.SELECT }
    );
    const ds = toDealStats(dealStats);
    const wds = await listWithdrawals(customer.customer_id, 20);
    const addrs = await listAddresses(customer.customer_id);
    return successResponseHelper(res, 200, "OK", {
      customer: { customer_id: customer.customer_id, email: customer.email, name: customer.customer_name },
      wallet: balances,
      deals: { count: ds.deals_funded, volume: ds.deals_volume, active: ds.deals_active, open: ds.deals_open, total: ds.deals_total, closed_unfunded: ds.deals_closed_unfunded },
      entries: rows,
      withdrawals: wds,
      addresses: addrs.map((a) => ({ address_id: a.address_id, payout_key: a.payout_key, address: a.address, label: a.label })),
    });
  } catch (e) {
    return handle(res, e, "brandCustomerStatement");
  }
};

// ── account: add / verify an email (Telegram users, or anyone who wants email login) ──

/** Start adding an email to the signed-in account: validate + collision-check, then email a code. */
const addEmailStart = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const email = norm(req.body?.email);
    if (!emailOk(email)) return errorResponseHelper(res, 400, "Enter a valid email address.");
    if (isPlaceholderEmail(email)) return errorResponseHelper(res, 400, "Enter a real email address.");
    const customer = await customerFor(sess);
    const isFirstEmail = isPlaceholderEmail(customer.email);
    if (!isFirstEmail && norm(customer.email) === email) {
      return errorResponseHelper(res, 400, "That's already the email on your account.");
    }
    // ACCOUNT-TAKEOVER GUARD: changing an EXISTING real email requires a step-up code that was
    // emailed to the CURRENT address. A stolen session token alone can't complete this — the
    // attacker would need to read the victim's current mailbox. (First-time email add by a
    // Telegram-only account has no current mailbox to prove, so it's exempt.)
    if (!isFirstEmail) {
      await requireStepUp(sess, String(req.body?.code || ""));
    }
    // Decision 1: on collision we BLOCK (never merge two accounts on live money).
    const clash = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE company_id = :cid AND LOWER(email) = :email AND customer_id != :self LIMIT 1`,
      { replacements: { cid: sess.company_id, email, self: sess.customer_id }, type: QueryTypes.SELECT }
    );
    if (clash.length) return errorResponseHelper(res, 409, "That email already belongs to another SafeDeal account. Please sign in with that email instead.");
    const code = genCode();
    await setRedisItemWithTTL(otpKey("addemail", String(sess.customer_id)), { code, email, attempts: 0 }, OTP_TTL);
    void sendSafeDealCodeEmail(email, code, "signin");
    const payload: Record<string, unknown> = { email, expires_in: OTP_TTL };
    const preview = previewCodeFor(email, code);
    if (preview) payload.preview_code = preview; // reserved test domains only, outbound email off
    return successResponseHelper(res, 200, "We emailed a code to confirm this address.", payload);
  } catch (e) {
    return handle(res, e, "addEmailStart");
  }
};

/** Verify the code, set the real email, connect pending email invitations, re-issue the session. */
const addEmailVerify = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const code = String(req.body?.code || "").trim();
    if (!code) return errorResponseHelper(res, 400, "Enter the code we emailed you.");
    const key = otpKey("addemail", String(sess.customer_id));
    const stored: any = await getRedisItem(key);
    if (!stored || !stored.email) return errorResponseHelper(res, 400, "That code has expired. Request a new one.");
    if (!codeMatches(stored.code, code)) {
      const attempts = Number(stored.attempts || 0) + 1;
      if (attempts >= MAX_CODE_ATTEMPTS) await deleteRedisItem(key);
      else await setRedisItemWithTTL(key, { ...stored, attempts }, OTP_TTL);
      return errorResponseHelper(res, 400, "Incorrect code. Please check and try again.");
    }
    await deleteRedisItem(key);
    const email = norm(stored.email);
    const oldEmail = norm(sess.email);
    // A genuine change of an existing real email (not a Telegram-only first-time add).
    const wasRealEmailChange = !isPlaceholderEmail(oldEmail) && oldEmail !== email;
    // Re-check the collision at verify time (someone may have claimed it since start).
    const clash = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE company_id = :cid AND LOWER(email) = :email AND customer_id != :self LIMIT 1`,
      { replacements: { cid: sess.company_id, email, self: sess.customer_id }, type: QueryTypes.SELECT }
    );
    if (clash.length) return errorResponseHelper(res, 409, "That email already belongs to another SafeDeal account. Please sign in with that email instead.");
    await sequelize.query(`UPDATE tbl_customer SET email = :email, "updatedAt" = NOW() WHERE customer_id = :self AND company_id = :cid`, {
      replacements: { email, self: sess.customer_id, cid: sess.company_id },
      type: QueryTypes.UPDATE,
    });
    // Connect any pending email invitations addressed to this account.
    const result: any = await escrowDealModel.update(
      { counterparty_customer_id: sess.customer_id, counterparty_verified_at: new Date() } as any,
      { where: { source: "safedeal", counterparty_email: { [Op.iLike]: email }, counterparty_customer_id: null } as any }
    );
    const connected = Array.isArray(result) ? Number(result[0] || 0) : 0;
    if (wasRealEmailChange) {
      // Account-takeover containment: kill every previously issued session token and pause all
      // cashouts for 24h (routed to admin approval). The real owner is alerted on the OLD mailbox.
      await sequelize.query(
        `UPDATE tbl_safedeal_profile
            SET tokens_valid_after = NOW(), cashout_hold_until = NOW() + INTERVAL '24 hours', updated_at = NOW()
          WHERE customer_id = :cid`,
        { replacements: { cid: sess.customer_id }, type: QueryTypes.UPDATE }
      );
      await invalidateSdSessionEpochCache(sess.customer_id);
      void sendSafeDealEmailChangedAlertEmail(oldEmail, email);
      apiLogger.warn(`[SafeDeal] email changed for customer ${sess.customer_id}: sessions invalidated + 24h cashout hold applied.`);
    }
    const profile = await loadProfile(sess.customer_id);
    // Re-issue the session carrying the real email so future requests also match by email.
    const token = jwt.sign({ kind: "safedeal", cid: sess.customer_id, coid: sess.company_id, email }, secret(), { expiresIn: `${SESSION_DAYS}d` });
    return successResponseHelper(res, 200, "Email added. You can now log in with it too.", {
      token,
      user: { email, customer_id: sess.customer_id, display_name: profile?.display_name || null, email_is_placeholder: false },
      connected_deals: connected,
    });
  } catch (e) {
    return handle(res, e, "addEmailVerify");
  }
};

/** Claim the open counterparty seat on a shareable-link deal (the first signed-in visitor wins). */
const claimDeal = async (req: express.Request, res: express.Response) => {
  try {
    const sess = session(res);
    const deal: any = await escrowDealModel.findOne({ where: { deal_token: String(req.params.token), source: "safedeal" } });
    if (!deal) return errorResponseHelper(res, 404, "Deal not found.");
    if ((deal.invite_kind || "email") !== "link") return errorResponseHelper(res, 400, "This invite is addressed to a specific email — sign in with that email to open it.");
    const isCreator = (deal.creator_customer_id && Number(deal.creator_customer_id) === sess.customer_id) || norm(deal.creator_email) === norm(sess.email);
    if (isCreator) return errorResponseHelper(res, 400, "You created this deal — share the link with the other party.");
    if (deal.counterparty_customer_id) {
      if (Number(deal.counterparty_customer_id) === sess.customer_id) {
        return successResponseHelper(res, 200, "You're already on this deal.", await viewFull(deal, actorFor(deal, sess)!));
      }
      return errorResponseHelper(res, 409, "Someone has already joined this deal from the invite link.");
    }
    if (deal.status !== "invited") return errorResponseHelper(res, 409, "This deal can no longer be joined.");
    const customer = await customerFor(sess);
    await ensureProfile(customer);
    const { counterparty } = resolveRoles(deal.creator_role as EscrowRole);
    deal.counterparty_customer_id = sess.customer_id;
    deal.counterparty_email = customer.email || sess.email;
    deal.counterparty_claimed_at = new Date();
    deal.counterparty_verified_at = deal.counterparty_verified_at || new Date();
    deal.activity_log = appendActivity(deal.activity_log, { type: "claimed", actor: customer.email || sess.email, role: counterparty, note: "Joined the deal via the shareable invite link." });
    await deal.save();
    return successResponseHelper(res, 200, "You've joined the deal.", await viewFull(deal, actorFor(deal, sess)!));
  } catch (e) {
    return handle(res, e, "claimDeal");
  }
};

export default {
  sendCode,
  verifyCode,
  telegramAuth,
  telegramStatus,
  telegramLink,
  telegramTest,
  telegramUnlink,
  sendStepUp,
  me,
  updateProfile,
  addEmailStart,
  addEmailVerify,
  config,
  feePreview,
  listDeals,
  createDeal,
  previewDeal,
  getDeal,
  claimDeal,
  dealAction,
  getFunding,
  createFunding,
  dynopayWebhook,
  setPayoutDestination,
  dealPdf,
  invoices,
  uploadAttachment,
  downloadAttachment,
  adminDownloadAttachment,
  adminRunReminders,
  wallet,
  statement,
  statementCsv,
  addresses,
  createAddress,
  deleteAddress,
  withdrawQuote,
  withdraw,
  withdrawals,
  topupCoins,
  topupCreate,
  topupList,
  topupGet,
  topupSimulate,
  topupReceiptPdf,
  adminWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminReadiness,
  brandTotals,
  brandCustomerStatement,
};
