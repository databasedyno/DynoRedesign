/**
 * SafeDeal funding through Dynopay's Merchant API — SafeDeal is a normal API-key
 * merchant of Dynopay (brand SAFEDEAL_COMPANY_ID, key SAFEDEAL_API_KEY).
 *  - createFundingPayment(): POST /api/user/cryptoPayment → merchant-pool address + QR for the buyer's quote
 *  - handleDynopayWebhook(): HMAC-verified payment.* events → deal funded / settled
 *  - onCustodyConverted():  auto-convert finished on Binance → realised USDT recorded (custody stays on Binance)
 * Money path: buyer → merchant-pool address → SafeDeal brand wallet (= Dynopay custody / Binance deposit).
 */
import crypto from "crypto";
import axios from "axios";
import { Op, QueryTypes } from "sequelize";
import { raw as envRaw } from "../../utils/config";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { userWalletModel } from "../../models";
import escrowDealModel from "../../models/escrowDealModel";
import { hashApiKey } from "../../helper/apiKeyToken";
import { appendActivity, computeFeeBreakdown } from "../../controller/escrow/escrowShared";

export const SAFEDEAL_COMPANY_ID = Number(envRaw("SAFEDEAL_COMPANY_ID")) || 0;
export const isSafeDealCompany = (companyId?: number | string | null): boolean => !!SAFEDEAL_COMPANY_ID && Number(companyId) === SAFEDEAL_COMPANY_ID;

/** Coins the SafeDeal brand can accept; stablecoins first (no conversion, cheapest). */
export const FUNDING_COIN_META: Record<string, { label: string; network: string; stable?: boolean; cheap?: boolean }> = {
  "USDT-TRC20": { label: "USDT", network: "Tron (TRC-20)", stable: true, cheap: true },
  "USDT-POLYGON": { label: "USDT", network: "Polygon", stable: true, cheap: true },
  "USDC-ERC20": { label: "USDC", network: "Ethereum (ERC-20)", stable: true },
  "USDT-ERC20": { label: "USDT", network: "Ethereum (ERC-20)", stable: true },
  BTC: { label: "Bitcoin", network: "Bitcoin" },
  ETH: { label: "Ether", network: "Ethereum" },
  SOL: { label: "Solana", network: "Solana", cheap: true },
  TRX: { label: "TRON", network: "Tron", cheap: true },
  LTC: { label: "Litecoin", network: "Litecoin", cheap: true },
  DOGE: { label: "Dogecoin", network: "Dogecoin", cheap: true },
  BCH: { label: "Bitcoin Cash", network: "Bitcoin Cash", cheap: true },
  XRP: { label: "XRP", network: "XRP Ledger", cheap: true },
  POLYGON: { label: "POL", network: "Polygon", cheap: true },
};
export const FUNDING_COINS = Object.keys(FUNDING_COIN_META);
const RESERVATION_MINUTES = Number(envRaw("RESERVATION_TIMEOUT_MINUTES")) || 120;

export interface FundingPayment {
  payment_id: string;
  coin: string;
  address: string;
  destination_tag?: number | null;
  crypto_amount: string;
  base_amount: number;
  base_currency: string;
  qr_code?: string | null;
  status: "waiting" | "pending" | "underpaid" | "confirmed" | "settled" | "expired";
  created_at: string;
  expires_at: string;
  seen_tx?: string | null;
  received_crypto?: number | null;
  settlement_tx?: string | null;
  merchant_amount?: number | null;
  events?: { event: string; at: string }[];
}

const apiBase = (): string => (envRaw("SAFEDEAL_DYNOPAY_API_URL") || `http://127.0.0.1:${envRaw("PORT") || 8001}`).replace(/\/$/, "");
const publicBase = (): string => (envRaw("SERVER_URL") || "").trim().replace(/\/$/, "");
export const webhookUrl = (): string => `${publicBase()}/api/safedeal/webhooks/dynopay`;
const safedealBase = (): string => (envRaw("SAFEDEAL_URL") || `${(envRaw("FRONTEND_URL") || "").trim()}/safedeal`).replace(/\/$/, "");

export async function configuredFundingCoins(companyId: number): Promise<string[]> {
  const wallets = await userWalletModel.findAll({
    where: { company_id: companyId, wallet_type: { [Op.in]: FUNDING_COINS }, wallet_address: { [Op.not]: null } } as any,
    attributes: ["wallet_type"],
  });
  const set = new Set(wallets.map((w: any) => String(w.dataValues.wallet_type)));
  return FUNDING_COINS.filter((c) => set.has(c));
}

/** Coin picker payload: what the buyer would pay in each coin the brand accepts. */
export async function fundingCoins(deal: any): Promise<{ coin: string; label: string; network: string; stable: boolean; cheap: boolean; buyer_pays: number; network_fee: number; conversion_fee: number }[]> {
  const coins = await configuredFundingCoins(Number(deal.company_id));
  return coins.map((coin) => {
    const b = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: coin, acceptedCoins: deal.accepted_coins });
    const m = FUNDING_COIN_META[coin];
    return { coin, label: m.label, network: m.network, stable: !!m.stable, cheap: !!m.cheap, buyer_pays: b.buyerPays, network_fee: b.networkFeeUsd, conversion_fee: b.conversionFeeUsd };
  });
}

const apiKey = (): string => (envRaw("SAFEDEAL_API_KEY") || "").trim();

/** Ask Dynopay (as the SafeDeal merchant) for a deposit address in `coin` covering the buyer's quote. */
export async function createFundingPayment(deal: any, coin: string): Promise<FundingPayment> {
  const key = apiKey();
  if (!key) throw new Error("SafeDeal is not connected to Dynopay yet (SAFEDEAL_API_KEY missing).");
  const c = String(coin || "").toUpperCase().trim();
  if (!FUNDING_COIN_META[c]) throw new Error(`${coin} is not a supported funding coin.`);
  const configured = await configuredFundingCoins(Number(deal.company_id));
  if (!configured.includes(c)) throw new Error(`${c} is not enabled on the SafeDeal brand.`);

  const existing = deal.funding_payment as FundingPayment | null;
  if (existing && existing.coin === c && ["waiting", "pending", "underpaid"].includes(existing.status) && new Date(existing.expires_at).getTime() > Date.now()) return existing;

  const breakdown = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: c, acceptedCoins: deal.accepted_coins });
  const body = {
    amount: breakdown.buyerPays,
    currency: c,
    fee_payer: "company",
    redirect_uri: `${safedealBase()}/deal/${deal.deal_token}?funded=1`,
    webhook_url: webhookUrl(),
    meta_data: { source: "safedeal", escrow_id: Number(deal.escrow_id), deal_token: deal.deal_token },
  };
  const res = await axios.post(`${apiBase()}/api/user/cryptoPayment`, body, {
    headers: { "x-api-key": key, "Content-Type": "application/json", "Idempotency-Key": `sd-${deal.escrow_id}-${c}-${Date.now()}` },
    timeout: 25000,
    validateStatus: () => true,
  });
  const d = res.data?.data;
  if (res.status !== 200 || !d?.address) {
    const msg = res.data?.message || res.data?.error?.message || `Dynopay API returned ${res.status}`;
    apiLogger.error(`[SafeDeal] cryptoPayment failed for escrow ${deal.escrow_id} (${c}): ${msg}`);
    throw new Error(`Couldn't create the payment: ${msg}`);
  }
  const now = new Date();
  const fp: FundingPayment = {
    payment_id: String(d.transaction_id),
    coin: c,
    address: String(d.address),
    destination_tag: d.destination_tag != null ? Number(d.destination_tag) : null,
    crypto_amount: String(d.amount),
    base_amount: Number(d.base_amount ?? breakdown.buyerPays),
    base_currency: String(d.base_currency || deal.currency || "USD"),
    qr_code: d.qr_code || null,
    status: "waiting",
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + RESERVATION_MINUTES * 60000).toISOString(),
    events: [{ event: "created", at: now.toISOString() }],
  };
  deal.funding_payment = fp;
  deal.funding_link_transaction_id = fp.payment_id;
  deal.funding_deposit_address = fp.address;
  deal.funding_coin = c;
  deal.funding_crypto_amount = Number(fp.crypto_amount) || null;
  deal.funding_method = "dynopay_api";
  deal.activity_log = appendActivity(deal.activity_log, {
    type: "funding_address",
    actor: "buyer",
    role: "buyer",
    note: `Payment address issued: ${fp.crypto_amount} ${c} (${breakdown.buyerPays} ${deal.currency}) via Dynopay.`,
    meta: { payment_id: fp.payment_id, coin: c },
  });
  await deal.save();
  apiLogger.info(`[SafeDeal] funding payment ${fp.payment_id} (${fp.crypto_amount} ${c}) issued for escrow ${deal.escrow_id}`);
  return fp;
}

/** Settlement rows are written by chain verification — a safety net if a webhook was missed. */
export async function syncFundingFromLedger(deal: any): Promise<void> {
  const fp = deal.funding_payment as FundingPayment | null;
  if (!fp || deal.status !== "awaiting_payment") return;
  const rows = await sequelize.query<{ status: string; transaction_reference: string | null }>(
    `SELECT status, transaction_reference FROM tbl_user_transaction WHERE id = :pid ORDER BY transaction_id DESC LIMIT 1`,
    { replacements: { pid: fp.payment_id }, type: QueryTypes.SELECT }
  );
  const row = rows[0];
  if (row && ["successful", "completed", "complete", "settled"].includes(String(row.status).toLowerCase())) {
    const { escrowEngine } = await import("../../controller/escrowController");
    await escrowEngine.actFundFromCheckout(deal, fp.base_amount, fp.coin, String(row.transaction_reference || ""));
    await patchFunding(deal, { status: "confirmed", seen_tx: row.transaction_reference || null }, "ledger-sync");
  }
}

async function patchFunding(deal: any, patch: Partial<FundingPayment>, event: string): Promise<void> {
  const fp = { ...((deal.funding_payment as FundingPayment) || {}), ...patch } as FundingPayment;
  fp.events = [...(fp.events || []), { event, at: new Date().toISOString() }].slice(-20);
  deal.funding_payment = fp;
  deal.changed("funding_payment", true);
  await deal.save();
}

// ── webhook (Dynopay → SafeDeal) ─────────────────────────────────────────────

export function verifyDynopaySignature(rawBody: Buffer | string, header: string | undefined, secret: string, toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.trim().split("=") as [string, string]).filter((p) => p.length === 2));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`).digest("hex");
  const sigs = header.split(",").map((kv) => kv.trim()).filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s, "hex"), Buffer.from(expected, "hex")));
}

export async function handleDynopayWebhook(payload: Record<string, any>): Promise<{ handled: boolean; note: string }> {
  const event = String(payload.event || "");
  let meta = payload.meta_data;
  if (typeof meta === "string") { try { meta = JSON.parse(meta); } catch { meta = null; } }
  const escrowId = Number(meta?.escrow_id) || 0;
  const paymentId = payload.payment_id ? String(payload.payment_id) : "";
  const where: any = escrowId ? { escrow_id: escrowId, source: "safedeal" } : paymentId ? { funding_link_transaction_id: paymentId, source: "safedeal" } : null;
  if (!where) return { handled: false, note: "no escrow reference" };
  const deal: any = await escrowDealModel.findOne({ where });
  if (!deal) return { handled: false, note: `deal not found (${escrowId || paymentId})` };
  const fp = deal.funding_payment as FundingPayment | null;
  const txId = payload.txId || payload.transaction_reference ? String(payload.txId || payload.transaction_reference) : null;
  const coin = String(payload.currency || fp?.coin || deal.funding_coin || "USDT-TRC20");
  const { escrowEngine } = await import("../../controller/escrowController");

  switch (event) {
    case "payment.pending":
      if (deal.status === "awaiting_payment") await patchFunding(deal, { status: "pending", seen_tx: txId, received_crypto: Number(payload.amount) || null }, event);
      return { handled: true, note: "pending recorded" };
    case "payment.underpaid":
      if (deal.status === "awaiting_payment") await patchFunding(deal, { status: "underpaid", seen_tx: txId, received_crypto: Number(payload.amount) || null }, event);
      return { handled: true, note: "underpaid recorded" };
    case "payment.confirmed":
    case "payment.overpaid":
    case "payment.settled": {
      if (deal.status === "awaiting_payment") {
        await escrowEngine.actFundFromCheckout(deal, Number(payload.base_amount) || fp?.base_amount || Number(deal.amount), coin, txId || "");
      }
      const patch: Partial<FundingPayment> = event === "payment.settled"
        ? { status: "settled", settlement_tx: payload.settlement_tx_id || null, merchant_amount: payload.merchant_amount != null ? Number(payload.merchant_amount) : null, seen_tx: txId || fp?.seen_tx || null }
        : { status: fp?.status === "settled" ? "settled" : "confirmed", seen_tx: txId || fp?.seen_tx || null, received_crypto: Number(payload.amount) || fp?.received_crypto || null };
      if (event === "payment.settled") deal.funding_settled_at = new Date();
      await patchFunding(deal, patch, event);
      return { handled: true, note: `${event} → deal ${deal.status}` };
    }
    case "payment.expired":
      if (deal.status === "awaiting_payment") await patchFunding(deal, { status: "expired" }, event);
      return { handled: true, note: "expired recorded" };
    default:
      return { handled: false, note: `ignored ${event}` };
  }
}

// ── Binance custody reconciliation (auto-convert finished) ───────────────────

/** Phase 2 converted a SafeDeal deposit to USDT: it stays on Binance — record what was realised. */
export async function onCustodyConverted(conv: { conversion_id: number; transaction_id: number; source_currency: string; source_amount: string | number; target_currency: string; merchant_payout_usd?: string | number | null; target_amount?: string | number | null; conversion_rate?: string | number | null }): Promise<void> {
  try {
    const rows = await sequelize.query<{ id: string | null; transaction_reference: string | null; incoming_tx_hash: string | null }>(
      `SELECT id, transaction_reference, incoming_tx_hash FROM tbl_user_transaction WHERE transaction_id = :id LIMIT 1`,
      { replacements: { id: conv.transaction_id }, type: QueryTypes.SELECT }
    );
    const tx = rows[0];
    if (!tx) return;
    const hashes = [tx.transaction_reference, tx.incoming_tx_hash].filter(Boolean) as string[];
    const deal: any = await escrowDealModel.findOne({
      where: { source: "safedeal", [Op.or]: [{ funding_link_transaction_id: tx.id || "" }, ...(hashes.length ? [{ funding_tx_hash: { [Op.in]: hashes } }] : [])] } as any,
    });
    if (!deal) return;
    const realized = Number(conv.merchant_payout_usd ?? conv.target_amount ?? 0);
    deal.custody_realized_usd = realized;
    deal.custody_realized_at = new Date();
    const held = Number(deal.custody_amount_stable || 0);
    const b = computeFeeBreakdown({ amount: deal.amount, currency: deal.currency, feePercent: deal.fee_percent, feeMinUsd: deal.fee_min_usd, feePayer: deal.fee_payer, payoutCoin: deal.seller_payout_coin, fundingCoin: deal.funding_coin, acceptedCoins: deal.accepted_coins });
    const shortfall = Math.round((held - realized) * 100) / 100;
    if (shortfall > b.passThroughCosts) deal.needs_admin_review = true;
    deal.activity_log = appendActivity(deal.activity_log, {
      type: "custody_converted",
      actor: "binance",
      role: "system",
      note: `Converted ${conv.source_amount} ${conv.source_currency} → ${realized.toFixed(2)} ${conv.target_currency} on Binance (held there as custody)${shortfall > 0 ? `; ${shortfall.toFixed(2)} USD below the quote${shortfall > b.passThroughCosts ? " — flagged for review" : ", covered by the cost reserve"}` : ""}.`,
      meta: { conversion_id: conv.conversion_id, rate: conv.conversion_rate, realized, held },
    });
    await deal.save();
    apiLogger.info(`[SafeDeal] custody reconciled for escrow ${deal.escrow_id}: realised ${realized} ${conv.target_currency} (held ${held})`);
  } catch (err) {
    apiLogger.error(`[SafeDeal] onCustodyConverted failed for conversion ${conv.conversion_id}: ${(err as Error).message}`);
  }
}

// ── API-key health (boot sync + readiness) ───────────────────────────────────

export interface ApiKeyStatus {
  configured: boolean;
  resolves: boolean;
  company_match: boolean;
  active: boolean;
  key_hint: string | null;
  api_name: string | null;
  webhook_secret_synced: boolean;
  webhook_url: string;
}

export async function apiKeyStatus(): Promise<ApiKeyStatus> {
  const key = apiKey();
  const secret = (envRaw("SAFEDEAL_WEBHOOK_SECRET") || "").trim();
  const out: ApiKeyStatus = { configured: !!key, resolves: false, company_match: false, active: false, key_hint: null, api_name: null, webhook_secret_synced: false, webhook_url: webhookUrl() };
  if (!key) return out;
  const rows = await sequelize.query<{ company_id: number; status: string; key_hint: string | null; api_name: string | null; webhook_secret: string | null; expires_at: string | null }>(
    `SELECT company_id, status, key_hint, api_name, webhook_secret, expires_at FROM tbl_api WHERE key_hash = :h LIMIT 1`,
    { replacements: { h: hashApiKey(key) }, type: QueryTypes.SELECT }
  );
  const r = rows[0];
  if (!r) return out;
  out.resolves = true;
  out.company_match = isSafeDealCompany(r.company_id);
  out.active = r.status === "active" && (!r.expires_at || new Date(r.expires_at).getTime() > Date.now());
  out.key_hint = r.key_hint;
  out.api_name = r.api_name;
  out.webhook_secret_synced = !!secret && r.webhook_secret === secret;
  return out;
}

/** Boot: make sure Dynopay signs SafeDeal's webhooks with SAFEDEAL_WEBHOOK_SECRET. */
export async function syncSafeDealApiKey(): Promise<void> {
  try {
    const key = apiKey();
    const secret = (envRaw("SAFEDEAL_WEBHOOK_SECRET") || "").trim();
    if (!key || !SAFEDEAL_COMPANY_ID) return;
    const st = await apiKeyStatus();
    if (!st.resolves) { apiLogger.warn("[SafeDeal] SAFEDEAL_API_KEY does not match any Dynopay API key"); return; }
    if (!st.company_match) { apiLogger.warn(`[SafeDeal] SAFEDEAL_API_KEY belongs to another brand, not company ${SAFEDEAL_COMPANY_ID}`); return; }
    if (secret && !st.webhook_secret_synced) {
      await sequelize.query(`UPDATE tbl_api SET webhook_secret = :s WHERE key_hash = :h AND company_id = :cid`, {
        replacements: { s: secret, h: hashApiKey(key), cid: SAFEDEAL_COMPANY_ID },
        type: QueryTypes.UPDATE,
      });
      apiLogger.info(`[SafeDeal] webhook signing secret synced onto API key ${st.key_hint || ""}`);
    }
  } catch (err) {
    apiLogger.error(`[SafeDeal] syncSafeDealApiKey failed: ${(err as Error).message}`);
  }
}

/** Legacy hosted-checkout links (link_type=escrow) created before the API-key integration. */
export async function onPaymentLinkPaid(linkTransactionId: string, info: { paidUsd?: number; coin?: string; txHash?: string }): Promise<void> {
  try {
    const deal: any = await escrowDealModel.findOne({ where: { funding_link_transaction_id: String(linkTransactionId), funding_link_ref: { [Op.not]: null } } as any });
    if (!deal) return;
    const { escrowEngine } = await import("../../controller/escrowController");
    await escrowEngine.actFundFromCheckout(deal, Number(info.paidUsd || deal.amount), String(info.coin || "USDT-TRC20"), String(info.txHash || ""));
  } catch (err) {
    apiLogger.error(`[SafeDeal] onPaymentLinkPaid failed for ${linkTransactionId}: ${(err as Error).message}`);
  }
}
