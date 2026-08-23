/**
 * Resilient HTTP client for Tatum / blockchain provider calls (Phase 4).
 *
 * A single shared axios instance that transparently retries TRANSIENT failures
 * (network drops, DNS/connection resets, request timeouts, HTTP 429/500/502/503/504)
 * with exponential backoff + jitter, honouring `Retry-After` on 429s.
 *
 * ─────────────────────────  SAFETY (read this)  ─────────────────────────
 * Retries are ONLY applied to IDEMPOTENT requests:
 *   • GET / HEAD / OPTIONS            → retried automatically
 *   • any other method (POST/PUT/…)   → NEVER retried, UNLESS the caller
 *                                        explicitly opts in with `idempotent:true`
 * This is deliberate: many blockchain POSTs are broadcasts / transfers /
 * address creations. Retrying a broadcast could double-spend real funds, so a
 * write is only ever retried when the caller has proven it is safe (e.g. a
 * read-only JSON-RPC POST or a fee estimate) by passing `idempotent:true`.
 *
 * Because auth headers are attached per-call by each caller (getTatumHeaders(),
 * etc.), this instance does NOT inject any API key — so it is safe to reuse for
 * non-Tatum reads (mempool.space, fastforex, …) without leaking credentials.
 *
 * Usage: replace `import axios from "axios"` with
 *   `import axios from "../utils/tatumHttp"` — every existing `axios.get(...)`
 * call then auto-recovers from blockchain hiccups with no other change.
 * For a known-safe non-GET read:  axios.post(url, body, { headers, idempotent: true })
 */

import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import http from "http";
import https from "https";
import { cronLogger } from "./loggers";

// ── Tunables (env-overridable, sane defaults) ───────────────────────────
const MAX_RETRIES = Number(process.env.TATUM_HTTP_MAX_RETRIES ?? 3);
const BASE_DELAY_MS = Number(process.env.TATUM_HTTP_BASE_DELAY_MS ?? 400);
const MAX_DELAY_MS = Number(process.env.TATUM_HTTP_MAX_DELAY_MS ?? 4000);
// Bounded timeout applied ONLY to auto-retryable reads that don't set their own,
// so a hung read fails fast and can be retried. Writes keep the caller's timeout
// (usually none) so a broadcast is never aborted mid-flight.
const READ_TIMEOUT_MS = Number(process.env.TATUM_HTTP_READ_TIMEOUT_MS ?? 30000);

const IDEMPOTENT_METHODS = new Set(["get", "head", "options"]);
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// ── Read-only JSON-RPC allowlist ────────────────────────────────────────
// A JSON-RPC POST (body `{ method, params, … }`) is only auto-retried when its
// `method` is on this allowlist of NON-MUTATING reads. This lets fee/gas
// estimates, balance/log/transaction lookups, etc. recover from transient
// blockchain-provider hiccups WITHOUT ever retrying a broadcast.
// CRITICAL: mutating methods must NEVER appear here. In particular the XRP
// `submit` (raw-tx broadcast) and any `*sendRawTransaction`/`broadcast` are
// deliberately excluded — retrying them could double-spend real funds.
const READ_RPC_METHODS = new Set([
  // UTXO (BTC/BCH/LTC/DOGE)
  "estimatefee",
  // Solana
  "getrecentprioritizationfees", "getsignaturesforaddress", "gettransaction",
  // EVM (Polygon/ETH) — eth_call is a read-only simulation
  "eth_gasprice", "eth_call", "eth_blocknumber", "eth_getlogs",
  "eth_getbalance", "eth_gettransactionreceipt", "eth_gettransactionbyhash",
  "eth_gettransactioncount", "eth_estimategas", "eth_chainid",
  // XRP Ledger
  "tx", "account_info", "account_lines", "account_tx", "fee",
  "server_info", "ledger",
]);

interface RetryableConfig extends InternalAxiosRequestConfig {
  /** Opt-in flag: allow retry for a known-safe non-GET (e.g. an RPC read). */
  idempotent?: boolean;
  /** Internal attempt counter. */
  __retryCount?: number;
}

/**
 * Extract the JSON-RPC `method` (lowercased) from a request body, whether it is
 * still a raw object (request interceptor) or already serialised to a string
 * (retry from the response interceptor). Returns null if the body isn't a
 * JSON-RPC-shaped `{ method: "…" }` payload.
 */
function rpcMethodOf(data: unknown): string | null {
  try {
    const obj = typeof data === "string" ? JSON.parse(data) : data;
    const m = (obj as { method?: unknown })?.method;
    if (typeof m === "string" && m) return m.toLowerCase();
  } catch {
    /* body isn't JSON — not an RPC read */
  }
  return null;
}

/**
 * A request is retryable if it's idempotent by HTTP method, explicitly opted-in
 * via `idempotent:true`, or a read-only JSON-RPC POST (method on the allowlist).
 */
function isRetryableRequest(config: RetryableConfig): boolean {
  const method = (config.method || "get").toLowerCase();
  if (IDEMPOTENT_METHODS.has(method)) return true;
  if (config.idempotent === true) return true;
  const rpcMethod = rpcMethodOf(config.data);
  return rpcMethod != null && READ_RPC_METHODS.has(rpcMethod);
}

/** A failure is transient (worth retrying) on network errors + specific 5xx/429. */
export function isTransientError(error: unknown): boolean {
  const err = error as AxiosError;
  if (!err || !err.isAxiosError) return false;
  // No response → network error / DNS / ECONNRESET / ETIMEDOUT / ECONNABORTED
  if (!err.response) return true;
  return RETRYABLE_STATUS.has(err.response.status);
}

function computeDelay(attempt: number, error: AxiosError): number {
  // Exponential backoff: BASE * 2^(attempt-1), capped.
  let delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  // Honour Retry-After (seconds) on 429/503 when provided.
  const ra = error.response?.headers?.["retry-after"];
  if (ra != null) {
    const raMs = Number(ra) * 1000;
    if (!Number.isNaN(raMs) && raMs > 0) delay = Math.min(raMs, 10000);
  }
  // Full jitter (±30%) to avoid thundering-herd on shared provider outages.
  return Math.round(delay * (0.7 + Math.random() * 0.6));
}

// P3 perf: reuse TCP/TLS connections across Tatum / mempool.space / fastforex
// reads instead of a fresh handshake per call. keepAlive amortises the ~1 RTT
// TLS setup, cutting latency on the hot blockchain-read paths.
const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 100, keepAliveMsecs: 15000 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, keepAliveMsecs: 15000 });

const tatumHttp: AxiosInstance = axios.create({
  httpAgent: keepAliveHttpAgent,
  httpsAgent: keepAliveHttpsAgent,
});

// Give auto-retryable reads a bounded timeout (writes keep caller's timeout).
tatumHttp.interceptors.request.use((config) => {
  const c = config as RetryableConfig;
  if (c.timeout == null && isRetryableRequest(c)) {
    c.timeout = READ_TIMEOUT_MS;
  }
  return config;
});

tatumHttp.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    if (!config) return Promise.reject(error);
    if (!isRetryableRequest(config) || !isTransientError(error)) {
      return Promise.reject(error);
    }

    config.__retryCount = (config.__retryCount || 0) + 1;
    if (config.__retryCount > MAX_RETRIES) {
      cronLogger.warn(
        `[tatumHttp] giving up after ${MAX_RETRIES} retries: ${(
          config.method || "get"
        ).toUpperCase()} ${config.url} — ${
          error.response?.status ?? error.code ?? error.message
        }`,
      );
      return Promise.reject(error);
    }

    const delay = computeDelay(config.__retryCount, error);
    cronLogger.warn(
      `[tatumHttp] transient failure (${
        error.response?.status ?? error.code ?? error.message
      }) on ${(config.method || "get").toUpperCase()} ${
        config.url
      } — retry ${config.__retryCount}/${MAX_RETRIES} in ${delay}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return tatumHttp.request(config);
  },
);

/**
 * Generic retry wrapper for non-axios async work (e.g. Tatum SDK calls) that
 * should follow the same transient-retry policy. Only retries when `shouldRetry`
 * returns true (defaults to the axios transient-error check). Safe-by-default:
 * callers must ensure `fn` is idempotent before wrapping a write.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (err: unknown) => boolean;
    label?: string;
  } = {},
): Promise<T> {
  const retries = opts.retries ?? MAX_RETRIES;
  const baseDelay = opts.baseDelayMs ?? BASE_DELAY_MS;
  const maxDelay = opts.maxDelayMs ?? MAX_DELAY_MS;
  const shouldRetry = opts.shouldRetry ?? isTransientError;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !shouldRetry(err)) throw err;
      const delay = Math.round(
        Math.min(baseDelay * 2 ** (attempt - 1), maxDelay) *
          (0.7 + Math.random() * 0.6),
      );
      cronLogger.warn(
        `[withRetry] ${opts.label ?? "operation"} failed (attempt ${attempt}/${retries}) — retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export default tatumHttp;
export { tatumHttp };
