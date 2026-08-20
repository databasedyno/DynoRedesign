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

export const exchangeCreate = async (req: express.Request, res: express.Response) => {
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

export const getExchange = async (req: express.Request, res: express.Response) => {
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


