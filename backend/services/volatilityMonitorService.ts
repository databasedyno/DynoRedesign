/**
 * Volatility Monitor Service (v2 — WebSocket-powered)
 *
 * Background job that monitors price volatility for all non-stable
 * cryptocurrencies. Determines market state and recommends sweep fee
 * tiers to minimize merchant price exposure.
 *
 * **v2 change**: Instead of polling Binance REST for each asset (which
 * caused rate-limit errors), this version reads price & kline data from
 * the persistent Binance WebSocket stream (binanceWebSocketService).
 * A lightweight 30-second interval just re-classifies market state from
 * the already-cached WebSocket data — zero additional REST calls.
 *
 * The WebSocket service handles its own reconnect/fallback logic.
 */

import { setRedisItemWithTTL, getRedisItem } from "../utils/redisInstance";
import { cronLogger } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";
import {
  getKlines,
  getTickerData,
  isConnected as wsIsConnected,
  getStatus as wsGetStatus,
  TRACKED_ASSETS,
  type KlineCandle,
} from "./binanceWebSocketService";
import { toFixedStr, toNumber } from "../utils/money";

const LOG_PREFIX = "[VolatilityMonitor]";
const log = (msg: string) => cronLogger.info(`${LOG_PREFIX} ${msg}`);

// ============================================
// Market State Thresholds (unchanged from v1)
// ============================================

const THRESHOLDS = {
  STABLE: -0.5,        // |ROC| < 0.5%
  VOLATILE: -1.5,      // ROC between -0.5% and -1.5%
  DECLINING: -3.0,     // ROC between -1.5% and -3.0%
  RAPID_DECLINE: -5.0, // ROC between -3.0% and -5.0%
  // Below -5.0% = CRASH
};

const STATE_TO_FEE_TIER: Record<string, string> = {
  STABLE: "slow",
  VOLATILE: "medium",
  DECLINING: "fast",
  RAPID_DECLINE: "fastest",
  CRASH: "fastest",
};

// Alert cooldown: max 1 alert per crypto per 30 minutes
const alertCooldowns: Record<string, number> = {};
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

// Redis key prefix
const REDIS_KEY_PREFIX = "dynopay:v1:volatility";

// All non-stable cryptos Dynopay supports (re-exported from WS service)
const MONITORED_ASSETS = TRACKED_ASSETS;

// ============================================
// Types (unchanged from v1)
// ============================================

export interface MarketState {
  asset: string;
  symbol: string;
  roc30m: number;        // 30-min rate of change (%)
  volumeRatio: number;   // recent volume vs average (1.0 = normal)
  state: string;         // STABLE | VOLATILE | DECLINING | RAPID_DECLINE | CRASH
  feeTier: string;       // slow | medium | fast | fastest
  currentPrice: number;
  updatedAt: string;
}

// ============================================
// Classification Logic (unchanged from v1)
// ============================================

const classifyState = (roc: number, volumeRatio: number): { state: string; feeTier: string } => {
  let state: string;

  if (roc >= THRESHOLDS.STABLE) {
    state = "STABLE";
  } else if (roc >= THRESHOLDS.VOLATILE) {
    state = "VOLATILE";
  } else if (roc >= THRESHOLDS.DECLINING) {
    state = "DECLINING";
  } else if (roc >= THRESHOLDS.RAPID_DECLINE) {
    state = "RAPID_DECLINE";
  } else {
    state = "CRASH";
  }

  let feeTier = STATE_TO_FEE_TIER[state];

  // Volume spike combined with negative ROC bumps tier up one level
  if (volumeRatio > 2.0 && roc < 0) {
    const tierOrder = ["slow", "medium", "fast", "fastest"];
    const currentIdx = tierOrder.indexOf(feeTier);
    if (currentIdx < tierOrder.length - 1) {
      feeTier = tierOrder[currentIdx + 1];
    }
  }

  return { state, feeTier };
};

// ============================================
// Asset Analysis — now reads from WebSocket cache
// ============================================

/**
 * Analyze a single asset using WebSocket kline + ticker data.
 * No REST calls are made here.
 */
const analyzeAsset = async (asset: string): Promise<MarketState | null> => {
  const symbol = `${asset}USDT`;

  try {
    // Get kline candles from WebSocket cache (falls back to REST internally if needed)
    const klines: KlineCandle[] = await getKlines(asset);

    if (klines.length < 7) {
      // Not enough data yet (WebSocket may still be warming up)
      return null;
    }

    const closes = klines.map((k) => k.close);
    const volumes = klines.map((k) => k.volume);

    // 30-min ROC: compare current close to close 6 candles ago (6 × 5min = 30min)
    const currentPrice = closes[closes.length - 1];
    const price30mAgo = closes[closes.length - 7];
    const roc30m = ((currentPrice - price30mAgo) / price30mAgo) * 100;

    // Volume ratio: last 2 candles avg vs full window avg
    const recentVolAvg = (volumes[volumes.length - 1] + volumes[volumes.length - 2]) / 2;
    const fullAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeRatio = fullAvg > 0 ? recentVolAvg / fullAvg : 1;

    const { state, feeTier } = classifyState(roc30m, volumeRatio);

    // Prefer real-time price from the ticker stream if available
    const ticker = getTickerData(asset);
    const livePrice = ticker ? ticker.price : currentPrice;

    return {
      asset,
      symbol,
      roc30m: toNumber(roc30m, 4),
      volumeRatio: toNumber(volumeRatio, 2),
      state,
      feeTier,
      currentPrice: livePrice,
      updatedAt: new Date().toISOString(),
    };
  } catch (err: unknown) {
    // Should not happen since WebSocket cache is always available
    const msg = err instanceof Error ? err.message : String(err);
    log(`⚠️ analyzeAsset(${asset}) failed: ${msg}`);
    return null;
  }
};

// ============================================
// Admin Alerts (unchanged)
// ============================================

const maybeAlertAdmin = async (state: MarketState) => {
  if (state.state !== "RAPID_DECLINE" && state.state !== "CRASH") return;

  const lastAlert = alertCooldowns[state.asset] || 0;
  if (Date.now() - lastAlert < ALERT_COOLDOWN_MS) return;

  alertCooldowns[state.asset] = Date.now();

  const severity = state.state === "CRASH" ? "CRITICAL" : "WARNING";
  const message = `${severity}: ${state.asset} is in ${state.state} state.\n` +
    `30-min ROC: ${toFixedStr(state.roc30m, 2)}%\n` +
    `Current price: $${toFixedStr(state.currentPrice, 2)}\n` +
    `Volume ratio: ${toFixedStr(state.volumeRatio, 2)}x\n` +
    `Recommended fee tier: ${state.feeTier}\n` +
    `${state.state === "CRASH" ? "Consider temporarily pausing new payment acceptance for this currency." : ""}`;

  log(`🚨 Sending admin alert for ${state.asset}: ${state.state}`);

  try {
    cronLogger.warn(`\n${"=".repeat(60)}\n🚨 VOLATILITY ALERT: ${message}\n${"=".repeat(60)}\n`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`❌ Failed to send admin alert: ${errMsg}`);
    captureError(err instanceof Error ? err : new Error(errMsg), 'blockchain', { extraContext: `Volatility alert for ${state.asset}` });
  }
};

// ============================================
// Redis State Storage (unchanged)
// ============================================

const storeState = async (state: MarketState) => {
  try {
    const key = `${REDIS_KEY_PREFIX}:${state.asset}`;
    await setRedisItemWithTTL(key, JSON.stringify(state), 120);
  } catch {
    // Redis may not be available — fail silently
  }
};

// In-memory cache
const memoryCache: Record<string, MarketState> = {};

// ============================================
// Monitor Cycle — no REST calls, just re-classify from WS cache
// ============================================

/**
 * Run one cycle of the volatility monitor.
 *
 * v2: All data comes from the WebSocket cache. No batching or rate-limit
 * concerns. The entire cycle is essentially a set of in-memory reads
 * plus classification math.
 */
export const runMonitorCycle = async (): Promise<MarketState[]> => {
  const results: MarketState[] = [];
  const failedAssets: string[] = [];

  // Process all assets — no batching needed, it's all from cache
  for (const asset of MONITORED_ASSETS) {
    const state = await analyzeAsset(asset);
    if (state) {
      results.push(state);
      memoryCache[state.asset] = state;
      await storeState(state);
      await maybeAlertAdmin(state);
    } else {
      failedAssets.push(asset);
    }
  }

  // Log WebSocket health alongside results — but only when WS is connected
  // (when geo-blocked, all assets always fail — no point logging every 30s)
  if (failedAssets.length > 0) {
    const wsStatus = wsGetStatus();
    if (wsStatus.connected) {
      log(`⚠️ ${failedAssets.length} assets had insufficient data: ${failedAssets.join(", ")} | WS connected: ${wsStatus.connected}, cached klines: ${wsStatus.cachedKlines}`);
    }
  }

  return results;
};

// ============================================
// Public API (unchanged signatures)
// ============================================

/**
 * Get current market state for a specific currency.
 */
export const getMarketState = async (currency: string): Promise<MarketState | null> => {
  const asset = currency.toUpperCase();

  // Try Redis first
  try {
    const key = `${REDIS_KEY_PREFIX}:${asset}`;
    const data = await getRedisItem(key);
    if (data) return JSON.parse(data as string);
  } catch {
    // Fall through to memory cache
  }

  // Fallback to memory cache
  if (memoryCache[asset]) return memoryCache[asset];

  // If no cached data, compute from WebSocket data
  const fresh = await analyzeAsset(asset);
  if (fresh) {
    memoryCache[asset] = fresh;
    await storeState(fresh);
  }
  return fresh;
};

/**
 * Get recommended fee tier for a currency.
 */
export const getRecommendedFeeTier = async (currency: string): Promise<string> => {
  const state = await getMarketState(currency);
  return state?.feeTier || "medium"; // Default to medium if no data
};

/**
 * Get all current market states.
 */
export const getAllMarketStates = (): Record<string, MarketState> => {
  return { ...memoryCache };
};

// ============================================
// Lifecycle
// ============================================

let monitorInterval: NodeJS.Timeout | null = null;

/**
 * Start the volatility monitor.
 *
 * v2: Runs every 30 seconds (was 60s in v1). Since there are no REST
 * calls, the cycle is essentially free — just in-memory classification.
 */
export const startVolatilityMonitor = () => {
  if (monitorInterval) return;

  log("Starting volatility monitor (30s interval, WebSocket-powered)");

  // Initial run after a small delay to let WebSocket populate kline cache
  setTimeout(async () => {
    try {
      const results = await runMonitorCycle();
      log(`Initial scan: ${results.length}/${MONITORED_ASSETS.length} assets classified | WS connected: ${wsIsConnected()}`);
      const declining = results.filter((r) => r.roc30m < -1.5);
      if (declining.length > 0) {
        log(`⚠️ Declining: ${declining.map((r) => `${r.asset}(${toFixedStr(r.roc30m, 2)}%)`).join(", ")}`);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`❌ Initial scan failed: ${errMsg}`);
      captureError(err instanceof Error ? err : new Error(errMsg), 'blockchain', { extraContext: 'VolatilityMonitor initial scan' });
    }
  }, 15000); // 15s delay for WebSocket to warm up

  // Schedule recurring runs every 30 seconds
  monitorInterval = setInterval(async () => {
    try {
      await runMonitorCycle();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`❌ Monitor cycle failed: ${errMsg}`);
      captureError(err instanceof Error ? err : new Error(errMsg), 'blockchain', { extraContext: 'VolatilityMonitor cycle' });
    }
  }, 30000); // Every 30 seconds (was 60s in v1)
};

export const stopVolatilityMonitor = () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log("Volatility monitor stopped");
  }
};

export default {
  startVolatilityMonitor,
  stopVolatilityMonitor,
  runMonitorCycle,
  getMarketState,
  getRecommendedFeeTier,
  getAllMarketStates,
};
