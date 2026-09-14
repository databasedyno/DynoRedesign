/**
 * Blockchain Fee Rate Service
 *
 * Fetches real-time blockchain fee rates from public APIs.
 * Caches results in Redis (60s TTL) to avoid hammering external APIs.
 * Returns fee rate for a given chain and tier.
 */

import axios from "axios";
import { cronLogger } from "../utils/loggers";
import { redis as redisClient } from "../utils/redisInstance";
import { fromBaseUnits, mul } from "../utils/money";

const LOG_PREFIX = "[FeeRateService]";
const log = (msg: string) => cronLogger.info(`${LOG_PREFIX} ${msg}`);

const REDIS_KEY_PREFIX = "dynopay:v1:cache:fee";
const CACHE_TTL = 60; // 60 seconds

// Fee tier targets (blocks)
type FeeTier = "slow" | "medium" | "fast" | "fastest";

interface FeeRates {
  slow: number;
  medium: number;
  fast: number;
  fastest: number;
  unit: string;
  chain: string;
  fetchedAt: string;
}

// In-memory fallback cache
const memoryCache: Record<string, FeeRates> = {};

/**
 * Store fee rates in Redis with TTL
 */
const cacheRates = async (chain: string, rates: FeeRates) => {
  memoryCache[chain] = rates;
  try {
    const key = `${REDIS_KEY_PREFIX}:${chain}`;
    if (redisClient && redisClient.isReady) {
      await redisClient.set(key, JSON.stringify(rates), { EX: CACHE_TTL });
    }
  } catch {
    // Redis unavailable, memory cache is fine
  }
};

/**
 * Get cached fee rates
 */
const getCachedRates = async (chain: string): Promise<FeeRates | null> => {
  try {
    const key = `${REDIS_KEY_PREFIX}:${chain}`;
    if (redisClient && redisClient.isReady) {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    }
  } catch {
    // Fall through
  }
  return memoryCache[chain] || null;
};

/**
 * Fetch BTC fee rates from Blockstream API
 * Returns sat/vB for different confirmation targets
 */
const fetchBTCFees = async (): Promise<FeeRates> => {
  try {
    const response = await axios.get("https://blockstream.info/api/fee-estimates", { timeout: 10000 });
    const data = response.data;
    // Keys are confirmation target blocks: 1, 2, 3, 6, 25, etc.
    return {
      slow: data["6"] || data["25"] || 2,
      medium: data["3"] || data["6"] || 5,
      fast: data["1"] || data["2"] || 20,
      fastest: Math.ceil((data["1"] || 20) * 1.5),
      unit: "sat/vB",
      chain: "BTC",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    log(`BTC fee fetch failed: ${err.message}, using defaults`);
    return { slow: 2, medium: 10, fast: 30, fastest: 50, unit: "sat/vB", chain: "BTC", fetchedAt: new Date().toISOString() };
  }
};

/**
 * Fetch ETH gas prices from Blocknative API
 * Returns Gwei for different speed tiers
 */
const fetchETHFees = async (): Promise<FeeRates> => {
  try {
    const response = await axios.get("https://api.blocknative.com/gasprices/blockprices", { timeout: 10000 });
    const block = response.data?.blockPrices?.[0];
    const prices = block?.estimatedPrices || [];

    // Blocknative returns confidence levels: 99, 95, 90, 80, 70
    const p99 = prices.find((p: any) => p.confidence === 99)?.maxFeePerGas || 30;
    const p90 = prices.find((p: any) => p.confidence === 90)?.maxFeePerGas || 20;
    const p70 = prices.find((p: any) => p.confidence === 70)?.maxFeePerGas || 10;

    return {
      slow: Math.ceil(p70),
      medium: Math.ceil(p90),
      fast: Math.ceil(p99),
      fastest: Math.ceil(p99 * 1.5),
      unit: "Gwei",
      chain: "ETH",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    log(`ETH fee fetch failed: ${err.message}, using defaults`);
    return { slow: 5, medium: 15, fast: 30, fastest: 50, unit: "Gwei", chain: "ETH", fetchedAt: new Date().toISOString() };
  }
};

/**
 * Fetch LTC fee rates
 * LTC has similar fee structure to BTC but much lower
 */
const fetchLTCFees = async (): Promise<FeeRates> => {
  // LTC fees are typically very low and stable
  return {
    slow: 1,
    medium: 10,
    fast: 50,
    fastest: 100,
    unit: "litoshi/byte",
    chain: "LTC",
    fetchedAt: new Date().toISOString(),
  };
};

/**
 * For near-instant chains (TRX, SOL, XRP), fees are negligible/fixed
 */
const getFixedFees = (chain: string): FeeRates => {
  const feeMap: Record<string, { fee: number; unit: string }> = {
    TRX: { fee: 0, unit: "bandwidth" },
    SOL: { fee: 5000, unit: "lamports" },
    XRP: { fee: 12, unit: "drops" },
    DOGE: { fee: 100000, unit: "koinu/kB" },
    BCH: { fee: 1, unit: "sat/byte" },
    BNB: { fee: 0, unit: "Gwei" },
    POL: { fee: 30, unit: "Gwei" },
  };

  const config = feeMap[chain] || { fee: 0, unit: "unknown" };
  return {
    slow: config.fee,
    medium: config.fee,
    fast: config.fee,
    fastest: config.fee,
    unit: config.unit,
    chain,
    fetchedAt: new Date().toISOString(),
  };
};

/**
 * Get fee rates for a specific blockchain
 */
export const getFeeRates = async (chain: string): Promise<FeeRates> => {
  const upperChain = chain.toUpperCase();

  // Check cache first
  const cached = await getCachedRates(upperChain);
  if (cached) return cached;

  let rates: FeeRates;

  switch (upperChain) {
    case "BTC":
      rates = await fetchBTCFees();
      break;
    case "ETH":
    case "ERC20":
      rates = await fetchETHFees();
      break;
    case "LTC":
      rates = await fetchLTCFees();
      break;
    default:
      rates = getFixedFees(upperChain);
      break;
  }

  await cacheRates(upperChain, rates);
  return rates;
};

/**
 * Get specific fee rate for a chain and tier
 */
export const getFeeForChain = async (chain: string, tier: FeeTier): Promise<{ rate: number; unit: string }> => {
  const rates = await getFeeRates(chain);
  return {
    rate: rates[tier],
    unit: rates.unit,
  };
};

/**
 * Get all cached fee rates (for diagnostics)
 */
export const getAllFeeRates = (): Record<string, FeeRates> => {
  return { ...memoryCache };
};

/**
 * Estimate sweep cost in USD for a given chain and tier
 */
export const estimateSweepCostUSD = async (
  chain: string,
  tier: FeeTier,
  cryptoPriceUSD: number
): Promise<number> => {
  const rates = await getFeeRates(chain.toUpperCase());
  const feeRate = rates[tier];

  switch (chain.toUpperCase()) {
    case "BTC": {
      // BTC sweep: ~141 vBytes (SegWit 1-in-1-out)
      const feeSats = 141 * feeRate;
      return mul(fromBaseUnits(feeSats), cryptoPriceUSD).toNumber();
    }
    case "ETH":
    case "ERC20": {
      // ETH transfer: 21000 gas
      const feeETH = (21000 * feeRate) / 1_000_000_000;
      return mul(feeETH, cryptoPriceUSD).toNumber();
    }
    case "LTC": {
      // LTC sweep: ~225 bytes
      const feeLitoshi = 225 * feeRate;
      return mul(fromBaseUnits(feeLitoshi), cryptoPriceUSD).toNumber();
    }
    default:
      // Near-instant chains: negligible fee
      return 0.01;
  }
};

export default {
  getFeeRates,
  getFeeForChain,
  getAllFeeRates,
  estimateSweepCostUSD,
};
