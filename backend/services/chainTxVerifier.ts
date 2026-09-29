/**
 * On-chain verification of INCOMING payment notifications (2026-09-27).
 *
 * Dynopay learns about deposits from Tatum ADDRESS_EVENT webhooks. Those webhooks are
 * only loosely authenticated (unsigned requests from unknown IPs are accepted), and
 * `payment.confirmed` is emitted to merchants — and SafeDeal funds escrow — from that
 * notification alone. A forged `{address, amount, asset, txId}` could therefore mint a
 * merchant/SafeDeal balance with no money on chain.
 *
 * This module makes the CHAIN the source of truth: before any state changes, the
 * webhook's txId is fetched from the blockchain (Tatum REST/SDK) and must
 *   1. exist and be mined (not mempool),
 *   2. pay the exact deposit address (and XRP destination tag),
 *   3. in the expected asset (native coin or the right token contract),
 *   4. for at least the amount the webhook claims,
 *   5. not be a replay of a transaction that already credited a payment, and
 *   6. not predate the payment session it is being attributed to.
 *
 * Verdicts: "verified" → proceed; "mismatch" → reject permanently; "pending"/"not_found"/
 * "error" → retry (BullMQ backoff — a genuine tx that the REST node hasn't indexed yet
 * shows up on the next attempt; a forged one never does); "unsupported" → policy below.
 *
 * Env:  CHAIN_TX_VERIFY_MODE = enforce (default) | warn (log only) | off
 *       CHAIN_TX_VERIFY_UNSUPPORTED = allow (default, loud warning) | reject
 */
import { QueryTypes } from "sequelize";
import axios from "axios";
import * as tronwebPkg from "tronweb";
import { raw as envRaw } from "../utils/config";
import sequelize from "../utils/dbInstance";
import { webhookLogs } from "../utils/loggers";
import { TOKEN_CONTRACTS, RLUSD_CONFIG } from "./merchantPool/merchantPoolConfig";

const tronAddress = (): { fromHex: (h: string) => string; toHex: (b: string) => string } => {
  const p: any = tronwebPkg;
  return (p.TronWeb?.address || p.default?.address || p.address) as any;
};

export type ChainVerifyResult =
  | { status: "verified"; onChainAmount: number; blockTime: number | null }
  | { status: "mismatch"; reason: string }
  | { status: "pending"; reason: string }
  | { status: "not_found"; reason: string }
  | { status: "unsupported"; reason: string }
  | { status: "error"; reason: string };

export interface VerifyInput {
  txId: string;
  address: string;
  /** Dynopay currency code, e.g. "USDT-TRC20", "BTC", "XRP". */
  currency: string;
  /** Amount the webhook claims, in coin/token units. */
  amount: number;
  destinationTag?: number | null;
}

export type VerifyMode = "enforce" | "warn" | "off";
export const verifyMode = (): VerifyMode => {
  const m = String(envRaw("CHAIN_TX_VERIFY_MODE") || "enforce").toLowerCase();
  return m === "off" || m === "warn" ? m : "enforce";
};
const unsupportedPolicy = (): "allow" | "reject" =>
  String(envRaw("CHAIN_TX_VERIFY_UNSUPPORTED") || "allow").toLowerCase() === "reject" ? "reject" : "allow";

const UTXO = new Set(["BTC", "LTC", "DOGE", "BCH"]);
export const EVM_NATIVE: Record<string, "eth" | "polygon" | "bsc"> = { ETH: "eth", POLYGON: "polygon", BSC: "bsc" };
export const EVM_TOKEN: Record<string, { chain: "eth" | "polygon"; decimals: number }> = {
  "USDT-ERC20": { chain: "eth", decimals: 6 },
  "USDC-ERC20": { chain: "eth", decimals: 6 },
  "RLUSD-ERC20": { chain: "eth", decimals: 18 },
  "USDT-POLYGON": { chain: "polygon", decimals: 6 },
};
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TRC20_TRANSFER = "a9059cbb";
const TRC20_TRANSFER_FROM = "23b872dd";

/** The on-chain amount may be formatted slightly differently than the webhook's — allow 1e-6 relative slack. */
export const amountCovers = (onChain: number, claimed: number): boolean =>
  Number.isFinite(onChain) && onChain + Math.max(1e-8, claimed * 1e-6) >= claimed;

const sameEvm = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const bigToUnits = (raw: string | number | bigint, decimals: number): number => {
  const v = typeof raw === "bigint" ? raw : BigInt(String(raw).startsWith("0x") ? String(raw) : String(raw).split(".")[0] || "0");
  return Number(v) / 10 ** decimals; // amounts here are far below 2^53 after scaling
};

// ── per-chain parsers (exported for unit tests) ──────────────────────────────

export function parseUtxo(tx: any, address: string, currency: string): { amount: number; mined: boolean; blockTime: number | null; hasBlockInfo: boolean } | null {
  if (!tx || typeof tx !== "object") return null;
  const norm = (a: string) => String(a || "").toLowerCase().replace(/^bitcoincash:/, "");
  const want = norm(address);
  let amount = 0;
  if (Array.isArray(tx.outputs)) {
    // Tatum REST: BTC `outputs[].value` is in SATOSHIS (number); LTC is a decimal string in LTC.
    const scale = currency === "BTC" ? 1e8 : 1;
    for (const o of tx.outputs) if (o && norm(o.address) === want) amount += Number(o.value || 0) / scale;
    return { amount, mined: !!(tx.blockNumber || tx.block), blockTime: tx.time ? Number(tx.time) * (String(tx.time).length > 10 ? 1 : 1000) : null, hasBlockInfo: true };
  }
  if (Array.isArray(tx.vout)) {
    // bitcoind-style (DOGE, BCH): `vout[].value` is in coin units.
    for (const o of tx.vout) {
      const addrs: string[] = o?.scriptPubKey?.addresses || (o?.scriptPubKey?.address ? [o.scriptPubKey.address] : []);
      if (addrs.some((a) => norm(a) === want)) amount += Number(o.value || 0);
    }
    // Tatum's DOGE REST response carries NO block fields at all → caller must confirm via node RPC.
    const hasBlockInfo = tx.blockhash !== undefined || tx.blockNumber !== undefined || tx.confirmations !== undefined;
    return { amount, mined: !!(tx.blockhash || tx.blockNumber || Number(tx.confirmations) > 0), blockTime: tx.blocktime ? Number(tx.blocktime) * 1000 : tx.time ? Number(tx.time) * 1000 : null, hasBlockInfo };
  }
  return { amount: 0, mined: false, blockTime: null, hasBlockInfo: false };
}

/** bitcoind `getrawtransaction <txid> true` through Tatum's node gateway — block status for chains whose REST view omits it (DOGE). */
async function utxoRpcBlockStatus(chain: "DOGE" | "BCH" | "LTC" | "BTC", txId: string): Promise<{ mined: boolean; blockTime: number | null } | null> {
  const tatumApi = (await import("../apis/tatumApi")).default as any;
  const headers = await tatumApi.getTatumHeaders();
  const { data } = await axios.post(`https://api.tatum.io/v3/blockchain/node/${chain}`, { jsonrpc: "2.0", id: 1, method: "getrawtransaction", params: [txId, true] }, { headers, timeout: 15000 });
  const r = data?.result;
  if (!r || typeof r !== "object") return null;
  return { mined: !!(r.blockhash || Number(r.confirmations) > 0), blockTime: r.blocktime ? Number(r.blocktime) * 1000 : null };
}

export function parseEvmNative(tx: any, address: string): { amount: number; mined: boolean; ok: boolean; blockTime: number | null; toMatches: boolean } {
  const toMatches = sameEvm(tx?.to, address);
  const amount = toMatches ? bigToUnits(tx?.value ?? "0", 18) : 0;
  return { amount, mined: tx?.blockNumber != null && tx.blockNumber !== 0, ok: tx?.status !== false, blockTime: tx?.timestamp ? Number(tx.timestamp) * (String(tx.timestamp).length > 10 ? 1 : 1000) : null, toMatches };
}

export function parseEvmToken(tx: any, address: string, contract: string, decimals: number): { amount: number; mined: boolean; ok: boolean; blockTime: number | null } {
  let amount = 0;
  for (const log of tx?.logs || []) {
    if (!sameEvm(log?.address, contract)) continue;
    const topics: string[] = log?.topics || [];
    if (String(topics[0] || "").toLowerCase() !== TRANSFER_TOPIC || topics.length < 3) continue;
    const to = "0x" + String(topics[2]).slice(-40);
    if (!sameEvm(to, address)) continue;
    try { amount += bigToUnits(BigInt(log.data), decimals); } catch { /* malformed log — ignore */ }
  }
  return { amount, mined: tx?.blockNumber != null && tx.blockNumber !== 0, ok: tx?.status !== false, blockTime: tx?.timestamp ? Number(tx.timestamp) * (String(tx.timestamp).length > 10 ? 1 : 1000) : null };
}

const tronHexToBase58 = (hex: string): string => {
  const h = String(hex || "").replace(/^0x/, "");
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(h)) return h;
  try { return tronAddress().fromHex(h.length === 40 ? `41${h}` : h); } catch { return ""; }
};

export function parseTron(tx: any, address: string, currency: string, usdtContract: string): { amount: number; mined: boolean; ok: boolean; blockTime: number | null } {
  const ok = !Array.isArray(tx?.ret) || tx.ret.length === 0 || tx.ret.some((r: any) => String(r?.contractRet || "SUCCESS") === "SUCCESS");
  const mined = !!tx?.blockNumber;
  const blockTime = tx?.rawData?.timestamp || tx?.raw_data?.timestamp ? Number(tx?.rawData?.timestamp ?? tx?.raw_data?.timestamp) : null;
  let amount = 0;
  const contracts: any[] = tx?.rawData?.contract || tx?.raw_data?.contract || [];
  for (const c of contracts) {
    const v = c?.parameter?.value || {};
    if (currency === "TRX" && c?.type === "TransferContract") {
      if (tronHexToBase58(v.to_address || v.toAddressBase58 || "") === address) amount += Number(v.amount || 0) / 1e6;
    } else if (currency === "USDT-TRC20" && c?.type === "TriggerSmartContract") {
      if (tronHexToBase58(v.contract_address || v.contractAddressBase58 || "") !== usdtContract) continue;
      const data = String(v.data || "").replace(/^0x/, "").toLowerCase();
      const method = data.slice(0, 8);
      let to = "", raw = "";
      if (method === TRC20_TRANSFER && data.length >= 8 + 128) { to = data.slice(8 + 24, 8 + 64); raw = data.slice(8 + 64, 8 + 128); }
      else if (method === TRC20_TRANSFER_FROM && data.length >= 8 + 192) { to = data.slice(8 + 64 + 24, 8 + 128); raw = data.slice(8 + 128, 8 + 192); }
      else continue;
      if (tronHexToBase58(`41${to}`) !== address) continue;
      try { amount += bigToUnits(BigInt(`0x${raw}`), 6); } catch { /* malformed */ }
    }
  }
  return { amount, mined, ok, blockTime };
}

export function parseSolana(tx: any, address: string): { amount: number; ok: boolean; blockTime: number | null; found: boolean } {
  const keys: any[] = tx?.transaction?.message?.accountKeys || [];
  const idx = keys.findIndex((k) => (typeof k === "string" ? k : k?.pubkey) === address);
  const pre = tx?.meta?.preBalances?.[idx];
  const post = tx?.meta?.postBalances?.[idx];
  const found = idx >= 0 && pre != null && post != null;
  return { amount: found ? Math.max(0, (Number(post) - Number(pre)) / 1e9) : 0, ok: tx?.meta?.err == null, blockTime: tx?.blockTime ? Number(tx.blockTime) * 1000 : null, found };
}

export function parseXrp(tx: any, address: string, currency: string, destinationTag: number | null | undefined, rlusdIssuer: string): { amount: number; ok: boolean; destMatches: boolean; tagMatches: boolean } {
  const ok = String(tx?.meta?.TransactionResult || "tesSUCCESS") === "tesSUCCESS" && tx?.validated !== false && String(tx?.TransactionType || "Payment") === "Payment";
  const destMatches = String(tx?.Destination || "") === address;
  const tagMatches = destinationTag == null || Number(tx?.DestinationTag ?? -1) === Number(destinationTag);
  // meta.delivered_amount is authoritative for partial payments; fall back to Amount.
  const delivered = tx?.meta?.delivered_amount ?? tx?.meta?.DeliveredAmount ?? tx?.Amount;
  let amount = 0;
  if (currency === "XRP") {
    if (typeof delivered === "string" || typeof delivered === "number") amount = Number(delivered) / 1e6;
  } else if (typeof delivered === "object" && delivered) {
    const cur = String(delivered.currency || "");
    const isRlusd = cur === "RLUSD" || /^524C555344/i.test(cur);
    if (isRlusd && String(delivered.issuer || "") === rlusdIssuer) amount = Number(delivered.value || 0);
  }
  return { amount, ok, destMatches, tagMatches };
}

// ── fetch + decide ────────────────────────────────────────────────────────────

const isNotFound = (e: any): boolean => {
  const status = e?.status || e?.response?.status || e?.body?.statusCode;
  const msg = String(e?.message || e?.body?.message || "").toLowerCase();
  return status === 404 || status === 400 || /not found|no such|unknown transaction|cannot find|does not exist|invalid.*hash/.test(msg);
};

export async function verifyIncomingTxOnChain(input: VerifyInput): Promise<ChainVerifyResult> {
  const { txId, address, currency, amount, destinationTag } = input;
  if (!txId || !address || !currency) return { status: "mismatch", reason: "missing txId/address/currency" };
  let sdk: any;
  try {
    const tatumApi = (await import("../apis/tatumApi")).default as any;
    sdk = await tatumApi.getTatumSDK();
  } catch (e) {
    return { status: "error", reason: `tatum sdk unavailable: ${(e as Error).message}` };
  }
  const bc = sdk.blockchain;
  try {
    if (UTXO.has(currency)) {
      const tx = currency === "BTC" ? await bc.bitcoin.btcGetRawTransaction(txId)
        : currency === "LTC" ? await bc.ltc.ltcGetRawTransaction(txId)
        : currency === "DOGE" ? await bc.doge.dogeGetRawTransaction(txId)
        : await bc.bcash.bchGetRawTransaction(txId);
      const p = parseUtxo(tx, address, currency);
      if (!p) return { status: "not_found", reason: "empty response" };
      if (p.amount <= 0) return { status: "mismatch", reason: `tx pays nothing to ${address}` };
      if (!amountCovers(p.amount, amount)) return { status: "mismatch", reason: `on-chain ${p.amount} ${currency} < claimed ${amount}` };
      let mined = p.mined, blockTime = p.blockTime;
      if (!mined && !p.hasBlockInfo) {
        const rpc = await utxoRpcBlockStatus(currency as "DOGE" | "BCH" | "LTC" | "BTC", txId);
        if (!rpc) return { status: "error", reason: "node rpc returned no tx status" };
        mined = rpc.mined; blockTime = rpc.blockTime;
      }
      if (!mined) return { status: "pending", reason: "tx not yet in a block" };
      return { status: "verified", onChainAmount: p.amount, blockTime };
    }
    if (EVM_NATIVE[currency]) {
      const chain = EVM_NATIVE[currency];
      if (chain === "bsc" && !bc.bsc?.bscGetTransaction) return { status: "unsupported", reason: "no BSC tx lookup in SDK" };
      const tx = chain === "eth" ? await bc.eth.ethGetTransaction(txId) : chain === "polygon" ? await bc.polygon.polygonGetTransaction(txId) : await bc.bsc.bscGetTransaction(txId);
      if (!tx) return { status: "not_found", reason: "empty response" };
      const p = parseEvmNative(tx, address);
      // Recipient + amount are known from the tx itself (even unmined), so check
      // them BEFORE the mined gate: a "pending" result then means "a real tx
      // paying this address the right amount is in the mempool".
      if (!p.toMatches) return { status: "mismatch", reason: `tx.to ${tx.to || "?"} is not ${address} (internal/contract transfers are not creditable)` };
      if (!amountCovers(p.amount, amount)) return { status: "mismatch", reason: `on-chain ${p.amount} ${currency} < claimed ${amount}` };
      if (!p.mined) return { status: "pending", reason: "tx not yet mined" };
      if (!p.ok) return { status: "mismatch", reason: "tx reverted" };
      return { status: "verified", onChainAmount: p.amount, blockTime: p.blockTime };
    }
    if (EVM_TOKEN[currency]) {
      const { chain, decimals } = EVM_TOKEN[currency];
      const contract = TOKEN_CONTRACTS[currency];
      if (!contract) return { status: "unsupported", reason: `no contract configured for ${currency}` };
      const tx = chain === "eth" ? await bc.eth.ethGetTransaction(txId) : await bc.polygon.polygonGetTransaction(txId);
      if (!tx) return { status: "not_found", reason: "empty response" };
      const p = parseEvmToken(tx, address, contract, decimals);
      if (!p.mined) return { status: "pending", reason: "tx not yet mined" };
      if (!p.ok) return { status: "mismatch", reason: "tx reverted" };
      if (p.amount <= 0) return { status: "mismatch", reason: `no ${currency} Transfer to ${address} in tx logs` };
      if (!amountCovers(p.amount, amount)) return { status: "mismatch", reason: `on-chain ${p.amount} ${currency} < claimed ${amount}` };
      return { status: "verified", onChainAmount: p.amount, blockTime: p.blockTime };
    }
    if (currency === "TRX" || currency === "USDT-TRC20") {
      const tx = await bc.tron.tronGetTransaction(txId);
      if (!tx) return { status: "not_found", reason: "empty response" };
      const p = parseTron(tx, address, currency, TOKEN_CONTRACTS["USDT-TRC20"]);
      if (!p.mined) return { status: "pending", reason: "tx not yet in a block" };
      if (!p.ok) return { status: "mismatch", reason: "tx failed on-chain (contractRet != SUCCESS)" };
      if (p.amount <= 0) return { status: "mismatch", reason: `tx pays no ${currency} to ${address}` };
      if (!amountCovers(p.amount, amount)) return { status: "mismatch", reason: `on-chain ${p.amount} ${currency} < claimed ${amount}` };
      return { status: "verified", onChainAmount: p.amount, blockTime: p.blockTime };
    }
    if (currency === "SOL") {
      const tx = await bc.solana.solanaGetTransaction(txId, "confirmed");
      if (!tx) return { status: "not_found", reason: "empty response" };
      const p = parseSolana(tx, address);
      if (!p.ok) return { status: "mismatch", reason: "tx failed on-chain" };
      if (!p.found || p.amount <= 0) return { status: "mismatch", reason: `tx does not increase ${address} balance` };
      if (!amountCovers(p.amount, amount)) return { status: "mismatch", reason: `on-chain ${p.amount} SOL < claimed ${amount}` };
      return { status: "verified", onChainAmount: p.amount, blockTime: p.blockTime };
    }
    if (currency === "XRP" || currency === "RLUSD") {
      const tx = await bc.xrp.xrpGetTransaction(txId);
      if (!tx) return { status: "not_found", reason: "empty response" };
      if (tx.validated === false || (tx.ledger_index == null && tx.inLedger == null && tx.validated !== true)) return { status: "pending", reason: "tx not yet validated" };
      const p = parseXrp(tx, address, currency, destinationTag, RLUSD_CONFIG.issuer);
      if (!p.ok) return { status: "mismatch", reason: "tx is not a successful Payment" };
      if (!p.destMatches) return { status: "mismatch", reason: `Destination ${tx.Destination || "?"} is not ${address}` };
      if (!p.tagMatches) return { status: "mismatch", reason: `DestinationTag ${tx.DestinationTag ?? "none"} != ${destinationTag}` };
      if (p.amount <= 0) return { status: "mismatch", reason: `tx delivers no ${currency}` };
      if (!amountCovers(p.amount, amount)) return { status: "mismatch", reason: `on-chain ${p.amount} ${currency} < claimed ${amount}` };
      return { status: "verified", onChainAmount: p.amount, blockTime: null };
    }
    return { status: "unsupported", reason: `no on-chain verifier for ${currency}` };
  } catch (e) {
    if (isNotFound(e)) return { status: "not_found", reason: (e as Error).message || "not found" };
    return { status: "error", reason: (e as Error).message || String(e) };
  }
}

/** A tx that already credited a payment must not credit another (pool addresses are reused). */
export async function txAlreadyCredited(txId: string): Promise<boolean> {
  const rows = await sequelize.query<{ id: string }>(
    `SELECT id FROM tbl_user_transaction
      WHERE (incoming_tx_hash = :tx OR transaction_reference = :tx)
        AND LOWER(status) IN ('successful', 'completed', 'complete', 'settled') LIMIT 1`,
    { replacements: { tx: txId }, type: QueryTypes.SELECT }
  );
  return !!rows[0];
}

export async function paymentCreatedAt(paymentId: string | null | undefined): Promise<number | null> {
  if (!paymentId) return null;
  const rows = await sequelize.query<{ createdAt: string }>(`SELECT "createdAt" FROM tbl_user_transaction WHERE id = :id LIMIT 1`, { replacements: { id: paymentId }, type: QueryTypes.SELECT });
  const t = rows[0]?.createdAt ? new Date(rows[0].createdAt).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

export class ChainVerifyRetry extends Error {
  /** Verifier outcome that triggered the retry ("pending" = real tx seen on-chain, not yet mined). */
  constructor(message: string, public readonly status: ChainVerifyResult["status"] | "unknown" = "unknown") {
    super(message);
    this.name = "ChainVerifyRetry";
  }
}

/**
 * Gate used by the webhook processor. Returns "ok" to continue or "rejected" to drop the
 * webhook; throws ChainVerifyRetry when the chain hasn't caught up yet (BullMQ retries).
 */
export async function gateIncomingTx(input: VerifyInput & { paymentId?: string | null }): Promise<{ decision: "ok" | "rejected"; result: ChainVerifyResult; note: string }> {
  const mode = verifyMode();
  if (mode === "off") return { decision: "ok", result: { status: "unsupported", reason: "verification off" }, note: "CHAIN_TX_VERIFY_MODE=off" };
  const tag = `[ChainVerify] tx=${input.txId} ${input.currency} → ${input.address} claimed=${input.amount}`;
  let result = await verifyIncomingTxOnChain(input);

  if (result.status === "verified") {
    if (await txAlreadyCredited(input.txId)) result = { status: "mismatch", reason: "tx already credited a payment (replay)" };
    else {
      const created = await paymentCreatedAt(input.paymentId);
      if (created && result.blockTime && result.blockTime < created - 60 * 60 * 1000) {
        result = { status: "mismatch", reason: `tx block time ${new Date(result.blockTime).toISOString()} predates payment ${new Date(created).toISOString()} (replay of an old deposit)` };
      }
    }
  }

  const soft = mode === "warn";
  switch (result.status) {
    case "verified":
      webhookLogs.info(`${tag} ✅ verified on-chain (${result.onChainAmount})`);
      return { decision: "ok", result, note: "verified" };
    case "unsupported":
      if (unsupportedPolicy() === "reject" && !soft) {
        webhookLogs.error(`${tag} ⛔ REJECTED — ${result.reason} (CHAIN_TX_VERIFY_UNSUPPORTED=reject)`);
        return { decision: "rejected", result, note: result.reason };
      }
      webhookLogs.warn(`${tag} ⚠️ NOT VERIFIABLE (${result.reason}) — allowing by policy`);
      return { decision: "ok", result, note: result.reason };
    case "mismatch":
      if (soft) { webhookLogs.error(`${tag} ⚠️ WOULD REJECT (warn mode): ${result.reason}`); return { decision: "ok", result, note: result.reason }; }
      webhookLogs.error(`${tag} ⛔ REJECTED — ${result.reason}`);
      return { decision: "rejected", result, note: result.reason };
    default:
      if (soft) { webhookLogs.warn(`${tag} ⚠️ unverifiable right now (${result.status}: ${result.reason}) — allowing (warn mode)`); return { decision: "ok", result, note: result.reason }; }
      webhookLogs.warn(`${tag} ⏳ ${result.status}: ${result.reason} — will retry`);
      throw new ChainVerifyRetry(`CHAIN_VERIFY_RETRY ${result.status}: ${result.reason}`, result.status);
  }
}
