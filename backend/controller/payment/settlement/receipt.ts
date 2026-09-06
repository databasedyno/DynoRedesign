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
import { formatBreakdown, resolveSettledBreakdown } from "./settledBreakdown";
import { buildPaymentReceivedDisplay } from "../../../utils/paymentAmountDisplay";
import {
  sendPartialPaymentNotification,
} from "../../../services/pendingPaymentService";
import {
  sendCustomerPaymentConfirmationEmail,
} from "../../../services/emailService";
import { generatePaymentReceipt, getReceiptFilename, type ReceiptData } from "../../../services/pdfReceiptService";
import { ensureReceiptLink } from "../../../services/receiptLinkService";
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
import { toFixedStr } from "../../../utils/money";

type CheckoutReceiptResolution =
  | { ok: true; data: ReceiptData; companyId: number | null }
  | { ok: false; status: number; message: string };

/**
 * Resolve the receipt data for the buyer's CURRENT checkout (customer-session
 * token + payment address → Redis checkout state). Shared by the PDF download
 * and the "shareable link" endpoint so both surfaces show identical figures.
 */
const resolveCheckoutReceipt = async (
  req: express.Request,
  res: express.Response
): Promise<CheckoutReceiptResolution> => {
  const { address, destination_tag, lang } = req.body || {};
  const userData = jwt.decode(res.locals.token) as { ref?: string; [key: string]: unknown } | null;

  if (!address || typeof address !== "string") {
    return { ok: false, status: 400, message: "address is required" };
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
    return { ok: false, status: 404, message: "Payment not found or receipt no longer available" };
  }

  // Receipt only exists for a COMPLETED payment
  const parsedState = parseState(tempData?.status);
  if (parsedState !== PaymentState.PAYOUT_COMPLETE) {
    return { ok: false, status: 409, message: "Receipt is available once the payment is confirmed" };
  }

  const customerData = (await getRedisItem(tempData?.ref)) || {};

  // Merchant (company) name — read-only lookup
  let companyName = "Merchant";
  let companyOwnerUserId: number | null = null;
  let companyLogo: string | null = null;
  const companyId = customerData?.company_id || tempData?.company_id;
  if (companyId) {
    try {
      const company = await companyModel.findOne({ where: { company_id: companyId } });
      if (company?.dataValues?.company_name) companyName = company.dataValues.company_name;
      if (company?.dataValues?.user_id) companyOwnerUserId = Number(company.dataValues.user_id);
      if (company?.dataValues?.photo) companyLogo = String(company.dataValues.photo);
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

  return {
    ok: true,
    companyId: companyId ? Number(companyId) : null,
    data: {
      transactionId,
      transactionReference: blockchainTx,
      amount: `${toFixedStr(baseAmount || 0, 2)}`,
      currency: baseCurrency,
      cryptoAmount: receivedAmount > 0 ? formatCryptoAmount(receivedAmount, currency) : undefined,
      cryptoCurrency: currency || undefined,
      companyName,
      companyLogo: companyLogo || undefined,
      merchantVerified,
      customerEmail: customerEmail || "-",
      customerName,
      paymentDate: isNaN(paymentDate.getTime()) ? new Date() : paymentDate,
      description: customerData?.description || customerData?.title || undefined,
      paymentMethod: undefined, // pdfReceiptService renders localized "Cryptocurrency (<coin>)"
      status: undefined, // pdfReceiptService renders localized "Completed" by default
      lang: L,
      breakdown: formatBreakdown(resolveSettledBreakdown(tempData, currency)),
    },
  };
};

/** POST /pay/receipt — branded PDF receipt for the buyer's confirmed checkout. */
export const downloadReceipt = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const resolved = await resolveCheckoutReceipt(req, res);
    if (resolved.ok === false) return errorResponseHelper(res, resolved.status, resolved.message);

    // Best-effort: mint the shareable link so the PDF footer can carry it.
    const link = await ensureReceiptLink(resolved.data, resolved.companyId);
    const pdfBuffer = await generatePaymentReceipt({ ...resolved.data, receiptUrl: link?.url });

    const filename = getReceiptFilename(resolved.data.transactionId);
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

/**
 * POST /pay/receipt/link — create-or-reuse the public shareable receipt URL for
 * the buyer's confirmed checkout (same auth + data as the PDF download).
 */
export const createReceiptLink = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const resolved = await resolveCheckoutReceipt(req, res);
    if (resolved.ok === false) return errorResponseHelper(res, resolved.status, resolved.message);
    const link = await ensureReceiptLink(resolved.data, resolved.companyId);
    if (!link) return errorResponseHelper(res, 500, "Could not create receipt link");
    return successResponseHelper(res, 200, "Receipt link ready", { url: link.url, token: link.token });
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error("[createReceiptLink] " + message, new Error(e));
    return errorResponseHelper(res, 500, "Could not create receipt link");
  }
};
