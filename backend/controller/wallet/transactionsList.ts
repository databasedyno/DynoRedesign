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
import { deriveTxDisplayStatus, isPaymentDetected } from "../../utils/transactionDisplayStatus";
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

export const getAllTransactions = async (
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
        sc.completed_at as auto_convert_completed_at,
        -- Source metadata (payment link / contribution / tip / product order)
        pl.link_id           as source_link_id,
        pl.link_type         as source_link_type,
        pl.title             as source_link_title,
        pl.parent_link_id    as source_parent_link_id,
        pl.is_tip_jar        as source_is_tip_jar,
        parent_pl.title      as source_parent_title,
        parent_pl.is_tip_jar as source_parent_is_tip_jar,
        po.order_id          as source_order_id,
        po.public_ref        as source_order_ref
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id=ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id=c.company_id
      LEFT JOIN tbl_user_wallet uw ON uw.wallet_id=ut.wallet_id
      LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id=ut.transaction_id
      -- Bridge tbl_user_transaction -> tbl_payment_link via the shared settlement
      -- reference (transaction_reference lives on BOTH tables). DISTINCT ON dedups
      -- per reference. Mirrors companyController.getTransactions (Session 54 fix)
      -- so the /transactions page source filter (payment_link/tip/product/…) works.
      LEFT JOIN (
        SELECT DISTINCT ON (transaction_reference)
          transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar
        FROM tbl_payment_link
        WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
        ORDER BY transaction_reference, link_id DESC
      ) pl ON pl.transaction_reference = ut.transaction_reference
        AND ut.transaction_reference IS NOT NULL AND ut.transaction_reference <> ''
      LEFT JOIN tbl_payment_link parent_pl ON parent_pl.link_id = pl.parent_link_id
      LEFT JOIN tbl_product_order po ON po.payment_link_id = pl.link_id
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
        source_link_id,
        source_link_type,
        source_link_title,
        source_parent_link_id,
        source_is_tip_jar,
        source_parent_title,
        source_parent_is_tip_jar,
        source_order_id,
        source_order_ref,
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
        } else {
          // Non-stablecoin rows without a stored usd_value are pending/unvalued
          // payments. We intentionally DO NOT do a live rate conversion here —
          // that per-row external call made the /transactions list slow (up to
          // ~2s). Leaving usd_value null (UI shows "—") matches how the
          // dashboard values these rows: they contribute $0 until the payment
          // confirms, at which point settlement writes the real usd_value.
          usd_value = null;
        }
      }

      // ── Derive `source` via the shared resolver so the /transactions page,
      // company/getTransactions AND the dashboard all classify a transaction
      // identically (payment_link / api / tip / product / contribution / direct).
      const source = resolveTransactionSource({
        source_order_id: source_order_id as string | number | null,
        source_order_ref: source_order_ref as string | null,
        source_link_id: source_link_id as string | number | null,
        source_link_type: source_link_type as string | null,
        source_link_title: source_link_title as string | null,
        source_parent_link_id: source_parent_link_id as string | number | null,
        source_parent_title: source_parent_title as string | null,
        source_parent_is_tip_jar: source_parent_is_tip_jar as boolean | number | null,
        customer_email: (x.email as string) ?? null,
      });

      return {
        ...rest,
        // Source metadata for the transactions UX (filter chips + row badge)
        source,
        // Format for UI
        transaction_id_display: x.id || `TX${x.transaction_id}`,
        crypto: x.crypto_currency || x.base_currency,
        amount: x.base_amount,
        usd_value: usd_value,
        date_time: x.createdAt,
        // Stale 'pending' attempts (payment window passed) are shown as 'unpaid';
        // fresh pending with no on-chain payment yet reads as 'awaiting_payment'.
        status: deriveTxDisplayStatus(x.status, x.createdAt, isPaymentDetected(x as any)),
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


