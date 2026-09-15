import { raw as envRaw } from "../../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import { Op } from "sequelize";
import { errorResponseHelper, getErrorMessage, successResponseHelper, generateWalletName, generateApiKeyName } from "../../helper";
import { API_KEY_VERSION_TOKEN, apiKeyHint, generateApiKeyToken, hashApiKey } from "../../helper/apiKeyToken";
import { sendWithdrawalOTPEmail, sendWithdrawalSuccessEmail, sendExchangeOTPEmail, sendWalletUpdatedEmail, sendWalletUpdateOTPEmail, sendWalletDeletedEmail, sendWalletDeleteOTPEmail } from "../../services/emailService";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { incrementAdminFee, incrementUserWallet } from "../../helper/walletHelpers";
import { formatAmountForDisplay, getCurrencyInfo, COMPANY_CURRENCY_QUERY, convertToUSD, convertToFiat, convertToMultiple, getUserDisplayCurrency } from "../../utils/currencyUtils";
import { PROCESSED_USD_EXPR, PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import crypto from "crypto";
import { deleteRedisItem, getRedisItem, setRedisItem, setRedisTTL, redis } from "../../utils/redisInstance";
import { userWalletModel, companyModel } from "../../models";
import { apiModel, customerModel, customerWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";
import { userModel } from "../../models/userModels";
import { tatumClient } from "../../integrations/tatum/TatumClient";
import { getTransactionFee, getBlockchainFee } from "../../services/feeService";
import mailTransporter from "../../utils/mailTransporter";
import * as merchantPoolService from "../../services/merchantPoolService";
import { PaymentState, parseState, toRedisStatus } from "../../services/paymentStateMachine";
import { getBlockchainNetworkFee, getAllBlockchainFees, calculateCustomerPaymentAmount } from "../../services/blockchainFeeService";
import { invalidateWalletCache } from "./walletShared";
import { t, resolveEmailLang } from "../../utils/emailI18n";
import { notifyWalletChanges, assertWalletNotFrozen } from "../../services/wallet/walletChangeAlert";
import { generateOtpCode } from "../../helper/otpGuard";

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

      if (await assertWalletNotFrozen(res, user_id)) return;

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
          message: "Please add and verify an email address before adding a payout address.",
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
        balance = await tatumClient.validateTronAddress(wallet_address);
      } else {
        balance = await tatumClient.getAddressBalance(wallet_address, currency);
      }
      walletLogger.info(balance);

      // Identity is proven by the `wallet` step-up session (router). Step 2 = POST /verifyOtp saves it.
      return successResponseHelper(
        res,
        200,
        "Address validated",
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
    // Auto-provisioned: hashed and discarded — merchant rotates from the dashboard to obtain a copyable key.
    const plaintextKey = generateApiKeyToken('production');

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

    const secret = envRaw("ACCESS_TOKEN_SECRET");
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
      apiKey: null,
      key_hash: hashApiKey(plaintextKey),
      key_hint: apiKeyHint(plaintextKey, 'production'),
      key_version: API_KEY_VERSION_TOKEN,
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
    const { wallet_address, currency, wallet_name, company_id, destination_tag } = req.body;

    if (!wallet_address || !currency) {
      return errorResponseHelper(res, 400, "wallet_address and currency are required!");
    }

    if (!company_id) {
      return errorResponseHelper(res, 400, "Company ID is required!");
    }
    
    const user_id = userData.user_id;

    if (await assertWalletNotFrozen(res, user_id)) return;

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

    // Legacy per-wallet OTP columns are cleared defensively (the step-up session replaced them).
    await userModel.update(
      { verified_otp: null, otp_expired: null, otp_currency: null },
      { where: { user_id: user_id } }
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
    
    // Change alert doubles as the "wallet added" confirmation + carries the
    // one-tap "this wasn't me" revert link and drops an in-app notice.
    await notifyWalletChanges({
      user_id,
      company_id,
      email: userData.email,
      name: userData.name,
      companyName,
      changes: [
        {
          wallet_id: walletSlot.dataValues.wallet_id,
          currency,
          action: "add",
          previous_address: null,
          previous_name: null,
          previous_tag: null,
          new_address: wallet_address,
        },
      ],
    });

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

    successResponseHelper(res, 200, "Wallet added successfully!", {
      verified: true,
      wallet_name,
      company_id,
      auto_api_key_created: autoApiKeyCreated,
    });
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};


