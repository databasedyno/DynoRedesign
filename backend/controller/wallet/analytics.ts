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
import { toFixedStr } from "../../utils/money";

export const getUserAnalytics = async (
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

    // RBAC: a member with view_wallets sees the OWNER's wallet analytics for a
    // granted company (no-op for owners).
    let effectiveUserId = Number(userData.user_id);
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id, "view_wallets");
      if (!companyData) return; // 403 already sent
      effectiveUserId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    // Get company's preferred currency for analytics display
    const preferredCurrency = await getUserDisplayCurrency(effectiveUserId, company_id);

    // Build company filter for SQL queries (both tbl_user_transaction and tbl_user_temp_address have company_id)
    const safeCompanyId = company_id ? parseInt(company_id) : null;
    const companyFilterSQL = safeCompanyId ? ` and ut.company_id=${safeCompanyId}` : '';

    const txWhere: any = { user_id: effectiveUserId };
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
          user_id: effectiveUserId,
        },
      })
    ).count;

    let where = "";
    const safeYear = parseInt(year) || new Date().getFullYear();
    const safeMonth = parseInt(month) || (new Date().getMonth() + 1);
    const safeUserId = Number(effectiveUserId);
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
        fee_amount: toFixedStr(feeAmount, 8),
        fee_in_fiat: toFixedStr(feeAmount * currencyData[0].transferRate, 2),
        fee_in_usd: toFixedStr(feeAmount * currencyData[0].transferRate, 2), // backward compat
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


