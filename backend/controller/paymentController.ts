import { raw as envRaw } from "../utils/config";
import express from "express";
import {
  PAYMENT_TIMING,
  ADMIN_CONFIG,
} from "./payment/paymentConfig";
import {
  createPaymentLink,
  getPaymentLinks,
  getPaymentLinkById,
  updatePaymentLink,
  deletePaymentLink,
  startDonation,
  startTip,
  uploadCampaignImage,
  getCreatorProfile,
  getCreatorPublicAnalytics,
  setRefundAddress,
} from "./payment/paymentLinkController";
import {
  getNetworkFees,
  calculatePaymentAmount,
  getConfiguredCurrenciesForCheckout,
  calculateCheckoutFees,
  getFeePreview,
  getCompanyConfiguredCurrencies,
} from "./payment/feeController";
import {
  currencyConvert,
  decrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  sendAdminFeeReceivedEmail,
  successResponseHelper,
} from "../helper";
import { apiLogger, cronLogger } from "../utils/loggers";
import { handleControllerError } from "../helper/controllerErrorHandler";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "../utils/redisInstance";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import {
  adminFeeModel,
  adminFeeTransactionModel,
  companyModel,
  customerModel,
  customerTransactionModel,
  customerWalletModel,
  userWalletModel,
} from "../models";
import { createNotification, NOTIFICATION_TYPES } from "./notificationController";
import {
  sendPartialPaymentExpiredNotification,
} from "../services/pendingPaymentService";
import {
  FW_API_Response,
  IFundData,
  ITemporaryAddress,
  IUserType,
  IVerifyResponse,
  IAdminData,
  PaymentUserJwtPayload,
} from "../utils/types";
import { paymentTypes } from "../utils/enums";
import flw from "../apis/flutterwaveApi";
import axios from "axios";
import { getCountryFromIP } from "../utils/geolocation";
import { safeDeleteSubscription } from "../helper/subscriptionHelpers";
import { incrementAdminFee, incrementUserWallet } from "../helper/walletHelpers";

import {
  userTempAddressModel,
  userTransactionModel,
  merchantTempAddressModel,
} from "../models";
import tatumApi from "../apis/tatumApi";
import blockchairApi from "../apis/blockchairApi";
import { getAdminWalletAddress } from "../utils/adminUtils";
import {
  calculateTransactionFees,
} from "../services/feeService";
import { 
  getBlockchainNetworkFee,
  getAllBlockchainFees,
} from "../services/blockchainFeeService";
import { getCryptoRedisKey } from "../services/merchantPool/merchantPoolConfig";
import { PaymentState, toRedisStatus } from "../services/paymentStateMachine";

// ============================================
// CENTRALIZED TIMING CONFIGURATION
// ============================================
// All payment timing constants in one place for consistency
// These can be overridden by merchant settings in tbl_company

import { calculateTaxForCheckout } from "./payment/taxService";
import { settleCryptoTransaction, verifyCryptoPayment, cryptoVerification, downloadReceipt } from "./payment/cryptoSettlement";
import { getData, getPaymentMeta, Crypto, createCryptoPayment, confirmPayment } from "./payment/cryptoCheckout";


import { getLinkAccessToken, getAccessToken } from "./payment/paymentTokens";

const addPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { data } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (data) {
      const value: IFundData = JSON.parse(decrypt(data));
      if (typeof value === "object") {
        let finalRes;
        const items = await getRedisItem("customer-" + userData.ref);

        // Guard: If Redis session expired or is missing, return clear error
        if (!items || !items.adm_id) {
          cronLogger.error(`[addPayment] Redis session missing or expired for ref: ${userData.ref}`);
          return res.status(400).json({
            success: false,
            message: "Payment session expired. Please reload the page and try again.",
          });
        }

        if (value.paymentType === paymentTypes.CARD) {
          const { paymentRes, uniqueRef } = await cardPayment(value, userData);
          cronLogger.info(paymentRes);
          if (paymentRes.status !== "successful") {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };
            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem(uniqueRef, {
                ...items,
                hash: data,
                mode: paymentTypes.CARD,
              });
            } else {
              await setRedisItem(uniqueRef, {
                ...items,
                id: paymentRes.data.id,
                mode: paymentTypes.CARD,
              });
            }
          }
        }

        if (value.paymentType === paymentTypes.BANK_TRANSFER) {
          const { paymentRes, uniqueRef } = await bankTransfer(value, userData);
          cronLogger.info(`[addPayment] bankTransfer response, ref: ${uniqueRef}`);
          const { transfer_reference, ...rest } = paymentRes.meta.authorization;
          finalRes = { hash: uniqueRef, ...rest };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.BANK_TRANSFER,
          });
        }

        if (value.paymentType === paymentTypes.USSD) {
          const { paymentRes, uniqueRef } = await USSD(value, userData);
          cronLogger.info(`[addPayment] USSD response, ref: ${uniqueRef}`);
          const ussdResponse = paymentRes as { meta?: { authorization?: { note?: string } }; data?: { payment_code?: string } };
          const { note } = ussdResponse.meta?.authorization || {};
          const { payment_code } = ussdResponse.data || {};
          finalRes = { hash: uniqueRef, note, payment_code };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.USSD,
          });
        }

        if (value.paymentType === paymentTypes.MOBILE_MONEY) {
          const { paymentRes, uniqueRef } = await MobileMoney(value, userData);
          cronLogger.info(`[addPayment] MobileMoney response, ref: ${uniqueRef}`);
          const mobileResponse = paymentRes as { meta?: { authorization?: Record<string, unknown> } };
          if (value.currency === "KES") {
            finalRes = { hash: uniqueRef };
          } else {
            finalRes = { hash: uniqueRef, ...mobileResponse?.meta?.authorization };
          }
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.MOBILE_MONEY,
          });
        }
        if (value.paymentType === paymentTypes.BANK_ACCOUNT) {
          const { paymentRes, uniqueRef } = await bankAccount(value, userData);
          cronLogger.info(`[addPayment] bankAccount response, ref: ${uniqueRef}`);
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.BANK_ACCOUNT,
          });
        }
        if (value.paymentType === paymentTypes.QR_CODE) {
          const { paymentRes, uniqueRef } = await QRCode(value, userData);
          cronLogger.info(`[addPayment] QRCode response, ref: ${uniqueRef}`);
          finalRes = { hash: uniqueRef, ...paymentRes?.meta?.authorization };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.QR_CODE,
          });
        }
        if (value.paymentType === paymentTypes.WALLET) {
          const status = await userWallet(value, userData);

          await setRedisItem("customer-" + userData.ref, {
            ...items,
            mode: paymentTypes.WALLET,
            status: status ? toRedisStatus(PaymentState.PAYOUT_COMPLETE) : toRedisStatus(PaymentState.FAILED),
            paid_amount: value.amount,
            paid_currency: value.currency,
            id: userData.ref,
          });

          finalRes = {
            status: status ? toRedisStatus(PaymentState.PAYOUT_COMPLETE) : toRedisStatus(PaymentState.FAILED),
            txRef: "customer-" + userData.ref,
          };
        }

        if (
          value.paymentType === paymentTypes.GOOGLE_PAY ||
          value.paymentType === paymentTypes.APPLE_PAY
        ) {
          const { paymentRes, uniqueRef } = await googleApplePay(
            value,
            userData
          );
          cronLogger.info(`[addPayment] fiatPayment response, ref: ${uniqueRef}`);
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: value.paymentType,
          });
        }
        if (value.paymentType === paymentTypes.CRYPTO) {
          // Normalize checkout currency aliases to internal wallet types
          // Checkout sends "USDC" but wallets are "USDC-ERC20", "RLUSD-XRPL" but wallets are "RLUSD"
          const cryptoAliasMap: Record<string, string> = {
            'USDC': 'USDC-ERC20',
            'RLUSD-XRPL': 'RLUSD',
          };
          if (cryptoAliasMap[value.currency]) {
            cronLogger.info(`[addPayment] Normalizing currency: ${value.currency} → ${cryptoAliasMap[value.currency]}`);
            value.currency = cryptoAliasMap[value.currency];
          }
          
          // Pass pre-reserved pool address from Direct Pay (if any) so Crypto uses the same address
          if (items.direct_pay_temp_id) {
            value.direct_pay_temp_id = items.direct_pay_temp_id;
          }
          
          const { paymentRes, uniqueRef } = await Crypto(value, {
            ...userData,
            adm_id: items.adm_id,
            customer_id: items.customer_id,
            company_id: items.company_id,  // Pass company_id for proper wallet filtering
          }, true);  // Use crypto-specific webhook for proper verification
          cronLogger.info(`[addPayment] crypto response, ref: ${uniqueRef}`);
          
          // Calculate remaining minutes for crypto invoice (uses centralized config)
          const CRYPTO_INVOICE_MINUTES = PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES;
          finalRes = { 
            hash: uniqueRef, 
            ...paymentRes,
            remaining_minutes: CRYPTO_INVOICE_MINUTES,  // Frontend uses this for invoice countdown timer
          };
          
          // Get fee_payer mode from original payment link data
          const fee_payer = items.fee_payer || 'company';
          const baseAmountRaw = Number(items.base_amount || items.amount || 0);
          const baseCurrency = items.base_currency || 'USD';
          
          // Convert base amount to USD if not already USD (e.g., EUR → USD)
          let baseAmountUSD = baseAmountRaw;
          if (baseCurrency !== 'USD') {
            try {
              const usdConversionResult = await currencyConvert({
                currency: ['USD'],
                sourceCurrency: baseCurrency,
                amount: baseAmountRaw,
                fixedDecimal: true,
              });
              baseAmountUSD = Number(usdConversionResult?.[0]?.amount || baseAmountRaw);
              cronLogger.info(`[addPayment] Converted ${baseAmountRaw} ${baseCurrency} → $${baseAmountUSD.toFixed(2)} USD`);
            } catch (convErr) {
              cronLogger.info(`[addPayment] Currency conversion failed (${baseCurrency}→USD), using raw amount:`, convErr);
            }
          }
          
          // Calculate fees using tier-based structure (2% + fixed + buffer)
          let merchant_amount_crypto = 0;
          let total_fees_crypto = 0;
          const crypto_amount = Number(value.amount);
          
          // Check if tax applies
          let taxAmount = 0;
          let taxAmountCrypto = 0;
          let taxInfo = null;
          
          if (items.apply_tax) {
            // ── Use cached tax info from getData when available ──
            // This prevents inconsistency from IP re-derivation (VPN/proxy changes between getData and addPayment)
            if (items._cached_tax_info && items._cached_tax_amount > 0) {
              taxInfo = items._cached_tax_info;
              taxAmount = Number(items._cached_tax_amount) || 0;
              cronLogger.info(`[addPayment] Using cached tax from getData: rate=${taxInfo.tax_rate}%, amount=${taxAmount}`);
            } else {
              // Fallback: recalculate from IP (only if getData didn't cache tax)
              try {
                const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '';
                const geoLocation = await getCountryFromIP(clientIP, req.headers);
                if (geoLocation && geoLocation.country_code) {
                  taxInfo = await calculateTaxForCheckout(geoLocation.country_code, baseAmountUSD, items.base_currency || 'USD');
                  if (taxInfo) {
                    taxAmount = taxInfo.tax_amount || 0;
                  }
                }
              } catch (e) {
                cronLogger.info('[addPayment] Tax calculation failed:', e);
              }
            }
            
            if (taxAmount > 0) {
              // Calculate tax portion in crypto
              // For customer-pays: crypto_amount includes base + tax + fees
              // For company-pays: crypto_amount includes base + tax only
              const totalWithTax = baseAmountUSD + taxAmount;
              taxAmountCrypto = totalWithTax > 0 ? crypto_amount * (taxAmount / totalWithTax) : 0;
            }
          }
          
          // Calculate fees using tier-based structure
          // Fee = 1.5% transaction fee + fixed fee (tier-based)
          try {
            const { totalDeduction, fixedFee, transactionFee, feeFreeApplied } = await calculateTransactionFees(
              value.currency,
              baseAmountUSD,  // Fee calculation based on USD amount
              Number(items.adm_id) || undefined  // Pass userId for fee-free discount
            );
            
            // Convert fee percentage to crypto
            const feePercentage = totalDeduction / baseAmountUSD;
            
            if (feeFreeApplied) {
              cronLogger.info(`[addPayment] 🎉 Fee-free promotion applied for user ${items.adm_id}`);
            }
            
            if (fee_payer === 'customer') {
              // Customer pays fees - fees are added on top, merchant gets full base + tax
              // crypto_amount already includes fees (customer paid more)
              const baseWithTax = baseAmountUSD + taxAmount;
              const baseCryptoRatio = baseWithTax / (baseWithTax + totalDeduction);
              merchant_amount_crypto = crypto_amount * baseCryptoRatio;
              total_fees_crypto = crypto_amount - merchant_amount_crypto;
            } else {
              // Company pays fees - fees deducted from BASE amount only (not from tax)
              // This matches createCryptoPayment (Direct API) behavior
              if (taxAmount > 0) {
                const totalWithTax = baseAmountUSD + taxAmount;
                const baseCryptoRatio = baseAmountUSD / totalWithTax;
                const baseCrypto = crypto_amount * baseCryptoRatio;
                const taxCrypto = crypto_amount - baseCrypto;
                // Apply fees only to the base crypto portion
                total_fees_crypto = baseCrypto * feePercentage;
                // Merchant gets: base after fees + full tax (tax passes through untouched)
                merchant_amount_crypto = (baseCrypto - total_fees_crypto) + taxCrypto;
              } else {
                total_fees_crypto = crypto_amount * feePercentage;
                merchant_amount_crypto = crypto_amount - total_fees_crypto;
              }
            }
            
            cronLogger.info(`[addPayment] Fee calculation:
              - Base USD: $${baseAmountUSD}
              - Fee breakdown: $${transactionFee.toFixed(2)} (pct) + $${fixedFee.toFixed(2)} (fixed)
              - Total fee: $${totalDeduction.toFixed(2)} (${(feePercentage * 100).toFixed(2)}%)
              - Fee payer: ${fee_payer}`);
          } catch (feeError) {
            cronLogger.error('[addPayment] Fee calculation error, using fallback:', feeError);
            // Fallback to simple 2% if tier calculation fails
            const fallbackFeePercent = parseFloat(envRaw("TRANSACTION_FEE_PERCENT") || '2.0') / 100;
            total_fees_crypto = crypto_amount * fallbackFeePercent;
            merchant_amount_crypto = crypto_amount - total_fees_crypto;
          }
          
          // Clear any existing data for this address before setting new payment data
          const cryptoRedisKey = getCryptoRedisKey(paymentRes.address, paymentRes.destination_tag);
          await deleteRedisItem(cryptoRedisKey);
          
          // FIX: Store crypto invoice expiry timestamp (15 minutes from now)
          // This is separate from payment link expiry - crypto invoice has shorter window
          const cryptoInvoiceExpiresAt = new Date(Date.now() + CRYPTO_INVOICE_MINUTES * 60 * 1000).toISOString();
          
          await setRedisItem(cryptoRedisKey, {
            mode: paymentTypes.CRYPTO,
            amount: crypto_amount,                    // Crypto amount customer should pay
            merchant_amount: merchant_amount_crypto,  // Amount merchant should receive
            total_fees: total_fees_crypto,            // Admin's portion
            fee_payer: fee_payer,                     // Who pays fees
            base_amount_usd: baseAmountUSD,           // Original USD amount
            total_amount_usd: baseAmountUSD + taxAmount, // Total USD with tax
            status: toRedisStatus(PaymentState.PENDING),
            ref: uniqueRef,
            currency: value.currency,
            // FIX: Use payment link's transaction_id for linking, and user_tx_id for user transaction
            payment_id: items.transaction_id,         // Payment link's transaction_id (for updating payment link)
            unique_tx_id: items.transaction_id,       // Payment link's transaction_id
            user_tx_id: paymentRes.transaction_id,    // User transaction ID (for updating tbl_user_transaction)
            walletType: "customer",
            temp_id: paymentRes.temp_id,
            is_merchant_pool: paymentRes.is_merchant_pool ? "true" : "false",
            // XRP/RLUSD: Store destination tag for tag-based chains (needed for incomplete payment UI)
            ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
            // FIX: Store crypto invoice expiry for polling countdown
            crypto_invoice_expires_at: cryptoInvoiceExpiresAt,
            // BUGFIX: Store merchant webhook info directly in crypto-{address}
            // Ensures callMerchantWebhook finds the URL even if customer-{ref} is lost
            webhook_url: items?.webhook_url || null,
            callback_url: items?.callback_url || null,
            webhook_secret: items?.webhook_secret || null,
            company_id: items?.company_id || null,
            link_id: items?.link_id || null,
            // Tax tracking
            ...(taxInfo && {
              tax_enabled: "true",
              tax_amount_usd: taxAmount,
              tax_amount_crypto: taxAmountCrypto,
              tax_rate: taxInfo.tax_rate,
              tax_country_code: taxInfo.country_code,
            }),
          });
          
          cronLogger.info(`[addPayment] Crypto payment created:
            - Currency: ${value.currency}
            - Amount: ${crypto_amount}
            - Fee Payer: ${fee_payer}
            - Merchant Amount: ${merchant_amount_crypto}
            - Fees: ${total_fees_crypto}
            - Tax: ${taxAmount} USD (${taxAmountCrypto} crypto)`);
          
          // FIX: Update merchant pool address expected_amount with correct crypto amount
          // The initial reservation stored the base fiat amount (e.g., 10 USD) instead of crypto amount
          if (paymentRes.temp_id && crypto_amount > 0) {
            try {
              await merchantTempAddressModel.update(
                { expected_amount: crypto_amount },
                { where: { temp_address_id: paymentRes.temp_id } }
              );
              cronLogger.info(`[addPayment] ✅ Updated pool address ${paymentRes.temp_id} expected_amount: ${crypto_amount} ${value.currency}`);
            } catch (poolUpdateErr: any) {
              cronLogger.warn(`[addPayment] Pool address expected_amount update failed (non-critical): ${poolUpdateErr.message}`);
            }
          }
          
          // PHASE 12.1: Store active_crypto_address (including destination_tag) in customer session
          // This is CRITICAL for verifyCryptoPayment to resolve tag-based chains (XRP/RLUSD)
          // Without this, polling can't find the correct crypto-{addr}-tag-{tag} Redis key
          const customerSessionKey = "customer-" + userData.ref;
          const customerSessionData = await getRedisItem(customerSessionKey);
          if (customerSessionData && Object.keys(customerSessionData).length > 0) {
            const updatedSession = {
              ...customerSessionData,
              active_crypto_address: {
                currency: value.currency,
                address: paymentRes.address,
                payment_id: paymentRes.transaction_id,
                created_at: new Date().toISOString(),
                ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
              },
              // Also store destination_tag at top level for direct access
              ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
            };
            await setRedisItem(customerSessionKey, updatedSession);
            cronLogger.info(`[addPayment] Phase 12.1: Stored active_crypto_address in ${customerSessionKey}: ${paymentRes.address}${paymentRes.destination_tag ? `:${paymentRes.destination_tag}` : ''}`);
          }
        }
        successResponseHelper(res, 200, "Payment created successfully", finalRes);
      } else {
        throw { message: "Please enter valid data!" };
      }
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {

      handleControllerError(res, e, apiLogger, { customer_id: userData.customer_id, email: userData.email });
  }
};

const authStep = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { data } = req.body;
    const value: IFundData = JSON.parse(decrypt(data));
    if (typeof value === "object") {
      let finalRes;
      if (value.paymentType === paymentTypes.CARD) {
        const tempData = await getRedisItem("customer-" + userData.ref);

        cronLogger.info(value.uniqueRef);
        if (value.mode === "otp") {
          const flw_ref = tempData?.flw_ref;
          const res = await flw.Charge.validate({
            otp: value.otp,
            flw_ref,
          });

          cronLogger.info(res);
          const transactionId = res.data.id;
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          finalRes = {
            id: data.id,
            flwRef: data.flw_ref,
            status: data.status,
          };
        } else {
          const cardData: IFundData = JSON.parse(decrypt(tempData?.hash));
          const { paymentRes, uniqueRef } = await cardPayment(
            { ...value, ...cardData },
            userData,
            true
          );
          cronLogger.info(paymentRes);
          if (
            paymentRes.status !== "error" &&
            paymentRes.data?.status !== "successful"
          ) {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };

            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem(uniqueRef, {
                flw_ref: paymentRes.data.flw_ref,
                ...tempData,
              });
            } else {
              await setRedisItem(uniqueRef, {
                id: paymentRes.data.id,
                ...tempData,
              });
            }
          } else if (paymentRes.data?.status === "successful") {
            finalRes = {
              flwRef: paymentRes.data.flw_ref,
              txRef: uniqueRef,
            };
          } else {
            finalRes = { ...paymentRes, txRef: uniqueRef };
          }
        }
      }

      successResponseHelper(res, 200, "Payment authenticated successfully", finalRes);
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {
    cronLogger.info(e);
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    let finalRes;
    cronLogger.info(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      const { data }: IVerifyResponse = await flw.Transaction.verify({
        id: transactionId,
      });
      cronLogger.info(data);
      finalRes = {
        txRef: uniqueRef,
      };
      successResponseHelper(res, 200, "Payment verified successfully", finalRes);
    } else {
      errorResponseHelper(res, 500, "Transaction still in progress!");
    }
  } catch (e) {

      handleControllerError(res, e, apiLogger, { customer_id: userData.customer_id, email: userData.email });
  }
};

const cardPayment = async (
  data: IFundData,
  tokenData: IUserType,
  revalidate = false
) => {
  const expiry = data.expiry.split("/");
  const uniqueRef = "customer-" + tokenData.ref;
  cronLogger.info("from card=============>", data);
  const payload = {
    card_number: data.number,
    expiry_month: expiry[0],
    expiry_year: expiry[1],
    cvv: data.cvc,
    currency: data.currency ?? "USD",
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    enckey: envRaw("FLW_ENCRYPTION_KEY"),
    ...(revalidate && {
      authorization: {
        mode: data.mode,
        ...(data.mode === "pin"
          ? { pin: data.pin }
          : {
            city: data.city,
            address: data.address,
            state: data.state,
            country: "IN",
            zipcode: data.zipcode,
          }),
      },
    }),
    redirect_url: (envRaw("CHECKOUT_URL") || '').trim() + "/pay/verify",
  };

  cronLogger.info("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.card(payload);

  return { paymentRes, uniqueRef };
};

const bankTransfer = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  cronLogger.info("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.bank_transfer(payload);

  return { paymentRes, uniqueRef };
};

const bankAccount = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  cronLogger.info("payload==========>", payload);

  let paymentRes: FW_API_Response;

  if (payload.currency === "NGN") {
    paymentRes = await flw.Charge.ng(payload);
  } else {
    try {
      paymentRes = await axios.post(
        "https://api.flutterwave.com/v3/charges?type=account-ach-uk",
        {
          ...payload,
          is_token_io: 1,
        },
        {
          headers: {
            Authorization: "Bearer " + envRaw("FLW_SECRET_KEY"),
          },
        }
      );
    } catch (e) {
      cronLogger.info(e);
    }
  }

  return { paymentRes, uniqueRef };
};

const googleApplePay = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef + "_success_mock",
  };

  cronLogger.info("payload==========>", payload);

  const type =
    data.paymentType === paymentTypes.GOOGLE_PAY ? "googlepay" : "applepay";

  const response = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=" + type,
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + envRaw("FLW_SECRET_KEY"),
      },
    }
  );
  const paymentRes = response.data;

  return { paymentRes, uniqueRef };
};

const USSD = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: "NGN",
    account_bank: data.account_number,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  cronLogger.info("payload==========>", payload);

  const paymentRes = await flw.Charge.ussd(payload);

  return { paymentRes, uniqueRef };
};

const MobileMoney = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    ...((data.currency === "UGX" || data.currency === "GHS") && {
      network: data.network,
    }),
    ...(data.currency === "RWF" && {
      order_id: uniqueRef,
    }),
    email: tokenData.email,
    phone_number: data?.mobile,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    ...(data.currency !== "KES" && {
      redirect_url: (envRaw("CHECKOUT_URL") || '').trim() + "/pay/verify",
    }),
  };

  cronLogger.info("payload==========>", payload);
  let paymentRes;
  if (data.currency === "KES")
    paymentRes = await flw.MobileMoney.mpesa(payload);
  else if (data.currency === "GHS")
    paymentRes = await flw.MobileMoney.ghana(payload);
  else if (data.currency === "UGX")
    paymentRes = await flw.MobileMoney.uganda(payload);
  else if (data.currency === "RWF")
    paymentRes = await flw.MobileMoney.rwanda(payload);

  return { paymentRes, uniqueRef };
};

const QRCode = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: "NGN",
    amount: data.amount,
    email: tokenData.email,
    phone_number: tokenData?.mobile,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    is_nqr: "1",
  };

  cronLogger.info("payload==========>", payload);

  const resData = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=qr",
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + envRaw("FLW_SECRET_KEY"),
      },
    }
  );

  const paymentRes = resData.data;

  return { paymentRes, uniqueRef };
};

const userWallet = async (data: IFundData, tokenData: IUserType) => {
  const id = tokenData.id;
  
  // Handle both UUID id and customer_id cases
  let customer_id: number;
  if (tokenData.customer_id) {
    // If customer_id is available in token, use it directly
    customer_id = typeof tokenData.customer_id === 'string' ? parseInt(tokenData.customer_id, 10) : tokenData.customer_id;
  } else {
    // Otherwise, look up by id (UUID)
    const customer = await customerModel.findOne({ where: { id } });
    if (!customer) {
      throw { message: "Customer not found" };
    }
    customer_id = customer.dataValues.customer_id;
  }
  const walletData = (
    await customerWalletModel.findOne({
      where: { customer_id },
    })
  ).dataValues;

  if (walletData.amount < data.amount) {
    throw { message: "Insufficient Balance!" };
  } else {
    await customerWalletModel.update(
      {
        amount: Number(Number(walletData.amount) - Number(data.amount)).toFixed(
          2
        ),
      },
      {
        where: { customer_id },
      }
    );
    return true;
  }
};

const getCurrencyRates = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { source, amount, currencyList, fixedDecimal = true, fee_payer = 'company', tax_amount = 0 } = req.body;

    cronLogger.info(`[getCurrencyRates] Request params: amount=${amount}, source=${source}, fee_payer=${fee_payer}, tax_amount=${tax_amount}`);

    // Convert source amount to USD if needed (for fee tier calculation)
    let amountUSD = amount;
    if (source && source !== 'USD') {
      try {
        const usdConversion = await currencyConvert({
          sourceCurrency: source,
          currency: ['USD'],
          amount: amount,
          fixedDecimal: true,
        });
        amountUSD = Number(usdConversion[0]?.amount || amount);
        cronLogger.info(`[getCurrencyRates] Converted ${amount} ${source} → ${amountUSD.toFixed(2)} USD for fee calculation`);
      } catch (conversionError) {
        cronLogger.warn(`[getCurrencyRates] USD conversion failed, using original amount:`, conversionError);
      }
    }

    const currencyRateList = await currencyConvert({
      sourceCurrency: source,
      currency: currencyList,
      amount,
      fixedDecimal,
    });
    
    // If customer pays fees, calculate total amounts including all fees
    if (fee_payer === 'customer') {
      cronLogger.info(`[getCurrencyRates] Customer pays fees - calculating enhanced rates with fees`);
      
      // Pre-fetch all blockchain fees in parallel for better performance
      const allBlockchainFees = await getAllBlockchainFees();
      cronLogger.info(`[getCurrencyRates] Pre-fetched blockchain fees for ${Object.keys(allBlockchainFees).length} chains`);
      
      const enhancedRates = await Promise.all(
        currencyRateList.map(async (rate: { currency: string; amount: number; transferRate?: number }) => {
          try {
            // Check if this is a fiat currency (not crypto)
            const fiatCurrencies = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'AUD', 'CAD', 'CHF', 'HKD', 'NZD', 'SGD', 'NGN', 'KES', 'UGX', 'RWF', 'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU', 'ZAR', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF'];
            if (fiatCurrencies.includes(rate.currency.toUpperCase())) {
              // For fiat currencies, use a default crypto (ETH) to calculate fees
              // This gives us the USD equivalent fees to display
              const chain = 'ETH';
              cronLogger.info(`[getCurrencyRates] Processing fiat ${rate.currency} - using ${chain} for fee calculation`);
              
              // Use pre-fetched fees instead of individual API call
              const networkFee = allBlockchainFees[chain] || await getBlockchainNetworkFee(chain);
              // Use USD amount for fee tier calculation
              const feeResult = await calculateTransactionFees(chain, amountUSD);
              
              const fixedFee = Number(feeResult.fixedFee) || 0;
              const transactionFee = Number(feeResult.transactionFee) || 0;
              const networkFeeUSD = Number(networkFee.feeInUSD) || 0;
              
              const totalFeesUSD = fixedFee + transactionFee + networkFeeUSD;
              const taxAmountRaw = Number(tax_amount) || 0;
              // Convert tax from source currency to USD (tax_amount arrives in source currency)
              const sourceToUSDRate = (amount > 0 && Math.abs(amountUSD - amount) > 0.01) ? (amountUSD / amount) : 1;
              const taxAmountUSD = parseFloat((taxAmountRaw * sourceToUSDRate).toFixed(2));
              
              // Round all amounts to 2 decimal places for consistency
              const roundedTotalFeesUSD = parseFloat(totalFeesUSD.toFixed(2));
              // amountUSD is the base amount (frontend sends base only for customer-pays)
              // Add tax (now in USD) + fees to get the grand total
              const roundedTotalAmountUSD = parseFloat((amountUSD + roundedTotalFeesUSD + taxAmountUSD).toFixed(2));
              
              // Get the exchange rate and convert fees/tax to target currency
              const exchangeRate = Number(rate.transferRate) || 1;
              const convertedBaseAmount = Number(rate.amount) || 0;
              const convertedTotalFees = parseFloat((roundedTotalFeesUSD * exchangeRate).toFixed(2));
              const convertedTaxAmount = parseFloat((taxAmountRaw * exchangeRate).toFixed(2)); // tax_amount is already in source, convert to target
              const convertedTotalAmount = parseFloat((roundedTotalAmountUSD * exchangeRate).toFixed(2));
              
              // Convert total back to source currency for total_amount_source
              const usdToSourceRate = amountUSD > 0 ? amount / amountUSD : 1;
              const totalAmountSourceCurrency = parseFloat((roundedTotalAmountUSD * usdToSourceRate).toFixed(2));
              
              cronLogger.info(`[getCurrencyRates] ${rate.currency} (fiat): base=${amount} ${source} ($${amountUSD.toFixed(2)} USD) = ${convertedBaseAmount} ${rate.currency}, tax=${taxAmountRaw} ${source} ($${taxAmountUSD.toFixed(2)} USD) = ${convertedTaxAmount} ${rate.currency}, fees=$${roundedTotalFeesUSD.toFixed(2)} USD = ${convertedTotalFees} ${rate.currency}, total=$${roundedTotalAmountUSD.toFixed(2)} USD (=${totalAmountSourceCurrency.toFixed(2)} ${source}) = ${convertedTotalAmount} ${rate.currency}`);
              
              return {
                ...rate,
                fee_payer: 'customer',
                base_amount: parseFloat(amount.toFixed(2)),       // Original amount in source currency
                base_amount_usd: parseFloat(amountUSD.toFixed(2)), // Converted to USD
                // Include tax in breakdown (converted to target currency)
                tax_amount: convertedTaxAmount,
                tax_amount_usd: taxAmountUSD,
                // Simplified - only show total processing fee (converted to target currency)
                processing_fee: convertedTotalFees,
                processing_fee_usd: roundedTotalFeesUSD,
                total_amount: convertedTotalAmount,
                // IMPORTANT: Checkout reads total_amount_usd first and multiplies by transferRate (1 for same currency)
                // So total_amount_usd MUST be in source currency for correct display
                total_amount_usd: totalAmountSourceCurrency,
                total_amount_source: totalAmountSourceCurrency, // Total in SOURCE currency (e.g., EUR) for display
                // Use the properly converted amount for display
                amount: convertedTotalAmount,
              };
            }
            
            // Map currency to chain name for fee calculation
            let chain = rate.currency.replace('-', '_').toUpperCase();
            
            // Handle special cases where currency name differs from chain name
            const chainMapping: Record<string, string> = {
              'USDT': 'USDT_TRC20',  // Default USDT to TRC20
              'USDC': 'USDC_ERC20',  // Default USDC to ERC20
            };
            chain = chainMapping[chain] || chain;
            
            cronLogger.info(`[getCurrencyRates] Processing ${rate.currency} -> chain: ${chain}`);
            
            const cryptoPrice = Number(rate.amount) > 0 ? amountUSD / Number(rate.amount) : 0;
            
            // Use pre-fetched network fee if available, fallback to individual fetch
            const networkFee = allBlockchainFees[chain] || await getBlockchainNetworkFee(chain);
            // Use USD amount for fee tier calculation
            const feeResult = await calculateTransactionFees(
              chain,
              amountUSD
            );
            
            // Ensure all fee values are valid numbers (protection against NaN/undefined)
            const fixedFee = Number(feeResult.fixedFee) || 0;
            const transactionFee = Number(feeResult.transactionFee) || 0;
            const networkFeeUSD = Number(networkFee.feeInUSD) || 0;
            
            // Calculate totals including tax - round USD amounts to 2 decimals for consistency
            const totalFeesUSD = fixedFee + transactionFee + networkFeeUSD;
            const roundedTotalFeesUSD = parseFloat(totalFeesUSD.toFixed(2));
            const taxAmountRaw = Number(tax_amount) || 0;
            // Convert tax from source currency to USD (tax_amount arrives in source currency)
            const sourceToUSDRate = (amount > 0 && Math.abs(amountUSD - amount) > 0.01) ? (amountUSD / amount) : 1;
            const taxAmountUSD = parseFloat((taxAmountRaw * sourceToUSDRate).toFixed(2));
            // amountUSD is the base amount (frontend sends base only for customer-pays)
            // Add tax (now in USD) + fees to get the grand total
            const totalAmountUSD = amountUSD + roundedTotalFeesUSD + taxAmountUSD;
            const roundedTotalAmountUSD = parseFloat(totalAmountUSD.toFixed(2));
            const totalAmountCrypto = cryptoPrice > 0 ? roundedTotalAmountUSD / cryptoPrice : 0;
            
            // Convert total back to source currency (e.g., EUR) for display
            // Use the ratio: source_amount / usd_amount to convert USD totals back to source currency
            const usdToSourceRate = amountUSD > 0 ? amount / amountUSD : 1;
            const totalAmountSource = parseFloat((roundedTotalAmountUSD * usdToSourceRate).toFixed(2));
            const processingFeeSource = parseFloat((roundedTotalFeesUSD * usdToSourceRate).toFixed(2));
            const taxAmountSource = parseFloat((taxAmountRaw * 1).toFixed(2)); // tax_amount is already in source currency
            
            cronLogger.info(`[getCurrencyRates] ${rate.currency}: base=${amount} ${source} ($${amountUSD.toFixed(2)} USD), tax=${taxAmountRaw} ${source} ($${taxAmountUSD.toFixed(2)} USD), fees=$${roundedTotalFeesUSD.toFixed(2)}, total=$${roundedTotalAmountUSD.toFixed(2)} USD (=${totalAmountSource.toFixed(2)} ${source})`);
            
            return {
              ...rate,
              fee_payer: 'customer',
              base_amount: Number(rate.amount),
              base_amount_usd: parseFloat(amountUSD.toFixed(2)),
              // Include tax in breakdown (in source currency as received)
              tax_amount: taxAmountSource,
              tax_amount_usd: taxAmountUSD,
              // Simplified - only show total processing fee (converted to source currency)
              processing_fee: processingFeeSource,
              processing_fee_usd: roundedTotalFeesUSD,
              total_amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto,
              // IMPORTANT: Checkout reads total_amount_usd first and multiplies by transferRate (1 for same currency)
              // So total_amount_usd MUST be in source currency for correct display
              total_amount_usd: totalAmountSource,
              total_amount_source: totalAmountSource, // Total in SOURCE currency (e.g., EUR) for display
              amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto, // Override amount with total
            };
          } catch (feeError: unknown) {
            cronLogger.error(`[getCurrencyRates] Fee calc error for ${rate.currency}:`, getErrorMessage(feeError));
            return {
              ...rate,
              fee_payer: 'customer',
              fee_error: 'Could not calculate fees',
            };
          }
        })
      );
      
      return successResponseHelper(res, 200, "Exchange rates retrieved successfully", enhancedRates);
    }

    // Default: company pays fees (original behavior)
    successResponseHelper(res, 200, "Exchange rates retrieved successfully", currencyRateList);
  } catch (e) {
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

const getBalance = async (_req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  try {
    const customer = await customerModel.findOne({
      where: {
        id: userData.user_id,
      },
    });

    if (!customer) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    const customerData = await customerWalletModel.findOne({
      where: {
        customer_id: (customer as { dataValues: { customer_id: string } }).dataValues.customer_id,
      },
    });

    if (!customerData) {
      return errorResponseHelper(res, 404, "Customer wallet not found");
    }

    const walletData = (customerData as { dataValues: { amount: number; wallet_type: string } }).dataValues;

    successResponseHelper(res, 200, "Balance retrieved successfully", {
      amount: walletData.amount.toFixed(2),
      currency: walletData.wallet_type,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.user_id, email: userData.email },
      new Error(e instanceof Error ? e.message : String(e))
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const checkingUSDT = async () => {
  const USDT: ITemporaryAddress[] = await sequelize.query(
    `select ut.*,at.amount_to_be_paid from tbl_user_temp_address ut join tbl_admin_fee_transaction at
    on ut.wallet_address=at.wallet_address
    where ut.wallet_type in ('USDT-ERC20','USDT-TRC20') and ut.status='successful'
    and ut.admin_status='pending'
    `,
    {
      type: QueryTypes.SELECT,
    }
  );

  for (let i = 0; i < USDT.length; i++) {
    try {
      const currentAddress = USDT[i];
      const addressBalance = await tatumApi.getAddressBalance(
        currentAddress?.wallet_address,
        currentAddress.wallet_type
      );
      
      // Multi-tenant fix: Include company_id in wallet lookup
      const forwardingWalletWhere: Record<string, unknown> = {
        wallet_type: currentAddress.wallet_type,
        user_id: currentAddress.user_id,
      };
      
      // Add company_id filter if present (cast to any since company_id may be added dynamically)
      const addressCompanyId = (currentAddress as any).company_id;
      if (addressCompanyId && addressCompanyId !== '' && addressCompanyId !== 'undefined' && addressCompanyId !== 'null') {
        const companyId = parseInt(addressCompanyId);
        if (!isNaN(companyId)) {
          forwardingWalletWhere.company_id = companyId;
        }
      } else {
        forwardingWalletWhere.company_id = null;
      }
      
      const userWallet = await (
        await userWalletModel.findOne({
          where: forwardingWalletWhere,
        })
      ).dataValues;
      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        let fees;
        if (currentAddress?.wallet_type === "USDT-ERC20") {
          const data = await getRedisItem(
            "crypto-" + currentAddress?.wallet_address + "-fees_paid"
          );
          if (Object.keys(data).length > 0 && data?.gasPrice) {
            fees = data;
            await deleteRedisItem(
              "crypto-" + currentAddress?.wallet_address + "-fees_paid"
            );
          } else {
            fees = await tatumApi.feeEstimation(
              currentAddress?.wallet_type,
              currentAddress?.wallet_address,
              userWallet?.wallet_address,
              currentAddress?.amount_to_be_paid,
              envRaw("ETH_CONTRACT")
            );
          }
        }

        const privateKey = await tatumApi.decryptSymmetric(
          currentAddress.privateKey,
          envRaw("TEMP_KEY_ID")
        );
        const transactionDetails = await tatumApi.assetToOtherAddress({
          amount: currentAddress?.amount_to_be_paid,
          currency: currentAddress?.wallet_type,
          fee: fees,
          fromAddress: currentAddress?.wallet_address,
          privateKey: privateKey,
          toAddress: userWallet?.wallet_address,
        });
        await userTempAddressModel.update(
          {
            adminTxId: transactionDetails?.txId,
            admin_status: "successful",
          },
          {
            where: {
              temp_id: currentAddress?.temp_id,
            },
          }
        );
      }
    } catch (e) {

        const message = getErrorMessage(e);

        cronLogger.error(message, new Error(e));
    }
  }
};

/**
 * Sweep native ETH/TRX admin fees from temp addresses to admin wallet
 * This handles the pending_sweep status for account-based chains
 * Schedule: Every 45 minutes
 */
const sweepNativeAdminFees = async () => {
  try {
    // Find all temp addresses with pending native ETH/TRX admin fees
    const pendingAddresses: ITemporaryAddress[] = await sequelize.query(
      `SELECT ut.* FROM tbl_user_temp_address ut
       WHERE ut.wallet_type IN ('ETH', 'TRX')
       AND ut.status = 'successful'
       AND ut.admin_status = 'pending_sweep'
       AND ut.amount > 0
       AND ut."createdAt" >= NOW() - INTERVAL '${PAYMENT_TIMING.SQL_INTERVALS.MONTHLY_TRANSACTIONS}'`,
      {
        type: QueryTypes.SELECT,
      }
    );

    // Quiet mode: only log when there are addresses to sweep
    if (pendingAddresses.length === 0) return;
    cronLogger.info(`[sweepNativeAdminFees] Found ${pendingAddresses.length} addresses with pending admin fees`);

    for (let i = 0; i < pendingAddresses.length; i++) {
      try {
        const currentAddress = pendingAddresses[i];
        const wallet_type = currentAddress.wallet_type; // ETH or TRX
        
        cronLogger.info(`[sweepNativeAdminFees] Processing ${wallet_type} address: ${currentAddress.wallet_address}`);

        // Get current balance of temp address
        const addressBalance = await tatumApi.getAddressBalance(
          currentAddress.wallet_address,
          wallet_type
        );

        // Get admin fee wallet from .env (NOT from tbl_admin_fee_wallet which is for gas funding)
        // tbl_admin_fee_wallet is used for funding gas to temp addresses for ERC20/TRC20 transfers
        // .env wallets (ETH, TRX, etc.) are the destination for collected admin fees
        const adminWalletAddress = getAdminWalletAddress(wallet_type);

        if (!adminWalletAddress) {
          cronLogger.error(`[sweepNativeAdminFees] Admin fee wallet not configured in .env for ${wallet_type}`);
          continue;
        }
        
        cronLogger.info(`[sweepNativeAdminFees] Will sweep to admin wallet: ${adminWalletAddress}`);
        let balance = Number(addressBalance?.balance ?? 0);
        
        // NOTE: getAddressBalance() already converts SUN→TRX for TRX currency.
        // Do NOT divide by 1,000,000 again — double-division caused incorrect sweep amounts.

        cronLogger.info(`[sweepNativeAdminFees] Address balance: ${balance} ${wallet_type}`);

        if (balance > 0) {
          let fees, sendAmount;

          if (wallet_type === "ETH") {
            // Estimate gas fee for ETH transfer
            fees = await tatumApi.feeEstimation(
              wallet_type,
              currentAddress.wallet_address,
              adminWalletAddress,
              balance
            );
            // Deduct gas fee from send amount
            sendAmount = Number((balance - Number(fees?.slow ?? 0)).toFixed(8));
          } else {
            // TRX - bandwidth fee is minimal, send most of the balance
            fees = null;
            // Leave small amount for bandwidth (0.1 TRX should be enough)
            sendAmount = Number((balance - 0.1).toFixed(6));
          }

          if (sendAmount > 0) {
            cronLogger.info(`[sweepNativeAdminFees] Sweeping ${sendAmount} ${wallet_type} to admin wallet`);

            // Decrypt private key
            const privateKey = await tatumApi.decryptSymmetric(
              currentAddress.privateKey,
              envRaw("TEMP_KEY_ID")
            );

            // Transfer to admin fee wallet
            const transactionDetails = await tatumApi.assetToOtherAddress({
              amount: sendAmount,
              currency: wallet_type,
              fee: fees,
              fromAddress: currentAddress.wallet_address,
              privateKey: privateKey,
              toAddress: adminWalletAddress,
            });

            // Convert to USD for logging
            const finalAmount = await currencyConvert({
              sourceCurrency: wallet_type,
              currency: ["USD"],
              amount: sendAmount,
              fixedDecimal: false,
            });
            const usd = Number(Number(finalAmount[0].amount).toFixed(2));

            // Record the admin fee transaction
            await adminFeeTransactionModel.create({
              wallet_address: currentAddress.wallet_address,
              amount: sendAmount,
              amount_in_usd: usd,
              wallet_type,
              transaction_id: transactionDetails?.txId,
              status: "successful",
              blockchain_fee: fees?.slow ?? 0,
              transaction_type: "CREDIT",
              amount_to_be_paid: 0,
            });

            // Update temp address status
            await userTempAddressModel.update(
              {
                adminTxId: (currentAddress as { adminTxId?: string }).adminTxId 
                  ? (currentAddress as any).adminTxId + "," + transactionDetails?.txId 
                  : transactionDetails?.txId,
                admin_status: "successful",
              },
              {
                where: {
                  temp_id: currentAddress.temp_id,
                },
              }
            );

            // Increment admin wallet fee balance (for tracking)
            await incrementAdminFee(wallet_type, sendAmount);

            cronLogger.info(`[sweepNativeAdminFees] Successfully swept ${sendAmount} ${wallet_type} ($${usd} USD) - TX: ${transactionDetails?.txId}`);
          } else {
            cronLogger.info(`[sweepNativeAdminFees] Balance too low after gas fees: ${balance} ${wallet_type}`);
          }
        } else {
          // No balance but marked as pending_sweep - might have been swept manually or balance moved
          cronLogger.info(`[sweepNativeAdminFees] No balance found, marking as successful: ${currentAddress.wallet_address}`);
          await userTempAddressModel.update(
            {
              admin_status: "successful",
            },
            {
              where: {
                temp_id: currentAddress.temp_id,
              },
            }
          );
        }
      } catch (e) {
        cronLogger.error(`[sweepNativeAdminFees] Error processing address:`, e);
        const message = getErrorMessage(e);
        cronLogger.error(`[sweepNativeAdminFees] ${message}`, new Error(e));
      }
    }

    cronLogger.info("[sweepNativeAdminFees] Completed native ETH/TRX admin fee sweep");
  } catch (e) {
    cronLogger.error("[sweepNativeAdminFees] Fatal error:", e);
    const message = getErrorMessage(e);
    cronLogger.error(`[sweepNativeAdminFees] ${message}`, new Error(e));
  }
};

const checkFeeBalance = async () => {
  try {
    const adminFeesWallets = await adminFeeModel.findAll({
      attributes: { exclude: ["privateKey", "mnemonic", "xpub"] },
    });

    let textData = "";

    for (let i = 0; i < adminFeesWallets.length; i++) {
      const { feeLimit, wallet_type } = adminFeesWallets[i].dataValues;
      
      // Skip non-gas wallets (XRP_MASTER is for receiving payments, not gas funding)
      if (wallet_type === "XRP_MASTER" || feeLimit === 0) {
        continue;
      }
      
      // Map wallet_type to the correct currency for balance checking
      // XRP gas wallet checks XRP balance, POLYGON gas wallet checks POLYGON balance
      const balanceCheckCurrency = wallet_type;
      
      let currentBalance;
      try {
        // Use skipCache=true for fee balance monitoring — must be real-time to avoid false alerts
        currentBalance = await tatumApi.getAddressBalance(
          adminFeesWallets[i]?.dataValues.wallet_address,
          balanceCheckCurrency,
          true
        );
      } catch (balErr: unknown) {
        const balError = balErr as { message?: string; body?: { errorCode?: string } };
        const errMsg = balError?.message || '';
        const errCode = balError?.body?.errorCode || '';
        // XRP/RLUSD accounts that haven't been activated yet (need 10 XRP reserve)
        // return 403 "Account not found" — skip gracefully instead of crashing
        if (errMsg.includes('account.not.found') || errMsg.includes('Account not found') ||
            errCode.includes('account.failed') || errMsg.includes('not.found')) {
          cronLogger.info(`[checkFeeBalance] ⏭️ Skipping ${wallet_type} — account not activated yet (${adminFeesWallets[i]?.dataValues.wallet_address?.substring(0, 12)}...)`);
          continue;
        }
        // FIX (2026-07-11): Transient Tatum failures (rate-limit, invalidResponse, timeouts)
        // MUST NOT abort the whole loop and MUST NOT fabricate a false "empty" alert.
        // Skip THIS wallet only, keep checking the others; next cron cycle will retry.
        cronLogger.warn(`[checkFeeBalance] ⚠️ Tatum call failed for ${wallet_type} (${adminFeesWallets[i]?.dataValues.wallet_address?.substring(0, 12)}...): ${errMsg || 'unknown'} — skipping this wallet, will retry next cycle`);
        continue;
      }
      let amount = adminFeesWallets[i]?.dataValues.amount;
      // NOTE: getAddressBalance() already converts SUN→TRX for TRX currency.
      // Do NOT divide by 1,000,000 again — double-division caused false $0 alerts.
      // FIX (2026-07-11): Tatum returns balance as a STRING (e.g. "94.281905"). Coerce
      // to Number immediately so downstream comparisons (=== 0, !==) work correctly.
      // Without this: (a) `amount === 0` fails for `"0"` → truly-empty wallets slip past
      // the "skip unused wallets" guard and get alerted; (b) `newBalance !== dbAmount`
      // (string vs number) is always true → DB write every cron cycle.
      const rawNewBalance = currentBalance?.balance;
      const newBalance: number | undefined = (rawNewBalance === undefined || rawNewBalance === null)
        ? undefined
        : Number(rawNewBalance);
      const dbAmount = Number(adminFeesWallets[i]?.dataValues.amount || 0);
      
      // Quiet mode: only log when balance changes, not every check cycle
      if (newBalance !== undefined && Number.isFinite(newBalance) && Math.abs(newBalance - dbAmount) > 0.000001) {
        cronLogger.info(`[checkFeeBalance] ${wallet_type}: balance changed ${dbAmount} → ${newBalance}`);
      }
      
      // Only update if newBalance is a valid finite number AND meaningfully changed
      if (newBalance !== undefined && Number.isFinite(newBalance)) {
        if (Math.abs(newBalance - dbAmount) > 0.000001) {
          amount = newBalance;
          await adminFeeModel.update(
            { amount },
            {
              where: {
                fee_wallet_id: adminFeesWallets[i]?.dataValues.fee_wallet_id,
              },
            }
          );
        } else {
          amount = dbAmount; // no meaningful change, keep numeric type
        }
      }

      // Coerce amount to a numeric value for the zero/skip check below. This
      // prevents a Tatum-returned "0" (string) from slipping past the guard.
      const amountNum = Number(amount);
      // Skip currency conversion if amount is null, undefined, 0, or NaN
      if (amount === null || amount === undefined || amountNum === 0 || !Number.isFinite(amountNum)) {
        // Don't alert for zero-balance wallets — they're likely unused/not yet funded
        // Only alert for wallets that HAD balance but dropped below the limit
        cronLogger.debug(`[checkFeeBalance] ${wallet_type}: zero/null balance — skipping (not actively depleted)`);
        continue;
      }

      // Wrap currencyConvert in try-catch so one Tatum API failure (e.g., ETH→BRL)
      // doesn't crash the entire loop via AggregateError — other wallets still get checked
      let amount_in_usd: number;
      try {
        const tempData = await currencyConvert({
          currency: ["USD"],
          sourceCurrency: wallet_type,
          amount,
          fixedDecimal: true,
        });
        amount_in_usd = tempData[0].amount;
      } catch (convErr: unknown) {
        const convError = convErr as { message?: string };
        cronLogger.warn(`[checkFeeBalance] ⚠️ Currency conversion failed for ${wallet_type}: ${convError?.message || 'unknown'} — skipping this wallet`);
        continue;
      }
      if (amount_in_usd < feeLimit) {
        textData += `\n⚠️ ${wallet_type} fee wallet: $${amount_in_usd} (threshold: $${feeLimit}) — balance: ${amount} ${wallet_type}`;
      }
    }

    if (textData.length > 0) {
      let flag = true;
      const sentData = await getRedisItem("admin_fee_alert");
      if (sentData) {
        const { expiresAt } = sentData;
        if (new Date().getTime() < Number(expiresAt)) {
          flag = false;
        }
      }
      if (flag) {
        // Try to get admin email from database or centralized config
        let adminEmail = ADMIN_CONFIG.EMAIL;
        
        try {
          const adminData = await sequelize.query<IAdminData>(
            "select email from tbl_admin limit 1",
            {
              type: QueryTypes.SELECT,
            }
          );
          if (adminData && adminData.length > 0 && adminData[0].email) {
            adminEmail = adminData[0].email;
          }
        } catch (dbError) {
          cronLogger.info("[Cron] Could not fetch admin from database, using config email");
        }
        
        if (!adminEmail) {
          cronLogger.error("[Cron] No admin email configured - skipping notification");
          return;
        }
        
        textData += `\n\n Please recharge as soon as possible.`;
        
        cronLogger.info(`Sending low fee balance alert to: ${adminEmail}`);
        
        await sendEmail(
          adminEmail,
          "Dynopay Admin",
          "⚠️ Low Fee Wallet Balance Alert",
          `The following fee wallets are below their configured thresholds:\n${textData}\n\nPlease recharge the specific wallet(s) listed above.`
        );
        
        const alert_duration = adminFeesWallets[0]?.dataValues?.alert_duration || 48; // Default 48 hours to reduce alert fatigue
        await setRedisItem("admin_fee_alert", {
          status: "sent",
          expiresAt:
            new Date().getTime() + Number(alert_duration) * 60 * 60 * 1000,
        });
        
        cronLogger.info(`Fee balance alert sent successfully to ${adminEmail}`);
      } else {
        // Quiet mode: Only log once per hour instead of every cron tick (every 15 min)
        // This reduces log noise while still confirming the system is aware of the low balance
        const sentData2 = await getRedisItem("admin_fee_alert");
        if (sentData2) {
          const { expiresAt, lastSkipLog } = sentData2 as Record<string, unknown>;
          const now = Date.now();
          const lastLogTime = Number(lastSkipLog || 0);
          // Log "skipping" message at most once per hour
          if (now - lastLogTime > 60 * 60 * 1000) {
            cronLogger.info(`[checkFeeBalance] Low-balance alert suppressed (already sent, expires in ${Math.round((Number(expiresAt) - now) / 3600000)}h). Wallets with issues:${textData.replace(/\n/g, ' | ')}`);
            await setRedisItem("admin_fee_alert", { ...sentData2, lastSkipLog: now });
          }
        }
      }
    }
  } catch (e) {
      const message = getErrorMessage(e);
      cronLogger.error(`[checkFeeBalance] ${message}`, { stack: (e as Error)?.stack || 'no stack' });
  }
};

const checkOnBlockchair = async () => {
  try {
    // Check for pending payments older than crypto invoice window
    // Using SQL_INTERVALS constant for safety
    const tempData = await sequelize.query<ITemporaryAddress>(
      `select * from tbl_user_temp_address 
      where "createdAt"::date = CURRENT_DATE - INTERVAL '1 day' 
      and "createdAt" <= NOW() - INTERVAL '${PAYMENT_TIMING.SQL_INTERVALS.CRYPTO_INVOICE}' 
      and status='pending' and check_count=0`,
      { type: QueryTypes.SELECT }
    );
    if (tempData.length > 0) {
      for (let i = 0; i < tempData.length; i++) {
        await blockchairApi.getAddressStatus(
          tempData[i].wallet_address,
          tempData[i].wallet_type
        );

        // NOTE: Legacy tbl_user_temp_address doesn't have destination_tag.
        // Tag-based chains (XRP/RLUSD) should use merchant pool flow instead.
        await getRedisItem(
          getCryptoRedisKey(tempData[i].wallet_address)
        );

        await userTempAddressModel.update(
          {
            check_count: 1,
          },
          {
            where: {
              temp_id: tempData[i].temp_id,
            },
          }
        );
      }
    } else {
      cronLogger.info("No pending transactions!");
    }
  } catch (e) {

      const message = getErrorMessage(e);

      cronLogger.error(message, new Error(e));
  }
};

const removeUnwantedSubscriptions = async () => {
  try {
    const tempData = await sequelize.query<ITemporaryAddress>(
      `select subscription_id,temp_id from tbl_user_temp_address where "txId" is null 
    and "updatedAt" < NOW() - INTERVAL '1 day' and subscription_id is not null`,
      { type: QueryTypes.SELECT }
    );

    for (let i = 0; i < tempData.length; i++) {
      await safeDeleteSubscription(tempData[i]?.subscription_id, 'removeUnwantedSubscriptions');
      await userTempAddressModel.update(
        {
          subscription_id: null,
        },
        {
          where: {
            temp_id: tempData[i].temp_id,
          },
        }
      );
    }
  } catch (e) {

      const message = getErrorMessage(e);

      cronLogger.error(message, new Error(e));
  }
};

const processIncompletePayments = async () => {
  try {
    // Query all partial payments older than 5 minutes (minimum reasonable grace period)
    // Then check per-company grace_period_minutes (max 30) in the loop
    const pendingTransactions = await sequelize.query<ITemporaryAddress>(
      `SELECT * FROM tbl_user_temp_address 
       WHERE status = 'partial' 
       AND "txId" IS NOT NULL
       AND COALESCE(partial_payment_timestamp, "updatedAt") < NOW() - INTERVAL '5 minutes'`,
      { type: QueryTypes.SELECT }
    );

    if (pendingTransactions.length > 0) {
      cronLogger.info(`[processIncompletePayments] Found ${pendingTransactions.length} partial payments older than 5 min — checking per-company grace periods...`);

      for (const tempTx of pendingTransactions) {
        try {
          // Fetch merchant's grace period from company settings (max 30 minutes)
          let companyGracePeriodMinutes = 30; // Default and max
          if (tempTx.company_id) {
            try {
              const companyRecord = await companyModel.findOne({
                where: { company_id: tempTx.company_id },
                attributes: ['grace_period_minutes'],
              });
              if (companyRecord?.dataValues?.grace_period_minutes !== undefined &&
                  companyRecord?.dataValues?.grace_period_minutes !== null) {
                companyGracePeriodMinutes = Math.min(parseInt(String(companyRecord.dataValues.grace_period_minutes)), 30);
              }
            } catch (e) {
              cronLogger.info(`[processIncompletePayments] Could not fetch company ${tempTx.company_id} grace period, using default 30 min`);
            }
          }

          // Check if this payment's grace period has actually expired
          const partialTimestamp = new Date(tempTx.partial_payment_timestamp || tempTx.updatedAt);
          const minutesSincePartial = (Date.now() - partialTimestamp.getTime()) / 60000;
          if (minutesSincePartial < companyGracePeriodMinutes) {
            // Still within this merchant's grace period — skip
            continue;
          }

          cronLogger.info(`[processIncompletePayments] Company ${tempTx.company_id} grace: ${companyGracePeriodMinutes} min, elapsed: ${minutesSincePartial.toFixed(1)} min — processing...`);
          const balanceData = await tatumApi.getAddressBalance(
            tempTx.wallet_address,
            tempTx.wallet_type
          );

          const actualBalance = Number(balanceData?.balance || 0);

          if (actualBalance > 0) {
            cronLogger.info(`Additional balance found: ${actualBalance} ${tempTx.wallet_type}. Processing final sweep...`);

            // Get merchant wallet with multi-tenant security
            const merchantWallet = await userWalletModel.findOne({
              where: {
                user_id: tempTx.user_id,
                wallet_type: tempTx.wallet_type,
                company_id: tempTx.company_id,  // Multi-tenant: Ensure correct company wallet
              },
            });

            if (!merchantWallet) {
              cronLogger.error(`Merchant wallet not found for user ${tempTx.user_id}, company ${tempTx.company_id}, wallet_type ${tempTx.wallet_type}`);
              throw new Error(`Merchant wallet not found for user ${tempTx.user_id}`);
            }

            const totalReceived = Number(tempTx.amount || 0) + Number(actualBalance);

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount || 0;

            let adminAmountToSend, userAmountToSend;

            if (fee_payer === 'customer' && merchant_amount > 0) {
              // CUSTOMER PAYS FEES MODE
              userAmountToSend = Number(merchant_amount);
              adminAmountToSend = Number(totalReceived) - Number(merchant_amount);
              
              if (adminAmountToSend < 0) {
                adminAmountToSend = 0;
                userAmountToSend = Number(totalReceived);
              }
              cronLogger.info(`[processIncompletePayments] Customer pays fees: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            } else {
              // COMPANY PAYS FEES MODE (default)
              const { totalDeduction, minForwarding } = await calculateTransactionFees(
                tempTx.wallet_type,
                totalReceived
              );

              if (Number(totalReceived) < Number(minForwarding)) {
                adminAmountToSend = Number(totalReceived);
                userAmountToSend = 0;
                cronLogger.info(`Total amount ${totalReceived} below threshold ${minForwarding}. Sending all to admin.`);
              } else {
                adminAmountToSend = Number(totalDeduction);
                userAmountToSend = Number(totalReceived) - Number(totalDeduction);
                cronLogger.info(`Splitting final amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
              }
            }

            const result = await settleCryptoTransaction({
              tempAddressData: {
                address: tempTx.wallet_address,
                wallet_address: tempTx.wallet_address,
                privateKey: tempTx.privateKey,
                wallet_type: tempTx.wallet_type,
              },
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId || '',
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
              merchantDestinationTag: merchantWallet.dataValues.destination_tag || null,
            });

            await incrementAdminFee(tempTx.wallet_type, adminAmountToSend);

            // Send admin fee notification email for partial payment processing
            try {
              const adminEmail = envRaw("ADMIN_EMAIL");
              if (adminEmail && adminAmountToSend > 1e-8) {
                const companyData = await companyModel.findOne({
                  where: { company_id: tempTx.company_id },
                });
                
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend).toFixed(8),
                  tempTx.wallet_type,
                  tempTx.txId,
                  companyData?.dataValues?.company_name || "Unknown Company",
                  Number(userAmountToSend).toFixed(8),
                  Number(totalReceived).toFixed(8)
                );
                
                cronLogger.info(`[Admin Fee Notification - Partial Payment] Sent email for ${adminAmountToSend} ${tempTx.wallet_type} from Company ${tempTx.company_id || 'N/A'}`);
              }
            } catch (emailError) {
              cronLogger.error("[Admin Fee Notification - Partial Payment] Email failed:", emailError);
            }

            await userTempAddressModel.update(
              {
                status: "completed_partial",
                admin_status: "successful",
                amount: totalReceived,
                adminTxId: result.transactionDetails?.txId,
                blockchain_fee: result.blockchainFee,
              },
              {
                where: { temp_id: tempTx.temp_id },
              }
            );

            if (userAmountToSend > 0) {
              await incrementUserWallet(merchantWallet.dataValues.wallet_id, Number(userAmountToSend));

              await userTransactionModel.create({
                wallet_id: merchantWallet.dataValues.wallet_id,
                user_id: tempTx.user_id,
                company_id: tempTx.company_id || null,  // Multi-tenant: Include company_id
                payment_mode: "CRYPTO",
                base_amount: Number(userAmountToSend).toFixed(8),
                base_currency: tempTx.wallet_type,
                transaction_reference: tempTx.txId,
                transaction_type: "CREDIT",
                status: "completed_partial",
              });
            }

            await safeDeleteSubscription(tempTx.subscription_id, 'partial payment completed');

            // Send partial payment completed notification
            await sendPartialPaymentExpiredNotification(
              tempTx.wallet_address,
              tempTx.txId,
              totalReceived,
              Number(tempTx.expected_amount || tempTx.amount),
              tempTx.wallet_type,
              tempTx.user_id,
              tempTx.company_id,
              "completed_partial"
            );

            cronLogger.info(`Incomplete payment processed successfully for ${tempTx.wallet_address}`);
          } else {
            cronLogger.info(`No additional payment for ${tempTx.wallet_address}. Processing with existing amount ${tempTx.amount}`);

            // Get merchant wallet with multi-tenant security
            const merchantWallet = await userWalletModel.findOne({
              where: {
                user_id: tempTx.user_id,
                wallet_type: tempTx.wallet_type,
                company_id: tempTx.company_id,  // Multi-tenant: Ensure correct company wallet
              },
            });

            if (!merchantWallet) {
              cronLogger.error(`Merchant wallet not found for user ${tempTx.user_id}, company ${tempTx.company_id}, wallet_type ${tempTx.wallet_type}`);
              throw new Error(`Merchant wallet not found for user ${tempTx.user_id}`);
            }

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount;

            let adminAmountToSend, userAmountToSend;

            if (fee_payer === 'customer' && merchant_amount > 0) {
              // CUSTOMER PAYS FEES MODE - but partial payment, so prorate
              // Customer only paid partial, so merchant gets proportional amount
              const expectedTotal = Number(tempTx.amount) + (Number(tempTx.amount) - Number(merchant_amount));
              const paidRatio = Number(tempTx.amount) / expectedTotal;
              userAmountToSend = Number(merchant_amount) * paidRatio;
              adminAmountToSend = Number(tempTx.amount) - userAmountToSend;
              
              if (adminAmountToSend < 0) {
                adminAmountToSend = 0;
                userAmountToSend = Number(tempTx.amount);
              }
              cronLogger.info(`[processIncompletePayments] Customer pays fees (incomplete): Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            } else {
              // COMPANY PAYS FEES MODE (default)
              const { totalDeduction, minForwarding } = await calculateTransactionFees(
                tempTx.wallet_type,
                Number(tempTx.amount)
              );

              if (Number(tempTx.amount) < Number(minForwarding)) {
                adminAmountToSend = Number(tempTx.amount);
                userAmountToSend = 0;
                cronLogger.info(`Amount ${tempTx.amount} below threshold. Sending all to admin.`);
              } else {
                adminAmountToSend = Number(totalDeduction);
                userAmountToSend = Number(tempTx.amount) - Number(totalDeduction);
                cronLogger.info(`Splitting partial amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
              }
            }

            const result = await settleCryptoTransaction({
              tempAddressData: {
                address: tempTx.wallet_address,
                wallet_address: tempTx.wallet_address,
                privateKey: tempTx.privateKey,
                wallet_type: tempTx.wallet_type,
              },
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId || '',
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
              merchantDestinationTag: merchantWallet.dataValues.destination_tag || null,
            });

            await incrementAdminFee(tempTx.wallet_type, adminAmountToSend);

            // Send admin fee notification email for expired incomplete payment
            try {
              const adminEmail = envRaw("ADMIN_EMAIL");
              if (adminEmail && adminAmountToSend > 1e-8) {
                const companyData = await companyModel.findOne({
                  where: { company_id: tempTx.company_id },
                });
                
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend).toFixed(8),
                  tempTx.wallet_type,
                  tempTx.txId,
                  companyData?.dataValues?.company_name || "Unknown Company",
                  Number(userAmountToSend).toFixed(8),
                  Number(tempTx.amount).toFixed(8)
                );
                
                cronLogger.info(`[Admin Fee Notification - Expired Payment] Sent email for ${adminAmountToSend} ${tempTx.wallet_type} from Company ${tempTx.company_id || 'N/A'}`);
              }
            } catch (emailError) {
              cronLogger.error("[Admin Fee Notification - Expired Payment] Email failed:", emailError);
            }

            await userTempAddressModel.update(
              {
                status: "incomplete_expired",
                admin_status: "successful",
                adminTxId: result.transactionDetails?.txId,
                blockchain_fee: result.blockchainFee,
              },
              {
                where: { temp_id: tempTx.temp_id },
              }
            );

            if (userAmountToSend > 0) {
              await incrementUserWallet(merchantWallet.dataValues.wallet_id, Number(userAmountToSend));

              await userTransactionModel.create({
                wallet_id: merchantWallet.dataValues.wallet_id,
                user_id: tempTx.user_id,
                company_id: tempTx.company_id || null,  // Multi-tenant: Include company_id
                payment_mode: "CRYPTO",
                base_amount: Number(userAmountToSend).toFixed(8),
                base_currency: tempTx.wallet_type,
                transaction_reference: tempTx.txId,
                transaction_type: "CREDIT",
                status: "incomplete_expired",
              });
            }

            await safeDeleteSubscription(tempTx.subscription_id, 'partial payment expired');

            // Send partial payment expired notification
            await sendPartialPaymentExpiredNotification(
              tempTx.wallet_address,
              tempTx.txId,
              Number(tempTx.amount),
              Number(tempTx.expected_amount || tempTx.amount * 2), // Use expected if available
              tempTx.wallet_type,
              tempTx.user_id,
              tempTx.company_id,
              "incomplete_expired"
            );

            cronLogger.info(`Partial payment processed after timeout for ${tempTx.wallet_address}`);
          }
        } catch (innerError) {
          cronLogger.error(`Failed to process incomplete payment ${tempTx.wallet_address}:`, innerError.message);
          cronLogger.error(
            `Incomplete payment processing error for ${tempTx.wallet_address}`,
            new Error(innerError)
          );
        }
      }
    } else {
      // Quiet mode: suppress "no incomplete payments" log (runs every 30 min, almost always empty)
    }
    
    // ============================================
    // MERCHANT POOL: Also check for incomplete/underpaid pool addresses
    // This covers payment link underpayments that used merchant pool addresses
    // where the Redis key expired before the payment was processed
    // ============================================
    try {
      const poolAddresses = await merchantTempAddressModel.findAll({
        where: {
          status: 'IN_USE',
          current_payment_id: { [Op.ne]: null },
          expected_amount: { [Op.gt]: 0 },
        }
      });
      
      if (poolAddresses.length > 0) {
        cronLogger.info(`[processIncompletePayments] Found ${poolAddresses.length} merchant pool addresses IN_USE, checking for expired grace period...`);
        
        for (const poolAddr of poolAddresses) {
          try {
            const walletAddress = poolAddr.dataValues.wallet_address;
            const walletType = poolAddr.dataValues.wallet_type;
            const expectedAmount = parseFloat(poolAddr.dataValues.expected_amount || '0');
            const paymentId = poolAddr.dataValues.current_payment_id;
            // FIX: Use reserved_until (the actual column) instead of non-existent reserved_at.
            // reserved_until = reservation time + timeout. We derive "time since reserved" from it.
            const reservedUntil = poolAddr.dataValues.reserved_until
              ? new Date(poolAddr.dataValues.reserved_until)
              : null;
            const updatedAt = poolAddr.dataValues.updatedAt
              ? new Date(poolAddr.dataValues.updatedAt)
              : null;

            let minutesSinceReserved: number;
            if (reservedUntil && !isNaN(reservedUntil.getTime())) {
              // reserved_until is set: minutes past expiry = how long after it should have expired
              // If the address is still IN_USE, reserved_until has already passed.
              const minutesPastExpiry = (Date.now() - reservedUntil.getTime()) / 60000;
              // Reservation timeout is typically 30-45 min, so total time = timeout + minutesPastExpiry
              minutesSinceReserved = minutesPastExpiry + 30; // conservative estimate of reservation age
            } else if (updatedAt && !isNaN(updatedAt.getTime())) {
              minutesSinceReserved = (Date.now() - updatedAt.getTime()) / 60000;
            } else {
              // BUG-6 DEFINITIVE FIX: Auto-release pool addresses stuck with no valid timestamps.
              // These addresses are permanently stuck — just skipping them means they stay stuck forever.
              cronLogger.warn(`[processIncompletePayments] BUG-6 FIX: Pool address ${walletAddress} has no valid reserved_until or updatedAt — auto-releasing`);
              
              await merchantTempAddressModel.update(
                { 
                  status: 'AVAILABLE', 
                  current_payment_id: null, 
                  expected_amount: null, 
                  reserved_until: null, 
                  current_company_id: null,
                  // NOTE: Preserve admin_fee_balance — these are accumulated fees from prior
                  // settlements and must NOT be wiped. Only sweep should reset this to 0.
                },
                { where: { wallet_address: walletAddress } }
              );
              cronLogger.info(`[processIncompletePayments] ✅ BUG-6 FIX: Released stuck address ${walletAddress} — now AVAILABLE`);
              continue;
            }

            // Guard against NaN from invalid date math
            if (isNaN(minutesSinceReserved)) {
              cronLogger.warn(`[processIncompletePayments] Pool address ${walletAddress} has NaN reservation age — skipping`);
              continue;
            }
            
            // Only process if reserved for more than 60 minutes (grace period expired)
            if (minutesSinceReserved < 60) {
              continue; // Still within grace period
            }
            
            cronLogger.info(`[processIncompletePayments] Pool address ${walletAddress} reserved ${minutesSinceReserved.toFixed(1)} min ago — checking balance...`);
            
            // Check if already processed
            const existingTx = await customerTransactionModel.findOne({
              where: {
                [Op.or]: [
                  { transaction_reference: paymentId },
                  { transaction_reference: { [Op.like]: `%${walletAddress}%` } }
                ],
                status: { [Op.in]: ['successful', 'completed', 'confirmed'] }
              }
            });
            
            if (existingTx) {
              cronLogger.info(`[processIncompletePayments] Pool ${walletAddress} already processed (tx: ${existingTx.dataValues.transaction_reference}). Skipping.`);
              continue;
            }
            
            // Check on-chain balance
            const balanceData = await tatumApi.getAddressBalance(walletAddress, walletType);
            const actualBalance = Number(balanceData?.balance || 0);
            
            if (actualBalance <= 0) {
              cronLogger.info(`[processIncompletePayments] Pool ${walletAddress} has no balance. Skipping.`);
              continue;
            }
            
            cronLogger.info(`[processIncompletePayments] Pool ${walletAddress} has ${actualBalance} ${walletType} (expected ${expectedAmount}) — grace period expired, processing...`);
            
            // Get or reconstruct Redis data
            const poolDestTag = poolAddr.dataValues.destination_tag || null;
            const poolRedisKey = poolDestTag ? getCryptoRedisKey(walletAddress, poolDestTag) : `crypto-${walletAddress}`;
            let redisData = await getRedisItem(poolRedisKey);
            
            if (!redisData || Object.keys(redisData).length === 0) {
              // Reconstruct from last_payment_context or DB fields
              const lastContextRaw = poolAddr.dataValues.last_payment_context;
              let paymentContext = null;
              if (lastContextRaw) {
                try {
                  paymentContext = typeof lastContextRaw === 'string' ? JSON.parse(lastContextRaw) : lastContextRaw;
                } catch (e) {
                  cronLogger.warn(`[processIncompletePayments] Failed to parse last_payment_context for ${walletAddress}`);
                }
              }
              
              redisData = {
                mode: 'CRYPTO',
                amount: String(expectedAmount),
                status: 'processing',
                currency: walletType,
                payment_id: paymentId,
                unique_tx_id: paymentId,
                is_merchant_pool: 'true',
                temp_id: String(poolAddr.dataValues.temp_address_id),
                adm_id: String(paymentContext?.adm_id || poolAddr.dataValues.owner_user_id),
                company_id: String(paymentContext?.company_id || poolAddr.dataValues.current_company_id),
                receivedAmount: String(actualBalance),
                originalExpectedAmount: String(expectedAmount),
                fee_payer: paymentContext?.fee_payer || 'company',
                merchant_amount: paymentContext?.merchant_amount || null,
                base_currency: paymentContext?.base_currency || 'USD',
                base_amount: paymentContext?.base_amount || null,
                webhook_url: paymentContext?.webhook_url || null,
                callback_url: paymentContext?.callback_url || null,
                link_id: paymentContext?.link_id || null,
                ref: paymentContext?.ref || `customer-${paymentId}`,
                processedByFallback: 'true',
                lastAttempt: new Date().toISOString(),
              };
              
              // Also reconstruct customer ref
              const custRef = redisData.ref;
              const existingCustData = await getRedisItem(custRef);
              if (!existingCustData || Object.keys(existingCustData).length === 0) {
                const custData = {
                  adm_id: redisData.adm_id,
                  company_id: redisData.company_id,
                  base_currency: redisData.base_currency,
                  base_amount: redisData.base_amount,
                  fee_payer: redisData.fee_payer,
                  merchant_amount: redisData.merchant_amount,
                  webhook_url: redisData.webhook_url,
                  callback_url: redisData.callback_url,
                  link_id: redisData.link_id,
                };
                await setRedisItem(custRef, custData);
              }
              
              await setRedisItem(poolRedisKey, redisData);
              cronLogger.info(`[processIncompletePayments] Reconstructed Redis data for pool ${walletAddress}`);
            } else {
              // Update existing Redis data with current balance
              redisData.status = 'processing';
              redisData.receivedAmount = String(actualBalance);
              redisData.lastAttempt = new Date().toISOString();
              redisData.processedByFallback = 'true';
              await setRedisItem(poolRedisKey, redisData);
            }
            
            // Process via cryptoVerification
            cronLogger.info(`[processIncompletePayments] 🚀 Processing pool ${walletAddress} via cryptoVerification...`);
            const verificationResult = await cryptoVerification(walletAddress, true, poolRedisKey);
            cronLogger.info(`[processIncompletePayments] ✅ Pool ${walletAddress} processed successfully`);
            
          } catch (poolError) {
            cronLogger.error(`[processIncompletePayments] ❌ Failed to process pool address:`, poolError.message || poolError);
          }
        }
      }
    } catch (poolScanError) {
      cronLogger.error("[processIncompletePayments] Error scanning merchant pool addresses:", poolScanError.message || poolScanError);
    }
  } catch (e) {
    cronLogger.error("Error in processIncompletePayments:", e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};


/**
 * GET /api/payment/network-fees
 * Public endpoint - Get real-time blockchain network fees
 */
export default {
  getData,
  addPayment,
  verifyPayment,
  verifyCryptoPayment,
  downloadReceipt,
  createCryptoPayment,
  confirmPayment,
  getBalance,
  authStep,
  getCurrencyRates,
  getPaymentLinks,
  getPaymentLinkById,
  updatePaymentLink,
  deletePaymentLink,
  createPaymentLink,
  startDonation,
  startTip,
  uploadCampaignImage,
  getCreatorProfile,
  getCreatorPublicAnalytics,
  setRefundAddress,
  getPaymentMeta,
  cryptoVerification,
  checkingUSDT,
  sweepNativeAdminFees,
  checkFeeBalance,
  checkOnBlockchair,
  removeUnwantedSubscriptions,
  processIncompletePayments,
  getNetworkFees,
  calculatePaymentAmount,
  getConfiguredCurrenciesForCheckout,
  getFeePreview,
  getCompanyConfiguredCurrencies,
  calculateCheckoutFees,
};

