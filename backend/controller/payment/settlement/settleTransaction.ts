import { raw as envRaw } from "../../../utils/config";
import express from "express";
import {
  PAYMENT_TIMING,
} from "../paymentConfig";
import { convertToUSD, withRetry } from "../paymentHelpers";
import {
  currencyConvert,
  errorResponseHelper,
  getErrorMessage,
  sendPaymentReceivedEmail,
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
  successResponseHelper,
} from "../../../helper";
import { apiLogger, cronLogger, log } from "../../../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
  softDeleteRedisItem,
  setRedisTTL,
} from "../../../utils/redisInstance";
import sequelize from "../../../utils/dbInstance";
import { Op } from "sequelize";
import jwt from "jsonwebtoken";
// Product Catalog (Phase 1) — cart-order settlement fan-out
import { handleCartPaymentSettled } from "../../../services/orderFulfillmentService";
import { productOrderModel } from "../../../models";
import { normalizeLang, resolveCustomerLanguage } from "../../../utils/emailI18n";
import {
  adminFeeModel,
  companyModel,
  customerTransactionModel,
  userModel,
  userWalletModel,
} from "../../../models";
import { createNotification, NOTIFICATION_TYPES } from "../../notificationController";
import { formatCryptoAmount } from "../../../utils/currencyUtils";
import { buildPaymentReceivedDisplay } from "../../../utils/paymentAmountDisplay";
import {
  sendPartialPaymentNotification,
} from "../../../services/pendingPaymentService";
import {
  sendCustomerPaymentConfirmationEmail,
} from "../../../services/emailService";
import { generatePaymentReceipt, getReceiptFilename } from "../../../services/pdfReceiptService";
import crypto from "crypto";
import { safeDeleteSubscription } from "../../../helper/subscriptionHelpers";
import { incrementAdminFee, incrementUserWallet, incrementCustomerWallet } from "../../../helper/walletHelpers";

import {
  userTempAddressModel,
  userTransactionModel,
  merchantTempAddressModel,
  paymentLinkModel,
} from "../../../models";
import tatumApi from "../../../apis/tatumApi";
import { generateQRCodeWithLogo } from "../../../utils/qrCodeWithLogo";
import { getAdminWalletAddress } from "../../../utils/adminUtils";
import {
  calculateTransactionFees,
} from "../../../services/feeService";
import { 
  getBlockchainNetworkFee, 
} from "../../../services/blockchainFeeService";
import * as merchantPoolService from "../../../services/merchantPoolService";
import { getCryptoRedisKey } from "../../../services/merchantPool/merchantPoolConfig";
import { recordTransactionVolume, reverseTransactionVolume } from "../../../services/feeFreeService";
import { isVolatileCrypto } from "../../../services/binanceService";
import { createConversionRecord } from "../../../services/conversionService";
import { PaymentState, parseState, toRedisStatus } from "../../../services/paymentStateMachine";
import { calculateDynamicTRC20Fee } from "../../../services/tronEnergyService";


// ============================================
// CENTRALIZED TIMING CONFIGURATION
// ============================================
// All payment timing constants in one place for consistency
// These can be overridden by merchant settings in tbl_company

export const settleCryptoTransaction = async ({
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
    } = require("../../../services/paymentReliability");

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

    // ── LOAD-TEST SAFETY GATE ────────────────────────────────────────────────
    // When LOADTEST_NO_BROADCAST=true (staging load tests ONLY — unset in prod),
    // skip the irreversible KMS-decrypt + on-chain broadcast but STILL run the
    // real completion path (idempotency marker, PostgreSQL journal, and ledger
    // dual-write) so concurrency correctness (one-settlement-per-payment,
    // balanced ledger, no double sweep) is exercised faithfully.
    {
      const { isLoadtestNoBroadcast, syntheticTxId } = require("../../../utils/loadtestGuard");
      if (isLoadtestNoBroadcast()) {
        const fakeTxId = syntheticTxId("LOADTEST-SETTLE");
        const companyId = Number((tempAddressData as any).current_company_id) || null;
        await markSettlementCompleted(
          paymentId,
          fakeTxId,
          fromAddress,
          currency,
          Number(userAmount || 0),
          Number(receivedAmount || 0),
          companyId
        );
        cronLogger.warn(
          `[settleCryptoTransaction] 🧪 LOADTEST_NO_BROADCAST — skipped KMS+broadcast for ${paymentId}; synthetic tx ${fakeTxId}`
        );
        return { txId: fakeTxId, status: "loadtest_settled" };
      }
    }

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
      envRaw("TEMP_KEY_ID")
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
        contractAddress = envRaw("ETH_CONTRACT");
      } else if (currency === "USDC-ERC20") {
        contractAddress = envRaw("USDC_CONTRACT");
      } else if (currency === "RLUSD-ERC20") {
        contractAddress = envRaw("RLUSD_ERC20_CONTRACT");
      } else if (currency === "USDT-POLYGON") {
        contractAddress = envRaw("USDT_POLYGON_CONTRACT") || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      } else if (currency === "RLUSD") {
        contractAddress = null; // RLUSD uses XRP Ledger tokens, not contract
      } else {
        contractAddress = envRaw("TRX_CONTRACT");
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
              const { markRecipientActivated } = require("../../../services/tronEnergyService");
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
              const trc20Contract = contractAddress || envRaw("TRX_CONTRACT") || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
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
        const { journalStateTransition } = require("../../../services/paymentReliability");
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
            const { markSettlementCompleted } = require("../../../services/paymentReliability");
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
                const recoveryTrc20Contract = envRaw("TRX_CONTRACT") || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
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
                    const { markSettlementCompleted } = require("../../../services/paymentReliability");
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
            const { markSettlementCompleted } = require("../../../services/paymentReliability");
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
        const { markSettlementCompleted } = require("../../../services/paymentReliability");
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
      const { markSettlementFailed } = require("../../../services/paymentReliability");
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

