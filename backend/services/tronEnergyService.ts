/**
 * TRON Energy & Resource Optimization Service
 * 
 * Provides real-time TRON network data for:
 * - Energy/Bandwidth price fetching (via TronGrid HTTP API)
 * - Account resource checking (available staked Energy)
 * - Dynamic feeLimit calculation for TRC20 transfers
 * - Cost-saving estimation and logging
 * 
 * Post Proposal #104 (Aug 2025): Energy price reduced from 420 → 100 SUN/unit
 * This service fetches live data so fee calculations remain accurate.
 */

import axios from "axios";
import { cronLogger } from "../utils/loggers";
import { getRedisItem, setRedisItem, setRedisItemWithTTL, setRedisTTL } from "../utils/redisInstance";

// ─── Constants ───────────────────────────────────────────────────────────────

// TronGrid public API (no key required for basic queries)
const TRONGRID_API = process.env.TRONGRID_API_URL || "https://api.trongrid.io";

// Redis cache keys
const CACHE_KEYS = {
  NETWORK_PARAMS: "tron:network_params",
  ACCOUNT_RESOURCES_PREFIX: "tron:resources:",
  ACCOUNT_ACTIVATED_PREFIX: "tron:activated:",
};

// Cache TTLs (seconds)
const CACHE_TTL = {
  NETWORK_PARAMS: 300,      // 5 min — network params change rarely
  ACCOUNT_RESOURCES: 180,   // 180 sec — increased from 120s to further reduce TronGrid 429s during sweep cycles
  ACCOUNT_ACTIVATED: 300,   // 5 min — FIX (2026-04-07): Reduced from 24h. Merchants can zero their
                            // token balance at any time (outgoing transfer), making the "activated"
                            // status stale. A stale cache caused OUT_OF_ENERGY on $98 payment when
                            // SmartGas funded for 65k energy (ACTIVATED) but TRON VM charged 130k (NEW).
                            // 5 min balances accuracy vs API rate limiting.
};

// Energy required for TRC20 transfers
export const TRC20_ENERGY = {
  EXISTING_RECIPIENT: 65000,   // Transfer to a wallet that already holds the token
  NEW_RECIPIENT: 130000,       // Transfer to a wallet that has never held the token
};

// Bandwidth for a typical TRC20 transfer (~345 bytes)
export const TRC20_BANDWIDTH = 345;

// Fallback values (post Proposal #104, Aug 2025)
const FALLBACK = {
  ENERGY_PRICE_SUN: parseInt(process.env.TRON_ENERGY_PRICE_SUN || "100"),
  BANDWIDTH_PRICE_SUN: 1000,
  FREE_BANDWIDTH: 600,
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TronNetworkParams {
  energyPriceSun: number;
  bandwidthPriceSun: number;
  /** Dynamic Energy Model max multiplier (e.g. 3.4 means actual price can be 3.4× base) */
  dynamicEnergyMaxFactor: number;
  totalEnergyLimit: number;
  totalEnergyWeight: number;
  totalBandwidthLimit: number;
  totalBandwidthWeight: number;
  timestamp: number;
}

export interface AccountResources {
  address: string;
  energyLimit: number;
  energyUsed: number;
  availableEnergy: number;
  bandwidthLimit: number;
  freeBandwidth: number;
  bandwidthUsed: number;
  availableBandwidth: number;
  hasSufficientEnergy: boolean;
  timestamp: number;
}

export interface FeeLimitResult {
  feeLimit: number;
  energyNeeded: number;
  energyAvailable: number;
  energyDeficit: number;
  estimatedCostTRX: number;
  isNewRecipient: boolean;
  savingsPercent: number;
}

// ─── Network Parameter Fetching ──────────────────────────────────────────────

/**
 * Fetch current TRON network parameters (energy price, bandwidth price, etc.)
 * Uses TronGrid /wallet/getchainparameters endpoint.
 */
export const getTronNetworkParams = async (): Promise<TronNetworkParams> => {
  // Check Redis cache
  try {
    const cached = await getRedisItem(CACHE_KEYS.NETWORK_PARAMS) as TronNetworkParams | null;
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL.NETWORK_PARAMS * 1000) {
      return cached;
    }
  } catch (_cacheErr) {
    // Continue without cache
  }

  try {
    const chainParamsRes = await axios.post(
      `${TRONGRID_API}/wallet/getchainparameters`,
      {},
      { timeout: 8000 }
    );

    let energyPriceSun = FALLBACK.ENERGY_PRICE_SUN;
    let bandwidthPriceSun = FALLBACK.BANDWIDTH_PRICE_SUN;
    let dynamicEnergyMaxFactorRaw = 10000; // 10000 = 1.0x (no multiplier)

    const params = chainParamsRes.data?.chainParameter || [];
    for (const p of params) {
      if (p.key === "getEnergyFee") {
        energyPriceSun = p.value;
      }
      if (p.key === "getTransactionFee") {
        bandwidthPriceSun = p.value;
      }
      // FIX (2026-04-10): Fetch Dynamic Energy Model (DEM) max factor.
      // getDynamicEnergyMaxFactor = 34000 means actual energy price can be 3.4× the base.
      // Without this, feeLimit was calculated from BASE price only → OUT_OF_ENERGY during congestion.
      if (p.key === "getDynamicEnergyMaxFactor") {
        dynamicEnergyMaxFactorRaw = p.value;
      }
    }

    // Override from env if explicitly set
    if (process.env.TRON_ENERGY_PRICE_SUN) {
      energyPriceSun = parseInt(process.env.TRON_ENERGY_PRICE_SUN);
    }

    // Convert raw factor (34000 → 3.4). Minimum 1.0 (no multiplier).
    const dynamicEnergyMaxFactor = Math.max(1, dynamicEnergyMaxFactorRaw / 10000);

    const result: TronNetworkParams = {
      energyPriceSun,
      bandwidthPriceSun,
      dynamicEnergyMaxFactor,
      totalEnergyLimit: 0,
      totalEnergyWeight: 0,
      totalBandwidthLimit: 0,
      totalBandwidthWeight: 0,
      timestamp: Date.now(),
    };

    // Cache result
    try {
      await setRedisItem(CACHE_KEYS.NETWORK_PARAMS, result);
    } catch (_e) {
      // Non-critical
    }

    cronLogger.info(`[TronEnergy] 📊 Network params: Energy=${energyPriceSun} SUN/unit, Bandwidth=${bandwidthPriceSun} SUN/point, DEM max=${dynamicEnergyMaxFactor}x`);
    return result;

  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn(`[TronEnergy] ⚠️ Failed to fetch network params: ${err.message}, using fallbacks`);
    return {
      energyPriceSun: FALLBACK.ENERGY_PRICE_SUN,
      bandwidthPriceSun: FALLBACK.BANDWIDTH_PRICE_SUN,
      dynamicEnergyMaxFactor: 3.4, // Conservative fallback: assume max DEM multiplier
      totalEnergyLimit: 0,
      totalEnergyWeight: 0,
      totalBandwidthLimit: 0,
      totalBandwidthWeight: 0,
      timestamp: Date.now(),
    };
  }
};

// ─── Account Resource Checking ───────────────────────────────────────────────

/**
 * Get an account's available Energy and Bandwidth resources.
 * Uses TronGrid /wallet/getaccountresource endpoint.
 */
export const getAccountResources = async (address: string): Promise<AccountResources> => {
  const cacheKey = `${CACHE_KEYS.ACCOUNT_RESOURCES_PREFIX}${address}`;

  // Check cache (short TTL)
  try {
    const cached = await getRedisItem(cacheKey) as AccountResources | null;
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL.ACCOUNT_RESOURCES * 1000) {
      return cached;
    }
  } catch (_e) {
    // Continue
  }

  // Retry with backoff for transient errors (429 rate limits, ETIMEDOUT, etc.)
  const MAX_RETRIES = 2;
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${TRONGRID_API}/wallet/getaccountresource`,
        { address, visible: true },
        { timeout: 8000 }
      );

      const data = response.data;

      const energyLimit = data.EnergyLimit || 0;
      const energyUsed = data.EnergyUsed || 0;
      const availableEnergy = Math.max(0, energyLimit - energyUsed);

      const freeBandwidth = data.freeNetLimit || FALLBACK.FREE_BANDWIDTH;
      const freeBandwidthUsed = data.freeNetUsed || 0;
      const stakedBandwidth = data.NetLimit || 0;
      const stakedBandwidthUsed = data.NetUsed || 0;

      const totalBandwidth = freeBandwidth + stakedBandwidth;
      const totalBandwidthUsed = freeBandwidthUsed + stakedBandwidthUsed;
      const availableBandwidth = Math.max(0, totalBandwidth - totalBandwidthUsed);

      const result: AccountResources = {
        address,
        energyLimit,
        energyUsed,
        availableEnergy,
        bandwidthLimit: stakedBandwidth,
        freeBandwidth,
        bandwidthUsed: totalBandwidthUsed,
        availableBandwidth,
        hasSufficientEnergy: availableEnergy >= TRC20_ENERGY.EXISTING_RECIPIENT,
        timestamp: Date.now(),
      };

      // Cache with explicit TTL
      try {
        await setRedisItemWithTTL(cacheKey, result, CACHE_TTL.ACCOUNT_RESOURCES);
      } catch (_e) {
        // Non-critical
      }

      return result;

    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string; code?: string };
      lastError = err.message || 'Unknown error';
      const is429 = err.response?.status === 429;
      const isTransient = is429 || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED';
      
      if (isTransient && attempt < MAX_RETRIES) {
        const delay = is429 ? 2500 * attempt : 500 * attempt; // Longer backoff for 429 rate limits
        await new Promise(r => setTimeout(r, delay));
        continue; // Retry
      }
      // Final attempt failed — fall through to fallback below
    }
  }
  
  cronLogger.warn(`[TronEnergy] ⚠️ Failed to get resources for ${address}: ${lastError}`);
  return {
    address,
    energyLimit: 0,
    energyUsed: 0,
    availableEnergy: 0,
    bandwidthLimit: 0,
    freeBandwidth: FALLBACK.FREE_BANDWIDTH,
    bandwidthUsed: 0,
    availableBandwidth: FALLBACK.FREE_BANDWIDTH,
    hasSufficientEnergy: false,
    timestamp: Date.now(),
  };
};

// ─── Recipient Activation Check ──────────────────────────────────────────────

/**
 * Parse a TRC20 balance list in the shape [{ "<contractAddress>": "<rawBalance>" }, ...]
 * (returned by both TronGrid /v1/accounts/{addr} and Tatum /v3/tron/account/{addr})
 * and determine whether the account currently holds a non-zero balance of the token.
 */
const hasTrc20TokenBalance = (
  trc20List: Array<Record<string, string>> | undefined,
  tokenContractAddress: string
): boolean => {
  if (!Array.isArray(trc20List)) return false;
  for (const entry of trc20List) {
    const rawBalance = entry?.[tokenContractAddress];
    if (rawBalance !== undefined && parseFloat(rawBalance) > 0) return true;
  }
  return false;
};

/**
 * Check if a recipient address currently holds a specific TRC20 token.
 * New recipients (empty token storage slot) cost ~2x energy (130k vs 65k).
 *
 * BUGFIX (2026-07-10): The previous implementation called TronGrid
 * `GET /v1/accounts/{addr}/tokens/trc20?contract_address=...` which now returns
 * 404 (endpoint removed), and its TronScan fallback now returns 401 (API key
 * required). Result: EVERY activation check failed and defaulted to
 * "NEW recipient" — long-activated addresses (incl. the admin fee USDT wallet)
 * were treated as new, doubling the energy budget (130k vs 65k) on every
 * USDT-TRC20 transfer/sweep. Fixed by using the still-supported TronGrid
 * `GET /v1/accounts/{addr}` (returns the full trc20 balance array, no key
 * needed) with Tatum `GET /v3/tron/account/{addr}` as fallback (TATUM_KEY).
 */
export const isRecipientActivatedForToken = async (
  recipientAddress: string,
  tokenContractAddress: string
): Promise<boolean> => {
  const cacheKey = `${CACHE_KEYS.ACCOUNT_ACTIVATED_PREFIX}${recipientAddress}:${tokenContractAddress}`;

  // Check cache (short TTL — balance can change anytime)
  try {
    const cached = await getRedisItem(cacheKey) as { activated?: boolean; ts?: number } | null;
    if (cached && cached.activated !== undefined) {
      return cached.activated;
    }
  } catch (_e) {
    // Continue
  }

  const cacheResult = async (activated: boolean) => {
    // Cache BOTH activated and not-activated states with a short 5-min TTL
    // (see 2026-04-07 fix: only caching TRUE caused 429 storms + stale TRUE).
    try {
      await setRedisItemWithTTL(cacheKey, { activated }, CACHE_TTL.ACCOUNT_ACTIVATED);
    } catch (_e) {
      // Non-critical
    }
  };

  try {
    // Attempt 1: TronGrid account endpoint (primary, no API key required).
    // A non-existent (never funded) account returns 200 with data: [] —
    // correctly treated as NOT activated.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await axios.get(
          `${TRONGRID_API}/v1/accounts/${recipientAddress}`,
          { timeout: 10000 }
        );

        const account = response.data?.data?.[0];
        const activated = hasTrc20TokenBalance(account?.trc20, tokenContractAddress);
        await cacheResult(activated);
        return activated;
      } catch (_err: unknown) {
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s backoff before retry
        }
      }
    }

    // Attempt 2: Tatum fallback (same trc20 array shape, uses existing TATUM_KEY)
    try {
      const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
      if (tatumKey) {
        const tatumResponse = await axios.get(
          `https://api.tatum.io/v3/tron/account/${recipientAddress}`,
          { timeout: 10000, headers: { "x-api-key": tatumKey, Accept: "application/json" } }
        );

        const activated = hasTrc20TokenBalance(tatumResponse.data?.trc20, tokenContractAddress);
        await cacheResult(activated);
        cronLogger.info(`[TronEnergy] Token activation check succeeded via Tatum fallback for ${recipientAddress}: ${activated}`);
        return activated;
      }
    } catch (_tatumErr) {
      // Both APIs failed
    }

    // Default to NEW recipient (130k energy) for safety — costs more gas but won't fail with OUT_OF_ENERGY
    // Previously defaulted to existing (65k), which caused repeated OUT_OF_ENERGY failures
    cronLogger.warn(`[TronEnergy] ⚠️ Could not check token activation for ${recipientAddress} after retries, assuming NEW recipient (safe default, 130k energy)`);
    return false;

  } catch (_error: unknown) {
    // Default to NEW recipient (130k energy) for safety
    cronLogger.warn(`[TronEnergy] ⚠️ Could not check token activation for ${recipientAddress}, assuming NEW recipient (safe default)`);
    return false;
  }
};

// ─── Dynamic feeLimit Calculation ────────────────────────────────────────────

/**
 * Calculate optimal feeLimit for a TRC20 transfer.
 * Considers: current energy price, sender's staked Energy, recipient activation.
 * Returns feeLimit in TRX (not SUN).
 */
export const calculateOptimalFeeLimit = async (
  senderAddress: string,
  recipientAddress: string,
  tokenContractAddress?: string
): Promise<FeeLimitResult> => {
  const [networkParams, senderResources] = await Promise.all([
    getTronNetworkParams(),
    getAccountResources(senderAddress),
  ]);

  // Check if recipient is new (costs 2x energy)
  let isNewRecipient = false;
  if (tokenContractAddress) {
    isNewRecipient = !(await isRecipientActivatedForToken(recipientAddress, tokenContractAddress));
  }

  const energyNeeded = isNewRecipient
    ? TRC20_ENERGY.NEW_RECIPIENT
    : TRC20_ENERGY.EXISTING_RECIPIENT;

  // Energy deficit = what must be burned as TRX
  const energyDeficit = Math.max(0, energyNeeded - senderResources.availableEnergy);

  // FIX (2026-04-10): Apply DEM multiplier to energy cost.
  // TRON's Dynamic Energy Model can increase the actual energy price up to dynamicEnergyMaxFactor × base.
  // feeLimit is a MAXIMUM (unused portion is NOT charged), so using worst-case is safe.
  // Without this: feeLimit was calculated from base price (100 SUN) but actual price during
  // congestion could be 200-340 SUN → OUT_OF_ENERGY failures.
  const demMultiplier = networkParams.dynamicEnergyMaxFactor || 1;
  const effectiveEnergyPrice = networkParams.energyPriceSun * demMultiplier;
  const energyCostSun = energyDeficit * effectiveEnergyPrice;

  // Bandwidth cost — check if free bandwidth covers it
  let bandwidthCostSun = 0;
  if (senderResources.availableBandwidth < TRC20_BANDWIDTH) {
    bandwidthCostSun = TRC20_BANDWIDTH * networkParams.bandwidthPriceSun;
  }

  const totalCostSun = energyCostSun + bandwidthCostSun;
  const estimatedCostTRX = totalCostSun / 1_000_000;

  // feeLimit with 50% safety buffer, minimum 15 TRX (raised from 5 TRX on 2026-04-10)
  // feeLimit is a CEILING — only actual energy consumed is charged, so higher limit is safe
  const minFeeLimit = parseInt(process.env.TRON_MIN_FEE_LIMIT_TRX || "15");
  const maxFeeLimit = parseInt(process.env.TRON_MAX_FEE_LIMIT_TRX || "50");
  const feeLimitTRX = Math.max(Math.ceil(estimatedCostTRX * 1.5), minFeeLimit);
  const finalFeeLimit = Math.min(feeLimitTRX, maxFeeLimit);

  const savingsPercent = ((50 - finalFeeLimit) / 50) * 100;

  cronLogger.info(
    `[TronEnergy] 💡 Fee optimization: ` +
    `Energy needed=${energyNeeded}, available=${senderResources.availableEnergy}, deficit=${energyDeficit} | ` +
    `DEM max=${demMultiplier}x, effectivePrice=${effectiveEnergyPrice} SUN/unit | ` +
    `Est. cost=${estimatedCostTRX.toFixed(2)} TRX | feeLimit=${finalFeeLimit} TRX (max=${maxFeeLimit})`
  );

  return {
    feeLimit: finalFeeLimit,
    energyNeeded,
    energyAvailable: senderResources.availableEnergy,
    energyDeficit,
    estimatedCostTRX,
    isNewRecipient,
    savingsPercent,
  };
};

// ─── Dynamic TRC20 Fee for SmartGas ─────────────────────────────────────────

/**
 * Calculate the TRX amount needed for a TRC20 transfer (for SmartGas funding).
 * Returns the estimated TRX cost considering available Energy.
 * 
 * FIX (2026-04-02): Now recipient-aware — checks if the merchant wallet already
 * holds the token (65k energy) vs new recipient (130k energy). Previously always
 * assumed NEW_RECIPIENT (130k), causing 2x overfunding.
 * Buffer reduced from 40% to 20% (SmartGas adds its own buffer on top).
 */
export const calculateDynamicTRC20Fee = async (
  senderAddress?: string,
  recipientAddress?: string,
  tokenContractAddress?: string
): Promise<{ fast: number; energyPrice: number; energyNeeded: number; energyAvailable: number; isNewRecipient: boolean }> => {
  const networkParams = await getTronNetworkParams();

  let availableEnergy = 0;
  if (senderAddress) {
    try {
      const resources = await getAccountResources(senderAddress);
      availableEnergy = resources.availableEnergy;
    } catch (_e) {
      // Continue with 0 available
    }
  }

  // FIX: Check recipient activation to use correct energy estimate
  // Activated recipients (already hold the token) need 65k energy vs 130k for new
  let isNewRecipient = true; // Safe default: assume new (130k)
  if (recipientAddress && tokenContractAddress) {
    try {
      const activated = await isRecipientActivatedForToken(recipientAddress, tokenContractAddress);
      isNewRecipient = !activated;
      cronLogger.info(
        `[TronEnergy] 🔍 Recipient ${recipientAddress.substring(0, 10)}... activation: ${activated ? 'ACTIVATED (65k energy)' : 'NEW (130k energy)'}`
      );
    } catch (_e) {
      cronLogger.warn(`[TronEnergy] ⚠️ Recipient activation check failed, assuming NEW (130k energy)`);
    }
  }

  const energyNeeded = isNewRecipient
    ? TRC20_ENERGY.NEW_RECIPIENT   // 130,000
    : TRC20_ENERGY.EXISTING_RECIPIENT; // 65,000
  const energyDeficit = Math.max(0, energyNeeded - availableEnergy);

  // FIX (2026-04-10): Apply DEM multiplier for gas funding estimate.
  // Gas funding = actual TRX sent to the sender address to cover fees.
  // Unlike feeLimit (which is a ceiling), gas funding should be realistic but conservative.
  // Use half the DEM max factor as a balanced estimate for funding.
  const demMultiplier = networkParams.dynamicEnergyMaxFactor || 1;
  const demFundingMultiplier = Math.max(1, (1 + demMultiplier) / 2); // Midpoint: e.g., (1+3.4)/2 = 2.2x
  const effectiveEnergyPrice = networkParams.energyPriceSun * demFundingMultiplier;

  // Cost in TRX
  const energyCostTRX = (energyDeficit * effectiveEnergyPrice) / 1_000_000;

  // Bandwidth cost (~0.345 TRX in worst case at 1000 SUN/point)
  const bandwidthCostTRX = (TRC20_BANDWIDTH * networkParams.bandwidthPriceSun) / 1_000_000;
  const totalCostTRX = energyCostTRX + bandwidthCostTRX;

  // FIX: Reduced buffer from 40% to 20%. SmartGas adds its own 20% buffer on top.
  // Combined ~44% buffer is sufficient (was 110% before).
  const fastFee = Math.max(Math.ceil(totalCostTRX * 1.20 * 10) / 10, 1);

  cronLogger.info(
    `[TronEnergy] 📊 Dynamic TRC20 fee: ${fastFee} TRX ` +
    `(energy: ${energyNeeded} needed [${isNewRecipient ? 'NEW' : 'ACTIVATED'}], ${availableEnergy} available, ${energyDeficit} deficit @ ${Math.round(effectiveEnergyPrice)} effective SUN/unit [DEM ${demFundingMultiplier.toFixed(1)}x])`
  );

  return {
    fast: fastFee,
    energyPrice: networkParams.energyPriceSun,
    energyNeeded,
    energyAvailable: availableEnergy,
    isNewRecipient,
  };
};

// ─── Cost Savings Logger ─────────────────────────────────────────────────────

/**
 * Log cost comparison between old (hardcoded) and new (dynamic) fee approach.
 */
export const logCostSavings = (
  context: string,
  oldFeeTRX: number,
  newFeeTRX: number,
  details?: Record<string, unknown>
): void => {
  const savedTRX = oldFeeTRX - newFeeTRX;
  const savedPercent = oldFeeTRX > 0 ? ((savedTRX / oldFeeTRX) * 100).toFixed(1) : "0";

  cronLogger.info(
    `[TronEnergy] 💰 COST SAVINGS [${context}]: ` +
    `Old=${oldFeeTRX} TRX → New=${newFeeTRX.toFixed(2)} TRX | ` +
    `Saved=${savedTRX.toFixed(2)} TRX (${savedPercent}%)` +
    (details ? ` | ${JSON.stringify(details)}` : "")
  );
};

// ─── TRX Native Transfer Fee ────────────────────────────────────────────────

// Bandwidth needed for a simple TRX native transfer (~270 bytes)
const TRX_NATIVE_BANDWIDTH = 270;

/**
 * Calculate fee for a native TRX transfer.
 * TRX native transfers use ONLY Bandwidth (no Energy).
 * With 600 free daily Bandwidth points, most transfers are FREE.
 * If bandwidth exhausted: ~0.27 TRX per transfer (270 bytes × 1000 SUN/byte).
 */
export const calculateDynamicTRXNativeFee = async (
  senderAddress?: string
): Promise<{ fast: number; medium: number; slow: number; bandwidthFree: boolean }> => {
  let bandwidthFree = false;

  if (senderAddress) {
    try {
      const resources = await getAccountResources(senderAddress);
      if (resources.availableBandwidth >= TRX_NATIVE_BANDWIDTH) {
        bandwidthFree = true;
      }
    } catch (_e) {
      // Continue assuming no free bandwidth
    }
  }

  if (bandwidthFree) {
    cronLogger.info(`[TronEnergy] 🆓 TRX native transfer: FREE (bandwidth available)`);
    return { fast: 0, medium: 0, slow: 0, bandwidthFree: true };
  }

  // Worst case: burn TRX for bandwidth
  const networkParams = await getTronNetworkParams();
  const costSun = TRX_NATIVE_BANDWIDTH * networkParams.bandwidthPriceSun;
  const costTRX = costSun / 1_000_000;
  const fee = Math.max(Math.ceil(costTRX * 1.1 * 10) / 10, 0.5); // 10% buffer, min 0.5 TRX

  cronLogger.info(
    `[TronEnergy] 📊 TRX native fee: ${fee} TRX (${TRX_NATIVE_BANDWIDTH} bandwidth @ ${networkParams.bandwidthPriceSun} SUN/point)`
  );

  return { fast: fee, medium: fee, slow: fee, bandwidthFree: false };
};

// ─── Optimization Diagnostics ────────────────────────────────────────────────

/**
 * Returns a full diagnostic snapshot of TRON fee optimization status.
 * Useful for monitoring dashboards and verifying the service works.
 */
export const getOptimizationDiagnostics = async (
  testAddress?: string
): Promise<Record<string, unknown>> => {
  const networkParams = await getTronNetworkParams();

  let accountResources = null;
  if (testAddress) {
    try {
      accountResources = await getAccountResources(testAddress);
    } catch (_e) {
      accountResources = { error: "Failed to fetch" };
    }
  }

  // Calculate comparison: old vs new fees
  const oldTRC20FeeTRX = 20;
  const oldFeeLimitTRX = 50;
  const oldNativeTRXFee = 10;

  // New dynamic calculations
  const newEnergyDeficit = TRC20_ENERGY.EXISTING_RECIPIENT; // Worst case: no staked Energy
  const newTRC20CostSun = newEnergyDeficit * networkParams.energyPriceSun + TRC20_BANDWIDTH * networkParams.bandwidthPriceSun;
  const newTRC20CostTRX = newTRC20CostSun / 1_000_000;

  const newNativeCostSun = TRX_NATIVE_BANDWIDTH * networkParams.bandwidthPriceSun;
  const newNativeCostTRX = newNativeCostSun / 1_000_000;

  return {
    service: "TRON Energy Optimization Service",
    status: "active",
    networkParams: {
      energyPriceSun: networkParams.energyPriceSun,
      bandwidthPriceSun: networkParams.bandwidthPriceSun,
      fetchedAt: new Date(networkParams.timestamp).toISOString(),
      source: "TronGrid API (cached 5 min)",
    },
    trc20Transfer: {
      energyRequired: {
        existingRecipient: TRC20_ENERGY.EXISTING_RECIPIENT,
        newRecipient: TRC20_ENERGY.NEW_RECIPIENT,
      },
      bandwidthRequired: TRC20_BANDWIDTH,
      costEstimate: {
        worstCaseTRX: Math.ceil(newTRC20CostTRX * 1.2),
        oldHardcodedTRX: oldTRC20FeeTRX,
        savingsPercent: (((oldTRC20FeeTRX - newTRC20CostTRX) / oldTRC20FeeTRX) * 100).toFixed(1),
      },
      feeLimit: {
        oldHardcodedTRX: oldFeeLimitTRX,
        newDynamicMaxTRX: parseInt(process.env.TRON_MAX_FEE_LIMIT_TRX || "30"),
        newDynamicMinTRX: parseInt(process.env.TRON_MIN_FEE_LIMIT_TRX || "5"),
      },
    },
    trxNativeTransfer: {
      bandwidthRequired: TRX_NATIVE_BANDWIDTH,
      costEstimate: {
        withBandwidthTRX: 0,
        withoutBandwidthTRX: Math.ceil(newNativeCostTRX * 1.1 * 10) / 10,
        oldHardcodedTRX: oldNativeTRXFee,
        savingsPercent: (((oldNativeTRXFee - newNativeCostTRX) / oldNativeTRXFee) * 100).toFixed(1),
      },
    },
    accountResources: accountResources,
    config: {
      TRON_MIN_FEE_LIMIT_TRX: process.env.TRON_MIN_FEE_LIMIT_TRX || "5",
      TRON_MAX_FEE_LIMIT_TRX: process.env.TRON_MAX_FEE_LIMIT_TRX || "30",
      TRON_ENERGY_PRICE_SUN: process.env.TRON_ENERGY_PRICE_SUN || "auto (from TronGrid)",
    },
  };
};

/**
 * Mark a recipient address as activated for a specific TRC20 token.
 * Call this AFTER a successful token transfer to the recipient.
 * This caches the activation status, preventing future API calls from
 * defaulting to 130k energy (NEW recipient) when TronGrid/TronScan are unreachable.
 */
export const markRecipientActivated = async (
  recipientAddress: string,
  tokenContractAddress: string
): Promise<void> => {
  try {
    const cacheKey = `${CACHE_KEYS.ACCOUNT_ACTIVATED_PREFIX}${recipientAddress}:${tokenContractAddress}`;
    await setRedisItem(cacheKey, { activated: true });
    // Activation is permanent — set long TTL (7 days)
    await setRedisTTL(cacheKey, 7 * 24 * 3600);
  } catch (_e) {
    // Non-critical — best-effort caching
  }
};

export default {
  getTronNetworkParams,
  getAccountResources,
  isRecipientActivatedForToken,
  markRecipientActivated,
  calculateOptimalFeeLimit,
  calculateDynamicTRC20Fee,
  calculateDynamicTRXNativeFee,
  getOptimizationDiagnostics,
  logCostSavings,
  TRC20_ENERGY,
  TRC20_BANDWIDTH,
  FALLBACK,
};
