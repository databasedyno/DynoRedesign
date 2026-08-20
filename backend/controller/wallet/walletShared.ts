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

// HTML escape utility to prevent XSS in email templates
export const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

/**
 * Builds parameterized WHERE conditions for transaction queries.
 * Used by getWalletTransactions and exportTransactions.
 */
export function buildTransactionFilters(
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

/**
 * Invalidate all wallet caches for a user
 * Called after any wallet modification (add, update, delete)
 */
export const invalidateWalletCache = async (userId: number): Promise<void> => {
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

