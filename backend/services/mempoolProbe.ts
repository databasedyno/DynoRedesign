/**
 * Buyer-facing "payment detected" probe — looks for an UNCONFIRMED incoming transfer to a
 * checkout address (mempool / not-yet-solid). Read-only hint for the checkout UI only:
 * it never touches payment state; settlement still waits for the chain watcher webhook.
 *
 * Sources (all public, short timeouts, result cached in Redis for a few seconds):
 *   BTC  → mempool.space           LTC → litecoinspace.org
 *   ETH / USDT-ERC20 / USDC-ERC20 / POLYGON / USDT-POLYGON → JSON-RPC "pending" vs "latest" balance
 *   TRX / USDT-TRC20 → TronGrid only_unconfirmed transactions
 */
import axios from "axios";
import { raw as envRaw } from "../utils/config";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { cronLogger } from "../utils/loggers";

export interface UnconfirmedProbe {
  detected: boolean;
  txId?: string;
  amount?: number;
  source: string;
}

const NOT: UnconfirmedProbe = { detected: false, source: "none" };
const TIMEOUT_MS = 2500;
const CACHE_TTL_S = 6;

const http = axios.create({ timeout: TIMEOUT_MS, headers: { "User-Agent": "dynopay-checkout/1.0" } });

const ERC20: Record<string, { rpc: "ETH" | "POLYGON"; contract?: string; decimals: number }> = {
  "ETH": { rpc: "ETH", decimals: 18 },
  "USDT-ERC20": { rpc: "ETH", contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
  "USDC-ERC20": { rpc: "ETH", contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
  "POLYGON": { rpc: "POLYGON", decimals: 18 },
  "USDT-POLYGON": { rpc: "POLYGON", contract: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6 },
};

const rpcUrl = (chain: "ETH" | "POLYGON"): string =>
  chain === "POLYGON"
    ? envRaw("POLYGON_PROBE_RPC_URL") || "https://polygon-bor-rpc.publicnode.com"
    : envRaw("ETH_PROBE_RPC_URL") || "https://ethereum-rpc.publicnode.com";

const rpcCall = async (chain: "ETH" | "POLYGON", method: string, params: unknown[]): Promise<string> => {
  const { data } = await http.post(rpcUrl(chain), { jsonrpc: "2.0", id: 1, method, params });
  if (!data?.result || typeof data.result !== "string") throw new Error(data?.error?.message || "rpc: no result");
  return data.result;
};

const evmBalance = async (chain: "ETH" | "POLYGON", address: string, contract: string | undefined, tag: "pending" | "latest"): Promise<bigint> => {
  if (!contract) return BigInt(await rpcCall(chain, "eth_getBalance", [address, tag]));
  const data = "0x70a08231" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  return BigInt(await rpcCall(chain, "eth_call", [{ to: contract, data }, tag]));
};

const probeEvm = async (address: string, currency: string): Promise<UnconfirmedProbe> => {
  const cfg = ERC20[currency];
  const [pending, latest] = await Promise.all([
    evmBalance(cfg.rpc, address, cfg.contract, "pending"),
    evmBalance(cfg.rpc, address, cfg.contract, "latest"),
  ]);
  if (pending <= latest) return { ...NOT, source: "evm-rpc" };
  const amount = Number(pending - latest) / 10 ** cfg.decimals;
  return { detected: true, amount, source: "evm-rpc" };
};

const probeUtxoMempool = async (base: string, address: string): Promise<UnconfirmedProbe> => {
  const { data } = await http.get(`${base}/api/address/${address}/txs/mempool`);
  const txs: Array<{ txid: string; vout: Array<{ scriptpubkey_address?: string; value: number }> }> = Array.isArray(data) ? data : [];
  let sats = 0;
  let txId: string | undefined;
  for (const tx of txs) {
    for (const o of tx.vout || []) {
      if (o.scriptpubkey_address === address) { sats += Number(o.value) || 0; txId = txId || tx.txid; }
    }
  }
  return sats > 0 ? { detected: true, txId, amount: sats / 1e8, source: "mempool-api" } : { ...NOT, source: "mempool-api" };
};

const probeTron = async (address: string, currency: string): Promise<UnconfirmedProbe> => {
  const base = envRaw("TRONGRID_API_URL") || "https://api.trongrid.io";
  const headers: Record<string, string> = {};
  const key = envRaw("TRONGRID_API_KEY");
  if (key) headers["TRON-PRO-API-KEY"] = key;
  if (currency === "USDT-TRC20") {
    const contract = envRaw("TRX_CONTRACT") || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    const { data } = await http.get(`${base}/v1/accounts/${address}/transactions/trc20`, {
      headers, params: { only_to: true, only_unconfirmed: true, contract_address: contract, limit: 5 },
    });
    const row = (data?.data || [])[0];
    if (!row) return { ...NOT, source: "trongrid" };
    const decimals = Number(row.token_info?.decimals ?? 6);
    return { detected: true, txId: row.transaction_id, amount: Number(row.value) / 10 ** decimals, source: "trongrid" };
  }
  const { data } = await http.get(`${base}/v1/accounts/${address}/transactions`, {
    headers, params: { only_to: true, only_unconfirmed: true, limit: 5 },
  });
  const row = (data?.data || []).find((t: any) => t?.raw_data?.contract?.[0]?.type === "TransferContract");
  if (!row) return { ...NOT, source: "trongrid" };
  const sun = Number(row.raw_data.contract[0].parameter?.value?.amount || 0);
  return { detected: sun > 0, txId: row.txID, amount: sun / 1e6, source: "trongrid" };
};

const PROBES: Record<string, (address: string, currency: string) => Promise<UnconfirmedProbe>> = {
  BTC: (a) => probeUtxoMempool("https://mempool.space", a),
  LTC: (a) => probeUtxoMempool("https://litecoinspace.org", a),
  TRX: probeTron,
  "USDT-TRC20": probeTron,
  ...Object.fromEntries(Object.keys(ERC20).map((k) => [k, probeEvm])),
};

export const supportsMempoolProbe = (currency: string): boolean => !!PROBES[String(currency || "").toUpperCase()];

/** Never throws; returns { detected:false } on any error / unsupported chain. */
export const probeUnconfirmedIncoming = async (address: string, currency: string): Promise<UnconfirmedProbe> => {
  const cur = String(currency || "").toUpperCase();
  const probe = PROBES[cur];
  if (!probe || !address) return NOT;
  const cacheKey = `mempool-probe:${cur}:${address}`;
  try {
    const cached = await getRedisItem(cacheKey);
    if (cached && typeof cached.detected === "boolean") return cached as UnconfirmedProbe;
  } catch { /* cache miss */ }
  let result: UnconfirmedProbe = NOT;
  try {
    result = await probe(address, cur);
    if (result.detected) cronLogger.info(`[MempoolProbe] 👀 unconfirmed ${cur} → ${address.slice(0, 12)}… amount=${result.amount ?? "?"} via ${result.source}`);
  } catch (err) {
    cronLogger.info(`[MempoolProbe] ${cur} probe failed (ignored): ${err instanceof Error ? err.message : String(err)}`);
  }
  setRedisItemWithTTL(cacheKey, result, CACHE_TTL_S).catch(() => { /* best-effort */ });
  return result;
};
