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

export const confirmExchange = async (req: express.Request, res: express.Response) => {
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


