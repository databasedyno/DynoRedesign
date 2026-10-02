import express from "express";
import jwt from "jsonwebtoken";
import {
  IUserType,
} from "../../utils/types";
import sequelize from "../../utils/dbInstance";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../../helper";
import { incrementAdminFee, incrementUserWallet } from "../../helper/walletHelpers";
import {
  deleteRedisItem,
  getRedisItem,
} from "../../utils/redisInstance";
import { adminWalletModel, userWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";
import {
  selfTransactionModel,
} from "../../models/userModels";
import { tatumClient } from "../../integrations/tatum/TatumClient";
import blockchairApi from "../../apis/blockchairApi";
import { getTransactionFee, getBlockchainFee } from "../../services/feeService";
import { getAdminWalletAddress } from "../../utils/adminUtils";
import { toFixedStr, toNumber } from "../../utils/money";

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

      const userSettledAmount = toFixedStr(Number(receivedAmount) - platformCharge - blockchainCharge, 8);

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

          sendAmount = toNumber(Number(receivedAmount) - Number(fees), 8);
        }

        if (["ETH", "BSC", "USDT-ERC20"].indexOf(tempData.currency) !== -1) {
          fees = await tatumClient.feeEstimation(
            tempData.currency,
            address,
            adminWalletAddress,
            Number(receivedAmount)
          ) as { slow?: string | number };

          sendAmount = toFixedStr(Number(receivedAmount) - Number((fees as { slow?: string | number })?.slow || 0), 8);
        }

        if (tempData.currency === "BCH") {
          fees = await tatumClient.feeEstimation(
            tempData.currency,
            "bitcoincash" + address,
            adminWalletAddress,
            Number(receivedAmount)
          ) as { slow?: string | number };
          sendAmount = toFixedStr((
            Number(receivedAmount) -
            Number((fees as { slow?: string | number })?.slow || 0) -
            0.00005
          ), 8);
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


