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
import { generateOtpCode } from "../../helper/otpGuard";

export const sendConfirmationOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { address, amount, currency } = req.body;
    const email = userData.email;
    const isExists = await userModel
      .findOne({
        where: {
          email,
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);
    if (isExists) {
      const randomNumberOTP = generateOtpCode();
      const maskAddr = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : address;
      await sendWithdrawalOTPEmail(
        email,
        userData.name,
        String(randomNumberOTP),
        String(amount),
        String(currency),
        maskAddr(address)
      );

      await setRedisItem(email + "-withdrawal-otp", {
        otp: randomNumberOTP.toString(),
        expiresAt: new Date().getTime() + 5 * 60 * 1000,
      });

      successResponseHelper(res, 200, "OTP sent successfully!");
    } else {
      errorResponseHelper(res, 404, "Please enter a registered email!");
    }
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export const getTempAddressBatches = async (
  user_id: number,
  currency: string,
  sendAmount: number,
  address: string,
  fees: number
) => {
  // Step 1: Fetch all temporary addresses and paremanent user address for the user in descending order
  const userWallet = await userWalletModel.findOne({
    where: {
      user_id: user_id,
      wallet_type: currency,
    },
  });

  let addressBalance;

  if (currency === "TRX") {
    addressBalance = tatumClient.validateTronAddress(address);
  } else {
    addressBalance = await tatumClient.getAddressBalance(
      userWallet.dataValues?.wallet_address,
      userWallet.dataValues?.wallet_type
    );
  }

  walletLogger.info("####addressBalance", addressBalance);

  let tempAddresses = await userTempAddressModel.findAll({
    where: {
      user_id: user_id,
      wallet_type: currency,
      amount: {
        [Op.gt]: 0,
      },
    },
    order: [["amount", "DESC"]],
  });

  let tempAddressBalances = [];

  if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
    const tempData: Record<string, unknown> = {
      dataValues: {
        ...userWallet.dataValues,
        amount: Number(addressBalance?.balance),
      },
    };
    tempAddressBalances.push(tempData);
  } else if (addressBalance?.incoming && addressBalance?.outgoing) {
    const amount =
      Number(addressBalance?.incoming) - Number(addressBalance?.outgoing);
    walletLogger.info("amount============>", amount);
    if (amount > 0) {
      const tempData: Record<string, unknown> = {
        dataValues: {
          ...userWallet.dataValues,
          amount,
        },
      };
      tempAddressBalances.push(tempData);
    }
  }
  walletLogger.info("###tempAddressBalances", tempAddressBalances);
  if (["USDT-TRC20", "USDT-ERC20", "ETH", "TRX"].indexOf(currency) === -1) {
    for (let address of tempAddresses) {
      if (currency === "TRX") {
        addressBalance = tatumClient.validateTronAddress(
          address.dataValues.wallet_address
        );
      } else {
        addressBalance = await tatumClient.getAddressBalance(
          address.dataValues?.wallet_address,
          address.dataValues?.wallet_type
        );
      }

      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        const tempData: Record<string, unknown> = {
          dataValues: {
            ...address.dataValues,
            amount: Number(addressBalance?.balance),
          },
        };
        tempAddressBalances.push(tempData);
      } else if (addressBalance?.incoming && addressBalance?.outgoing) {
        const amount =
          Number(addressBalance?.incoming) - Number(addressBalance?.outgoing);
        walletLogger.info("amount============>", amount);
        if (amount > 0) {
          const tempData: Record<string, unknown> = {
            dataValues: {
              ...address.dataValues,
              amount,
            },
          };
          tempAddressBalances.push(tempData);
        }
      }
    }
  }

  // Step 2: Combine user wallet and temporary addresses
  const allUserAddress = [...tempAddressBalances].sort(
    (a, b) => b.dataValues.amount - a.dataValues.amount
  );
  walletLogger.info(
    "###allUserAddress",
    allUserAddress.map((a) => ({
      amount: a.dataValues.amount,
      address: a.dataValues.wallet_address,
    }))
  );

  // Step 3: Calculate the total amount available in all addresses
  let totalTempAmount = allUserAddress.reduce(
    (acc, addr) => acc + addr.dataValues.amount,
    0
  );
  walletLogger.info("###totalTempAmount=======>", { totalTempAmount, sendAmount });

  // Step 4: Check if the total amount is sufficient for the withdrawal
  if (totalTempAmount < sendAmount) {
    throw { message: "Insufficient funds!" };
  }

  // Step 5: Create batches from temporary addresses to the user-provided address
  let remainingAmountToSend = sendAmount;
  let fromAddress = [],
    toAddress = [];
  for (let address of allUserAddress) {
    if (remainingAmountToSend <= 0) break;
    let transferAmount = Math.min(
      address.dataValues.amount,
      remainingAmountToSend
    );
    fromAddress.push({
      address: address.dataValues.wallet_address,
      privateKey: decrypt(address.dataValues.privateKey),
      value: transferAmount,
    });

    remainingAmountToSend -= transferAmount;
  }
  toAddress.push({
    address: address,
    value: sendAmount,
  });
  const singleFee = Number(fees) / fromAddress.length;
  fromAddress = fromAddress.map((address) => ({
    ...address,
    value: Number(address.value) - singleFee,
  }));

  const totalSendAmount = sendAmount;
  return {
    fromAddress,
    toAddress,
    totalSendAmount,
    permanentUserWalletAddress: userWallet.dataValues.wallet_address,
    tempAddresses,
    userWallet,
  };
};


