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
import { emitPaymentOverpaid } from "../../../services/webhookEvents";
import { calculateDynamicTRC20Fee } from "../../../services/tronEnergyService";

import { cryptoVerification } from "./chainVerification";

export const verifyCryptoPayment = async (
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

        // Tier-1 item #2: payment.overpaid (opt-in event, deduped per payment —
        // this endpoint is polled, so it must only ever fire once).
        emitPaymentOverpaid(
          {
            company_id: customerData?.company_id || tempData?.company_id || null,
            link_id: customerData?.link_id || tempData?.link_id || null,
            webhook_url: customerData?.webhook_url || tempData?.webhook_url || null,
            callback_url: customerData?.callback_url || tempData?.callback_url || null,
            webhook_secret: customerData?.webhook_secret || tempData?.webhook_secret || null,
          },
          {
            payment_id: tempData?.payment_id || tempData?.unique_tx_id,
            address,
            txId: tempData?.txId || null,
            amount_received: parseFloat(totalReceived.toFixed(8)),
            amount_expected: parseFloat(originalExpected.toFixed(8)),
            excess_amount: parseFloat(overpaymentAmount.toFixed(8)),
            excess_amount_usd: parseFloat(overpaymentUsd.toFixed(2)),
            currency,
            base_amount: actualBaseAmount,
            base_currency: baseCurrency,
            link_id: customerData?.link_id || tempData?.link_id || null,
          }
        ).catch(() => { /* emitters never throw; guard for safety */ });
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

/**
 * POST /pay/receipt — buyer-facing PDF receipt for a CONFIRMED crypto payment.
 *
 * Called from the checkout "paid" card (CleanCheckoutV2) so the customer can
 * keep proof of payment. Mirrors verifyCryptoPayment's session/tag resolution
 * EXACTLY (address + optional destination_tag via the customer session), is
 * strictly READ-ONLY (Redis reads + one company name lookup, no writes), and
 * only produces a receipt once the payment state is PAYOUT_COMPLETE.
 * Reuses services/pdfReceiptService.generatePaymentReceipt — the same branded
 * PDF already attached to customer confirmation emails.
 */
