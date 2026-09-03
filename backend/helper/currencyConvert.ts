// Phase 4: resilient Tatum HTTP client (retries transient GET/read failures).
import { raw as envRaw } from "../utils/config";
import axios from "../utils/tatumHttp";
import { apiLogger } from "../utils/loggers";
import { TATUM_V3_URL, getTatumApiKey } from "../utils/tatumAuth";
import { mul, toFixedStr } from "../utils/money";

interface CurrencyRateList {
  currency: string;
  amount: number;
  transferRate: number;
}

// ============================================
// BACKGROUND RATE CACHE (CoinGecko every 60s — free, saves FastForex API calls)
// ============================================

// Background cache: populated by CoinGecko every 60s, used ONLY as fallback
const backgroundRateCache = new Map<string, { rate: number; timestamp: number }>();
const BACKGROUND_CACHE_TTL_MS = 180_000; // 180s — slightly longer than 120s refresh interval for overlap

// FastForex API key (primary real-time provider — 150-300ms)
const FASTFOREX_API_KEY = envRaw("FASTFOREX_API_KEY") || '';

// Common fiat currencies to pre-cache rates for
const CACHE_FIAT_TARGETS = ['USD', 'EUR', 'GBP', 'BRL'];
// Core crypto currencies to pre-cache
const CACHE_CRYPTO_TARGETS = ['ETH', 'BTC', 'TRX', 'LTC', 'DOGE'];

/**
 * Background rate refresh — called every 60s by cron
 * Uses Tatum (paid, reliable) as PRIMARY provider for crypto rates
 * Falls back to CoinGecko (free) only if Tatum fails
 * FastForex handles fiat↔fiat separately (not used for crypto)
 */
export const refreshBackgroundRateCache = async (): Promise<void> => {
  const startTime = Date.now();
  let provider = 'Tatum';
  let ratesUpdated = 0;
  
  try {
    // PRIMARY: Tatum — batch requests in groups of 4 (paid, reliable, no rate limits)
    const tatumPairs: Array<{ crypto: string; fiat: string }> = [];
    for (const crypto of CACHE_CRYPTO_TARGETS) {
      for (const fiat of CACHE_FIAT_TARGETS) {
        tatumPairs.push({ crypto, fiat });
      }
    }
    
    // Process in batches of 4 with 150ms delay between batches
    const BATCH_SIZE = 4;
    for (let i = 0; i < tatumPairs.length; i += BATCH_SIZE) {
      const batch = tatumPairs.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(({ crypto, fiat }) =>
        (async () => {
          try {
            const priceInFiat = await getTatumRate(crypto, fiat);
            if (priceInFiat && priceInFiat > 0) {
              backgroundRateCache.set(`rate_bg:${crypto}:${fiat}`, { rate: priceInFiat, timestamp: Date.now() });
              backgroundRateCache.set(`rate_bg:${fiat}:${crypto}`, { rate: 1 / priceInFiat, timestamp: Date.now() });
              ratesUpdated += 2;
            }
          } catch {
            // Skip silently — individual pair failure
          }
        })()
      );
      await Promise.allSettled(batchPromises);
      if (i + BATCH_SIZE < tatumPairs.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }
    
    // Cross-rate recovery: fill gaps where direct Tatum pairs failed (e.g., TRX→BRL)
    // Strategy: crypto→USD (usually works) × USD→fiat (via USDT proxy or existing cache)
    for (const crypto of CACHE_CRYPTO_TARGETS) {
      for (const fiat of CACHE_FIAT_TARGETS) {
        const cacheKey = `rate_bg:${crypto}:${fiat}`;
        if (backgroundRateCache.has(cacheKey)) continue; // Already have it
        
        // Try cross-rate: crypto→USD × USD→fiat
        const cryptoUsdKey = `rate_bg:${crypto}:USD`;
        const usdFiatKey = `rate_bg:USD:${fiat}`;
        const cryptoUsd = backgroundRateCache.get(cryptoUsdKey);
        
        if (cryptoUsd && fiat === 'USD') {
          continue; // Already have via USD key
        }
        
        // Get USD→fiat rate from existing cache or USDT proxy
        let usdToFiat = backgroundRateCache.get(usdFiatKey)?.rate;
        if (!usdToFiat) {
          // Try via any other crypto that HAS this fiat rate
          for (const otherCrypto of CACHE_CRYPTO_TARGETS) {
            const otherFiat = backgroundRateCache.get(`rate_bg:${otherCrypto}:${fiat}`)?.rate;
            const otherUsd = backgroundRateCache.get(`rate_bg:${otherCrypto}:USD`)?.rate;
            if (otherFiat && otherUsd && otherUsd > 0) {
              usdToFiat = otherFiat / otherUsd;
              break;
            }
          }
        }
        
        if (cryptoUsd && usdToFiat && usdToFiat > 0) {
          const crossRate = cryptoUsd.rate * usdToFiat;
          backgroundRateCache.set(cacheKey, { rate: crossRate, timestamp: Date.now() });
          backgroundRateCache.set(`rate_bg:${fiat}:${crypto}`, { rate: 1 / crossRate, timestamp: Date.now() });
          ratesUpdated += 2;
          apiLogger.info(`[BackgroundCache] 🔗 Cross-rate recovery: ${crypto}→${fiat} = ${toFixedStr(crossRate, 6)} (via ${crypto}→USD × USD→${fiat})`);
        }
      }
    }
    
    // If Tatum produced very few rates, supplement with CoinGecko as fallback
    if (ratesUpdated < 8) {
      apiLogger.warn(`[BackgroundCache] Tatum only returned ${ratesUpdated} rates, supplementing with CoinGecko`);
      provider = 'Tatum+CoinGecko';
      try {
        const coinIds = CACHE_CRYPTO_TARGETS
          .map(c => COINGECKO_IDS[c])
          .filter(Boolean)
          .join(',');
        const fiatTargets = CACHE_FIAT_TARGETS.map(f => f.toLowerCase()).join(',');
        
        const { data } = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price`,
          {
            params: { ids: coinIds, vs_currencies: fiatTargets },
            timeout: 8000,
          }
        );

        for (const crypto of CACHE_CRYPTO_TARGETS) {
          const coinId = COINGECKO_IDS[crypto];
          if (!coinId || !data[coinId]) continue;
          
          for (const fiat of CACHE_FIAT_TARGETS) {
            const cacheKey = `rate_bg:${crypto}:${fiat}`;
            if (backgroundRateCache.has(cacheKey)) continue; // Tatum already filled this
            
            const priceInFiat = data[coinId][fiat.toLowerCase()];
            if (priceInFiat && priceInFiat > 0) {
              backgroundRateCache.set(cacheKey, { rate: priceInFiat, timestamp: Date.now() });
              backgroundRateCache.set(`rate_bg:${fiat}:${crypto}`, { rate: 1 / priceInFiat, timestamp: Date.now() });
              ratesUpdated += 2;
            }
          }
        }
      } catch {
        apiLogger.warn(`[BackgroundCache] CoinGecko fallback also failed — using Tatum-only rates`);
      }
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    apiLogger.error(`[BackgroundCache] Rate refresh failed: ${err.message}`);
  }
  
  const elapsed = Date.now() - startTime;
  apiLogger.info(`[BackgroundCache] ✅ Refreshed ${ratesUpdated} rates via ${provider} in ${elapsed}ms`);
};

/**
 * Get rate from background cache (populated by CoinGecko every 60s)
 * Used ONLY as fallback when real-time providers fail
 */
const getBackgroundCachedRate = (from: string, to: string): number | null => {
  const cacheKey = `rate_bg:${from}:${to}`;
  const cached = backgroundRateCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < BACKGROUND_CACHE_TTL_MS) {
      apiLogger.info(`[currencyConvert] Using background-cached rate for ${from}→${to}: ${cached.rate} (age: ${Math.floor(age / 1000)}s, source: CoinGecko/Tatum)`);
      return cached.rate;
    }
  }
  return null;
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

// No per-request cache — FastForex is always called fresh for real-time payments
// Background cache (CoinGecko 60s) is the ONLY fallback cache

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
 *   2. Fresh Tatum-backed background cache (rate_bg:ASSET:USD)
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
      // 1) fresh Tatum-backed background cache (refreshed ~every 60s)
      const cached = backgroundRateCache.get(`rate_bg:${asset}:USD`);
      if (cached && cached.rate > 0 && Date.now() - cached.timestamp < BACKGROUND_CACHE_TTL_MS) {
        out[asset] = cached.rate;
        return;
      }
      // 2) live Tatum (POL shares the MATIC rate id)
      try {
        const tatumSym = asset === "POL" ? "MATIC" : asset;
        const rate = await getTatumRate(tatumSym, "USD");
        if (rate && rate > 0) {
          out[asset] = rate;
          backgroundRateCache.set(`rate_bg:${asset}:USD`, { rate, timestamp: Date.now() });
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
    if (isStable(from)) return 1;
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
    if (isStable(to)) return 1;
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

const getCachedRequestRate = (from: string, to: string): number | null => {
  const key = `req_rate:${from}:${to}`;
  const cached = requestRateCache.get(key);
  if (cached && (Date.now() - cached.timestamp) < REQUEST_RATE_CACHE_TTL_MS) {
    apiLogger.info(`[currencyConvert] ⚡ Request cache HIT for ${from}→${to}: ${cached.rate} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.rate;
  }
  return null;
};

const setCachedRequestRate = (from: string, to: string, rate: number): void => {
  const key = `req_rate:${from}:${to}`;
  requestRateCache.set(key, { rate, timestamp: Date.now() });
  // Inverse rate cache too (saves lookup in both directions)
  if (rate > 0) {
    const inverseKey = `req_rate:${to}:${from}`;
    requestRateCache.set(inverseKey, { rate: 1 / rate, timestamp: Date.now() });
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
 * Process a single currency conversion
 * Returns the rate data or throws an error
 */
const processSingleCurrency = async (
  source: string,
  defaultCurrency: string,
  amount: number,
  fixedDecimal: boolean
): Promise<CurrencyRateList> => {
  const currentCurrency = normalizeCurrency(defaultCurrency);

  // Same currency - no conversion needed
  if (source === currentCurrency) {
    return {
      currency: defaultCurrency.toUpperCase(),
      amount: amount,
      transferRate: 1,
    };
  }

  // Stablecoin shortcut: USD ↔ USDT/USDC is exactly 1:1
  // Avoids exchange rate APIs returning 1.001 or 0.999 for pegged stablecoins
  const isSourceUSD = source === 'USD';
  const isTargetStable = ['USDT', 'USDC', 'RLUSD'].includes(currentCurrency);
  const isSourceStable = ['USDT', 'USDC', 'RLUSD'].includes(source);
  const isTargetUSD = currentCurrency === 'USD';
  
  if ((isSourceUSD && isTargetStable) || (isSourceStable && isTargetUSD)) {
    apiLogger.info(`[currencyConvert] 💵 Stablecoin 1:1: ${source}→${currentCurrency} = ${amount} (exact peg)`);
    return {
      currency: defaultCurrency.toUpperCase(),
      amount: amount,
      transferRate: 1,
    };
  }

  let rate: number | null = null;
  let convertedAmount: number | null = null;

  const isCryptoConversion = CRYPTO_CURRENCIES.includes(source) || CRYPTO_CURRENCIES.includes(currentCurrency);

  // PERF FIX 4: Check short-lived request rate cache first (30s TTL, saves ~200ms)
  const cachedRate = getCachedRequestRate(source, currentCurrency);
  if (cachedRate) {
    rate = cachedRate;
  }

  // Strategy 1: FastForex — only for fiat↔fiat conversions (150-300ms)
  if (!rate && !isCryptoConversion) {
    const fastForexResult = await getFastForexRate(source, currentCurrency, amount);
    if (fastForexResult) {
      rate = fastForexResult.rate;
      convertedAmount = fastForexResult.converted;
    }
  }

  // Strategy 2: Background cache — CoinGecko rates refreshed every 60s (instant, 0 API calls)
  if (!rate) {
    rate = getBackgroundCachedRate(source, currentCurrency);
  }

  // Strategy 3: Tatum — direct fallback if FastForex + cache both failed
  if (!rate) {
    rate = await getCryptoRateViaTatum(source, currentCurrency);
  }

  // Strategy 4: CoinGecko — direct last resort
  if (!rate && isCryptoConversion) {
    rate = await getCryptoRateViaCoinGecko(source, currentCurrency);
  }

  if (!rate) {
    apiLogger.error(`[currencyConvert] ❌ No rate available for ${source}→${currentCurrency} - all providers failed (FastForex, Tatum, CoinGecko)`);
    // Graceful fallback: return amount as-is with rate=1 instead of crashing
    // This ensures the wallet page still loads even if rate providers are down
    apiLogger.warn(`[currencyConvert] ⚠️ Using fallback rate 0 for ${source}→${currentCurrency} (providers unavailable)`);
    return {
      amount: 0,
      transferRate: 0,
      currency: currentCurrency,
    };
  }

  // PERF FIX 4: Cache the resolved rate for 30s (saves API calls for subsequent requests)
  setCachedRequestRate(source, currentCurrency, rate);

  // Calculate converted amount if not already set by FastForex
  if (convertedAmount === null) {
    convertedAmount = mul(amount, rate).toNumber();
  }

  // Format the values based on magnitude
  const transferRate = fixedDecimal
    ? toFixedStr(rate, 2)
    : rate > 1
    ? toFixedStr(rate, 2)
    : toFixedStr(rate, 8);

  const formattedAmount = fixedDecimal
    ? toFixedStr(convertedAmount, 2)
    : convertedAmount > 1
    ? toFixedStr(convertedAmount, 2)
    : toFixedStr(convertedAmount, 8);

  return {
    currency: defaultCurrency.toUpperCase(),
    amount: Number(formattedAmount),
    transferRate: Number(transferRate),
  };
};

/**
 * Main currency conversion function
 * Supports crypto-to-crypto, crypto-to-fiat, and fiat-to-fiat conversions
 * Uses FastForex as primary, CoinGecko as fallback for crypto
 * 
 * OPTIMIZED: Uses Promise.all for parallel API calls instead of sequential
 */
const currencyConvert = async ({
  currency,
  sourceCurrency,
  amount,
  fixedDecimal,
}: {
  currency: string[];
  sourceCurrency: string;
  amount: number;
  fixedDecimal: boolean;
}) => {
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
    currency.map((curr) => processSingleCurrency(source, curr, amount, fixedDecimal))
  );

  const elapsed = Date.now() - startTime;
  apiLogger.info(`[currencyConvert] Completed ${currency.length} currencies in ${elapsed}ms`);
  apiLogger.info(`[currencyConvert] Results:`, currencyRateList);
  
  return currencyRateList;
};

export default currencyConvert;
