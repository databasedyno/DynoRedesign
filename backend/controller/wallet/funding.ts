import { cardPayment, bankTransfer, bankAccount, googleApplePay, USSD, MobileMoney, QRCode, Crypto } from "./fundingMethods";
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

export const addFunds = async (req: express.Request, res: express.Response) => {
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

export const authStep = async (req: express.Request, res: express.Response) => {
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

export const verifyPayment = async (req: express.Request, res: express.Response) => {
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

export const confirmPayment = async (req: express.Request, res: express.Response) => {
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


