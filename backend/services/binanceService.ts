/**
 * Binance API Service
 * 
 * Handles all communication with Binance's REST API:
 * - HMAC-SHA256 request signing
 * - Convert API (getQuote, acceptQuote)
 * - Withdrawal API
 * - Deposit detection
 * - Account balance queries
 * - SOCKS5 proxy support for geo-restricted regions (US)
 */

import crypto from "crypto";
import http from "http";
import https from "https";
import { cronLogger } from "../utils/loggers";
import axios, { AxiosError } from "axios";
import { SocksProxyAgent } from "socks-proxy-agent";

// P3 perf: reuse TCP/TLS connections to Binance on the direct (non-proxy) path.
// When a SOCKS proxy is active the proxy agent manages its own sockets, so these
// keep-alive agents are used only when no proxy is needed.
const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 15000 });
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50, keepAliveMsecs: 15000 });

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || "";
const BINANCE_BASE_URL = process.env.BINANCE_BASE_URL || "https://api.binance.com";
const BINANCE_PROXY_URL = process.env.BINANCE_PROXY_URL || ""; // e.g., socks5://127.0.0.1:1080

// ============================================
// Smart Proxy: Auto-detect if proxy is needed
// ============================================
// When BINANCE_PROXY_URL is configured, we don't blindly use it.
// Instead, we first test DIRECT connectivity to Binance:
//   - Direct works   → non-US deployment → skip proxy (lower latency)
//   - Direct blocked → US deployment     → use proxy
// This allows the same .env to work across US and non-US deployments.

const getBinanceProxyAgent = (): SocksProxyAgent | undefined => {
  if (!BINANCE_PROXY_URL) return undefined;
  try {
    return new SocksProxyAgent(BINANCE_PROXY_URL);
  } catch (err) {
    cronLogger.error(`[Binance] Failed to create SOCKS proxy agent: ${err}`);
    return undefined;
  }
};

const proxyAgent = getBinanceProxyAgent();

/** Whether the proxy is actually needed (determined by detectBinanceAccess) */
let proxyNeeded: boolean | null = null; // null = not yet detected
/** Track if proxy detection failed so we can retry when tunnel comes up */
let proxyDetectionFailed = false;

/**
 * Get the effective proxy agent: returns the agent only if proxy is actually needed.
 * Before detection completes, returns undefined (optimistic direct access).
 */
export const getEffectiveProxyAgent = (): SocksProxyAgent | undefined => {
  if (proxyNeeded === true && proxyAgent) return proxyAgent;
  return undefined;
};

/**
 * Force-enable or force-disable the Binance proxy (admin override).
 * Useful when auto-detection fails but you know the proxy is available.
 */
export const forceProxyState = (enabled: boolean): { proxyNeeded: boolean; proxyDetectionFailed: boolean; proxyAvailable: boolean } => {
  proxyNeeded = enabled;
  proxyDetectionFailed = false; // Clear retry flag
  cronLogger.info(`[Binance] 🔧 Proxy FORCE-${enabled ? "ENABLED" : "DISABLED"} by admin. proxyAgent available: ${!!proxyAgent}`);
  return { proxyNeeded: enabled, proxyDetectionFailed: false, proxyAvailable: !!proxyAgent };
};

/**
 * Get current proxy detection state for diagnostics.
 */
export const getProxyState = (): { proxyNeeded: boolean | null; proxyDetectionFailed: boolean; proxyUrl: string; proxyAvailable: boolean } => {
  return { proxyNeeded, proxyDetectionFailed, proxyUrl: BINANCE_PROXY_URL, proxyAvailable: !!proxyAgent };
};

/** Callback invoked when proxy state changes (e.g., tunnel comes up) so WS can reconnect */
let onProxyStateChange: (() => void) | null = null;

/** Register a callback for proxy state changes (used by WebSocket service) */
export const setProxyStateChangeCallback = (cb: () => void): void => {
  onProxyStateChange = cb;
};

/**
 * Auto-detect whether Binance API is directly accessible from this server.
 * Re-detects if the previous detection failed (e.g., proxy tunnel was down at startup).
 * Caches permanently once proxy is confirmed working or direct access succeeds.
 */
export const detectBinanceAccess = async (): Promise<void> => {
  // Skip if already successfully detected (direct access or proxy working)
  if (proxyNeeded !== null && !proxyDetectionFailed) return;

  const previousProxyNeeded = proxyNeeded;
  const directUrl = `${BINANCE_BASE_URL}/api/v3/ping`;
  try {
    // Test direct access (no proxy) with a short timeout
    await axios.get(directUrl, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Dynopay/1.0)" },
      // Explicitly NO proxy agent
    });
    proxyNeeded = false;
    proxyDetectionFailed = false;
    cronLogger.info(`[Binance] ✅ Direct access OK — non-US deployment detected. Proxy DISABLED (lower latency).`);
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;
    if (status === 451 || status === 403) {
      // Geo-blocked — need proxy
      if (proxyAgent) {
        // Verify proxy actually works
        try {
          await axios.get(directUrl, {
            timeout: 10000,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Dynopay/1.0)" },
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
          });
          proxyNeeded = true;
          proxyDetectionFailed = false;
          cronLogger.info(`[Binance] 🌍 Geo-blocked (HTTP ${status}) — US deployment detected. Proxy ENABLED: ${BINANCE_PROXY_URL}`);
        } catch (proxyErr) {
          proxyNeeded = false;
          proxyDetectionFailed = true; // Allow retry — tunnel may come up later
          cronLogger.warn(`[Binance] 🌍 Geo-blocked but proxy also failed. Proxy DISABLED (will retry next cycle).`);
        }
      } else {
        proxyNeeded = false;
        proxyDetectionFailed = false; // No proxy configured, no point retrying
        cronLogger.warn(`[Binance] 🌍 Geo-blocked (HTTP ${status}) but no proxy configured. Will use REST fallbacks.`);
      }
    } else {
      // Network error or other issue — try without proxy first
      proxyNeeded = false;
      proxyDetectionFailed = true; // Allow retry
      cronLogger.warn(`[Binance] ⚠️ Direct ping failed (${axiosErr.message}), defaulting to no proxy. Will retry detection on next cycle.`);
    }
  }

  // If proxy state changed (e.g., tunnel came up after initial failure), reconnect WS
  if (proxyNeeded !== previousProxyNeeded && proxyNeeded !== null && onProxyStateChange) {
    cronLogger.info(`[Binance] Proxy state changed (${previousProxyNeeded} → ${proxyNeeded}). Triggering WebSocket reconnect.`);
    onProxyStateChange();
  }
};

// ============================================
// HMAC-SHA256 Signing
// ============================================

const generateSignature = (queryString: string): string => {
  return crypto
    .createHmac("sha256", BINANCE_API_SECRET)
    .update(queryString)
    .digest("hex");
};

const getTimestamp = (): number => Date.now();

const buildQueryString = (params: Record<string, string | number | boolean | undefined>): string => {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      filtered[key] = String(value);
    }
  }
  return new URLSearchParams(filtered).toString();
};

// ============================================
// HTTP Client
// ============================================

const makeSignedRequest = async (
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<unknown> => {
  const timestamp = getTimestamp();
  const allParams = { ...params, timestamp };
  const queryString = buildQueryString(allParams);
  const signature = generateSignature(queryString);
  const signedQuery = `${queryString}&signature=${signature}`;

  const url = `${BINANCE_BASE_URL}${endpoint}?${signedQuery}`;
  const headers = {
    "X-MBX-APIKEY": BINANCE_API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "Mozilla/5.0 (compatible; Dynopay/1.0)",
  };

  try {
    const response = await axios({
      method,
      url,
      headers,
      timeout: 30000,
      ...(() => { const agent = getEffectiveProxyAgent(); return agent ? { httpAgent: agent, httpsAgent: agent } : { httpAgent: keepAliveHttpAgent, httpsAgent: keepAliveHttpsAgent }; })(),
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ code?: number; msg?: string }>;
    const errMsg = axiosError.response?.data?.msg || axiosError.message;
    const errCode = axiosError.response?.data?.code;
    cronLogger.error(`[Binance] ${method} ${endpoint} failed: [${errCode}] ${errMsg}`);
    throw new Error(`Binance API error [${errCode || "NETWORK"}]: ${errMsg}`);
  }
};

const makePublicRequest = async (
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<unknown> => {
  const queryString = buildQueryString(params);
  const url = `${BINANCE_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Dynopay/1.0)" },
      ...(() => { const agent = getEffectiveProxyAgent(); return agent ? { httpAgent: agent, httpsAgent: agent } : { httpAgent: keepAliveHttpAgent, httpsAgent: keepAliveHttpsAgent }; })(),
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ code?: number; msg?: string }>;
    throw new Error(`Binance public API error: ${axiosError.response?.data?.msg || axiosError.message}`);
  }
};

// ============================================
// Account & Server
// ============================================

/** Test connectivity */
export const ping = async (): Promise<boolean> => {
  try {
    await makePublicRequest("/api/v3/ping");
    return true;
  } catch {
    return false;
  }
};

/** Get Binance server time */
export const getServerTime = async (): Promise<number> => {
  const data = (await makePublicRequest("/api/v3/time")) as { serverTime: number };
  return data.serverTime;
};

/** Get account information (balances) */
export const getAccountInfo = async (): Promise<{
  balances: Array<{ asset: string; free: string; locked: string }>;
}> => {
  const data = (await makeSignedRequest("GET", "/api/v3/account")) as {
    balances: Array<{ asset: string; free: string; locked: string }>;
  };
  return data;
};

/** Get balance for a specific asset */
export const getAssetBalance = async (asset: string): Promise<{ free: number; locked: number }> => {
  const account = await getAccountInfo();
  const balance = account.balances.find((b) => b.asset === asset.toUpperCase());
  return {
    free: parseFloat(balance?.free || "0"),
    locked: parseFloat(balance?.locked || "0"),
  };
};

// ============================================
// Order Book & Limit IOC
// ============================================

/** Get order book depth for a trading pair */
export const getOrderBookDepth = async (
  symbol: string,
  limit: number = 5
): Promise<{
  symbol: string;
  bestBid: string;
  bestBidQty: string;
  bestAsk: string;
  bestAskQty: string;
  spread: string;
  bids: Array<{ price: string; quantity: string }>;
  asks: Array<{ price: string; quantity: string }>;
}> => {
  const data = (await makePublicRequest("/api/v3/depth", { symbol, limit })) as {
    bids: Array<[string, string]>;
    asks: Array<[string, string]>;
  };

  return {
    symbol,
    bestBid: data.bids[0]?.[0] || "0",
    bestBidQty: data.bids[0]?.[1] || "0",
    bestAsk: data.asks[0]?.[0] || "0",
    bestAskQty: data.asks[0]?.[1] || "0",
    spread: data.bids[0] && data.asks[0]
      ? (parseFloat(data.asks[0][0]) - parseFloat(data.bids[0][0])).toFixed(8)
      : "0",
    bids: data.bids.map(([price, quantity]) => ({ price, quantity })),
    asks: data.asks.map(([price, quantity]) => ({ price, quantity })),
  };
};

/** Place a Limit IOC sell order (instant fill at best available price, no worse than limit) */
export const placeLimitIOCSell = async (
  symbol: string,
  quantity: number,
  price: string
): Promise<{
  orderId: number;
  symbol: string;
  status: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
}> => {
  const info = await getExchangeInfo(symbol);
  const roundedQty = roundToStepSize(quantity, info.stepSize);

  // Round price to tick size (get from PRICE_FILTER)
  const priceFilterData = (await makePublicRequest("/api/v3/exchangeInfo", { symbol })) as {
    symbols: Array<{ filters: Array<{ filterType: string; tickSize?: string }> }>;
  };
  const priceFilter = priceFilterData.symbols[0]?.filters.find((f) => f.filterType === "PRICE_FILTER");
  const tickSize = priceFilter?.tickSize || "0.01";
  const roundedPrice = roundToStepSize(parseFloat(price), tickSize);

  cronLogger.info(`[Binance] Limit IOC SELL ${roundedQty} ${symbol} @ ${roundedPrice}`);

  const data = (await makeSignedRequest("POST", "/api/v3/order", {
    symbol,
    side: "SELL",
    type: "LIMIT",
    timeInForce: "IOC",
    quantity: roundedQty,
    price: roundedPrice,
  })) as {
    orderId: number;
    symbol: string;
    status: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    fills: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
  };

  return data;
};

/** Convert crypto to stablecoin via Limit IOC for best price, with market order fallback */
export const convertViaLimitIOC = async (
  fromAsset: string,
  toAsset: string,
  fromAmount: number
): Promise<{
  orderId: number;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  avgPrice: string;
  status: string;
  method: string;
  fillPercent: number;
}> => {
  const from = toBinanceAsset(fromAsset);
  const to = toBinanceAsset(toAsset);
  const symbol = `${from}${to}`;

  // Step 1: Check order book for best bid
  const orderBook = await getOrderBookDepth(symbol, 5);
  const bestBid = orderBook.bestBid;

  cronLogger.info(`[Binance] Converting ${fromAmount} ${from} → ${to} via Limit IOC @ best bid ${bestBid}`);

  // Step 2: Place Limit IOC at best bid
  const order = await placeLimitIOCSell(symbol, fromAmount, bestBid);
  const executedQty = parseFloat(order.executedQty);
  const fillPercent = fromAmount > 0 ? (executedQty / fromAmount) * 100 : 0;

  // Step 3: If less than 95% filled, try market order for remainder
  if (fillPercent < 95 && fromAmount - executedQty > 0.000001) {
    cronLogger.info(`[Binance] IOC filled ${fillPercent.toFixed(1)}%, using market order for remainder`);
    const remaining = fromAmount - executedQty;
    try {
      const marketOrder = await placeMarketSellOrder(symbol, remaining);
      const totalExecuted = executedQty + parseFloat(marketOrder.executedQty);
      const totalQuote = parseFloat(order.cummulativeQuoteQty) + parseFloat(marketOrder.cummulativeQuoteQty);
      const avgPrice = totalExecuted > 0 ? (totalQuote / totalExecuted).toFixed(8) : "0";

      return {
        orderId: order.orderId,
        fromAsset: from,
        toAsset: to,
        fromAmount: totalExecuted.toFixed(8),
        toAmount: totalQuote.toFixed(8),
        avgPrice,
        status: "FILLED",
        method: "LIMIT_IOC+MARKET_FALLBACK",
        fillPercent: 100,
      };
    } catch (err) {
      cronLogger.error(`[Binance] Market fallback failed:`, err);
      // Return partial fill from IOC
    }
  }

  const quoteQty = parseFloat(order.cummulativeQuoteQty);
  const avgPrice = executedQty > 0 ? (quoteQty / executedQty).toFixed(8) : "0";

  return {
    orderId: order.orderId,
    fromAsset: from,
    toAsset: to,
    fromAmount: order.executedQty,
    toAmount: order.cummulativeQuoteQty,
    avgPrice,
    status: order.status,
    method: "LIMIT_IOC",
    fillPercent,
  };
};

// ============================================
// Spot Trading API (works with standard canTrade permission)
// ============================================

/** Get exchange info for a trading pair (min qty, step size, etc.) */
export const getExchangeInfo = async (symbol: string): Promise<{
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  stepSize: string;
  minQty: string;
  minNotional: string;
  status: string;
}> => {
  const data = (await makePublicRequest("/api/v3/exchangeInfo", { symbol })) as {
    symbols: Array<{
      symbol: string;
      baseAsset: string;
      quoteAsset: string;
      status: string;
      filters: Array<{ filterType: string; stepSize?: string; minQty?: string; minNotional?: string }>;
    }>;
  };
  const symbolInfo = data.symbols[0];
  if (!symbolInfo) throw new Error(`Symbol ${symbol} not found on Binance`);

  const lotSize = symbolInfo.filters.find((f) => f.filterType === "LOT_SIZE");
  const notional = symbolInfo.filters.find((f) => f.filterType === "NOTIONAL" || f.filterType === "MIN_NOTIONAL");

  return {
    symbol: symbolInfo.symbol,
    baseAsset: symbolInfo.baseAsset,
    quoteAsset: symbolInfo.quoteAsset,
    stepSize: lotSize?.stepSize || "0.00000001",
    minQty: lotSize?.minQty || "0.00000001",
    minNotional: notional?.minNotional || "10",
    status: symbolInfo.status,
  };
};

/** Round quantity to valid step size */
const roundToStepSize = (quantity: number, stepSize: string): string => {
  const step = parseFloat(stepSize);
  if (step === 0) return quantity.toFixed(8);
  const precision = stepSize.indexOf("1") - stepSize.indexOf(".");
  if (precision < 0) return Math.floor(quantity / step) * step + "";
  const rounded = Math.floor(quantity / step) * step;
  return rounded.toFixed(Math.max(0, precision));
};

/** Place a market sell order (convert crypto to stablecoin) */
export const placeMarketSellOrder = async (
  symbol: string,
  quantity: number
): Promise<{
  orderId: number;
  symbol: string;
  status: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  fills: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
}> => {
  // Get symbol info for proper quantity formatting
  const info = await getExchangeInfo(symbol);
  const roundedQty = roundToStepSize(quantity, info.stepSize);

  cronLogger.info(`[Binance] Market SELL ${roundedQty} on ${symbol}`);

  const data = (await makeSignedRequest("POST", "/api/v3/order", {
    symbol,
    side: "SELL",
    type: "MARKET",
    quantity: roundedQty,
  })) as {
    orderId: number;
    symbol: string;
    status: string;
    executedQty: string;
    cummulativeQuoteQty: string;
    fills: Array<{ price: string; qty: string; commission: string; commissionAsset: string }>;
  };

  return data;
};

/** Convert crypto to stablecoin via spot market order */
export const convertViaSpotTrade = async (
  fromAsset: string,
  toAsset: string,
  fromAmount: number
): Promise<{
  orderId: number;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  avgPrice: string;
  status: string;
}> => {
  const from = toBinanceAsset(fromAsset);
  const to = toBinanceAsset(toAsset);
  const symbol = `${from}${to}`; // e.g., BTCUSDT

  const order = await placeMarketSellOrder(symbol, fromAmount);

  const executedQty = parseFloat(order.executedQty);
  const quoteQty = parseFloat(order.cummulativeQuoteQty);
  const avgPrice = executedQty > 0 ? (quoteQty / executedQty).toFixed(8) : "0";

  return {
    orderId: order.orderId,
    fromAsset: from,
    toAsset: to,
    fromAmount: order.executedQty,
    toAmount: order.cummulativeQuoteQty,
    avgPrice,
    status: order.status,
  };
};

/** Get a spot trade price quote (without executing) */
export const getSpotQuote = async (
  fromAsset: string,
  toAsset: string,
  fromAmount: number
): Promise<{
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  estimatedToAmount: string;
  price: string;
  symbol: string;
}> => {
  const from = toBinanceAsset(fromAsset);
  const to = toBinanceAsset(toAsset);
  const symbol = `${from}${to}`;

  const price = await getPrice(symbol);
  const estimatedToAmount = (fromAmount * price).toFixed(8);

  return {
    fromAsset: from,
    toAsset: to,
    fromAmount: fromAmount.toFixed(8),
    estimatedToAmount,
    price: price.toString(),
    symbol,
  };
};

// ============================================
// Convert API (requires special Binance approval)
// ============================================

/** Map Dynopay currency names to Binance asset names */
const toBinanceAsset = (currency: string): string => {
  const map: Record<string, string> = {
    BTC: "BTC",
    ETH: "ETH",
    LTC: "LTC",
    DOGE: "DOGE",
    TRX: "TRX",
    BCH: "BCH",
    SOL: "SOL",
    XRP: "XRP",
    POLYGON: "POL",  // Binance renamed MATIC to POL (2024)
    USDT: "USDT",
    USDC: "USDC",
    "USDT-TRC20": "USDT",
    "USDT-ERC20": "USDT",
    "USDC-ERC20": "USDC",
    "USDT-POLYGON": "USDT",
    "RLUSD": "RLUSD",
    "RLUSD-ERC20": "RLUSD",
  };
  return map[currency] || currency;
};

/** Get a conversion quote (does NOT execute — safe for testing) */
export const getConvertQuote = async (
  fromAsset: string,
  toAsset: string,
  fromAmount: number
): Promise<{
  quoteId: string;
  ratio: string;
  inverseRatio: string;
  validTimestamp: number;
  toAmount: string;
  fromAmount: string;
}> => {
  const data = (await makeSignedRequest("POST", "/sapi/v1/convert/getQuote", {
    fromAsset: toBinanceAsset(fromAsset),
    toAsset: toBinanceAsset(toAsset),
    fromAmount: fromAmount.toFixed(8),
    validTime: "30s",
  })) as {
    quoteId: string;
    ratio: string;
    inverseRatio: string;
    validTimestamp: number;
    toAmount: string;
    fromAmount: string;
  };
  return data;
};

/** Accept a conversion quote (EXECUTES the conversion) */
export const acceptConvertQuote = async (
  quoteId: string
): Promise<{
  orderId: string;
  createTime: number;
  orderStatus: string; // "PROCESS" | "ACCEPT_SUCCESS" | "SUCCESS" | "FAIL"
}> => {
  const data = (await makeSignedRequest("POST", "/sapi/v1/convert/acceptQuote", {
    quoteId,
  })) as {
    orderId: string;
    createTime: number;
    orderStatus: string;
  };
  return data;
};

/** Check conversion order status */
export const getConvertOrderStatus = async (
  orderId: string
): Promise<{
  orderId: string;
  orderStatus: string;
  fromAsset: string;
  fromAmount: string;
  toAsset: string;
  toAmount: string;
  ratio: string;
  inverseRatio: string;
  createTime: number;
}> => {
  const data = (await makeSignedRequest("GET", "/sapi/v1/convert/orderStatus", {
    orderId,
  })) as {
    orderId: string;
    orderStatus: string;
    fromAsset: string;
    fromAmount: string;
    toAsset: string;
    toAmount: string;
    ratio: string;
    inverseRatio: string;
    createTime: number;
  };
  return data;
};

// ============================================
// Withdrawal API
// ============================================

/** Map settlement chain to Binance network name */
const toBinanceNetwork = (chain: string): string => {
  const map: Record<string, string> = {
    ERC20: "ETH",
    TRC20: "TRX",
    POLYGON: "MATIC",
    BEP20: "BSC",
    SOL: "SOL",
    // Binance uses these network names
  };
  return map[chain] || chain;
};

/** Submit a withdrawal request */
export const submitWithdrawal = async ({
  coin,
  address,
  amount,
  network,
  addressTag,
}: {
  coin: string; // e.g., "USDT", "USDC"
  address: string;
  amount: number;
  network: string; // e.g., "ERC20", "TRC20"
  addressTag?: string; // For XRP memo, etc.
}): Promise<{ id: string }> => {
  const params: Record<string, string | number | boolean | undefined> = {
    coin: coin.toUpperCase(),
    address,
    amount: amount.toFixed(8),
    network: toBinanceNetwork(network),
  };
  if (addressTag) {
    params.addressTag = addressTag;
  }

  const data = (await makeSignedRequest("POST", "/sapi/v1/capital/withdraw/apply", params)) as { id: string };
  return data;
};

/** Check withdrawal status */
export const getWithdrawalHistory = async ({
  coin,
  withdrawOrderId,
  limit = 10,
}: {
  coin?: string;
  withdrawOrderId?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    amount: string;
    transactionFee: string;
    coin: string;
    status: number; // 0=Email Sent, 1=Cancelled, 2=Awaiting Approval, 3=Rejected, 4=Processing, 5=Failure, 6=Completed
    address: string;
    txId: string;
    network: string;
    completeTime: string;
  }>
> => {
  const params: Record<string, string | number | boolean | undefined> = { limit };
  if (coin) params.coin = coin;
  if (withdrawOrderId) params.withdrawOrderId = withdrawOrderId;

  const data = (await makeSignedRequest("GET", "/sapi/v1/capital/withdraw/history", params)) as Array<{
    id: string;
    amount: string;
    transactionFee: string;
    coin: string;
    status: number;
    address: string;
    txId: string;
    network: string;
    completeTime: string;
  }>;
  return data;
};

// ============================================
// Deposit Detection
// ============================================

/** Get deposit history (to detect when crypto arrives in Binance) */
export const getDepositHistory = async ({
  coin,
  status,
  startTime,
  endTime,
  limit = 100,
}: {
  coin?: string;
  status?: number; // 0=pending, 6=credited, 1=success
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    amount: string;
    coin: string;
    network: string;
    status: number;
    address: string;
    txId: string;
    insertTime: number;
    confirmTimes: string;
  }>
> => {
  const params: Record<string, string | number | boolean | undefined> = { limit };
  if (coin) params.coin = coin;
  if (status !== undefined) params.status = status;
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;

  const data = (await makeSignedRequest("GET", "/sapi/v1/capital/deposit/hisrec", params)) as Array<{
    id: string;
    amount: string;
    coin: string;
    network: string;
    status: number;
    address: string;
    txId: string;
    insertTime: number;
    confirmTimes: string;
  }>;
  return data;
};

/** Get deposit address for a coin */
export const getDepositAddress = async (
  coin: string,
  network?: string
): Promise<{ address: string; coin: string; tag: string; url: string }> => {
  const params: Record<string, string | number | boolean | undefined> = {
    coin: coin.toUpperCase(),
  };
  if (network) params.network = toBinanceNetwork(network);

  const data = (await makeSignedRequest("GET", "/sapi/v1/capital/deposit/address", params)) as {
    address: string;
    coin: string;
    tag: string;
    url: string;
  };
  return data;
};

// ============================================
// Price Queries
// ============================================

/** Get current price for a trading pair */
/** Get current price for a symbol — prefers WebSocket cache, falls back to REST */
export const getPrice = async (symbol: string): Promise<number> => {
  // Try WebSocket cache first (no REST call needed)
  try {
    const { getPrice: wsGetPrice } = require("./binanceWebSocketService");
    const asset = symbol.replace("USDT", "");
    const wsPrice = await wsGetPrice(asset);
    if (wsPrice > 0) return wsPrice;
  } catch {
    // WebSocket not available, fall through to REST
  }

  const data = (await makePublicRequest("/api/v3/ticker/price", { symbol })) as { price: string };
  return parseFloat(data.price);
};

/** Get all prices — prefers WebSocket cache, falls back to REST */
export const getAllPrices = async (): Promise<Record<string, number>> => {
  // Try WebSocket cache first
  try {
    const { getAllPrices: wsGetAllPrices } = require("./binanceWebSocketService");
    const wsPrices = await wsGetAllPrices();
    if (Object.keys(wsPrices).length > 0) {
      // Convert asset names to symbol format (BTC → BTCUSDT)
      const result: Record<string, number> = {};
      for (const [asset, price] of Object.entries(wsPrices)) {
        result[`${asset}USDT`] = price as number;
      }
      return result;
    }
  } catch {
    // Fall through to REST
  }

  const data = (await makePublicRequest("/api/v3/ticker/price")) as Array<{ symbol: string; price: string }>;
  const prices: Record<string, number> = {};
  for (const item of data) {
    prices[item.symbol] = parseFloat(item.price);
  }
  return prices;
};

// ============================================
// Stablecoin Detection
// ============================================

/** Currencies that are already stablecoins (no conversion needed) */
export const STABLECOIN_CURRENCIES = [
  "USDT", "USDC", "RLUSD",
  "USDT-TRC20", "USDT-ERC20", "USDC-ERC20",
  "USDT-POLYGON", "RLUSD-ERC20",
];

/** Check if a currency is already a stablecoin */
export const isStablecoin = (currency: string): boolean => {
  return STABLECOIN_CURRENCIES.includes(currency);
};

/** Volatile currencies that need conversion */
export const VOLATILE_CURRENCIES = [
  "BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "SOL", "XRP", "POLYGON",
];

export const isVolatileCrypto = (currency: string): boolean => {
  return VOLATILE_CURRENCIES.includes(currency);
};

// ============================================
// Export all
// ============================================

export default {
  ping,
  getServerTime,
  getAccountInfo,
  getAssetBalance,
  getOrderBookDepth,
  placeLimitIOCSell,
  convertViaLimitIOC,
  getExchangeInfo,
  placeMarketSellOrder,
  convertViaSpotTrade,
  getSpotQuote,
  getConvertQuote,
  acceptConvertQuote,
  getConvertOrderStatus,
  submitWithdrawal,
  getWithdrawalHistory,
  getDepositHistory,
  getDepositAddress,
  getPrice,
  getAllPrices,
  isStablecoin,
  isVolatileCrypto,
  toBinanceAsset,
  STABLECOIN_CURRENCIES,
  VOLATILE_CURRENCIES,
};
