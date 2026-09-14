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
  setRedisItemWithTTL,
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
import { toFixedStr, toNumber } from "../../utils/money";

export const getWallet = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id } = req.query;
    
    // Get company's preferred currency from their API key (production preferred)
    let preferredCurrency = 'USD';
    let fiatConversionRate = 1;
    // RBAC: a granted team member reads the OWNER's wallets for a company, so
    // scope every query below to the company owner's user_id (no-op for owners).
    let effectiveUserId = Number(userData.user_id);
    
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id, "view_wallets");
      if (!companyData) return; // 403 already sent
      effectiveUserId = Number((companyData as unknown as { user_id: number }).user_id);
      preferredCurrency = await getUserDisplayCurrency(effectiveUserId, company_id as string);
    }
    
    // Check cache first (120 second TTL) - include currency in cache key
    const cacheKey = `wallet:${effectiveUserId}:${company_id || 'all'}:${preferredCurrency}:v5`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      walletLogger.info(`[Wallet] Cache hit for user ${effectiveUserId}`);
      return successResponseHelper(res, 200, "Wallets retrieved", cached);
    }
    
    // Build where clause with optional company_id filter
    // Only return CRYPTO wallets (this is a crypto-focused project)
    const whereClause: Record<string, unknown> = {
      user_id: effectiveUserId,
      currency_type: 'CRYPTO',
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    // ── B4: independent reads in parallel ────────────────────────────────
    // walletData, the per-wallet processed-volume rollup and the USD→preferred
    // fiat rate are independent of each other, so fetch them concurrently.
    // (company-name + per-currency-rate lookups below depend on walletData, so
    // they run in a 2nd parallel wave.) No money-math changed — only ordering.
    const USD_FALLBACK_EXPR = PROCESSED_USD_EXPR;
    const volCompanyJoin = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const volCompanyFilter = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';

    const [walletData, processedRows, fiatRateResult] = await Promise.all([
      userWalletModel.findAll({
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
      }),
      sequelize.query(
        `SELECT ut.wallet_id AS wallet_id, COALESCE(SUM(${USD_FALLBACK_EXPR}), 0) AS processed_usd
         FROM tbl_user_transaction ut
         ${volCompanyJoin}
         WHERE ut.user_id = :userId AND ${PROCESSED_STATUS_SQL} ${volCompanyFilter}
         GROUP BY ut.wallet_id`,
        {
          replacements: { userId: effectiveUserId, companyId: company_id },
          type: QueryTypes.SELECT,
        }
      ) as Promise<Array<{ wallet_id: string | number | null; processed_usd: string }>>,
      preferredCurrency !== 'USD'
        ? convertToFiat('USD', preferredCurrency, 1)
            .then((r) => ({ threw: false, amount: r.amount as number | undefined }))
            .catch(() => ({ threw: true, amount: undefined as number | undefined }))
        : Promise.resolve({ threw: false, amount: 1 as number | undefined }),
    ]);

    // Resolve USD→preferred fiat rate — preserve original fallback semantics:
    // only fall back to USD when the conversion actually threw.
    if (preferredCurrency !== 'USD') {
      if (fiatRateResult.threw) {
        walletLogger.warn(`[getWallet] Currency conversion failed, using USD`);
        preferredCurrency = 'USD';
      } else if (fiatRateResult.amount) {
        fiatConversionRate = fiatRateResult.amount;
      }
    }

    // Per-wallet processed-volume lookup (from the parallel query above).
    // RECONCILED with the dashboard "Overall volume" (dashboardController
    // volumeQuery): sum the USD value LOCKED IN at settlement time
    // (ut.usd_value, with the same stablecoin base_amount fallback) grouped by
    // wallet, using the SAME user/company scope the dashboard uses.
    const processedByWalletId = new Map<string, number>();
    for (const r of processedRows) {
      if (r.wallet_id !== null && r.wallet_id !== undefined) {
        processedByWalletId.set(String(r.wallet_id), parseFloat(String(r.processed_usd)) || 0);
      }
    }

    // ── 2nd wave: company names + per-currency transfer rates (both need walletData) ──
    const companyIds = [...new Set(walletData.map(w => w.dataValues.company_id))];
    const currencyList = [];
    for (let i = 0; i < walletData.length; i++) {
      currencyList.push(walletData[i].dataValues.wallet_type);
    }

    const [companies, currencyData] = await Promise.all([
      companyModel.findAll({
        where: { company_id: companyIds },
        attributes: ['company_id', 'company_name'],
      }),
      convertToMultiple("USD", currencyList, 1, false).catch(() => {
        walletLogger.warn(`[getWallet] Currency conversion failed for some currencies, using fallback rates`);
        // Fallback: return empty rates - wallet will still load with 0 USD values
        return currencyList.map((c: string) => ({ currency: c, amount: 0, transferRate: 0 }));
      }),
    ]);

    // Create company lookup map
    const companyMap = new Map<number, string>();
    for (const company of companies) {
      companyMap.set(company.dataValues.company_id, company.dataValues.company_name);
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
      // Historical processed volume (USD) for THIS wallet — matches dashboard.
      const amountInUSD = processedByWalletId.get(String(currentWallet.wallet_id)) || 0;
      const amountInBaseCurrency = amountInUSD * fiatConversionRate;
      const amountDisplay = formatAmountForDisplay(amountInBaseCurrency, preferredCurrency);
      walletsWithCompanyName.push({
        ...currentWallet,
        company_name: companyMap.get(currentWallet.company_id) || 'Unknown',
        amount_in_usd: toFixedStr(amountInUSD, 2),
        amount_in_base_currency: toFixedStr(amountInBaseCurrency, 2),
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
    
    // Cache the result (120s TTL — rates update in background cache every 60s).
    // B3: single SET EX round-trip, fire-and-forget so it never blocks the response.
    setRedisItemWithTTL(cacheKey, returnData, 120).catch(() => {});
    
    successResponseHelper(res, 200, message, returnData);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export const getWalletTransactions = async (
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
      preferredCurrency = await getUserDisplayCurrency(userData?.user_id, company_id as string);
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
        display_amount: toNumber(baseAmount * conversionRate, 2),
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


