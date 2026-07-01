/**
 * Merchant Pool Sweep Operations
 * 
 * Handles gas funding, sweep execution, and scheduled sweep orchestration.
 */

import {
  merchantTempAddressModel,
  merchantPoolSweepModel,
  merchantPoolTransactionModel,
  stablecoinConversionModel,
  GAS_TOKEN_MAPPING,
  ACCOUNT_CHAINS,
} from "../../models";
import { cronLogger } from "../../utils/loggers";
import tatumApi from "../../apis/tatumApi";
import { getErrorMessage, sendAdminFeeSweepEmail } from "../../helper";
import { sendPaymentReceivedEmail } from "../../helper/sendEmail";
import { normalizeLang } from "../../utils/emailI18n";
import { convertToUSD, convertToFiat, getCompanyBaseCurrency } from "../../utils/currencyUtils";
import { getRedisItem, setRedisItem, setRedisTTL, setRedisItemWithTTL } from "../../utils/redisInstance";
import {
  getAccountResources,
  calculateDynamicTRC20Fee,
  logCostSavings,
  TRC20_ENERGY,
} from "../tronEnergyService";
import {
  POOL_CONFIG,
  UTXO_CHAINS,
  TOKEN_CHAINS,
  FEE_WALLETS,
  ADMIN_WALLETS,
  getSweepConfig,
  getMinSweepUSD,
  withRetry,
  Op,
} from "./merchantPoolConfig";
import { directEvmSweep, isDirectEvmSupported } from "./directEvmTransfer";
import sequelize from "../../utils/dbInstance";

/**
 * Smart Gas Funding for account-based chains (ETH, TRX)
 */
export const fundGasIfNeeded = async (
  poolAddress: { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> },
  walletType: string,
  transferAmount?: number,
  recipientAddress?: string
): Promise<{ funded: boolean; amount: number; txId?: string; reason?: string }> => {
  if (UTXO_CHAINS.includes(walletType)) {
    return { funded: false, amount: 0, reason: 'UTXO chain - no gas needed' };
  }

  const gasToken = GAS_TOKEN_MAPPING[walletType];
  if (!gasToken) {
    return { funded: false, amount: 0, reason: 'No gas token mapping' };
  }

  const feeWalletAddress = FEE_WALLETS[gasToken];
  if (!feeWalletAddress) {
    cronLogger.warn(`[SmartGas] No fee wallet configured for ${gasToken}`);
    return { funded: false, amount: 0, reason: 'No fee wallet configured' };
  }

  try {
    const tempAddress = poolAddress.dataValues.wallet_address;
    
    let balanceResult;
    try {
      // skipCache=true for SmartGas — must have real-time gas balance for funding decisions
      balanceResult = await tatumApi.getAddressBalance(tempAddress, gasToken, true);
    } catch (balanceError: unknown) {
      const balErr = balanceError as { message?: string };
      if ((balErr.message || '').includes('account.not.found') || (balErr.message || '').includes('not.found')) {
        cronLogger.info(`[SmartGas] Account not yet activated on-chain: ${tempAddress}, assuming 0 balance`);
        balanceResult = { balance: '0' };
      } else {
        throw balanceError;
      }
    }
    let currentBalance = Number(balanceResult?.balance ?? 0);
    
    // NOTE: getAddressBalance() already converts SUN→TRX for TRX currency.
    // Do NOT divide by 1,000,000 again — that was causing double-division,
    // making balances appear 1M× smaller and triggering unnecessary gas funding.

    cronLogger.info(`[SmartGas] Current balance: ${currentBalance} ${gasToken} in ${tempAddress}`);

    let estimatedGas = 0;
    
    // === Energy-Aware Optimization for TRC20 ===
    // Check if the address has staked Energy that covers the transfer
    if (gasToken === "TRX" && (walletType === 'USDT-TRC20')) {
      try {
        const accountResources = await getAccountResources(tempAddress);
        if (accountResources.hasSufficientEnergy) {
          cronLogger.info(
            `[SmartGas] ⚡ ENERGY OPTIMIZATION: ${tempAddress} has ${accountResources.availableEnergy} Energy ` +
            `(need ${TRC20_ENERGY.EXISTING_RECIPIENT}) — staked Energy covers transfer!`
          );
          logCostSavings("SmartGas-EnergySkip", POOL_CONFIG.TRX_GAS_FALLBACK, 0, {
            availableEnergy: accountResources.availableEnergy,
            address: tempAddress,
          });
          // Only need a tiny amount for bandwidth (if not covered by free bandwidth)
          if (accountResources.availableBandwidth >= 345) {
            // Both Energy and Bandwidth covered — no TRX needed!
            cronLogger.info(`[SmartGas] ✅ Full Energy+Bandwidth coverage — zero gas funding needed`);
            await poolAddress.update({ gas_balance: currentBalance });
            return { funded: false, amount: 0, reason: 'Staked Energy+Bandwidth covers transfer' };
          }
          // Only need bandwidth cost (~0.345 TRX)
          estimatedGas = 0.5;
          cronLogger.info(`[SmartGas] 📊 Energy covered, only bandwidth cost needed: ~${estimatedGas} TRX`);
        } else {
          cronLogger.info(
            `[SmartGas] 📊 Energy check: ${accountResources.availableEnergy} available ` +
            `(need ${TRC20_ENERGY.EXISTING_RECIPIENT}) — will use dynamic fee estimation`
          );
        }
      } catch (resourceError) {
        cronLogger.warn(`[SmartGas] ⚠️ Energy check failed: ${getErrorMessage(resourceError)}, proceeding with fee estimation`);
      }
    }

    // Standard fee estimation (skipped if Energy optimization already set estimatedGas)
    if (estimatedGas === 0) {
      try {
        // FIX: Use energy-aware tronEnergyService for TRC20 tokens instead of
        // tatumApi.feeEstimation() which returns stale/underestimated values.
        // This prevents OUT_OF_ENERGY failures on TRON.
        if (gasToken === "TRX" && TOKEN_CHAINS.includes(walletType) && walletType.includes("TRC20")) {
          // FIX (2026-04-07 v2): Restored activation-aware estimation after fixing root cause.
          // Root cause was stale Redis cache (24h TTL) — merchant zeroed USDT balance but cache
          // still said "activated=true". Cache TTL now reduced to 5min in tronEnergyService.
          // 
          // Activated recipient: ~65k energy → ~7.8 TRX (actual ~6.43)
          // New/zeroed recipient: ~130k energy → ~15.6 TRX (actual ~13.03)
          const trc20Contract = walletType === 'USDT-TRC20'
            ? (process.env.TRX_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')
            : undefined;
          const dynamicFee = await calculateDynamicTRC20Fee(tempAddress, recipientAddress, trc20Contract);
          estimatedGas = dynamicFee.fast;
          cronLogger.info(`[SmartGas] 🔋 TRC20 energy-aware gas: ${estimatedGas} TRX (energy: ${dynamicFee.energyNeeded} needed [${dynamicFee.isNewRecipient ? 'NEW' : 'ACTIVATED'}], ${dynamicFee.energyAvailable} available, price: ${dynamicFee.energyPrice} SUN/unit)`);
        } else {
          let contractAddress: string | undefined;
          if (walletType === 'USDT-ERC20') {
            contractAddress = process.env.ETH_CONTRACT;
          } else if (walletType === 'USDC-ERC20') {
            contractAddress = process.env.USDC_CONTRACT;
          } else if (walletType === 'USDT-POLYGON') {
            contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
          } else if (walletType === 'RLUSD-ERC20') {
            contractAddress = process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD";
          }
          
          const estimationRecipient = recipientAddress || feeWalletAddress;
          const estimationAmount = transferAmount || 100;
          
          const feeEstimate = await tatumApi.feeEstimation(
            walletType,
            tempAddress,
            estimationRecipient,
            estimationAmount,
            contractAddress
          );
          
          if (gasToken === "ETH") {
            estimatedGas = Number(feeEstimate?.fast ?? feeEstimate?.medium ?? feeEstimate?.slow ?? 0);
          } else if (gasToken === "TRX") {
            estimatedGas = Number(feeEstimate?.fast ?? feeEstimate?.medium ?? 5);
          } else if (gasToken === "XRP") {
            estimatedGas = Number(feeEstimate?.fast ?? 0.00005);
          } else if (gasToken === "POLYGON") {
            estimatedGas = Number(feeEstimate?.fast ?? feeEstimate?.medium ?? 0.01);
          }
        }
        
        cronLogger.info(`[SmartGas] Estimated gas for ${walletType} transfer: ${estimatedGas} ${gasToken}`);
        
      } catch (estimationError) {
        cronLogger.warn(`[SmartGas] Gas estimation failed, using fallback:`, getErrorMessage(estimationError));
        estimatedGas = gasToken === "TRX" ? POOL_CONFIG.TRX_GAS_FALLBACK 
          : gasToken === "XRP" ? POOL_CONFIG.XRP_GAS_FALLBACK
          : gasToken === "POLYGON" ? POOL_CONFIG.POLYGON_GAS_FALLBACK
          : POOL_CONFIG.ETH_GAS_FALLBACK;
      }
    }

    const requiredGas = estimatedGas * POOL_CONFIG.GAS_SAFETY_BUFFER;
    
    cronLogger.info(`[SmartGas] Required gas with ${((POOL_CONFIG.GAS_SAFETY_BUFFER - 1) * 100).toFixed(0)}% buffer: ${requiredGas.toFixed(6)} ${gasToken}`);

    const deficit = requiredGas - currentBalance;
    const minDeficit = gasToken === "TRX" ? POOL_CONFIG.TRX_MIN_DEFICIT 
      : gasToken === "XRP" ? POOL_CONFIG.XRP_MIN_DEFICIT
      : gasToken === "POLYGON" ? POOL_CONFIG.POLYGON_MIN_DEFICIT
      : POOL_CONFIG.ETH_MIN_DEFICIT;

    // Primary check: does the address actually have enough gas?
    // FIX (2026-04-10): Removed the minDeficit bypass that could skip funding when
    // currentBalance < requiredGas. Previously, if deficit was small (e.g., 0.000098 ETH
    // < minDeficit 0.0002 ETH), SmartGas would skip funding even though the balance was
    // genuinely insufficient → "Insufficient funds" error on settlement.
    // Now ONLY skip when balance actually covers the required gas. The minDeficit is still
    // used below for minimum funding amount (preventing micro-transactions).
    if (currentBalance >= requiredGas) {
      cronLogger.info(`[SmartGas] ✅ Sufficient gas (have: ${currentBalance.toFixed(6)}, need: ${requiredGas.toFixed(6)}) - No funding needed`);
      await poolAddress.update({ gas_balance: currentBalance });
      return { funded: false, amount: 0, reason: 'Sufficient balance' };
    }

    cronLogger.info(`[SmartGas] 📊 Gas deficit: ${deficit.toFixed(6)} ${gasToken} (have: ${currentBalance.toFixed(6)}, need: ${requiredGas.toFixed(6)})`);

    // Fund only the deficit (what's actually missing), with a minimum floor to avoid micro-transactions.
    // BUG FIX (2026-04-06): Previously included `requiredGas` in Math.max, which caused funding the
    // FULL gas requirement even when the address already had partial balance (e.g., funding 9.96 TRX
    // when only 2.39 TRX deficit existed, wasting 7.57 TRX per sweep cycle).
    const fundAmount = Math.max(deficit, gasToken === "TRX" ? POOL_CONFIG.TRX_MIN_DEFICIT 
      : gasToken === "XRP" ? POOL_CONFIG.XRP_MIN_DEFICIT
      : gasToken === "POLYGON" ? POOL_CONFIG.POLYGON_MIN_DEFICIT
      : POOL_CONFIG.ETH_MIN_DEFICIT);
    const { adminFeeModel } = await import("../../models");
    const feeWallet = await adminFeeModel.findOne({
      where: { wallet_type: gasToken },
    });

    if (!feeWallet) {
      throw new Error(`Fee wallet not found for ${gasToken}`);
    }

    const feeWalletPrivateKey = await tatumApi.decryptSymmetric(
      feeWallet.dataValues.privateKey,
      process.env.TEMP_KEY_ID
    );

    cronLogger.info(`[SmartGas] 🔥 Funding ${fundAmount.toFixed(6)} ${gasToken} to ${tempAddress}`);

    let txId: string | undefined;

    if (isDirectEvmSupported(gasToken)) {
      // EVM gas funding: use directEvmSweep (ethers.js) to avoid Tatum SDK ghost TX issue
      cronLogger.info(`[SmartGas] Using direct EVM transfer for ${gasToken} gas funding`);
      const evmResult = await directEvmSweep({
        fromAddress: feeWalletAddress,
        toAddress: tempAddress,
        privateKey: feeWalletPrivateKey,
        walletType: gasToken,
        amount: fundAmount,
      });
      txId = evmResult.txHash;
      cronLogger.info(`[SmartGas] ✅ Direct EVM gas funding: ${txId} (gas: ${evmResult.gasPriceGwei} Gwei)`);
    } else {
      // Non-EVM gas funding (TRX, XRP): continue using Tatum SDK
      const txResult = await tatumApi.assetToOtherAddress({
        currency: gasToken,
        fromAddress: feeWalletAddress,
        toAddress: tempAddress,
        privateKey: feeWalletPrivateKey,
        amount: fundAmount,
        fee: null,
      });
      txId = txResult?.txId;
    }

    const newBalance = currentBalance + fundAmount;
    await poolAddress.update({ gas_balance: newBalance });

    cronLogger.info(`[SmartGas] ✅ Gas funded: ${fundAmount.toFixed(6)} ${gasToken} (TX: ${txId})`);
    cronLogger.info(`[SmartGas]    Old balance: ${currentBalance.toFixed(6)} → New balance: ${newBalance.toFixed(6)} ${gasToken}`);

    return { funded: true, amount: fundAmount, txId: txId, reason: 'Deficit funded' };
    
  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.error(`[SmartGas] ❌ Gas funding failed:`, message);
    return { funded: false, amount: 0, reason: `Error: ${message}` };
  }
};

/**
 * Reclaim excess gas (TRX/ETH) from a pool address back to the fee wallet.
 * Called after settlement completes — the pool address often has leftover gas
 * that wasn't burned by the on-chain transaction.
 * 
 * FIX (2026-04-02): Previously, excess gas was stranded on pool addresses forever.
 * Now we sweep it back to the fee wallet to reduce operational costs.
 */
export const reclaimExcessGas = async (
  poolAddress: string,
  walletType: string,
  minReclaimThreshold?: number
): Promise<{ reclaimed: boolean; amount: number; txId?: string }> => {
  const gasToken = GAS_TOKEN_MAPPING[walletType];
  if (!gasToken) {
    return { reclaimed: false, amount: 0 };
  }

  const feeWalletAddress = FEE_WALLETS[gasToken];
  if (!feeWalletAddress) {
    return { reclaimed: false, amount: 0 };
  }

  // Default thresholds: only reclaim if there's meaningful excess
  const threshold = minReclaimThreshold ?? (gasToken === "TRX" ? 2 : gasToken === "ETH" ? 0.0005 : 0.01);

  try {
    // skipCache=true for gas reclaim — needs real-time balance
    const balanceResult = await tatumApi.getAddressBalance(poolAddress, gasToken, true).catch(() => null);
    const currentBalance = Number(balanceResult?.balance ?? 0);

    if (currentBalance <= threshold) {
      cronLogger.info(`[GasReclaim] ${poolAddress.substring(0, 12)}... has ${currentBalance.toFixed(4)} ${gasToken} — below threshold (${threshold}), skipping`);
      return { reclaimed: false, amount: 0 };
    }

    // Leave a small dust amount to keep the address activated
    const dustReserve = gasToken === "TRX" ? 1.1 : gasToken === "ETH" ? 0.0001 : 0.001;
    const reclaimAmount = Math.floor((currentBalance - dustReserve) * 1e6) / 1e6; // Floor to 6 decimals

    if (reclaimAmount <= 0) {
      return { reclaimed: false, amount: 0 };
    }

    // Get the private key for the pool address from DB
    const { merchantTempAddressModel } = await import("../../models");
    const poolRecord = await merchantTempAddressModel.findOne({
      where: { wallet_address: poolAddress },
    });

    if (!poolRecord?.dataValues?.privateKey) {
      cronLogger.warn(`[GasReclaim] No private key found for ${poolAddress.substring(0, 12)}...`);
      return { reclaimed: false, amount: 0 };
    }

    const privateKey = await tatumApi.decryptSymmetric(
      poolRecord.dataValues.privateKey,
      process.env.TEMP_KEY_ID
    );

    cronLogger.info(`[GasReclaim] ♻️ Reclaiming ${reclaimAmount.toFixed(4)} ${gasToken} from ${poolAddress.substring(0, 12)}... → fee wallet`);

    let txId: string | undefined;

    if (isDirectEvmSupported(gasToken)) {
      const evmResult = await directEvmSweep({
        fromAddress: poolAddress,
        toAddress: feeWalletAddress,
        privateKey,
        walletType: gasToken,
        amount: reclaimAmount,
      });
      txId = evmResult.txHash;
    } else {
      const txResult = await tatumApi.assetToOtherAddress({
        currency: gasToken,
        fromAddress: poolAddress,
        toAddress: feeWalletAddress,
        privateKey,
        amount: reclaimAmount,
        fee: null,
      });
      txId = txResult?.txId;
    }

    cronLogger.info(`[GasReclaim] ✅ Reclaimed ${reclaimAmount.toFixed(4)} ${gasToken} (TX: ${txId})`);
    return { reclaimed: true, amount: reclaimAmount, txId };

  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.warn(`[GasReclaim] ⚠️ Reclaim failed for ${poolAddress.substring(0, 12)}...: ${message}`);
    return { reclaimed: false, amount: 0 };
  }
};

/**
 * Check if sweep is profitable
 */
interface ProfitabilityResult {
  profitable: boolean;
  balanceUSD?: number;
  feeUSD?: number;
  estimatedFee?: number;
  profitMargin?: number;
}

const checkSweepProfitability = async (
  walletType: string,
  balance: number,
  feeData: { fixedFee: number; transactionFee: number; totalDeduction: number; gasPrice?: string; gasLimit?: string; fee?: string; slow?: string; fast?: string | number } | number
): Promise<ProfitabilityResult> => {
  try {
    // Extract estimated gas fee from feeData (in gas token units: TRX or ETH)
    let estimatedFee = 0;
    if (typeof feeData === "number") {
      estimatedFee = feeData;
    } else if (feeData?.fast) {
      // Preferred: 'fast' is already in gas token units (TRX for TRC20, ETH for ERC20)
      estimatedFee = parseFloat(String(feeData.fast));
    } else if (feeData?.gasPrice && feeData?.gasLimit) {
      // Fallback: gasPrice is in Gwei, gasLimit is unitless → result in ETH
      estimatedFee = (parseFloat(feeData.gasPrice) * parseInt(feeData.gasLimit)) / 1e9;
    } else if (feeData?.fee) {
      estimatedFee = parseFloat(feeData.fee);
    } else if (feeData?.slow) {
      estimatedFee = parseFloat(feeData.slow);
    }
    
    let balanceUSD = 0;
    let feeUSD = 0;
    
    // Gas fees are in the gas token (TRX/ETH), not the token itself (USDT/USDC)
    // Use GAS_TOKEN_MAPPING to get the correct currency for fee→USD conversion
    const feeCurrency = GAS_TOKEN_MAPPING[walletType] || walletType;
    
    try {
      balanceUSD = await convertToUSD(walletType, balance);
      feeUSD = await convertToUSD(feeCurrency, estimatedFee);
    } catch (convError) {
      cronLogger.warn(`[MerchantPool] Could not convert to USD for profitability check:`, convError);
      return { profitable: true, estimatedFee };
    }
    
    cronLogger.info(`[MerchantPool] Profitability: ${walletType} balance=$${balanceUSD.toFixed(2)}, gas fee=${estimatedFee} ${feeCurrency} ($${feeUSD.toFixed(2)})`);
    
    const PROFITABILITY_THRESHOLD = 0.5;
    const profitable = feeUSD < (balanceUSD * PROFITABILITY_THRESHOLD);
    const profitMargin = balanceUSD > 0 ? ((balanceUSD - feeUSD) / balanceUSD) * 100 : 0;
    
    return { profitable, balanceUSD, feeUSD, estimatedFee, profitMargin };
  } catch (error) {
    cronLogger.error(`[MerchantPool] Profitability check error:`, error);
    return { profitable: true };
  }
};

/**
 * Sweep admin fees from pool address to admin wallet
 */
export const sweepPoolAddress = async (tempAddressId: number): Promise<unknown> => {
  let dbTransaction;
  
  try {
    dbTransaction = await sequelize.transaction();
    
    const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
    });

    if (!poolAddress) {
      throw new Error(`Pool address not found: ${tempAddressId}`);
    }

    const status = poolAddress.dataValues.status;
    const adminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance || "0");
    
    if (status !== "IN_USE" && status !== "AVAILABLE" && status !== "PRE_RESERVED") {
      throw new Error(`Cannot sweep address in ${status} status. Only IN_USE, AVAILABLE, or PRE_RESERVED addresses can be swept.`);
    }
    
    // If still AVAILABLE or PRE_RESERVED (e.g., direct call without pre-transition), claim it for sweep
    if (status === "AVAILABLE" || status === "PRE_RESERVED") {
      await poolAddress.update({ status: "IN_USE" }, { transaction: dbTransaction });
    }
    
    if (adminBalance <= 0) {
      cronLogger.info(`[MerchantPool] No admin fee to sweep for address ${tempAddressId}`);
      await poolAddress.update({ status: "AVAILABLE" }, { transaction: dbTransaction });
      await dbTransaction.commit();
      return { success: true, amount: 0, message: "No admin fee balance" };
    }

    // ─── DEFERRAL CHECK: Skip addresses that have been deferred due to repeated unprofitable sweeps ───
    // Deferral expires after DEFERRAL_HOURS (7 days), then the address is retried normally.
    const deferKey = `sweep:unprofitable:${tempAddressId}`;
    try {
      const deferData = await getRedisItem(deferKey) as { count: number; deferredUntil?: string } | null;
      if (deferData?.deferredUntil && new Date(deferData.deferredUntil) > new Date()) {
        cronLogger.info(`[MerchantPool] ⏸️ Sweep deferred until ${deferData.deferredUntil} for address ${tempAddressId} (${deferData.count} unprofitable attempts)`);
        await poolAddress.update({ status: "AVAILABLE" }, { transaction: dbTransaction });
        await dbTransaction.commit();
        return { success: false, skipped: true, reason: `Deferred until ${deferData.deferredUntil}` };
      }
    } catch (_e) { /* Non-critical — proceed with sweep attempt */ }

    const walletType = poolAddress.dataValues.wallet_type;
    const adminWallet = ADMIN_WALLETS[walletType];
    
    if (!adminWallet) {
      throw new Error(`No admin wallet configured for ${walletType}`);
    }

    await poolAddress.update({ status: "SWEEPING" }, { transaction: dbTransaction });
    await dbTransaction.commit();
    dbTransaction = null;

    cronLogger.info(`[MerchantPool] 🧹 Starting sweep for ${poolAddress.dataValues.wallet_address}`);
    
    let balanceData;
    try {
      // skipCache=true for sweep execution — must know actual balance before moving funds
      balanceData = await tatumApi.getAddressBalance(
        poolAddress.dataValues.wallet_address,
        walletType,
        true
      );
    } catch (balanceError: unknown) {
      const balErr = balanceError as { message?: string };
      if ((balErr.message || '').includes('account.not.found') || (balErr.message || '').includes('not.found')) {
        cronLogger.info(`[MerchantPool] ⏭️ Sweep skipped - account not yet activated on-chain: ${poolAddress.dataValues.wallet_address}`);
        return { success: true, amount: 0, message: "Account not activated on-chain" };
      }
      throw balanceError;
    }
    // UTXO chains (BTC, LTC, DOGE, BCH) return {incoming, outgoing} not {balance}
    // Account-based chains (ETH, TRX, XRP, SOL, POLYGON) return {balance}
    let actualBalance: number;
    if (balanceData?.incoming !== undefined && balanceData?.outgoing !== undefined) {
      actualBalance = parseFloat(balanceData.incoming || "0") - parseFloat(balanceData.outgoing || "0");
      // Round to 8 decimal places to avoid floating point precision issues
      actualBalance = Math.round(actualBalance * 100000000) / 100000000;
      cronLogger.info(`[MerchantPool] UTXO balance: incoming=${balanceData.incoming}, outgoing=${balanceData.outgoing}, net=${actualBalance}`);
    } else {
      actualBalance = parseFloat(balanceData?.balance || "0");
    }

    if (actualBalance <= 0) {
      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
        last_swept_at: new Date(),
      });
      return { success: true, amount: 0, message: "No balance to sweep" };
    }

    const isToken = TOKEN_CHAINS.includes(walletType);

    // === PROFITABILITY CHECK FIRST — before funding gas ===
    // This prevents wasting gas (TRX/ETH) on sweeps that turn out to be unprofitable.
    // Previously, gas was funded BEFORE profitability check, silently draining fee wallets.
    const feeData = await tatumApi.feeEstimation(
      walletType,
      poolAddress.dataValues.wallet_address,
      adminWallet,
      actualBalance.toString()
    );

    const profitabilityResult = await checkSweepProfitability(walletType, actualBalance, feeData);
    
    if (!profitabilityResult.profitable) {
      cronLogger.warn(`[MerchantPool] ⚠️ Sweep not profitable for ${poolAddress.dataValues.wallet_address}`);
      cronLogger.warn(`[MerchantPool]    Balance: ${actualBalance} ${walletType} ($${profitabilityResult.balanceUSD?.toFixed(2)})`);
      cronLogger.warn(`[MerchantPool]    Est. Fee: ${profitabilityResult.estimatedFee} ${walletType} ($${profitabilityResult.feeUSD?.toFixed(2)})`);
      
      // ─── DUST SWEEP DEFERRAL: Track consecutive unprofitable sweeps ───
      // ERC20 dust < $0.10: permanent write-off immediately (gas always >> balance).
      // Other chains: after MAX_UNPROFITABLE_SWEEPS failures, defer for DEFERRAL_HOURS.
      const ERC20_CHAINS = ["USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20"];
      const isERC20 = ERC20_CHAINS.includes(walletType);
      const balUSD = profitabilityResult.balanceUSD || 0;
      
      // ERC20 immediate write-off for dust < $0.10
      if (isERC20 && balUSD < 0.10) {
        cronLogger.warn(`[MerchantPool] 🗑️ ERC20 WRITE-OFF: ${poolAddress.dataValues.wallet_address} — $${balUSD.toFixed(4)} permanently written off (gas always >> balance)`);
        await poolAddress.update({ 
          status: "AVAILABLE", 
          admin_fee_balance: 0,
          last_swept_at: new Date(),
        });
        return {
          success: true,
          skipped: false,
          reason: `ERC20 dust written off ($${balUSD.toFixed(4)})`,
          balanceUSD: balUSD,
          feeUSD: profitabilityResult.feeUSD,
          dustWriteOff: true,
        };
      }
      
      // Non-ERC20: track failures and defer after threshold
      const MAX_UNPROFITABLE_SWEEPS = 5;
      const DEFERRAL_HOURS = 168; // 7 days
      const failCountKey = `sweep:unprofitable:${tempAddressId}`;
      
      let failCount = 1;
      try {
        const existing = await getRedisItem(failCountKey) as { count: number; deferredUntil?: string } | null;
        failCount = (existing?.count || 0) + 1;
        
        if (failCount >= MAX_UNPROFITABLE_SWEEPS) {
          // Defer: stop retrying for DEFERRAL_HOURS, then the counter resets and sweeping resumes
          const deferUntil = new Date(Date.now() + DEFERRAL_HOURS * 3600000).toISOString();
          await setRedisItemWithTTL(failCountKey, { count: failCount, deferredUntil: deferUntil }, DEFERRAL_HOURS * 3600);
          cronLogger.warn(`[MerchantPool] ⏸️ SWEEP DEFERRED: ${poolAddress.dataValues.wallet_address} — $${(profitabilityResult.balanceUSD || 0).toFixed(2)} deferred after ${failCount} consecutive unprofitable sweeps. Will retry after ${deferUntil}`);
          
          // Keep admin_fee_balance intact (on-chain funds preserved), just release the lock
          await poolAddress.update({ status: "AVAILABLE" });
          return {
            success: false,
            skipped: true,
            reason: `Deferred for ${DEFERRAL_HOURS}h after ${failCount} unprofitable attempts`,
            balanceUSD: profitabilityResult.balanceUSD,
            feeUSD: profitabilityResult.feeUSD,
            deferredUntil: deferUntil,
          };
        }
        
        await setRedisItemWithTTL(failCountKey, { count: failCount, lastAttempt: new Date().toISOString() }, 86400 * 7);
      } catch (_e) { /* Non-critical */ }
      
      cronLogger.warn(`[MerchantPool]    Skipping sweep — NO gas funded (profitability-first, fail ${failCount}/${MAX_UNPROFITABLE_SWEEPS})`);
      
      // Return to AVAILABLE so address remains visible to reservation pipeline
      await poolAddress.update({ status: "AVAILABLE" });
      
      return { 
        success: false, 
        skipped: true, 
        reason: "Not profitable",
        balanceUSD: profitabilityResult.balanceUSD,
        feeUSD: profitabilityResult.feeUSD
      };
    }
    
    // Reset unprofitable sweep counter on success
    try { 
      const failCountKey = `sweep:unprofitable:${tempAddressId}`;
      await setRedisItemWithTTL(failCountKey, { count: 0 }, 3600); 
    } catch (_e) { /* Non-critical */ }
    
    cronLogger.info(`[MerchantPool] ✅ Sweep is profitable: $${profitabilityResult.balanceUSD?.toFixed(2)} balance vs $${profitabilityResult.feeUSD?.toFixed(2)} fee`);

    // === GAS FUNDING — only after profitability confirmed ===
    let gasFunding: { funded: boolean; amount: number; txId: string | null } = { funded: false, amount: 0, txId: null };
    
    if (isToken) {
      const adminWalletForGas = ADMIN_WALLETS[walletType];
      const fundResult = await fundGasIfNeeded(poolAddress as unknown as { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> }, walletType, actualBalance, adminWalletForGas);
      gasFunding = { ...fundResult, txId: fundResult.txId || null };

      // Wait for gas funding TX confirmation before attempting the sweep transfer
      if (gasFunding.funded && gasFunding.txId) {
        const gasToken = GAS_TOKEN_MAPPING[walletType] || 'TRX';
        cronLogger.info(`[MerchantPool] ⏳ Waiting for gas funding TX ${gasFunding.txId} confirmation (${gasToken})...`);
        const gasConfirmation = await tatumApi.waitForTransactionConfirmation(
          gasFunding.txId,
          gasToken,
          30000  // 30s timeout
        );
        if (gasConfirmation.confirmed) {
          cronLogger.info(`[MerchantPool] ✅ Gas funding confirmed in block ${gasConfirmation.blockNumber}`);
        } else {
          cronLogger.warn(`[MerchantPool] ⚠️ Gas funding TX not confirmed in timeout — proceeding with retry logic`);
        }
      }
    } else {
      cronLogger.info(`[MerchantPool] Native ${walletType} - gas comes from remaining balance, no external funding needed`);
    }

    const privateKey = await tatumApi.decryptSymmetric(
      poolAddress.dataValues.private_key,
      process.env.TEMP_KEY_ID
    );

    const isAccountChain = ACCOUNT_CHAINS.includes(walletType);
    const isUTXOChain = ["BTC", "LTC", "DOGE", "BCH"].includes(walletType);
    let amountToSend = actualBalance;
    
    if (isUTXOChain) {
      // UTXO chains: fee is separate from amount but must fit within total balance
      // amountToSend + fee = actualBalance → amountToSend = actualBalance - fee
      const utxoFee = typeof feeData === 'object' && feeData !== null
        ? parseFloat(feeData.slow || feeData.medium || feeData.fast || "0.00005")
        : parseFloat(feeData || "0.00005");
      amountToSend = actualBalance - utxoFee;
      // Round down to 8 decimal places (UTXO precision)
      amountToSend = Math.floor(amountToSend * 100000000) / 100000000;
      
      if (amountToSend <= 0) {
        cronLogger.warn(`[MerchantPool] ⚠️ UTXO balance too low after fee: ${actualBalance} - ${utxoFee} = ${amountToSend}`);
        await poolAddress.update({ status: "AVAILABLE" });
        return { success: false, skipped: true, reason: "Balance too low after UTXO fee" };
      }
      cronLogger.info(`[MerchantPool] UTXO chain sweep: ${actualBalance} - ${utxoFee} (fee) = ${amountToSend} ${walletType}`);
    } else if (isAccountChain) {
      const gasFee = parseFloat(feeData?.slow || feeData?.fast || "0");
      
      // XRP Ledger reserves (updated Dec 2, 2024 — validator vote reduced reserves 10x):
      //   Base reserve: 1 XRP per account (was 10 XRP)
      //   Owner reserve: 0.2 XRP per owned object/trust line (was 2 XRP)
      // See: https://xrpl.org/blog/2024/lower-reserves-are-in-effect
      //
      // IMPORTANT: The pool address may have trust lines (e.g., RLUSD), so we query
      // the XRP Ledger directly to get OwnerCount and compute exact reserve.
      let accountReserve = 0;
      if (walletType === 'XRP' || walletType === 'RLUSD') {
        // Default reserves (post Dec 2024)
        const BASE_RESERVE = 1;     // 1 XRP per account
        const OWNER_RESERVE = 0.2;  // 0.2 XRP per trust line/object
        
        try {
          const axios = require('axios');
          const xrplRes = await axios.post('https://s1.ripple.com:51234', {
            method: 'account_info',
            params: [{ account: poolAddress.dataValues.wallet_address, ledger_index: 'validated' }]
          }, { timeout: 10000 });
          
          const accountData = xrplRes.data?.result?.account_data;
          const ownerCount = accountData?.OwnerCount || 0;
          
          // Use on-chain balance (drops → XRP) instead of Tatum API for accuracy
          const onChainBalance = parseInt(accountData?.Balance || '0') / 1000000;
          if (onChainBalance > 0 && Math.abs(onChainBalance - actualBalance) > 0.001) {
            cronLogger.info(`[MerchantPool] Balance correction: Tatum=${actualBalance}, on-chain=${onChainBalance} XRP`);
            actualBalance = onChainBalance;
          }
          
          accountReserve = BASE_RESERVE + (OWNER_RESERVE * ownerCount);
          cronLogger.info(`[MerchantPool] XRP reserve: ${BASE_RESERVE} base + ${OWNER_RESERVE} × ${ownerCount} objects = ${accountReserve} XRP`);
        } catch (xrplErr) {
          // Fallback: assume 1 trust line (RLUSD) = 1.2 XRP total reserve
          accountReserve = 1.2;
          cronLogger.warn(`[MerchantPool] ⚠️ XRPL account_info failed, using fallback reserve ${accountReserve} XRP:`, xrplErr);
        }
      } else if (walletType === 'SOL') {
        // SOL requires a minimum rent-exempt balance (~0.00089088 SOL for a basic account).
        // If we drain below this, the Solana runtime rejects the TX with 403 "Failed creating transaction".
        // We close the account by sending ALL lamports (which returns rent to the recipient),
        // but only if Tatum SDK supports it. Otherwise, reserve rent + a safety buffer.
        const SOL_RENT_EXEMPT_MINIMUM = 0.001; // ~890880 lamports + safety buffer
        const SOL_TX_FEE = 0.000005; // 5000 lamports per signature
        accountReserve = SOL_RENT_EXEMPT_MINIMUM + SOL_TX_FEE;
        cronLogger.info(`[MerchantPool] SOL reserve: ${accountReserve} SOL (rent-exempt ${SOL_RENT_EXEMPT_MINIMUM} + tx fee ${SOL_TX_FEE})`);
      }
      
      amountToSend = actualBalance - gasFee - accountReserve;
      
      // Safety buffer: round down to 6 decimal places to avoid edge cases
      // from balance timing differences between API reads and on-chain state
      amountToSend = Math.floor(amountToSend * 1000000) / 1000000;
      
      if (amountToSend <= 0) {
        const reserveNote = accountReserve > 0 ? ` + ${accountReserve} reserve` : '';
        cronLogger.warn(`[MerchantPool] ⚠️ Balance too low for sweep after deductions: ${actualBalance} - ${gasFee} (gas)${reserveNote} = ${amountToSend}`);
        await poolAddress.update({ status: "AVAILABLE" });
        return { success: false, skipped: true, reason: `Balance too low after gas${reserveNote} deduction` };
      }
      
      const reserveLog = accountReserve > 0 ? ` - ${accountReserve} (reserve)` : '';
      cronLogger.info(`[MerchantPool] Account chain sweep: ${actualBalance} - ${gasFee} (gas)${reserveLog} = ${amountToSend} ${walletType}`);
    }

    // Sweep strategy: Use direct ethers.js for EVM chains (ETH, POLYGON) to avoid
    // Tatum SDK ghost TX issue (SDK returns TX hash but never broadcasts to network).
    // For non-EVM chains (TRX, XRP, BTC, etc.), continue using Tatum SDK.
    let sweepTxId: string | undefined;

    if (isDirectEvmSupported(walletType)) {
      // DIRECT EVM SWEEP: ethers.js signs locally + broadcasts via eth_sendRawTransaction
      // The TX hash is real — sendTransaction() throws if the RPC node rejects the TX
      cronLogger.info(`[MerchantPool] Using direct EVM sweep for ${walletType}`);
      const evmResult = await withRetry(
        async () => {
          return await directEvmSweep({
            fromAddress: poolAddress.dataValues.wallet_address,
            toAddress: adminWallet,
            privateKey,
            walletType,
            amount: amountToSend,
          });
        },
        `Direct EVM sweep for ${poolAddress.dataValues.wallet_address}`,
        POOL_CONFIG.MAX_RETRIES,
        POOL_CONFIG.SWEEP_RETRY_DELAY_MS
      );
      sweepTxId = evmResult?.txHash;
      cronLogger.info(`[MerchantPool] ✅ Direct EVM sweep broadcast: ${sweepTxId} (nonce: ${evmResult?.nonce}, gas: ${evmResult?.gasPriceGwei} Gwei)`);
    } else {
      // NON-EVM CHAINS: Use Tatum SDK (proven reliable for TRX, XRP, BTC, LTC, DOGE, etc.)
      cronLogger.info(`[MerchantPool] Using Tatum SDK sweep for ${walletType}`);
      const sweepResult = await withRetry(
        async () => {
          const result = await tatumApi.assetToOtherAddress({
            currency: walletType,
            fromAddress: poolAddress.dataValues.wallet_address,
            toAddress: adminWallet,
            privateKey,
            amount: amountToSend.toString(),
            fee: feeData,
          });
          if (!result?.txId) {
            throw new Error("Sweep transaction failed - no txId returned");
          }
          return result;
        },
        `Sweep transfer for ${poolAddress.dataValues.wallet_address}`,
        POOL_CONFIG.MAX_RETRIES,
        POOL_CONFIG.SWEEP_RETRY_DELAY_MS
      );
      sweepTxId = sweepResult?.txId;
      cronLogger.info(`[MerchantPool] ✅ Tatum SDK sweep broadcast: ${sweepTxId}`);
    }

    if (!sweepTxId) {
      throw new Error("Sweep transaction failed - no txId/txHash returned");
    }

    // BUG-4 FIX: Mark sweep TX as outgoing to prevent Tatum webhook re-processing
    try {
      const { setRedisItemWithTTL } = require("../../utils/redisInstance");
      await setRedisItemWithTTL(`outgoing-tx-${sweepTxId}`, {
        type: "sweep",
        fromAddress: poolAddress.dataValues.wallet_address,
        toAddress: adminWallet,
        amount: amountToSend,
        currency: walletType,
        markedAt: new Date().toISOString(),
      }, 7200); // 2 hour TTL — single Redis call instead of SET + EXPIRE
      cronLogger.info(`[MerchantPool] Marked sweep TX ${sweepTxId} as outgoing`);
    } catch (markErr) {
      cronLogger.warn(`[MerchantPool] Failed to mark sweep TX as outgoing (non-critical):`, markErr);
    }

    // Fetch actual on-chain gas cost (TX is confirmed, so this should succeed)
    let actualGasUsed = isAccountChain ? (actualBalance - amountToSend) : 0;
    if (sweepTxId) {
      try {
        const gasCost = await tatumApi.getTransactionGasCost(sweepTxId, walletType);
        if (gasCost.gasCostNative > 0) {
          actualGasUsed = gasCost.gasCostNative;
          cronLogger.info(`[MerchantPool]    On-chain gas: ${actualGasUsed} ${gasCost.gasToken}`);
        }
      } catch (gasErr: unknown) {
        cronLogger.warn(`[MerchantPool]    Could not fetch on-chain gas cost, using estimate`);
      }
    }

    dbTransaction = await sequelize.transaction();
    
    try {
      await merchantPoolSweepModel.create({
        temp_address_id: tempAddressId,
        owner_user_id: poolAddress.dataValues.owner_user_id,
        wallet_type: walletType,
        amount_swept: amountToSend,
        gas_funded: gasFunding.amount || 0,
        gas_used: actualGasUsed,
        sweep_tx_id: sweepTxId,
        gas_funding_tx_id: gasFunding.txId || null,
        admin_wallet: adminWallet,
        status: "completed",
      }, { transaction: dbTransaction });

      await poolAddress.update({
        status: "AVAILABLE",
        admin_fee_balance: 0,
        gas_balance: 0,
        last_swept_at: new Date(),
      }, { transaction: dbTransaction });

      await dbTransaction.commit();
      dbTransaction = null;
      
      cronLogger.info(`[MerchantPool] 🎉 Sweep recorded: ${amountToSend} ${walletType} → admin wallet`);
      cronLogger.info(`[MerchantPool]    Status set to: AVAILABLE`);

      // Update stablecoin conversion record with sweep TX hash so Binance deposit detection can match
      try {
        const ownerUserId = poolAddress.dataValues.owner_user_id;
        // Map wallet type to source currency (ETH, BTC, TRX, etc.)
        const sourceCurrency = walletType.toUpperCase();
        if (ownerUserId) {
          const { Op } = require("sequelize");
          const [updatedCount] = await stablecoinConversionModel.update(
            { deposit_tx_hash: sweepTxId },
            { 
              where: { 
                user_id: ownerUserId,
                source_currency: sourceCurrency,
                status: "PENDING_DEPOSIT", 
                deposit_tx_hash: { [Op.or]: [null, ""] },
              } 
            }
          );
          if (updatedCount > 0) {
            cronLogger.info(`[MerchantPool]    Updated stablecoin conversion deposit_tx_hash: ${sweepTxId.substring(0, 16)}...`);
          }
        }
      } catch (convErr) {
        cronLogger.warn(`[MerchantPool]    Could not update conversion deposit_tx_hash:`, convErr instanceof Error ? convErr.message : convErr);
      }

      try {
        const subResult = await tatumApi.createSubscription(
          poolAddress.dataValues.wallet_address,
          walletType,
          true
        );
        if (subResult?.id) {
          await poolAddress.update({ subscription_id: subResult.id });
          cronLogger.info(`[MerchantPool]    Subscription renewed: ${subResult.id}`);
        }
      } catch (subError) {
        cronLogger.warn(`[MerchantPool]    ⚠️ Failed to renew subscription (will retry on next reserve)`);
      }

      // Send admin email notification for completed sweep
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const sweepConfig = getSweepConfig(walletType);
          const gasToken = GAS_TOKEN_MAPPING[walletType] || walletType;
          const gasDisplay = actualGasUsed > 0 ? `${actualGasUsed.toFixed(8)} ${gasToken}` : 'N/A (token transfer)';
          
          await sendAdminFeeSweepEmail(
            adminEmail,
            amountToSend.toFixed(8),
            walletType,
            poolAddress.dataValues.wallet_address,
            adminWallet,
            sweepTxId || 'N/A',
            gasDisplay,
            sweepConfig.mode
          );
          cronLogger.info(`[MerchantPool] 📧 Admin sweep notification sent: ${amountToSend} ${walletType} to ${adminEmail}`);
        }
      } catch (emailError) {
        cronLogger.error(`[MerchantPool] ⚠️ Admin sweep email failed (non-critical):`, emailError);
      }

      // ===== EMAIL RECOVERY (FIX) =====
      // When a payment was processed by another server instance (e.g. webhook URL pointed
      // to old server) or the email failed silently, the merchant never gets notified.
      // This is the LAST checkpoint before the address returns to the pool — recover
      // any missed payment notification emails here.
      try {
        const latestPoolTx = await merchantPoolTransactionModel.findOne({
          where: { temp_address_id: tempAddressId },
          order: [['created_at', 'DESC']],
        });

        if (latestPoolTx?.dataValues?.incoming_tx_id) {
          const incomingTxId = latestPoolTx.dataValues.incoming_tx_id;
          const ownerUserId = poolAddress.dataValues.owner_user_id;
          const merchantAmount = parseFloat(latestPoolTx.dataValues.merchant_amount || '0');
          const paymentAmount = merchantAmount + parseFloat(latestPoolTx.dataValues.admin_fee_amount || '0');

          // Check and recover "Payment Pending" notification
          const pendingKey = `pending-notif-${incomingTxId}`;
          const pendingSent = await getRedisItem(pendingKey);

          if (!pendingSent || !pendingSent.sent) {
            try {
              const { sendPendingPaymentNotification } = await import("../pendingPaymentService");
              await sendPendingPaymentNotification(
                poolAddress.dataValues.wallet_address,
                incomingTxId,
                paymentAmount,
                walletType,
                {
                  adm_id: ownerUserId,
                  company_id: latestPoolTx.dataValues.company_id,
                }
              );
              cronLogger.info(`[MerchantPool] 📧 [Sweep Recovery] Sent missed pending notification for ${poolAddress.dataValues.wallet_address}`);
            } catch (pendingErr: unknown) {
              cronLogger.warn(`[MerchantPool] ⚠️ [Sweep Recovery] Pending notification failed:`, getErrorMessage(pendingErr));
            }
          }

          // Check and recover "Payment Received" email
          const emailKey = `payment-received-email-${incomingTxId}`;
          const emailSent = await getRedisItem(emailKey);

          if (!emailSent || !emailSent.sent) {
            try {
              const { userModel, companyModel } = await import("../../models");
              const userData = (await userModel.findOne({ where: { user_id: ownerUserId } }))?.dataValues;
              const companyData = (await companyModel.findOne({ where: { user_id: ownerUserId } }))?.dataValues;

              if (userData?.email) {
                const txCreatedAt = new Date(latestPoolTx.dataValues.created_at);
                const dateStr = txCreatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const timeStr = txCreatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                // Issue #6: show fiat (merchant base currency) as primary, crypto as secondary
                let mrpAmount = merchantAmount.toString();
                let mrpCurrency = walletType;
                let mrpCryptoAmount: string | undefined;
                let mrpCryptoCurrency: string | undefined;
                try {
                  const baseCurrency = await getCompanyBaseCurrency(companyData?.company_id);
                  const usd = await convertToUSD(walletType, Number(merchantAmount));
                  if (usd && usd > 0 && !Number.isNaN(usd)) {
                    const fiat = baseCurrency === 'USD' ? usd : (await convertToFiat('USD', baseCurrency, usd)).amount;
                    if (fiat && fiat > 0 && !Number.isNaN(fiat)) {
                      mrpAmount = fiat.toFixed(2);
                      mrpCurrency = baseCurrency;
                      mrpCryptoAmount = Number(merchantAmount).toString();
                      mrpCryptoCurrency = walletType;
                    }
                  }
                } catch { /* fall back to crypto-primary */ }

                await sendPaymentReceivedEmail(
                  userData.email,
                  userData.name,
                  mrpAmount,
                  mrpCurrency,
                  companyData?.company_name || '',
                  incomingTxId,
                  dateStr,
                  timeStr,
                  normalizeLang((userData as { language?: string })?.language),
                  mrpCryptoAmount,
                  mrpCryptoCurrency
                );

                // Set dedup key so it won't be sent again
                await setRedisItem(emailKey, { sent: true, sentAt: new Date().toISOString(), recoveredBySweep: true });
                await setRedisTTL(emailKey, 2592000); // 30 day TTL (was 24h — caused false-positive duplicate emails)

                cronLogger.info(`[MerchantPool] 📧 [Sweep Recovery] Sent missed payment-received email to ${userData.email} for ${poolAddress.dataValues.wallet_address}`);
              }
            } catch (receivedErr: unknown) {
              cronLogger.warn(`[MerchantPool] ⚠️ [Sweep Recovery] Payment received email failed:`, getErrorMessage(receivedErr));
            }
          }
        }
      } catch (recoveryError: unknown) {
        cronLogger.warn(`[MerchantPool] ⚠️ Email recovery check failed (non-critical):`, getErrorMessage(recoveryError));
      }

      return { success: true, amount: amountToSend, txId: sweepTxId };
      
    } catch (dbError) {
      const message = getErrorMessage(dbError);
      cronLogger.error(`[MerchantPool] 🚨 CRITICAL: Sweep ${sweepTxId} succeeded but DB update failed: ${message}`);
      cronLogger.error(`[MerchantPool] 🚨 Manual intervention needed for address ${poolAddress.dataValues.wallet_address}`);
      cronLogger.error(`[MerchantPool] 🚨 Sweep details: ${actualBalance} ${walletType} sent to ${adminWallet}`);
      
      if (dbTransaction) {
        try { await dbTransaction.rollback(); } catch {}
      }
      
      try {
        await merchantTempAddressModel.update(
          { status: "AVAILABLE" },
          { where: { temp_address_id: tempAddressId } }
        );
      } catch {}
      
      return { 
        success: true, 
        amount: actualBalance, 
        txId: sweepTxId,
        warning: "DB update failed, manual verification needed",
        critical: true
      };
    }
    
  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.error(`[MerchantPool] ❌ Sweep failed:`, message);
    
    if (dbTransaction) {
      try { await dbTransaction.rollback(); } catch {}
    }
    
    try {
      await merchantTempAddressModel.update(
        { status: "AVAILABLE" },
        { where: { temp_address_id: tempAddressId } }
      );
    } catch {}
    
    throw error;
  }
};

/**
 * Retry-aware sweep helper — retries once on transient network errors (ETIMEDOUT, ECONNRESET).
 * Prevents single transient network failures from marking a sweep as permanently failed for this cycle.
 */
const sweepWithRetry = async (addrId: number, walletAddress: string): Promise<void> => {
  try {
    await sweepPoolAddress(addrId);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    const isTransient = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED'
      || (err.message || '').includes('ETIMEDOUT') || (err.message || '').includes('ECONNRESET')
      || (err.message || '').includes('timeout');
    
    if (isTransient) {
      cronLogger.warn(`[MerchantPool] ⚠️ Transient error sweeping ${walletAddress} (${err.code || 'timeout'}), retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      try {
        await sweepPoolAddress(addrId);
        cronLogger.info(`[MerchantPool] ✅ Sweep retry succeeded for ${walletAddress}`);
        return;
      } catch (retryError) {
        cronLogger.error(`[MerchantPool] ❌ Sweep retry also failed for ${walletAddress}:`, retryError);
        throw retryError;
      }
    }
    throw error; // Non-transient error — rethrow immediately
  }
};

/**
 * Sweep addresses by USD threshold
 * BUG FIX: Now checks BOTH 'AVAILABLE' AND 'IN_USE' addresses with admin_fee_balance > 0.
 * Previously only checked AVAILABLE, which caused token addresses (USDT-TRC20, USDT-ERC20, USDC-ERC20)
 * to be permanently stuck — releaseAddress sets tokens to IN_USE when they have admin fees,
 * but sweepByThreshold only checked AVAILABLE, creating a deadlock.
 */
export const sweepByThreshold = async (): Promise<number> => {
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: { [Op.in]: ["AVAILABLE", "IN_USE", "PRE_RESERVED"] },
      admin_fee_balance: { [Op.gt]: 0 },
    },
  });

  // Skip logging entirely when nothing to check
  if (addressesWithFees.length === 0) return 0;

  cronLogger.info(`[MerchantPool] 💰 Threshold sweep: checking ${addressesWithFees.length} addresses with admin fees (AVAILABLE + IN_USE)...`);

  const eligibleAddresses = [];
  
  for (const address of addressesWithFees) {
    try {
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const walletType = address.dataValues.wallet_type;
      const walletAddress = address.dataValues.wallet_address;
      const currentStatus = address.dataValues.status;
      
      const sweepConfig = getSweepConfig(walletType);
      
      // SELF-HEAL: Transition any IN_USE address (regardless of sweep mode) to AVAILABLE
      // so it becomes visible to the reservation pipeline for fee concentration.
      // This fixes pre-existing stuck IN_USE addresses from before the releaseAddress fix.
      // Only heal addresses with NO active payment (current_payment_id is null).
      if (currentStatus === "IN_USE" && !address.dataValues.current_payment_id) {
        if (sweepConfig.mode !== "threshold") {
          // Non-threshold mode (time/batch) — just heal, sweepByTime handles actual sweep
          const [healed] = await merchantTempAddressModel.update(
            { status: "AVAILABLE" },
            { where: { temp_address_id: address.dataValues.temp_address_id, status: "IN_USE", current_payment_id: null } }
          );
          if (healed > 0) {
            cronLogger.info(`[MerchantPool] 🔄 Self-heal: ${walletAddress} (${walletType}) IN_USE → AVAILABLE (mode=${sweepConfig.mode}, visible for reuse)`);
          }
          continue;
        }
        // Threshold mode — continue to threshold check below (may sweep or heal)
      }
      
      if (sweepConfig.mode !== "threshold") {
        continue;
      }

      // ─── DEFERRAL PRE-CHECK: Skip addresses deferred due to repeated unprofitable sweeps ───
      try {
        const deferData = await getRedisItem(`sweep:unprofitable:${address.dataValues.temp_address_id}`) as { count: number; deferredUntil?: string } | null;
        if (deferData?.deferredUntil && new Date(deferData.deferredUntil) > new Date()) {
          continue; // Silently skip — deferral check inside sweepAdminFeeToWallet will log if needed
        }
      } catch (_e) { /* Non-critical — proceed with sweep attempt */ }
      
      const usdAmount = await convertToUSD(walletType, cryptoAmount);
      
      if (usdAmount >= (sweepConfig.value || 30)) {
        cronLogger.info(`[MerchantPool] ✅ ${walletAddress} (${walletType}): $${usdAmount.toFixed(2)} >= $${sweepConfig.value} threshold — sweeping`);
        // Conditional update: only transition if still AVAILABLE, IN_USE, or PRE_RESERVED (not RESERVED/PROCESSING)
        // Prevents race condition where reservation claimed the address between our read and update
        const [updatedRows] = await merchantTempAddressModel.update(
          { status: "IN_USE" },
          { where: { temp_address_id: address.dataValues.temp_address_id, status: { [Op.in]: ["AVAILABLE", "IN_USE", "PRE_RESERVED"] } } }
        );
        if (updatedRows === 0) {
          cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} status changed (likely reserved for payment) — skipping sweep`);
          continue;
        }
        eligibleAddresses.push(address);
      } else if (currentStatus === "IN_USE" && !address.dataValues.current_payment_id) {
        // Below threshold AND stuck as IN_USE — self-heal to AVAILABLE for fee concentration
        const [healed] = await merchantTempAddressModel.update(
          { status: "AVAILABLE" },
          { where: { temp_address_id: address.dataValues.temp_address_id, status: "IN_USE", current_payment_id: null } }
        );
        if (healed > 0) {
          cronLogger.info(`[MerchantPool] 🔄 Self-heal: ${walletAddress} (${walletType}) IN_USE → AVAILABLE ($${usdAmount.toFixed(2)} < $${sweepConfig.value} threshold, visible for reuse)`);
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      cronLogger.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  if (eligibleAddresses.length > 0) {
    cronLogger.info(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for threshold sweep`);
  }

  // Sweep eligible addresses with staggered TRON execution to avoid TronGrid 429 rate limits.
  const TRON_INTER_SWEEP_DELAY_MS = 500;
  const tronAddrs = eligibleAddresses.filter(a => (a.dataValues.wallet_type || '').includes('TRC20') || a.dataValues.wallet_type === 'TRX');
  const otherAddrs = eligibleAddresses.filter(a => !((a.dataValues.wallet_type || '').includes('TRC20') || a.dataValues.wallet_type === 'TRX'));

  const sweepOneAddr = async (address: typeof eligibleAddresses[0]) => {
    const addrId = address.dataValues.temp_address_id;
    const lockKey = `sweep:address:${addrId}`;
    const { acquireLock, releaseLock } = await import("../../utils/redisInstance");
    const locked = await acquireLock(lockKey, 300, 1, 50, true);
    if (!locked) {
      cronLogger.info(`[MerchantPool] Sweep skipped (locked): address ${addrId}`);
      return;
    }
    try {
      await sweepWithRetry(addrId, address.dataValues.wallet_address);
    } catch (error) {
      cronLogger.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    } finally {
      await releaseLock(lockKey);
    }
  };

  // Non-TRON: sweep concurrently
  const otherPs = otherAddrs.map(sweepOneAddr);

  // TRON: sweep sequentially with delay to avoid TronGrid 429s
  const tronP = (async () => {
    for (let i = 0; i < tronAddrs.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, TRON_INTER_SWEEP_DELAY_MS));
      await sweepOneAddr(tronAddrs[i]);
    }
  })();

  await Promise.allSettled([...otherPs, tronP]);
  
  return eligibleAddresses.length;
};

/**
 * Sweep addresses after time threshold
 */
export const sweepByTime = async (): Promise<number> => {
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: { [Op.in]: ["AVAILABLE", "IN_USE", "PRE_RESERVED"] },
      admin_fee_balance: { [Op.gt]: 0 },
      last_merchant_payout: { [Op.ne]: null },
    },
  });

  // Skip logging entirely when nothing to check
  if (addressesWithFees.length === 0) return 0;

  cronLogger.info(`[MerchantPool] ⏰ Time sweep: checking ${addressesWithFees.length} addresses with admin fees (AVAILABLE + IN_USE)...`);

  const eligibleAddresses = [];

  for (const address of addressesWithFees) {
    try {
      const walletType = address.dataValues.wallet_type;
      const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
      const lastPayout = new Date(address.dataValues.last_merchant_payout);
      const timeSincePayout = Math.floor((new Date().getTime() - lastPayout.getTime()) / 60000);
      
      const sweepConfig = getSweepConfig(walletType);
      
      // UTXO chains normally have "batch" mode (no sweep needed — admin fee sent in same TX).
      // But if a UTXO chain is IN_USE with balance > 0, it means auto-convert left funds
      // in the address (pendingSweep safety net). Always sweep these regardless of mode.
      const isUTXOAutoConvertRecovery = UTXO_CHAINS.includes(walletType);
      
      // SAFETY NET: Stale IN_USE token addresses that have been sitting for > 24 hours
      // should be force-swept regardless of sweep mode. This catches threshold-mode tokens
      // that accumulated fees below threshold but have been stuck for too long.
      const isStaleTokenAddress = TOKEN_CHAINS.includes(walletType) && timeSincePayout > 1440; // 24 hours
      
      // ─── AUTO-RELEASE: Micro-dust addresses idle for > 14 days ───
      // ERC20 dust < $0.10: permanent write-off (gas will always be 10,000x+ the balance).
      //   On-chain balance preserved — recovered automatically if address is reused.
      // Non-ERC20 dust < $1.00: deferred for 30 days (gas prices may drop).
      const MAX_IDLE_DUST_MINUTES = 20160; // 14 days
      const ERC20_CHAINS = ["USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20"];
      const isERC20 = ERC20_CHAINS.includes(walletType);
      const MICRO_DUST_USD = isERC20 ? 0.10 : 1.00;
      if (isStaleTokenAddress && timeSincePayout > MAX_IDLE_DUST_MINUTES) {
        try {
          const dustUSD = await convertToUSD(walletType, cryptoAmount);
          if (dustUSD < MICRO_DUST_USD) {
            if (isERC20) {
              // ERC20 permanent write-off: gas will always dwarf the balance.
              // On-chain crypto preserved — swept automatically when address is reused.
              cronLogger.warn(`[MerchantPool] 🗑️ ERC20 WRITE-OFF: ${address.dataValues.wallet_address} (${walletType}): $${dustUSD.toFixed(4)} dust, idle ${Math.floor(timeSincePayout / 1440)}d — permanently written off`);
              await merchantTempAddressModel.update(
                { status: "AVAILABLE", admin_fee_balance: 0, last_swept_at: new Date() },
                { where: { temp_address_id: address.dataValues.temp_address_id } }
              );
            } else {
              // Non-ERC20: defer for 30 days (gas prices may drop or fee wallet topped up)
              cronLogger.warn(`[MerchantPool] ⏸️ LONG DEFER: ${address.dataValues.wallet_address} (${walletType}): $${dustUSD.toFixed(4)} micro-dust, idle ${Math.floor(timeSincePayout / 1440)}d — deferring sweep for 30 days`);
              const deferKey = `sweep:unprofitable:${address.dataValues.temp_address_id}`;
              const deferUntil = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
              await setRedisItemWithTTL(deferKey, { count: 99, deferredUntil: deferUntil }, 30 * 86400);
            }
            continue; // Skip to next address
          }
        } catch (_convErr) {
          // If conversion fails, proceed with normal sweep attempt
        }
      }
      
      if (sweepConfig.mode !== "time" && !isUTXOAutoConvertRecovery && !isStaleTokenAddress) {
        continue;
      }

      // ─── DEFERRAL PRE-CHECK: Skip addresses deferred due to repeated unprofitable sweeps ───
      // This prevents the infinite loop where sweepByTime adds addresses to the eligible list
      // every 30 minutes, only for sweepAdminFeeToWallet to reject them inside the lock.
      try {
        const deferData = await getRedisItem(`sweep:unprofitable:${address.dataValues.temp_address_id}`) as { count: number; deferredUntil?: string } | null;
        if (deferData?.deferredUntil && new Date(deferData.deferredUntil) > new Date()) {
          continue; // Silently skip — address is deferred, will be retried after deferral expires
        }
      } catch (_e) { /* Non-critical — proceed with sweep attempt */ }
      
      // For stale token addresses, override the time threshold check — sweep immediately
      // BUT only if the balance is above the minimum profitable sweep threshold.
      // Small balances are left AVAILABLE for fee concentration: the reservation pipeline
      // picks addresses with the highest admin_fee_balance first (ORDER BY admin_fee_balance DESC),
      // so the next payment to this chain will reuse this address, adding more fees until
      // the combined balance becomes profitable to sweep. Zero gas wasted.
      if (isStaleTokenAddress) {
        try {
          const balanceUSD = await convertToUSD(walletType, cryptoAmount);
          const minSweepUSD = getMinSweepUSD(walletType);
          
          if (balanceUSD < minSweepUSD) {
            // Balance too small to sweep profitably — leave for fee concentration via reuse.
            // The address stays AVAILABLE with admin_fee_balance > 0, so reserveAddress()
            // will pick it first for the next payment on this chain.
            // Only log once per hour to avoid spam (check Redis throttle).
            const throttleKey = `sweep:reuse-log:${address.dataValues.temp_address_id}`;
            const lastLogged = await getRedisItem(throttleKey);
            if (!lastLogged) {
              cronLogger.info(`[MerchantPool] 🔄 FEE CONCENTRATION: ${address.dataValues.wallet_address} (${walletType}): $${balanceUSD.toFixed(2)} < $${minSweepUSD} min sweep — leaving for reuse (idle ${Math.floor(timeSincePayout / 1440)}d)`);
              await setRedisItemWithTTL(throttleKey, { logged: true }, 3600); // Suppress for 1 hour
            }
            continue; // Skip — address stays AVAILABLE for the next payment
          }
        } catch (_convErr) {
          // If USD conversion fails, proceed with sweep attempt (fail-safe)
        }

        // Conditional update: only transition if still AVAILABLE, IN_USE, or PRE_RESERVED (not RESERVED/PROCESSING)
        const [updatedRows] = await merchantTempAddressModel.update(
          { status: "IN_USE" },
          { where: { temp_address_id: address.dataValues.temp_address_id, status: { [Op.in]: ["AVAILABLE", "IN_USE", "PRE_RESERVED"] } } }
        );
        if (updatedRows === 0) {
          cronLogger.info(`[MerchantPool] ⏭️ ${address.dataValues.wallet_address} status changed (likely reserved) — skipping stale sweep`);
          continue;
        }
        cronLogger.info(`[MerchantPool] ⚠️ Stale token sweep: ${address.dataValues.wallet_address} (${walletType}): ${cryptoAmount}, idle for ${timeSincePayout} min — force sweeping`);
        eligibleAddresses.push(address);
        continue;
      }
      
      const timeThresholdMinutes = sweepConfig.value || 10;
      const timeThreshold = new Date();
      timeThreshold.setMinutes(timeThreshold.getMinutes() - timeThresholdMinutes);
      
      if (lastPayout < timeThreshold) {
        // Conditional update: only transition if still AVAILABLE, IN_USE, or PRE_RESERVED (not RESERVED/PROCESSING)
        const [updatedRows] = await merchantTempAddressModel.update(
          { status: "IN_USE" },
          { where: { temp_address_id: address.dataValues.temp_address_id, status: { [Op.in]: ["AVAILABLE", "IN_USE", "PRE_RESERVED"] } } }
        );
        if (updatedRows === 0) {
          cronLogger.info(`[MerchantPool] ⏭️ ${address.dataValues.wallet_address} status changed (likely reserved) — skipping time sweep`);
          continue;
        }
        cronLogger.info(`[MerchantPool] ✅ ${address.dataValues.wallet_address} (${walletType}): ${cryptoAmount}, ${timeSincePayout} min since payout — sweeping`);
        eligibleAddresses.push(address);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      cronLogger.error(`[MerchantPool] ⚠️  Failed to check ${address.dataValues.wallet_type}:`, message);
    }
  }

  if (eligibleAddresses.length > 0) {
    cronLogger.info(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for time-based sweep`);
  }

  // Sweep eligible addresses with staggered execution to avoid TRON API rate limits (429).
  // TRON addresses are processed sequentially with a delay; other chains run concurrently.
  const TRON_INTER_SWEEP_DELAY_MS = 500; // 500ms between TRON address sweeps
  const tronAddresses = eligibleAddresses.filter(a => (a.dataValues.wallet_type || '').includes('TRC20') || a.dataValues.wallet_type === 'TRX');
  const otherAddresses = eligibleAddresses.filter(a => !((a.dataValues.wallet_type || '').includes('TRC20') || a.dataValues.wallet_type === 'TRX'));

  const sweepOne = async (address: typeof eligibleAddresses[0]) => {
    const addrId = address.dataValues.temp_address_id;
    const lockKey = `sweep:address:${addrId}`;
    const { acquireLock, releaseLock } = await import("../../utils/redisInstance");
    const locked = await acquireLock(lockKey, 300, 1, 50, true);
    if (!locked) {
      cronLogger.info(`[MerchantPool] Sweep skipped (locked): address ${addrId}`);
      return;
    }
    try {
      await sweepWithRetry(addrId, address.dataValues.wallet_address);
    } catch (error) {
      cronLogger.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    } finally {
      await releaseLock(lockKey);
    }
  };

  // Non-TRON: sweep concurrently
  const otherPromises = otherAddresses.map(sweepOne);

  // TRON: sweep sequentially with delay to avoid TronGrid 429s
  const tronPromise = (async () => {
    for (let i = 0; i < tronAddresses.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, TRON_INTER_SWEEP_DELAY_MS));
      await sweepOne(tronAddresses[i]);
    }
  })();

  await Promise.allSettled([...otherPromises, tronPromise]);
  
  return eligibleAddresses.length;
};

/**
 * Master sweep function - runs both threshold and time-based sweeps.
 * Uses per-address locking so multiple addresses can be swept concurrently
 * without blocking the entire sweep pipeline on one slow chain.
 */
export const performScheduledSweeps = async (): Promise<void> => {
  try {
    const thresholdCount = await sweepByThreshold();
    const timeCount = await sweepByTime();
    
    // Only log banner when there was actual work
    if (thresholdCount > 0 || timeCount > 0) {
      cronLogger.info(`[MerchantPool] ✅ Sweep completed: ${thresholdCount} threshold + ${timeCount} time-based`);
    }
  } catch (error) {
    const message = getErrorMessage(error);
    cronLogger.error(`[MerchantPool] ❌ Scheduled sweep failed:`, message);
  }
};
