import { raw as envRaw } from "../../utils/config";
import { getTempAddressBatches } from "./tempAddress";
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

export const estimateFees = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { address, amount, currency } = req.body;
  try {
    const contractAddress =
      currency === "USDT-TRC20"
        ? envRaw("TRX_CONTRACT")
        : currency === "USDT-ERC20"
          ? envRaw("ETH_CONTRACT")
          : null;
    let data;
    walletLogger.info("##address", address);
    if (currency === "TRX" || currency === "USDT-TRC20") {
      data = tatumApi.validateTronAddress(address);
    } else {
      data = await tatumApi.getAddressBalance(address, currency);
    }
    walletLogger.info(data);

    let tempAmount = 0,
      inputCount = 0;

    // Get Temporary Addresses
    const { fromAddress, toAddress, totalSendAmount } =
      await getTempAddressBatches(
        userData.user_id,
        currency,
        amount,
        address,
        0
      );

    walletLogger.info("####Transaction Details ---->", {
      fromAddress,
      toAddress,
      totalSendAmount,
    });

    if (currency === "BCH") {
      for (const address of fromAddress) {
        const utxo = await blockchairApi.getBitcoinCashUTXO(address.address);

        utxo.sort((a, b) => b.value - a.value);

        for (let i = 0; i < utxo.length; i++) {
          if (tempAmount < amount) {
            inputCount++;
            tempAmount += utxo[i].value / 100000000;
          }
        }
      }
    }

    // Get Fees for batch transactions
    const batchFees = await tatumApi.batchFeeEstimation({
      currency,
      fromAddresses: fromAddress,
      toAddresses: toAddress,
      amount: totalSendAmount,
      _contractAddress: contractAddress,
      totalAddress: fromAddress.length,
      bchInputs: inputCount,
    });
    walletLogger.info("###fromAddress", fromAddress);
    const tempFees = {};
    const keys = Object.keys(batchFees);
    const tempCurrency = currency === "USDT-ERC20" ? "ETH" : currency;
    const usdRate = await convertToUSD(tempCurrency, 1);
    const currentAmount = [{ amount: usdRate }];
    for (let i = 0; i < keys.length; i++) {
      if (currency === "USDT-ERC20") {
        if (["fast"].indexOf(keys[i]) !== -1) {
          tempFees[keys[i] + "_in_usd"] = Number(
            batchFees[keys[i]] * currentAmount[0].amount
          ).toFixed(2);
          tempFees[keys[i]] = Number(
            batchFees[keys[i]] * currentAmount[0].amount
          ).toFixed(2);
        } else {
          tempFees[keys[i]] = batchFees[keys[i]];
        }
      } else if (currency === "USDT-TRC20") {
        tempFees[keys[i] + "_in_usd"] = Number(batchFees[keys[i]]).toFixed(2);
        tempFees[keys[i]] = Number(batchFees[keys[i]]).toFixed(2);
      } else {
        if (["fast", "medium", "slow"].indexOf(keys[i]) !== -1) {
          tempFees[keys[i] + "_in_usd"] = Number(
            batchFees[keys[i]] * currentAmount[0].amount
          ).toFixed(2);
        }
        tempFees[keys[i]] = batchFees[keys[i]];
      }
    }

    successResponseHelper(res, 200, "Fee estimation calculated successfully", tempFees);
  } catch (e) {
    walletLogger.info("#############Error", e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    const returnMessage =
      e.message === "Insufficient funds!"
        ? e.message
        : `Please add a valid ${currency} address!`;
    errorResponseHelper(res, 500, returnMessage);
  }
};


export const getConfiguredCurrencies = asyncController(async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { company_id } = req.query;

  // Phase 10 Task 10.2: Get user's configured wallets from userWalletModel
  const configuredWallets = await userWalletModel.findAll({
    where: {
      user_id: userData.user_id,
      wallet_address: { [Op.not]: null },
      ...(company_id && { company_id: parseInt(company_id as string) }),
    },
    attributes: ['wallet_type', 'wallet_address', 'wallet_name'],
  });

  // Extract unique currencies using dataValues
  const currencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];

  const response = {
    configured_currencies: currencies,
    wallet_count: configuredWallets.length,
    wallets: configuredWallets.map((w) => {
      const walletData = w.dataValues as { wallet_type: string; wallet_name?: string; wallet_address?: string };
      return {
        currency: walletData.wallet_type,
        label: walletData.wallet_name,
        address_masked: walletData.wallet_address ?
          `${walletData.wallet_address.substring(0, 6)}...${walletData.wallet_address.substring(walletData.wallet_address.length - 4)}` :
          null
      };
    }),
    skip_selection: currencies.length === 1, // If only 1 currency, frontend can skip asset selection
  };

  successResponseHelper(res, 200, "Configured currencies retrieved successfully", response);
}, walletLogger, "getConfiguredCurrencies");

/**
 * GET /api/wallet/network-fees
 * Get real-time blockchain network fees for all supported chains
 */
export const getNetworkFees = asyncController(async (req: express.Request, res: express.Response) => {
  const { chain } = req.query;

  if (chain) {
    // Get fee for specific chain
    const fee = await getBlockchainNetworkFee(chain as string);
    successResponseHelper(res, 200, "Network fee retrieved", fee);
  } else {
    // Get fees for all chains
    const fees = await getAllBlockchainFees();
    successResponseHelper(res, 200, "Network fees retrieved", fees);
  }
}, walletLogger, "getNetworkFees");

/**
 * POST /api/wallet/calculate-payment
 * Calculate total amount customer needs to pay including blockchain fees
 * Used when fee_payer = 'customer' on payment links
 */
export const calculatePaymentAmount = async (req: express.Request, res: express.Response) => {
  try {
    const { amount_usd, chain, fee_payer = 'customer' } = req.body;

    if (!amount_usd || !chain) {
      return errorResponseHelper(res, 400, "amount_usd and chain are required");
    }

    // Get current crypto price
    const cryptoPrice = await getCryptoPrice(chain);
    
    if (fee_payer === 'customer') {
      // Customer pays blockchain fees - add to total
      const calculation = await calculateCustomerPaymentAmount(
        parseFloat(amount_usd),
        chain,
        cryptoPrice
      );

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'customer',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: calculation.baseAmountCrypto,
        blockchain_fee_native: calculation.blockchainFeeNative,
        blockchain_fee_usd: calculation.blockchainFeeUSD,
        total_amount_crypto: calculation.totalAmountCrypto,
        total_amount_usd: calculation.totalAmountUSD,
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
      });
    } else {
      // Company pays blockchain fees - customer only pays base amount
      const baseAmountCrypto = parseFloat(amount_usd) / cryptoPrice;
      const networkFee = await getBlockchainNetworkFee(chain);

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'company',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: baseAmountCrypto,
        blockchain_fee_native: networkFee.feeInNative,
        blockchain_fee_usd: networkFee.feeInUSD,
        total_amount_crypto: baseAmountCrypto, // Customer only pays base
        total_amount_usd: parseFloat(amount_usd),
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
        note: "Blockchain fee will be deducted from merchant settlement"
      });
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, {}, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Helper: Get crypto price in USD
 */
export const getCryptoPrice = async (symbol: string): Promise<number> => {
  try {
    const idMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'LTC': 'litecoin',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'USDT': 'tether',
      'USDT_ERC20': 'tether',
      'USDT_TRC20': 'tether',
      'BCH': 'bitcoin-cash',
    };

    const coinId = idMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    return response.data[coinId]?.usd || 0;
  } catch (error) {
    // Fallback prices
    const fallbackPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3300,
      'LTC': 100,
      'DOGE': 0.35,
      'TRX': 0.25,
      'USDT': 1,
      'USDT_ERC20': 1,
      'USDT_TRC20': 1,
      'BCH': 450,
    };
    return fallbackPrices[symbol.toUpperCase()] || 0;
  }
};

/**
 * POST /api/wallet/encrypt-payload
 * Server-side encryption endpoint — replaces client-side encryption
 * that was using an exposed NEXT_PUBLIC_ key.
 */
export const encryptPayload = async (req: express.Request, res: express.Response) => {
  try {
    const { payload } = req.body;
    if (!payload) {
      return errorResponseHelper(res, 400, "payload is required");
    }
    const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
    const encrypted = encrypt(payloadStr);
    return successResponseHelper(res, 200, "Payload encrypted", { data: encrypted });
  } catch (e) {
    handleControllerError(res, e, walletLogger);
  }
};

/**
 * GET /api/wallet/reusable-wallets?exclude_company_id=123
 * Returns the caller's OTHER companies that have at least one saved wallet,
 * each with its wallet list (masked addresses). Powers the "Reuse wallets from
 * an existing company" selector shown during new-company onboarding and on the
 * Wallets page. Read-only; no OTP.
 */

