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
import { tatumClient } from "../../integrations/tatum/TatumClient";
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

export const verifyCryptoPayment = async (
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
      // const ref = await tatumClient.sendFeeToAdmin(
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
            await tatumClient.feeEstimation(
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
          fees = await tatumClient.feeEstimation(
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
          fees = await tatumClient.feeEstimation(
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

          transactionDetails = await tatumClient.assetToOtherAddress({
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


