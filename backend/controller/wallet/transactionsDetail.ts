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
import {
  deriveTxDisplayStatus,
  isNeedsAction,
  isPaymentDetected,
  isTxStatusBucket,
  NEEDS_ACTION_RAW,
  rawStatusesForBucket,
  toTxStatusBucket,
  TxStatusBucket,
} from "../../utils/transactionDisplayStatus";
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
import { mul, toFixedStr } from "../../utils/money";
import { AUTO_CONVERT_SELECT_SQL, buildAutoConvertInfo } from "../../utils/autoConvertPayout";

export const getTransactionDetails = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { id } = req.params;
    const { company_id } = req.query;

    // Build parameterized query. Only treat the param as a numeric transaction_id
    // when it is purely digits — parseInt("388e7809-…") would otherwise match row 388.
    const replacements: Record<string, unknown> = {
      user_id: userData.user_id,
      id_str: id,
      id_num: /^\d+$/.test(String(id)) ? parseInt(id as string, 10) : -1,
    };
    let companyFilter = '';
    if (company_id) {
      // RBAC: a member with view_transactions sees the OWNER's transaction.
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id, "view_transactions");
      if (!companyData) return; // 403 already sent
      replacements.user_id = Number((companyData as unknown as { user_id: number }).user_id);
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
        uw.wallet_address,
        ${AUTO_CONVERT_SELECT_SQL}
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id = ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id = ut.company_id
      LEFT JOIN tbl_user_wallet uw ON uw.wallet_id = ut.wallet_id
      LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id
      WHERE ut.user_id = :user_id 
        AND (ut.id = :id_str OR ut.transaction_id = :id_num
             OR ut.incoming_tx_hash = :id_str OR ut.transaction_reference = :id_str)
        ${companyFilter}
      ORDER BY ut."createdAt" DESC
      LIMIT 1
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    if (transaction.length === 0) {
      return errorResponseHelper(res, 404, "Transaction not found");
    }

    const txData = transaction[0] as Record<string, unknown>;
    const autoConvert = buildAutoConvertInfo(txData);

    // Calculate total fees
    const totalFees = Number(txData.transaction_fee || 0) + Number(txData.fixed_fee || 0) + Number(txData.blockchain_buffer_fee || 0);

    // Has any on-chain payment actually been observed? Drives the 'pending'
    // vs 'awaiting_payment' distinction + lets the UI hide the confirmations
    // counter for addresses that were generated but never funded.
    const paymentDetected = isPaymentDetected(txData as any);

    // Format response according to Figma UI requirements
    const response = {
      // Header
      // 'pending' → 'awaiting_payment' (nothing on-chain yet) / 'unpaid'
      // (window passed) / stays 'pending' while a real payment confirms.
      status: deriveTxDisplayStatus(txData.status, txData.createdAt, paymentDetected),
      payment_detected: paymentDetected,
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
      
      // Transaction Hashes. For auto-converted payments the outgoing hash is the
      // Binance → merchant payout (never the internal pool → Binance deposit).
      incoming_transaction_id: txData.incoming_tx_hash || txData.transaction_reference,
      outgoing_transaction_id: autoConvert ? autoConvert.payout_tx_hash : (txData.outgoing_tx_hash || null),
      transaction_reference: txData.transaction_reference,  // Backward compatible
      auto_converted: !!autoConvert,
      auto_convert: autoConvert,
      
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
      wallet,
      source,
      search,
      company_id,
      settled_only,
    } = req.body;

    // RBAC parity with getAllTransactions: a team member exports the OWNER's rows.
    let effectiveUserId = userData.user_id;
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, String(company_id), userData.user_id);
      if (!companyData) return; // 403 already sent
      effectiveUserId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    // `status` is either a UI bucket (settled / unpaid / awaiting_payment / …
    // — what the status chips send), the saved "needs_action" filter, or a raw
    // DB status for legacy callers. "Settled only" is shorthand for the settled bucket.
    const needsAction = status === "needs_action";
    const bucket: TxStatusBucket | null = isTxStatusBucket(status)
      ? status
      : settled_only && !status
        ? "settled"
        : null;
    const { whereConditions, replacements } = buildTransactionFilters(effectiveUserId, {
      date_from, date_to, status: bucket || needsAction ? undefined : status, currency, company_id
    });
    let finalWhere = whereConditions;
    // Search parity with the on-screen filter (id / amount / currency) plus the
    // tx hash, so a search + Export yields the rows the merchant is looking at.
    if (search) {
      finalWhere += ` AND (ut.id ILIKE :search OR ut.transaction_reference ILIKE :search OR ut.base_currency ILIKE :search OR uw.wallet_type ILIKE :search OR CAST(ut.base_amount AS TEXT) ILIKE :search)`;
      replacements.search = `%${String(search)}%`;
    }
    const rawStatuses = needsAction ? NEEDS_ACTION_RAW : bucket ? rawStatusesForBucket(bucket) : null;
    if (rawStatuses) {
      finalWhere += ` AND ut.status IN (:bucket_statuses)`;
      replacements.bucket_statuses = rawStatuses;
    }
    // Wallet chip — same key the on-screen filter matches (settlement wallet type, else base currency).
    if (wallet && wallet !== "all") {
      finalWhere += ` AND COALESCE(uw.wallet_type, ut.base_currency) = :wallet`;
      replacements.wallet = String(wallet);
    }
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
        ut.incoming_tx_hash,
        ut.confirmations,
        c.customer_name,
        c.email as customer_email,
        cm.company_name,
        ut.payment_mode,
        ut.transaction_type,
        ut.transaction_reference,
        pl.link_id           as source_link_id,
        pl.link_type         as source_link_type,
        pl.title             as source_link_title,
        pl.parent_link_id    as source_parent_link_id,
        parent_pl.title      as source_parent_title,
        parent_pl.is_tip_jar as source_parent_is_tip_jar,
        po.order_id          as source_order_id,
        po.public_ref        as source_order_ref
      FROM tbl_user_transaction ut 
      LEFT JOIN tbl_customer c ON c.customer_id=ut.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id=c.company_id
      LEFT JOIN tbl_user_wallet uw ON uw.wallet_id=ut.wallet_id
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
      WHERE ${finalWhere}
      ORDER BY ut."createdAt" DESC
      `,
      { type: QueryTypes.SELECT, replacements }
    );

    // Exact parity with the on-screen list: derive the display status the same
    // way getAllTransactions does, then post-filter by status bucket / source.
    const rows: Array<Record<string, unknown>> = (transactions as Array<Record<string, unknown>>)
      .map((tx): Record<string, unknown> => ({
        ...tx,
        display_status: deriveTxDisplayStatus(tx.status, tx.date_time, isPaymentDetected(tx as any)),
      }))
      .filter((tx) => {
        const b = toTxStatusBucket(tx.display_status);
        if (needsAction) return isNeedsAction(b, tx.date_time);
        return !bucket || b === bucket;
      })
      .filter((tx) => {
        if (!source || source === "all") return true;
        return (
          resolveTransactionSource({
            source_order_id: tx.source_order_id as string | number | null,
            source_order_ref: tx.source_order_ref as string | null,
            source_link_id: tx.source_link_id as string | number | null,
            source_link_type: tx.source_link_type as string | null,
            source_link_title: tx.source_link_title as string | null,
            source_parent_link_id: tx.source_parent_link_id as string | number | null,
            source_parent_title: tx.source_parent_title as string | null,
            source_parent_is_tip_jar: tx.source_parent_is_tip_jar as boolean | number | null,
            customer_email: (tx.customer_email as string) ?? null,
          }).type === source
        );
      });

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
      return rate > 0 ? mul(amt, rate).toNumber() : null;
    };

    const csvRowsArr: string[] = [];
    for (const tx of rows) {
      const usd = await usdForRow(tx);
      const fiatValue =
        usd != null ? toFixedStr((usd * fiatConversionRate), 2) : '';
      csvRowsArr.push(
        [
          tx.transaction_id || '',
          tx.date_time || '',
          tx.crypto || tx.base_currency || '',
          tx.amount || 0,
          tx.base_currency || '',
          fiatValue,
          tx.display_status || '',
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

