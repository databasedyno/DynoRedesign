/**
 * Crypto settlement & on-chain verification chain.
 * Extracted verbatim from paymentController.ts (no behavior change).
 * Contains: settleCryptoTransaction, verifyCryptoPayment, cryptoVerification.
 */
import express from "express";
import {
  PAYMENT_TIMING,
} from "./paymentConfig";
import { convertToUSD, withRetry } from "./paymentHelpers";
import {
  currencyConvert,
  errorResponseHelper,
  getErrorMessage,
  sendPaymentReceivedEmail,
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
  successResponseHelper,
} from "../../helper";
import { apiLogger, cronLogger, log } from "../../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
  softDeleteRedisItem,
  setRedisTTL,
} from "../../utils/redisInstance";
import sequelize from "../../utils/dbInstance";
import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { normalizeLang, resolveCustomerLanguage } from "../../utils/emailI18n";
import {
  adminFeeModel,
  companyModel,
  customerTransactionModel,
  userModel,
  userWalletModel,
} from "../../models";
import { createNotification, NOTIFICATION_TYPES } from "../notificationController";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { buildPaymentReceivedDisplay } from "../../utils/paymentAmountDisplay";
import {
  sendPartialPaymentNotification,
} from "../../services/pendingPaymentService";
import {
  sendCustomerPaymentConfirmationEmail,
} from "../../services/emailService";
import crypto from "crypto";
import { safeDeleteSubscription } from "../../helper/subscriptionHelpers";
import { incrementAdminFee, incrementUserWallet, incrementCustomerWallet } from "../../helper/walletHelpers";

import {
  userTempAddressModel,
  userTransactionModel,
  merchantTempAddressModel,
  paymentLinkModel,
} from "../../models";
import tatumApi from "../../apis/tatumApi";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import { getAdminWalletAddress } from "../../utils/adminUtils";
import {
  calculateTransactionFees,
} from "../../services/feeService";
import { 
  getBlockchainNetworkFee, 
} from "../../services/blockchainFeeService";
import * as merchantPoolService from "../../services/merchantPoolService";
import { getCryptoRedisKey } from "../../services/merchantPool/merchantPoolConfig";
import { recordTransactionVolume, reverseTransactionVolume } from "../../services/feeFreeService";
import { isVolatileCrypto } from "../../services/binanceService";
import { createConversionRecord } from "../../services/conversionService";
import { PaymentState, parseState, toRedisStatus } from "../../services/paymentStateMachine";
import { calculateDynamicTRC20Fee } from "../../services/tronEnergyService";

// ============================================
// CENTRALIZED TIMING CONFIGURATION
// ============================================
// All payment timing constants in one place for consistency
// These can be overridden by merchant settings in tbl_company

const settleCryptoTransaction = async ({
  tempAddressData,
  receivedAmount,
  currency,
  transactionId,
  userAmount,
  userAddress,
  merchantDestinationTag,
  isMerchantPool,
}: {
  tempAddressData: {
    address: string;
    wallet_address?: string;  // Alternative name for address
    private_key?: string;
    privateKey?: string;
    wallet_type?: string;
    is_merchant_pool?: boolean;
    payment_id?: string;
  };
  receivedAmount: number;  // This is the admin fee amount
  currency: string;
  transactionId: string;
  userAmount?: number;     // This is the merchant amount
  userAddress?: string;    // Merchant wallet address
  merchantDestinationTag?: number | null; // XRP/RLUSD destination tag for merchant's exchange address
  isMerchantPool?: boolean; // Whether this is a merchant pool address
}) => {
  // Get the address - use wallet_address if available, otherwise use address
  const fromAddress = tempAddressData.wallet_address || tempAddressData.address;
  const paymentId = tempAddressData.payment_id || `unknown-${Date.now()}`;
  
  try {
    // ── RELIABILITY GUARD 1: Settlement Idempotency ──────────────────────────
    // Prevent double-spend if this function is retried after a successful Tatum call
    const {
      checkSettlementIdempotency,
      markSettlementInProgress,
      markSettlementCompleted,
      markSettlementFailed,
      validateWalletSeparation,
      journalStateTransition,
    } = require("../../services/paymentReliability");

    const idempotencyCheck = await checkSettlementIdempotency(paymentId, fromAddress, currency);
    if (idempotencyCheck.alreadySettled) {
      cronLogger.warn(
        `[settleCryptoTransaction] ⛔ Idempotency guard: Settlement already exists for payment ${paymentId}. ` +
        `TX: ${idempotencyCheck.existingTxId || 'in-progress'}. Skipping duplicate.`
      );
      return idempotencyCheck.existingTxId
        ? { txId: idempotencyCheck.existingTxId, status: 'already_settled' }
        : { txId: null, status: 'settlement_in_progress' };
    }

    // Mark settlement as in-progress (atomic claim)
    await markSettlementInProgress(paymentId);

    const adminWalletAddress = getAdminWalletAddress(currency);

    if (!adminWalletAddress) {
      await markSettlementFailed(paymentId, `No admin wallet for ${currency}`);
      throw new Error(
        `Admin wallet address not configured for ${currency} in environment variables.`
      );
    }

    // ── RELIABILITY GUARD 2: Admin ≠ Merchant Wallet ─────────────────────────
    // Check if admin and merchant wallets are the same (intentional single-wallet config)
    let isSameWallet = false;
    if (userAddress) {
      const walletCheck = validateWalletSeparation(
        adminWalletAddress,
        userAddress,
        currency,
        Number((tempAddressData as any).current_company_id) || null
      );
      if (!walletCheck.valid) {
        cronLogger.error(`[settleCryptoTransaction] ⛔ WALLET GUARD BLOCKED: ${walletCheck.reason}`);
        await markSettlementFailed(paymentId, walletCheck.reason || 'Wallet validation failed');
        cronLogger.warn(`[settleCryptoTransaction] ⚠️ Falling back to admin-only settlement for ${paymentId}. Merchant amount retained in temp address for manual recovery.`);
        await journalStateTransition({
          paymentId,
          txId: transactionId,
          address: fromAddress,
          currency,
          event: 'wallet_guard_blocked',
          fromState: 'processing',
          toState: 'manual_review',
          amount: Number(userAmount),
          metadata: { reason: walletCheck.reason, adminWallet: adminWalletAddress, merchantWallet: userAddress },
        });
      }
      if (walletCheck.sameAddress) {
        isSameWallet = true;
        cronLogger.info(`[settleCryptoTransaction] ℹ️ Same-wallet mode: admin and merchant wallets are identical for ${currency}. Will use combined single-output settlement.`);
      }
    }

    // Journal the settlement start
    await journalStateTransition({
      paymentId,
      txId: transactionId,
      address: fromAddress,
      currency,
      event: 'settlement_started',
      fromState: 'processing',
      toState: 'settling',
      amount: Number(receivedAmount) + Number(userAmount || 0),
    });

    // Get private key - merchant pool addresses use different field names
    const privateKeyField = isMerchantPool ? tempAddressData.private_key : tempAddressData.privateKey;
    const privateKey = await tatumApi.decryptSymmetric(
      privateKeyField,
      process.env.TEMP_KEY_ID
    );

    let fees;
    let merchantTransactionDetails;
    let totalBlockchainFee = 0;
    let merchantSendAmount = 0;
    let gasFundingResult: { funded: boolean; amount: number; txId?: string; reason?: string } = { funded: false, amount: 0 };

    // NEW APPROACH: Single transfer to merchant, admin fee stays in temp address for later sweep
    // This eliminates nonce collision issues for account-based chains (ETH, TRX, BSC)
    // and is more gas efficient as admin fees can be collected in batches

    if (!userAmount || userAmount <= 0 || !userAddress) {
      // UTXO chains (BTC, LTC, DOGE, BCH): Send directly to admin wallet NOW
      // UTXO chains can't efficiently "leave funds for later sweep" because:
      //   1. releaseAddress() sets UTXO status to AVAILABLE (sweep requires IN_USE)
      //   2. UTXO sweep mode is "batch" (skipped by threshold/time sweep crons)
      // This matches how normal UTXO settlement creates instant multi-output TXs.
      const isUTXODirect = ["BTC", "LTC", "DOGE", "BCH"].includes(currency);
      
      if (isUTXODirect && receivedAmount > 0 && adminWalletAddress) {
        cronLogger.info(`[settleCryptoTransaction] UTXO auto-convert: Sending ${receivedAmount} ${currency} directly to admin wallet ${adminWalletAddress.substring(0, 12)}...`);
        
        const utxoFees = await tatumApi.feeEstimation(
          currency,
          fromAddress,
          adminWalletAddress,
          receivedAmount
        );
        
        // For BCH: the feeEstimation returns fee-per-KB rate. A simple 1-in/1-out tx ≈ 225 bytes.
        // Use a generous minimum fee to avoid dust change outputs.
        // BCH dust threshold = 546 sats. Use at least 1000 sats (0.00001 BCH) as fee floor.
        const rawFee = Number(utxoFees?.fast ?? utxoFees?.slow ?? 0);
        const minFee = currency === 'BCH' ? 0.00001 : rawFee;
        const utxoFeeToDeduct = Math.max(rawFee, minFee);
        // Use SATOSHI-LEVEL integer arithmetic to avoid floating-point precision dust
        // JavaScript: 0.01879 * 1e8 = 1878999.9999998 (not exact!) → creates 1 sat dust change
        const inputSats = Math.round(receivedAmount * 1e8);
        const feeSats = Math.round(utxoFeeToDeduct * 1e8);
        const outputSats = inputSats - feeSats;
        const utxoAmountToSend = outputSats / 1e8;
        // CRITICAL: Round-trip safety — re-derive the actual satoshi value that Tatum will
        // use after its Math.round(value * 1e8) conversion. Fee absorbs any rounding drift.
        const actualOutputSats = Math.round(utxoAmountToSend * 1e8);
        const actualFeeSats = inputSats - actualOutputSats;
        const exactFee = actualFeeSats / 1e8; // Guarantees zero change
        
        if (utxoAmountToSend <= 0) {
          cronLogger.warn(`[settleCryptoTransaction] UTXO auto-convert: Amount after fee is non-positive. Balance: ${receivedAmount}, Fee: ${utxoFeeToDeduct}`);
          return {
            transactionDetails: null,
            userTransactionDetails: null,
            sendAmount: 0,
            blockchainFee: 0,
            adminFeeRetained: receivedAmount,
          };
        }
        
        // Lookup the correct UTXO output index for this address
        const utxoIndex = await tatumApi.findUtxoOutputIndex(transactionId, fromAddress, currency);
        // FIX BUG-2/9: If output index not found (-1), log error and fall back to index 0 with fee tolerance
        const resolvedUtxoIndex = utxoIndex >= 0 ? utxoIndex : 0;
        let resolvedFeeSats = actualFeeSats;
        let resolvedOutputSats = actualOutputSats;
        let resolvedUtxoAmount = utxoAmountToSend;
        let resolvedExactFee = exactFee;
        if (utxoIndex < 0) {
          cronLogger.warn(`[settleCryptoTransaction] ⚠️ UTXO output index not found for ${fromAddress} in tx ${transactionId}. Falling back to index 0 with +1 sat fee tolerance.`);
          // Add 1 satoshi tolerance to avoid off-by-one fee rejection
          resolvedFeeSats = actualFeeSats + 1;
          resolvedOutputSats = inputSats - resolvedFeeSats;
          resolvedUtxoAmount = resolvedOutputSats / 1e8;
          resolvedExactFee = resolvedFeeSats / 1e8;
        }
        cronLogger.info(`[settleCryptoTransaction] UTXO math (satoshi): input=${inputSats}, output=${resolvedOutputSats}, fee=${resolvedFeeSats}, change=${inputSats - resolvedOutputSats - resolvedFeeSats}, utxoAmountToSend=${resolvedUtxoAmount}, exactFee=${resolvedExactFee}, utxoIndex=${resolvedUtxoIndex}`);
        
        const adminTransferDetails = await withRetry(
          () => tatumApi.assetToOtherAddress({
            currency,
            fromAddress: fromAddress,
            toAddress: adminWalletAddress,
            privateKey: privateKey,
            amount: resolvedUtxoAmount,
            // Fee = full UTXO input - output, ensuring zero change (avoids dust)
            fee: String(resolvedExactFee),
            fromUTXO: [
              {
                txHash: transactionId,
                index: resolvedUtxoIndex,
                privateKey: privateKey,  // BCH requires privateKey in fromUTXO
              },
            ],
            toUTXO: [
              {
                address: adminWalletAddress,
                value: resolvedUtxoAmount,
              },
            ],
          }),
          `UTXO admin-only transfer (${currency})`
        );
        
        cronLogger.info(`[settleCryptoTransaction] ✅ UTXO auto-convert TX sent: ${adminTransferDetails?.txId} (${resolvedUtxoAmount} ${currency} → admin wallet, fee: ${resolvedExactFee})`);
        
        // BUG-3 FIX: Mark UTXO auto-convert TX as outgoing
        if (adminTransferDetails?.txId) {
          await setRedisItem(`outgoing-tx-${adminTransferDetails.txId}`, {
            type: "utxo-auto-convert", currency, markedAt: new Date().toISOString(),
          });
          await setRedisTTL(`outgoing-tx-${adminTransferDetails.txId}`, 7200);
        }

        return {
          transactionDetails: adminTransferDetails,
          userTransactionDetails: null,
          sendAmount: 0,
          blockchainFee: utxoFeeToDeduct,
          adminFeeRetained: 0, // All sent to admin wallet — nothing left to sweep
        };
      }
      
      // Account-based chains (ETH, TRX, XRP, SOL, POLYGON): Admin fee stays for sweep
      // Sweep mechanism works correctly for these chains (status=IN_USE, threshold/time modes)
      cronLogger.info(`[settleCryptoTransaction] No merchant transfer needed. Admin fee ${receivedAmount} ${currency} stays in temp address for sweep.`);
      return {
        transactionDetails: null,
        userTransactionDetails: null,
        sendAmount: 0,
        blockchainFee: 0,
        adminFeeRetained: receivedAmount,
      };
    }

    // === Gas cap tracking (declare at function scope for recovery block access) ===
    const MAX_GAS_PER_PAYMENT_TRX = 30; // Cap: max 30 TRX total gas per payment to prevent wallet drain
    // ── FIX: Track initial SmartGas funding in the gas cap ──
    // Without this, the initial ~18.7 TRX funding is not counted, and the cap only applies
    // to retry re-fundings, allowing up to 30 + 18.7 = ~49 TRX total per payment
    let totalGasFundedTRX = 0; // Will be initialized after SmartGas funding

    // Calculate fees for merchant transfer
    if (currency === "USDT-TRC20" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD" || currency === "RLUSD-ERC20" || currency === "USDT-POLYGON") {
      // Token transfers (handled separately)
      const wallet_type_map: Record<string, string> = {
        "USDT-TRC20": "TRX",
        "USDT-ERC20": "ETH",
        "USDC-ERC20": "ETH",
        "RLUSD": "XRP",
        "RLUSD-ERC20": "ETH",
        "USDT-POLYGON": "POLYGON",
      };
      const wallet_type = wallet_type_map[currency] || "ETH";
      const adminFeeWallet = await adminFeeModel.findOne({
        where: { wallet_type },
      });

      if (!adminFeeWallet) {
        throw new Error(`Admin fee wallet not found for ${wallet_type}.`);
      }

      let contractAddress;
      if (currency === "USDT-ERC20") {
        contractAddress = process.env.ETH_CONTRACT;
      } else if (currency === "USDC-ERC20") {
        contractAddress = process.env.USDC_CONTRACT;
      } else if (currency === "RLUSD-ERC20") {
        contractAddress = process.env.RLUSD_ERC20_CONTRACT;
      } else if (currency === "USDT-POLYGON") {
        contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      } else if (currency === "RLUSD") {
        contractAddress = null; // RLUSD uses XRP Ledger tokens, not contract
      } else {
        contractAddress = process.env.TRX_CONTRACT;
      }

      fees = await tatumApi.feeEstimation(
        currency,
        fromAddress,
        userAddress,
        Number(userAmount),
        contractAddress
      );

      // Deduct gas cost from merchant's token payout (consistent with UTXO/native chains)
      // TWO gas costs: (1) merchant transfer gas + (2) estimated sweep gas for admin fee collection
      // OPTIMIZATIONS:
      //   - Same-wallet mode: skip sweep gas (admin fees go to same wallet as merchant)
      //   - Fee-free (receivedAmount=0): skip sweep gas (no admin fee to sweep)
      // Gas is in native currency (ETH/TRX/XRP/POL), so convert to USD equivalent for stablecoin deduction
      const noAdminFeeToSweep = !receivedAmount || receivedAmount <= 0;
      let merchantTransferGasUSD = 0;
      let estimatedSweepGasUSD = 0;
      try {
        const networkFee = await getBlockchainNetworkFee(currency);
        merchantTransferGasUSD = Number(networkFee.feeInUSD) || 0;
        // Skip sweep gas when: (a) admin=merchant wallet, or (b) no admin fee to sweep (fee-free)
        if (isSameWallet) {
          estimatedSweepGasUSD = 0;
          cronLogger.info(`[settleCryptoTransaction] Token ${currency}: Same-wallet mode — sweep gas SKIPPED (admin=merchant wallet). Transfer gas only ≈ $${merchantTransferGasUSD.toFixed(4)}`);
        } else if (noAdminFeeToSweep) {
          estimatedSweepGasUSD = 0;
          cronLogger.info(`[settleCryptoTransaction] Token ${currency}: Fee-free — sweep gas SKIPPED (no admin fee to sweep). Transfer gas only ≈ $${merchantTransferGasUSD.toFixed(4)}`);
        } else {
          // Sweep is same type of token transfer on same chain → same gas estimate
          estimatedSweepGasUSD = merchantTransferGasUSD;
          cronLogger.info(`[settleCryptoTransaction] Token ${currency}: Transfer gas ≈ $${merchantTransferGasUSD.toFixed(4)}, Sweep gas ≈ $${estimatedSweepGasUSD.toFixed(4)} (both deducted from merchant)`);
        }
      } catch (feeErr) {
        // Fallback: convert raw native fee to USD using price lookup
        const rawFee = Number(fees?.fast ?? fees?.slow ?? 0);
        try {
          const nativePrices: Record<string, number> = { ETH: 2300, TRX: 0.25, XRP: 2.5, POLYGON: 0.5 };
          const nativePrice = nativePrices[wallet_type] || 1;
          merchantTransferGasUSD = rawFee * nativePrice;
          // Only charge sweep gas if there's admin fee to sweep
          estimatedSweepGasUSD = (isSameWallet || noAdminFeeToSweep) ? 0 : merchantTransferGasUSD;
          cronLogger.warn(`[settleCryptoTransaction] Token ${currency}: Fallback gas: ${rawFee} ${wallet_type} × $${nativePrice} = $${merchantTransferGasUSD.toFixed(4)} per tx${estimatedSweepGasUSD > 0 ? ' (×2 for transfer + sweep)' : ' (transfer only, no sweep needed)'}`);
        } catch {
          merchantTransferGasUSD = rawFee;
          estimatedSweepGasUSD = (isSameWallet || noAdminFeeToSweep) ? 0 : rawFee;
          cronLogger.warn(`[settleCryptoTransaction] Token ${currency}: Using raw native fee ${rawFee} as token deduction (price lookup failed)`);
        }
      }

      const totalGasDeductionToken = merchantTransferGasUSD + estimatedSweepGasUSD;

      // FIX (2026-04-10): In same-wallet mode, combine merchant + admin amounts into a single transfer.
      // Previously only sent userAmount (merchant portion), leaving adminFee (receivedAmount) stranded
      // on the temp address for a separate sweep — wasting gas and delaying the merchant's funds.
      // Since admin wallet = merchant wallet, send everything in one TX.
      let effectiveSendBase: number;
      if (isSameWallet && receivedAmount && receivedAmount > 0) {
        effectiveSendBase = Number(userAmount) + Number(receivedAmount);
        cronLogger.info(`[settleCryptoTransaction] Token ${currency}: Same-wallet combined: merchant ${userAmount} + admin ${receivedAmount} = ${effectiveSendBase} (single TX)`);
      } else {
        effectiveSendBase = Number(userAmount);
      }

      merchantSendAmount = Number((effectiveSendBase - totalGasDeductionToken).toFixed(6));
      if (merchantSendAmount <= 0) {
        throw new Error(`Merchant token amount after gas deduction is non-positive. Amount: ${effectiveSendBase}, TransferGas: ${merchantTransferGasUSD}, SweepGas: ${estimatedSweepGasUSD}`);
      }

      cronLogger.info(`[settleCryptoTransaction] Token ${currency}: Merchant gets ${merchantSendAmount} (was ${effectiveSendBase}${isSameWallet ? ' [combined]' : ''}, transfer gas $${merchantTransferGasUSD.toFixed(4)} + sweep gas $${estimatedSweepGasUSD.toFixed(4)} = $${totalGasDeductionToken.toFixed(4)} total)`);

      // === SmartGas: Fund gas (TRX/ETH) to temp address BEFORE token transfer ===
      try {
        if (isMerchantPool) {
          const poolAddressRecord = await merchantTempAddressModel.findOne({
            where: { wallet_address: fromAddress },
          });
          if (poolAddressRecord) {
            cronLogger.info(`[settleCryptoTransaction] 🔧 SmartGas: Checking ${wallet_type} gas for ${currency} merchant transfer (${merchantSendAmount} → ${userAddress})...`);
            gasFundingResult = await merchantPoolService.fundGasIfNeeded(
              poolAddressRecord as unknown as { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> },
              currency, merchantSendAmount, userAddress
            );
          } else {
            cronLogger.warn(`[settleCryptoTransaction] ⚠️ Pool address record not found for ${fromAddress}, skipping SmartGas`);
          }
        } else {
          // Legacy temp address — use lightweight wrapper (no DB gas tracking)
          cronLogger.info(`[settleCryptoTransaction] 🔧 SmartGas: Checking ${wallet_type} gas for legacy ${currency} transfer...`);
          gasFundingResult = await merchantPoolService.fundGasIfNeeded(
            { dataValues: { wallet_address: fromAddress }, update: async () => {} },
            currency, merchantSendAmount, userAddress
          );
        }

        // Wait for gas funding TX to confirm before attempting the token transfer
        // Chain-aware timeouts: ETH is slow (~12s blocks + mempool), TRX is fast (~3s blocks)
        if (gasFundingResult.funded && gasFundingResult.txId) {
          const gasTimeouts: Record<string, number> = {
            ETH: 120000,   // 120s — ETH blocks ~12s, mempool can delay significantly
            MATIC: 45000,  // 45s  — Polygon blocks ~2s but can have congestion
            TRX: 15000,    // 15s  — TRX blocks ~3s, fast finality
            BSC: 30000,    // 30s  — BSC blocks ~3s
          };
          const chainKey = wallet_type.toUpperCase().replace(/-.*$/, '');
          const gasTimeout = gasTimeouts[chainKey] || 60000; // Default 60s for unknown chains
          cronLogger.info(`[settleCryptoTransaction] ⏳ Waiting for gas funding TX ${gasFundingResult.txId} confirmation (${wallet_type}, timeout=${gasTimeout / 1000}s)...`);
          const gasConfirmation = await tatumApi.waitForTransactionConfirmation(
            gasFundingResult.txId,
            wallet_type,
            gasTimeout
          );
          if (gasConfirmation.confirmed) {
            cronLogger.info(`[settleCryptoTransaction] ✅ Gas funding confirmed in block ${gasConfirmation.blockNumber}`);
          } else {
            cronLogger.warn(`[settleCryptoTransaction] ⚠️ Gas funding TX ${gasFundingResult.txId} not confirmed in ${gasTimeout / 1000}s timeout — marking as gas_pending for BullMQ retry`);
          }
        } else if (!gasFundingResult.funded && gasFundingResult.reason) {
          cronLogger.info(`[settleCryptoTransaction] ℹ️ SmartGas: ${gasFundingResult.reason}`);
        }
      } catch (gasError) {
        cronLogger.error(`[settleCryptoTransaction] ⚠️ SmartGas funding failed: ${getErrorMessage(gasError)} — proceeding anyway (retry may succeed)`);
      }
      // === End SmartGas ===

      // Initialize gas cap tracking with SmartGas amount
      totalGasFundedTRX = gasFundingResult.funded ? Number(gasFundingResult.amount || 0) : 0;
      if (totalGasFundedTRX > 0) {
        cronLogger.info(`[settleCryptoTransaction] 📊 Gas cap tracking: Initial SmartGas = ${totalGasFundedTRX} TRX (cap: ${MAX_GAS_PER_PAYMENT_TRX} TRX)`);
      }

      // Retry merchant transfer for token transfers
      // Enhanced with OUT_OF_ENERGY recovery for TRON TRC20 transfers
      const isTRC20 = currency.includes("TRC20") || (String(currency) === "TRX" && !!contractAddress);
      const MAX_TRANSFER_ATTEMPTS = isTRC20 ? 3 : 1; // Extra retries for TRC20 energy issues
      
      for (let transferAttempt = 1; transferAttempt <= MAX_TRANSFER_ATTEMPTS; transferAttempt++) {
        try {
          merchantTransactionDetails = await withRetry(
            () => tatumApi.assetToOtherAddress({
              currency,
              fromAddress: fromAddress,
              toAddress: userAddress,
              privateKey: privateKey,
              amount: merchantSendAmount,
              fee: fees,
              _contractAddress: contractAddress,
            }),
            `Token merchant transfer (${currency}) [attempt ${transferAttempt}/${MAX_TRANSFER_ATTEMPTS}]`
          );
          
          cronLogger.info(`[settleCryptoTransaction] ✅ Token transfer succeeded on attempt ${transferAttempt}`);
          
          // Cache recipient as activated for this token — prevents 130k energy overestimation in future payments
          if (isTRC20 && contractAddress) {
            try {
              const { markRecipientActivated } = require("../../services/tronEnergyService");
              await markRecipientActivated(userAddress, contractAddress);
              cronLogger.info(`[settleCryptoTransaction] 📌 Cached ${userAddress} as activated for ${currency} (future transfers will use 65k energy)`);
            } catch (_cacheErr) { /* Non-critical */ }
          }
          
          break; // Success — exit retry loop
          
        } catch (transferError: unknown) {
          const errMsg = getErrorMessage(transferError);
          const isEnergyError = errMsg.toLowerCase().includes('out_of_energy') ||
            errMsg.toLowerCase().includes('energy') ||
            errMsg.toLowerCase().includes('fee_limit');
          
          if (isTRC20 && isEnergyError && transferAttempt < MAX_TRANSFER_ATTEMPTS) {
            cronLogger.warn(`[settleCryptoTransaction] ⚡ OUT_OF_ENERGY detected for TRC20 transfer (attempt ${transferAttempt}/${MAX_TRANSFER_ATTEMPTS}). Re-funding gas with energy-aware estimation...`);
            
            try {
              // Check gas cap to prevent fee wallet drain
              if (totalGasFundedTRX >= MAX_GAS_PER_PAYMENT_TRX) {
                cronLogger.error(`[settleCryptoTransaction] ❌ Gas cap reached (${totalGasFundedTRX} TRX funded, cap: ${MAX_GAS_PER_PAYMENT_TRX} TRX). Stopping retries to prevent fee wallet drain.`);
                throw new Error(`Gas cap exceeded for payment. ${totalGasFundedTRX} TRX already funded. Manual recovery required.`);
              }

              // FIX (2026-04-07): Pass recipient + contract for accurate activation-aware estimation
              // Previously only passed fromAddress, defaulting to NEW (130k) energy always.
              const trc20Contract = contractAddress || process.env.TRX_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
              const dynamicFee = await calculateDynamicTRC20Fee(fromAddress, userAddress, trc20Contract);
              const extraGasNeeded = dynamicFee.fast;
              totalGasFundedTRX += extraGasNeeded;
              
              cronLogger.info(`[settleCryptoTransaction] 🔋 Energy-aware re-funding: ${extraGasNeeded} TRX (total funded: ${totalGasFundedTRX}/${MAX_GAS_PER_PAYMENT_TRX} TRX cap, energy: ${dynamicFee.energyNeeded} needed, ${dynamicFee.energyAvailable} available, price: ${dynamicFee.energyPrice} SUN/unit)`);
              
              // Re-fund gas from fee wallet
              if (true) {
                await merchantPoolService.fundGasIfNeeded(
                  { dataValues: { wallet_address: fromAddress }, update: async () => {} },
                  currency,
                  merchantSendAmount,
                  userAddress
                );
                
                // Wait for gas funding TX to confirm
                await new Promise(resolve => setTimeout(resolve, 5000));
                cronLogger.info(`[settleCryptoTransaction] 🔋 Gas re-funded. Retrying transfer...`);
              }
            } catch (refundError) {
              cronLogger.error(`[settleCryptoTransaction] ❌ Gas re-funding failed: ${getErrorMessage(refundError)}`);
            }
          } else {
            // Non-energy error or last attempt — propagate
            throw transferError;
          }
        }
      }

      totalBlockchainFee = Number(fees?.fast ?? 0);
      // Record the total gas deduction (transfer + sweep) for accounting
      cronLogger.info(`[settleCryptoTransaction] Token ${currency}: totalBlockchainFee (native gas) = ${totalBlockchainFee}, totalGasDeductionFromMerchant (USD) = $${totalGasDeductionToken.toFixed(4)} (includes sweep gas)`);

    } else {
      // Native currency transfers
      const canUseSingleUTXO = ["BTC", "LTC", "DOGE", "BCH"].includes(currency);

      if (canUseSingleUTXO) {
        // UTXO chains: Create transaction to settle merchant + admin amounts
        // Use SATOSHI-LEVEL integer arithmetic to avoid floating-point precision issues
        // that cause Tatum API rejection ("decimal places not more than 8")
        fees = await tatumApi.feeEstimation(
          currency,
          fromAddress,
          userAddress,
          Number(receivedAmount) + Number(userAmount)
        );

        const rawFeeToDeduct = Number(fees?.fast ?? fees?.slow ?? 0);
        // Use satoshi-level arithmetic: multiply to int, compute, divide back
        const totalInputSats = Math.round((Number(receivedAmount) + Number(userAmount)) * 1e8);
        const feeSats = Math.round(rawFeeToDeduct * 1e8);
        const adminSats = Math.round(Number(receivedAmount) * 1e8);
        const merchantSats = totalInputSats - adminSats - feeSats;

        if (merchantSats <= 0) {
          cronLogger.warn(`[settleCryptoTransaction] UTXO multi-output: Merchant amount after fee is non-positive. Total: ${totalInputSats}, Admin: ${adminSats}, Fee: ${feeSats}`);
          throw new Error(`Merchant amount after fee is non-positive for ${currency}`);
        }

        const adminAmount = adminSats / 1e8;
        merchantSendAmount = merchantSats / 1e8;

        // CRITICAL: Round-trip safety — re-derive the actual satoshi values that Tatum will use
        // after its Math.round(value * 1e8) conversion. If floating-point representation of
        // merchantSendAmount or adminAmount drifts by 1 sat, the fee must absorb it.
        const actualMerchantSats = Math.round(merchantSendAmount * 1e8);
        const actualAdminSats = Math.round(adminAmount * 1e8);
        const actualFeeSats = totalInputSats - actualMerchantSats - actualAdminSats;
        const exactFee = actualFeeSats / 1e8;

        cronLogger.info(`[settleCryptoTransaction] UTXO multi-output math (satoshi): totalInput=${totalInputSats}, admin=${actualAdminSats}, merchant=${actualMerchantSats}, fee=${actualFeeSats}, change=${totalInputSats - actualAdminSats - actualMerchantSats - actualFeeSats}`);

        // Lookup the correct UTXO output index for this address (instead of assuming index 0)
        const utxoIndex = await tatumApi.findUtxoOutputIndex(transactionId, fromAddress, currency);
        // FIX BUG-2/9: Handle unresolved output index with fee tolerance
        const resolvedUtxoIndex = utxoIndex >= 0 ? utxoIndex : 0;
        let finalFeeSats = actualFeeSats;
        let finalMerchantSats = actualMerchantSats;
        let finalMerchantSendAmount = merchantSendAmount;
        if (utxoIndex < 0) {
          cronLogger.warn(`[settleCryptoTransaction] ⚠️ UTXO output index not found for ${fromAddress} in tx ${transactionId}. Adding +1 sat fee tolerance.`);
          // Add 1 satoshi to fee to absorb potential off-by-one
          finalFeeSats = actualFeeSats + 1;
          finalMerchantSats = actualMerchantSats - 1;
          finalMerchantSendAmount = finalMerchantSats / 1e8;
        }
        const exactFeeResolved = finalFeeSats / 1e8;

        // ── SAME-WALLET MODE: When admin and merchant wallets are the same address,
        // create a SINGLE output with the combined amount instead of two outputs.
        // This avoids potential Tatum API issues with duplicate output addresses.
        if (isSameWallet) {
          const combinedSats = finalMerchantSats + actualAdminSats;
          const combinedAmount = combinedSats / 1e8;
          // Recalculate fee to ensure input = output + fee (zero change)
          const sameWalletFeeSats = totalInputSats - combinedSats;
          const sameWalletFee = sameWalletFeeSats / 1e8;

          cronLogger.info(`[settleCryptoTransaction] UTXO same-wallet mode: Single output ${combinedAmount} ${currency} → ${userAddress} (fee: ${sameWalletFee}, utxoIndex: ${resolvedUtxoIndex})`);

          merchantTransactionDetails = await withRetry(
            () => tatumApi.assetToOtherAddress({
              currency,
              fromAddress: fromAddress,
              toAddress: userAddress,
              privateKey: privateKey,
              amount: combinedAmount,
              fee: String(sameWalletFee),
              fromUTXO: [
                {
                  txHash: transactionId,
                  index: resolvedUtxoIndex,
                  privateKey: privateKey,
                },
              ],
              toUTXO: [
                {
                  address: userAddress,
                  value: combinedAmount,
                },
              ],
            }),
            `UTXO same-wallet transfer (${currency})`
          );

          totalBlockchainFee = sameWalletFee;
          merchantSendAmount = combinedAmount;

          cronLogger.info(`[settleCryptoTransaction] ✅ UTXO same-wallet TX sent: ${combinedAmount} ${currency} → ${userAddress} (fee: ${sameWalletFee}, utxoIndex: ${resolvedUtxoIndex})`);
        } else if (adminSats <= 0) {
          // Fee-free mode: admin fee is 0 — single output to merchant only
          // A 0-value UTXO output violates dust limits (e.g., BTC min 546 sats)
          // So we create a merchant-only output and give all non-fee funds to merchant
          const feeFreeAmount = totalInputSats - feeSats;
          const feeFreeSendAmount = Number((feeFreeAmount / 1e8).toFixed(8));

          merchantTransactionDetails = await withRetry(
            () => tatumApi.assetToOtherAddress({
              currency,
              fromAddress: fromAddress,
              toAddress: userAddress,
              privateKey: privateKey,
              amount: feeFreeSendAmount,
              fee: String(exactFeeResolved),
              fromUTXO: [
                {
                  txHash: transactionId,
                  index: resolvedUtxoIndex,
                  privateKey: privateKey,
                },
              ],
              toUTXO: [
                {
                  address: userAddress,
                  value: feeFreeSendAmount,
                },
              ],
            }),
            `UTXO fee-free merchant transfer (${currency})`
          );

          totalBlockchainFee = exactFeeResolved;
          merchantSendAmount = feeFreeSendAmount;

          cronLogger.info(`[settleCryptoTransaction] UTXO chain ${currency}: Fee-free single output — merchant gets ${feeFreeSendAmount} (fee: ${exactFeeResolved}, utxoIndex: ${resolvedUtxoIndex})`);
        } else {
          // Normal mode: Two outputs (merchant + admin) to different addresses
          merchantTransactionDetails = await withRetry(
            () => tatumApi.assetToOtherAddress({
              currency,
              fromAddress: fromAddress,
              toAddress: userAddress,  // Primary recipient is merchant
              privateKey: privateKey,
              amount: finalMerchantSendAmount,
              fee: String(exactFeeResolved),
              fromUTXO: [
                {
                  txHash: transactionId,
                  index: resolvedUtxoIndex,
                  privateKey: privateKey,  // BCH requires privateKey in fromUTXO
                },
              ],
              toUTXO: [
                {
                  address: userAddress,
                  value: finalMerchantSendAmount,
                },
                {
                  address: adminWalletAddress,
                  value: adminAmount,
                },
              ],
            }),
            `UTXO merchant transfer (${currency})`
          );

          totalBlockchainFee = exactFeeResolved;
          merchantSendAmount = finalMerchantSendAmount;
          
          cronLogger.info(`[settleCryptoTransaction] UTXO chain ${currency}: Single TX with merchant ${finalMerchantSendAmount} + admin ${adminAmount} (fee: ${exactFeeResolved}, utxoIndex: ${resolvedUtxoIndex})`);
        }

      } else {
        // Account-based chains (ETH, TRX, BSC, SOL, XRP, POLYGON): Single transfer to merchant only
        // TWO gas costs deducted from merchant:
        //   (1) Merchant transfer gas — gas to send merchant their crypto
        //   (2) Estimated sweep gas — gas for later admin fee sweep from temp address
        // OPTIMIZATIONS:
        //   - Same-wallet mode: skip sweep gas (admin fees go to same wallet)
        //   - Fee-free (receivedAmount=0): skip sweep gas (no admin fee to sweep)
        // This prevents: sweep gas eroding the admin fee (reducing platform revenue)

        // FIX (2026-04-10): In same-wallet mode, combine merchant + admin into single transfer
        let effectiveNativeBase: number;
        if (isSameWallet && receivedAmount && receivedAmount > 0) {
          effectiveNativeBase = Number(userAmount) + Number(receivedAmount);
          cronLogger.info(`[settleCryptoTransaction] Account chain ${currency}: Same-wallet combined: merchant ${userAmount} + admin ${receivedAmount} = ${effectiveNativeBase} (single TX)`);
        } else {
          effectiveNativeBase = Number(userAmount);
        }

        fees = await tatumApi.feeEstimation(
          currency,
          fromAddress,
          userAddress,
          effectiveNativeBase
        );

        // Use `fast` tier for gas deduction — this is the actual gas cost the transaction will incur.
        const merchantTransferGas = Number(fees?.fast ?? fees?.slow ?? 0);
        // Sweep gas estimate: same chain, same type of native transfer → approximately same gas
        // Skip sweep gas when: (a) same-wallet mode, or (b) no admin fee to sweep (fee-free)
        const skipSweepGas = isSameWallet || !receivedAmount || receivedAmount <= 0;
        const estimatedSweepGas = skipSweepGas ? 0 : merchantTransferGas;
        const totalGasDeduction = merchantTransferGas + estimatedSweepGas;

        // Deduct both gas costs from merchant payout — merchant pays for gas (consistent with UTXO)
        merchantSendAmount = Number((effectiveNativeBase - totalGasDeduction).toFixed(8));

        if (merchantSendAmount <= 0) {
          throw new Error(`Merchant amount after gas deduction is non-positive. Amount: ${effectiveNativeBase}, TransferGas: ${merchantTransferGas}, SweepGas: ${estimatedSweepGas}`);
        }

        const sweepGasReason = isSameWallet ? 'same-wallet' : (!receivedAmount || receivedAmount <= 0) ? 'fee-free (no admin fee)' : '';
        cronLogger.info(`[settleCryptoTransaction] Account chain ${currency}: Merchant gets ${merchantSendAmount} ${currency}${isSameWallet ? ' [combined]' : ''} (transfer gas ${merchantTransferGas}${skipSweepGas ? ` [sweep gas SKIPPED — ${sweepGasReason}]` : ` + sweep gas ${estimatedSweepGas}`} = ${totalGasDeduction} deducted from ${effectiveNativeBase})`);

        // Retry merchant transfer for account chains (ETH, TRX, SOL, XRP, POLYGON)
        merchantTransactionDetails = await withRetry(
          () => tatumApi.assetToOtherAddress({
            currency,
            fromAddress: fromAddress,
            toAddress: userAddress,
            privateKey: privateKey,
            amount: merchantSendAmount,
            fee: fees,
            destinationTag: merchantDestinationTag,
          }),
          `Account chain merchant transfer (${currency})`
        );

        totalBlockchainFee = totalGasDeduction;
        cronLogger.info(`[settleCryptoTransaction] Account chain ${currency}: totalBlockchainFee = ${totalBlockchainFee}${estimatedSweepGas > 0 ? ' (includes sweep gas estimate)' : ' (transfer only, no sweep gas)'}`);
      }
    }

    // BUG-3 FIX: Mark the settlement TX as outgoing in Redis BEFORE confirmation wait.
    // This prevents Tatum webhooks for our own outgoing TXs from being processed as incoming payments.
    const settlementTxHash = merchantTransactionDetails?.txId;
    if (settlementTxHash) {
      await setRedisItem(`outgoing-tx-${settlementTxHash}`, {
        type: "settlement",
        fromAddress: fromAddress,
        toAddress: userAddress,
        amount: merchantSendAmount,
        currency,
        markedAt: new Date().toISOString(),
      });
      await setRedisTTL(`outgoing-tx-${settlementTxHash}`, 7200); // 2 hour TTL
      cronLogger.info(`[settleCryptoTransaction] Marked TX ${settlementTxHash} as outgoing (settlement)`);

      // ── Journal broadcast event (informational only — NOT used by idempotency guard) ──
      try {
        const { journalStateTransition } = require("../../services/paymentReliability");
        await journalStateTransition({
          paymentId,
          txId: transactionId,
          address: fromAddress,
          currency,
          event: 'settlement_tx_broadcast',
          fromState: 'settling',
          toState: 'payout_pending_confirmation',
          amount: merchantSendAmount + Number(receivedAmount),
          metadata: { settlementTxHash, merchantAmount: merchantSendAmount, adminAmount: Number(receivedAmount) },
        });
      } catch (reliabilityErr) {
        cronLogger.warn(`[settleCryptoTransaction] Non-critical: broadcast journaling failed: ${(reliabilityErr as Error).message}`);
      }
      // NOTE: markSettlementCompleted() is intentionally NOT called here.
      // It is called AFTER TX confirmation succeeds (below) to prevent the
      // idempotency guard from permanently blocking retries when a TX is
      // included in a block but fails execution (e.g., TRON OUT_OF_ENERGY).
    }

    // Also mark gas funding TX as outgoing (SmartGas)
    if (gasFundingResult.txId) {
      await setRedisItem(`outgoing-tx-${gasFundingResult.txId}`, {
        type: "gas-funding",
        currency,
        markedAt: new Date().toISOString(),
      });
      await setRedisTTL(`outgoing-tx-${gasFundingResult.txId}`, 7200);
    }

    // FIX: Verify merchant transaction was actually mined for account-based chains
    // This prevents marking payment complete when TX is stuck due to low gas
    // CRITICAL FIX: For TRON, also check contractResult — a TX in a block can have
    // OUT_OF_ENERGY meaning tokens didn't actually move despite "confirmation"
    if (["ETH", "BSC", "TRX", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "USDT-TRC20", "SOL", "XRP", "RLUSD", "POLYGON", "USDT-POLYGON"].includes(currency)) {
      const txHash = merchantTransactionDetails?.txId;
      if (txHash) {
        cronLogger.info(`[settleCryptoTransaction] Waiting for TX confirmation: ${txHash}`);
        const confirmResult = await tatumApi.waitForTransactionConfirmation(txHash, currency, PAYMENT_TIMING.TRANSACTION_CONFIRMATION_TIMEOUT_MS);
        
        if (confirmResult.confirmed) {
          cronLogger.info(`[settleCryptoTransaction] TX ${txHash} confirmed in block ${confirmResult.blockNumber}`);
          // ── RELIABILITY: Mark settlement as completed ONLY after on-chain confirmation ──
          try {
            const { markSettlementCompleted } = require("../../services/paymentReliability");
            await markSettlementCompleted(
              paymentId,
              txHash,
              fromAddress,
              currency,
              merchantSendAmount,
              Number(receivedAmount),
              Number((tempAddressData as any).current_company_id) || null
            );
          } catch (relErr) {
            cronLogger.warn(`[settleCryptoTransaction] Non-critical: markSettlementCompleted failed: ${(relErr as Error).message}`);
          }
        } else if (confirmResult.contractResult && confirmResult.contractResult !== "SUCCESS") {
          // TRON execution failure: TX is in a block but tokens didn't move (e.g., OUT_OF_ENERGY)
          // This is a critical failure — must retry with gas re-funding
          const isTRC20Recovery = currency.includes("TRC20") || currency === "TRX";
          const MAX_RECOVERY_RETRIES = 2;
          let recovered = false;
          
          for (let recoveryAttempt = 1; recoveryAttempt <= MAX_RECOVERY_RETRIES; recoveryAttempt++) {
            cronLogger.error(`[settleCryptoTransaction] ❌ TRON TX ${txHash} EXECUTION FAILED: contractResult=${confirmResult.contractResult}. Tokens did NOT move! Recovery attempt ${recoveryAttempt}/${MAX_RECOVERY_RETRIES}...`);
            
            try {
              if (isTRC20Recovery) {
                // ── FIX: Apply global gas cap to recovery retries too ──
                // Prevents fee wallet drain when all settlement attempts fail with OUT_OF_ENERGY
                if (totalGasFundedTRX >= MAX_GAS_PER_PAYMENT_TRX) {
                  cronLogger.error(`[settleCryptoTransaction] ❌ Gas cap reached during recovery (${totalGasFundedTRX} TRX funded, cap: ${MAX_GAS_PER_PAYMENT_TRX} TRX). Stopping recovery to prevent fee wallet drain.`);
                  break;
                }
                
                // Re-fund gas with energy-aware estimation
                // FIX (2026-04-07): Pass recipient + contract for correct activation check
                cronLogger.info(`[settleCryptoTransaction] 🔋 Recovery: Re-funding TRX gas for ${fromAddress} (total gas funded: ${totalGasFundedTRX}/${MAX_GAS_PER_PAYMENT_TRX} TRX)...`);
                const recoveryTrc20Contract = process.env.TRX_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
                const recoveryDynamicFee = await calculateDynamicTRC20Fee(fromAddress, userAddress, recoveryTrc20Contract);
                totalGasFundedTRX += recoveryDynamicFee.fast;
                
                const refundResult = await merchantPoolService.fundGasIfNeeded(
                  { dataValues: { wallet_address: fromAddress }, update: async () => {} },
                  currency,
                  merchantSendAmount,
                  userAddress
                );
                
                if (refundResult.funded) {
                  cronLogger.info(`[settleCryptoTransaction] ✅ Recovery: Gas re-funded (${refundResult.amount} TRX, TX: ${refundResult.txId}). Waiting for confirmation...`);
                  // Wait for gas TX to confirm on TRON
                  await new Promise(resolve => setTimeout(resolve, 8000));
                } else {
                  cronLogger.warn(`[settleCryptoTransaction] ⚠️ Recovery: Gas re-funding skipped (${refundResult.reason}). Retrying transfer anyway...`);
                }
              }
              
              // Retry the merchant transfer
              const retryResult = await tatumApi.assetToOtherAddress({
                currency,
                fromAddress: fromAddress,
                toAddress: userAddress,
                privateKey: privateKey,
                amount: merchantSendAmount,
                fee: fees,
                destinationTag: merchantDestinationTag,
              });
              
              if (retryResult?.txId) {
                cronLogger.info(`[settleCryptoTransaction] 🔄 Recovery: New TX ${retryResult.txId}. Verifying...`);
                
                // Mark new TX as outgoing
                await setRedisItem(`outgoing-tx-${retryResult.txId}`, {
                  type: "settlement-recovery",
                  fromAddress: fromAddress,
                  toAddress: userAddress,
                  amount: merchantSendAmount,
                  currency,
                  originalTxHash: txHash,
                  recoveryAttempt,
                  markedAt: new Date().toISOString(),
                });
                await setRedisTTL(`outgoing-tx-${retryResult.txId}`, 7200);
                
                // Wait and verify the recovery TX
                const recoveryConfirm = await tatumApi.waitForTransactionConfirmation(retryResult.txId, currency, PAYMENT_TIMING.TRANSACTION_CONFIRMATION_TIMEOUT_MS);
                
                if (recoveryConfirm.confirmed) {
                  cronLogger.info(`[settleCryptoTransaction] ✅ RECOVERY SUCCESSFUL: TX ${retryResult.txId} confirmed in block ${recoveryConfirm.blockNumber}. Merchant transfer completed.`);
                  merchantTransactionDetails = retryResult; // Update with successful TX
                  // ── RELIABILITY: Mark settlement as completed after recovery confirmation ──
                  try {
                    const { markSettlementCompleted } = require("../../services/paymentReliability");
                    await markSettlementCompleted(
                      paymentId,
                      retryResult.txId,
                      fromAddress,
                      currency,
                      merchantSendAmount,
                      Number(receivedAmount),
                      Number((tempAddressData as any).current_company_id) || null
                    );
                  } catch (relErr) {
                    cronLogger.warn(`[settleCryptoTransaction] Non-critical: markSettlementCompleted (recovery) failed: ${(relErr as Error).message}`);
                  }
                  recovered = true;
                  break;
                } else if (recoveryConfirm.contractResult && recoveryConfirm.contractResult !== "SUCCESS") {
                  cronLogger.error(`[settleCryptoTransaction] ❌ Recovery TX also failed: contractResult=${recoveryConfirm.contractResult}`);
                } else {
                  cronLogger.warn(`[settleCryptoTransaction] ⚠️ Recovery TX ${retryResult.txId} not confirmed in time`);
                }
              }
            } catch (recoveryError) {
              cronLogger.error(`[settleCryptoTransaction] ❌ Recovery attempt ${recoveryAttempt} failed: ${getErrorMessage(recoveryError)}`);
            }
          }
          
          if (!recovered) {
            // All recovery attempts failed — throw to prevent false payout_complete
            throw new Error(`TRON merchant transfer EXECUTION FAILED (contractResult=${confirmResult.contractResult}). TX ${txHash} was included in block ${confirmResult.blockNumber} but tokens did NOT move. ${MAX_RECOVERY_RETRIES} recovery attempts failed. Total gas burned: ${totalGasFundedTRX} TRX. Funds are still on temp address ${fromAddress}. Manual recovery required via /diagnostics/recover-stuck-payment.`);
          }
        } else if (!confirmResult.confirmed) {
          cronLogger.error(`[settleCryptoTransaction] WARNING: TX ${txHash} not confirmed within timeout!`);
          // Don't throw for timeout - allow flow to continue but log the issue
          // The sweep will detect unspent balance and retry later
          // Still mark as completed — TX was broadcast and may confirm later
          try {
            const { markSettlementCompleted } = require("../../services/paymentReliability");
            await markSettlementCompleted(
              paymentId,
              txHash,
              fromAddress,
              currency,
              merchantSendAmount,
              Number(receivedAmount),
              Number((tempAddressData as any).current_company_id) || null
            );
          } catch (relErr) {
            cronLogger.warn(`[settleCryptoTransaction] Non-critical: markSettlementCompleted (timeout) failed: ${(relErr as Error).message}`);
          }
        }
      }
    }

    // ── RELIABILITY: For chains that don't go through the confirmation check above
    // (UTXO chains like BTC, LTC, DOGE, BCH), mark settlement as completed here.
    // Account-based chains already had markSettlementCompleted called inside the
    // confirmation/recovery blocks above.
    const accountBasedChains = ["ETH", "BSC", "TRX", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "USDT-TRC20", "SOL", "XRP", "RLUSD", "POLYGON", "USDT-POLYGON"];
    if (!accountBasedChains.includes(currency) && merchantTransactionDetails?.txId) {
      try {
        const { markSettlementCompleted } = require("../../services/paymentReliability");
        await markSettlementCompleted(
          paymentId,
          merchantTransactionDetails.txId,
          fromAddress,
          currency,
          merchantSendAmount,
          Number(receivedAmount),
          Number((tempAddressData as any).current_company_id) || null
        );
      } catch (relErr) {
        cronLogger.warn(`[settleCryptoTransaction] Non-critical: markSettlementCompleted (UTXO) failed: ${(relErr as Error).message}`);
      }
    }

    return {
      transactionDetails: merchantTransactionDetails,  // Now this is merchant tx, not admin
      userTransactionDetails: null,  // No separate user tx needed
      sendAmount: merchantSendAmount,
      blockchainFee: totalBlockchainFee,
      // FIX (2026-04-10): In same-wallet combined mode, admin fee is included in the single TX
      // → nothing left on temp address to sweep. Otherwise, admin fee stays for sweep as before.
      adminFeeRetained: (isSameWallet && receivedAmount && receivedAmount > 0) ? 0 : Number(receivedAmount),
      gasFunded: gasFundingResult.amount || 0,  // SmartGas: amount of TRX/ETH funded
      gasFundingTxId: gasFundingResult.txId || null,  // SmartGas: gas funding TX hash
    };
  } catch (error) {
    const message = getErrorMessage(error);
    
    // ── RELIABILITY: Mark settlement as failed to allow retry ──
    try {
      const { markSettlementFailed } = require("../../services/paymentReliability");
      await markSettlementFailed(paymentId, message);
    } catch (_) { /* non-critical */ }
    
    apiLogger.error(
      "Failed to transfer funds",
      {
        currency,
        tempAddress: fromAddress,
        receivedAmount,
        userAmount,
        error: message,
      },
      new Error(error instanceof Error ? error.message : String(error))
    );
    throw error;
  }
};

const verifyCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { address, destination_tag } = req.body;
    const userData = jwt.decode(res.locals.token) as { ref?: string; transaction_id?: string; [key: string]: unknown } | null;
    
    cronLogger.info("[verifyCryptoPayment] Checking address:", address, destination_tag ? `tag: ${destination_tag}` : '', `session: ${userData?.ref || 'unknown'}`);
    
    // SECURE: Resolve destination_tag from customer session if not provided
    // For tag-based chains (XRP, RLUSD), the same master address handles many concurrent payments.
    // The only secure way to identify the correct payment is via the destination_tag,
    // which is stored in the customer session (customer-{ref}) under active_crypto_address.
    let resolvedTag = destination_tag ? Number(destination_tag) : null;
    
    if (!resolvedTag && userData?.ref) {
      try {
        const customerSessionKey = `customer-${userData.ref}`;
        const customerSession = await getRedisItem(customerSessionKey);
        // Priority: active_crypto_address.destination_tag (most recent user action) > top-level destination_tag (set by settlement)
        // This prevents stale tags from previous payments interfering with current session
        const sessionTag = customerSession?.active_crypto_address?.destination_tag || customerSession?.destination_tag;
        if (sessionTag) {
          resolvedTag = Number(sessionTag);
          cronLogger.info(`[verifyCryptoPayment] Resolved destination_tag ${resolvedTag} from session ${customerSessionKey}`);
        }
      } catch (sessionErr) {
        cronLogger.info("[verifyCryptoPayment] Session lookup error:", sessionErr);
      }
    }
    
    // Build Redis key using resolved tag (secure, session-specific)
    const verifyRedisKey = resolvedTag ? getCryptoRedisKey(address, resolvedTag) : `crypto-${address}`;
    const tempData = await getRedisItem(verifyRedisKey);
    
    cronLogger.info("[verifyCryptoPayment] Redis key:", verifyRedisKey, "data:", tempData?.status, tempData?.txId ? "has txId" : "no txId");
    
    if (!tempData || Object.keys(tempData).length === 0) {
      // No payment data found - payment hasn't been initiated or address is invalid
      cronLogger.info("[verifyCryptoPayment] No Redis data found for address");
      return successResponseHelper(res, 200, "Waiting for payment", {
        status: "waiting",
        message: "No payment detected yet"
      });
    }
    
    const redisStatus = tempData?.status;
    const parsedState = parseState(redisStatus); // Formal state from state machine
    const expectedAmount = parseFloat(tempData?.amount || '0');
    const receivedAmount = parseFloat(tempData?.receivedAmount || '0');
    const previousAmount = parseFloat(tempData?.previousAmount || '0');
    const currency = tempData?.currency;
    
    // Get customer data for payment link info
    const customerData = await getRedisItem(tempData?.ref);
    
    // Calculate remaining seconds from payment link expiry or partial payment timestamp
    let remainingSeconds = PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES * 60; // Default from centralized config
    let gracePeriodMinutes = 30; // Default grace period for underpayment completion
    
    // Default merchant settings
    let merchantOverpaymentThreshold = 5; // Default $5 overpayment threshold
    let merchantUnderpaymentThreshold = 1; // Default $1 underpayment threshold
    
    // Try to fetch merchant-specific settings from company
    if (customerData?.company_id || tempData?.company_id) {
      try {
        const company = await companyModel.findOne({
          where: { company_id: customerData?.company_id || tempData?.company_id }
        });
        if (company?.dataValues?.overpayment_threshold_usd !== undefined && 
            company?.dataValues?.overpayment_threshold_usd !== null) {
          merchantOverpaymentThreshold = parseFloat(company.dataValues.overpayment_threshold_usd);
        }
        if (company?.dataValues?.underpayment_threshold_usd !== undefined && 
            company?.dataValues?.underpayment_threshold_usd !== null) {
          merchantUnderpaymentThreshold = parseFloat(company.dataValues.underpayment_threshold_usd);
        }
        if (company?.dataValues?.grace_period_minutes !== undefined && 
            company?.dataValues?.grace_period_minutes !== null) {
          gracePeriodMinutes = Math.min(parseInt(company.dataValues.grace_period_minutes), 30); // Max 30 minutes
        }
      } catch (e) {
        cronLogger.info("[verifyCryptoPayment] Could not fetch merchant settings:", e);
      }
    }
    
    const merchantSettings = {
      overpayment_threshold_usd: merchantOverpaymentThreshold,
      underpayment_threshold_usd: merchantUnderpaymentThreshold,
      grace_period_minutes: gracePeriodMinutes,
    };
    
    // FIX: Use crypto_invoice_expires_at from Redis for accurate countdown
    // This is the 15-minute window from when crypto payment was initiated
    // NOT the payment link expiry (which could be 7 days)
    if (tempData?.crypto_invoice_expires_at) {
      const cryptoExpiresAt = new Date(tempData.crypto_invoice_expires_at);
      const now = new Date();
      remainingSeconds = Math.max(0, Math.floor((cryptoExpiresAt.getTime() - now.getTime()) / 1000));
      cronLogger.info(`[verifyCryptoPayment] Using crypto invoice expiry: ${tempData.crypto_invoice_expires_at}, remaining: ${remainingSeconds}s`);
    } else {
      // Fallback: Try to get payment link expiry (legacy behavior)
      const linkId = customerData?.payment_link_id;
      const paymentId = tempData?.payment_id;
      
      if (linkId || paymentId) {
        try {
          // Build where clause only with valid values
          const whereConditions: Array<Record<string, unknown>> = [];
          if (linkId && linkId !== undefined && linkId !== null) {
            whereConditions.push({ link_id: linkId });
          }
          if (paymentId && paymentId !== undefined && paymentId !== null) {
            whereConditions.push({ transaction_id: paymentId });
          }
          
          if (whereConditions.length > 0) {
            const paymentLink = await paymentLinkModel.findOne({
              where: {
                [Op.or]: whereConditions
              }
            });
            
            if (paymentLink) {
              const linkData = paymentLink.dataValues;
              // FIX: For crypto invoice, use 15 minutes from creation, NOT payment link expiry
              const createdAt = new Date(linkData.createdAt);
              const cryptoWindowMinutes = String(tempData?.incomplete) === "true" ? gracePeriodMinutes : 15;
              const expiresAt = new Date(createdAt.getTime() + cryptoWindowMinutes * 60 * 1000);
              const now = new Date();
              remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
            }
          }
        } catch (e) {
          cronLogger.info("[verifyCryptoPayment] Could not fetch payment link expiry:", e);
        }
      }
    }
    
    // For partial payments, calculate remaining time from partial payment timestamp
    if (String(tempData?.incomplete) === "true" && tempData?.partialPaymentTimestamp) {
      const partialTimestamp = new Date(tempData.partialPaymentTimestamp);
      const graceExpiresAt = new Date(partialTimestamp.getTime() + gracePeriodMinutes * 60 * 1000);
      const now = new Date();
      remainingSeconds = Math.max(0, Math.floor((graceExpiresAt.getTime() - now.getTime()) / 1000));
    }
    
    // Get base currency info for USD conversion
    // FIX: Also check customerData for base_amount since tempData may not have it stored
    // FIX: The crypto-{address} Redis key stores as 'base_amount_usd', not 'base_amount'
    const baseCurrency = tempData?.base_currency || customerData?.base_currency || "USD";
    const baseAmount = parseFloat(tempData?.base_amount || tempData?.base_amount_usd || customerData?.base_amount || "0");
    
    // IMPORTANT: Check for SUCCESSFUL status FIRST before checking underpaid
    // This prevents returning stale underpaid data after payment completes
    if (parsedState === PaymentState.PAYOUT_COMPLETE) {
      // Payment confirmed - check for overpayment
      const totalReceived = receivedAmount > 0 ? receivedAmount : parseFloat(tempData?.amount || '0');
      const originalExpected = tempData?.originalExpectedAmount ? parseFloat(tempData.originalExpectedAmount) : expectedAmount;
      const isOverpayment = totalReceived > originalExpected && originalExpected > 0;
      const overpaymentAmount = isOverpayment ? (totalReceived - originalExpected) : 0;
      
      // Calculate overpayment in USD to compare against threshold
      // Only flag as "overpaid" if excess exceeds merchant's overpayment_threshold_usd
      let overpaymentUsd = 0;
      if (isOverpayment && originalExpected > 0 && baseAmount > 0) {
        overpaymentUsd = (overpaymentAmount / originalExpected) * baseAmount;
      }
      const isSignificantOverpayment = isOverpayment && overpaymentUsd > merchantOverpaymentThreshold;
      
      // FIXED: Don't re-call cryptoVerification if already processed - just return the status
      // The payment was already distributed when status became "successful"
      cronLogger.info("[verifyCryptoPayment] Payment already successful, returning confirmed status");
      cronLogger.info(`[verifyCryptoPayment] Overpayment check: excess=${overpaymentAmount.toFixed(8)} ${currency}, excessUsd=$${overpaymentUsd.toFixed(2)}, threshold=$${merchantOverpaymentThreshold}, significant=${isSignificantOverpayment}`);
      
      // Get redirect URL from customerData if available
      let redirectUrl = null;
      if (customerData?.redirect_uri) {
        redirectUrl = customerData.redirect_uri + 
          `?transaction_id=${tempData.payment_id || tempData.unique_tx_id}&status=successful&payment_type=CRYPTO`;
      }
      
      // Calculate USD amounts — use base_amount from customer data if available
      const actualBaseAmount = baseAmount > 0 ? baseAmount : parseFloat(customerData?.base_amount || tempData?.base_amount || '0');
      let paidAmountUsd = 0;
      let expectedAmountUsd = actualBaseAmount;
      
      if (totalReceived > 0 && originalExpected > 0 && actualBaseAmount > 0) {
        paidAmountUsd = actualBaseAmount * (totalReceived / originalExpected);
        expectedAmountUsd = actualBaseAmount;
      }
      
      // Build response matching checkout page expected format
      // Checkout expects: status "confirmed" for success, "overpaid" only for significant overpayments
      // Minor overpayments (below merchant threshold) are treated as normal "confirmed"
      const responseData: Record<string, unknown> = {
        status: isSignificantOverpayment ? "overpaid" : "confirmed",
        payment_status: isSignificantOverpayment ? "overpaid" : "confirmed",
        message: isSignificantOverpayment ? "Payment confirmed with overpayment" : "Payment confirmed",
        redirect: redirectUrl,
        txId: tempData.txId,
        paidAmount: parseFloat(totalReceived.toFixed(6)),
        expectedAmount: parseFloat(originalExpected.toFixed(6)),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // USD amounts
        paidAmountUsd: parseFloat(paidAmountUsd.toFixed(2)),
        expectedAmountUsd: parseFloat(expectedAmountUsd.toFixed(2)),
        baseCurrency: baseCurrency,
        completedAt: tempData.completedAt,
        // Timer and settings (for consistency across all responses)
        remaining_seconds: 0, // Payment complete, no time remaining
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings,
      };

      if (isSignificantOverpayment) {
        responseData.excessAmount = parseFloat(overpaymentAmount.toFixed(6));
        responseData.excessAmountUsd = parseFloat(overpaymentUsd.toFixed(2));
      }

      // DEBUG: Log the exact response being sent
      cronLogger.info("[verifyCryptoPayment] Sending CONFIRMED response:", JSON.stringify(responseData, null, 2));

      return successResponseHelper(res, 200, responseData.message as string, responseData);
    }
    
    // Check if this is a partial payment scenario (incomplete flag set OR underpaid status)
    // Only return underpaid if NOT already successful
    // Redis stores values as strings, so convert to string for comparison
    if (String(tempData?.incomplete) === "true" || parsedState === PaymentState.UNDERPAID) {
      // Use originalExpectedAmount if available (set by webhook), otherwise calculate from previousAmount
      const originalExpected = parseFloat(tempData?.originalExpectedAmount || '0') || (expectedAmount + previousAmount);
      const totalPaid = previousAmount > 0 ? previousAmount : receivedAmount;
      const remainingAmount = originalExpected - totalPaid;
      
      // Calculate USD amounts for underpayment
      let paidAmountUsd = 0;
      let expectedAmountUsd = baseAmount;
      let remainingAmountUsd = 0;
      
      // Use customerData already fetched above
      const actualBaseAmount = baseAmount > 0 ? baseAmount : parseFloat(customerData?.base_amount || "0");
      
      if (totalPaid > 0 && originalExpected > 0 && actualBaseAmount > 0) {
        const paidRatio = totalPaid / originalExpected;
        paidAmountUsd = actualBaseAmount * paidRatio;
        expectedAmountUsd = actualBaseAmount;
        remainingAmountUsd = actualBaseAmount - paidAmountUsd;
      }
      
      cronLogger.info(`[verifyCryptoPayment] Underpayment detected:
        - Total Paid: ${totalPaid} ${currency}
        - Original Expected: ${originalExpected} ${currency}
        - Remaining: ${remainingAmount} ${currency}
        - Paid USD: $${paidAmountUsd.toFixed(2)}
        - Expected USD: $${expectedAmountUsd.toFixed(2)}
        - Remaining USD: $${remainingAmountUsd.toFixed(2)}
        - Remaining Seconds: ${remainingSeconds}`);
      
      // FIXED: Use "underpaid" status and camelCase fields to match checkout page expectations
      return successResponseHelper(res, 200, "Partial payment received", {
        status: "underpaid",
        payment_status: "underpaid",
        message: "Partial payment received. Please pay the remaining amount.",
        paidAmount: parseFloat(totalPaid.toFixed(6)),
        expectedAmount: parseFloat(originalExpected.toFixed(6)),
        remainingAmount: parseFloat(remainingAmount.toFixed(6)),
        currency: currency,
        // USD amounts
        paidAmountUsd: parseFloat(paidAmountUsd.toFixed(2)),
        expectedAmountUsd: parseFloat(expectedAmountUsd.toFixed(2)),
        remainingAmountUsd: parseFloat(remainingAmountUsd.toFixed(2)),
        baseCurrency: baseCurrency || customerData?.base_currency || "USD",
        txId: tempData?.previousTxId || tempData?.txId,
        address: address, // Include address so user can send remaining payment
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // NEW: Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings,
        partial_payment_timestamp: tempData?.partialPaymentTimestamp
      });
    }
    
    // Return status based on Redis state (using PaymentState enum)
    // Status flow: pending -> processing -> successful OR failed
    if (parsedState === PaymentState.PENDING && !tempData?.txId) {
      // Payment initiated but no transaction detected yet
      return successResponseHelper(res, 200, "Waiting for payment", {
        status: "waiting",
        payment_status: "waiting",
        message: "Payment address generated, waiting for transaction",
        expected_amount: expectedAmount.toFixed(6),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // NEW: Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    if (parsedState === PaymentState.PENDING && tempData?.txId) {
      // Transaction detected but not yet processed (legacy state)
      return successResponseHelper(res, 200, "Payment pending", {
        status: "pending",
        payment_status: "pending",
        message: "Payment detected, awaiting confirmation",
        txId: tempData.txId,
        amount: tempData.receivedAmount || tempData.amount,
        expected_amount: expectedAmount.toFixed(6),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    if (parsedState === PaymentState.PROCESSING) {
      // Transaction detected and being processed
      return successResponseHelper(res, 200, "Payment pending", {
        status: "pending",
        payment_status: "pending",
        message: "Payment detected, awaiting confirmation",
        txId: tempData.txId,
        amount: tempData.receivedAmount || tempData.amount,
        expected_amount: expectedAmount.toFixed(6),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    if (parsedState === PaymentState.FAILED) {
      return successResponseHelper(res, 200, "Payment failed", {
        status: "failed",
        payment_status: "failed",
        message: tempData.lastError || "Payment processing failed",
        txId: tempData.txId,
        // Timer and settings (for consistency)
        remaining_seconds: 0,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    // Fallback - try original verification with the resolved tag-based key
    const result = await cryptoVerification(address, false, verifyRedisKey !== `crypto-${address}` ? verifyRedisKey : undefined);
    cronLogger.info("result===========>", result, address);
    const { message, status } = result;
    if (status === 500) {
      errorResponseHelper(res, status, message);
    } else {
      const returnData =
        typeof result === "object" && result !== null && "resData" in result
          ? (result as { resData: unknown }).resData
          : result;
      successResponseHelper(res, status, "Success", returnData);
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const cryptoVerification = async (address, webhook = true, overrideRedisKey?: string) => {
  const transaction = await sequelize.transaction();
  let transactionFinished = false; // Track commit/rollback state to prevent double-finishing

  try {
    let customerData;
    const cryptoKey = overrideRedisKey || `crypto-${address}`;
    const tempData = await getRedisItem(cryptoKey);

    if (tempData && Object.keys(tempData).length > 0) {
      customerData = await getRedisItem(tempData?.ref);
    }
    const transactionId = tempData?.txId;
    const tempCurrency = tempData?.currency;

    // CRITICAL FIX: Check for duplicate transaction processing
    if (transactionId) {
      const existingTransaction = await customerTransactionModel.findOne({
        where: {
          transaction_reference: transactionId,
          status: { [Op.in]: ["successful", "completed"] }
        }
      });

      if (existingTransaction) {
        cronLogger.warn(`[cryptoVerification] ⚠️  DUPLICATE WEBHOOK DETECTED: ${transactionId}`);
        cronLogger.warn(`[cryptoVerification] Transaction already processed, ignoring webhook`);
        transactionFinished = true;
        await transaction.rollback();
        return {
          status: 200,
          message: "Transaction already processed",
          duplicate: true,
          txId: transactionId
        };
      }
    }

    if (transactionId) {
      // Validate customerData exists and has required fields
      if (!customerData || !customerData.adm_id) {
        cronLogger.warn(`[cryptoVerification] ⚠️  Missing customerData or adm_id for address: ${address}`);
        cronLogger.warn(`[cryptoVerification] customerData:`, JSON.stringify(customerData));
        cronLogger.warn(`[cryptoVerification] tempData:`, JSON.stringify(tempData));
        
        // Try to find payment info from merchant pool address
        const poolAddress = await merchantTempAddressModel.findOne({
          where: { wallet_address: address },
          transaction,
        });
        
        if (poolAddress && poolAddress.dataValues.owner_user_id) {
          cronLogger.info(`[cryptoVerification] Found pool address, using owner_user_id: ${poolAddress.dataValues.owner_user_id}`);
          customerData = customerData || {};
          customerData.adm_id = poolAddress.dataValues.owner_user_id;
          customerData.company_id = poolAddress.dataValues.current_company_id;
        } else {
          transactionFinished = true;
          await transaction.rollback();
          return {
            status: 400,
            message: "Payment session expired or invalid. Customer data not found.",
            address: address
          };
        }
      }

      // Multi-tenant fix: Include company_id in wallet lookup to ensure funds go to correct company
      const whereClause: Record<string, unknown> = {
        user_id: customerData.adm_id,
        wallet_type: tempCurrency,
        wallet_address: { [Op.not]: null },
      };
      
      cronLogger.info(`[cryptoVerification] Wallet lookup DEBUG:
        - user_id (adm_id): ${customerData.adm_id}
        - wallet_type: ${tempCurrency}
        - company_id from customerData: ${customerData.company_id}
      `);
      
      // Handle company_id: if provided and valid, add to query
      // MULTI-TENANT FIX: Require company_id for proper isolation
      if (customerData.company_id && customerData.company_id !== '' && customerData.company_id !== 'undefined' && customerData.company_id !== 'null') {
        const companyId = parseInt(customerData.company_id);
        if (!isNaN(companyId)) {
          whereClause.company_id = companyId;
        }
      }
      // Note: If company_id not set, we don't add it to whereClause - allowing any wallet for this user
      
      cronLogger.info(`[cryptoVerification] Final whereClause:`, JSON.stringify(whereClause));
      
      let walletData = await userWalletModel.findOne({
        where: whereClause,
        transaction,
      });
      
      // MULTI-TENANT FIX: Do NOT fallback without company_id - log error instead
      if (!walletData && whereClause.company_id) {
        cronLogger.error(`[cryptoVerification] ❌ MULTI-TENANT: No wallet found for company_id ${whereClause.company_id}. NOT falling back to avoid cross-company payment routing.`);
        // Instead of removing company_id constraint, we fail safely
        transactionFinished = true;
        await transaction.rollback();
        return {
          status: 400,
          message: `No wallet configured for this company and currency (${tempCurrency}). Please configure a ${tempCurrency} wallet for this company.`,
          company_id: whereClause.company_id,
          currency: tempCurrency
        };
      }
      
      cronLogger.info(`[cryptoVerification] walletData result:`, walletData ? walletData.dataValues : 'NULL');
      const receivedAmount = Number(tempData?.receivedAmount ?? tempData?.amount ?? 0);

      let product_name;

      if (customerData?.meta_data) {
        const meta_data = JSON.parse(customerData?.meta_data);
        product_name = meta_data?.product_name ?? meta_data?.product;
      }

      const company_data = (
        await companyModel.findOne({
          where: { company_id: customerData.company_id || tempData?.company_id },
        })
      )?.dataValues;

      const baseCurrency = customerData?.base_currency || company_data?.settlement_currency || 'USD';
      const finalAmount = await currencyConvert({
        sourceCurrency: tempData?.currency,
        currency: [baseCurrency],
        amount: receivedAmount,
        fixedDecimal: false,
      });

      cronLogger.info("finalAmount=========>", finalAmount[0]);

      const customerPayload = {
        id: tempData?.incomplete && tempData?.customerInternalRef ? tempData.customerInternalRef : crypto.randomUUID(),
        company_id: Number(customerData.company_id || tempData?.company_id),
        customer_id: customerData.customer_id ? Number(customerData.customer_id) : null,
        payment_mode: "CRYPTO",
        base_amount: Number(finalAmount[0].amount).toFixed(2),
        base_currency: baseCurrency,
        paid_amount: Number(receivedAmount).toFixed(6),
        paid_currency: tempCurrency,
        transaction_reference: transactionId,
        unique_tx_id: tempData?.payment_id || tempData?.unique_tx_id || customerData?.payment_id,
        transaction_type: customerData?.pathType?.includes("addFund")
          ? "CREDIT"
          : "PAYMENT",
        ...(!customerData?.pathType?.includes("addFund") && {
          transaction_details: product_name
            ? "Made payment for " + product_name + " on " + company_data?.company_name
            : "Made payment for " + (company_data?.company_name || "Company") + " product",
        }),
        status: tempData.status,
        language: normalizeLang(tempData?.language || customerData?.language),
      };

      await customerTransactionModel.create(
        { ...customerPayload },
        { transaction }
      );

      let tempAddressData;
      let isMerchantPoolAddress = false;
      
      if (tempData.temp_id) {
        // Check if it's a merchant pool address first
        // Redis stores values as strings, so convert to string for comparison
        const isMerchantPoolFlag = String(tempData.is_merchant_pool) === "true";
        if (isMerchantPoolFlag) {
          tempAddressData = await merchantTempAddressModel.findOne({
            where: { temp_address_id: tempData.temp_id },
          });
          isMerchantPoolAddress = true;
          cronLogger.info(`[cryptoVerification] Found MERCHANT POOL address: ${address}`);
        } else {
          tempAddressData = await userTempAddressModel.findOne({
            where: { temp_id: tempData.temp_id },
          });
        }
      } else {
        // Try merchant pool first by wallet address
        const merchantPoolAddress = await merchantTempAddressModel.findOne({
          where: { wallet_address: address },
        });
        
        if (merchantPoolAddress) {
          tempAddressData = merchantPoolAddress.dataValues;
          isMerchantPoolAddress = true;
          cronLogger.info(`[cryptoVerification] Found MERCHANT POOL address by wallet: ${address}`);
        } else {
          // Fallback to legacy userTempAddressModel
          const tempAddressWhereClause: Record<string, unknown> = {
            wallet_address: address,
            wallet_type: tempCurrency,
          };
          
          // Add user_id for better isolation
          if (customerData?.adm_id) {
            tempAddressWhereClause.user_id = customerData.adm_id;
          }
          
          // Add company_id if present
          if (customerData?.company_id && customerData.company_id !== '' && 
              customerData.company_id !== 'undefined' && customerData.company_id !== 'null') {
            const companyId = parseInt(customerData.company_id);
            if (!isNaN(companyId)) {
              tempAddressWhereClause.company_id = companyId;
            }
          }
          
          const tempAddressDataArray = await userTempAddressModel.findAll({
            where: tempAddressWhereClause,
            order: [['created_at', 'DESC']],
          });
          
          if (!tempAddressDataArray || tempAddressDataArray.length === 0) {
            throw new Error(`No temp address found for ${address}`);
          }
          
          tempAddressData = tempAddressDataArray[0].dataValues;
        }
      }
      
      // Store merchant pool flag in tempData for later use (as string for Redis compatibility)
      tempData.is_merchant_pool = String(isMerchantPoolAddress);

      // ── FIX: Propagate real payment_id to settlement for idempotency ──
      // Merchant pool addresses store payment_id as current_payment_id.
      // Without this, settleCryptoTransaction falls back to `unknown-${Date.now()}`
      // which breaks idempotency checks and causes duplicate settlements.
      if (!tempAddressData.payment_id) {
        tempAddressData.payment_id = tempAddressData.current_payment_id || tempData?.payment_id || null;
      }

      const isFullPayment = Number(receivedAmount) >= Number(tempData?.amount);
      const isPartialPayment = Number(receivedAmount) < Number(tempData?.amount) && !webhook;

      if (isPartialPayment) {
        const pendingAmount = (Number(tempData?.amount) - Number(receivedAmount)).toFixed(8);
        const expectedAmount = Number(tempData?.amount) + (tempData?.previousAmount ? Number(tempData.previousAmount) : 0);

        // ENHANCED LOGGING: Partial payment accumulation tracking
        cronLogger.info(`[cryptoVerification] 📊 PARTIAL PAYMENT DETECTED:
          - Address: ${address}
          - Transaction ID: ${transactionId}
          - Payment #: ${tempData?.previousTxId ? '2+' : '1'}
          - This Payment: ${receivedAmount} ${tempCurrency}
          - Previous Payments: ${tempData?.previousAmount || 0} ${tempCurrency}
          - Total Accumulated: ${Number(receivedAmount) + Number(tempData?.previousAmount || 0)} ${tempCurrency}
          - Expected Total: ${expectedAmount} ${tempCurrency}
          - Remaining: ${pendingAmount} ${tempCurrency}
          - Grace Period: 30 minutes`);

        await userTempAddressModel.update(
          {
            txId: tempAddressData.txId ? tempAddressData.txId + "," + transactionId : transactionId,
            status: "partial",
            amount: receivedAmount,
            partial_payment_timestamp: tempAddressData.partial_payment_timestamp ?? new Date(),
          },
          { where: { temp_id: tempAddressData.temp_id } }
        );

        // Send partial payment notification
        await sendPartialPaymentNotification(
          address,
          transactionId,
          Number(receivedAmount),
          expectedAmount,
          tempCurrency,
          customerData,
          PAYMENT_TIMING.GRACE_PERIOD_MINUTES
        );

        const { txId, ...rest } = tempData;
        const redisPayload = {
          ...rest,
          amount: pendingAmount,
          previousAmount: receivedAmount,
          previousTxId: transactionId,
          customerInternalRef: customerPayload.id,
          userInternalRef: tempData.unique_tx_id || tempData.payment_id,  // FIX: Support both field names
          incomplete: "true",
          partialPaymentTimestamp: new Date().toISOString(),
        };

        await deleteRedisItem(cryptoKey);
        await setRedisItem(cryptoKey, redisPayload);

        // PHASE 12: Also update customer Redis key with incomplete payment info
        // This enables blocking currency switching until payment is complete or expired
        const customerRef = tempData.ref;
        if (customerRef) {
          const customerData = await getRedisItem("customer-" + customerRef);
          if (customerData) {
            // Generate QR code with currency logo — include destination tag for XRP/RLUSD
            let qrCode;
            try {
              const qrPayload = tempData.destination_tag ? `${address}?dt=${tempData.destination_tag}` : address;
              qrCode = await generateQRCodeWithLogo(qrPayload, tempCurrency, 400);
            } catch (e) {
              cronLogger.info('[Phase 12] QR code generation failed:', e);
            }
            
            const updatedCustomerData = {
              ...customerData,
              incomplete_payment: {
                currency: tempCurrency,
                address: address,
                pending_amount: pendingAmount,
                previous_amount: receivedAmount,
                timestamp: new Date().toISOString(),
                qr_code: qrCode,
                // XRP/RLUSD: Persist destination tag for tag-based chains
                ...(tempData.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
              }
            };
            await setRedisItem("customer-" + customerRef, updatedCustomerData);
            cronLogger.info(`[Phase 12] Updated customer-${customerRef} with incomplete payment info: ${pendingAmount} ${tempCurrency}${tempData.destination_tag ? ` (tag: ${tempData.destination_tag})` : ''}`);
          }
        }

        transactionFinished = true;
        await transaction.commit();

        throw {
          status: 200,
          paymentStatus: "incomplete",
          amount: pendingAmount,
          currency: tempCurrency,
          message: `Partial payment detected! Please pay remaining ${pendingAmount} ${tempCurrency} to complete this payment. You have ${PAYMENT_TIMING.GRACE_PERIOD_MINUTES} minutes to complete the payment.`,
          commit: true,
        };
      }

      if (isFullPayment || webhook) {
        // FIX: For completion payments, use receivedAmount directly as it's already the cumulative total
        // The webhook handler updates receivedAmount to be (previousAmount + newPayment)
        // So we should NOT add previousAmount again here
        const totalAmountReceived = Number(receivedAmount);

        // ENHANCED LOGGING: Payment completion tracking
        const wasPartialPayment = tempData?.previousAmount && Number(tempData.previousAmount) > 0;
        const originalExpected = Number(tempData?.originalExpectedAmount || tempData?.amount || 0);
        const isUnderpaid = totalAmountReceived < originalExpected && originalExpected > 0;
        const underpaymentDelta = isUnderpaid ? (originalExpected - totalAmountReceived) : 0;

        let paymentLabel: string;
        if (wasPartialPayment) {
          paymentLabel = 'COMPLETED (after partial)';
        } else if (isUnderpaid) {
          paymentLabel = 'RECEIVED (underpaid — accepted via Direct API tolerance)';
        } else {
          paymentLabel = 'RECEIVED (full)';
        }

        cronLogger.info(`[cryptoVerification] ✅ PAYMENT ${paymentLabel}:
          - Address: ${address}
          - Transaction ID: ${transactionId}
          - Total Received: ${totalAmountReceived} ${tempCurrency}
          - Previous Payments: ${tempData?.previousAmount || 0} ${tempCurrency}
          - Was Partial: ${wasPartialPayment ? 'YES' : 'NO'}
          - Original Expected: ${originalExpected} ${tempCurrency}${isUnderpaid ? `\n          - Underpayment Shortfall: ${underpaymentDelta.toFixed(8)} ${tempCurrency} (${((underpaymentDelta / originalExpected) * 100).toFixed(2)}%)` : ''}`);

        // Check fee_payer mode
        const fee_payer = tempData?.fee_payer || 'company';
        const merchant_amount = tempData?.merchant_amount;
        
        let adminAmountToSend, userAmountToSend;
        
        // ── IMPROVED FEE CALCULATION: Use stored base_amount_usd for tier consistency ──
        // Uses pre-calculated base_amount_usd from payment creation for fee tier selection.
        // This ensures:
        // 1. Same fee tier as quoted to the customer (consistency)
        // 2. Fees are NOT applied to the tax portion (tax passes through to merchant)
        // 3. Overpayments are distributed proportionally using pre-calculated ratios
        //
        // Previous bug: Recalculating fees on full received amount caused:
        // - Fee-on-fee for customer-pays (fees applied to amount that includes pre-paid fees)
        // - Fee-on-tax for both modes (tax portion subjected to platform fees)

        // Convert crypto amount to USD for reference
        const amountInUSD = await currencyConvert({
          sourceCurrency: tempCurrency,
          currency: [customerData?.base_currency || "USD"],
          amount: totalAmountReceived,
          fixedDecimal: false,
        });
        
        const receivedUSD = Number(amountInUSD[0].amount);
        
        // Use stored base_amount_usd for fee tier (same tier as at payment creation)
        const storedBaseAmountUSD = parseFloat(tempData?.base_amount_usd || '0');
        const storedTaxAmountUSD = parseFloat(tempData?.tax_amount_usd || '0');
        const feeCalcBasisUSD = storedBaseAmountUSD > 0 ? storedBaseAmountUSD : receivedUSD;
        
        const verifyUserId = customerData?.adm_id ? Number(customerData.adm_id) : undefined;
        const { totalDeduction, minForwarding, fixedFee, transactionFee, feeFreeApplied, feeFreeDiscount } = await calculateTransactionFees(
          tempCurrency,
          feeCalcBasisUSD,  // Use base amount for consistent fee tier selection
          verifyUserId  // Pass userId for fee-free discount
        );
        
        if (feeFreeApplied) {
          cronLogger.info(`[cryptoVerification] 🎉 Fee-free promotion applied for user ${verifyUserId}, discount: $${feeFreeDiscount?.toFixed(2)}`);
        }
        
        // Fee percentage based on BASE amount (excludes tax)
        const feePercentage = feeCalcBasisUSD > 0 ? totalDeduction / feeCalcBasisUSD : 0;

        cronLogger.info(`[cryptoVerification] Fee calculation (fee_payer=${fee_payer}):
            - Total received (crypto): ${totalAmountReceived} ${tempCurrency}
            - Total received (USD): $${receivedUSD.toFixed(2)}
            - Stored base_amount_usd: $${storedBaseAmountUSD.toFixed(2)}
            - Stored tax_amount_usd: $${storedTaxAmountUSD.toFixed(2)}
            - Fee calc basis (USD): $${feeCalcBasisUSD.toFixed(2)}
            - Pre-calculated merchant_amount: ${merchant_amount || 'N/A'} ${tempCurrency}
            - Fee Breakdown:
              • Fixed Fee: $${fixedFee?.toFixed(2) || 'N/A'} (Tier-based)
              • Transaction Fee (1.5%): $${transactionFee?.toFixed(2) || 'N/A'}
            - Total deduction (USD): $${totalDeduction}
            - Min forwarding threshold: $${minForwarding}
            - Effective Fee %: ${(feePercentage * 100).toFixed(2)}% (on base, not total)`);

        if (receivedUSD < Number(minForwarding)) {
          // Under threshold - all to admin
          adminAmountToSend = Number(totalAmountReceived);
          userAmountToSend = 0;
          cronLogger.info(`[cryptoVerification] UNDER THRESHOLD - all to admin: ${adminAmountToSend} ${tempCurrency}`);
        } else if (storedBaseAmountUSD > 0 && parseFloat(merchant_amount || '0') > 0) {
          // ── RATIO-BASED DISTRIBUTION: Scale pre-calculated amounts by actual/expected ──
          // This handles overpayments and underpayments proportionally while maintaining
          // correct fee structure from payment creation
          const expectedCrypto = parseFloat(tempData?.amount || '0');
          const preCalcMerchantAmount = parseFloat(merchant_amount);
          
          if (expectedCrypto > 0) {
            const paymentRatio = Number(totalAmountReceived) / expectedCrypto;
            userAmountToSend = preCalcMerchantAmount * paymentRatio;
            adminAmountToSend = Number(totalAmountReceived) - userAmountToSend;
            
            cronLogger.info(`[cryptoVerification] ${fee_payer === 'customer' ? 'CUSTOMER' : 'COMPANY'} PAYS FEES — RATIO-BASED DISTRIBUTION:
              - Expected: ${expectedCrypto.toFixed(8)} ${tempCurrency}
              - Payment ratio: ${paymentRatio.toFixed(4)} (${paymentRatio >= 1 ? 'exact/overpaid' : 'underpaid'})
              - Merchant: ${userAmountToSend.toFixed(8)} ${tempCurrency} (scaled from pre-calc ${preCalcMerchantAmount.toFixed(8)})
              - Admin (fees): ${adminAmountToSend.toFixed(8)} ${tempCurrency}`);
          } else {
            // Fallback: expected amount not available, use fee percentage on non-tax portion
            const taxRatio = storedTaxAmountUSD > 0 ? storedTaxAmountUSD / (storedBaseAmountUSD + storedTaxAmountUSD) : 0;
            const receivedTaxPortion = Number(totalAmountReceived) * taxRatio;
            const receivedNonTaxPortion = Number(totalAmountReceived) - receivedTaxPortion;
            adminAmountToSend = receivedNonTaxPortion * feePercentage;
            userAmountToSend = Number(totalAmountReceived) - adminAmountToSend;
            
            cronLogger.info(`[cryptoVerification] ${fee_payer === 'customer' ? 'CUSTOMER' : 'COMPANY'} PAYS FEES — FALLBACK DISTRIBUTION:
              - Admin (fees): ${adminAmountToSend.toFixed(8)} ${tempCurrency} (${(feePercentage * 100).toFixed(2)}% of non-tax portion)
              - Merchant: ${userAmountToSend.toFixed(8)} ${tempCurrency}`);
          }
        } else {
          // ── LEGACY FALLBACK: No stored data, use simple percentage on full amount ──
          // This handles older payments or edge cases where base_amount_usd wasn't stored
          const simpleFeePercentage = receivedUSD > 0 ? totalDeduction / receivedUSD : 0;
          adminAmountToSend = Number(totalAmountReceived) * simpleFeePercentage;
          userAmountToSend = Number(totalAmountReceived) - adminAmountToSend;
          
          cronLogger.info(`[cryptoVerification] ${fee_payer === 'customer' ? 'CUSTOMER' : 'COMPANY'} PAYS FEES — LEGACY DISTRIBUTION (no stored base):
            - Admin (fees): ${adminAmountToSend.toFixed(8)} ${tempCurrency} (${(simpleFeePercentage * 100).toFixed(2)}%)
            - Merchant: ${userAmountToSend.toFixed(8)} ${tempCurrency} (${((1 - simpleFeePercentage) * 100).toFixed(2)}%)`);
        }

        // ── DUST GUARD: Clamp sub-satoshi floating-point residuals to exactly 0 ──
        // Ratio-based distribution can produce tiny non-zero admin fees (e.g., 5.4e-20)
        // due to IEEE 754 floating-point imprecision when fee-free makes merchant = expected.
        // 1e-8 = 1 satoshi (BTC) / 1 sun (TRX) — the smallest on-chain unit.
        const DUST_THRESHOLD = 1e-8;
        if (adminAmountToSend > 0 && adminAmountToSend < DUST_THRESHOLD) {
          cronLogger.info(`[cryptoVerification] 🧹 Dust guard: Clamping admin fee ${adminAmountToSend} → 0 (below ${DUST_THRESHOLD} threshold)`);
          adminAmountToSend = 0;
          userAmountToSend = Number(totalAmountReceived);
        }
        if (userAmountToSend > Number(totalAmountReceived)) {
          userAmountToSend = Number(totalAmountReceived);
        }

        // ============================================
        // AUTO-STABLECOIN CONVERSION: Redirect to admin wallet if enabled
        // ============================================
        let autoConvertEnabled = false;
        let autoConvertTargetCurrency = "";
        let autoConvertSettlementAddress = "";
        let autoConvertSettlementChain = "";
        let originalUserAddress = walletData.dataValues.wallet_address;
        let originalUserAmount = userAmountToSend;
        
        // Capture platform fee in crypto BEFORE auto-convert merges it with merchant amount
        const adminFeeForConversion = adminAmountToSend;
        const platformFeeUsdForConversion = Number(totalAmountReceived) > 0 && userAmountToSend > 0
          ? adminAmountToSend * (Number(totalAmountReceived) > 0 ? 1 : 0) // Will be recalculated using actual conversion rate at payout
          : 0;

        if (
          company_data.auto_convert_enabled &&
          company_data.settlement_currency &&
          company_data.settlement_wallet_address &&
          company_data.settlement_chain &&
          isVolatileCrypto(tempCurrency) &&
          userAmountToSend > 0
        ) {
          autoConvertEnabled = true;
          autoConvertTargetCurrency = company_data.settlement_currency;
          autoConvertSettlementAddress = company_data.settlement_wallet_address;
          autoConvertSettlementChain = company_data.settlement_chain;

          // Redirect merchant portion to admin wallet (= Binance deposit address)
          // Admin wallet gets: admin fee portion + merchant portion (for conversion)
          const adminWalletAddr = getAdminWalletAddress(tempCurrency);
          if (adminWalletAddr) {
            cronLogger.info(`[AutoConvert] ✅ ACTIVE for company ${customerData.company_id}:
              - Source: ${userAmountToSend.toFixed(8)} ${tempCurrency}
              - Target: ${autoConvertTargetCurrency} on ${autoConvertSettlementChain}
              - Redirecting merchant portion to admin wallet: ${adminWalletAddr.substring(0, 12)}...
              - Merchant settlement address: ${autoConvertSettlementAddress.substring(0, 12)}...`);

            // Add merchant portion to admin portion (all goes to admin/Binance)
            adminAmountToSend = adminAmountToSend + userAmountToSend;
            userAmountToSend = 0; // Nothing goes directly to merchant

            cronLogger.info(`[AutoConvert] Updated distribution:
              - Admin total (fees + merchant): ${adminAmountToSend.toFixed(8)} ${tempCurrency}
              - Merchant direct: 0 (will receive ${autoConvertTargetCurrency} after conversion)`);
          } else {
            cronLogger.warn(`[AutoConvert] ⚠️ No admin wallet for ${tempCurrency}, falling back to normal settlement`);
            autoConvertEnabled = false;
          }
        }

        // ── FIX: Advisory pre-check only - Let SmartGas attempt funding ──
        // SmartGas will automatically fund TRX from fee wallet if needed
        const isTRC20Currency = tempCurrency.includes("TRC20");
        if (isTRC20Currency) {
          try {
            const { getAccountResources, calculateDynamicTRC20Fee } = require("../../services/tronEnergyService");
            const poolAddress = tempAddressData.wallet_address || tempAddressData.address;
            const poolResources = await getAccountResources(poolAddress);
            const dynamicFee = await calculateDynamicTRC20Fee(poolAddress);
            const requiredTRX = dynamicFee.fast * 1.5; // 50% safety buffer
            
            // Check pool address TRX balance (from TronGrid)
            const poolTRXBalance = poolResources.availableBandwidth >= 0 ? 0 : 0; // fallback
            
            // Check fee wallet TRX balance via Tatum (advisory only)
            // FIX (2026-04-02): Use process.env.TRX_FEE_WALLET (the actual gas fee wallet),
            // NOT getAdminWalletAddress("TRX") which returns process.env.TRX — the admin
            // COLLECTION wallet (4.48 TRX) instead of the gas wallet (115+ TRX).
            // This mismatch caused false DEFERRED settlements when the gas wallet was fine.
            const feeWalletAddress = process.env.TRX_FEE_WALLET || null;
            if (feeWalletAddress) {
              const feeWalletCheck = await tatumApi.getAddressBalance(feeWalletAddress, "TRX", true).catch(() => null);
              const feeWalletBalance = Number(feeWalletCheck?.balance || feeWalletCheck?.incoming || 0);
              
              if (feeWalletBalance < requiredTRX && poolResources.availableEnergy < 65000) {
                // WARNING ONLY - Let SmartGas attempt to fund
                cronLogger.warn(`[cryptoVerification] ⚠️ TRX fee wallet low for USDT-TRC20 settlement. Balance: ${feeWalletBalance} TRX, Estimated: ~${requiredTRX.toFixed(1)} TRX. SmartGas will attempt funding. Payment: ${tempAddressData.payment_id || 'unknown'}`);
                
                // Only abort if fee wallet is CRITICALLY low (< 5 TRX) AND no energy
                if (feeWalletBalance < 5 && poolResources.availableEnergy < 65000) {
                  cronLogger.error(`[cryptoVerification] ❌ CRITICAL: Fee wallet nearly empty (${feeWalletBalance} TRX < 5 TRX). Deferring. Payment ${tempAddressData.payment_id || 'unknown'} needs urgent top-up.`);
                  const { journalStateTransition } = require("../../services/paymentReliability");
                  await journalStateTransition({
                    paymentId: tempAddressData.payment_id || `deferred-${Date.now()}`,
                    txId: transactionId,
                    address: poolAddress,
                    currency: tempCurrency,
                    event: 'settlement_deferred_critical_low_gas',
                    fromState: 'processing',
                    toState: 'gas_pending',
                    amount: Number(totalAmountReceived),
                    metadata: { feeWalletBalance, requiredTRX, reason: 'Fee wallet critically low' },
                  });
                  throw new Error(`DEFERRED: Fee wallet critically low (${feeWalletBalance} TRX < 5 TRX). Needs urgent top-up.`);
                }
              } else if (feeWalletBalance >= requiredTRX) {
                cronLogger.info(`[cryptoVerification] ✅ Fee wallet sufficient: ${feeWalletBalance} TRX >= ${requiredTRX.toFixed(1)} TRX`);
              }
            }
          } catch (preCheckError: any) {
            if (preCheckError.message?.startsWith('DEFERRED:')) {
              throw preCheckError; // Re-throw deferred error
            }
            cronLogger.warn(`[cryptoVerification] ⚠️ TRX pre-check failed (non-blocking): ${preCheckError.message}`);
          }
        }

        // FIX (2026-04-02): Record fee-free volume BEFORE settlement, not after.
        // Previously at line ~5260 (after settlement success), so when settlement failed/deferred,
        // the function exited before reaching recordTransactionVolume → balance never decremented
        // → system still thought user was a new merchant with $0 volume.
        // Now recording at payment confirmation time (crypto received) regardless of settlement outcome.
        // FIX (2026-04-10): REVERSE if settlement fails. Otherwise fee-free balance is consumed
        // on failed settlements (e.g., OUT_OF_ENERGY) and the user loses their promotion.
        const feeFreeUserId = customerData?.adm_id ? Number(customerData.adm_id) : null;
        const feeFreeAmountUsd = parseFloat(tempData?.base_amount_usd || '0') || receivedUSD;
        let feeFreeRecorded = false;
        if (feeFreeUserId && feeFreeAmountUsd > 0) {
          try {
            const feeFreeResult = await recordTransactionVolume(feeFreeUserId, feeFreeAmountUsd);
            feeFreeRecorded = true;
            cronLogger.info(`[cryptoVerification] ✅ Fee-free volume recorded (pre-settlement): user ${feeFreeUserId}, $${feeFreeAmountUsd.toFixed(2)} USD. Remaining: $${feeFreeResult?.fee_free_remaining_usd ?? 'N/A'}`);
            log(`[cryptoVerification] 💰 Fee-free recorded (pre-settlement): user=${feeFreeUserId}, amount=$${feeFreeAmountUsd.toFixed(2)}, remaining=$${feeFreeResult?.fee_free_remaining_usd ?? 'N/A'}`);
          } catch (feeFreeError: any) {
            cronLogger.warn(`[cryptoVerification] Fee-free volume recording failed (non-critical): ${feeFreeError.message}`);
            log(`[cryptoVerification] ⚠️ Fee-free recording FAILED: user=${feeFreeUserId}, err=${feeFreeError.message}`, "warn");
          }
        }

        let adminTransferResult;
        try {
          adminTransferResult = await settleCryptoTransaction({
            tempAddressData: tempAddressData,
            receivedAmount: Number(adminAmountToSend),
            currency: tempCurrency,
            transactionId,
            ...(userAmountToSend > 0 && {
              userAmount: Number(userAmountToSend),
              userAddress: walletData.dataValues.wallet_address,
            }),
            merchantDestinationTag: walletData.dataValues.destination_tag || null,
            isMerchantPool: String(tempData.is_merchant_pool) === "true",  // Pass merchant pool flag as boolean
          });
        } catch (settlementError: any) {
          // FIX (2026-04-10): Reverse fee-free volume on settlement failure.
          // Without this, OUT_OF_ENERGY and other settlement failures consume the user's
          // fee-free balance ($33 in this case) even though no tokens were transferred.
          if (feeFreeRecorded && feeFreeUserId && feeFreeAmountUsd > 0) {
            try {
              const reverseResult = await reverseTransactionVolume(feeFreeUserId, feeFreeAmountUsd);
              cronLogger.info(`[cryptoVerification] ↩️ Fee-free volume REVERSED after settlement failure: user ${feeFreeUserId}, +$${feeFreeAmountUsd.toFixed(2)}. Remaining: $${reverseResult?.fee_free_remaining_usd ?? 'N/A'}`);
            } catch (reverseError: any) {
              cronLogger.error(`[cryptoVerification] ❌ Fee-free reversal FAILED: user=${feeFreeUserId}, amount=$${feeFreeAmountUsd.toFixed(2)}, err=${reverseError.message}`);
            }
          }
          throw settlementError; // Re-throw so existing error handling continues
        }

        // ── DEFENSE-IN-DEPTH: If idempotency guard returned 'already_settled' but
        // no sendAmount was provided, the original TX may have failed on-chain.
        // Before throwing, check blockchain to see if funds were actually transferred.
        if (adminTransferResult.status === 'already_settled' || adminTransferResult.status === 'settlement_in_progress') {
          const hasValidAmount = adminTransferResult.sendAmount !== undefined && adminTransferResult.sendAmount > 0;
          if (!hasValidAmount) {
            // ── AUTO-RECOVERY: Check on-chain before giving up ──
            // The settlement TX may have succeeded but the DB/Redis was never updated.
            // Verify by checking if funds left the pool address.
            try {
              const { verifySettlementOnChain, markSettlementCompleted } = require("../../services/paymentReliability");
              const poolAddr = tempAddressData.wallet_address || tempAddressData.address;
              const merchantAddr = walletData?.dataValues?.wallet_address || null;
              const pId = tempData?.payment_id || transactionId;
              
              const onChainResult = await verifySettlementOnChain(poolAddr, tempCurrency, merchantAddr, pId);
              
              if (onChainResult.settled && onChainResult.outgoingTxId) {
                cronLogger.warn(
                  `[cryptoVerification] 🔄 AUTO-RECOVERY: Settlement for ${pId} confirmed on-chain! ` +
                  `TX: ${onChainResult.outgoingTxId}, amount: ${onChainResult.amount}. ` +
                  `Proceeding with DB update instead of failing.`
                );
                // Override the adminTransferResult with the recovered data
                adminTransferResult.sendAmount = onChainResult.amount;
                adminTransferResult.txId = onChainResult.outgoingTxId;
                adminTransferResult.transactionDetails = { txId: onChainResult.outgoingTxId };
                adminTransferResult.status = 'auto_recovered';
                
                // Mark settlement as completed in idempotency store
                await markSettlementCompleted(
                  pId,
                  onChainResult.outgoingTxId,
                  poolAddr,
                  tempCurrency,
                  onChainResult.amount,
                  Number(adminAmountToSend),
                  Number(customerData?.company_id) || null
                );
                
                // Don't throw — fall through to the normal DB update path below
              } else {
                // Funds still in pool or no outgoing TX found — original failure stands
                cronLogger.error(
                  `[cryptoVerification] ⛔ Settlement returned status="${adminTransferResult.status}" with no valid sendAmount. ` +
                  `On-chain check: funds ${onChainResult.settled ? 'moved' : 'still in pool'}. ` +
                  `Original TX ${adminTransferResult.txId || 'N/A'} may have failed on-chain. ` +
                  `Treating as settlement failure — will retry.`
                );
                throw new Error(
                  `Settlement idempotency returned "${adminTransferResult.status}" but TX did not transfer funds. ` +
                  `Manual recovery may be required for payment ${tempData?.payment_id || transactionId}.`
                );
              }
            } catch (recoveryErr: any) {
              if (recoveryErr.message?.includes('Settlement idempotency returned')) {
                throw recoveryErr; // Re-throw the intentional error from the else branch above
              }
              cronLogger.error(
                `[cryptoVerification] ⛔ Auto-recovery check failed: ${recoveryErr.message}. ` +
                `Settlement returned status="${adminTransferResult.status}" with no valid sendAmount. ` +
                `Treating as settlement failure — will retry.`
              );
              throw new Error(
                `Settlement idempotency returned "${adminTransferResult.status}" but TX did not transfer funds. ` +
                `Manual recovery may be required for payment ${tempData?.payment_id || transactionId}.`
              );
            }
          }
        }
        
        cronLogger.info(`[cryptoVerification] settleCryptoTransaction result:
          - Admin fee to retain: ${adminAmountToSend} ${tempCurrency}
          - Merchant amount sent: ${adminTransferResult.sendAmount} ${tempCurrency}
          - Merchant TX: ${adminTransferResult.transactionDetails?.txId || 'N/A'}
          - Admin fee retained for sweep: ${adminTransferResult.adminFeeRetained || 0} ${tempCurrency}
          - SmartGas funded: ${adminTransferResult.gasFunded || 0} (TX: ${adminTransferResult.gasFundingTxId || 'N/A'})
          - Is Merchant Pool: ${tempData.is_merchant_pool}
          - Auto-Convert: ${autoConvertEnabled ? 'YES' : 'NO'}
        `);
        // Direct console.log backup — settlement distribution details are critical for audit
        log(`[cryptoVerification] 💸 Settlement: merchant=${adminTransferResult.sendAmount} ${tempCurrency}, merchantTx=${adminTransferResult.transactionDetails?.txId || 'N/A'}, adminFee=${adminAmountToSend} ${tempCurrency}, gas=${adminTransferResult.gasFunded || 0}`);

        // Compute actual on-chain merchant amount (post-gas deductions) for webhook and records
        const actualMerchantAmount = adminTransferResult.sendAmount > 0
          ? adminTransferResult.sendAmount
          : Number(userAmountToSend);

        // ============================================
        // Store incoming & outgoing TX hashes on user transaction
        // ============================================
        const txRecordIdForHashes = tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id;
        const outgoingMerchantTxHash = adminTransferResult.transactionDetails?.txId || null;
        if (txRecordIdForHashes) {
          try {
            const hashUpdate: Record<string, string | null> = {};
            // Incoming = the blockchain TX where customer sent payment
            const incomingTxHash = transactionId || tempAddressData?.txId || null;
            if (incomingTxHash) hashUpdate.incoming_tx_hash = incomingTxHash;
            // Outgoing = the blockchain TX where we forwarded to merchant wallet
            if (outgoingMerchantTxHash) hashUpdate.outgoing_tx_hash = outgoingMerchantTxHash;
            if (Object.keys(hashUpdate).length > 0) {
              await userTransactionModel.update(hashUpdate, {
                where: { id: txRecordIdForHashes },
                transaction,
              });
              cronLogger.info(`[cryptoVerification] Updated TX hashes for ${txRecordIdForHashes}: incoming=${incomingTxHash || 'N/A'}, outgoing=${outgoingMerchantTxHash || 'N/A'}`);
            }
          } catch (hashErr: unknown) {
            cronLogger.warn(`[cryptoVerification] Failed to update TX hashes: ${hashErr instanceof Error ? hashErr.message : String(hashErr)}`);
          }
        }

        // ============================================
        // AUTO-CONVERT: Create conversion record for Binance processing
        // ============================================
        if (autoConvertEnabled && originalUserAmount > 0) {
          try {
            const adminWalletAddr = getAdminWalletAddress(tempCurrency) || "";
            // Use receivedAmount and currencyConvert for USD value since amountInUSD is block-scoped
            let usdValue: number | undefined;
            try {
              const usdConvert = await currencyConvert({
                sourceCurrency: tempCurrency,
                currency: ["USD"],
                amount: originalUserAmount,
                fixedDecimal: false,
              });
              usdValue = usdConvert && usdConvert[0] ? Number(usdConvert[0].amount) : undefined;
            } catch { usdValue = undefined; }
            
            // FIX: Look up the integer transaction_id from tbl_user_transaction
            // transactionId here is the blockchain TX hash (hex string) — NOT the DB integer PK
            // parseInt(blockchainHash) produces a huge scientific notation number that Postgres rejects
            const txRecordId = tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id;
            let dbTransactionId: number | null = null;
            if (txRecordId) {
              const txRecord = await userTransactionModel.findOne({
                where: { id: txRecordId },
                attributes: ['transaction_id'],
                transaction,
              });
              dbTransactionId = txRecord?.dataValues?.transaction_id ?? null;
            }
            
            if (!dbTransactionId) {
              cronLogger.warn(`[AutoConvert] ⚠️ Could not resolve integer transaction_id for UUID ${txRecordId} — skipping conversion record`);
            } else {
              await createConversionRecord({
                transactionId: dbTransactionId,
                companyId: Number(customerData.company_id),
                userId: Number(customerData.adm_id),
                sourceCurrency: tempCurrency,
                sourceAmount: originalUserAmount,
                sourceAmountUsd: usdValue,
                targetCurrency: autoConvertTargetCurrency,
                settlementWalletAddress: autoConvertSettlementAddress,
                settlementChain: autoConvertSettlementChain,
                depositTxHash: adminTransferResult.transactionDetails?.txId || undefined,
                adminWalletAddress: adminWalletAddr,
                platformFeeUsd: platformFeeUsdForConversion,
                platformFeeCrypto: adminFeeForConversion,
                totalReceivedCrypto: Number(totalAmountReceived),
              });
            }

            cronLogger.info(`[AutoConvert] 📝 Conversion record created:
              - TX: ${transactionId}
              - Source: ${originalUserAmount.toFixed(8)} ${tempCurrency}
              - Target: ${autoConvertTargetCurrency} on ${autoConvertSettlementChain}
              - Immediate sweep will be triggered after address release`);
          } catch (convErr) {
            cronLogger.error(`[AutoConvert] ❌ Failed to create conversion record (non-fatal):`, convErr);
            // Non-fatal: the payment itself succeeded, conversion can be manually triggered
          }
        }

        // For UTXO chains, admin fee is sent in the same transaction
        // For account-based chains, admin fee is retained for batch sweep
        const isUTXOChain = ["BTC", "LTC", "DOGE", "BCH"].includes(tempCurrency);
        const adminFeeStatus = isUTXOChain ? "successful" : "pending_sweep";

        await incrementAdminFee(tempCurrency, adminAmountToSend);

        // Send admin fee notification email
        try {
          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail && adminAmountToSend > 1e-8) {
            // RACE CONDITION FIX: Check if admin fee email already sent for this transaction
            const adminFeeEmailKey = `admin-fee-email-${transactionId}`;
            const adminFeeEmailSent = await getRedisItem(adminFeeEmailKey);
            
            if (adminFeeEmailSent && adminFeeEmailSent.sent) {
              cronLogger.info(`[Admin Fee Notification] Email already sent for tx: ${transactionId}, skipping duplicate`);
            } else {
              // Set flag immediately to prevent duplicates
              await setRedisItem(adminFeeEmailKey, { sent: true, sentAt: new Date().toISOString() });
              await setRedisTTL(adminFeeEmailKey, 86400); // 24 hour TTL
              
              const isUnderThreshold = userAmountToSend === 0 && adminAmountToSend === Number(totalAmountReceived) && !autoConvertEnabled;
              
              if (autoConvertEnabled) {
                // Auto-convert: admin gets all crypto (fee + merchant-for-conversion)
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend - originalUserAmount).toFixed(8), // actual admin fee only
                  tempCurrency,
                  transactionId,
                  company_data?.company_name || "Unknown Company",
                  Number(originalUserAmount).toFixed(8), // merchant portion pending conversion
                  Number(totalAmountReceived).toFixed(8)
                );
                cronLogger.info(`[Admin Fee Notification - AUTO-CONVERT] Sent email: fee=${(adminAmountToSend - originalUserAmount).toFixed(8)} ${tempCurrency}, merchant_for_conversion=${originalUserAmount.toFixed(8)} ${tempCurrency} from Company ${company_data?.company_id || 'N/A'}`);
              } else {
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend).toFixed(8),
                  tempCurrency,
                  transactionId,
                  company_data?.company_name || "Unknown Company",
                  Number(userAmountToSend).toFixed(8),
                  Number(totalAmountReceived).toFixed(8)
                );
                
                if (isUnderThreshold) {
                  cronLogger.info(`[Admin Fee Notification - UNDER THRESHOLD] Sent email: ${adminAmountToSend} ${tempCurrency} (100%) from Company ${company_data?.company_id || 'N/A'} - Payment below minimum threshold`);
                } else {
                  cronLogger.info(`[Admin Fee Notification] Sent email for ${adminAmountToSend} ${tempCurrency} from Company ${company_data?.company_id || 'N/A'}`);
                }
              }
            }
          }
        } catch (emailError) {
          cronLogger.error("[Admin Fee Notification] Email failed:", emailError);
          // Don't fail the whole transaction if email fails
        }

        const allTxIds = tempAddressData.txId
          ? tempAddressData.txId + "," + transactionId
          : transactionId;

        // Update address status based on whether it's merchant pool or legacy
        if (tempData.is_merchant_pool) {
          // MERCHANT POOL: Release address back to pool with admin fee tracking
          cronLogger.info(`[cryptoVerification] Releasing MERCHANT POOL address back to pool`);
          
          // Safety net: If auto-convert was enabled but settleCryptoTransaction returned
          // without creating a transfer (funds still in pool address), flag for sweep.
          // This handles edge cases where UTXO direct-transfer failed or future changes.
          const pendingSweep = autoConvertEnabled && !adminTransferResult.transactionDetails;
          
          await merchantPoolService.releaseAddress(
            tempAddressData.temp_address_id,
            adminAmountToSend,
            adminTransferResult.blockchainFee || 0,
            pendingSweep
          );
          
          // NOTE (2026-04-02): Per-settlement reclaimExcessGas REMOVED.
          // Leftover gas (TRX/ETH) from SmartGas funding stays in the temp address.
          // This is optimal because:
          //   1. The admin fee sweep (sweepPoolAddress) also needs gas — leftover from
          //      merchant transfer is reused, reducing the sweep's fundGasIfNeeded deficit.
          //   2. If the address is reused for another payment, SmartGas accounts for
          //      existing balance and only funds the deficit.
          //   3. Eliminates a wasteful fund→reclaim→re-fund cycle (saves 1 TX per payment).
          // For periodic cleanup of idle addresses with accumulated gas, use the bulk
          // recovery endpoint: POST /diagnostics/recover-excess-trx
          
          // Record pool transaction for audit
          // Use actualMerchantAmount (computed above) — the actual post-gas on-chain amount
          
          await merchantPoolService.recordPoolTransaction({
            tempAddressId: tempAddressData.temp_address_id,
            ownerUserId: tempAddressData.owner_user_id,
            companyId: Number(customerData.company_id),
            customerId: customerData.customer_id ? Number(customerData.customer_id) : undefined,
            paymentReference: transactionId,
            walletType: tempCurrency,
            paymentAmount: Number(totalAmountReceived),
            merchantAmount: actualMerchantAmount,
            adminFeeAmount: Number(adminAmountToSend),
            gasFunded: adminTransferResult.gasFunded || 0,  // SmartGas: actual TRX/ETH funded
            gasUsed: adminTransferResult.blockchainFee || 0,
            incomingTxId: transactionId,
            merchantTxId: adminTransferResult.transactionDetails?.txId,
            status: "completed",
          });

          // AUTO-CONVERT OPTIMIZATION: Trigger immediate sweep instead of waiting for cron
          // This eliminates the 3-5 min delay (ETH_SWEEP=time:3 + 2-min cron interval)
          // Only for account-based chains where funds stay in pool address for sweep.
          // UTXO chains with auto-convert already sent funds directly in settleCryptoTransaction.
          if (autoConvertEnabled && !adminTransferResult.transactionDetails) {
            const sweepAddressId = tempAddressData.temp_address_id;
            cronLogger.info(`[AutoConvert] Triggering immediate sweep for address ID ${sweepAddressId} (${tempCurrency})`);

            // Fire-and-forget: don't block the payment response
            // releaseAddress(pendingSweep=true) already set correct IN_USE status
            merchantPoolService.sweepPoolAddress(sweepAddressId).then(() => {
              cronLogger.info(`[AutoConvert] Immediate sweep completed for address ID ${sweepAddressId}`);
            }).catch((sweepErr: unknown) => {
              cronLogger.warn(`[AutoConvert] Immediate sweep failed (will be retried by cron):`, sweepErr instanceof Error ? sweepErr.message : sweepErr);
            });
          } else if (autoConvertEnabled && adminTransferResult.transactionDetails) {
            cronLogger.info(`[AutoConvert] ✅ UTXO direct transfer already sent funds to admin wallet (TX: ${adminTransferResult.transactionDetails.txId}). No sweep needed.`);
            
            // Send admin sweep notification for UTXO auto-convert direct transfer
            // (same email that account-based chains get after sweep completes)
            try {
              const adminEmail = process.env.ADMIN_EMAIL;
              if (adminEmail) {
                const gasToken = tempCurrency; // UTXO chains use native coin for gas
                const gasDisplay = adminTransferResult.blockchainFee
                  ? `${Number(adminTransferResult.blockchainFee).toFixed(8)} ${gasToken}`
                  : 'Included in TX';
                
                await sendAdminFeeSweepEmail(
                  adminEmail,
                  Number(adminAmountToSend).toFixed(8),
                  tempCurrency,
                  tempAddressData.wallet_address || 'Pool Address',
                  getAdminWalletAddress(tempCurrency) || 'Admin Wallet',
                  adminTransferResult.transactionDetails.txId || 'N/A',
                  gasDisplay,
                  'auto-convert (UTXO direct)'
                );
                cronLogger.info(`[AutoConvert] 📧 Admin sweep notification sent for UTXO direct transfer: ${adminAmountToSend} ${tempCurrency} to ${adminEmail}`);
              }
            } catch (sweepEmailErr) {
              cronLogger.error(`[AutoConvert] ⚠️ Admin sweep email failed (non-critical):`, sweepEmailErr instanceof Error ? sweepEmailErr.message : sweepEmailErr);
            }
          }
          
        } else {
          // LEGACY: Update userTempAddressModel
          await userTempAddressModel.update(
            {
              status: "successful",
              txId: allTxIds,
              adminTxId: adminTransferResult.transactionDetails?.txId || null,
              admin_status: adminFeeStatus,
              blockchain_fee: adminTransferResult.blockchainFee,
              amount: isUTXOChain ? 0 : adminAmountToSend,
              pending_admin_fee: isUTXOChain ? 0 : adminAmountToSend,
            },
            {
              where: { temp_id: tempAddressData.temp_id },
            }
          );
        }

        if (userAmountToSend > 0) {
          await incrementUserWallet(walletData.dataValues.wallet_id, Number(userAmountToSend), transaction);

          const userPayload = {
            wallet_id: walletData.dataValues.wallet_id,
            user_id: customerData.adm_id,
            company_id: customerData.company_id ? Number(customerData.company_id) : null,  // Multi-tenant: Include company_id
            payment_mode: tempData.mode,
            base_amount: Number(userAmountToSend).toFixed(8),
            base_currency: tempCurrency,
            transaction_reference: allTxIds,
            transaction_type: "CREDIT",
            status: "successful",
            customer_id: customerData.customer_id ? Number(customerData.customer_id) : null,
            // Store USD value at time of receipt (historical value)
            usd_value: (await convertToUSD(Number(userAmountToSend), tempCurrency)) || 0,
            // FIX: Populate crypto fields for complete transaction records
            // crypto_amount = total crypto the customer sent (before fees)
            // crypto_currency = the cryptocurrency type (ETH, BTC, LTC, etc.)
            // transaction_fee = the platform fee deducted (in crypto)
            crypto_amount: Number(totalAmountReceived),
            crypto_currency: tempCurrency,
            transaction_fee: Number(adminAmountToSend),
          };

          // FIX: Use user_tx_id for user transaction updates (separate from payment_id which is for payment link)
          const transactionRecordId = tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id;
          
          if (!transactionRecordId) {
            cronLogger.error(`[cryptoVerification] ⚠️  No transaction ID found in tempData - cannot update user transaction`);
          } else {
            if (tempData?.incomplete) {
              await userTransactionModel.create({
                ...userPayload,
                id: transactionRecordId,
              }, { transaction });
            } else {
              const updateResult = await userTransactionModel.update(
                { ...userPayload },
                { where: { id: transactionRecordId }, transaction }
              );
              cronLogger.info(`[cryptoVerification] Updated user transaction ${transactionRecordId}, affected rows: ${updateResult[0]}`);
              
              // If no rows affected, log warning - transaction record may not exist
              if (updateResult[0] === 0) {
                cronLogger.warn(`[cryptoVerification] ⚠️  No user transaction updated for ID ${transactionRecordId} - record may not exist`);
              }
            }
          }
        } else {
          // FIX: Even when userAmountToSend is 0 (under-threshold or auto-convert),
          // still update the user_transaction with crypto fields and mark as successful
          const transactionRecordId = tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id;
          if (transactionRecordId) {
            const zeroPayoutPayload = {
              status: autoConvertEnabled ? "successful" : "successful",
              crypto_amount: Number(totalAmountReceived),
              crypto_currency: tempCurrency,
              transaction_fee: Number(adminAmountToSend),
              transaction_reference: allTxIds,
              usd_value: (await convertToUSD(Number(totalAmountReceived), tempCurrency)) || 0,
            };
            const updateResult = await userTransactionModel.update(
              zeroPayoutPayload,
              { where: { id: transactionRecordId }, transaction }
            );
            cronLogger.info(`[cryptoVerification] Updated user transaction ${transactionRecordId} (zero merchant payout - ${autoConvertEnabled ? 'auto-convert' : 'under threshold'}), affected rows: ${updateResult[0]}`);
          }
        }

        let overPayment = false;
        let newAmount = [{ amount: 0 }];
        const tempAmount = Number(receivedAmount) - Number(tempData?.amount);
        if (tempAmount > 0) {
          // Convert overpayment to API key's base currency (not hardcoded USD)
          newAmount = await currencyConvert({
            sourceCurrency: tempCurrency,
            currency: [customerData?.base_currency || "USD"],  // Use API key base currency
            amount: tempAmount,
            fixedDecimal: true,
          });
          // Flag overpayment if > 5 in base currency (USD/EUR/GBP/etc.)
          // NOTE: Only applies to Payment Links (createPayment). Direct API (cryptoPayment)
          // does NOT use overpayment settings — merchant gets paid the full received amount.
          if (newAmount[0].amount > 5 && !customerData?.pathType?.includes("cryptoPayment")) {
            overPayment = true;
          }
        }

        if (customerData?.pathType?.includes("addFund") || overPayment) {
          if (customerData?.pathType?.includes("createPayment") && overPayment) {
            // FIX: Only delete subscription for legacy addresses, not merchant pool
            if (!isMerchantPoolAddress) {
              await safeDeleteSubscription(tempAddressData.subscription_id, 'legacy address overpayment');
            }
            transactionFinished = true;
            await transaction.commit();
            await setRedisItem(cryptoKey, {
              ...tempData,
              status: "overpayment",
              completedAt: new Date().toISOString(),
            });
            await softDeleteRedisItem(cryptoKey, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
            throw {
              status: 200,
              paymentStatus: "overpayment",
              overpayment: {
                amount_crypto: tempAmount,
                currency_crypto: tempCurrency,
                amount_base: newAmount[0].amount,
                currency_base: customerData?.base_currency || "USD",
              },
              message: `Overpayment detected! ${tempAmount} ${tempCurrency} (${newAmount[0].amount} ${customerData?.base_currency || "USD"})`,
              commit: false,
            };
          } else if (customerData?.pathType?.includes("cryptoPayment") && overPayment) {
            if (customerData.customer_id) {
              await incrementCustomerWallet(Number(customerData.customer_id), Number(newAmount[0].amount), transaction);
            }
          } else {
            const finalAmount = await currencyConvert({
              sourceCurrency: tempCurrency,
              currency: [customerData?.base_currency],
              amount: totalAmountReceived,
              fixedDecimal: false,
            });
            if (customerData.customer_id) {
              await incrementCustomerWallet(Number(customerData.customer_id), Number(finalAmount[0].amount), transaction);
            }
          }
        }

        // FIXED: Update payment link status to successful
        // BUG FIX: Check for payment_id/unique_tx_id (from crypto- Redis key) OR transaction_id (from customer- Redis key)
        const linkTransactionId = tempData?.payment_id || tempData?.unique_tx_id || tempData?.transaction_id || customerData?.transaction_id;
        if (linkTransactionId) {
          cronLogger.info(`[cryptoVerification] Updating payment link status for transaction_id: ${linkTransactionId}`);
          await paymentLinkModel.update(
            {
              status: "successful",
              paid_amount: totalAmountReceived,
              paid_currency: tempCurrency,
              payment_mode: "CRYPTO",
              transaction_reference: transactionId,
            },
            {
              where: { transaction_id: linkTransactionId },
              transaction,
            }
          );

        }

        // FIX: Also update customer transaction status to match payment link status
        if (customerPayload?.id) {
          cronLogger.info(`[cryptoVerification] Updating customer transaction ${customerPayload.id} status to successful`);
          await customerTransactionModel.update(
            {
              status: "successful",
              transaction_reference: transactionId,
            },
            {
              where: { id: customerPayload.id },
              transaction,
            }
          );
        }

        // FIX: Only delete subscription for LEGACY (non-merchant-pool) addresses
        // Merchant pool addresses handle their own subscription lifecycle in releaseAddress()
        if (!isMerchantPoolAddress) {
          await safeDeleteSubscription(tempAddressData.subscription_id, 'legacy address completion');
        } else {
          cronLogger.info(`[cryptoVerification] Skipping subscription delete for merchant pool address (handled by releaseAddress)`);
        }
        
        transactionFinished = true;
        await transaction.commit();
        
        // PHASE 12: Clear incomplete_payment and active_crypto_address from customer Redis key on successful completion
        const customerRef = tempData.ref;
        if (customerRef) {
          const customerRedisData = await getRedisItem("customer-" + customerRef);
          if (customerRedisData && (customerRedisData.incomplete_payment || customerRedisData.active_crypto_address)) {
            const { incomplete_payment, active_crypto_address, ...cleanCustomerData } = customerRedisData;
            await setRedisItem("customer-" + customerRef, cleanCustomerData);
            cronLogger.info(`[Phase 12] Cleared incomplete_payment and active_crypto_address from customer-${customerRef} on successful completion`);
          }
        }
        
        // FIXED: Use soft delete with 30-min TTL to allow checkout polling for status
        // Update status to successful before soft delete
        await setRedisItem(tempData.ref, {
          ...tempData,
          status: toRedisStatus(PaymentState.PAYOUT_COMPLETE),
          completedAt: new Date().toISOString(),
        });
        await setRedisItem(cryptoKey, {
          ...tempData,
          status: toRedisStatus(PaymentState.PAYOUT_COMPLETE),
          completedAt: new Date().toISOString(),
        });
        // Direct console.log — critical settlement milestone, must appear in Railway logs
        log(`[cryptoVerification] ✅ PAYOUT_COMPLETE: addr=${address}, ref=${tempData.ref}, receivedUSD=$${receivedUSD?.toFixed(2) || 'N/A'}`);
        await softDeleteRedisItem(tempData.ref, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // 30 minutes TTL
        await softDeleteRedisItem(cryptoKey, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // 30 minutes TTL

        // NOTE: recordTransactionVolume has been MOVED to BEFORE settlement (line ~4784)
        // so that fee-free volume is always tracked even when settlement fails/defers.

        if (webhook) {
          // FIX (2026-04-02): Removed redundant payment.settled webhook.
          // Merchant already receives payment.confirmed from webhookProcessor.ts when
          // crypto is confirmed on-chain (before settlement). Sending payment.settled
          // AGAIN after internal settlement is redundant — merchant doesn't need to know
          // about internal wallet-to-wallet transfers.
          // The settlement details (outgoing TX, fees, gas) are logged internally only.
          cronLogger.info(`[cryptoVerification] Settlement complete — skipping payment.settled webhook (merchant already notified via payment.confirmed). ` +
            `merchant_amount=${autoConvertEnabled ? originalUserAmount : userAmountToSend}, ` +
            `total_fee=${autoConvertEnabled ? (adminAmountToSend - originalUserAmount) : adminAmountToSend}, ` +
            `fee_payer=${tempData?.fee_payer || customerData?.fee_payer || 'company'}` +
            `${autoConvertEnabled ? `, auto_convert=${autoConvertTargetCurrency}` : ''}`);
          
          // FIX (2026-04-12): Set dedup flag so webhookProcessor.ts doesn't send payment.settled again.
          // The 2026-04-02 fix removed the settled webhook from here but forgot to signal
          // webhookProcessor via the confirmed-webhook-sent-{paymentId} Redis key.
          // Without this, webhookProcessor falls through to its own payment.settled send path.
          const settledDedupPaymentId = tempData?.payment_id || tempData?.unique_tx_id || tempData?.ref || "unknown";
          const settledDedupKey = `confirmed-webhook-sent-${settledDedupPaymentId}`;
          await setRedisItem(settledDedupKey, { sent: true, sentAt: new Date().toISOString(), source: "cryptoVerification-skip" });
          await setRedisTTL(settledDedupKey, 86400); // 24 hours
          cronLogger.info(`[cryptoVerification] Set dedup key ${settledDedupKey} to prevent duplicate payment.settled from webhookProcessor`);
        } else {
          let resData;
          if (customerData?.redirect_uri) {
            resData = customerData.redirect_uri +
              `?transaction_id=${customerPayload.id}&status=${customerPayload.status}&meta_data=${customerData?.meta_data ?? null}&payment_type=CRYPTO`;
          } else {
            resData = {
              transaction_id: customerPayload.id,
              transaction_reference: transactionId,
              status: customerPayload.status,
            };
          }

          return {
            status: 200,
            message: `Transaction ${customerPayload?.status}!`,
            paymentStatus: "complete",
            resData,
            ...(tempAmount > 0 && {
              overpayment: {
                detected: true,
                amount_crypto: tempAmount,
                currency_crypto: tempCurrency,
                amount_base: newAmount[0].amount,
                currency_base: customerData?.base_currency || "USD",
              }
            })
          };
        }

        // Get user data for notifications
        const userData = (
          await userModel.findOne({
            where: { user_id: customerData.adm_id },
          })
        )?.dataValues;

        // RACE CONDITION FIX: Check if payment received email already sent for this transaction
        const paymentReceivedEmailKey = `payment-received-email-${transactionId}`;
        const paymentReceivedEmailSent = await getRedisItem(paymentReceivedEmailKey);
        
        if (paymentReceivedEmailSent && paymentReceivedEmailSent.sent) {
          cronLogger.info(`[cryptoVerification] Payment received email already sent for tx: ${transactionId}, skipping duplicate`);
        } else {
          // Set flag immediately to prevent duplicates
          // TTL = 30 days (was 24h — too short; sweep recovery sends false-positive duplicate emails
          // when sweeps happen >24h after the original payment, because the dedup key has expired)
          await setRedisItem(paymentReceivedEmailKey, { sent: true, sentAt: new Date().toISOString() });
          await setRedisTTL(paymentReceivedEmailKey, 2592000); // 30 day TTL
          
          // Send email notification for payment received
          const companyName = company_data?.company_name ?? "";
          const paymentDateTime = new Date();
          const paymentDateStr = paymentDateTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const paymentTimeStr = paymentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          // When auto-convert is ON, show the original merchant amount (before redirect to admin)
          // Merchant will receive USDT equivalent, not 0 ETH
          const emailAmount = autoConvertEnabled ? originalUserAmount.toFixed(8) : Number(userAmountToSend).toFixed(8);

          // Issue #6: show the amount in the merchant's fiat currency (primary) with
          // the crypto amount received as a secondary line. Fall back to crypto-primary
          // if the invoice base amount isn't available.
          const receivedBaseAmount = customerData?.base_amount ?? tempData?.base_amount ?? null;
          const receivedBaseCurrency = customerData?.base_currency ?? tempData?.base_currency ?? "USD";
          const cryptoReceivedStr = parseFloat(emailAmount).toString();
          const cryptoCurrencyLabel = autoConvertEnabled
            ? `${tempCurrency} → ${autoConvertTargetCurrency}`
            : tempCurrency;

          // Always render a FIAT amount (merchant currency) as primary and the
          // crypto received as secondary. Derives the fiat figure from the fiat
          // request when available, else the tx USD value, else crypto→USD — so
          // it can never fall back to showing a crypto amount (or the flat fee)
          // as the fiat number. See utils/paymentAmountDisplay.ts.
          const mrDisplay = await buildPaymentReceivedDisplay({
            companyId: company_data?.company_id,
            cryptoAmount: cryptoReceivedStr,
            cryptoCurrency: tempCurrency, // RAW code for crypto→USD conversion
            cryptoDisplayCurrency: cryptoCurrencyLabel, // e.g. "ETH → USDT"
            knownFiatAmount: receivedBaseAmount, // last-resort only
            knownFiatCurrency: receivedBaseCurrency,
          });
          const mrPrimaryAmount = mrDisplay.fiatAmount;
          const mrPrimaryCurrency = mrDisplay.fiatCurrency;
          const mrCryptoAmount = mrDisplay.cryptoAmount;
          const mrCryptoCurrency = mrDisplay.cryptoCurrency;

          await sendPaymentReceivedEmail(
            userData?.email,
            userData?.name,
            mrPrimaryAmount,         // fiat amount (merchant currency)
            mrPrimaryCurrency,       // fiat currency (e.g. USD)
            companyName,             // companyName
            transactionId,           // transactionId
            paymentDateStr,          // date
            paymentTimeStr,          // time
            normalizeLang((userData as { language?: string })?.language), // merchant language
            mrCryptoAmount,          // crypto amount received (secondary)
            mrCryptoCurrency         // crypto currency (secondary, e.g. "ETH → USDT")
          );
        }

        // Get company name for notifications (used below)
        const companyName = company_data?.company_name ?? "";

        // Send large transaction alert if amount > $1000 USD equivalent
        const baseAmount = customerData?.base_amount || tempData?.base_amount || 0;
        const LARGE_TRANSACTION_THRESHOLD = 1000;
        if (parseFloat(baseAmount) >= LARGE_TRANSACTION_THRESHOLD) {
          try {
            const { sendLargeTransactionAlertEmail } = await import("../../services/emailService");
            const customerEmail = customerData?.email || tempData?.email || null;
            await sendLargeTransactionAlertEmail(
              userData?.email,
              userData?.name || 'Merchant',
              `${baseAmount}`,
              customerData?.base_currency || 'USD',
              totalAmountReceived.toString(),
              tempCurrency,
              customerEmail,
              transactionId,
              companyName
            );
            cronLogger.info(`[cryptoVerification] Large transaction alert sent to ${userData?.email} for $${baseAmount}`);
          } catch (largeAlertError) {
            cronLogger.error("[cryptoVerification] Failed to send large transaction alert:", largeAlertError);
          }
        }

        // Create in-app notification for payment received
        await createNotification(
          customerData.adm_id,
          NOTIFICATION_TYPES.PAYMENT_RECEIVED,
          "Payment Received",
          `Your company ${companyName} received ${formatCryptoAmount(userAmountToSend, tempCurrency)} ${tempCurrency}`,
          {
            amount: userAmountToSend,
            currency: tempCurrency,
            transaction_id: transactionId,
            company_name: companyName,
            company_id: company_data?.company_id,
          },
          company_data?.company_id
        );

        // Send payment confirmation email to customer (the payer)
        // Get customer email from payment link or customerData
        try {
          const customerEmail = customerData?.email || tempData?.email;
          if (customerEmail && customerEmail.trim() !== "") {
            // DUPLICATE PREVENTION: Check if customer receipt email already sent
            const customerReceiptKey = `customer-receipt-email-${transactionId}`;
            const customerReceiptSent = await getRedisItem(customerReceiptKey);
            
            if (customerReceiptSent && customerReceiptSent.sent) {
              cronLogger.info(`[cryptoVerification] Customer receipt email already sent for tx: ${transactionId}, skipping duplicate`);
            } else {
              // Set flag immediately to prevent duplicates
              await setRedisItem(customerReceiptKey, { sent: true, sentAt: new Date().toISOString() });
              await setRedisTTL(customerReceiptKey, 86400); // 24 hour TTL
              
              const paymentDate = new Date();
              const description = customerData?.description || tempData?.description || null;
              const baseAmount = customerData?.base_amount || tempData?.base_amount;
              const baseCurrency = customerData?.base_currency || tempData?.base_currency || "USD";
              
              await sendCustomerPaymentConfirmationEmail(
                customerEmail,
                null, // Customer name often not available
                companyName,
                `${baseAmount}`,
                baseCurrency,
                customerPayload.id || transactionId,
                description,
                paymentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                paymentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                totalAmountReceived.toString(), // Crypto amount
                tempCurrency, // Crypto currency
                transactionId, // Blockchain transaction reference
                resolveCustomerLanguage({
                  transactionLang: (customerPayload as { language?: string })?.language,
                  checkoutLang: customerData?.language || tempData?.language,
                  merchantLang: (userData as { language?: string })?.language,
                }) // customer language
              );
              cronLogger.info(`[cryptoVerification] Customer payment confirmation email sent to ${customerEmail} with PDF receipt`);
            }
          } else {
            cronLogger.info(`[cryptoVerification] No customer email available for payment confirmation`);
          }
        } catch (customerEmailError: unknown) {
          const err = customerEmailError as { message?: string };
          cronLogger.error("[cryptoVerification] Customer payment confirmation email failed:", err.message);
          // Don't fail the transaction if email fails
        }
      }
    } else {
      let currency = tempCurrency;
      if (!currency) {
        const data = await userTempAddressModel.findOne({
          where: { wallet_address: address },
        });
        currency = data.dataValues.wallet_type;
      }
      const paymentStatus = await tatumApi.getCurrentPaymentStatus(address, currency);
      transactionFinished = true;
      await transaction.rollback();
      return paymentStatus;
    }
  } catch (e) {
    const { commit, ...restData } = e;
    const message = getErrorMessage(e);
    // Only attempt rollback/commit if transaction hasn't been finished yet
    if (!transactionFinished) {
      try {
        if (e?.commit) {
          await transaction.commit();
        } else {
          await transaction.rollback();
        }
      } catch (txError) {
        cronLogger.error(`[cryptoVerification] Transaction cleanup failed (already ${transactionFinished ? 'finished' : 'active'}):`, getErrorMessage(txError));
      }
    }
    if (!e?.commit) {
      cronLogger.info(e);
    }
    apiLogger.error(message, new Error(e));
    return { status: e?.status ?? 500, message, resData: restData };
  }
};

// timer function removed - not used


export { settleCryptoTransaction, verifyCryptoPayment, cryptoVerification };
