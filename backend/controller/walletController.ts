import express from "express";
import jwt from "jsonwebtoken";
import {
  FW_API_Response,
  IFundData,
  IUserType,
  IVerifyResponse,
} from "../utils/types";
import sequelize from "../utils/dbInstance";
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
} from "../helper";
import {
  sendWithdrawalOTPEmail,
  sendWithdrawalSuccessEmail,
  sendExchangeOTPEmail,
  sendWalletAddedEmail,
  sendWalletUpdatedEmail,
  sendWalletUpdateOTPEmail,
  sendWalletDeletedEmail,
  sendWalletEditOTPEmail,
  sendWalletDeleteOTPEmail,
} from "../services/emailService";
import { handleControllerError, handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { parseSortAndPagination } from "../helper/queryHelpers";
import { incrementAdminFee, incrementUserWallet } from "../helper/walletHelpers";
import { formatAmountForDisplay, getCurrencyInfo, COMPANY_CURRENCY_QUERY, convertToUSD, convertToFiat, convertToMultiple, getCompanyBaseCurrency } from "../utils/currencyUtils";
import crypto from "crypto";

// HTML escape utility to prevent XSS in email templates
const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/**
 * Builds parameterized WHERE conditions for transaction queries.
 * Used by getWalletTransactions and exportTransactions.
 */
function buildTransactionFilters(
  userId: string | number,
  filters: { date_from?: string; date_to?: string; status?: string; currency?: string; search?: string; company_id?: string }
): { whereConditions: string; replacements: Record<string, unknown> } {
  const replacements: Record<string, unknown> = { user_id: userId };
  let whereConditions = `ut.user_id=:user_id`;
  if (filters.date_from) {
    whereConditions += ` AND ut."createdAt" >= :date_from`;
    replacements.date_from = filters.date_from;
  }
  if (filters.date_to) {
    whereConditions += ` AND ut."createdAt" <= :date_to`;
    replacements.date_to = filters.date_to;
  }
  if (filters.status) {
    whereConditions += ` AND ut.status = :status`;
    replacements.status = filters.status;
  }
  if (filters.currency) {
    whereConditions += ` AND ut.base_currency = :currency`;
    replacements.currency = filters.currency;
  }
  if (filters.search) {
    whereConditions += ` AND (ut.id ILIKE :search OR ut.transaction_reference ILIKE :search)`;
    replacements.search = `%${filters.search}%`;
  }
  if (filters.company_id) {
    whereConditions += ` AND (ut.company_id = :company_id OR cm.company_id = :company_id)`;
    replacements.company_id = parseInt(filters.company_id as string, 10);
  }
  return { whereConditions, replacements };
}

import flw from "../apis/flutterwaveApi";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
  setRedisTTL,
  redis,
} from "../utils/redisInstance";
import { paymentTypes } from "../utils/enums";
import axios from "axios";
import QR_Code from "qrcode";
import { generateQRCodeWithLogo } from "../utils/qrCodeWithLogo";
import { adminWalletModel, userWalletModel, companyModel } from "../models";
import { apiModel, customerModel, customerWalletModel } from "../models";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { walletLogger } from "../utils/loggers";
import {
  selfTransactionModel,
  userExchangeModel,
  userModel,
  userTransactionModel,
  userWalletAddressModel,
  userTempAddressModel,
} from "../models/userModels";
import tatumApi from "../apis/tatumApi";
// localStorage import removed - OTP now uses Redis
import blockchairApi from "../apis/blockchairApi";
import { getTransactionFee, getBlockchainFee } from "../services/feeService";
import mailTransporter from "../utils/mailTransporter";
import { getAdminWalletAddress } from "../utils/adminUtils";
import WAValidator from "wallet-address-validator";
import * as merchantPoolService from "../services/merchantPoolService";
import { PaymentState, parseState, toRedisStatus } from "../services/paymentStateMachine";
import { 
  getBlockchainNetworkFee, 
  getAllBlockchainFees, 
  calculateCustomerPaymentAmount 
} from "../services/blockchainFeeService";

/**
 * Invalidate all wallet caches for a user
 * Called after any wallet modification (add, update, delete)
 */
const invalidateWalletCache = async (userId: number): Promise<void> => {
  try {
    // Delete all wallet cache keys for this user using pattern matching
    const walletPattern = `wallet:${userId}:*`;
    const walletKeys = await redis.keys(walletPattern);
    if (walletKeys.length > 0) {
      await redis.del(walletKeys);
      walletLogger.info(`[WalletCache] Invalidated ${walletKeys.length} wallet cache keys for user ${userId}`);
    }
    
    // Also invalidate dashboard cache if it exists
    const dashboardPattern = `dashboard:${userId}:*`;
    const dashboardKeys = await redis.keys(dashboardPattern);
    if (dashboardKeys.length > 0) {
      await redis.del(dashboardKeys);
      walletLogger.info(`[WalletCache] Invalidated ${dashboardKeys.length} dashboard cache keys for user ${userId}`);
    }
    
    if (walletKeys.length === 0 && dashboardKeys.length === 0) {
      walletLogger.info(`[WalletCache] No cache keys found for user ${userId}`);
    }
  } catch (error) {
    walletLogger.error(`[WalletCache] Error invalidating cache for user ${userId}:`, error);
    // Don't throw - cache invalidation failure shouldn't break the main operation
  }
};

const getWallet = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id } = req.query;
    
    // Get company's preferred currency from their API key (production preferred)
    let preferredCurrency = 'USD';
    let fiatConversionRate = 1;
    
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id);
      if (!companyData) return; // 403 already sent
      preferredCurrency = await getCompanyBaseCurrency(company_id as string);
    }
    
    // Check cache first (120 second TTL) - include currency in cache key
    const cacheKey = `wallet:${userData.user_id}:${company_id || 'all'}:${preferredCurrency}:v3`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      walletLogger.info(`[Wallet] Cache hit for user ${userData.user_id}`);
      return successResponseHelper(res, 200, "Wallets retrieved", cached);
    }
    
    // Build where clause with optional company_id filter
    // Only return CRYPTO wallets (this is a crypto-focused project)
    const whereClause: Record<string, unknown> = {
      user_id: userData.user_id,
      currency_type: 'CRYPTO',
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    const walletData = await userWalletModel.findAll({
      attributes: {
        exclude: [
          // "wallet_id", // ✅ MUST RETURN: Required for delete operations
          "privateKey",
          "subscription_id",
          "wallet_account_id",
          "xpub",
          "mnemonic",
        ],
      },
      where: whereClause,
    });

    // Get all unique company IDs from wallets
    const companyIds = [...new Set(walletData.map(w => w.dataValues.company_id))];
    
    // Fetch company names
    const companies = await companyModel.findAll({
      where: { company_id: companyIds },
      attributes: ['company_id', 'company_name'],
    });
    
    // Create company lookup map
    const companyMap = new Map<number, string>();
    for (const company of companies) {
      companyMap.set(company.dataValues.company_id, company.dataValues.company_name);
    }

    const currencyList = [];

    for (let i = 0; i < walletData.length; i++) {
      currencyList.push(walletData[i].dataValues.wallet_type);
    }

    let currencyData: Array<{ currency: string; amount: number; transferRate: number }> = [];
    try {
      currencyData = await convertToMultiple("USD", currencyList, 1, false);
    } catch (e) {
      walletLogger.warn(`[getWallet] Currency conversion failed for some currencies, using fallback rates`);
      // Fallback: return empty rates - wallet will still load with 0 USD values
      currencyData = currencyList.map((c: string) => ({ currency: c, amount: 0, transferRate: 0 }));
    }
    
    // Get USD to preferred currency conversion rate
    if (preferredCurrency !== 'USD') {
      try {
        const fiatResult = await convertToFiat('USD', preferredCurrency, 1);
        if (fiatResult.amount) {
          fiatConversionRate = fiatResult.amount;
        }
      } catch (e) {
        walletLogger.warn(`[getWallet] Currency conversion failed, using USD`);
        preferredCurrency = 'USD';
      }
    }

    // Create a map of currency to transfer rate for lookup
    const rateMap = new Map<string, number>();
    for (const cd of currencyData) {
      rateMap.set(cd.currency, cd.transferRate);
    }

    // Build return data - iterate through walletData directly to preserve all wallets
    // Add company_name to each wallet
    const walletsWithCompanyName = [];
    for (const wallet of walletData) {
      const currentWallet = wallet.dataValues;
      const transferRate = rateMap.get(currentWallet.wallet_type) || 1;
      const amountInUSD = Number(currentWallet.amount / transferRate);
      const amountInBaseCurrency = amountInUSD * fiatConversionRate;
      const amountDisplay = formatAmountForDisplay(amountInBaseCurrency, preferredCurrency);
      walletsWithCompanyName.push({
        ...currentWallet,
        company_name: companyMap.get(currentWallet.company_id) || 'Unknown',
        amount_in_usd: Number(amountInUSD).toFixed(2),
        amount_in_base_currency: Number(amountInBaseCurrency).toFixed(2),
        amount_display: amountDisplay, // Full display object with symbol + code
        base_currency: preferredCurrency,
        transfer_rate: transferRate,
      });
    }

    // Group wallets by company
    const currencyInfo = getCurrencyInfo(preferredCurrency);
    const groupedByCompany: { [key: string]: { company_id: number; company_name: string; base_currency: string; currency_info: typeof currencyInfo; wallets: Array<Record<string, unknown>> } } = {};
    
    for (const wallet of walletsWithCompanyName) {
      const companyKey = `company_${wallet.company_id}`;
      if (!groupedByCompany[companyKey]) {
        groupedByCompany[companyKey] = {
          company_id: wallet.company_id,
          company_name: wallet.company_name,
          base_currency: wallet.base_currency,
          currency_info: getCurrencyInfo(wallet.base_currency),
          wallets: [],
        };
      }
      // Remove company_name from individual wallet since it's at group level
      const { company_name, base_currency, ...walletWithoutCompanyName } = wallet;
      groupedByCompany[companyKey].wallets.push(walletWithoutCompanyName);
    }

    // Convert to array format
    const returnData = Object.values(groupedByCompany);

    const totalWallets = walletsWithCompanyName.length;
    const message = totalWallets === 0 
      ? "No wallets found. Add your first wallet address to start receiving payments."
      : `Successfully retrieved ${totalWallets} wallet${totalWallets === 1 ? '' : 's'} from ${returnData.length} compan${returnData.length === 1 ? 'y' : 'ies'}`;
    
    // Cache the result (120s TTL — rates update in background cache every 60s)
    await setRedisItem(cacheKey, returnData);
    await setRedisTTL(cacheKey, 120);
    
    successResponseHelper(res, 200, message, returnData);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getWalletTransactions = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = req.params.id;
    const { rowsPerPage, page, filters } = req.body;
    const ALLOWED_SORT_COLUMNS: Record<string, string> = {
      createdAt: '"createdAt"', updatedAt: '"updatedAt"', base_amount: 'base_amount',
      status: 'status', id: 'id', transaction_reference: 'transaction_reference',
    };
    const sort = parseSortAndPagination(ALLOWED_SORT_COLUMNS, filters, rowsPerPage, page);
    const walletData = await userWalletModel.findOne({
      where: {
        id,
      },
    });

    const wallet_id = walletData.dataValues.wallet_id;
    const company_id = walletData.dataValues.company_id;
    
    // Get company's preferred currency
    let preferredCurrency = 'USD';
    let conversionRate = 1;
    
    if (company_id) {
      preferredCurrency = await getCompanyBaseCurrency(company_id as string);
    }
    
    // Get conversion rate if not USD
    if (preferredCurrency !== 'USD') {
      try {
        const result = await convertToFiat('USD', preferredCurrency, 1);
        if (result.amount) {
          conversionRate = result.amount;
        }
      } catch (e) {
        walletLogger.warn(`[getWalletTransactions] Currency conversion failed`);
        preferredCurrency = 'USD';
      }
    }
    
    const selfData = await selfTransactionModel.findAll({
      attributes: { exclude: ["wallet_id", "transaction_id"] },
      where: {
        wallet_id,
      },
      ...(sort.column && sort.sortType && { order: [[sort.column, sort.sortType]] }),
      ...(sort.offset !== undefined && sort.limit && { offset: sort.offset, limit: sort.limit }),
    });

    let query = `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id where ut.wallet_id=:wallet_id`;
    query += ` order by ${sort.safeColumn} ${sort.safeSortType}`;
    if (sort.offset !== undefined && sort.limit) query += ` offset :offset limit :limit`;

    const tempData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements: { wallet_id: parseInt(wallet_id, 10), offset: sort.offset, limit: sort.limit },
    });

    const customer_data = tempData.map((x: Record<string, unknown>) => {
      const { wallet_id, transaction_id, ...rest } = x;
      const baseAmount = Number(rest.base_amount || 0);
      return {
        ...rest,
        display_amount: Math.round(baseAmount * conversionRate * 100) / 100,
        display_currency: preferredCurrency,
      };
    });

    const totalTransactions = (customer_data?.length || 0) + (selfData?.length || 0);
    const message = totalTransactions === 0
      ? "No transaction history found"
      : `Successfully retrieved ${totalTransactions} transaction${totalTransactions === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, {
      customers_transactions: customer_data,
      self_transactions: selfData,
      currency: preferredCurrency,
    });
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const estimateFees = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { address, amount, currency } = req.body;
  try {
    const contractAddress =
      currency === "USDT-TRC20"
        ? process.env.TRX_CONTRACT
        : currency === "USDT-ERC20"
          ? process.env.ETH_CONTRACT
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

const getAllTransactions = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { 
      rowsPerPage, 
      page, 
      filters,
      date_from,
      date_to,
      status,
      currency,
      search,
      company_id
    } = req.body;
    
    const ALLOWED_COLUMNS: Record<string, string> = {
      createdAt: 'ut."createdAt"', updatedAt: 'ut."updatedAt"', base_amount: 'ut.base_amount',
      status: 'ut.status', id: 'ut.id', transaction_reference: 'ut.transaction_reference',
    };
    const sort = parseSortAndPagination(ALLOWED_COLUMNS, filters, rowsPerPage, page);

    // Build WHERE conditions with parameterized replacements
    const { whereConditions, replacements } = buildTransactionFilters(userData.user_id, {
      date_from, date_to, status, currency, search, company_id
    });
    let txQuery = `
      SELECT 
        ut.*,
        c.customer_name,
        c.email,
        cm.company_name,
        cm.company_id,
        uw.wallet_type as crypto_currency,
        uw.wallet_address as settlement_address,
        sc.conversion_id as auto_convert_id,
        sc.status as auto_convert_status,
        sc.source_currency as auto_convert_source_currency,
        sc.source_amount as auto_convert_source_amount,
        sc.source_amount_usd as auto_convert_source_amount_usd,
        sc.target_currency as auto_convert_target_currency,
        sc.target_amount as auto_convert_target_amount,
        sc.settlement_chain as auto_convert_settlement_chain,
        sc.conversion_rate as auto_convert_rate,
        sc.completed_at as auto_convert_completed_at
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id=ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id=c.company_id
      LEFT JOIN tbl_user_wallet uw ON uw.wallet_id=ut.wallet_id
      LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id=ut.transaction_id
      WHERE ${whereConditions}
      ORDER BY ${sort.safeColumn} ${sort.safeSortType}`;
    if (sort.offset !== undefined && sort.limit) {
      txQuery += ` OFFSET :offset LIMIT :limit`;
      replacements.offset = sort.offset;
      replacements.limit = sort.limit;
    }
    const tempData = await sequelize.query(txQuery, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Get total count for pagination (parameterized)
    const countData = await sequelize.query(
      `
      SELECT COUNT(*) as total
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id=ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id=c.company_id
      WHERE ${whereConditions}
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    const customer_data = await Promise.all(tempData.map(async (x: Record<string, unknown>) => {
      const {
        wallet_id,
        auto_convert_id,
        auto_convert_status,
        auto_convert_source_currency,
        auto_convert_source_amount,
        auto_convert_source_amount_usd,
        auto_convert_target_currency,
        auto_convert_target_amount,
        auto_convert_settlement_chain,
        auto_convert_rate,
        auto_convert_completed_at,
        ...rest
      } = x;

      // Use stored usd_value from transaction time (historical value, not current conversion)
      // This preserves the value at the time of receipt
      let usd_value: number | null = null;
      const storedUsdValue = Number(x.usd_value);
      if (storedUsdValue && storedUsdValue > 0) {
        // Use the value stored at transaction creation time
        usd_value = storedUsdValue;
      } else {
        // Fallback for legacy transactions without stored usd_value
        const baseCurrency = (x.base_currency as string || '').toUpperCase();
        const baseAmount = Number(x.base_amount) || 0;
        const stablecoins = ['USD', 'USDT', 'USDC', 'USDT-ERC20', 'USDT-TRC20', 'USDC-ERC20', 'BUSD', 'DAI'];
        if (stablecoins.some(s => baseCurrency.includes(s) || baseCurrency === s)) {
          usd_value = baseAmount;
        } else if (baseAmount > 0) {
          try {
            usd_value = await convertToUSD(baseCurrency, baseAmount);
          } catch {
            usd_value = null;
          }
        }
      }

      return {
        ...rest,
        // Format for UI
        transaction_id_display: x.id || `TX${x.transaction_id}`,
        crypto: x.crypto_currency || x.base_currency,
        amount: x.base_amount,
        usd_value: usd_value,
        date_time: x.createdAt,
        status: x.status,
        // Auto-stablecoin conversion indicator
        auto_converted: !!auto_convert_id,
        auto_convert: auto_convert_id
          ? {
              conversion_id: auto_convert_id,
              status: auto_convert_status,
              source_currency: auto_convert_source_currency,
              source_amount: auto_convert_source_amount ? Number(auto_convert_source_amount) : null,
              source_amount_usd: auto_convert_source_amount_usd ? Number(auto_convert_source_amount_usd) : null,
              target_currency: auto_convert_target_currency,
              target_amount: auto_convert_target_amount ? Number(auto_convert_target_amount) : null,
              settlement_chain: auto_convert_settlement_chain,
              conversion_rate: auto_convert_rate ? Number(auto_convert_rate) : null,
              completed_at: auto_convert_completed_at,
            }
          : null,
      };
    }));

    // Get self transactions with same filters
    let selfWhereClause: Record<string, unknown> = {
      user_id: userData.user_id,
    };
    
    if (date_from || date_to) {
      selfWhereClause.createdAt = {};
      if (date_from) selfWhereClause.createdAt[Op.gte] = new Date(date_from);
      if (date_to) selfWhereClause.createdAt[Op.lte] = new Date(date_to);
    }
    if (status) {
      selfWhereClause.status = status;
    }
    if (currency) {
      selfWhereClause.base_currency = currency;
    }
    if (search) {
      (selfWhereClause as Record<string, unknown>)[Op.or as unknown as string] = [
        { id: { [Op.iLike]: `%${search}%` } },
        { transaction_reference: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const selfData = await selfTransactionModel.findAll({
      attributes: { exclude: ["wallet_id", "transaction_id"] },
      where: selfWhereClause,
      ...(sort.column && sort.sortType && { order: [[sort.column, sort.sortType]] }),
      ...(sort.offset !== undefined && sort.limit && { offset: sort.offset, limit: sort.limit }),
    });

    const total = Number((countData[0] as Record<string, unknown> | undefined)?.total) || 0;
    const totalPages = sort.limit ? Math.ceil(total / sort.limit) : 1;

    const message = total === 0
      ? "No transactions found"
      : `Successfully retrieved ${total} transaction${total === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, {
      customers_transactions: customer_data,
      self_transactions: selfData,
      pagination: {
        total: total,
        page: page || 1,
        rowsPerPage: sort.limit || customer_data.length,
        totalPages
      }
    });
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const addFunds = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { data } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (data) {
      const value: IFundData = JSON.parse(decrypt(data));
      if (typeof value === "object") {
        let finalRes;
        if (value.paymentType === paymentTypes.CARD) {
          const { paymentRes, uniqueRef } = await cardPayment(value, userData);
          walletLogger.info(paymentRes);
          if (paymentRes.status !== "successful") {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };

            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem("flw-txt-" + uniqueRef, {
                hash: data,
                mode: paymentTypes.CARD,
              });
            } else {
              await setRedisItem("flw-txt-" + uniqueRef, {
                id: paymentRes.data.id,
                mode: paymentTypes.CARD,
              });
            }
          }
        }

        if (value.paymentType === paymentTypes.BANK_TRANSFER) {
          const { paymentRes, uniqueRef } = await bankTransfer(value, userData);
          walletLogger.info("paymentRes=============>", paymentRes, uniqueRef);
          const { transfer_reference, ...rest } = paymentRes.meta.authorization;
          finalRes = { hash: uniqueRef, ...rest };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.BANK_TRANSFER,
          });
        }

        if (value.paymentType === paymentTypes.USSD) {
          const { paymentRes, uniqueRef } = await USSD(value, userData);
          walletLogger.info("paymentRes=============>", paymentRes, uniqueRef);
          const ussdRes = paymentRes as { meta?: { authorization?: { note?: string } }; data?: { payment_code?: string } };
          const { note } = ussdRes.meta?.authorization || {};
          const { payment_code } = ussdRes.data || {};
          finalRes = { hash: uniqueRef, note, payment_code };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.USSD,
          });
        }

        if (value.paymentType === paymentTypes.MOBILE_MONEY) {
          const { paymentRes, uniqueRef } = await MobileMoney(value, userData);
          walletLogger.info("paymentRes=============>", paymentRes, uniqueRef);
          const mobileRes = paymentRes as { meta?: { authorization?: Record<string, unknown> } };
          if (value.currency === "KES") {
            finalRes = { hash: uniqueRef };
          } else {
            finalRes = { hash: uniqueRef, ...mobileRes?.meta?.authorization };
          }
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.MOBILE_MONEY,
          });
        }
        if (value.paymentType === paymentTypes.BANK_ACCOUNT) {
          const { paymentRes, uniqueRef } = await bankAccount(value, userData);
          walletLogger.info(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            (paymentRes as { data?: { meta?: unknown } }).data?.meta
          );
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.BANK_ACCOUNT,
          });
        }
        if (value.paymentType === paymentTypes.QR_CODE) {
          const { paymentRes, uniqueRef } = await QRCode(value, userData);
          walletLogger.info(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = { hash: uniqueRef, ...paymentRes?.meta?.authorization };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.QR_CODE,
          });
        }

        if (value.paymentType === paymentTypes.CRYPTO) {
          const { paymentRes, uniqueRef } = await Crypto(value, userData);
          walletLogger.info("paymentRes=============>", paymentRes, uniqueRef);
          finalRes = { hash: uniqueRef, ...paymentRes };
          await setRedisItem("crypto-" + paymentRes.address, {
            mode: paymentTypes.CRYPTO,
            amount: value.amount,
            status: toRedisStatus(PaymentState.PENDING),
            ref: uniqueRef,
            currency: value.currency,
            walletType: "user",
            temp_id: (paymentRes as { temp_id?: string }).temp_id,
            is_merchant_pool: (paymentRes as any).is_merchant_pool ? "true" : "false",  // Include merchant pool flag
          });
        }

        if (
          value.paymentType === paymentTypes.GOOGLE_PAY ||
          value.paymentType === paymentTypes.APPLE_PAY
        ) {
          const { paymentRes, uniqueRef } = await googleApplePay(
            value,
            userData
          );
          walletLogger.info(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem("flw-txt-" + uniqueRef, {
            mode: paymentTypes.GOOGLE_PAY,
          });
        }
        successResponseHelper(res, 200, "fund ", finalRes);
      } else {
        throw { message: "Please enter valid data!" };
      }
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
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
        const tempData = await getRedisItem("flw-txt-" + value.uniqueRef);

        await deleteRedisItem("flw-txt-" + value.uniqueRef);

        walletLogger.info("flw-txt-" + value.uniqueRef);
        if (value.mode === "otp") {
          const flw_ref = tempData?.flw_ref;
          const res = await flw.Charge.validate({
            otp: value.otp,
            flw_ref,
          });

          walletLogger.info(res);
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
          walletLogger.info(paymentRes);
          if (
            paymentRes.status !== "error" &&
            paymentRes.data?.status !== "successful"
          ) {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };
            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem("flw-txt-" + uniqueRef, {
                flw_ref: paymentRes.data.flw_ref,
              });
            } else {
              await setRedisItem("flw-txt-" + uniqueRef, {
                id: paymentRes.data.id,
              });
            }
          } else if (paymentRes.data?.status === "successful") {
            finalRes = {
              id: paymentRes.data.id,
              flwRef: paymentRes.data.flw_ref,
              status: paymentRes.data.status,
            };
            deleteRedisItem("flw-txt-" + uniqueRef);
          } else {
            finalRes = paymentRes;
          }
        }
      }

      successResponseHelper(res, 200, "fund ", finalRes);
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const verifyPayment = async (req: express.Request, res: express.Response) => {
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem("flw-txt-" + uniqueRef);

    let finalRes;
    walletLogger.info(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      // await deleteRedisItem("flw-txt-" + uniqueRef);
      const { data }: IVerifyResponse = await flw.Transaction.verify({
        id: transactionId,
      });
      walletLogger.info(data);
      finalRes = {
        txRef: uniqueRef,
      };
      successResponseHelper(res, 200, "transaction successful! ", finalRes);
    } else {
      errorResponseHelper(res, 500, "Transaction still in progress!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const confirmPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem("flw-txt-" + uniqueRef);

    walletLogger.info(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      if (tempData.mode !== paymentTypes.CRYPTO) {
        const { data }: IVerifyResponse = await flw.Transaction.verify({
          id: transactionId,
        });
        walletLogger.info(data);
        const walletData = await userWalletModel.findOne({
          where: {
            user_id: userData.user_id,
            wallet_type: data.currency,
          },
          transaction,
        });
        walletLogger.info(walletData);
        const transaction_fee = await getTransactionFee();
        const blockchain_fee = await getBlockchainFee();
        const platformCharge = (data.amount * Number(transaction_fee)) / 100;
        const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

        await incrementAdminFee(data.currency, platformCharge + blockchainCharge);

        const userSettledAmount = Number(
          data.amount_settled - platformCharge - blockchainCharge
        ).toFixed(2);

        await incrementUserWallet(walletData.dataValues.wallet_id, Number(userSettledAmount), transaction);

        const userPayload = {
          id: uniqueRef,
          wallet_id: walletData.dataValues.wallet_id,
          user_id: walletData.dataValues.user_id,
          payment_mode: tempData.mode,
          base_amount: userSettledAmount,
          base_currency: data.currency,
          transaction_reference: data.flw_ref,
          transaction_type: "CREDIT",
          status: data.status,
        };

        await selfTransactionModel.create({ ...userPayload }, { transaction });

        transaction.commit();
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
        };
        await deleteRedisItem(uniqueRef);
        successResponseHelper(res, 200, "transaction verified!", returnData);
      }
    } else {
      transaction.rollback();
      errorResponseHelper(
        res,
        500,
        "Transaction Not found! Please contact support"
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    walletLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { address } = req.body;

    const tempData = await getRedisItem("crypto-" + address);

    walletLogger.info(tempData, address);
    const transactionId = tempData?.txId;

    const adminWalletData = await adminWalletModel.findOne({
      where: {
        wallet_type: tempData.currency,
      },
    });

    const adminWalletAddress = getAdminWalletAddress(tempData.currency) || adminWalletData?.dataValues.wallet_address;

    if (!adminWalletAddress) {
      throw new Error(
        `Admin wallet address not configured for ${tempData.currency} in environment variables or database.`
      );
    }

    if (transactionId) {
      const walletData = await userWalletModel.findOne({
        where: {
          user_id: userData.user_id,
          wallet_type: tempData.currency,
          wallet_address: address,
        },
        transaction,
      });
      walletLogger.info(walletData);
      const transaction_fee = await getTransactionFee();
      const blockchain_fee = await getBlockchainFee();
      const receivedAmount = tempData?.receivedAmount ?? tempData?.amount;
      const platformCharge =
        (Number(receivedAmount) * Number(transaction_fee)) / 100;
      const blockchainCharge =
        (Number(receivedAmount) * Number(blockchain_fee)) / 100;
      const admin_wallet_id = adminWalletData.dataValues.wallet_account_id;
      walletLogger.info(
        "platformCharge=========>",
        admin_wallet_id,
        walletData.dataValues.wallet_account_id,
        platformCharge + blockchainCharge
      );
      // const ref = await tatumApi.sendFeeToAdmin(
      //   walletData.dataValues.wallet_account_id,
      //   admin_wallet_id,
      //   platformCharge
      // );

      await incrementAdminFee(tempData.currency, platformCharge + blockchainCharge);

      const userSettledAmount = Number(
        Number(receivedAmount) - platformCharge - blockchainCharge
      ).toFixed(8);

      walletLogger.info("settled amount", { userSettledAmount });

      let fees: unknown;
      let sendAmount: string | number = Number(receivedAmount);
      let transactionDetails;
      if (["USDT-TRC20", "USDT-ERC20"].indexOf(tempData.currency) === -1) {
        if (["BTC", "LTC", "DOGE"].indexOf(tempData.currency) !== -1) {
          fees = (
            await tatumApi.feeEstimation(
              tempData.currency,
              address,
              adminWalletAddress,
              Number(receivedAmount)
            )
          )?.slow;

          sendAmount = Number(
            Number(Number(receivedAmount) - Number(fees)).toFixed(8)
          );
        }

        if (["ETH", "BSC", "USDT-ERC20"].indexOf(tempData.currency) !== -1) {
          fees = await tatumApi.feeEstimation(
            tempData.currency,
            address,
            adminWalletAddress,
            Number(receivedAmount)
          ) as { slow?: string | number };

          sendAmount = Number(
            Number(receivedAmount) - Number((fees as { slow?: string | number })?.slow || 0)
          ).toFixed(8);
        }

        if (tempData.currency === "BCH") {
          fees = await tatumApi.feeEstimation(
            tempData.currency,
            "bitcoincash" + address,
            adminWalletAddress,
            Number(receivedAmount)
          ) as { slow?: string | number };
          sendAmount = (
            Number(receivedAmount) -
            Number((fees as { slow?: string | number })?.slow || 0) -
            0.00005
          ).toFixed(8);
        }

        walletLogger.info(fees);

        try {
          const fromUTXO = [],
            toUTXO = [];

          if (tempData.currency === "BCH") {
            const utxo = await blockchairApi.getBitcoinCashUTXO(address);

            for (let i = 0; i < utxo.length; i++) {
              if (utxo[i].value > 100000) {
                fromUTXO.push({
                  txHash: utxo[i]?.transaction_hash,
                  index: utxo[i]?.index,
                  privateKey: walletData.dataValues.privateKey,
                });
              }
            }
            toUTXO.push({
              address: adminWalletAddress,
              value: Number(sendAmount),
            });
          }
          const finalFees =
            ["ETH", "BSC", "USDT-ERC20"].indexOf(tempData.currency) !== -1
              ? fees
              : (fees as { slow?: string | number })?.slow;

          transactionDetails = await tatumApi.assetToOtherAddress({
            currency: tempData.currency,
            fromAddress: address,
            toAddress: adminWalletAddress,
            privateKey: walletData.dataValues.privateKey,
            amount: sendAmount,
            fee: finalFees,
            fromUTXO,
            toUTXO,
          });

          walletLogger.info(transactionDetails);
        } catch (e) {
          walletLogger.info(e);
          const message = getErrorMessage(e);
          walletLogger.error(message, new Error(e));
        }
      }
      await incrementUserWallet(walletData.dataValues.wallet_id, Number(userSettledAmount), transaction);

      const userPayload = {
        id: tempData.ref,
        wallet_id: walletData.dataValues.wallet_id,
        user_id: walletData.dataValues.user_id,
        payment_mode: tempData.mode,
        base_amount: userSettledAmount,
        base_currency: tempData.currency,
        transaction_reference: transactionId,
        transaction_type: "CREDIT",
        status: tempData.status,
      };

      await selfTransactionModel.create({ ...userPayload }, { transaction });

      transaction.commit();
      const returnData = {
        transaction_reference: transactionId,
        status: tempData.status,
      };
      await deleteRedisItem("crypto-" + address);
      successResponseHelper(res, 200, "transaction verified!", returnData);
    } else {
      errorResponseHelper(res, 500, "We did not received the payment!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const cardPayment = async (
  data: IFundData,
  tokenData: IUserType,
  revalidate = false
) => {
  const expiry = data.expiry.split("/");
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  walletLogger.info("from card=============>", data);
  const payload = {
    card_number: data.number,
    expiry_month: expiry[0],
    expiry_year: expiry[1],
    cvv: data.cvc,
    currency: data.currency ?? "USD",
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    enckey: process.env.FLW_ENCRYPTION_KEY,
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
    redirect_url: `${process.env.FRONTEND_URL || process.env.REACT_APP_FRONTEND_URL || ''}/payment/verify`,
  };

  walletLogger.info("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.card(payload);

  return { paymentRes, uniqueRef };
};

const bankTransfer = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  walletLogger.info("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.bank_transfer(payload);

  return { paymentRes, uniqueRef };
};

const bankAccount = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  walletLogger.info("payload==========>", payload);

  let paymentRes: FW_API_Response;

  if (payload.currency === "NGN") {
    paymentRes = await flw.Charge.ng(payload);
  } else {
    paymentRes = await axios.post(
      "https://api.flutterwave.com/v3/charges?type=account-ach-uk",
      {
        ...payload,
        is_token_io: 1,
      },
      {
        headers: {
          Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
        },
      }
    );
  }

  return { paymentRes, uniqueRef };
};

const googleApplePay = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef + "_success_mock",
  };

  walletLogger.info("payload==========>", payload);

  const type =
    data.paymentType === paymentTypes.GOOGLE_PAY ? "googlepay" : "applepay";

  const response = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=" + type,
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
      },
    }
  );
  const paymentRes = response.data;

  return { paymentRes, uniqueRef };
};

const USSD = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: "NGN",
    account_bank: data.account_number,
    amount: 200,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  walletLogger.info("payload==========>", payload);

  const paymentRes = await flw.Charge.ussd(payload);

  return { paymentRes, uniqueRef };
};

const MobileMoney = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  walletLogger.info(tokenData);
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
    phone_number: data.mobile,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    ...(data.currency !== "KES" && {
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/verify`,
    }),
  };

  walletLogger.info("payload==========>", payload);
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
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: "NGN",
    amount: 200,
    email: tokenData.email,
    phone_number: tokenData.mobile,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    is_nqr: "1",
  };

  walletLogger.info("payload==========>", payload);

  const resData = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=qr",
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
      },
    }
  );

  const paymentRes = resData.data;

  return { paymentRes, uniqueRef };
};

const getCurrencyRates = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { source, amount, currencyList, fixedDecimal = true } = req.body;

    const currencyRateList = await convertToMultiple(source, currencyList, amount, fixedDecimal);

    successResponseHelper(res, 200, "Currency rates retrieved successfully", currencyRateList);
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const Crypto = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const currency = data.currency;
  const walletDetails = await (
    await userWalletModel.findOne({
      where: {
        wallet_type: currency,
        user_id: tokenData.user_id,
      },
    })
  ).dataValues;
  let cryptoData = walletDetails.wallet_address;
  if (currency === "BCH") {
    cryptoData = walletDetails.wallet_address.split(":")[1];
    walletLogger.info(cryptoData);
  }
  let qr_code;

  if (cryptoData) {
    qr_code = await generateQRCodeWithLogo(cryptoData, currency, 400);
  }

  const paymentRes = { qr_code, address: cryptoData };

  return { paymentRes, uniqueRef };
};

const sendConfirmationOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { address, amount, currency } = req.body;
    const email = userData.email;
    const isExists = await userModel
      .findOne({
        where: {
          email,
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);
    if (isExists) {
      const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
      const maskAddr = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : address;
      await sendWithdrawalOTPEmail(
        email,
        userData.name,
        String(randomNumberOTP),
        String(amount),
        String(currency),
        maskAddr(address)
      );

      await setRedisItem(email + "-withdrawal-otp", {
        otp: randomNumberOTP.toString(),
        expiresAt: new Date().getTime() + 5 * 60 * 1000,
      });

      successResponseHelper(res, 200, "OTP sent successfully!");
    } else {
      errorResponseHelper(res, 404, "Please enter a registered email!");
    }
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getTempAddressBatches = async (
  user_id: number,
  currency: string,
  sendAmount: number,
  address: string,
  fees: number
) => {
  // Step 1: Fetch all temporary addresses and paremanent user address for the user in descending order
  const userWallet = await userWalletModel.findOne({
    where: {
      user_id: user_id,
      wallet_type: currency,
    },
  });

  let addressBalance;

  if (currency === "TRX") {
    addressBalance = tatumApi.validateTronAddress(address);
  } else {
    addressBalance = await tatumApi.getAddressBalance(
      userWallet.dataValues?.wallet_address,
      userWallet.dataValues?.wallet_type
    );
  }

  walletLogger.info("####addressBalance", addressBalance);

  let tempAddresses = await userTempAddressModel.findAll({
    where: {
      user_id: user_id,
      wallet_type: currency,
      amount: {
        [Op.gt]: 0,
      },
    },
    order: [["amount", "DESC"]],
  });

  let tempAddressBalances = [];

  if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
    const tempData: Record<string, unknown> = {
      dataValues: {
        ...userWallet.dataValues,
        amount: Number(addressBalance?.balance),
      },
    };
    tempAddressBalances.push(tempData);
  } else if (addressBalance?.incoming && addressBalance?.outgoing) {
    const amount =
      Number(addressBalance?.incoming) - Number(addressBalance?.outgoing);
    walletLogger.info("amount============>", amount);
    if (amount > 0) {
      const tempData: Record<string, unknown> = {
        dataValues: {
          ...userWallet.dataValues,
          amount,
        },
      };
      tempAddressBalances.push(tempData);
    }
  }
  walletLogger.info("###tempAddressBalances", tempAddressBalances);
  if (["USDT-TRC20", "USDT-ERC20", "ETH", "TRX"].indexOf(currency) === -1) {
    for (let address of tempAddresses) {
      if (currency === "TRX") {
        addressBalance = tatumApi.validateTronAddress(
          address.dataValues.wallet_address
        );
      } else {
        addressBalance = await tatumApi.getAddressBalance(
          address.dataValues?.wallet_address,
          address.dataValues?.wallet_type
        );
      }

      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        const tempData: Record<string, unknown> = {
          dataValues: {
            ...address.dataValues,
            amount: Number(addressBalance?.balance),
          },
        };
        tempAddressBalances.push(tempData);
      } else if (addressBalance?.incoming && addressBalance?.outgoing) {
        const amount =
          Number(addressBalance?.incoming) - Number(addressBalance?.outgoing);
        walletLogger.info("amount============>", amount);
        if (amount > 0) {
          const tempData: Record<string, unknown> = {
            dataValues: {
              ...address.dataValues,
              amount,
            },
          };
          tempAddressBalances.push(tempData);
        }
      }
    }
  }

  // Step 2: Combine user wallet and temporary addresses
  const allUserAddress = [...tempAddressBalances].sort(
    (a, b) => b.dataValues.amount - a.dataValues.amount
  );
  walletLogger.info(
    "###allUserAddress",
    allUserAddress.map((a) => ({
      amount: a.dataValues.amount,
      address: a.dataValues.wallet_address,
    }))
  );

  // Step 3: Calculate the total amount available in all addresses
  let totalTempAmount = allUserAddress.reduce(
    (acc, addr) => acc + addr.dataValues.amount,
    0
  );
  walletLogger.info("###totalTempAmount=======>", { totalTempAmount, sendAmount });

  // Step 4: Check if the total amount is sufficient for the withdrawal
  if (totalTempAmount < sendAmount) {
    throw { message: "Insufficient funds!" };
  }

  // Step 5: Create batches from temporary addresses to the user-provided address
  let remainingAmountToSend = sendAmount;
  let fromAddress = [],
    toAddress = [];
  for (let address of allUserAddress) {
    if (remainingAmountToSend <= 0) break;
    let transferAmount = Math.min(
      address.dataValues.amount,
      remainingAmountToSend
    );
    fromAddress.push({
      address: address.dataValues.wallet_address,
      privateKey: decrypt(address.dataValues.privateKey),
      value: transferAmount,
    });

    remainingAmountToSend -= transferAmount;
  }
  toAddress.push({
    address: address,
    value: sendAmount,
  });
  const singleFee = Number(fees) / fromAddress.length;
  fromAddress = fromAddress.map((address) => ({
    ...address,
    value: Number(address.value) - singleFee,
  }));

  const totalSendAmount = sendAmount;
  return {
    fromAddress,
    toAddress,
    totalSendAmount,
    permanentUserWalletAddress: userWallet.dataValues.wallet_address,
    tempAddresses,
    userWallet,
  };
};

const withdrawAssets = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { currency, amount, address, feeType, feeToPay, otp, saveAddress } =
      req.body;
    walletLogger.info(req.body);
    const storedOtp = await getRedisItem(userData.email + "-withdrawal-otp");
    walletLogger.info(storedOtp);
    if (storedOtp.otp != otp) {
      errorResponseHelper(res, 500, "OTP did not match!");
    } else {
      if (new Date().getTime() > Number(storedOtp?.expiresAt)) {
        throw { message: "OTP expired!" };
      }

      const walletData = await userWalletModel.findOne({
        where: {
          user_id: userData.user_id,
          wallet_type: currency,
        },
      });

      let fees = feeToPay,
        sendAmount: number =
          feeType === "wallet"
            ? amount
            : walletData?.dataValues.wallet_type.includes("USDT")
              ? Number(amount - feeToPay).toFixed(2)
              : amount - feeToPay;

      // Fetch Transaction Information
      const {
        fromAddress,
        toAddress,
        totalSendAmount,
        permanentUserWalletAddress,
        tempAddresses,
        userWallet,
      } = await getTempAddressBatches(
        userData.user_id,
        currency,
        sendAmount,
        address,
        fees
      );

      if (
        ["ETH", "BSC", "USDT-ERC20"].indexOf(
          walletData?.dataValues.wallet_type
        ) !== -1
      ) {
        const tempFees = await tatumApi.batchFeeEstimation({
          currency,
          fromAddresses: fromAddress,
          toAddresses: toAddress,
          amount: totalSendAmount,
          totalAddress: fromAddress.length,
        });

        fees = { gasPrice: tempFees?.gasPrice, gasLimit: tempFees?.gasLimit };
      }

      const fromUTXO = [],
        toUTXO = [];

      if (walletData?.dataValues.wallet_type === "BCH") {
        for (let j = 0; j < fromAddress.length; j++) {
          const utxo = await blockchairApi.getBitcoinCashUTXO(
            fromAddress[j].address
          );

          utxo.sort((a, b) => b.value - a.value);

          let tempAmount = 0;

          for (let i = 0; i < utxo.length; i++) {
            if (tempAmount < amount) {
              fromUTXO.push({
                txHash: utxo[i]?.transaction_hash,
                index: utxo[i]?.index,
                privateKey: fromAddress[j].privateKey,
              });
              tempAmount += utxo[i].value / 100000000;
            }
          }

          toUTXO.push({
            address: address.includes("bitcoincash")
              ? address
              : "bitcoincash:" + address,
            value: Number(sendAmount),
          });
        }
      }

      // Transfer assets from temporary addresses to the user's address
      const transactionDetails =
        await tatumApi.assetBatchAddressesToOtherAddress({
          currency: currency,
          fromAddress: fromAddress,
          toAddress: toAddress,
          fee: fees,
          permanentUserWalletAddress,
          fromUTXO,
          toUTXO,
        });

      walletLogger.info("###transactionDetails", transactionDetails);

      // if (transactionDetails) {
      //   // Step 5: Deduct the amount from temporary addresses and user's wallet
      //   for (let address of fromAddress) {

      //     // Fetch the current amount
      //     const tempAddr = tempAddresses.find(tmpaddress => tmpaddress.dataValues.wallet_address === address.address);
      //     const newAmount = tempAddr.dataValues.amount - address.value;

      //     if (tempAddr) {
      //       // Update the amount
      //       await userTempAddressModel.update(
      //         { amount: newAmount },
      //         { where: { temp_id: tempAddr.dataValues.temp_id } }
      //       );
      //     }
      //   }
      //   await userWalletModel.decrement("amount", {
      //     by:
      //       feeType === "wallet"
      //         ? Number(amount) + Number(feeToPay)
      //         : Number(amount),
      //     where: {
      //       wallet_id: userWallet.dataValues.wallet_id,
      //     },
      //   });
      // }

      let transactionIds = [];

      if (transactionDetails) {
        // Step 5: Deduct the amount from temporary addresses and user's wallet
        for (let transaction of transactionDetails) {
          if (transaction.status !== "failed") {
            const address = fromAddress.find(
              (addr) => addr.address === transaction.fromAddress.address
            );
            if (address) {
              if (!walletData.dataValues.wallet_address === address.address) {
                const tempAddr = tempAddresses.find(
                  (tmpaddress) =>
                    tmpaddress.dataValues.wallet_address === address.address
                );
                const newAmount = tempAddr.dataValues.amount - address.value;

                if (tempAddr) {
                  // Update the amount
                  await userTempAddressModel.update(
                    { amount: newAmount },
                    { where: { temp_id: tempAddr.dataValues.temp_id } }
                  );
                }
              }
            }
            if (transactionIds.length > 0) {
              const index = transactionIds.findIndex(
                (x) => x?.txId === transaction?.txId
              );
              if (index === -1) {
                transactionIds.push({
                  txId: transaction?.txId,
                  status: "success",
                  reason: null,
                });
              }
            } else {
              transactionIds.push({
                txId: transaction?.txId,
                status: "success",
                reason: null,
              });
            }
          }
        }

        // Deduct the total amount from the user's wallet based on successful transactions
        const totalAmountToDeduct = transactionDetails.reduce(
          (acc, transaction) => {
            return transaction.status !== "failed"
              ? acc + Number(transaction.fromAddress.value)
              : acc;
          },
          0
        );

        await userWalletModel.decrement("amount", {
          by:
            feeType === "wallet"
              ? totalAmountToDeduct + Number(feeToPay)
              : totalAmountToDeduct,
          where: {
            wallet_id: userWallet.dataValues.wallet_id,
          },
        });
      } else {
        throw { message: "Transaction did not proceed!" };
      }

      // let transactionRefrenceIds = "";
      // if (Array.isArray(transactionDetails)) {
      //   transactionDetails.forEach((element) => {
      //     transactionRefrenceIds += element.txId + ",";
      //   });
      // } else {
      //   transactionRefrenceIds = transactionDetails?.txId;
      // }
      // Prepare transaction reference IDs
      let transactionRefrenceIds = transactionIds[0]?.txId;

      const userPayload = {
        id: crypto.randomUUID(),
        wallet_id: walletData.dataValues.wallet_id,
        user_id: walletData.dataValues.user_id,
        payment_mode: "CRYPTO",
        base_amount: amount,
        base_currency: currency,
        transaction_reference: transactionRefrenceIds,
        transaction_type: "DEBIT",
        status: "success",
      };
      walletLogger.info(userPayload);

      await selfTransactionModel.create({ ...userPayload });
      if (saveAddress) {
        const isExists = await userWalletAddressModel
          .findOne({
            where: {
              wallet_address: address,
              currency,
            },
          })
          .then((token) => token !== null)
          .then((isExists) => isExists);

        if (!isExists) {
          await userWalletAddressModel.create({
            wallet_address: address,
            currency,
            label: currency,
            user_id: userData.user_id,
            wallet_name: generateWalletName(),
          });
        }
      }
      await deleteRedisItem(userData.email + "-withdrawal-otp");
      const maskAddr2 = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : address;
      await sendWithdrawalSuccessEmail(
        userData.email,
        userData.name,
        String(amount),
        String(currency),
        maskAddr2(address),
        String(transactionRefrenceIds)
      );
      successResponseHelper(res, 200, "Amount withdrawed!", transactionIds);
    }
  } catch (e) {
    walletLogger.info("###Error: ", e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getWalletAddresses = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const { company_id } = req.query;
    
    // Build where clause with optional company_id filter
    const whereClause: Record<string, unknown> = {
      user_id,
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    const resData = await userWalletAddressModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });
    const message = resData.length === 0
      ? "No wallet addresses found. Add your first wallet address to start receiving payments."
      : `Successfully retrieved ${resData.length} wallet address${resData.length === 1 ? '' : 'es'}`;
    
    successResponseHelper(res, 200, message, resData);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const addWalletAddress = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_address, currency, label, company_id, wallet_name } = req.body;
    try {
      const user_id = userData.user_id;

      // Local address validation - no external API calls needed
      let isValidAddress = false;
      
      // Map Dynopay currency codes to wallet-address-validator currency codes
      const currencyMap = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT-ERC20': 'ethereum', // ERC20 uses Ethereum address format
        'TRX': 'tron',
        'USDT-TRC20': 'tron', // TRC20 uses Tron address format
        'LTC': 'litecoin',
        'DOGE': 'dogecoin',
        'BSC': 'ethereum', // BSC uses Ethereum address format
        'BCH': 'bitcoincash',
      };

      const validatorCurrency = currencyMap[currency];
      
      if (validatorCurrency) {
        isValidAddress = WAValidator.validate(wallet_address, validatorCurrency);
      } else {
        // If currency not in map, throw error
        throw new Error(`Unsupported currency: ${currency}`);
      }

      if (!isValidAddress) {
        throw new Error('Invalid address format');
      }
      
      // Check if address already exists for this user and company
      const whereClause: Record<string, unknown> = {
        wallet_address,
        currency,
        user_id,
      };
      
      if (company_id) {
        whereClause.company_id = company_id;
      }

      const isExists = await userWalletAddressModel
        .findOne({
          where: whereClause,
        })
        .then((token) => token !== null)
        .then((isExists) => isExists);

      if (isExists) {
        errorResponseHelper(
          res,
          500,
          `This address with ${currency} currency already exists for this company!`
        );
      } else {
        const resData = await userWalletAddressModel.create({
          wallet_address,
          currency,
          label: label ?? currency,
          user_id,
          company_id: company_id || null,
          wallet_name: wallet_name || label || generateWalletName(),
        });
        
        // Also create/update entry in userWalletModel so it appears on dashboard and wallet page
        const existingWallet = await userWalletModel.findOne({
          where: {
            user_id,
            company_id: company_id || null,
            wallet_type: currency,
          },
        });
        
        if (!existingWallet) {
          await userWalletModel.create({
            user_id,
            company_id: company_id || null,
            wallet_name: wallet_name || label || generateWalletName(),
            amount: 0,
            wallet_type: currency,
            wallet_address,
            currency_type: 'CRYPTO',
          });
          walletLogger.info(`[addWalletAddress] Created wallet entry for ${currency} in userWalletModel for user ${user_id}, company ${company_id}`);
        } else {
          // Update the wallet address if wallet entry already exists
          await userWalletModel.update(
            { wallet_address, wallet_name: wallet_name || existingWallet.dataValues.wallet_name },
            { where: { wallet_id: existingWallet.dataValues.wallet_id } }
          );
          walletLogger.info(`[addWalletAddress] Updated wallet entry for ${currency} in userWalletModel for user ${user_id}, company ${company_id}`);
        }
        
        // Invalidate wallet cache so getWallet returns fresh data
        await invalidateWalletCache(userData.user_id);
        
        successResponseHelper(res, 200, "Address added successfully!", resData);
      }
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

const exchangeCreate = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      mobile,
      email,
      customer_id,
      username,
      identifier,
      wallet_address,
      req_currency,
      exchange_currency,
      amount_in_usd,
    } = req.body;

    let where, secondUser;
    if (identifier !== "WALLET_ADDRESS") {
      if (identifier === "MOBILE") {
        where = {
          mobile,
        };
      } else if (identifier === "EMAIL") {
        where = {
          email,
        };
      } else if (identifier === "USERNAME") {
        where = {
          username,
        };
      } else if (identifier === "CUSTOMER_ID") {
        where = {
          customer_id,
        };
      }
      walletLogger.info(
        "secondUser=============>",
        mobile,
        email,
        customer_id,
        username
      );
      secondUser = await userModel.findOne({
        where,
      });
    } else {
      const tempUser = await userWalletModel.findOne({
        where: {
          wallet_type: exchange_currency,
          wallet_address,
        },
      });
      if (tempUser) {
        secondUser = await userModel.findOne({
          where: {
            user_id: tempUser.dataValues.user_id,
          },
        });
      } else {
        errorResponseHelper(res, 404, "user not found!");
        return;
      }
    }
    if (secondUser) {
      if (secondUser?.dataValues.user_id === userData.user_id) {
        errorResponseHelper(
          res,
          400,
          "please check provided details as user can not exchange with their own account!"
        );
      } else {
        const user1Wallet = await userWalletModel.findOne({
          where: {
            user_id: userData.user_id,
            wallet_type: exchange_currency,
          },
        });

        const user2Wallet = await userWalletModel.findOne({
          where: {
            user_id: secondUser?.dataValues.user_id,
            wallet_type: req_currency,
          },
        });

        const wallet1_usd = await convertToUSD(user1Wallet.dataValues.wallet_type, user1Wallet.dataValues.amount);
        const wallet1_balance = [{ amount: wallet1_usd }];

        const wallet2_usd = await convertToUSD(user2Wallet.dataValues.wallet_type, user2Wallet.dataValues.amount);
        const wallet2_balance = [{ amount: wallet2_usd }];

        walletLogger.info("wallet_1", wallet1_balance, "wallet_2", wallet2_balance);

        if (wallet1_balance[0].amount < amount_in_usd) {
          errorResponseHelper(
            res,
            500,
            `balance in your ${exchange_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`
          );
          return;
        } else if (wallet2_balance[0].amount < amount_in_usd) {
          errorResponseHelper(
            res,
            500,
            `balance in ${secondUser?.dataValues?.name}'s ${req_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`
          );
          return;
        }

        const randomNumberOTP1 = Math.floor(100000 + Math.random() * 900000);
        const randomNumberOTP2 = Math.floor(100000 + Math.random() * 900000);
        await sendExchangeOTPEmail(
          userData.email,
          userData.name,
          String(randomNumberOTP1),
          String(amount_in_usd),
          String(exchange_currency),
          String(req_currency),
          secondUser?.dataValues?.name || "another user"
        );

        await sendExchangeOTPEmail(
          secondUser?.dataValues.email,
          secondUser?.dataValues.name,
          String(randomNumberOTP2),
          String(amount_in_usd),
          String(req_currency),
          String(exchange_currency),
          userData.name
        );
        const id = crypto.randomUUID();
        const expiresAt = new Date().getTime() + 5 * 60 * 1000;
        const payload = {
          transaction_id: id,
          user2_id: secondUser?.dataValues.user_id,
          user2_name: secondUser?.dataValues.name,
          req_currency,
          exchange_currency,
          amount_in_usd,
          otp1: randomNumberOTP1,
          otp2: randomNumberOTP2,
          expiresAt,
        };

        await userExchangeModel.create({
          transaction_id: id,
          user1_id: userData.user_id,
          user2_id: secondUser?.dataValues.user_id,
          req_currency,
          exchange_currency,
          amount_in_usd,
          expiresAt,
        });

        await setRedisItem("exchange-" + payload.transaction_id, payload);

        successResponseHelper(res, 200, "Exchange create successfully!", {
          transaction_id: id,
        });
      }
    } else {
      errorResponseHelper(res, 404, "user not found!");
    }
  } catch (e) {
    walletLogger.info(e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getExchange = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const resData = await sequelize.query(
      `
      select ux.*,u1.email as user1_email, u2.email as user2_email, 
      u1.name as user1_name,u2.name as user2_name
      from tbl_user_exchange ux 
      join tbl_user u1 on ux.user1_id=u1.user_id 
      join tbl_user u2 on ux.user2_id=u2.user_id 
      where ux.user1_id=${userData.user_id} or ux.user2_id=${userData.user_id}
      `,
      { type: QueryTypes.SELECT }
    );
    successResponseHelper(res, 200, "Exchange fetched successfully!", resData);
  } catch (e) {
    walletLogger.info(e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const confirmExchange = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { otp1, otp2, id } = req.body;
    const data = await getRedisItem("exchange-" + id);
    if (data) {
      if (new Date().getTime() > Number(data.expiresAt)) {
        await userExchangeModel.update(
          {
            status: "expired",
          },
          {
            where: {
              transaction_id: id,
            },
          }
        );

        throw {
          message: "This exchange is expired, please create a new exchange.",
          ignore: true,
        };
      } else {
        const {
          exchange_currency,
          req_currency,
          amount_in_usd,
          user2_id,
          user2_name,
        } = data;

        if (otp1 == data.otp1 && otp2 == data.otp2) {
          const user1_exchange_wallet = await userWalletModel.findOne({
            where: {
              user_id: userData.user_id,
              wallet_type: exchange_currency,
            },
          });
          const user1_request_wallet = await userWalletModel.findOne({
            where: {
              user_id: userData.user_id,
              wallet_type: req_currency,
            },
          });

          const user2_request_wallet = await userWalletModel.findOne({
            where: {
              user_id: user2_id,
              wallet_type: exchange_currency,
            },
          });
          const user2_exchange_wallet = await userWalletModel.findOne({
            where: {
              user_id: user2_id,
              wallet_type: req_currency,
            },
          });

          const w1Result = await convertToFiat(user1_exchange_wallet.dataValues.wallet_type, 'USD', user1_exchange_wallet.dataValues.amount);
          const wallet1_balance = [{ amount: w1Result.amount, transferRate: w1Result.rate }];

          const w2Result = await convertToFiat(user2_exchange_wallet.dataValues.wallet_type, 'USD', user2_exchange_wallet.dataValues.amount);
          const wallet2_balance = [{ amount: w2Result.amount, transferRate: w2Result.rate }];

          walletLogger.info("wallet_1", wallet1_balance, "wallet_2", wallet2_balance);

          if (wallet1_balance[0].amount < Number(amount_in_usd)) {
            throw {
              message: `balance in your ${exchange_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`,
              ignore: true,
            };
          } else if (wallet2_balance[0].amount < Number(amount_in_usd)) {
            throw {
              message: `balance in ${user2_name}'s ${req_currency} wallet is not enough to make exchange of ${amount_in_usd}$.`,
              ignore: true,
            };
          }

          const decimal1 =
            user1_exchange_wallet.dataValues.currency_type === "FIAT" ? 2 : 8;
          const decimal2 =
            user2_exchange_wallet.dataValues.currency_type === "FIAT" ? 2 : 8;

          const req_amount = (
            Number(amount_in_usd) / wallet2_balance[0].transferRate
          ).toFixed(decimal2);

          const exchange_amount = (
            Number(amount_in_usd) / wallet1_balance[0].transferRate
          ).toFixed(decimal1);

          /**
           *
           * User 1 Wallet and transaction updates
           *
           */

          await userWalletModel.update(
            {
              amount:
                user1_request_wallet.dataValues.amount + Number(req_amount),
              wallet_type: req_currency,
            },
            {
              where: {
                wallet_id: user1_request_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user1Payload1 = {
            id: crypto.randomUUID(),
            wallet_id: user1_request_wallet.dataValues.wallet_id,
            user_id: userData.user_id,
            payment_mode: "CRYPTO",
            base_amount: req_amount,
            base_currency: req_currency,
            transaction_reference: id,
            transaction_type: "CREDIT",
            status: "success",
          };
          walletLogger.info(user1Payload1);

          await selfTransactionModel.create(
            { ...user1Payload1 },
            { transaction }
          );

          await userWalletModel.update(
            {
              amount:
                user1_exchange_wallet.dataValues.amount -
                Number(exchange_amount),
              wallet_type: exchange_currency,
            },
            {
              where: {
                wallet_id: user1_exchange_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user1Payload2 = {
            id: crypto.randomUUID(),
            wallet_id: user1_exchange_wallet.dataValues.wallet_id,
            user_id: userData.user_id,
            payment_mode: "CRYPTO",
            base_amount: exchange_amount,
            base_currency: exchange_currency,
            transaction_reference: id,
            transaction_type: "DEBIT",
            status: "success",
          };
          walletLogger.info(user1Payload2);

          await selfTransactionModel.create(
            { ...user1Payload2 },
            { transaction }
          );

          /**
           *
           * User 1 Wallet and transaction updates
           *
           */

          /**
           *
           * User 2 Wallet and transaction updates
           *
           */

          await userWalletModel.update(
            {
              amount:
                user2_request_wallet.dataValues.amount +
                Number(exchange_amount),
              wallet_type: exchange_currency,
            },
            {
              where: {
                wallet_id: user2_request_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user2Payload1 = {
            id: crypto.randomUUID(),
            wallet_id: user2_request_wallet.dataValues.wallet_id,
            user_id: user2_id,
            payment_mode: "CRYPTO",
            base_amount: exchange_amount,
            base_currency: exchange_currency,
            transaction_reference: id,
            transaction_type: "CREDIT",
            status: "success",
          };
          walletLogger.info(user2Payload1);

          await selfTransactionModel.create(
            { ...user2Payload1 },
            { transaction }
          );

          await userWalletModel.update(
            {
              amount:
                user2_exchange_wallet.dataValues.amount - Number(req_amount),
              wallet_type: req_currency,
            },
            {
              where: {
                wallet_id: user2_exchange_wallet.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const user2Payload2 = {
            id: crypto.randomUUID(),
            wallet_id: user2_exchange_wallet.dataValues.wallet_id,
            user_id: user2_id,
            payment_mode: "CRYPTO",
            base_amount: req_amount,
            base_currency: req_currency,
            transaction_reference: id,
            transaction_type: "DEBIT",
            status: "success",
          };
          walletLogger.info(user2Payload2);

          await selfTransactionModel.create(
            { ...user2Payload2 },
            { transaction }
          );

          /**
           *
           * User 1 Wallet and transaction updates
           *
           */

          await userExchangeModel.update(
            {
              status: "successful",
            },
            {
              where: {
                transaction_id: id,
              },
              transaction,
            }
          );
          await deleteRedisItem("exchange-" + id);
          transaction.commit();
          successResponseHelper(res, 200, "exchange completed successfully!", {
            transaction_id: id,
            status: "successful",
          });
        } else {
          throw {
            message: "OTP did not match!.",
            ignore: true,
          };
        }
      }
    } else {
      const exchangeData = await userExchangeModel.findOne({
        where: {
          transaction_id: id,
        },
      });
      if (exchangeData.dataValues) {
        await userExchangeModel.update(
          {
            status: "expired",
          },
          {
            where: {
              transaction_id: id,
            },
          }
        );
      }
      throw {
        message: "This exchange is expired, please create a new exchange.",
        ignore: true,
      };
    }
  } catch (e) {
    walletLogger.info(e);
    const message = getErrorMessage(e);
    transaction.rollback();
    if (!e?.ignore) {
      walletLogger.error(
        message,
        { user_id: userData.user_id, email: userData.email },
        new Error(e)
      );
    }
    errorResponseHelper(res, 500, message);
  }
};

const getUserAnalytics = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const {
      periodType,
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
      company_id,
    } = req.body;

    // Get company's preferred currency for analytics display
    const preferredCurrency = await getCompanyBaseCurrency(company_id);

    // Build company filter for SQL queries (both tbl_user_transaction and tbl_user_temp_address have company_id)
    const safeCompanyId = company_id ? parseInt(company_id) : null;
    const companyFilterSQL = safeCompanyId ? ` and ut.company_id=${safeCompanyId}` : '';

    const txWhere: any = { user_id: userData.user_id };
    if (company_id) txWhere.company_id = company_id;

    const totalTransactionsIncoming = (
      await userTransactionModel.findAndCountAll({
        where: txWhere,
      })
    ).count;

    const totalTransactionOutgoing = (
      await selfTransactionModel.findAndCountAll({
        where: {
          transaction_type: "DEBIT",
          user_id: userData.user_id,
        },
      })
    ).count;

    let where = "";
    const safeYear = parseInt(year) || new Date().getFullYear();
    const safeMonth = parseInt(month) || (new Date().getMonth() + 1);
    const safeUserId = Number(userData.user_id);
    if (periodType === "YEAR") {
      where = `where extract(year from ut."createdAt")=${safeYear} and ut.user_id=${safeUserId}${companyFilterSQL}`;
    } else if (periodType === "MONTH") {
      where = `where extract(year from ut."createdAt")=${safeYear} and extract(month from ut."createdAt")=${safeMonth} and ut.user_id=${safeUserId}${companyFilterSQL}`;
    } else {
      where = `where ut.user_id=${safeUserId}${companyFilterSQL}`;
    }

    const popularCurrency = await sequelize.query(
      `select aw.wallet_type,count(ut.base_currency) as transaction_count,aw.currency_type from tbl_admin_wallet aw 
      left join tbl_user_transaction ut on  aw.wallet_type=ut.base_currency
      ${where} group by ut.base_currency,aw.wallet_type,aw.currency_type order by transaction_count desc`,
      { type: QueryTypes.SELECT }
    );

    const paymentSuccessRates = await sequelize.query(
      `select count(*) filter (where status='successful') as successful_payments,
      count(*) filter (where status = 'failed') as failed_payments,
	  count(*) filter (where status = 'pending') as pending_payments
    from tbl_user_transaction ut ${where}`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const historicalTrends = {};

    const tempTrends: unknown[] = await sequelize.query(
      `select 
        to_char("createdAt", 'Month') as month_name,
		extract(month from "createdAt") as month,
        count(*) as invoice_count, 
        sum(base_amount) as amount,
		base_currency
      from tbl_user_transaction ut
      where ${where && `extract(year from ut."createdAt")=${safeYear} and`
      } ut.user_id=${safeUserId}${companyFilterSQL}
      group by month,month_name,base_currency 
      order by month`,
      {
        type: QueryTypes.SELECT,
      }
    );

    interface TempTrendItem {
      month_name: string;
      [key: string]: unknown;
    }

    for (let i = 0; i < tempTrends.length; i++) {
      const trendItem = tempTrends[i] as TempTrendItem;
      const keys = Object.keys(historicalTrends);
      if (keys.indexOf(trendItem.month_name) !== -1) {
        const { month_name, ...restData } = trendItem;
        const tempArray = [...(historicalTrends[month_name] || [])];
        historicalTrends[month_name] = [...tempArray, restData];
      } else {
        const { month_name, ...restData } = trendItem;
        historicalTrends[month_name] = [restData];
      }
    }

    const revenue_performance: Array<Record<string, unknown>> = [];
    const totalIncome = await sequelize.query<{ base_currency: string; amount: number }>(
      `select base_currency,sum(base_amount) as amount from tbl_user_transaction ut ${where} group by base_currency`,
      { type: QueryTypes.SELECT }
    );
    const totalFee = await sequelize.query<{ wallet_type: string; fee_amount: number }>(
      `
      select wallet_type,sum(blockchain_fee) as fee_amount from tbl_user_temp_address ut ${where} group by wallet_type
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    for (let i = 0; i < totalIncome.length; i++) {
      const feeIndex = totalFee.findIndex(
        (x) => x.wallet_type === totalIncome[i]?.base_currency
      );
      const fiatResult = await convertToFiat(totalIncome[i]?.base_currency, preferredCurrency, totalIncome[i].amount);
      const currencyData = [{ amount: fiatResult.amount, transferRate: fiatResult.rate }];
      const feeAmount = totalFee[feeIndex]?.fee_amount || 0;
      revenue_performance.push({
        ...totalIncome[i],
        amount_in_fiat: currencyData[0].amount,
        amount_in_usd: currencyData[0].amount, // backward compat
        display_currency: preferredCurrency,
        fee_amount: Number(feeAmount).toFixed(8),
        fee_in_fiat: Number(feeAmount * currencyData[0].transferRate).toFixed(2),
        fee_in_usd: Number(feeAmount * currencyData[0].transferRate).toFixed(2), // backward compat
      });
    }

    const returnData = {
      totalTransactionsIncoming,
      totalTransactionOutgoing,
      popularCurrency,
      paymentSuccessRates,
      historicalTrends,
      revenue_performance,
      display_currency: preferredCurrency,
    };

    successResponseHelper(res, 200, "Analytics data retrieved successfully", returnData);
  } catch (e) {
    walletLogger.info(e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

async function updateOtp(userData, wallet_address, currency) {
  const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
  
  // Use branded email template for OTP
  const { dynoPayEmailTemplate } = await import("../services/emailService");
  const otpContent = `
    <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">You are validating a new wallet address for <strong style="color: #1a1a2e;">${currency}</strong>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 24px 0;">
      <tr><td style="padding: 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Wallet Address</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">${wallet_address}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Currency</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right;">${currency}</td></tr>
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
    <p style="font-size: 14px; color: #6b7280; text-align: center; margin: 16px 0 0 0; font-family: 'Inter', Arial, sans-serif;">This code will expire in <strong>5 minutes</strong>.</p>`;

  const htmlBody = dynoPayEmailTemplate(
    "Wallet Verification Code",
    otpContent,
    false
  );

  await mailTransporter({
    to: userData.email,
    name: userData.name,
    subject: "OTP for Wallet Address Validation",
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


const validateWallet = async (
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
          email: userData.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
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

const verifyOtp = async (req: express.Request, res: express.Response) => {
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

    // AUTO-CREATE API KEY: If company doesn't have an active API key, create one in USD
    let autoApiKeyCreated = false;
    try {
      const existingApiKey = await apiModel.findOne({
        where: {
          company_id,
          status: 'active',
        },
      });

      if (!existingApiKey) {
        const defaultCurrency = 'USD';
        const keyData = {
          base_currency: defaultCurrency,
          company_id,
          adm_id: user_id,
          env: 'production',
        };
        const keyPrefix = 'dpk_live_';
        const keyString = keyPrefix + "DYNOPAY_USER_API-" + JSON.stringify(keyData);
        const apiKey = encrypt(keyString, process.env.API_SECRET);

        // Create customer for API key
        const companyName = companyData?.dataValues.company_name || 'Company';
        const companyEmail = companyData?.dataValues.email || userData.email;

        const createdCustomer = await customerModel.create({
          id: crypto.randomUUID(),
          customer_name: companyName + " admin",
          email: companyEmail,
          mobile: companyEmail,
          company_id: company_id,
        });

        await customerWalletModel.create({
          id: crypto.randomUUID(),
          customer_id: createdCustomer.dataValues.customer_id,
          wallet_type: defaultCurrency,
        });

        // Generate access token for the customer
        const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
        const customerAccessToken = jwt.sign(
          { customer_id: createdCustomer.dataValues.customer_id },
          accessTokenSecret,
          { expiresIn: '30d' }
        );

        // Generate admin token
        const adminTokenPayload = {
          api_id: null,
          company_id,
          user_id,
          type: 'admin_token',
          environment: 'production',
        };
        const adminToken = jwt.sign(adminTokenPayload, accessTokenSecret, { expiresIn: '30d' });

        const defaultPermissions = ["payments", "transactions", "webhooks", "wallets"];

        await apiModel.create({
          company_id,
          base_currency: defaultCurrency,
          apiKey,
          user_id,
          adminToken: customerAccessToken,
          admin_token: adminToken,
          withdrawal_whitelist: null,
          api_name: generateApiKeyName(),
          permissions: JSON.stringify(defaultPermissions),
          environment: 'production',
          status: 'active',
          test_mode_restrictions: null,
          request_count: 0,
          rate_limit_per_minute: 60,
          rate_limit_per_hour: 3600,
          rate_limit_per_day: 100000,
        });

        autoApiKeyCreated = true;
        walletLogger.info(`[verifyOtp] ✅ Auto-created USD API key for company ${company_id} after first wallet setup`);
      }
    } catch (apiKeyError) {
      // Log but don't fail wallet verification
      walletLogger.warn(`[verifyOtp] ⚠️ Auto API key creation skipped: ${getErrorMessage(apiKeyError)}`);
    }

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

const deleteWalletAddress = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // Support wallet_id from URL params (DELETE /wallet/:wallet_id) or body (POST /wallet/delete)
    const wallet_id_param = req.params.wallet_id;
    const { currency, company_id, wallet_id: wallet_id_body } = req.body;
    
    const wallet_id = wallet_id_param || wallet_id_body;
    
    // Support both wallet_id (preferred) and currency (legacy) methods
    if (!wallet_id && (!currency || typeof currency !== "string")) {
      return errorResponseHelper(res, 400, "Either wallet_id or currency is required!");
    }

    const user_id = userData.user_id;

    // Build where clause for deletion
    const whereClause: Record<string, unknown> = {
      user_id,
    };

    // Preferred method: Use wallet_id for precise deletion
    if (wallet_id) {
      whereClause.wallet_id = parseInt(wallet_id);
      
      // Add company_id for multi-tenant security
      if (company_id) {
        whereClause.company_id = company_id;
      }
    } 
    // Legacy method: Use currency (only works when one wallet per blockchain)
    else {
      whereClause.wallet_type = currency;
      
      // Add company_id if provided for multi-tenant security
      if (company_id) {
        whereClause.company_id = company_id;
      }
    }

    // First verify the wallet exists and belongs to the user
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet) {
      return errorResponseHelper(
        res, 
        404, 
        "Wallet address not found or you don't have permission to delete it"
      );
    }

    // Store wallet info for notification before clearing
    const deletedWalletAddress = wallet.dataValues.wallet_address;
    const deletedWalletType = wallet.dataValues.wallet_type;

    // Clear the wallet address (set to null) instead of deleting the record
    // This preserves the wallet structure for future use
    await userWalletModel.update(
      { 
        wallet_address: null,
        wallet_name: null,
        company_id: null,
      },
      {
        where: whereClause,
      }
    );

    // Send wallet deleted notification email
    if (deletedWalletAddress) {
      try {
        const { sendWalletDeletedEmail } = await import("../services/emailService");
        const now = new Date();
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const maskedAddress = deletedWalletAddress.substring(0, 8) + '...' + deletedWalletAddress.slice(-6);
        await sendWalletDeletedEmail(
          userData.email,
          userData.name || 'User',
          maskedAddress,
          deletedWalletType,
          date,
          time
        );
        walletLogger.info(`[Wallet] Deletion notification sent to ${userData.email} for ${deletedWalletType}`);
      } catch (emailError) {
        walletLogger.error("[Wallet] Failed to send deletion notification:", emailError);
      }
    }

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    return successResponseHelper(res, 200, "Wallet address removed successfully!", {
      removed: true,
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      company_id: wallet.dataValues.company_id,
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// UPDATE WALLET WITH OTP - Step 1: Send OTP
// ============================================
const sendUpdateWalletOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id } = req.body;

    if (!wallet_id) {
      return errorResponseHelper(res, 400, "wallet_id is required!");
    }

    const user_id = userData.user_id;

    // Build where clause with multi-tenant security
    const whereClause: Record<string, unknown> = {
      user_id,
      wallet_id: parseInt(wallet_id),
    };

    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Verify wallet exists and belongs to user
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet || !wallet.dataValues.wallet_address) {
      return errorResponseHelper(
        res,
        404,
        "Wallet address not found or you don't have permission to update it"
      );
    }

    // Generate and send OTP
    const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
    
    await userModel.update(
      {
        verified_otp: randomNumberOTP.toString(),
        otp_expired: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        otp_currency: wallet.dataValues.wallet_type, // Store currency for validation
      },
      {
        where: { user_id },
      }
    );

    // Send OTP email
    const maskWalletAddr = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : 'N/A';
    await sendWalletUpdateOTPEmail(
      userData.email,
      userData.name,
      String(randomNumberOTP),
      maskWalletAddr(wallet.dataValues.wallet_address),
      "Pending update",
      wallet.dataValues.wallet_type
    );

    walletLogger.info(
      `Update wallet OTP sent`,
      { user_id, wallet_id, email: userData.email }
    );

    return successResponseHelper(res, 200, "OTP sent to your email", {
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      current_address: wallet.dataValues.wallet_address,
      email: userData.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// UPDATE WALLET WITH OTP - Step 2: Verify and Update
// ============================================
const updateWalletWithOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id, otp, wallet_address, wallet_name, currency, destination_tag } = req.body;

    if (!wallet_id || !otp) {
      return errorResponseHelper(res, 400, "wallet_id and otp are required!");
    }

    if (!wallet_address && !wallet_name) {
      return errorResponseHelper(res, 400, "Provide wallet_address or wallet_name to update!");
    }

    const user_id = userData.user_id;

    // Verify OTP - ensure string comparison
    const otpString = String(otp).trim();
    
    const user = await userModel.findOne({
      where: { user_id, verified_otp: otpString },
    });

    if (!user) {
      walletLogger.warn(`Invalid OTP attempt`, { user_id, otp_provided: otpString });
      return errorResponseHelper(res, 400, "Invalid OTP!");
    }

    // Check OTP expiry
    if (new Date() > user.dataValues.otp_expired) {
      return errorResponseHelper(res, 400, "OTP has expired! Please request a new one.");
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {
      user_id,
      wallet_id: parseInt(wallet_id),
    };

    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Get existing wallet
    const existingWallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!existingWallet) {
      return errorResponseHelper(
        res,
        404,
        "Wallet not found or you don't have permission to update it"
      );
    }

    // If updating wallet address, validate it
    if (wallet_address) {
      const currencyToValidate = currency || existingWallet.dataValues.wallet_type;

      // Validate OTP currency matches if changing address
      if (user.dataValues.otp_currency && user.dataValues.otp_currency !== currencyToValidate) {
        return errorResponseHelper(
          res,
          400,
          `OTP was issued for ${user.dataValues.otp_currency} wallet, but you're trying to update ${currencyToValidate} wallet!`
        );
      }

      // Validate address format
      let balance;
      if (currencyToValidate === "TRX" || currencyToValidate === "USDT-TRC20") {
        balance = await tatumApi.validateTronAddress(wallet_address);
      } else {
        balance = await tatumApi.getAddressBalance(wallet_address, currencyToValidate);
      }

      if (!balance || balance.error) {
        return errorResponseHelper(res, 400, "Invalid wallet address for this blockchain!");
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (wallet_address) updateData.wallet_address = wallet_address;
    if (wallet_name) updateData.wallet_name = wallet_name;
    if (currency) updateData.wallet_type = currency;
    // Allow setting destination_tag (can be set to null to remove it)
    if (destination_tag !== undefined) {
      updateData.destination_tag = destination_tag ? Number(destination_tag) : null;
    }

    // Update wallet
    await userWalletModel.update(updateData, {
      where: whereClause,
    });

    // Clear OTP
    await userModel.update(
      {
        verified_otp: null,
        otp_expired: null,
        otp_currency: null,
      },
      {
        where: { user_id },
      }
    );

    walletLogger.info(
      `Wallet updated successfully`,
      { user_id, wallet_id, company_id }
    );

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    // Get updated wallet
    const updatedWallet = await userWalletModel.findOne({
      where: whereClause,
    });

    // Send confirmation email
    const companyData = await companyModel.findOne({
      where: { company_id }
    });
    
    const companyName = companyData?.dataValues.company_name || "Your Company";
    const maskAddress = (addr: string) => addr ? `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}` : 'N/A';
    
    await sendWalletUpdatedEmail(
      userData.email,
      userData.name,
      maskAddress(updatedWallet.dataValues.wallet_address),
      updatedWallet.dataValues.wallet_type,
      companyName,
      updatedWallet.dataValues.wallet_name || undefined
    );

    return successResponseHelper(res, 200, "Wallet address updated successfully!", {
      wallet_id: updatedWallet.dataValues.wallet_id,
      wallet_type: updatedWallet.dataValues.wallet_type,
      wallet_address: updatedWallet.dataValues.wallet_address,
      wallet_name: updatedWallet.dataValues.wallet_name,
      company_id: updatedWallet.dataValues.company_id,
      destination_tag: updatedWallet.dataValues.destination_tag || null,
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// DELETE WALLET WITH OTP - Step 1: Send OTP (For Payment Forwarding Wallets)
// ============================================
const sendDeletePaymentWalletOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id } = req.body;

    if (!wallet_id) {
      return errorResponseHelper(res, 400, "wallet_id is required!");
    }

    const user_id = userData.user_id;

    // Build where clause with multi-tenant security
    const whereClause: Record<string, unknown> = {
      user_id,
      wallet_id: parseInt(wallet_id),
    };

    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Verify wallet exists and belongs to user
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet || !wallet.dataValues.wallet_address) {
      return errorResponseHelper(
        res,
        404,
        "Wallet address not found or you don't have permission to delete it"
      );
    }

    // Generate and send OTP
    const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
    
    await userModel.update(
      {
        verified_otp: randomNumberOTP.toString(),
        otp_expired: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        otp_currency: wallet.dataValues.wallet_type, // Store currency for validation
      },
      {
        where: { user_id },
      }
    );

    // Send OTP email
    const maskDelAddr = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : 'N/A';
    await sendWalletDeleteOTPEmail(
      userData.email,
      userData.name,
      String(randomNumberOTP),
      maskDelAddr(wallet.dataValues.wallet_address),
      wallet.dataValues.wallet_type
    );

    walletLogger.info(
      `Delete wallet OTP sent`,
      { user_id, wallet_id, email: userData.email }
    );

    return successResponseHelper(res, 200, "OTP sent to your email", {
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      wallet_address: wallet.dataValues.wallet_address,
      email: userData.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      warning: "This action is permanent and cannot be undone",
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// DELETE WALLET WITH OTP - Step 2: Verify and Delete (For Payment Forwarding Wallets)
// ============================================
const deletePaymentWalletWithOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id, otp } = req.body;

    if (!wallet_id || !otp) {
      return errorResponseHelper(res, 400, "wallet_id and otp are required!");
    }

    const user_id = userData.user_id;

    // Verify OTP - ensure string comparison
    const otpString = String(otp).trim();
    
    const user = await userModel.findOne({
      where: { user_id, verified_otp: otpString },
    });

    if (!user) {
      walletLogger.warn(`Invalid OTP attempt`, { user_id, otp_provided: otpString });
      return errorResponseHelper(res, 400, "Invalid OTP!");
    }

    // Check OTP expiry
    if (new Date() > user.dataValues.otp_expired) {
      return errorResponseHelper(res, 400, "OTP has expired! Please request a new one.");
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {
      user_id,
      wallet_id: parseInt(wallet_id),
    };

    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Get wallet before deleting
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet) {
      return errorResponseHelper(
        res,
        404,
        "Wallet not found or you don't have permission to delete it"
      );
    }

    // Validate OTP currency matches
    if (user.dataValues.otp_currency && user.dataValues.otp_currency !== wallet.dataValues.wallet_type) {
      return errorResponseHelper(
        res,
        400,
        `OTP was issued for ${user.dataValues.otp_currency} wallet, but you're trying to delete ${wallet.dataValues.wallet_type} wallet!`
      );
    }

    // Soft delete: Clear wallet address
    await userWalletModel.update(
      {
        wallet_address: null,
        wallet_name: null,
        company_id: null,
      },
      {
        where: whereClause,
      }
    );

    // Clear OTP
    await userModel.update(
      {
        verified_otp: null,
        otp_expired: null,
        otp_currency: null,
      },
      {
        where: { user_id },
      }
    );

    walletLogger.info(
      `Wallet deleted successfully`,
      { user_id, wallet_id, company_id }
    );

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    // Send confirmation email
    const companyData = await companyModel.findOne({
      where: { company_id }
    });
    
    const companyName = companyData?.dataValues.company_name || "Your Company";
    const maskAddress = (addr: string) => `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
    
    await sendWalletDeletedEmail(
      userData.email,
      userData.name,
      maskAddress(wallet.dataValues.wallet_address),
      wallet.dataValues.wallet_type,
      new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    );

    return successResponseHelper(res, 200, "Wallet address removed successfully!", {
      removed: true,
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      company_id: wallet.dataValues.company_id,
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Send OTP for wallet address edit
 * POST /api/wallet/address/send-otp
 */
const sendEditWalletOTP = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { address_id } = req.body;
    const user_id = userData.user_id;

    if (!address_id) {
      return errorResponseHelper(res, 400, "address_id is required");
    }

    // Verify the wallet address belongs to the user
    const walletAddress = await userWalletAddressModel.findOne({
      where: {
        user_address_id: address_id,
        user_id,
      },
    });

    if (!walletAddress) {
      return errorResponseHelper(res, 404, "Wallet address not found");
    }

    // Get user email
    const user = await userModel.findOne({
      where: { user_id },
    });

    if (!user || !user.dataValues.email) {
      return errorResponseHelper(res, 400, "User email not found");
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in Redis with address_id as key
    await setRedisItem(`wallet_edit_otp_${address_id}`, {
      otp,
      user_id: user_id.toString(),
      expiry: otpExpiry.toISOString(),
    }); // TTL managed by Redis key expiry

    // Send OTP email
    const walletAddrDisplay = address_id ? `...${String(address_id).slice(-6)}` : 'your wallet';
    await sendWalletEditOTPEmail(
      user.dataValues.email,
      user.dataValues.name || "User",
      otp,
      walletAddrDisplay,
      "Crypto"
    );

    walletLogger.info(`Edit wallet OTP sent for address ${address_id} to user ${user_id}`);

    return successResponseHelper(res, 200, "OTP sent to your email", {
      address_id,
      email: user.dataValues.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Edit wallet address with OTP verification
 * PUT /api/wallet/address/:id
 */
const editWalletAddress = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { id } = req.params;
    const { wallet_address, wallet_name, otp } = req.body;
    const user_id = userData.user_id;

    if (!wallet_address && !wallet_name) {
      return errorResponseHelper(res, 400, "wallet_address or wallet_name is required");
    }

    // Verify the wallet address belongs to the user
    const existingAddress = await userWalletAddressModel.findOne({
      where: {
        user_address_id: id,
        user_id,
      },
    });

    if (!existingAddress) {
      return errorResponseHelper(res, 404, "Wallet address not found");
    }

    // Check if wallet_address is being changed (requires OTP)
    const isAddressChange = wallet_address && wallet_address !== existingAddress.dataValues.wallet_address;
    
    // OTP is only required when changing wallet_address, not for wallet_name updates
    if (isAddressChange) {
      if (!otp) {
        return errorResponseHelper(res, 400, "OTP is required to update wallet address. Request OTP first.");
      }

      // Verify OTP from Redis
      const storedOTPData = await getRedisItem(`wallet_edit_otp_${id}`);
      
      if (!storedOTPData || Object.keys(storedOTPData).length === 0) {
        return errorResponseHelper(res, 400, "OTP expired or not found. Please request a new one.");
      }

      const otpData = storedOTPData as { otp: string; user_id: string; expiry: string };
      
      if (otpData.otp !== otp) {
        return errorResponseHelper(res, 400, "Invalid OTP");
      }

      if (otpData.user_id !== user_id.toString()) {
        return errorResponseHelper(res, 403, "Unauthorized");
      }

      if (new Date(otpData.expiry) < new Date()) {
        await deleteRedisItem(`wallet_edit_otp_${id}`);
        return errorResponseHelper(res, 400, "OTP expired. Please request a new one.");
      }

      // Validate the new address
      const currency = existingAddress.dataValues.currency;
      try {
        if (currency === "TRX" || currency === "USDT-TRC20") {
          await tatumApi.validateTronAddress(wallet_address);
        } else {
          await tatumApi.getAddressBalance(wallet_address, currency);
        }
      } catch (e) {
        return errorResponseHelper(res, 400, `Invalid ${currency} address`);
      }

      // Delete OTP from Redis after successful validation
      await deleteRedisItem(`wallet_edit_otp_${id}`);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (wallet_address) updateData.wallet_address = wallet_address;
    if (wallet_name !== undefined) updateData.wallet_name = wallet_name;

    // Update the wallet address
    await userWalletAddressModel.update(updateData, {
      where: {
        user_address_id: id,
        user_id,
      },
    });

    // Also sync changes to userWalletModel so dashboard/wallet page reflects the update
    const currency = existingAddress.dataValues.currency;
    const oldAddress = existingAddress.dataValues.wallet_address;
    const walletModelWhere: Record<string, unknown> = {
      user_id,
      wallet_type: currency,
      wallet_address: oldAddress,
    };
    if (existingAddress.dataValues.company_id) {
      walletModelWhere.company_id = existingAddress.dataValues.company_id;
    }
    const walletModelUpdate: Record<string, unknown> = {};
    if (wallet_address) walletModelUpdate.wallet_address = wallet_address;
    if (wallet_name !== undefined) walletModelUpdate.wallet_name = wallet_name;
    if (Object.keys(walletModelUpdate).length > 0) {
      await userWalletModel.update(walletModelUpdate, { where: walletModelWhere });
    }

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    // Fetch updated record
    const updatedAddress = await userWalletAddressModel.findOne({
      where: { user_address_id: id },
    });

    const updateType = isAddressChange ? "address and name" : "name";
    walletLogger.info(`Wallet ${updateType} for ID ${id} edited by user ${user_id}`);

    return successResponseHelper(res, 200, "Wallet updated successfully", updatedAddress);

  } catch (e) {


      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Send OTP for wallet address deletion
 * POST /api/wallet/address/delete/send-otp
 */
const sendDeleteWalletOTP = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { address_id, company_id } = req.body;
    const user_id = userData.user_id;

    if (!address_id) {
      return errorResponseHelper(res, 400, "address_id is required");
    }

    // Build where clause for multi-tenancy
    const whereClause: Record<string, unknown> = {
      user_address_id: address_id,
      user_id,
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Verify the wallet address belongs to the user
    const walletAddress = await userWalletAddressModel.findOne({
      where: whereClause,
    });

    if (!walletAddress) {
      return errorResponseHelper(res, 404, "Wallet address not found or you don't have access");
    }

    // Get user email
    const user = await userModel.findOne({
      where: { user_id },
    });

    if (!user || !user.dataValues.email) {
      return errorResponseHelper(res, 400, "User email not found");
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in Redis with address_id as key
    await setRedisItem(`wallet_delete_otp_${address_id}`, {
      otp,
      user_id: user_id.toString(),
      company_id: company_id?.toString() || null,
      expiry: otpExpiry.toISOString(),
    });

    // Send OTP email
    const walletAddrMask = walletAddress.dataValues.wallet_address
      ? `${walletAddress.dataValues.wallet_address.substring(0, 8)}...${walletAddress.dataValues.wallet_address.substring(walletAddress.dataValues.wallet_address.length - 6)}`
      : 'your wallet';
    await sendWalletDeleteOTPEmail(
      user.dataValues.email,
      user.dataValues.name || "User",
      otp,
      walletAddrMask,
      walletAddress.dataValues.currency || "Crypto"
    );

    walletLogger.info(`Delete wallet OTP sent for address ${address_id} to user ${user_id}`);

    return successResponseHelper(res, 200, "OTP sent to your email for wallet deletion", {
      address_id,
      email: user.dataValues.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Delete wallet address with OTP verification
 * POST /api/wallet/deleteWalletAddress
 */
const deleteWalletAddressWithOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { address_id, otp, company_id } = req.body;
    const user_id = userData.user_id;

    if (!address_id) {
      return errorResponseHelper(res, 400, "address_id is required");
    }

    if (!otp) {
      return errorResponseHelper(res, 400, "OTP is required");
    }

    // Build where clause for multi-tenancy
    const whereClause: Record<string, unknown> = {
      user_address_id: address_id,
      user_id,
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Verify the wallet address belongs to the user
    const walletAddress = await userWalletAddressModel.findOne({
      where: whereClause,
    });

    if (!walletAddress) {
      return errorResponseHelper(res, 404, "Wallet address not found or you don't have access");
    }

    // Verify OTP from Redis
    const storedOTPData = await getRedisItem(`wallet_delete_otp_${address_id}`);
    
    if (!storedOTPData || Object.keys(storedOTPData).length === 0) {
      return errorResponseHelper(res, 400, "OTP expired or not found. Please request a new one.");
    }

    const otpData = storedOTPData as { otp: string; user_id: string; company_id: string | null; expiry: string };
    
    if (otpData.otp !== otp) {
      return errorResponseHelper(res, 400, "Invalid OTP");
    }

    if (otpData.user_id !== user_id.toString()) {
      return errorResponseHelper(res, 403, "Unauthorized");
    }

    if (new Date(otpData.expiry) < new Date()) {
      await deleteRedisItem(`wallet_delete_otp_${address_id}`);
      return errorResponseHelper(res, 400, "OTP expired. Please request a new one.");
    }

    // Store wallet info before deletion for response
    const deletedWalletInfo = {
      address_id: walletAddress.dataValues.user_address_id,
      wallet_address: walletAddress.dataValues.wallet_address,
      wallet_name: walletAddress.dataValues.wallet_name,
      currency: walletAddress.dataValues.currency,
    };

    // Delete the wallet address
    await userWalletAddressModel.destroy({
      where: whereClause,
    });

    // Also delete from userWalletModel so dashboard/wallet page reflects the change
    const walletModelWhere: Record<string, unknown> = {
      user_id,
      wallet_type: walletAddress.dataValues.currency,
      wallet_address: walletAddress.dataValues.wallet_address,
    };
    if (company_id) {
      walletModelWhere.company_id = company_id;
    }
    await userWalletModel.destroy({ where: walletModelWhere });

    // Delete OTP from Redis
    await deleteRedisItem(`wallet_delete_otp_${address_id}`);

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    walletLogger.info(`Wallet address ${address_id} deleted by user ${user_id}`);

    return successResponseHelper(res, 200, "Wallet address deleted successfully", {
      deleted: true,
      ...deletedWalletInfo,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get transaction details by ID
 * GET /api/wallet/transaction/:id
 */
/**
 * GET /api/wallet/transaction/:id
 * Get detailed transaction information - scoped by company
 */
const getTransactionDetails = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { id } = req.params;
    const { company_id } = req.query;

    // Build parameterized query
    const replacements: Record<string, unknown> = {
      user_id: userData.user_id,
      id_str: id,
      id_num: parseInt(id as string, 10) || 0,
    };
    let companyFilter = '';
    if (company_id) {
      companyFilter = `AND ut.company_id = :company_id`;
      replacements.company_id = parseInt(company_id as string, 10);
    }

    // Fetch transaction with all related data (parameterized)
    const transaction = await sequelize.query(
      `
      SELECT 
        ut.*,
        c.customer_name,
        c.email as customer_email,
        cm.company_name,
        cm.company_id as tx_company_id,
        uw.wallet_type,
        uw.wallet_address
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id = ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id = ut.company_id
      LEFT JOIN tbl_user_wallet uw ON uw.wallet_id = ut.wallet_id
      WHERE ut.user_id = :user_id 
        AND (ut.id = :id_str OR ut.transaction_id = :id_num)
        ${companyFilter}
      LIMIT 1
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    if (transaction.length === 0) {
      return errorResponseHelper(res, 404, "Transaction not found");
    }

    const txData = transaction[0] as Record<string, unknown>;

    // Calculate total fees
    const totalFees = Number(txData.transaction_fee || 0) + Number(txData.fixed_fee || 0) + Number(txData.blockchain_buffer_fee || 0);

    // Format response according to Figma UI requirements
    const response = {
      // Header
      status: txData.status,
      transaction_id: txData.id || `TX${String(txData.transaction_id).padStart(3, '0')}`,
      date_time: txData.createdAt,
      
      // Amount Details
      cryptocurrency: txData.crypto_currency || txData.wallet_type || txData.base_currency,
      amount: txData.crypto_amount || txData.base_amount,
      usd_value: txData.usd_value || txData.base_amount,
      
      // Fees - both formats for backward compatibility
      fees: totalFees,  // Backward compatible: single number
      fees_breakdown: {  // New: detailed breakdown
        total: totalFees,
        transaction_fee: txData.transaction_fee || 0,
        fixed_fee: txData.fixed_fee || 0,
        blockchain_buffer: txData.blockchain_buffer_fee || 0,
      },
      
      // Confirmations - both formats
      confirmations: txData.confirmations || 0,  // Backward compatible: single number
      confirmations_detail: {  // New: detailed
        current: txData.confirmations || 0,
        required: txData.required_confirmations || 6,
      },
      
      // Transaction Hashes
      incoming_transaction_id: txData.incoming_tx_hash || txData.transaction_reference,
      outgoing_transaction_id: txData.outgoing_tx_hash || null,
      transaction_reference: txData.transaction_reference,  // Backward compatible
      
      // Callback Information
      callback_url: txData.callback_url || null,
      webhook_url: txData.webhook_url || null,
      webhook_response: txData.webhook_response ? JSON.parse(String(txData.webhook_response)) : null,
      
      // Company & Customer Details - both formats
      company: {
        company_id: txData.tx_company_id || txData.company_id,
        company_name: txData.company_name,
      },
      customer: {
        customer_id: txData.customer_id,
        customer_name: txData.customer_name,
        customer_email: txData.customer_email,
      },
      // Backward compatible flat fields
      company_id: txData.tx_company_id || txData.company_id,
      company_name: txData.company_name,
      customer_id: txData.customer_id,
      customer_name: txData.customer_name,
      customer_email: txData.customer_email,
      
      // Additional Details
      wallet_address: txData.wallet_address,
      payment_mode: txData.payment_mode,
      transaction_type: txData.transaction_type,
      transaction_details: txData.transaction_details,
      base_currency: txData.base_currency,
      base_amount: txData.base_amount,  // Backward compatible
    };

    successResponseHelper(res, 200, "Transaction details retrieved", response);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Export transactions to CSV
 * POST /api/wallet/transactions/export
 */
const exportTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { 
      date_from,
      date_to,
      status,
      currency,
      search,
      company_id
    } = req.body;

    // Build parameterized WHERE conditions
    const { whereConditions, replacements } = buildTransactionFilters(userData.user_id, {
      date_from, date_to, status, currency, search, company_id
    });
    const transactions = await sequelize.query(
      `
      SELECT 
        ut.id as transaction_id,
        ut."createdAt" as date_time,
        uw.wallet_type as crypto,
        ut.base_amount as amount,
        ut.base_currency,
        ut.status,
        c.customer_name,
        cm.company_name,
        ut.payment_mode,
        ut.transaction_type,
        ut.transaction_reference
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id=ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id=c.company_id
      LEFT JOIN tbl_user_wallet uw ON uw.wallet_id=ut.wallet_id
      WHERE ${whereConditions}
      ORDER BY ut."createdAt" DESC
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    // Get company's preferred currency for the value column
    const preferredCurrency = await getCompanyBaseCurrency(company_id);
    let fiatConversionRate = 1;
    if (preferredCurrency !== 'USD') {
      try {
        const result = await convertToFiat('USD', preferredCurrency, 1);
        if (result.amount) fiatConversionRate = result.amount;
      } catch { /* fallback to USD */ }
    }

    // Convert to CSV format
    const csvHeaders = `Transaction ID,Date & Time,Crypto,Amount,Currency,${preferredCurrency} Value,Status,Customer,Company,Payment Mode,Type,Reference\n`;
    const csvRows = transactions.map((tx: Record<string, unknown>) => {
      let fiatValue: string | number = '';
      const baseAmount = Number(tx.amount || 0);
      if (tx.base_currency === 'USD') {
        fiatValue = (baseAmount * fiatConversionRate).toFixed(2);
      } else if (tx.base_currency === preferredCurrency) {
        fiatValue = baseAmount.toFixed(2);
      }
      return [
        tx.transaction_id || '',
        tx.date_time || '',
        tx.crypto || tx.base_currency || '',
        tx.amount || 0,
        tx.base_currency || '',
        fiatValue,
        tx.status || '',
        tx.customer_name || '',
        tx.company_name || '',
        tx.payment_mode || '',
        tx.transaction_type || '',
        tx.transaction_reference || ''
      ].map(field => `"${field}"`).join(',');
    }).join('\n');

    const csvContent = csvHeaders + csvRows;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);
    
    res.send(csvContent);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Phase 10 - Task 10.2: Get Configured Wallets for Checkout
 * Returns only wallets configured for the user's company
 * Used by checkout to filter available payment currencies
 * GET /api/wallet/configured-currencies
 */
const getConfiguredCurrencies = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
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
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(message)
    );
    errorResponseHelper(res, 500, message);
  }
};

/**
 * GET /api/wallet/network-fees
 * Get real-time blockchain network fees for all supported chains
 */
const getNetworkFees = async (req: express.Request, res: express.Response) => {
  try {
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
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, {}, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * POST /api/wallet/calculate-payment
 * Calculate total amount customer needs to pay including blockchain fees
 * Used when fee_payer = 'customer' on payment links
 */
const calculatePaymentAmount = async (req: express.Request, res: express.Response) => {
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
const getCryptoPrice = async (symbol: string): Promise<number> => {
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
const encryptPayload = async (req: express.Request, res: express.Response) => {
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

export default {
  getWallet,
  addFunds,
  authStep,
  verifyPayment,
  estimateFees,
  getCurrencyRates,
  verifyCryptoPayment,
  getWalletTransactions,
  confirmPayment,
  getAllTransactions,
  sendConfirmationOTP,
  withdrawAssets,
  getWalletAddresses,
  addWalletAddress,
  exchangeCreate,
  getExchange,
  confirmExchange,
  getUserAnalytics,
  validateWallet,
  verifyOtp,
  deleteWalletAddress,
  deleteWalletAddressWithOTP,
  sendDeleteWalletOTP,
  sendEditWalletOTP,
  editWalletAddress,
  getTransactionDetails,
  exportTransactions,
  getConfiguredCurrencies,
  getNetworkFees,
  calculatePaymentAmount,
  // New: UPDATE with OTP
  sendUpdateWalletOTP,
  updateWalletWithOTP,
  // New: DELETE with OTP (for main table) - using unique names
  sendDeletePaymentWalletOTP,
  deletePaymentWalletWithOTP,
  encryptPayload,
};
