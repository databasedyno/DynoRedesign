import { raw as envRaw } from "../../utils/config";
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

export const cardPayment = async (
  data: IFundData,
  tokenData: IUserType,
  revalidate = false
) => {
  const expiry = data.expiry.split("/");
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  walletLogger.info("from card=============>", data);
  const payload = {
    card_number: data.number,
    expiry_month: expiry[0],
    expiry_year: expiry[1],
    cvv: data.cvc,
    currency: data.currency ?? "USD",
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    enckey: envRaw("FLW_ENCRYPTION_KEY"),
    ...(revalidate && {
      authorization: {
        mode: data.mode,
        ...(data.mode === "pin"
          ? { pin: data.pin }
          : {
            city: data.city,
            address: data.address,
            state: data.state,
            country: "IN",
            zipcode: data.zipcode,
          }),
      },
    }),
    redirect_url: `${envRaw("FRONTEND_URL") || envRaw("REACT_APP_FRONTEND_URL") || ''}/payment/verify`,
  };

  walletLogger.info("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.card(payload);

  return { paymentRes, uniqueRef };
};

export const bankTransfer = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  walletLogger.info("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.bank_transfer(payload);

  return { paymentRes, uniqueRef };
};

export const bankAccount = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  walletLogger.info("payload==========>", payload);

  let paymentRes: FW_API_Response;

  if (payload.currency === "NGN") {
    paymentRes = await flw.Charge.ng(payload);
  } else {
    paymentRes = await axios.post(
      "https://api.flutterwave.com/v3/charges?type=account-ach-uk",
      {
        ...payload,
        is_token_io: 1,
      },
      {
        headers: {
          Authorization: "Bearer " + envRaw("FLW_SECRET_KEY"),
        },
      }
    );
  }

  return { paymentRes, uniqueRef };
};

export const googleApplePay = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef + "_success_mock",
  };

  walletLogger.info("payload==========>", payload);

  const type =
    data.paymentType === paymentTypes.GOOGLE_PAY ? "googlepay" : "applepay";

  const response = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=" + type,
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + envRaw("FLW_SECRET_KEY"),
      },
    }
  );
  const paymentRes = response.data;

  return { paymentRes, uniqueRef };
};

export const USSD = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: "NGN",
    account_bank: data.account_number,
    amount: 200,
    email: tokenData.email,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
  };

  walletLogger.info("payload==========>", payload);

  const paymentRes = await flw.Charge.ussd(payload);

  return { paymentRes, uniqueRef };
};

export const MobileMoney = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  walletLogger.info(tokenData);
  const payload = {
    currency: data.currency,
    amount: data.amount,
    ...((data.currency === "UGX" || data.currency === "GHS") && {
      network: data.network,
    }),
    ...(data.currency === "RWF" && {
      order_id: uniqueRef,
    }),
    email: tokenData.email,
    phone_number: data.mobile,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    ...(data.currency !== "KES" && {
      redirect_url: `${envRaw("FRONTEND_URL") || 'http://localhost:3000'}/payment/verify`,
    }),
  };

  walletLogger.info("payload==========>", payload);
  let paymentRes;
  if (data.currency === "KES")
    paymentRes = await flw.MobileMoney.mpesa(payload);
  else if (data.currency === "GHS")
    paymentRes = await flw.MobileMoney.ghana(payload);
  else if (data.currency === "UGX")
    paymentRes = await flw.MobileMoney.uganda(payload);
  else if (data.currency === "RWF")
    paymentRes = await flw.MobileMoney.rwanda(payload);

  return { paymentRes, uniqueRef };
};

export const QRCode = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const payload = {
    currency: "NGN",
    amount: 200,
    email: tokenData.email,
    phone_number: tokenData.mobile,
    fullname: tokenData.name,
    tx_ref: uniqueRef,
    is_nqr: "1",
  };

  walletLogger.info("payload==========>", payload);

  const resData = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=qr",
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + envRaw("FLW_SECRET_KEY"),
      },
    }
  );

  const paymentRes = resData.data;

  return { paymentRes, uniqueRef };
};

export const getCurrencyRates = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { source, amount, currencyList, fixedDecimal = true } = req.body;

    const currencyRateList = await convertToMultiple(source, currencyList, amount, fixedDecimal);

    successResponseHelper(res, 200, "Currency rates retrieved successfully", currencyRateList);
  } catch (e) {
    const message = getErrorMessage(e);
    walletLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

export const Crypto = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = crypto.randomBytes(24).toString("hex");
  const currency = data.currency;
  const walletDetails = await (
    await userWalletModel.findOne({
      where: {
        wallet_type: currency,
        user_id: tokenData.user_id,
      },
    })
  ).dataValues;
  let cryptoData = walletDetails.wallet_address;
  if (currency === "BCH") {
    cryptoData = walletDetails.wallet_address.split(":")[1];
    walletLogger.info(cryptoData);
  }
  let qr_code;

  if (cryptoData) {
    qr_code = await generateQRCodeWithLogo(cryptoData, currency, 400);
  }

  const paymentRes = { qr_code, address: cryptoData };

  return { paymentRes, uniqueRef };
};


