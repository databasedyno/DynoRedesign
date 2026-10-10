// Phase 4: resilient Tatum HTTP client (retries transient GET/read failures).
import { raw as envRaw } from "../utils/config";
import axios from "../utils/tatumHttp";
import { apiLogger } from "../utils/loggers";
import { TATUM_V3_URL, getTatumApiKey } from "../utils/tatumAuth";
import { mul, toFixedStr } from "../utils/money";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { SUPPORTED_DISPLAY_CURRENCIES } from "../utils/displayCurrencies";

// ═══════════════════════════════════════════════════════════════════════════
// FX ENGINE — how a rate is resolved (FIAT/CRYPTO audit 2026-06, F1–F6/F10)
//
//   1. same currency / USD↔stablecoin peg            → exact (1)
//   2. 30s per-request cache                          → recent live rate
//   3. FastForex (fiat↔fiat, only if a key is set)    → live
//   4. background cache (cron every 2 min, in-memory) → live, ≤3 min crypto / ≤15 min fiat
//   5. Tatum live, then CoinGecko live                → live
//   6. LAST-KNOWN store (memory + Redis, 48h)         → STALE, age-capped:
//        • strict (money: quotes, fees, settlement) ≤ 30 min, else RateUnavailableError
//        • display (dashboards, estimates)          ≤ 24 h, else { unavailable: true }
//
// A conversion NEVER silently returns 0 or 1 as if it were a real rate:
// strict callers get a typed error, display callers get `unavailable: true`
// (amount/transferRate 0) and must fall back to USD for BOTH symbol and number.
//
// Precision depends on the TARGET asset, not the magnitude (F3):
//   fiat → 2 dp (sub-unit values keep 8 dp unless fixedDecimal), crypto → the
//   asset's own decimals (BTC/ETH/LTC… 8, TRX/XRP/USDT/USDC 6). transferRate is
//   never rounded to 2 dp (USD→EUR 0.8917 used to become 0.89).
// ═══════════════════════════════════════════════════════════════════════════

export interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
  /** Epoch ms when the rate used was observed (≈ now for live rates). */
  rateAsOf?: number;
  /** True when no live provider answered and a last-known rate was used. */
  stale?: boolean;
  /** True when NO usable rate exists (display mode only) — amount/transferRate are 0. */
  unavailable?: boolean;
}

export interface ConvertOptions {
  /** Money path: last-known fallback capped at MONEY_RATE_MAX_AGE_MS, then throw RateUnavailableError. */
  strict?: boolean;
  /** Display path override for the last-known cap (default DISPLAY_RATE_MAX_AGE_MS). */
  maxStaleMs?: number;
}

/** Money paths may use a last-known rate at most this old (user decision 2026-06: ~30 min). */
export const MONEY_RATE_MAX_AGE_MS = 30 * 60 * 1000;
/** Display paths may show a last-known rate up to this old, labelled "rate as of hh:mm". */
export const DISPLAY_RATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LAST_KNOWN_REDIS_TTL_S = 48 * 60 * 60;

export class RateUnavailableError extends Error {
  code = "RATE_UNAVAILABLE" as const;
  status = 503;
  from: string;
  to: string;
  constructor(from: string, to: string, maxAgeMs: number) {
    super(
      `Exchange rate ${from}→${to} is temporarily unavailable (no live rate and no rate newer than ${Math.round(maxAgeMs / 60000)} min)`,
    );
    this.name = "RateUnavailableError";
    this.from = from;
    this.to = to;
  }
}

export const isRateUnavailableError = (e: unknown): e is RateUnavailableError =>
  !!e && (e instanceof RateUnavailableError || (e as { code?: string })?.code === "RATE_UNAVAILABLE");

// ============================================
// BACKGROUND RATE CACHE (component-based, refreshed by cron every 2 min)
// ============================================
// Stores USD legs only and derives every pair from them, so ANY combination of
// supported crypto/fiat is served from cache (the old pair cache only covered
// 5 coins × USD/EUR/GBP/BRL and expired 7 of every 10 minutes — F4/F5).
// In-process per instance (fast); the cross-instance fallback is the Redis
// last-known store below (F6).
type RatePoint = { rate: number; at: number };
const usdPriceCache = new Map<string, RatePoint>(); // ASSET → USD price of 1 unit
const usdToFiatCache = new Map<string, RatePoint>(); // FIAT  → units of FIAT per 1 USD
let lastBackgroundRefresh: { at: number; provider: string; rates: number } | null = null;
let lastFiatRefreshAt = 0;

/** Freshness of the always-on background rate cache (read by the gateway-health endpoint). */
export const getBackgroundRateCacheStatus = () => lastBackgroundRefresh;

const CRYPTO_REFRESH_MS = 2 * 60 * 1000; // cron cadence (server.ts "*/2 * * * *")
const CRYPTO_FRESH_MS = CRYPTO_REFRESH_MS + 60 * 1000; // interval + 60s margin → never a gap
const FIAT_REFRESH_MS = 10 * 60 * 1000; // fiat FX moves slowly — refresh every 5th tick
const FIAT_FRESH_MS = FIAT_REFRESH_MS + 5 * 60 * 1000;

// FastForex API key (optional real-time fiat provider — 150-300ms)
const FASTFOREX_API_KEY = envRaw("FASTFOREX_API_KEY") || '';

// Every brand display currency (+ BRL, a common API-key base currency).
const CACHE_FIAT_TARGETS = Array.from(new Set([...SUPPORTED_DISPLAY_CURRENCIES, 'BRL'])).filter((c) => c !== 'USD');
// Every volatile asset the checkout accepts (stablecoins are pegged 1:1 to USD).
const CACHE_CRYPTO_TARGETS = ['BTC', 'ETH', 'LTC', 'DOGE', 'BCH', 'TRX', 'SOL', 'XRP', 'BNB', 'MATIC'];

const USD_PEGGED = new Set(['USD', 'USDT', 'USDC', 'RLUSD']);

// ── Last-known store (memory + Redis, shared across instances) ──────────────
const lastKnownPair = new Map<string, RatePoint>(); // "FROM:TO" → rate
const lastKnownUsd = new Map<string, RatePoint>(); // CODE → USD value of 1 unit
const lkPairKey = (from: string, to: string) => `fx:lk:v1:pair:${from}:${to}`;
const lkUsdKey = (code: string) => `fx:lk:v1:usd:${code}`;

const persistLastKnown = (key: string, point: RatePoint) => {
  // Fire-and-forget: a Redis hiccup must never slow or fail a conversion.
  setRedisItemWithTTL(key, point, LAST_KNOWN_REDIS_TTL_S).catch(() => {});
};

/** Remember the USD value of 1 unit of `code` (crypto price, or 1/fiat-per-USD). */
const rememberUsdPerUnit = (code: string, usdPerUnit: number, at: number = Date.now()) => {
  if (!(usdPerUnit > 0) || !Number.isFinite(usdPerUnit)) return;
  const point = { rate: usdPerUnit, at };
  lastKnownUsd.set(code, point);
  persistLastKnown(lkUsdKey(code), point);
};

/** Remember a live pair rate (and its inverse) as the last-known value. */
const rememberPairRate = (from: string, to: string, rate: number, at: number = Date.now()) => {
  if (!(rate > 0) || !Number.isFinite(rate)) return;
  lastKnownPair.set(`${from}:${to}`, { rate, at });
  lastKnownPair.set(`${to}:${from}`, { rate: 1 / rate, at });
  persistLastKnown(lkPairKey(from, to), { rate, at });
};

const readRedisPoint = async (key: string): Promise<RatePoint | null> => {
  try {
    const v = (await getRedisItem(key)) as Partial<RatePoint> | null;
    const rate = Number(v?.rate);
    const at = Number(v?.at);
    return rate > 0 && Number.isFinite(rate) && at > 0 ? { rate, at } : null;
  } catch {
    return null;
  }
};

const usdLegFromLastKnown = async (code: string): Promise<RatePoint | null> => {
  if (USD_PEGGED.has(code)) return { rate: 1, at: Date.now() };
  const mem = lastKnownUsd.get(code);
  const red = await readRedisPoint(lkUsdKey(code));
  if (mem && red) return mem.at >= red.at ? mem : red;
  return mem || red;
};

/**
 * Most recent known rate for from→to no older than `maxAgeMs`, from (a) the
 * direct pair, (b) the inverse pair, or (c) USD legs — memory first, then Redis
 * (so a freshly booted instance can reuse a rate another instance fetched).
 */
export const recallLastKnownRate = async (
  from: string,
  to: string,
  maxAgeMs: number,
): Promise<RatePoint | null> => {
  const now = Date.now();
  const fresh = (p: RatePoint | null | undefined): RatePoint | null =>
    p && p.rate > 0 && now - p.at <= maxAgeMs ? p : null;
  const candidates: RatePoint[] = [];
  const memPair = fresh(lastKnownPair.get(`${from}:${to}`));
  if (memPair) candidates.push(memPair);
  const redPair = fresh(await readRedisPoint(lkPairKey(from, to)));
  if (redPair) candidates.push(redPair);
  const redInv = fresh(await readRedisPoint(lkPairKey(to, from)));
  if (redInv) candidates.push({ rate: 1 / redInv.rate, at: redInv.at });
  const a = await usdLegFromLastKnown(from);
  const b = await usdLegFromLastKnown(to);
  const derived = a && b && b.rate > 0 ? fresh({ rate: a.rate / b.rate, at: Math.min(a.at, b.at) }) : null;
  if (derived) candidates.push(derived);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.at > best.at ? c : best));
};

/** USD value of 1 unit of `code` from the FRESH background cache (null when missing/expired). */
const freshUsdLeg = (code: string): RatePoint | null => {
  const now = Date.now();
  if (USD_PEGGED.has(code)) return { rate: 1, at: now };
  if (CRYPTO_CURRENCIES.includes(code)) {
    const p = usdPriceCache.get(code);
    return p && now - p.at <= CRYPTO_FRESH_MS ? p : null;
  }
  const f = usdToFiatCache.get(code);
  return f && f.rate > 0 && now - f.at <= FIAT_FRESH_MS ? { rate: 1 / f.rate, at: f.at } : null;
};

const setUsdPrice = (asset: string, price: number) => {
  const at = Date.now();
  usdPriceCache.set(asset, { rate: price, at });
  rememberUsdPerUnit(asset, price, at);
};

const setUsdToFiat = (fiat: string, perUsd: number) => {
  const at = Date.now();
  usdToFiatCache.set(fiat, { rate: perUsd, at });
  rememberUsdPerUnit(fiat, 1 / perUsd, at);
};

/**
 * Background rate refresh — cron every 2 min (server.ts) + once on startup.
 *   • crypto → USD for every supported volatile asset: Tatum (paid, reliable),
 *     CoinGecko supplements whatever Tatum missed (1 batched call)
 *   • USD → fiat for every display currency every 10 min: FastForex (if keyed),
 *     else Tatum USDT→fiat (USDT ≈ USD proxy), CoinGecko tether as last resort
 * Every successful value also lands in the Redis last-known store.
 */
export const refreshBackgroundRateCache = async (opts: { forceFiat?: boolean } = {}): Promise<void> => {
  const startTime = Date.now();
  let provider = 'Tatum';
  let ratesUpdated = 0;

  try {
    // ── 1. crypto → USD (Tatum, batches of 4 with a short pause) ──
    const BATCH_SIZE = 4;
    for (let i = 0; i < CACHE_CRYPTO_TARGETS.length; i += BATCH_SIZE) {
      const batch = CACHE_CRYPTO_TARGETS.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (asset) => {
          const price = await getTatumRate(asset, 'USD');
          if (price && price > 0) {
            setUsdPrice(asset, price);
            ratesUpdated += 1;
          }
        }),
      );
      if (i + BATCH_SIZE < CACHE_CRYPTO_TARGETS.length) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    const missingCrypto = CACHE_CRYPTO_TARGETS.filter((a) => !freshUsdLeg(a));
    if (missingCrypto.length > 0) {
      provider = 'Tatum+CoinGecko';
      try {
        const ids = missingCrypto.map((c) => COINGECKO_IDS[c]).filter(Boolean).join(',');
        const { data } = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
          params: { ids, vs_currencies: 'usd' },
          timeout: 8000,
        });
        for (const asset of missingCrypto) {
          const price = Number(data?.[COINGECKO_IDS[asset]]?.usd);
          if (price > 0) {
            setUsdPrice(asset, price);
            ratesUpdated += 1;
          }
        }
      } catch {
        apiLogger.warn(`[BackgroundCache] CoinGecko supplement failed for ${missingCrypto.join(',')}`);
      }
    }

    // ── 2. USD → fiat (every 10 min, or sooner when a currency is missing) ──
    const fiatDue =
      opts.forceFiat ||
      Date.now() - lastFiatRefreshAt >= FIAT_REFRESH_MS ||
      CACHE_FIAT_TARGETS.some((f) => !freshUsdLeg(f));
    if (fiatDue) {
      lastFiatRefreshAt = Date.now();
      let gotFromFastForex = false;
      const ffKey = FASTFOREX_API_KEY || envRaw("FAST_FOREX_KEY");
      if (ffKey && Date.now() >= fastForexDisabledUntil) {
        try {
          const { data } = await axios.get(`https://api.fastforex.io/fetch-multi`, {
            params: { api_key: ffKey, from: 'USD', to: CACHE_FIAT_TARGETS.join(',') },
            timeout: 5000,
          });
          for (const fiat of CACHE_FIAT_TARGETS) {
            const perUsd = Number(data?.results?.[fiat]);
            if (perUsd > 0) {
              setUsdToFiat(fiat, perUsd);
              ratesUpdated += 1;
              gotFromFastForex = true;
            }
          }
        } catch {
          /* fall through to Tatum */
        }
      }
      const missingFiat = CACHE_FIAT_TARGETS.filter((f) => !freshUsdLeg(f));
      if (missingFiat.length > 0) {
        provider += gotFromFastForex ? '+FastForex+TatumFX' : '+TatumFX';
        await Promise.allSettled(
          missingFiat.map(async (fiat) => {
            const perUsd = await getTatumRate('USDT', fiat);
            if (perUsd && perUsd > 0) {
              setUsdToFiat(fiat, perUsd);
              ratesUpdated += 1;
            }
          }),
        );
      } else if (gotFromFastForex) {
        provider += '+FastForex';
      }
      const stillMissing = CACHE_FIAT_TARGETS.filter((f) => !freshUsdLeg(f));
      if (stillMissing.length > 0) {
        try {
          const { data } = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: { ids: 'tether', vs_currencies: stillMissing.map((f) => f.toLowerCase()).join(',') },
            timeout: 8000,
          });
          for (const fiat of stillMissing) {
            const perUsd = Number(data?.tether?.[fiat.toLowerCase()]);
            if (perUsd > 0) {
              setUsdToFiat(fiat, perUsd);
              ratesUpdated += 1;
            }
          }
        } catch {
          apiLogger.warn(`[BackgroundCache] fiat fallback failed for ${stillMissing.join(',')}`);
        }
      }
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    apiLogger.error(`[BackgroundCache] Rate refresh failed: ${err.message}`);
  }

  const elapsed = Date.now() - startTime;
  if (ratesUpdated > 0) lastBackgroundRefresh = { at: Date.now(), provider, rates: ratesUpdated };
  apiLogger.info(`[BackgroundCache] ✅ Refreshed ${ratesUpdated} USD legs via ${provider} in ${elapsed}ms`);
};

/**
 * Fresh background-cache rate for from→to, derived from USD legs.
 * Returns null when either leg is missing or past its freshness window.
 */
const getBackgroundCachedRate = (from: string, to: string): RatePoint | null => {
  const a = freshUsdLeg(from);
  const b = freshUsdLeg(to);
  if (!a || !b || !(b.rate > 0)) return null;
  const point = { rate: a.rate / b.rate, at: Math.min(a.at, b.at) };
  apiLogger.info(
    `[currencyConvert] Using background-cached rate for ${from}→${to}: ${point.rate} (age: ${Math.floor((Date.now() - point.at) / 1000)}s)`,
  );
  return point;
};

// List of crypto currencies
const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'BCH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'SOL', 'MATIC', 'RLUSD'];

// CoinGecko ID mapping
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  TRX: 'tron',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  BCH: 'bitcoin-cash',
  BNB: 'binancecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
  MATIC: 'matic-network',
  POLYGON: 'matic-network',
  RLUSD: 'ripple-usd',
};

// Per-request cache: 30s (below). Fresh background cache: component legs above.
// Last-known (stale, age-capped) store: memory + Redis above — used only when every live source fails.

/**
 * Tatum rate IDs — maps our currency codes to Tatum's /v3/tatum/rate/{id}
 */
const TATUM_RATE_IDS: Record<string, string> = {
  BTC: 'BTC', ETH: 'ETH', TRX: 'TRX', LTC: 'LTC', DOGE: 'DOGE',
  BCH: 'BCH', BNB: 'BNB', USDT: 'USDT', USDC: 'USDC', XRP: 'XRP',
  ADA: 'ADA', SOL: 'SOL', MATIC: 'MATIC', POLYGON: 'MATIC', RLUSD: 'USDT',
};

// Negative cache for Tatum rate API failures — avoid hammering failing pairs
// Key: "tatum_fail:{crypto}:{fiat}", Value: { timestamp, is403 }
const tatumFailureCache = new Map<string, { timestamp: number; is403: boolean }>();
const TATUM_FAILURE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for transient errors
const TATUM_403_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for 403 (pair permanently unsupported)

/**
 * Get crypto rate from Tatum in any fiat (already paid for, reliable, no extra cost)
 * Tatum supports basePair for any fiat: USD, EUR, GBP, CAD, AUD, JPY, CHF, etc.
 */
const getTatumRate = async (crypto: string, fiat: string = 'USD'): Promise<number | null> => {
  const id = TATUM_RATE_IDS[crypto.toUpperCase()];
  if (!id) return null;

  // Check negative cache — skip pairs that recently failed (avoids log spam)
  const failKey = `tatum_fail:${crypto}:${fiat}`;
  const lastFail = tatumFailureCache.get(failKey);
  if (lastFail) {
    const ttl = lastFail.is403 ? TATUM_403_CACHE_TTL_MS : TATUM_FAILURE_CACHE_TTL_MS;
    if ((Date.now() - lastFail.timestamp) < ttl) {
      return null; // Silently skip — already logged on first failure
    }
    // Cache expired — remove and retry
    tatumFailureCache.delete(failKey);
  }

  const apiKey = getTatumApiKey();
  if (!apiKey) {
    apiLogger.warn(`[currencyConvert] Tatum: no API key configured`);
    return null;
  }

  // Retry once on transient errors before caching the failure
  const MAX_RATE_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RATE_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(
        `${TATUM_V3_URL}/tatum/rate/${id}`,
        {
          params: { basePair: fiat.toUpperCase() },
          headers: { 'x-api-key': apiKey },
          timeout: 8000,
        }
      );
      const rate = parseFloat(data?.value);
      if (rate > 0) {
        apiLogger.info(`[currencyConvert] Tatum rate for ${crypto}→${fiat}: ${rate}`);
        return rate;
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string; code?: string };
      const is403 = err.response?.status === 403;
      const isTransient = !is403 && (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.response?.status === 429
        || (err.message || '').includes('timeout'));
      
      // Retry on transient errors only
      if (isTransient && attempt < MAX_RATE_RETRIES) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      // Cache the failure to avoid hammering and log spam
      tatumFailureCache.set(failKey, { timestamp: Date.now(), is403 });
      // Log once per failure window (not every cron tick)
      if (!lastFail) {
        const suffix = is403
          ? `(Tatum 403 — pair permanently unsupported; cached for 24h. Cross-rate recovery will fill the gap)`
          : `(transient error; cached for 2 min)`;
        apiLogger.warn(`[currencyConvert] Tatum rate API failed for ${crypto}→${fiat}: ${err.message} ${suffix}`);
      }
    }
  }
  return null;
};

/**
 * USD price snapshot for a set of crypto assets — a resilient price source
 * used by the public tickers endpoint (and anything that needs "1 ASSET = $X").
 *
 * Resolution order per asset:
 *   1. Stablecoins → $1
 *   2. Fresh Tatum-backed background cache (USD leg, ≤3 min)
 *   3. Live Tatum rate (getTatumRate)
 * Assets that can't be priced are omitted (callers hide the estimate).
 *
 * This keeps fiat estimates working even when the Binance WebSocket ticker
 * feed is empty (e.g. geo-blocked server regions), because Tatum is our
 * reliable paid provider.
 */
export const getUsdPriceSnapshot = async (
  assets: string[],
): Promise<Record<string, number>> => {
  const STABLES = new Set(["USDT", "USDC", "USD", "DAI", "BUSD", "TUSD", "RLUSD"]);
  const out: Record<string, number> = {};
  await Promise.allSettled(
    (assets || []).map(async (raw) => {
      const asset = String(raw || "").toUpperCase().trim();
      if (!asset) return;
      if (STABLES.has(asset)) {
        out[asset] = 1;
        return;
      }
      // POL / POLYGON share the MATIC rate id.
      const sym = asset === "POL" || asset === "POLYGON" ? "MATIC" : asset;
      // 1) fresh Tatum-backed background cache (refreshed every 2 min)
      const cached = freshUsdLeg(sym);
      if (cached && cached.rate > 0) {
        out[asset] = cached.rate;
        return;
      }
      // 2) live Tatum
      try {
        const rate = await getTatumRate(sym, "USD");
        if (rate && rate > 0) {
          out[asset] = rate;
          if (CRYPTO_CURRENCIES.includes(sym)) setUsdPrice(sym, rate);
        }
      } catch {
        /* skip — asset stays unpriced */
      }
    }),
  );
  return out;
};

/**
 * Get rate using Tatum for crypto conversions
 * Handles crypto-to-fiat, fiat-to-crypto, crypto-to-crypto, AND fiat-to-fiat (via USDT proxy)
 * Uses Tatum's basePair to get direct fiat rates (EUR, GBP, etc.) — no USD intermediary needed
 */
const getCryptoRateViaTatum = async (from: string, to: string): Promise<number | null> => {
  const fromIsCrypto = CRYPTO_CURRENCIES.includes(from.toUpperCase());
  const toIsCrypto = CRYPTO_CURRENCIES.includes(to.toUpperCase());
  const isStable = (c: string) => ['USDT', 'USDC'].includes(c.toUpperCase());

  if (fromIsCrypto && !toIsCrypto) {
    // Crypto → fiat (e.g., BTC → EUR) — Tatum returns crypto price in target fiat directly
    // Stablecoin → fiat is only 1:1 for USD. USDT→EUR is ~0.89, USDT→NGN ~1330 —
    // the old `return 1` priced every non-USD stablecoin conversion at par (audit 2026-06).
    if (isStable(from)) {
      if (to.toUpperCase() === 'USD') return 1;
      return await getTatumRate('USDT', to);
    }
    const priceInFiat = await getTatumRate(from, to);
    if (priceInFiat) return priceInFiat;  // This is "1 BTC = X EUR"
    
    // Cross-rate fallback: crypto→USD × USD→fiat (handles TRX→BRL/GBP 403s)
    if (to.toUpperCase() !== 'USD') {
      const priceInUSD = await getTatumRate(from, 'USD');
      if (priceInUSD) {
        const usdtInFiat = await getTatumRate('USDT', to);
        if (usdtInFiat) {
          const crossRate = priceInUSD * usdtInFiat;
          apiLogger.info(`[currencyConvert] 🔗 Cross-rate: ${from}→${to} = ${toFixedStr(crossRate, 6)} (via ${from}→USD × USDT→${to})`);
          return crossRate;
        }
      }
    }
  } else if (!fromIsCrypto && toIsCrypto) {
    // Fiat → crypto (e.g., EUR → BTC) — invert: 1/price
    // Fiat → stablecoin: 1 EUR = 1/(USDT→EUR) USDT (≈1.12), NOT 1 (see above).
    if (isStable(to)) {
      if (from.toUpperCase() === 'USD') return 1;
      const usdtInFrom = await getTatumRate('USDT', from);
      return usdtInFrom && usdtInFrom > 0 ? 1 / usdtInFrom : null;
    }
    const priceInFiat = await getTatumRate(to, from);
    if (priceInFiat) return 1 / priceInFiat;  // "1 EUR = 1/X BTC"
    
    // Cross-rate fallback: fiat→USD → USD→crypto
    if (from.toUpperCase() !== 'USD') {
      const priceInUSD = await getTatumRate(to, 'USD');
      if (priceInUSD) {
        const usdtInFrom = await getTatumRate('USDT', from);
        if (usdtInFrom) {
          const crossRate = 1 / (priceInUSD * usdtInFrom);
          apiLogger.info(`[currencyConvert] 🔗 Cross-rate: ${from}→${to} = ${toFixedStr(crossRate, 8)} (via USDT→${from} / ${to}→USD)`);
          return crossRate;
        }
      }
    }
  } else if (fromIsCrypto && toIsCrypto) {
    // Crypto → crypto (e.g., ETH → BTC) — convert via USD
    const fromUSD = isStable(from) ? 1 : await getTatumRate(from, 'USD');
    const toUSD = isStable(to) ? 1 : await getTatumRate(to, 'USD');
    if (fromUSD && toUSD) return fromUSD / toUSD;
  } else {
    // Fiat → fiat (e.g., GBP → USD, EUR → CAD) — use USDT as USD proxy
    // USDT ≈ $1 USD, so USDT→GBP rate ≈ USD→GBP rate
    const fromRate = from.toUpperCase() === 'USD' ? 1 : await getTatumRate('USDT', from);
    const toRate = to.toUpperCase() === 'USD' ? 1 : await getTatumRate('USDT', to);
    if (fromRate && toRate) {
      // fromRate = "1 USDT in FROM currency", toRate = "1 USDT in TO currency"
      const rate = toRate / fromRate;
      apiLogger.info(`[currencyConvert] Tatum fiat rate ${from}→${to}: ${rate} (via USDT proxy)`);
      return rate;
    }
  }
  return null;
};

/**
 * Get rate from FastForex API (primary provider — 150-300ms)
 * Uses fetch-one endpoint for optimal speed
 */
// Circuit breaker: when FastForex rejects us (lapsed subscription, bad key,
// quota), skip it for a while instead of paying a failed ~300ms round-trip on
// every fiat conversion. Transient network errors do NOT trip it.
const FASTFOREX_BREAKER_MS = 30 * 60 * 1000;
let fastForexDisabledUntil = 0;

const getFastForexRate = async (from: string, to: string, amount: number): Promise<{ rate: number; converted: number } | null> => {
  const apiKey = FASTFOREX_API_KEY || envRaw("FAST_FOREX_KEY");
  if (!apiKey) return null;
  if (Date.now() < fastForexDisabledUntil) return null;
  
  try {
    const { data } = await axios.get(`https://api.fastforex.io/fetch-one`, {
      params: {
        api_key: apiKey,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
      },
      timeout: 5000,
    });

    if (data.result) {
      const rate = data.result[to.toUpperCase()];
      if (rate && rate > 0) {
        apiLogger.info(`[currencyConvert] FastForex rate for ${from}→${to}: ${rate} (${data.ms}ms server)`);
        return {
          rate: rate,
          converted: mul(amount, rate).toNumber(),
        };
      }
    }
  } catch (error: unknown) {
    const err = error as { response?: { data?: { error?: string }; status?: number }; message?: string };
    const errorMsg = err.response?.data?.error || err.message || "";
    const status = err.response?.status;
    if (status === 401 || status === 402 || status === 403 || status === 429 || /subscription|api_key|unauthori/i.test(errorMsg)) {
      fastForexDisabledUntil = Date.now() + FASTFOREX_BREAKER_MS;
      apiLogger.warn(`[currencyConvert] FastForex disabled for ${FASTFOREX_BREAKER_MS / 60000}min (${status ?? "n/a"}: ${errorMsg}) — using Tatum/CoinGecko fallbacks`);
    } else {
      apiLogger.warn(`[currencyConvert] FastForex API failed for ${from}→${to}: ${errorMsg}`);
    }
  }
  return null;
};

/**
 * Get crypto rate from CoinGecko API (free, no API key required)
 * Used as fallback when FastForex fails or is restricted
 */
const getCoinGeckoRate = async (crypto: string, fiat: string): Promise<number | null> => {
  try {
    const coinId = COINGECKO_IDS[crypto.toUpperCase()];
    if (!coinId) {
      apiLogger.warn(`[currencyConvert] CoinGecko: Unknown crypto ${crypto}`);
      return null;
    }

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: coinId,
          vs_currencies: fiat.toLowerCase(),
        },
        timeout: 5000,
      }
    );

    const rate = response.data[coinId]?.[fiat.toLowerCase()];
    if (rate) {
      apiLogger.info(`[currencyConvert] CoinGecko rate for ${crypto}→${fiat}: ${rate}`);
      return rate;
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    apiLogger.warn(`[currencyConvert] CoinGecko API failed for ${crypto}→${fiat}: ${err.message}`);
  }
  return null;
};

/**
 * Get rate using CoinGecko for crypto conversions
 * Handles crypto-to-fiat, fiat-to-crypto, and crypto-to-crypto
 */
const getCryptoRateViaCoinGecko = async (from: string, to: string): Promise<number | null> => {
  const fromIsCrypto = CRYPTO_CURRENCIES.includes(from.toUpperCase());
  const toIsCrypto = CRYPTO_CURRENCIES.includes(to.toUpperCase());

  if (fromIsCrypto && !toIsCrypto) {
    // Crypto to fiat (e.g., ETH → USD)
    return await getCoinGeckoRate(from, to);
  } else if (!fromIsCrypto && toIsCrypto) {
    // Fiat to crypto (e.g., USD → ETH)
    const inverseRate = await getCoinGeckoRate(to, from);
    if (inverseRate) {
      return 1 / inverseRate;
    }
  } else if (fromIsCrypto && toIsCrypto) {
    // Crypto to crypto (e.g., ETH → BTC) - convert via USD
    const fromToUSD = await getCoinGeckoRate(from, 'USD');
    const toToUSD = await getCoinGeckoRate(to, 'USD');
    if (fromToUSD && toToUSD) {
      return fromToUSD / toToUSD;
    }
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════
// PERF FIX 4: Short-lived per-request rate cache (30s TTL)
// Eliminates redundant external API calls when multiple payments for the
// same currency pair arrive within 30 seconds (~200ms savings per request)
// ═══════════════════════════════════════════════════════════════════════
const requestRateCache = new Map<string, { rate: number; timestamp: number }>();
const REQUEST_RATE_CACHE_TTL_MS = 30 * 1000; // 30 seconds

const getCachedRequestRate = (from: string, to: string): RatePoint | null => {
  const key = `req_rate:${from}:${to}`;
  const cached = requestRateCache.get(key);
  if (cached && (Date.now() - cached.timestamp) < REQUEST_RATE_CACHE_TTL_MS) {
    apiLogger.info(`[currencyConvert] ⚡ Request cache HIT for ${from}→${to}: ${cached.rate} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
    return { rate: cached.rate, at: cached.timestamp };
  }
  return null;
};

const setCachedRequestRate = (from: string, to: string, rate: number, at: number = Date.now()): void => {
  const key = `req_rate:${from}:${to}`;
  requestRateCache.set(key, { rate, timestamp: at });
  // Inverse rate cache too (saves lookup in both directions)
  if (rate > 0) {
    const inverseKey = `req_rate:${to}:${from}`;
    requestRateCache.set(inverseKey, { rate: 1 / rate, timestamp: at });
  }
  // Cleanup old entries periodically (every 100 sets)
  if (requestRateCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of requestRateCache) {
      if (now - v.timestamp > REQUEST_RATE_CACHE_TTL_MS) requestRateCache.delete(k);
    }
  }
};

/**
 * Normalize currency code (handle variants like USDT-TRC20, USDT-ERC20, etc.)
 */
const normalizeCurrency = (currency: string): string => {
  if (!currency) return 'USD';
  const upper = currency.toUpperCase();
  if (upper.includes("USDT")) return "USDT";
  if (upper.includes("USDC")) return "USDC";
  if (upper.includes("TRON") || upper === "TRX") return "TRX";
  if (upper.includes("BSC") || upper === "BNB") return "BNB";
  if (upper === "RLUSD" || upper === "RLUSD-ERC20" || upper === "RLUSD-XRPL") return "RLUSD";
  if (upper === "POLYGON" || upper === "MATIC") return "MATIC";
  return upper;
};

/**
 * Native decimals used for converted CRYPTO amounts (F3). Capped at 8 to match
 * the ledger (toFixedStr(…, 8) everywhere); 6-decimal tokens/chains use 6.
 */
const ASSET_DECIMALS: Record<string, number> = {
  BTC: 8, LTC: 8, DOGE: 8, BCH: 8, ETH: 8, BNB: 8, MATIC: 8, SOL: 8, ADA: 6,
  TRX: 6, XRP: 6, USDT: 6, USDC: 6, RLUSD: 6,
};

/** True when `code` (already normalised) is a crypto asset rather than fiat. */
export const isCryptoAsset = (code: string): boolean => CRYPTO_CURRENCIES.includes(normalizeCurrency(code));

/**
 * Decimal places for a converted amount — driven by the TARGET asset, never by
 * the magnitude (1.23456789 BTC used to be cut to 1.23).
 *   crypto target → native decimals (8 / 6)
 *   fiat target   → 2 dp; legacy non-fixed calls keep 8 dp for sub-unit values
 */
export const amountDecimalsFor = (target: string, value: number, fixedDecimal: boolean): number => {
  const code = normalizeCurrency(target);
  if (CRYPTO_CURRENCIES.includes(code)) return ASSET_DECIMALS[code] ?? 8;
  if (fixedDecimal) return 2;
  return Math.abs(value) >= 1 ? 2 : 8;
};

/** Rates are kept at full useful precision (never 2 dp): 8 dp ≥ 1, 12 dp below. */
const normalizeRate = (rate: number): number => Number(toFixedStr(rate, rate >= 1 ? 8 : 12));

/**
 * Process a single currency conversion.
 * Live sources first, then an age-capped last-known rate. When nothing usable
 * exists: strict → RateUnavailableError, display → { unavailable: true }.
 */
const processSingleCurrency = async (
  source: string,
  defaultCurrency: string,
  amount: number,
  fixedDecimal: boolean,
  opts: ConvertOptions = {},
): Promise<CurrencyRateList> => {
  const currentCurrency = normalizeCurrency(defaultCurrency);
  const outCode = defaultCurrency.toUpperCase();

  // Same currency - no conversion needed
  if (source === currentCurrency) {
    return { currency: outCode, amount, transferRate: 1, rateAsOf: Date.now() };
  }

  // Stablecoin shortcut: USD ↔ USDT/USDC is exactly 1:1
  // Avoids exchange rate APIs returning 1.001 or 0.999 for pegged stablecoins
  const isSourceUSD = source === 'USD';
  const isTargetStable = ['USDT', 'USDC', 'RLUSD'].includes(currentCurrency);
  const isSourceStable = ['USDT', 'USDC', 'RLUSD'].includes(source);
  const isTargetUSD = currentCurrency === 'USD';

  if ((isSourceUSD && isTargetStable) || (isSourceStable && isTargetUSD)) {
    apiLogger.info(`[currencyConvert] 💵 Stablecoin 1:1: ${source}→${currentCurrency} = ${amount} (exact peg)`);
    return { currency: outCode, amount, transferRate: 1, rateAsOf: Date.now() };
  }

  let rate: number | null = null;
  let rateAsOf = Date.now();
  let stale = false;
  let convertedAmount: number | null = null;

  const isCryptoConversion = CRYPTO_CURRENCIES.includes(source) || CRYPTO_CURRENCIES.includes(currentCurrency);

  // 1. Short-lived request rate cache (30s TTL, saves ~200ms)
  const cached = getCachedRequestRate(source, currentCurrency);
  if (cached) {
    rate = cached.rate;
    rateAsOf = cached.at;
  }

  // 2. FastForex — only for fiat↔fiat conversions (150-300ms, only when keyed)
  if (!rate && !isCryptoConversion) {
    const fastForexResult = await getFastForexRate(source, currentCurrency, amount);
    if (fastForexResult) {
      rate = fastForexResult.rate;
      convertedAmount = fastForexResult.converted;
      rateAsOf = Date.now();
    }
  }

  // 3. Fresh background cache (USD legs, cron every 2 min — instant, 0 API calls)
  if (!rate) {
    const bg = getBackgroundCachedRate(source, currentCurrency);
    if (bg) {
      rate = bg.rate;
      rateAsOf = bg.at;
    }
  }

  // 4. Tatum live
  if (!rate) {
    rate = await getCryptoRateViaTatum(source, currentCurrency);
    if (rate) rateAsOf = Date.now();
  }

  // 5. CoinGecko live (crypto only)
  if (!rate && isCryptoConversion) {
    rate = await getCryptoRateViaCoinGecko(source, currentCurrency);
    if (rate) rateAsOf = Date.now();
  }

  // 6. Last-known rate, age-capped (money ≤30 min, display ≤24h)
  const maxAgeMs = opts.strict ? MONEY_RATE_MAX_AGE_MS : (opts.maxStaleMs ?? DISPLAY_RATE_MAX_AGE_MS);
  if (!rate) {
    const lk = await recallLastKnownRate(source, currentCurrency, maxAgeMs);
    if (lk) {
      rate = lk.rate;
      rateAsOf = lk.at;
      stale = true;
      apiLogger.warn(
        `[currencyConvert] ⚠️ Live providers failed for ${source}→${currentCurrency}; using LAST-KNOWN rate ${lk.rate} from ${new Date(lk.at).toISOString()} (${Math.round((Date.now() - lk.at) / 60000)} min old, cap ${Math.round(maxAgeMs / 60000)} min)`,
      );
    }
  }

  if (!rate) {
    apiLogger.error(
      `[currencyConvert] ❌ No usable rate for ${source}→${currentCurrency} — all live providers failed and no last-known rate within ${Math.round(maxAgeMs / 60000)} min (${opts.strict ? 'strict: refusing' : 'display: unavailable'})`,
    );
    if (opts.strict) throw new RateUnavailableError(source, currentCurrency, maxAgeMs);
    // Display mode: explicit "unavailable" — callers must NOT treat 0 as a real
    // value and must not label USD numbers with another currency's symbol.
    return { currency: outCode, amount: 0, transferRate: 0, unavailable: true };
  }

  if (!stale) {
    // Cache for 30s and remember as the last-known rate (memory + Redis).
    setCachedRequestRate(source, currentCurrency, rate, rateAsOf);
    if (!cached) rememberPairRate(source, currentCurrency, rate, rateAsOf);
  }

  // Calculate converted amount if not already set by FastForex
  if (convertedAmount === null) {
    convertedAmount = mul(amount, rate).toNumber();
  }

  const dp = amountDecimalsFor(currentCurrency, convertedAmount, fixedDecimal);
  return {
    currency: outCode,
    amount: Number(toFixedStr(convertedAmount, dp)),
    transferRate: normalizeRate(rate),
    rateAsOf,
    ...(stale ? { stale: true } : {}),
  };
};

/**
 * Main currency conversion function
 * Supports crypto-to-crypto, crypto-to-fiat, and fiat-to-fiat conversions.
 * Pass `strict: true` on MONEY paths (checkout quotes, fee tiers, settlement):
 * it throws RateUnavailableError instead of ever returning a 0 / made-up rate.
 *
 * OPTIMIZED: Uses Promise.all for parallel API calls instead of sequential
 */
const currencyConvert = async ({
  currency,
  sourceCurrency,
  amount,
  fixedDecimal,
  strict,
  maxStaleMs,
}: {
  currency: string[];
  sourceCurrency: string;
  amount: number;
  fixedDecimal: boolean;
} & ConvertOptions): Promise<CurrencyRateList[]> => {
  // Validate amount parameter
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    apiLogger.error(`[currencyConvert] Invalid amount: ${amount}`);
    throw new Error(`Invalid amount parameter: ${amount}`);
  }

  const source = normalizeCurrency(sourceCurrency);
  
  apiLogger.info(`[currencyConvert] Processing ${currency.length} currencies in parallel...`);
  const startTime = Date.now();

  // Process all currencies in parallel using Promise.all
  const currencyRateList = await Promise.all(
    currency.map((curr) => processSingleCurrency(source, curr, amount, fixedDecimal, { strict, maxStaleMs }))
  );

  const elapsed = Date.now() - startTime;
  apiLogger.info(`[currencyConvert] Completed ${currency.length} currencies in ${elapsed}ms`);
  apiLogger.info(`[currencyConvert] Results:`, currencyRateList);
  
  return currencyRateList;
};

/** Test-only: reset every in-memory cache (background, request, last-known). */
export const __resetFxCachesForTests = (): void => {
  usdPriceCache.clear();
  usdToFiatCache.clear();
  lastKnownPair.clear();
  lastKnownUsd.clear();
  requestRateCache.clear();
  tatumFailureCache.clear();
  lastFiatRefreshAt = 0;
  lastBackgroundRefresh = null;
};

export default currencyConvert;
