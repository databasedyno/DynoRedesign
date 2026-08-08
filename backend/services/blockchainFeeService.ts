/**
 * Blockchain Fee Service
 * 
 * Fetches real-time blockchain network fees using Tatum API
 * and calculates the actual cost to forward crypto to merchant wallets.
 */

// Phase 4: resilient Tatum HTTP client (retries transient GET/read failures).
import axios from "../utils/tatumHttp";
import { cronLogger } from "../utils/loggers";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import { getTronNetworkParams } from "./tronEnergyService";
import { getPrice as getBinancePrice } from "./binanceWebSocketService";

// Tatum API base URL
const TATUM_API_URL = "https://api.tatum.io/v3";

// Cache duration for fees (5 minutes)
const FEE_CACHE_DURATION = 5 * 60; // seconds

// Average transaction sizes (in bytes) for UTXO chains
const TX_SIZES = {
  BTC: 250,   // ~250 bytes for typical P2PKH transaction
  LTC: 250,
  DOGE: 250,
  BCH: 250,
};

// Gas limits for EVM chains
const GAS_LIMITS = {
  ETH: 21000,           // Simple ETH transfer
  USDT_ERC20: 65000,    // ERC20 token transfer
  BNB: 21000,
  MATIC: 21000,
};

// TRON energy/bandwidth costs (updated post Proposal #104, Aug 2025)
// These are fallback values — live data is fetched from tronEnergyService
const TRON_COSTS = {
  TRX: { bandwidth: 300 },           // Simple TRX transfer
  USDT_TRC20: { energy: 65000 },     // TRC20 transfer uses energy
};

interface BlockchainFeeResult {
  chain: string;
  feeInNative: number;      // Fee in native currency (BTC, ETH, TRX, etc.)
  feeInUSD: number;         // Fee converted to USD
  nativeSymbol?: string;    // Native gas token symbol (e.g., 'SOL', 'XRP')
  speed: 'fast' | 'medium' | 'slow';
  gasPrice?: number;        // For EVM chains (in gwei)
  satPerByte?: number;      // For UTXO chains
  timestamp: number | Date;
}

/**
 * Get Tatum API key
 */
const getTatumKey = (): string => {
  return process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "";
};

/**
 * Fetch real-time fee from Tatum API
 */
const fetchTatumFee = async (chain: string): Promise<unknown> => {
  const tatumKey = getTatumKey();
  
  // Map our chain names to Tatum's expected format
  const chainMap: Record<string, string> = {
    'BTC': 'BTC',
    'ETH': 'ETH',
    'LTC': 'LTC',
    'DOGE': 'DOGE',
    'USDT_ERC20': 'ETH',
    'USDC_ERC20': 'ETH',
    'RLUSD_ERC20': 'ETH',
    'USDT_TRC20': 'TRON',
    'TRX': 'TRON',
    'BCH': 'BCH',
    'SOL': 'SOL',
    'XRP': 'XRP',
    'RLUSD': 'XRP',
    'POLYGON': 'MATIC',
    'USDT_POLYGON': 'MATIC',
  };

  const tatumChain = chainMap[chain];
  
  if (!tatumChain) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  // For TRON, we need to use different endpoint
  if (tatumChain === 'TRON') {
    return fetchTronFee();
  }

  try {
    const response = await axios.get(
      `${TATUM_API_URL}/blockchain/fee/${tatumChain}`,
      {
        headers: {
          'x-api-key': tatumKey,
        },
      }
    );
    return response.data;
  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.error(`[BlockchainFeeService] Error fetching ${chain} fee:`, err.message);
    throw error;
  }
};

/**
 * Fetch TRON network parameters for fee calculation
 * Uses tronEnergyService for live data with fallback to Tatum API
 */
const fetchTronFee = async (): Promise<unknown> => {
  try {
    // Use the tronEnergyService for live network params
    const params = await getTronNetworkParams();
    return {
      chain: 'TRON',
      energyPrice: params.energyPriceSun,
      bandwidthPrice: params.bandwidthPriceSun,
      defaultBandwidthFree: 600,
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn('[BlockchainFeeService] tronEnergyService failed, trying Tatum API:', err.message);
    
    // Fallback to Tatum API
    const tatumKey = getTatumKey();
    try {
      const response = await axios.get(
        `${TATUM_API_URL}/tron/info`,
        {
          headers: { 'x-api-key': tatumKey },
        }
      );
      return {
        ...response.data,
        chain: 'TRON',
      };
    } catch (tatumError: unknown) {
      const tErr = tatumError as { message?: string };
      cronLogger.error('[BlockchainFeeService] Error fetching TRON fee:', tErr.message);
      // Post Proposal #104 fallback: 100 SUN/energy (was 420)
      return {
        chain: 'TRON',
        energyPrice: 100,
        bandwidthPrice: 1000,
        defaultBandwidthFree: 600,
      };
    }
  }
};

/**
 * Get current crypto price in USD
 */
const getCryptoPrice = async (symbol: string): Promise<number> => {
  const cacheKey = `price_${symbol}`;
  const cached = await getRedisItem(cacheKey) as { price?: string | number; timestamp?: string | number } | null;
  
  // FIX: Increased cache TTL from 5 min → 15 min to reduce CoinGecko rate-limit hits
  if (cached?.price && Number(cached?.timestamp) > Date.now() - 900000) {
    return Number(cached.price);
  }

  // Fallback prices in case of API failure
  const fallbackPrices: Record<string, number> = {
    'BTC': 95000,
    'ETH': 2300,
    'LTC': 100,
    'DOGE': 0.35,
    'TRX': 0.25,
    'USDT': 1,
    'BCH': 450,
    'USDC': 1,
  };

  // FIX: Try Binance WebSocket prices first (already running, no extra API calls)
  try {
    const binancePrice = await getBinancePrice(symbol);
    if (binancePrice > 0) {
      await setRedisItem(cacheKey, { price: binancePrice, timestamp: Date.now() });
      return binancePrice;
    }
  } catch (_binanceErr) {
    // Binance WS unavailable — fall through to CoinGecko
  }

  // FIX: Per-symbol request throttling to prevent burst CoinGecko calls
  const throttleKey = `price_throttle_${symbol}`;
  const throttled = await getRedisItem(throttleKey) as { ts?: number } | null;
  if (throttled?.ts && Date.now() - throttled.ts < 60000) {
    // Already requested this symbol in the last 60s — use cached or fallback
    if (cached?.price) {
      return Number(cached.price);
    }
    return fallbackPrices[symbol] || 0;
  }
  await setRedisItem(throttleKey, { ts: Date.now() });

  try {
    // Use CoinGecko free API for prices
    const idMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'LTC': 'litecoin',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'USDT': 'tether',
      'BCH': 'bitcoin-cash',
    };

    const coinId = idMap[symbol] || symbol.toLowerCase();
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { timeout: 5000 } // 5 second timeout
    );
    
    const price = response.data[coinId]?.usd || 0;
    if (price > 0) {
      await setRedisItem(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
    
    // If price is 0, use fallback
    cronLogger.warn(`[BlockchainFeeService] Got 0 price for ${symbol}, using fallback`);
    return fallbackPrices[symbol] || 0;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    // Only log non-429 errors as errors (429 is expected rate limiting)
    if (err.response?.status === 429) {
      cronLogger.warn(`[BlockchainFeeService] Rate limited fetching ${symbol} price, using fallback`);
    } else {
      cronLogger.error(`[BlockchainFeeService] Error fetching ${symbol} price:`, err.message || error);
    }
    
    // Use cached price if available (even if stale)
    if (cached?.price) {
      cronLogger.info(`[BlockchainFeeService] Using stale cached price for ${symbol}: ${cached.price}`);
      return Number(cached.price);
    }
    
    // Return fallback prices
    return fallbackPrices[symbol] || 0;
  }
};

/**
 * Calculate fee for UTXO-based chains (BTC, LTC, DOGE, BCH)
 */
const calculateUtxoFee = async (
  chain: string,
  speed: 'fast' | 'medium' | 'slow' = 'fast'
): Promise<BlockchainFeeResult> => {
  const cacheKey = `blockchain_fee_${chain}`;
  const cached = await getRedisItem(cacheKey) as unknown as (BlockchainFeeResult & { timestamp?: string }) | null;
  
  // Return cached if valid
  if (cached && cached.timestamp && Number(cached.timestamp) > Date.now() - FEE_CACHE_DURATION * 1000) {
    return {
      chain: cached.chain,
      feeInNative: Number(cached.feeInNative),
      feeInUSD: Number(cached.feeInUSD),
      speed: cached.speed as 'fast' | 'medium' | 'slow',
      timestamp: Number(cached.timestamp)
    };
  }

  const feeData = await fetchTatumFee(chain) as { fast?: number; medium?: number; slow?: number };
  const satPerByte = feeData[speed] || feeData.fast || 0;
  const txSize = TX_SIZES[chain] || 250;
  
  // Calculate fee in satoshis, then convert to native currency
  const feeInSatoshis = satPerByte * txSize;
  const feeInNative = feeInSatoshis / 100000000; // Convert to BTC/LTC/etc
  
  const cryptoPrice = await getCryptoPrice(chain);
  const feeInUSD = feeInNative * cryptoPrice;

  const result: BlockchainFeeResult = {
    chain,
    feeInNative,
    feeInUSD,
    speed,
    satPerByte,
    timestamp: new Date(),
  };

  await setRedisItem(cacheKey, { ...result, timestamp: Date.now() });
  return result;
};

/**
 * Calculate fee for EVM-based chains (ETH, USDT_ERC20)
 */
const calculateEvmFee = async (
  chain: string,
  speed: 'fast' | 'medium' | 'slow' = 'fast'
): Promise<BlockchainFeeResult> => {
  const cacheKey = `blockchain_fee_${chain}`;
  const cached = await getRedisItem(cacheKey) as unknown as (BlockchainFeeResult & { timestamp?: string }) | null;
  
  if (cached && cached.timestamp && Number(cached.timestamp) > Date.now() - FEE_CACHE_DURATION * 1000) {
    return {
      chain: cached.chain,
      feeInNative: Number(cached.feeInNative),
      feeInUSD: Number(cached.feeInUSD),
      speed: cached.speed as 'fast' | 'medium' | 'slow',
      timestamp: Number(cached.timestamp)
    };
  }

  const feeData = await fetchTatumFee(chain) as { fast?: number; medium?: number; slow?: number };
  const gasPriceWei = feeData[speed] || feeData.fast || 0;
  const gasPriceGwei = gasPriceWei / 1e9;
  
  // Determine gas limit based on transaction type
  const isToken = chain.includes('ERC20') || chain.includes('USDT');
  const gasLimit = isToken ? GAS_LIMITS.USDT_ERC20 : GAS_LIMITS.ETH;
  
  // Calculate fee in ETH
  const feeInWei = gasPriceWei * gasLimit;
  const feeInNative = feeInWei / 1e18;
  
  const ethPrice = await getCryptoPrice('ETH');
  const feeInUSD = feeInNative * ethPrice;

  const result: BlockchainFeeResult = {
    chain,
    feeInNative,
    feeInUSD,
    speed,
    gasPrice: gasPriceGwei,
    timestamp: new Date(),
  };

  await setRedisItem(cacheKey, { ...result, timestamp: Date.now() });
  return result;
};

/**
 * Calculate fee for TRON-based chains (TRX, USDT_TRC20)
 */
const calculateTronFee = async (
  chain: string,
  speed: 'fast' | 'medium' | 'slow' = 'fast'
): Promise<BlockchainFeeResult> => {
  const cacheKey = `blockchain_fee_${chain}`;
  const cached = await getRedisItem(cacheKey) as unknown as (BlockchainFeeResult & { timestamp?: string }) | null;
  
  if (cached && cached.timestamp && Number(cached.timestamp) > Date.now() - FEE_CACHE_DURATION * 1000) {
    return {
      chain: cached.chain,
      feeInNative: Number(cached.feeInNative),
      feeInUSD: Number(cached.feeInUSD),
      speed: cached.speed as 'fast' | 'medium' | 'slow',
      timestamp: Number(cached.timestamp)
    };
  }

  const tronData = await fetchTronFee() as { bandwidthPrice?: number; energyPrice?: number };
  
  let feeInTRX: number;
  
  if (chain === 'TRX') {
    // Simple TRX transfer - uses bandwidth
    // If user has free bandwidth, fee is 0, otherwise ~0.265 TRX
    const bandwidth = TRON_COSTS.TRX.bandwidth;
    const bandwidthPrice = tronData.bandwidthPrice || 1000; // Sun per bandwidth
    feeInTRX = (bandwidth * bandwidthPrice) / 1e6; // Convert Sun to TRX
  } else {
    // TRC20 transfer - uses energy
    const energy = TRON_COSTS.USDT_TRC20.energy;
    const energyPrice = tronData.energyPrice || 100; // Sun per energy (post Proposal #104, was 420)
    feeInTRX = (energy * energyPrice) / 1e6; // Convert Sun to TRX
  }

  const trxPrice = await getCryptoPrice('TRX');
  const feeInUSD = feeInTRX * trxPrice;

  const result: BlockchainFeeResult = {
    chain,
    feeInNative: feeInTRX,
    feeInUSD,
    speed,
    timestamp: new Date(),
  };

  await setRedisItem(cacheKey, { ...result, timestamp: Date.now() });
  return result;
};

/**
 * Main function to get blockchain fee for any supported chain
 */
export const getBlockchainNetworkFee = async (
  chain: string,
  speed: 'fast' | 'medium' | 'slow' = 'fast'
): Promise<BlockchainFeeResult> => {
  const normalizedChain = chain.toUpperCase().replace('-', '_');
  
  // UTXO chains
  if (['BTC', 'LTC', 'DOGE', 'BCH'].includes(normalizedChain)) {
    return calculateUtxoFee(normalizedChain, speed);
  }
  
  // EVM chains
  if (['ETH', 'USDT_ERC20', 'USDC_ERC20', 'RLUSD_ERC20', 'POLYGON', 'USDT_POLYGON'].includes(normalizedChain)) {
    return calculateEvmFee(normalizedChain, speed);
  }
  
  // TRON chains
  if (['TRX', 'USDT_TRC20'].includes(normalizedChain)) {
    return calculateTronFee(normalizedChain, speed);
  }

  // Account-based chains with fixed/minimal fees
  if (['SOL', 'XRP', 'RLUSD'].includes(normalizedChain)) {
    // SOL, XRP, RLUSD have very low fixed fees but we still calculate feeInUSD
    // to ensure gas deduction is accurate (SOL @ $170 → ~$0.00085 per tx adds up)
    const fixedFees: Record<string, { fee: number; symbol: string; priceSymbol: string }> = {
      'SOL': { fee: 0.000005, symbol: 'SOL', priceSymbol: 'SOL' },
      'XRP': { fee: 0.000012, symbol: 'XRP', priceSymbol: 'XRP' },
      'RLUSD': { fee: 0.000012, symbol: 'XRP', priceSymbol: 'XRP' },
    };
    const feeInfo = fixedFees[normalizedChain] || { fee: 0, symbol: normalizedChain, priceSymbol: normalizedChain };
    
    // Calculate actual USD value instead of hardcoding 0
    let feeInUSD = 0;
    try {
      // Use fallback prices for SOL/XRP since CoinGecko may rate-limit
      const fallbackPrices: Record<string, number> = { 'SOL': 170, 'XRP': 2.5 };
      const nativePrice = await getCryptoPrice(feeInfo.priceSymbol).catch(() => fallbackPrices[feeInfo.priceSymbol] || 0);
      feeInUSD = feeInfo.fee * nativePrice;
    } catch {
      feeInUSD = 0; // Truly negligible fallback
    }
    
    return {
      chain: normalizedChain,
      feeInNative: feeInfo.fee,
      feeInUSD,
      nativeSymbol: feeInfo.symbol,
      speed,
      timestamp: Date.now(),
    };
  }

  throw new Error(`Unsupported blockchain: ${chain}`);
};

/**
 * Get fees for all supported blockchains
 */
export const getAllBlockchainFees = async (): Promise<Record<string, BlockchainFeeResult>> => {
  const chains = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'USDT_ERC20', 'USDC_ERC20', 'RLUSD_ERC20', 'USDT_TRC20', 'SOL', 'XRP', 'RLUSD', 'POLYGON', 'USDT_POLYGON', 'BCH'];
  const results: Record<string, BlockchainFeeResult> = {};

  await Promise.all(
    chains.map(async (chain) => {
      try {
        results[chain] = await getBlockchainNetworkFee(chain);
      } catch (error) {
        const msg = (error as { message?: string })?.message || String(error);
        cronLogger.error(`[BlockchainFeeService] Failed to get fee for ${chain}:`, msg);
      }
    })
  );

  return results;
};

/**
 * Calculate total amount customer should pay including blockchain fee
 * when fee_payer = 'customer'
 */
export const calculateCustomerPaymentAmount = async (
  baseAmountUSD: number,
  chain: string,
  cryptoPrice: number
): Promise<{
  baseAmountCrypto: number;
  blockchainFeeNative: number;
  blockchainFeeUSD: number;
  totalAmountCrypto: number;
  totalAmountUSD: number;
}> => {
  const fee = await getBlockchainNetworkFee(chain);
  
  // Convert base amount to crypto
  const baseAmountCrypto = baseAmountUSD / cryptoPrice;
  
  // Ensure fee values are numbers (in case they come from Redis as strings)
  const feeNative = parseFloat(String(fee.feeInNative)) || 0;
  const feeUSD = parseFloat(String(fee.feeInUSD)) || 0;
  
  // Add blockchain fee to total
  const totalAmountCrypto = baseAmountCrypto + feeNative;
  const totalAmountUSD = baseAmountUSD + feeUSD;

  return {
    baseAmountCrypto,
    blockchainFeeNative: feeNative,
    blockchainFeeUSD: feeUSD,
    totalAmountCrypto,
    totalAmountUSD,
  };
};

export default {
  getBlockchainNetworkFee,
  getAllBlockchainFees,
  calculateCustomerPaymentAmount,
};
