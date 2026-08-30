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
import { deliverMerchantWebhook } from "../../../services/outbox/merchantWebhookOutbox";

import {
  userTempAddressModel,
  userTransactionModel,
  merchantTempAddressModel,
  paymentLinkModel,
} from "../../../models";
import { tatumClient } from "../../../integrations/tatum/TatumClient";
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
import { PaymentState, parseState, toRedisStatus, persistTransition } from "../../../services/paymentStateMachine";
import { calculateDynamicTRC20Fee } from "../../../services/tronEnergyService";
import { getAvailableCreditForFees, consumeReferralCreditForTransaction } from "../../../services/referralCreditService";

import { settleCryptoTransaction } from "./settleTransaction";

export const cryptoVerification = async (address, webhook = true, overrideRedisKey?: string) => {
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

        // AUDIT: journal the partial-payment state change (pending → underpaid)
        await persistTransition({
          paymentId: tempAddressData.payment_id || transactionId,
          from: PaymentState.PENDING,
          to: PaymentState.UNDERPAID,
          event: "partial_payment_received",
          actor: "chain_verification",
          txId: transactionId,
          address,
          currency: tempCurrency,
          amount: Number(receivedAmount),
          metadata: { expected_total: expectedAmount, remaining: pendingAmount },
        });

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
            // Overpayment routing: the merchant receives at most their expected
            // (full) net share — the merchant ratio is capped at 1.0. Any excess
            // from an overpayment therefore flows entirely to the admin. Underpayments
            // (ratio < 1) still settle proportionally to the merchant (unchanged).
            const merchantRatio = Math.min(paymentRatio, 1);
            userAmountToSend = preCalcMerchantAmount * merchantRatio;
            adminAmountToSend = Number(totalAmountReceived) - userAmountToSend;
            
            cronLogger.info(`[cryptoVerification] ${fee_payer === 'customer' ? 'CUSTOMER' : 'COMPANY'} PAYS FEES — RATIO-BASED DISTRIBUTION:
              - Expected: ${expectedCrypto.toFixed(8)} ${tempCurrency}
              - Payment ratio: ${paymentRatio.toFixed(4)} (${paymentRatio > 1 ? 'overpaid → excess to admin' : paymentRatio === 1 ? 'exact' : 'underpaid'})
              - Merchant ratio (capped at 1.0): ${merchantRatio.toFixed(4)}
              - Merchant: ${userAmountToSend.toFixed(8)} ${tempCurrency} (scaled from pre-calc ${preCalcMerchantAmount.toFixed(8)})
              - Admin (fees${paymentRatio > 1 ? ' + overpayment excess' : ''}): ${adminAmountToSend.toFixed(8)} ${tempCurrency}`);
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

        // ============================================================
        // REFERRAL FEE-CREDIT (Option 1.a) — reduce THIS merchant's platform fee
        // using their own accrued referral revenue-share balance, by shifting
        // crypto from the admin fee to the merchant payout for exactly this payment.
        //   • Only in 'credit' payout mode (getAvailableCreditForFees returns 0 otherwise).
        //   • Capped at this payment's platform-fee USD (totalDeduction) → admin fee
        //     can never go negative; gas/network buffer is NEVER touched.
        //   • Skipped on auto-convert (userAmountToSend=0) and under-threshold (userAmountToSend=0).
        //   • Consumed AFTER the settlement commits (idempotent) — see below.
        // Wrapped so ANY failure falls back to the UNMODIFIED split (never blocks a settlement).
        // NOTE: not E2E-testable in SAFE-MODE preview (no real payments) — verified on prod.
        // ============================================================
        let referralCreditAppliedUsd = 0;
        try {
          if (userAmountToSend > 0 && adminAmountToSend > 0 && !autoConvertEnabled && verifyUserId) {
            const availableCredit = await getAvailableCreditForFees(verifyUserId);
            if (availableCredit > 0 && receivedUSD > 0) {
              const applyUsd = Math.min(availableCredit, Number(totalDeduction) || 0);
              if (applyUsd > 0) {
                // Convert the USD credit to crypto at THIS payment's realized rate.
                let creditCrypto = applyUsd * (Number(totalAmountReceived) / receivedUSD);
                // Belt-and-suspenders: never drive the admin fee negative.
                if (creditCrypto > adminAmountToSend) creditCrypto = adminAmountToSend;
                if (creditCrypto > 0) {
                  adminAmountToSend = adminAmountToSend - creditCrypto;
                  userAmountToSend = userAmountToSend + creditCrypto;
                  if (userAmountToSend > Number(totalAmountReceived)) {
                    userAmountToSend = Number(totalAmountReceived);
                  }
                  // Persist/consume the USD actually shifted on-chain (creditCrypto back
                  // to USD), never more than the fee cap — so a clamp can't over-consume
                  // the balance relative to the merchant's realized benefit. In the normal
                  // (no-clamp) case this equals applyUsd exactly.
                  const actualUsd = creditCrypto * (receivedUSD / Number(totalAmountReceived));
                  referralCreditAppliedUsd = Math.min(applyUsd, Math.round(actualUsd * 100) / 100);
                  cronLogger.info(`[ReferralCredit] Applying $${referralCreditAppliedUsd.toFixed(2)} fee-credit for user ${verifyUserId}: admin=${adminAmountToSend.toFixed(8)} merchant=${userAmountToSend.toFixed(8)} ${tempCurrency} (shifted ${creditCrypto.toFixed(8)})`);
                }
              }
            }
          }
        } catch (creditErr: any) {
          referralCreditAppliedUsd = 0;
          cronLogger.warn(`[ReferralCredit] fee-credit skipped (non-fatal): ${creditErr?.message || creditErr}`);
        }

        // ── FIX: Advisory pre-check only - Let SmartGas attempt funding ──
        // SmartGas will automatically fund TRX from fee wallet if needed
        const isTRC20Currency = tempCurrency.includes("TRC20");
        if (isTRC20Currency) {
          try {
            const { getAccountResources, calculateDynamicTRC20Fee } = require("../../../services/tronEnergyService");
            const poolAddress = tempAddressData.wallet_address || tempAddressData.address;
            const poolResources = await getAccountResources(poolAddress);
            const dynamicFee = await calculateDynamicTRC20Fee(poolAddress);
            const requiredTRX = dynamicFee.fast * 1.5; // 50% safety buffer
            
            // Check pool address TRX balance (from TronGrid)
            const poolTRXBalance = poolResources.availableBandwidth >= 0 ? 0 : 0; // fallback
            
            // Check fee wallet TRX balance via Tatum (advisory only)
            // FIX (2026-04-02): Use envRaw("TRX_FEE_WALLET") (the actual gas fee wallet),
            // NOT getAdminWalletAddress("TRX") which returns envRaw("TRX") — the admin
            // COLLECTION wallet (4.48 TRX) instead of the gas wallet (115+ TRX).
            // This mismatch caused false DEFERRED settlements when the gas wallet was fine.
            const feeWalletAddress = envRaw("TRX_FEE_WALLET") || null;
            if (feeWalletAddress) {
              const feeWalletCheck = await tatumClient.getAddressBalance(feeWalletAddress, "TRX", true).catch(() => null);
              const feeWalletBalance = Number(feeWalletCheck?.balance || feeWalletCheck?.incoming || 0);
              
              if (feeWalletBalance < requiredTRX && poolResources.availableEnergy < 65000) {
                // WARNING ONLY - Let SmartGas attempt to fund
                cronLogger.warn(`[cryptoVerification] ⚠️ TRX fee wallet low for USDT-TRC20 settlement. Balance: ${feeWalletBalance} TRX, Estimated: ~${requiredTRX.toFixed(1)} TRX. SmartGas will attempt funding. Payment: ${tempAddressData.payment_id || 'unknown'}`);
                
                // Only abort if fee wallet is CRITICALLY low (< 5 TRX) AND no energy
                if (feeWalletBalance < 5 && poolResources.availableEnergy < 65000) {
                  cronLogger.error(`[cryptoVerification] ❌ CRITICAL: Fee wallet nearly empty (${feeWalletBalance} TRX < 5 TRX). Deferring. Payment ${tempAddressData.payment_id || 'unknown'} needs urgent top-up.`);
                  const { journalStateTransition } = require("../../../services/paymentReliability");
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
              const { verifySettlementOnChain, markSettlementCompleted } = require("../../../services/paymentReliability");
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
          const adminEmail = envRaw("ADMIN_EMAIL");
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
              const adminEmail = envRaw("ADMIN_EMAIL");
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

          // Session 49 fix: capture actual confirmation count from the chain at
          // settlement time. Previously every completed row showed confirmations=0
          // in the DB because we never updated the counter after payment_pending.
          // Non-fatal — if tatum times out we still persist required_confirmations
          // as a floor since we know that threshold was satisfied to reach this
          // branch of the state machine.
          let finalConfirmations: number | null = null;
          try {
            if (transactionId && typeof transactionId === 'string') {
              const confCheck = await tatumClient.getTransactionConfirmations(transactionId, tempCurrency);
              if (confCheck && typeof confCheck.confirmations === 'number') {
                finalConfirmations = confCheck.confirmations;
              }
            }
          } catch (confErr) {
            cronLogger.warn(`[cryptoVerification] Could not fetch final confirmations for tx=${transactionId}: ${(confErr as Error)?.message}`);
          }

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
            // Referral fee-credit (Option 1.a): USD of the platform fee that was
            // covered by the merchant's own referral revenue-share balance on THIS
            // payment (0 when not applicable). Powers the merchant email + UI badge.
            referral_credit_applied_usd: referralCreditAppliedUsd,
            // Session 49 fix: persist actual confirmation count so merchants can
            // see the real number in the dashboard (was stuck at 0 previously).
            ...(finalConfirmations !== null ? { confirmations: finalConfirmations } : {}),
            // ── Session 57: persist tax context so merchants can reconcile ──
            // Tax info was computed + cached by getData in cryptoCheckout.ts
            // (see `_cached_tax_info` on customerData) OR came in via the
            // cart's synthetic payment link. We stamp it here so the
            // merchant's transactions list shows "of which VAT: X".
            ...(customerData?._cached_tax_info
              ? {
                  tax_amount: Number(customerData._cached_tax_info.tax_amount) || 0,
                  tax_rate: customerData._cached_tax_info.tax_rate ?? null,
                  tax_label: customerData._cached_tax_info.tax_acronym || null,
                  tax_country_code: customerData._cached_tax_info.country_code || null,
                  customer_vat_id: customerData._cached_tax_info.customer_vat_id || null,
                  reverse_charge: !!customerData._cached_tax_info.reverse_charge,
                }
              : {}),
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
              status: "successful",
              crypto_amount: Number(totalAmountReceived),
              crypto_currency: tempCurrency,
              transaction_fee: Number(adminAmountToSend),
              transaction_reference: allTxIds,
              usd_value: (await convertToUSD(Number(totalAmountReceived), tempCurrency)) || 0,
              // AUTO-CONVERT FIX (referral accrual + merchant fee display): on
              // auto-convert the merchant portion was merged into adminAmountToSend
              // and userAmountToSend zeroed (for the Binance sweep), which left this
              // row's bookkeeping fields wrong — transaction_fee would read as
              // fee+merchant and base_amount stayed the fiat creation value. Record
              // it EXACTLY like the normal keep-crypto path (see the userPayload
              // above) using the pre-merge captures so downstream consumers see the
              // TRUE platform fee: transaction_fee = fee only, base_amount = the
              // merchant's net crypto, usd_value = USD of that net. adminFeeForConversion
              // (== adminAmountToSend − originalUserAmount) and originalUserAmount were
              // both captured BEFORE the merge. NO on-chain routing changes here.
              ...(autoConvertEnabled
                ? {
                    transaction_fee: Number(adminFeeForConversion),
                    base_amount: Number(originalUserAmount).toFixed(8),
                    usd_value: (await convertToUSD(Number(originalUserAmount), tempCurrency)) || 0,
                  }
                : {}),
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
            // AUDIT: journal the overpayment rejection state change
            await persistTransition({
              paymentId: tempData?.payment_id || tempData?.unique_tx_id || transactionId,
              from: PaymentState.DETECTED,
              to: "overpayment",
              event: "overpayment_rejected",
              actor: "chain_verification",
              txId: transactionId,
              address,
              currency: tempCurrency,
              amount: Number(tempAmount),
              metadata: { amount_base: newAmount[0].amount, base_currency: customerData?.base_currency || "USD" },
            });
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

          // AUDIT: journal the terminal completion state change (processing → payout_complete)
          await persistTransition({
            paymentId: String(linkTransactionId),
            from: PaymentState.PROCESSING,
            to: PaymentState.PAYOUT_COMPLETE,
            event: "payment_completed",
            actor: "chain_verification",
            txId: transactionId,
            address,
            currency: tempCurrency,
            amount: Number(totalAmountReceived),
          });
        }

        // Product Catalog (Phase 1) — fan-out for cart orders.
        // Detects `link_type='cart'` payment links and triggers digital
        // fulfillment + receipt emails. Idempotent: handleCartPaymentSettled
        // early-returns on already-paid orders, so webhook retries are safe.
        let __cartOrderIdForFanout: number | null = null;
        try {
          const linkType = customerData?.link_type || tempData?.link_type;
          if (linkType === "cart") {
            const linkRow: any = linkTransactionId
              ? await paymentLinkModel.findOne({
                  where: { transaction_id: linkTransactionId },
                  transaction,
                })
              : null;
            const linkId = linkRow?.dataValues?.link_id;
            if (linkId) {
              const orderRow: any = await productOrderModel.findOne({
                where: { payment_link_id: linkId },
                transaction,
              });
              if (orderRow) {
                __cartOrderIdForFanout = Number(orderRow.dataValues.order_id);
                cronLogger.info(
                  `[cryptoVerification] cart order ${__cartOrderIdForFanout} detected for link ${linkId} — fan-out queued (post-commit)`
                );
              }
            }
          }
        } catch (cartLookupErr: any) {
          cronLogger.warn(
            `[cryptoVerification] cart-order lookup failed: ${cartLookupErr?.message || cartLookupErr}`
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

        // ── Referral fee-credit consumption (Option 1.a) ──
        // Only now that the settlement is durably committed do we spend the
        // referral balance that funded the fee reduction above. The service is
        // idempotent (keyed by the tx ref) and credit-mode-gated, so a settlement
        // retry can NEVER double-spend. Non-fatal: a failure here leaves the credit
        // available for a later retry and never affects the (already committed) payout.
        if (referralCreditAppliedUsd > 0 && verifyUserId) {
          try {
            const referralTxRef = String(
              tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id || transactionId
            );
            const consumed = await consumeReferralCreditForTransaction({
              userId: verifyUserId,
              maxUsd: referralCreditAppliedUsd,
              transactionRef: referralTxRef,
            });
            cronLogger.info(`[ReferralCredit] Consumed $${consumed.toFixed(2)} referral credit for user ${verifyUserId} (tx ${referralTxRef})`);
          } catch (consumeErr: any) {
            cronLogger.error(`[ReferralCredit] consume failed (non-fatal, credit stays available): ${consumeErr?.message || consumeErr}`);
          }
        }

        // Product Catalog (Phase 1) — trigger cart fulfillment after commit
        if (__cartOrderIdForFanout) {
          setImmediate(async () => {
            try {
              await handleCartPaymentSettled(__cartOrderIdForFanout as number, {
                crypto_amount: totalAmountReceived,
                crypto_currency: tempCurrency,
                crypto_network:
                  (tempData as any)?.chain ||
                  (tempData as any)?.network ||
                  undefined,
              });
            } catch (fanoutErr: any) {
              cronLogger.error(
                `[cryptoVerification] cart fan-out failed for order ${__cartOrderIdForFanout}: ${
                  fanoutErr?.message || fanoutErr
                }`
              );
            }
          });
        }
        
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
          // Terminal merchant webhook: fire payment.settled AFTER on-chain settlement
          // completes (PAYOUT_COMPLETE). Some merchant integrations only credit/fulfil an
          // order on a terminal settled event and re-verify the payment via
          // GET /api/user/getCryptoTransaction/:address — which only returns a completed
          // status once settlement has finished. Emitting it here (the common completion
          // point for the webhook, pool-monitor and polling paths) guarantees the merchant
          // gets a terminal event and re-verifies at a point where the status is final.
          const settledPaymentId = tempData?.payment_id || tempData?.unique_tx_id || tempData?.ref || "unknown";
          const settledDedupKey = `confirmed-webhook-sent-${settledPaymentId}`;
          const merchantAmountFinal = autoConvertEnabled ? originalUserAmount : userAmountToSend;
          const totalFeeFinal = autoConvertEnabled ? (adminAmountToSend - originalUserAmount) : adminAmountToSend;

          // Merge webhook routing from customerData + tempData (either may hold it).
          const settledCustomerData: Record<string, unknown> = { ...(customerData || {}) };
          if (!settledCustomerData.webhook_url && tempData?.webhook_url) settledCustomerData.webhook_url = tempData.webhook_url;
          if (!settledCustomerData.callback_url && tempData?.callback_url) settledCustomerData.callback_url = tempData.callback_url;
          if (!settledCustomerData.webhook_secret && tempData?.webhook_secret) settledCustomerData.webhook_secret = tempData.webhook_secret;
          if (!settledCustomerData.company_id && tempData?.company_id) settledCustomerData.company_id = tempData.company_id;
          if (!settledCustomerData.link_id && tempData?.link_id) settledCustomerData.link_id = tempData.link_id;

          if (settledCustomerData.webhook_url || settledCustomerData.callback_url) {
            const settledLinkId = settledCustomerData.link_id || tempData?.link_id || null;
            const settledPaymentType = settledLinkId ? "payment_link" : "direct_api";

            // Idempotency: set BEFORE sending. webhookProcessor.ts honours this same key
            // (confirmed-webhook-sent-{paymentId}) so payment.settled is delivered exactly once
            // regardless of which path (webhook / pool-monitor / polling) drove settlement.
            await setRedisItem(settledDedupKey, { sent: true, sentAt: new Date().toISOString(), source: "cryptoVerification-settled" });
            await setRedisTTL(settledDedupKey, 86400); // 24 hours

            let settledMeta: unknown = settledCustomerData.meta_data ?? tempData?.meta_data ?? null;
            if (typeof settledMeta === "string") { try { settledMeta = JSON.parse(settledMeta); } catch { /* keep raw */ } }

            try {
              const settledResult = await deliverMerchantWebhook(settledCustomerData, {
                event: "payment.settled",
                payment_type: settledPaymentType,
                address,
                txId: transactionId,
                transaction_reference: transactionId,
                amount: Number(totalAmountReceived),
                currency: tempCurrency,
                payment_id: settledPaymentId,
                status: "settled",
                payment_status: "settled",
                base_amount: settledCustomerData.base_amount || tempData?.base_amount_usd || null,
                base_currency: settledCustomerData.base_currency || "USD",
                customer_name: settledCustomerData.customer_name || null,
                customer_email: settledCustomerData.email || null,
                description: settledCustomerData.description || null,
                link_id: settledLinkId,
                fee_payer: tempData?.fee_payer || settledCustomerData.fee_payer || "company",
                merchant_amount: merchantAmountFinal,
                admin_fee_amount: totalFeeFinal,
                settlement_tx_id: outgoingMerchantTxHash,
                meta_data: settledMeta,
                ...(autoConvertEnabled ? { auto_convert_currency: autoConvertTargetCurrency } : {}),
                created_at: new Date().toISOString(),
                settled_at: new Date().toISOString(),
              } as Record<string, unknown>);
              cronLogger.info(`[cryptoVerification] payment.settled webhook ${settledResult?.success ? "delivered" : "attempted"} (mode=${settledResult?.mode || "n/a"}) for ${settledPaymentId} — merchant_amount=${merchantAmountFinal}, fee=${totalFeeFinal}, settlement_tx=${outgoingMerchantTxHash || "N/A"}`);
            } catch (settledErr) {
              // A webhook must never break payment processing.
              cronLogger.error(`[cryptoVerification] payment.settled webhook error for ${settledPaymentId}: ${(settledErr as Error).message}`);
            }
          } else {
            cronLogger.info(`[cryptoVerification] Settlement complete — no merchant webhook_url configured for ${settledPaymentId}, skipping payment.settled`);
          }
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

        // Contribution branching (Phase 3.3 P1): if this transaction is a
        // donation contribution, look up the parent campaign name so the merchant
        // and donor receipt emails are contribution-flavored instead of the
        // standard "Payment received" / "Your payment to X" copy.
        let campaignName: string | undefined = undefined;
        try {
          const parentLinkId = customerData?.parent_link_id || tempData?.parent_link_id;
          const linkType = customerData?.link_type || tempData?.link_type;
          if (linkType === "contribution" && parentLinkId) {
            const parent = await paymentLinkModel.findOne({
              where: { link_id: parentLinkId },
              attributes: ["title", "description"],
            });
            const raw = (parent?.dataValues?.title || parent?.dataValues?.description || "")
              .toString()
              .trim();
            if (raw && raw.toLowerCase() !== "no description") campaignName = raw;
          }
        } catch (e) {
          cronLogger.warn(
            `[cryptoVerification] campaign name lookup failed for tx=${transactionId}: ${(e as Error)?.message}`
          );
        }

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
          // Solution B: greet by THIS company's contact person so multi-company
          // merchants get the right identity in each company's emails. Falls back
          // to the account-level user.name when no per-company contact is set.
          const merchantContactName =
            [company_data?.contact_first_name, company_data?.contact_last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || userData?.name || "";
          // Bug fix (session 49): use the actual on-chain payment detection time
          // (tbl_user_transaction.createdAt) instead of `new Date()`. Previously the
          // email showed "paid at 13:54" when the customer actually paid at 13:49 —
          // because this handler runs 5 minutes later, after N-block confirmation
          // + sweep. Falls back to `new Date()` only when the row lookup fails.
          let paymentDateTime: Date = new Date();
          try {
            const utxIdCandidate =
              (tempData as any)?.user_tx_id ||
              (tempData as any)?.unique_tx_id ||
              (tempData as any)?.payment_id ||
              customerPayload?.id;
            if (utxIdCandidate) {
              const utxRow = await userTransactionModel.findOne({
                where: { id: utxIdCandidate },
                attributes: ['createdAt'],
              });
              const utxCreatedAt = (utxRow as any)?.dataValues?.createdAt || (utxRow as any)?.createdAt;
              if (utxCreatedAt) {
                paymentDateTime = new Date(utxCreatedAt);
                cronLogger.info(`[cryptoVerification] Using tx createdAt=${paymentDateTime.toISOString()} as payment-received email timestamp (email would previously show current time = ${new Date().toISOString()})`);
              }
            }
          } catch (tsErr) {
            cronLogger.warn(`[cryptoVerification] Failed to resolve payment timestamp for tx=${transactionId}: ${(tsErr as Error)?.message} — falling back to current time`);
          }
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
            merchantContactName,
            mrPrimaryAmount,         // fiat amount (merchant currency)
            mrPrimaryCurrency,       // fiat currency (e.g. USD)
            companyName,             // companyName
            transactionId,           // transactionId
            paymentDateStr,          // date
            paymentTimeStr,          // time
            normalizeLang((userData as { language?: string })?.language), // merchant language
            mrCryptoAmount,          // crypto amount received (secondary)
            mrCryptoCurrency,        // crypto currency (secondary, e.g. "ETH → USDT")
            campaignName,            // Phase 3.3 P1: when set, sends contribution-flavored copy
            referralCreditAppliedUsd // Referral fee-credit (Option 1.a): >0 adds the "credit covered $X" line
          );
        }

        // Get company name for notifications (used below)
        const companyName = company_data?.company_name ?? "";

        // Send large transaction alert if amount > $1000 USD equivalent
        const baseAmount = customerData?.base_amount || tempData?.base_amount || 0;
        const LARGE_TRANSACTION_THRESHOLD = 1000;
        if (parseFloat(baseAmount) >= LARGE_TRANSACTION_THRESHOLD) {
          try {
            const { sendLargeTransactionAlertEmail } = await import("../../../services/emailService");
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
          const customerEmail = customerData?.email || customerData?.customer_email || tempData?.email || tempData?.customer_email;
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
                }), // customer language
                campaignName // Phase 3.3 P1: when set, sends "Thank you for supporting" copy
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
      const paymentStatus = await tatumClient.getCurrentPaymentStatus(address, currency);
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


