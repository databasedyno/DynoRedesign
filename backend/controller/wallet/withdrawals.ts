import { getTempAddressBatches } from "./tempAddress";
import express from "express";
import jwt from "jsonwebtoken";
import {
  IUserType,
} from "../../utils/types";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
  generateWalletName,
} from "../../helper";
import {
  sendWithdrawalSuccessEmail,
} from "../../services/emailService";
import crypto from "crypto";
import {
  deleteRedisItem,
  getRedisItem,
} from "../../utils/redisInstance";
import { userWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";
import {
  selfTransactionModel,
  userWalletAddressModel,
  userTempAddressModel,
} from "../../models/userModels";
import { tatumClient } from "../../integrations/tatum/TatumClient";
import blockchairApi from "../../apis/blockchairApi";
import { toFixedStr } from "../../utils/money";

export const withdrawAssets = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { currency, amount, address, feeType, feeToPay, otp, saveAddress } =
      req.body;
    const storedOtp = await getRedisItem(userData.email + "-withdrawal-otp");
    if (!storedOtp?.otp || String(storedOtp.otp) !== String(otp)) {
      errorResponseHelper(res, 500, "OTP did not match!");
    } else {
      if (new Date().getTime() > Number(storedOtp?.expiresAt)) {
        throw { message: "OTP expired!" };
      }

      const walletData = await userWalletModel.findOne({
        where: {
          user_id: userData.user_id,
          wallet_type: currency,
        },
      });

      let fees = feeToPay,
        sendAmount: number =
          feeType === "wallet"
            ? amount
            : walletData?.dataValues.wallet_type.includes("USDT")
              ? toFixedStr(amount - feeToPay, 2)
              : amount - feeToPay;

      // Fetch Transaction Information
      const {
        fromAddress,
        toAddress,
        totalSendAmount,
        permanentUserWalletAddress,
        tempAddresses,
        userWallet,
      } = await getTempAddressBatches(
        userData.user_id,
        currency,
        sendAmount,
        address,
        fees
      );

      if (
        ["ETH", "BSC", "USDT-ERC20"].indexOf(
          walletData?.dataValues.wallet_type
        ) !== -1
      ) {
        const tempFees = await tatumClient.batchFeeEstimation({
          currency,
          fromAddresses: fromAddress,
          toAddresses: toAddress,
          amount: totalSendAmount,
          totalAddress: fromAddress.length,
        });

        fees = { gasPrice: tempFees?.gasPrice, gasLimit: tempFees?.gasLimit };
      }

      const fromUTXO = [],
        toUTXO = [];

      if (walletData?.dataValues.wallet_type === "BCH") {
        for (let j = 0; j < fromAddress.length; j++) {
          const utxo = await blockchairApi.getBitcoinCashUTXO(
            fromAddress[j].address
          );

          utxo.sort((a, b) => b.value - a.value);

          let tempAmount = 0;

          for (let i = 0; i < utxo.length; i++) {
            if (tempAmount < amount) {
              fromUTXO.push({
                txHash: utxo[i]?.transaction_hash,
                index: utxo[i]?.index,
                privateKey: fromAddress[j].privateKey,
              });
              tempAmount += utxo[i].value / 100000000;
            }
          }

          toUTXO.push({
            address: address.includes("bitcoincash")
              ? address
              : "bitcoincash:" + address,
            value: Number(sendAmount),
          });
        }
      }

      // Transfer assets from temporary addresses to the user's address
      const transactionDetails =
        await tatumClient.assetBatchAddressesToOtherAddress({
          currency: currency,
          fromAddress: fromAddress,
          toAddress: toAddress,
          fee: fees,
          permanentUserWalletAddress,
          fromUTXO,
          toUTXO,
        });

      walletLogger.info("###transactionDetails", transactionDetails);

      // if (transactionDetails) {
      //   // Step 5: Deduct the amount from temporary addresses and user's wallet
      //   for (let address of fromAddress) {

      //     // Fetch the current amount
      //     const tempAddr = tempAddresses.find(tmpaddress => tmpaddress.dataValues.wallet_address === address.address);
      //     const newAmount = tempAddr.dataValues.amount - address.value;

      //     if (tempAddr) {
      //       // Update the amount
      //       await userTempAddressModel.update(
      //         { amount: newAmount },
      //         { where: { temp_id: tempAddr.dataValues.temp_id } }
      //       );
      //     }
      //   }
      //   await userWalletModel.decrement("amount", {
      //     by:
      //       feeType === "wallet"
      //         ? Number(amount) + Number(feeToPay)
      //         : Number(amount),
      //     where: {
      //       wallet_id: userWallet.dataValues.wallet_id,
      //     },
      //   });
      // }

      let transactionIds = [];

      if (transactionDetails) {
        // Step 5: Deduct the amount from temporary addresses and user's wallet
        for (let transaction of transactionDetails) {
          if (transaction.status !== "failed") {
            const address = fromAddress.find(
              (addr) => addr.address === transaction.fromAddress.address
            );
            if (address) {
              if (!walletData.dataValues.wallet_address === address.address) {
                const tempAddr = tempAddresses.find(
                  (tmpaddress) =>
                    tmpaddress.dataValues.wallet_address === address.address
                );
                const newAmount = tempAddr.dataValues.amount - address.value;

                if (tempAddr) {
                  // Update the amount
                  await userTempAddressModel.update(
                    { amount: newAmount },
                    { where: { temp_id: tempAddr.dataValues.temp_id } }
                  );
                }
              }
            }
            if (transactionIds.length > 0) {
              const index = transactionIds.findIndex(
                (x) => x?.txId === transaction?.txId
              );
              if (index === -1) {
                transactionIds.push({
                  txId: transaction?.txId,
                  status: "success",
                  reason: null,
                });
              }
            } else {
              transactionIds.push({
                txId: transaction?.txId,
                status: "success",
                reason: null,
              });
            }
          }
        }

        // Deduct the total amount from the user's wallet based on successful transactions
        const totalAmountToDeduct = transactionDetails.reduce(
          (acc, transaction) => {
            return transaction.status !== "failed"
              ? acc + Number(transaction.fromAddress.value)
              : acc;
          },
          0
        );

        await userWalletModel.decrement("amount", {
          by:
            feeType === "wallet"
              ? totalAmountToDeduct + Number(feeToPay)
              : totalAmountToDeduct,
          where: {
            wallet_id: userWallet.dataValues.wallet_id,
          },
        });
      } else {
        throw { message: "Transaction did not proceed!" };
      }

      // let transactionRefrenceIds = "";
      // if (Array.isArray(transactionDetails)) {
      //   transactionDetails.forEach((element) => {
      //     transactionRefrenceIds += element.txId + ",";
      //   });
      // } else {
      //   transactionRefrenceIds = transactionDetails?.txId;
      // }
      // Prepare transaction reference IDs
      let transactionRefrenceIds = transactionIds[0]?.txId;

      const userPayload = {
        id: crypto.randomUUID(),
        wallet_id: walletData.dataValues.wallet_id,
        user_id: walletData.dataValues.user_id,
        payment_mode: "CRYPTO",
        base_amount: amount,
        base_currency: currency,
        transaction_reference: transactionRefrenceIds,
        transaction_type: "DEBIT",
        status: "success",
      };
      walletLogger.info(userPayload);

      await selfTransactionModel.create({ ...userPayload });
      if (saveAddress) {
        const isExists = await userWalletAddressModel
          .findOne({
            where: {
              wallet_address: address,
              currency,
            },
          })
          .then((token) => token !== null)
          .then((isExists) => isExists);

        if (!isExists) {
          await userWalletAddressModel.create({
            wallet_address: address,
            currency,
            label: currency,
            user_id: userData.user_id,
            wallet_name: generateWalletName(),
          });
        }
      }
      await deleteRedisItem(userData.email + "-withdrawal-otp");
      const maskAddr2 = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : address;
      await sendWithdrawalSuccessEmail(
        userData.email,
        userData.name,
        String(amount),
        String(currency),
        maskAddr2(address),
        String(transactionRefrenceIds)
      );
      successResponseHelper(res, 200, "Amount withdrawed!", transactionIds);
    }
  } catch (e) {
    walletLogger.info("###Error: ", e);
    const message = getErrorMessage(e);
    walletLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};


