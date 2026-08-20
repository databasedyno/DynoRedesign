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

export const getTransactionDetails = async (req: express.Request, res: express.Response) => {
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
      // Stale 'pending' attempts (payment window passed) are shown as 'unpaid'
      status: deriveTxDisplayStatus(txData.status, txData.createdAt),
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
export const exportTransactions = async (req: express.Request, res: express.Response) => {
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
        ut.usd_value as usd_value,
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
    const preferredCurrency = await getUserDisplayCurrency(userData?.user_id, company_id);
    let fiatConversionRate = 1;
    if (preferredCurrency !== 'USD') {
      try {
        const result = await convertToFiat('USD', preferredCurrency, 1);
        if (result.amount) fiatConversionRate = result.amount;
      } catch { /* fallback to USD */ }
    }

    // Convert to CSV format. The "<CUR> Value" column uses the authoritative
    // per-transaction usd_value (× the cached USD→display rate) so it's ALWAYS
    // populated in the merchant's display currency — matching the on-screen
    // Transactions "Value (CUR)" column. For rows without a stored usd_value
    // (e.g. still-pending crypto) we replicate getAllTransactions' enrichment:
    // stablecoins ≈ face value, other cryptos via a cached live USD conversion.
    const csvHeaders = `Transaction ID,Date & Time,Crypto,Amount,Currency,${preferredCurrency} Value,Status,Customer,Company,Payment Mode,Type,Reference\n`;
    const STABLE = ['USD', 'USDT', 'USDC', 'USDT-ERC20', 'USDT-TRC20', 'USDC-ERC20', 'BUSD', 'DAI'];
    const perUnitUsd = new Map<string, number>(); // currency → USD per 1 unit (request-scoped cache)
    const usdForRow = async (tx: Record<string, unknown>): Promise<number | null> => {
      const stored = Number(tx.usd_value);
      if (Number.isFinite(stored) && stored > 0) return stored;
      const cur = String(tx.base_currency || '').toUpperCase();
      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return null;
      if (STABLE.some((s) => cur === s || cur.includes(s))) return amt;
      if (!perUnitUsd.has(cur)) {
        try {
          perUnitUsd.set(cur, Number(await convertToUSD(cur, 1)) || 0);
        } catch {
          perUnitUsd.set(cur, 0);
        }
      }
      const rate = perUnitUsd.get(cur) || 0;
      return rate > 0 ? amt * rate : null;
    };

    const csvRowsArr: string[] = [];
    for (const tx of transactions as Array<Record<string, unknown>>) {
      const usd = await usdForRow(tx);
      const fiatValue =
        usd != null ? (usd * fiatConversionRate).toFixed(2) : '';
      csvRowsArr.push(
        [
          tx.transaction_id || '',
          tx.date_time || '',
          tx.crypto || tx.base_currency || '',
          tx.amount || 0,
          tx.base_currency || '',
          fiatValue,
          deriveTxDisplayStatus(tx.status, tx.date_time) || '',
          tx.customer_name || '',
          tx.company_name || '',
          tx.payment_mode || '',
          tx.transaction_type || '',
          tx.transaction_reference || '',
        ]
          .map((field) => `"${field}"`)
          .join(','),
      );
    }
    const csvRows = csvRowsArr.join('\n');

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

