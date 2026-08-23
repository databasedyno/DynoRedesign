import express from "express";
import jwt from "jsonwebtoken";
import {
  FW_API_Response,
  IFundData,
  IUserType,
  IVerifyResponse,
} from "../../utils/types";
import sequelize from "../../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import {
  decrypt,
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  successResponseHelper,
  generateWalletName,
  generateApiKeyName,
} from "../../helper";
import {
  sendWithdrawalOTPEmail,
  sendWithdrawalSuccessEmail,
  sendExchangeOTPEmail,
  sendWalletAddedEmail,
  sendWalletUpdatedEmail,
  sendWalletUpdateOTPEmail,
  sendWalletDeletedEmail,
  sendWalletDeleteOTPEmail,
} from "../../services/emailService";
import { handleControllerError, handleControllerErrorReturn, asyncController } from "../../helper/controllerErrorHandler";
import { parseSortAndPagination } from "../../helper/queryHelpers";
import { incrementAdminFee, incrementUserWallet } from "../../helper/walletHelpers";
import { formatAmountForDisplay, getCurrencyInfo, COMPANY_CURRENCY_QUERY, convertToUSD, convertToFiat, convertToMultiple, getUserDisplayCurrency } from "../../utils/currencyUtils";
import { resolveTransactionSource } from "../../utils/transactionSource";
import { deriveTxDisplayStatus } from "../../utils/transactionDisplayStatus";
import { PROCESSED_USD_EXPR, PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import crypto from "crypto";
import flw from "../../apis/flutterwaveApi";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
  setRedisTTL,
  redis,
} from "../../utils/redisInstance";
import { paymentTypes } from "../../utils/enums";
import axios from "axios";
import QR_Code from "qrcode";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import { adminWalletModel, userWalletModel, companyModel } from "../../models";
import { apiModel, customerModel, customerWalletModel } from "../../models";
import { validateCompanyOwnership } from "../../utils/validateCompanyOwnership";
import { walletLogger } from "../../utils/loggers";
import {
  selfTransactionModel,
  userExchangeModel,
  userModel,
  userTransactionModel,
  userWalletAddressModel,
  userTempAddressModel,
} from "../../models/userModels";
import tatumApi from "../../apis/tatumApi";
import blockchairApi from "../../apis/blockchairApi";
import { getTransactionFee, getBlockchainFee } from "../../services/feeService";
import mailTransporter from "../../utils/mailTransporter";
import { getAdminWalletAddress } from "../../utils/adminUtils";
import WAValidator from "wallet-address-validator";
import * as merchantPoolService from "../../services/merchantPoolService";
import { PaymentState, parseState, toRedisStatus } from "../../services/paymentStateMachine";
import {
  getBlockchainNetworkFee,
  getAllBlockchainFees,
  calculateCustomerPaymentAmount
} from "../../services/blockchainFeeService";
import { escapeHtml, buildTransactionFilters, invalidateWalletCache } from "./walletShared";
import { t, resolveEmailLang } from "../../utils/emailI18n";

export async function updateOtp(userData, wallet_address, currency) {
  const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
  const lang = await resolveEmailLang(userData.language, userData.email);

  // Use branded email template for OTP (localized to the merchant's language)
  const { dynoPayEmailTemplate } = await import("../../services/emailService");
  const otpContent = `
    <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">${t("walletOtp.intro", lang, { currency: `<strong style="color: #1a1a2e;">${currency}</strong>` })}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 24px 0;">
      <tr><td style="padding: 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t("walletOtp.walletAddress", lang)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">${wallet_address}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">${t("walletOtp.currency", lang)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right;">${currency}</td></tr>
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr><td align="center">
        <div style="background: linear-gradient(135deg, #1034a6 0%, #0d2570 100%); border-radius: 8px; padding: 20px 32px; display: inline-block;">
          <span style="font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 8px; font-family: 'Inter', Arial, monospace;">${randomNumberOTP}</span>
        </div>
      </td></tr>
    </table>
    <p style="font-size: 14px; color: #6b7280; text-align: center; margin: 16px 0 0 0; font-family: 'Inter', Arial, sans-serif;">${t("walletOtp.expiry", lang, { minutes: "<strong>5</strong>" })}</p>`;

  const htmlBody = dynoPayEmailTemplate(
    t("walletOtp.heading", lang),
    otpContent,
    false
  );

  await mailTransporter({
    to: userData.email,
    name: userData.name,
    subject: t("walletOtp.subject", lang),
    body: htmlBody,
  });

  // Update OTP in DB with currency context
  await userModel.update(
    {
      verified_otp: randomNumberOTP.toString(),
      otp_expired: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      otp_currency: currency, // Store which currency was validated
    },
    {
      where: { user_id: userData.user_id },
    }
  );

  return true;
}


export const validateWallet = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_address, currency, wallet_name, company_id, destination_tag } = req.body;
    
    // Validate required fields
    if (!company_id) {
      return errorResponseHelper(res, 400, "Company ID is required!");
    }
    
    try {
      const user_id = userData.user_id;
      
      // Wallet operations require a verified email — security OTPs are delivered by email.
      const accountUser = await userModel.findOne({
        where: { user_id },
        attributes: ['email', 'email_verified'],
      });
      if (!accountUser?.dataValues?.email || !accountUser.dataValues.email_verified) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          code: "EMAIL_VERIFICATION_REQUIRED",
          message: "Please add and verify an email address before adding a wallet.",
        });
      }
      
      // Verify user has access to this company
      const company = await companyModel.findOne({
        where: {
          company_id,
          user_id
        }
      });
      
      if (!company) {
        return errorResponseHelper(res, 403, "You don't have access to this company!");
      }
      
      // CRITICAL VALIDATION: Check if company already has a wallet for this blockchain type
      // Each company can only have ONE wallet address per blockchain (BTC, ETH, etc.)
      const existingWallet = await userWalletModel.findOne({
        where: {
          wallet_address: { [Op.not]: null },
          wallet_type: currency,
          user_id: user_id,
          company_id: company_id
        },
      });
      
      if (existingWallet) {
        return errorResponseHelper(
          res,
          400,
          `A ${currency} wallet address already exists for this company! Each company can only have one wallet address per blockchain type. Existing address: ${existingWallet.dataValues.wallet_address.substring(0, 10)}...`
        );
      }
      
      let balance;
      if (currency === "TRX" || currency === "USDT-TRC20") {
        balance = await tatumApi.validateTronAddress(wallet_address);
      } else {
        balance = await tatumApi.getAddressBalance(wallet_address, currency);
      }
      walletLogger.info(balance);

      await updateOtp(userData, wallet_address, currency);

      // Success response - consistent with update/edit/delete wallet OTP responses
      return successResponseHelper(
        res,
        200,
        "Address validated! OTP sent to your email",
        {
          wallet_address,
          wallet_type: currency,
          company_id,
          wallet_name: wallet_name || null,
          destination_tag: destination_tag || null,
          email: accountUser.dataValues.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        }
      );
    } catch (e) {
      errorResponseHelper(
        res,
        500,
        `please enter a valid ${currency} address!`
      );
    }
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Ensures the given company has an active LIVE (dpk_live_) API key.
 * - Guards on environment='production' only, so a coexisting TEST key does not block creation.
 * - Non-fatal: returns false + logs a warning if creation fails.
 * - Idempotent: safe to call multiple times for the same company.
 *
 * @returns true if a new live key was created; false if one already existed OR creation was skipped.
 */
export async function ensureLiveApiKey(
  company_id: number,
  user_id: number,
  userEmail: string,
  companyName?: string | null,
  companyEmail?: string | null,
): Promise<boolean> {
  try {
    const existing = await apiModel.findOne({
      where: { company_id, environment: 'production', status: 'active' },
    });
    if (existing) return false;

    const defaultCurrency = 'USD';
    const keyData = { base_currency: defaultCurrency, company_id, adm_id: user_id, env: 'production' };
    const keyString = 'dpk_live_' + 'DYNOPAY_USER_API-' + JSON.stringify(keyData);
    const apiKey = encrypt(keyString, process.env.API_SECRET);

    const name = companyName || 'Company';
    const email = companyEmail || userEmail;
    const createdCustomer = await customerModel.create({
      id: crypto.randomUUID(),
      customer_name: name + ' admin',
      email,
      mobile: email,
      company_id,
    });
    await customerWalletModel.create({
      id: crypto.randomUUID(),
      customer_id: createdCustomer.dataValues.customer_id,
      wallet_type: defaultCurrency,
    });

    const secret = process.env.ACCESS_TOKEN_SECRET;
    const customerToken = jwt.sign(
      { customer_id: createdCustomer.dataValues.customer_id },
      secret,
      { expiresIn: '30d' },
    );
    const adminToken = jwt.sign(
      { api_id: null, company_id, user_id, type: 'admin_token', environment: 'production' },
      secret,
      { expiresIn: '30d' },
    );

    await apiModel.create({
      company_id,
      base_currency: defaultCurrency,
      apiKey,
      user_id,
      adminToken: customerToken,
      admin_token: adminToken,
      withdrawal_whitelist: null,
      api_name: generateApiKeyName(),
      permissions: JSON.stringify(['payments', 'transactions', 'webhooks', 'wallets']),
      environment: 'production',
      status: 'active',
      test_mode_restrictions: null,
      request_count: 0,
      rate_limit_per_minute: 60,
      rate_limit_per_hour: 3600,
      rate_limit_per_day: 100000,
    });
    walletLogger.info(`[ensureLiveApiKey] ✅ Auto-created LIVE API key for company ${company_id}`);
    return true;
  } catch (err) {
    walletLogger.warn(`[ensureLiveApiKey] ⚠️ Auto LIVE key creation skipped: ${getErrorMessage(err)}`);
    return false;
  }
}

export const verifyOtp = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { otp, wallet_address, currency, currency_type, wallet_name, company_id, destination_tag } = req.body;

    if (!otp) {
      return errorResponseHelper(res, 400, "OTP is required!");
    }
    
    if (!company_id) {
      return errorResponseHelper(res, 400, "Company ID is required!");
    }
    
    const user_id = userData.user_id;
    
    // Verify user has access to this company
    const company = await companyModel.findOne({
      where: {
        company_id,
        user_id
      }
    });
    
    if (!company) {
      return errorResponseHelper(res, 403, "You don't have access to this company!");
    }

    // Find the wallet with OTP - ensure string comparison
    const otpString = String(otp).trim();
    
    const walletWithOtp = await userModel.findOne({
      where: {
        user_id: user_id,
        verified_otp: otpString,
      },
    });

    if (!walletWithOtp) {
      walletLogger.warn(`Invalid OTP attempt`, { user_id, otp_provided: otpString });
      return errorResponseHelper(
        res,
        400,
        "Please enter a valid OTP!"
      );
    }

    // Check if OTP is expired
    if (new Date() > walletWithOtp.dataValues.otp_expired) {
      return errorResponseHelper(
        res,
        400,
        "OTP has expired! Please request a new one."
      );
    }

    // CRITICAL SECURITY CHECK: Validate currency matches what was validated
    if (walletWithOtp.dataValues.otp_currency && walletWithOtp.dataValues.otp_currency !== currency) {
      return errorResponseHelper(
        res,
        400,
        `Security validation failed! OTP was issued for ${walletWithOtp.dataValues.otp_currency} wallet, but you're trying to verify ${currency} wallet. Please request a new OTP for ${currency}.`
      );
    }

    // If OTP is valid, clear it and mark as verified
    await userModel.update(
      {
        verified_otp: null,
        otp_expired: null,
        otp_currency: null, // Clear currency context
      },
      {
        where: {
          user_id: user_id,
        },
      }
    );

    // Update wallet with address, name, and company_id
    // Find an empty wallet slot for this currency (not assigned to any company yet)
    let walletSlot = await userWalletModel.findOne({
      where: {
        user_id,
        wallet_type: currency,
        company_id: null,
        wallet_address: null,
      },
    });

    // If no empty slot exists, create a new wallet record
    if (!walletSlot) {
      walletSlot = await userWalletModel.create({
        user_id,
        wallet_type: currency,
        currency_type: 'CRYPTO',
        amount: 0,
        wallet_address: null,
        company_id: null,
      });
    }

    // Update the empty slot with the new wallet data
    await userWalletModel.update(
      {
        wallet_address,
        company_id,
        wallet_name: wallet_name || generateWalletName(),
        destination_tag: destination_tag ? Number(destination_tag) : null,
      },
      {
        where: {
          wallet_id: walletSlot.dataValues.wallet_id,
        },
      }
    );

    // Send confirmation email
    const companyData = await companyModel.findOne({
      where: { company_id }
    });
    
    const companyName = companyData?.dataValues.company_name || "Your Company";
    const maskAddress = (addr: string) => `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
    
    // Initialize merchant pool for this currency type (lazy initialization)
    // This creates the merchant's xpub if not exists and adds initial pool addresses
    try {
      const MERCHANT_POOL_CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
      if (MERCHANT_POOL_CRYPTO_TYPES.includes(currency)) {
        walletLogger.info(`[verifyOtp] Initializing merchant pool for user ${user_id}, currency ${currency}...`);
        await merchantPoolService.initializeMerchantPool(user_id, currency);
        walletLogger.info(`[verifyOtp] ✅ Merchant pool initialized for ${currency}`);
      }
    } catch (poolError) {
      // Log but don't fail - pool can be initialized lazily on first payment
      walletLogger.warn(`[verifyOtp] ⚠️ Merchant pool initialization skipped:`, poolError.message);
    }
    
    await sendWalletAddedEmail(
      userData.email,
      userData.name,
      maskAddress(wallet_address),
      currency,
      companyName,
      wallet_name || undefined
    );

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(user_id);

    // AUTO-CREATE LIVE API KEY (if company has no active production key).
    // Non-fatal: helper wraps its own try/catch. Idempotent guard on environment='production'
    // means a coexisting TEST key does NOT block live-key creation.
    const autoApiKeyCreated = await ensureLiveApiKey(
      company_id,
      user_id,
      userData.email,
      companyData?.dataValues.company_name,
      companyData?.dataValues.email,
    );

    successResponseHelper(res, 200, "OTP verified successfully!", {
      verified: true,
      wallet_name,
      company_id,
      auto_api_key_created: autoApiKeyCreated,
    });
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};


