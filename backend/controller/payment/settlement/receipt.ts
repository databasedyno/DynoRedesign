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
import { isMerchantIdentityVerified } from "../../../helper/merchantVerification";
import crypto from "crypto";
import { safeDeleteSubscription } from "../../../helper/subscriptionHelpers";
import { incrementAdminFee, incrementUserWallet, incrementCustomerWallet } from "../../../helper/walletHelpers";

import {
  userTempAddressModel,
  userTransactionModel,
  merchantTempAddressModel,
  paymentLinkModel,
} from "../../../models";
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

export const downloadReceipt = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { address, destination_tag, lang } = req.body || {};
    const userData = jwt.decode(res.locals.token) as { ref?: string; [key: string]: unknown } | null;

    if (!address || typeof address !== "string") {
      return errorResponseHelper(res, 400, "address is required");
    }

    // Resolve destination_tag from customer session if not provided (XRP/RLUSD)
    let resolvedTag = destination_tag ? Number(destination_tag) : null;
    if (!resolvedTag && userData?.ref) {
      try {
        const customerSession = await getRedisItem(`customer-${userData.ref}`);
        const sessionTag = customerSession?.active_crypto_address?.destination_tag || customerSession?.destination_tag;
        if (sessionTag) resolvedTag = Number(sessionTag);
      } catch {
        /* best effort — fall through to untagged key */
      }
    }

    const receiptRedisKey = resolvedTag ? getCryptoRedisKey(address, resolvedTag) : `crypto-${address}`;
    const tempData = await getRedisItem(receiptRedisKey);

    if (!tempData || Object.keys(tempData).length === 0) {
      return errorResponseHelper(res, 404, "Payment not found or receipt no longer available");
    }

    // Receipt only exists for a COMPLETED payment
    const parsedState = parseState(tempData?.status);
    if (parsedState !== PaymentState.PAYOUT_COMPLETE) {
      return errorResponseHelper(res, 409, "Receipt is available once the payment is confirmed");
    }

    const customerData = (await getRedisItem(tempData?.ref)) || {};

    // Merchant (company) name — read-only lookup
    let companyName = "Merchant";
    let companyOwnerUserId: number | null = null;
    const companyId = customerData?.company_id || tempData?.company_id;
    if (companyId) {
      try {
        const company = await companyModel.findOne({ where: { company_id: companyId } });
        if (company?.dataValues?.company_name) companyName = company.dataValues.company_name;
        if (company?.dataValues?.user_id) companyOwnerUserId = Number(company.dataValues.user_id);
      } catch {
        /* keep fallback name */
      }
    }

    // Identity-verified merchant marker for the PDF (best-effort, read-only).
    let merchantVerified = false;
    try {
      merchantVerified = await isMerchantIdentityVerified(
        companyOwnerUserId,
        companyId ? Number(companyId) : null
      );
    } catch {
      merchantVerified = false;
    }

    // Amounts — same sources verifyCryptoPayment uses for its confirmed payload
    const receivedAmount = parseFloat(tempData?.receivedAmount || tempData?.amount || "0");
    const baseCurrency = tempData?.base_currency || customerData?.base_currency || "USD";
    const baseAmount = parseFloat(
      tempData?.base_amount || tempData?.base_amount_usd || customerData?.base_amount || "0"
    );
    const currency = tempData?.currency || "";

    const transactionId = String(
      tempData?.payment_id || tempData?.unique_tx_id || tempData?.txId || userData?.ref || "unknown"
    );
    const blockchainTx = tempData?.txId ? String(tempData.txId) : undefined;

    const customerEmail = String(
      customerData?.customer_email || customerData?.email || tempData?.customer_email || ""
    );
    const customerName = customerData?.customer_name || customerData?.name || undefined;

    const L = normalizeLang(
      resolveCustomerLanguage({
        transactionLang: typeof lang === "string" ? lang : null,
        checkoutLang: customerData?.lang || customerData?.language || null,
        merchantLang: null,
      })
    );

    const paymentDate = tempData?.completedAt ? new Date(tempData.completedAt) : new Date();

    const pdfBuffer = await generatePaymentReceipt({
      transactionId,
      transactionReference: blockchainTx,
      amount: `${Number(baseAmount || 0).toFixed(2)}`,
      currency: baseCurrency,
      cryptoAmount: receivedAmount > 0 ? formatCryptoAmount(receivedAmount, currency) : undefined,
      cryptoCurrency: currency || undefined,
      companyName,
      merchantVerified,
      customerEmail: customerEmail || "-",
      customerName,
      paymentDate: isNaN(paymentDate.getTime()) ? new Date() : paymentDate,
      description: customerData?.description || customerData?.title || undefined,
      paymentMethod: currency ? `Cryptocurrency (${currency})` : "Cryptocurrency",
      status: undefined, // pdfReceiptService renders localized "Completed" by default
      lang: L,
    });

    const filename = getReceiptFilename(transactionId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    return res.status(200).send(pdfBuffer);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error("[downloadReceipt] " + message, new Error(e));
    return errorResponseHelper(res, 500, "Could not generate receipt");
  }
};

