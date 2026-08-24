/**
 * Merchant Pool Configuration
 * 
 * Shared constants, config, types, and utilities used across all pool modules.
 */

import { Op } from "sequelize";
import { cronLogger } from "../../utils/loggers";
import {
  UTXO_CHAINS as MODEL_UTXO_CHAINS,
  TOKEN_CHAINS as MODEL_TOKEN_CHAINS,
} from "../../models";
import { getErrorMessage } from "../../helper";
import config from "../../utils/config";

// Configuration
export const POOL_CONFIG = {
  INITIAL_SIZE: config.num("MERCHANT_POOL_INITIAL_SIZE", 2),
  
  // Pre-warming: minimum AVAILABLE addresses to maintain per merchant per chain
  MIN_AVAILABLE: config.num("MERCHANT_POOL_MIN_AVAILABLE", 2),
  
  // Timeout settings
  RESERVATION_TIMEOUT_MINUTES: config.num("RESERVATION_TIMEOUT_MINUTES", 120),
  PROCESSING_TIMEOUT_MINUTES: 60,
  STALE_LOCK_TIMEOUT_MINUTES: 120,
  
  // Smart Gas Funding Settings
  // FIX (2026-04-02): Reduced from 1.5 (50%) to 1.2 (20%).
  // calculateDynamicTRC20Fee already adds 20% buffer, so combined ~44%.
  // Previously 50% + 40% = 110% total buffer, causing 4.4x overfunding.
  GAS_SAFETY_BUFFER: 1.2,  // 20% extra safety margin on top of fee estimation buffer
  
  // Minimum gas to maintain (fallback if estimation fails)
  TRX_GAS_FALLBACK: 30,
  ETH_GAS_FALLBACK: 0.001,
  XRP_GAS_FALLBACK: 0.001,    // XRP for gas only (tx fee ~12 drops / 0.000012 XRP). Reserve handled separately in sweep.
  POLYGON_GAS_FALLBACK: 0.05, // POL for gas (Polygon gas can spike to 500+ Gwei)
  
  // Minimum deficit to trigger funding (avoid micro-transactions)
  TRX_MIN_DEFICIT: 2,
  ETH_MIN_DEFICIT: 0.0002,
  XRP_MIN_DEFICIT: 0.001,     // XRP tx fees are ~0.000012 XRP; 0.001 avoids micro-funding while staying realistic
  POLYGON_MIN_DEFICIT: 0.005,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  SWEEP_RETRY_DELAY_MS: 5000,
  
  // ─── Fee Concentration: Minimum USD balance to attempt a sweep ───
  // Addresses below this threshold are left AVAILABLE for reuse by the
  // reservation pipeline (admin_fee_balance DESC ordering picks them first).
  // The next payment to the same address adds more fees, eventually making
  // the combined balance profitable to sweep — zero gas wasted.
  //
  // Thresholds are set at ~2× typical gas cost per chain family (matching
  // the 50% profitability rule in checkSweepProfitability).
  MIN_SWEEP_USD_TOKEN_HIGH_FEE: config.num("MIN_SWEEP_USD_TOKEN_HIGH_FEE", 10),   // TRC20, ERC20 tokens (energy/gas expensive)
  MIN_SWEEP_USD_NATIVE: config.num("MIN_SWEEP_USD_NATIVE", 5),                     // ETH, TRX, SOL, BNB, MATIC (native transfers)
  MIN_SWEEP_USD_LOW_FEE: config.num("MIN_SWEEP_USD_LOW_FEE", 2),                   // XRP, XLM (very cheap tx fees)
};

// UTXO chains that support batch transfers
export const UTXO_CHAINS = MODEL_UTXO_CHAINS || ["BTC", "LTC", "DOGE", "BCH"];

// Native currencies that can use both threshold and time-based sweep
export const NATIVE_CURRENCIES = ["TRX", "ETH", "SOL", "XRP", "POLYGON"];

// Tokens that can only use threshold-based sweep
export const TOKEN_CHAINS = MODEL_TOKEN_CHAINS || ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "RLUSD", "USDT-POLYGON", "RLUSD-ERC20"];

export const FEE_WALLETS = {
  TRX: config.str("TRX_FEE_WALLET"),
  ETH: config.str("ETH_FEE_WALLET"),
  XRP: config.str("XRP_FEE_WALLET"),
  POLYGON: config.str("POLYGON_FEE_WALLET"),
};

// Admin wallets for sweeping
export const ADMIN_WALLETS: Record<string, string> = {
  "BTC": config.str("BTC"),
  "ETH": config.str("ETH"),
  "LTC": config.str("LTC"),
  "DOGE": config.str("DOGE"),
  "TRX": config.str("TRX"),
  "BCH": config.str("BCH"),
  "USDT-TRC20": config.str("USDT_TRC20_ADMIN_WALLET") || config.str("USDT_TRC20"),
  "USDT-ERC20": config.str("USDT_ERC20_ADMIN_WALLET") || config.str("USDT_ERC20"),
  "USDC-ERC20": config.str("USDC_ERC20"),
  "SOL": config.str("SOL"),
  "XRP": config.str("XRP"),
  "RLUSD": config.str("RLUSD_ADMIN_WALLET") || config.str("XRP"),
  "POLYGON": config.str("POLYGON"),
  "USDT-POLYGON": config.str("USDT_POLYGON") || config.str("POLYGON"),
  "RLUSD-ERC20": config.str("RLUSD_ERC20") || config.str("ETH"),
};

export const TOKEN_CONTRACTS: Record<string, string> = {
  "USDT-TRC20": config.str("TRX_CONTRACT") || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "USDT-ERC20": config.str("ETH_CONTRACT") || "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "USDC-ERC20": config.str("USDC_CONTRACT") || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "USDT-POLYGON": config.str("USDT_POLYGON_CONTRACT") || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  "RLUSD-ERC20": config.str("RLUSD_ERC20_CONTRACT") || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD",
};

// RLUSD on XRP Ledger configuration
export const RLUSD_CONFIG = {
  issuer: config.str("RLUSD_ISSUER") || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
  currencyHex: config.str("RLUSD_CURRENCY_HEX") || "524C555344000000000000000000000000000000",
};

/**
 * Tag-based chains: use a single master address + unique destination tags
 * instead of creating individual funded addresses per payment.
 * 
 * Benefits:
 * - No per-address XRP funding (saves ~2 XRP / $5+ per address)
 * - No per-address trust line setup (RLUSD)
 * - Instant address generation (no blockchain interaction)
 * - One master subscription covers all payments
 */
export const TAG_BASED_CHAINS = ["XRP", "RLUSD"];

/**
 * Master address for tag-based XRP/RLUSD payments.
 * This is a dedicated wallet for receiving XRP/RLUSD payments via destination tags.
 * It has been funded with XRP and has RLUSD trust line established.
 * SEPARATE from the XRP gas/fee wallet (XRP_FEE_WALLET) which handles gas funding.
 */
export const XRP_MASTER_ADDRESS = config.str("XRP_MASTER_WALLET");

/**
 * Check if a wallet type uses destination-tag-based addressing
 */
export const isTagBasedChain = (walletType: string): boolean => {
  return TAG_BASED_CHAINS.includes(walletType);
};

/**
 * Construct the Redis key for a crypto payment address.
 * For tag-based chains (XRP/RLUSD): includes destination tag.
 * For other chains: just the address.
 */
export const getCryptoRedisKey = (address: string, destinationTag?: number | null): string => {
  if (destinationTag !== undefined && destinationTag !== null) {
    return `crypto-${address}-tag-${destinationTag}`;
  }
  return `crypto-${address}`;
};

/**
 * Sweep configuration per chain
 */
export interface SweepConfig {
  mode: "threshold" | "time" | "batch";
  value?: number;
}

const parseSweepConfig = (walletType: string): SweepConfig => {
  // Check for explicit env override first (allows overriding UTXO default)
  const envKey = `${walletType.replace(/-/g, "_")}_SWEEP`;
  const configValue = config.str(envKey);

  if (configValue) {
    const [mode, valueStr] = configValue.split(":");

    if (mode !== "threshold" && mode !== "time") {
      cronLogger.error(`[MerchantPool] Invalid sweep mode for ${walletType}: ${mode}. Using default.`);
    } else if (TOKEN_CHAINS.includes(walletType) && mode === "time") {
      cronLogger.error(`[MerchantPool] Tokens cannot use time-based sweep! ${walletType} must use threshold. Using threshold:30`);
      return { mode: "threshold", value: 30 };
    } else {
      const value = valueStr ? parseInt(valueStr, 10) : (mode === "threshold" ? 30 : 10);
      if (isNaN(value) || value <= 0) {
        cronLogger.error(`[MerchantPool] Invalid sweep value for ${walletType}: ${valueStr}. Using default.`);
        return { mode, value: mode === "threshold" ? 30 : 10 };
      }
      return { mode, value };
    }
  }

  // Default: UTXO chains use batch mode
  if (UTXO_CHAINS.includes(walletType)) {
    return { mode: "batch" };
  }

  cronLogger.warn(`[MerchantPool] No sweep config for ${walletType}, using default: threshold:30`);
  return { mode: "threshold", value: 30 };
};

export const getSweepConfig = (walletType: string): SweepConfig => {
  return parseSweepConfig(walletType);
};

/**
 * Retry helper with exponential backoff
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = POOL_CONFIG.MAX_RETRIES,
  delayMs: number = POOL_CONFIG.RETRY_DELAY_MS
): Promise<T> => {
  let lastError: Error | null = null;
  
  const NON_RETRYABLE_ERRORS = [
    'invalid address', 'invalid private key', 'insufficient balance',
    'insufficient funds', 'nonce too low', 'replacement transaction underpriced',
    'already known', 'invalid signature', 'bad request', 'unauthorized',
    'forbidden', 'not found', '400', '401', '403', '404',
  ];
  
  const isRetryable = (error: Error): boolean => {
    const message = error.message?.toLowerCase() || '';
    return !NON_RETRYABLE_ERRORS.some(pattern => message.includes(pattern.toLowerCase()));
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const message = getErrorMessage(error);
      
      if (!isRetryable(lastError)) {
        cronLogger.error(`[MerchantPool] ❌ ${operationName} failed with non-retryable error: ${message}`);
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        const waitTime = delayMs * Math.pow(2, attempt - 1);
        cronLogger.warn(`[MerchantPool] ⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${message}`);
        cronLogger.warn(`[MerchantPool] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        cronLogger.error(`[MerchantPool] ❌ ${operationName} failed after ${maxRetries} attempts: ${message}`);
      }
    }
  }
  
  throw lastError;
};

// Minimum time to wait before considering a webhook "failed" (in minutes)
export const WEBHOOK_GRACE_PERIOD_MINUTES = 10;

/**
 * Get the minimum USD balance required before attempting a sweep for a given chain.
 * Addresses below this threshold are left AVAILABLE for fee concentration via reuse.
 */
const HIGH_FEE_TOKEN_CHAINS = ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "USDT-POLYGON"];
const LOW_FEE_CHAINS = ["XRP", "XLM", "RLUSD"];

export const getMinSweepUSD = (walletType: string): number => {
  if (HIGH_FEE_TOKEN_CHAINS.includes(walletType)) {
    return POOL_CONFIG.MIN_SWEEP_USD_TOKEN_HIGH_FEE;
  }
  if (LOW_FEE_CHAINS.includes(walletType)) {
    return POOL_CONFIG.MIN_SWEEP_USD_LOW_FEE;
  }
  return POOL_CONFIG.MIN_SWEEP_USD_NATIVE;
};

// Re-export Op for convenience
export { Op };
