/**
 * SafeDeal wallet top-ups — a customer deposits crypto (via Dynopay's Direct API, same rail
 * as deal funding) and their SafeDeal customer wallet (tbl_customer_wallet.amount) is credited
 * in USD once the payment confirms. Non-stablecoin deposits carry the exchange fee + Binance
 * conversion cost; every deposit carries the inbound network fee. The credit is always the
 * USD amount the customer asked for; fees are added on top of what they send.
 */
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import { num } from "../../utils/config";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";
import { toFixedStr } from "../../utils/money";
import { CustomerRow, CustomerWalletError } from "../customerWalletService";
import { getEscrowCostRates, isStableFundingCoin, sweepFeeUsdFor } from "../escrow/escrowCosts";
import { isLiveSettlementEnabled } from "../../controller/escrow/escrowShared";
import { applyEntries } from "./safedealWallet";
import { FUNDING_COIN_META, configuredFundingCoins, requestDynopayPayment } from "./safedealCheckout";

export const MIN_TOPUP_USD = num("SAFEDEAL_MIN_TOPUP_USD", 10);
export const MAX_TOPUP_USD = num("SAFEDEAL_MAX_TOPUP_USD", 25000);
const RESERVATION_MINUTES = num("RESERVATION_TIMEOUT_MINUTES", 120);
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export type TopupStatus = "waiting" | "pending" | "underpaid" | "credited" | "expired";

export interface TopupRow {
  topup_id: number;
  company_id: number;
  customer_id: number;
  coin: string;
  amount_usd: string | number;
  network_fee_usd: string | number;
  conversion_fee_usd: string | number;
  exchange_fee_usd: string | number;
  pays_usd: string | number;
  payment_id: string | null;
  address: string | null;
  destination_tag: number | null;
  crypto_amount: string | null;
  qr_code: string | null;
  status: TopupStatus;
  seen_tx: string | null;
  received_crypto: string | number | null;
  simulated: boolean;
  expires_at: string;
  credited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopupQuote {
  coin: string;
  label: string;
  network: string;
  stable: boolean;
  cheap: boolean;
  amount: number;
  network_fee: number;
  conversion_fee: number;
  exchange_fee: number;
  exchange_fee_percent: number;
  pays: number;
}

export function quoteTopup(amountUsd: number, coin: string): TopupQuote {
  const c = String(coin || "").toUpperCase().trim();
  const m = FUNDING_COIN_META[c];
  if (!m) throw new CustomerWalletError(400, `${coin} is not a supported top-up coin.`);
  const amount = round2(amountUsd);
  const rates = getEscrowCostRates();
  const stable = isStableFundingCoin(c);
  const network_fee = round2(sweepFeeUsdFor(c));
  const conversion_fee = /usdt/i.test(c) ? 0 : round2((amount * (rates.conversionPct || 0)) / 100);
  const exchange_fee = stable ? 0 : round2((amount * (rates.exchangePct || 0)) / 100);
  return {
    coin: c, label: m.label, network: m.network, stable, cheap: !!m.cheap,
    amount, network_fee, conversion_fee, exchange_fee, exchange_fee_percent: rates.exchangePct || 0,
    pays: round2(amount + network_fee + conversion_fee + exchange_fee),
  };
}

export async function topupQuotes(companyId: number, amountUsd: number): Promise<TopupQuote[]> {
  const coins = await configuredFundingCoins(companyId);
  return coins.map((c) => quoteTopup(amountUsd, c));
}

function assertAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < MIN_TOPUP_USD) throw new CustomerWalletError(400, `Minimum top-up is $${MIN_TOPUP_USD}.`);
  if (amount > MAX_TOPUP_USD) throw new CustomerWalletError(400, `Maximum top-up is $${MAX_TOPUP_USD.toLocaleString()}.`);
}

async function getTopupRow(id: number): Promise<TopupRow | null> {
  const rows = await sequelize.query<TopupRow>(`SELECT * FROM tbl_safedeal_topup WHERE topup_id = :id LIMIT 1`, { replacements: { id }, type: QueryTypes.SELECT });
  return rows[0] || null;
}

export async function getTopup(customerId: number, id: number): Promise<TopupRow> {
  const row = await getTopupRow(id);
  if (!row || row.customer_id !== customerId) throw new CustomerWalletError(404, "Top-up not found.");
  return expireIfStale(row);
}

async function expireIfStale(row: TopupRow): Promise<TopupRow> {
  if (["waiting"].includes(row.status) && new Date(row.expires_at).getTime() < Date.now()) return patchTopup(row.topup_id, { status: "expired" });
  return row;
}

export async function listTopups(customerId: number, limit = 10): Promise<TopupRow[]> {
  const rows = await sequelize.query<TopupRow>(
    `SELECT * FROM tbl_safedeal_topup WHERE customer_id = :customerId ORDER BY created_at DESC LIMIT :limit`,
    { replacements: { customerId, limit }, type: QueryTypes.SELECT }
  );
  return Promise.all(rows.map(expireIfStale));
}

async function patchTopup(id: number, patch: Partial<Pick<TopupRow, "status" | "seen_tx" | "received_crypto" | "simulated" | "credited_at">>): Promise<TopupRow> {
  const sets: string[] = ["updated_at = NOW()"];
  const rep: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(patch)) { sets.push(`${k} = :${k}`); rep[k] = v; }
  const rows = await sequelize.query<TopupRow>(`UPDATE tbl_safedeal_topup SET ${sets.join(", ")} WHERE topup_id = :id RETURNING *`, { replacements: rep, type: QueryTypes.SELECT });
  return rows[0];
}

/** Reserve a Dynopay deposit address for the quote; the wallet is credited on confirmation. */
export async function createTopup(customer: CustomerRow, amountUsd: number, coin: string): Promise<TopupRow> {
  const q = quoteTopup(amountUsd, coin);
  assertAmount(q.amount);
  const configured = await configuredFundingCoins(customer.company_id);
  if (!configured.includes(q.coin)) throw new CustomerWalletError(400, `${q.coin} is not enabled for top-ups yet.`);
  // Reuse an open address for the same coin+amount instead of burning a fresh one.
  const open = (await listTopups(customer.customer_id, 5)).find((t) => t.status === "waiting" && t.coin === q.coin && Number(t.amount_usd) === q.amount);
  if (open) return open;

  const ins = await sequelize.query<TopupRow>(
    `INSERT INTO tbl_safedeal_topup (company_id, customer_id, coin, amount_usd, network_fee_usd, conversion_fee_usd, exchange_fee_usd, pays_usd, status, expires_at)
     VALUES (:companyId, :customerId, :coin, :amount, :net, :conv, :exch, :pays, 'waiting', NOW() + (:mins || ' minutes')::interval) RETURNING *`,
    {
      replacements: { companyId: customer.company_id, customerId: customer.customer_id, coin: q.coin, amount: toFixedStr(q.amount, 2), net: toFixedStr(q.network_fee, 2), conv: toFixedStr(q.conversion_fee, 2), exch: toFixedStr(q.exchange_fee, 2), pays: toFixedStr(q.pays, 2), mins: String(RESERVATION_MINUTES) },
      type: QueryTypes.SELECT,
    }
  );
  const row = ins[0];
  try {
    const d = await requestDynopayPayment(q.pays, q.coin, { topup_id: row.topup_id, customer_id: customer.customer_id }, `/wallet?topup=${row.topup_id}`, `sd-topup-${row.topup_id}-${q.coin}`);
    const rows = await sequelize.query<TopupRow>(
      `UPDATE tbl_safedeal_topup SET payment_id = :pid, address = :addr, destination_tag = :tag, crypto_amount = :camt, qr_code = :qr, updated_at = NOW() WHERE topup_id = :id RETURNING *`,
      { replacements: { pid: d.transaction_id, addr: d.address, tag: d.destination_tag, camt: d.amount, qr: d.qr_code, id: row.topup_id }, type: QueryTypes.SELECT }
    );
    apiLogger.info(`[SafeDeal] top-up ${row.topup_id} issued: ${d.amount} ${q.coin} (${q.pays} USD → credit ${q.amount}) for customer ${customer.customer_id}`);
    return rows[0];
  } catch (err) {
    await patchTopup(row.topup_id, { status: "expired" });
    throw new CustomerWalletError(502, (err as Error).message || "Couldn't create the top-up payment.");
  }
}

/** Credit the customer wallet exactly once (idempotent per top-up). */
async function creditTopup(row: TopupRow, txId: string | null, simulated: boolean): Promise<TopupRow> {
  if (row.status === "credited") return row;
  const customer = (await sequelize.query<CustomerRow>(`SELECT customer_id, company_id, customer_name, email FROM tbl_customer WHERE customer_id = :id LIMIT 1`, { replacements: { id: row.customer_id }, type: QueryTypes.SELECT }))[0];
  if (!customer) throw new CustomerWalletError(404, "Customer not found.");
  const m = FUNDING_COIN_META[row.coin];
  const fees = round2(Number(row.network_fee_usd) + Number(row.conversion_fee_usd) + Number(row.exchange_fee_usd));
  await applyEntries([
    {
      customer,
      type: "CREDIT",
      amount: Number(row.amount_usd),
      kind: "topup",
      description: `Wallet top-up — ${row.crypto_amount || ""} ${m?.label || row.coin}${m ? ` on ${m.network}` : ""} received${fees > 0 ? ` (fees ${toFixedStr(fees, 2)} USD paid on top)` : ""}${simulated ? " [SIMULATED]" : ""}`,
      reference: `topup:${row.topup_id}:credit`,
      source: "TOPUP",
      meta: { topup_id: row.topup_id, coin: row.coin, pays: Number(row.pays_usd), network_fee: Number(row.network_fee_usd), conversion_fee: Number(row.conversion_fee_usd), exchange_fee: Number(row.exchange_fee_usd), tx: txId, simulated },
    },
  ]);
  return patchTopup(row.topup_id, { status: "credited", seen_tx: txId ?? row.seen_tx, simulated, credited_at: new Date().toISOString() as any });
}

/** Preview only — live settlement OFF: mark the deposit as received and credit the wallet. */
export async function simulateTopup(customerId: number, id: number): Promise<TopupRow> {
  if (isLiveSettlementEnabled()) throw new CustomerWalletError(403, "Simulated top-ups are disabled when live settlement is on.");
  const row = await getTopup(customerId, id);
  if (!["waiting", "pending", "underpaid"].includes(row.status)) throw new CustomerWalletError(409, `Top-up is already ${row.status}.`);
  return creditTopup(row, `SIMULATED-TOPUP-${crypto.randomBytes(8).toString("hex")}`, true);
}

/** Dynopay webhook for a top-up payment (signature already verified by the caller). */
export async function handleTopupWebhook(topupId: number, event: string, payload: Record<string, any>): Promise<{ handled: boolean; note: string }> {
  const row = await getTopupRow(topupId);
  if (!row) return { handled: false, note: `top-up ${topupId} not found` };
  const txId = payload.txId || payload.transaction_reference ? String(payload.txId || payload.transaction_reference) : null;
  switch (event) {
    case "payment.pending":
      if (row.status === "waiting") await patchTopup(row.topup_id, { status: "pending", seen_tx: txId, received_crypto: Number(payload.amount) || null });
      return { handled: true, note: "top-up pending" };
    case "payment.underpaid":
      if (["waiting", "pending"].includes(row.status)) await patchTopup(row.topup_id, { status: "underpaid", seen_tx: txId, received_crypto: Number(payload.amount) || null });
      return { handled: true, note: "top-up underpaid" };
    case "payment.confirmed":
    case "payment.overpaid":
    case "payment.settled": {
      const r = await creditTopup(row, txId, false);
      return { handled: true, note: `top-up ${r.topup_id} ${r.status}` };
    }
    case "payment.expired":
      if (row.status === "waiting") await patchTopup(row.topup_id, { status: "expired" });
      return { handled: true, note: "top-up expired" };
    default:
      return { handled: false, note: `ignored ${event}` };
  }
}
