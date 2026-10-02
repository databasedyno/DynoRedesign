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
import { convertToFiat } from "../../utils/currencyUtils";
import crypto from "crypto";
import {
  deleteRedisItem,
  getRedisItem,
} from "../../utils/redisInstance";
import { userWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";
import {
  selfTransactionModel,
  userExchangeModel,
} from "../../models/userModels";
import { toFixedStr } from "../../utils/money";

export const confirmExchange = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { otp1, otp2, id } = req.body;
    const data = await getRedisItem("exchange-" + id);
    // getRedisItem() yields {} for a missing key — require the real session fields
    if (data && data.otp1 && data.otp2 && data.expiresAt) {
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

        if (otp1 && otp2 && String(otp1) === String(data.otp1) && String(otp2) === String(data.otp2)) {
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

          const req_amount = toFixedStr((
            Number(amount_in_usd) / wallet2_balance[0].transferRate
          ), decimal2);

          const exchange_amount = toFixedStr((
            Number(amount_in_usd) / wallet1_balance[0].transferRate
          ), decimal1);

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


