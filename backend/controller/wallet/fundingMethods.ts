import express from "express";
import {
  IFundData,
  IUserType,
} from "../../utils/types";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../../helper";
import { convertToMultiple } from "../../utils/currencyUtils";
import crypto from "crypto";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import { userWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";








export const getCurrencyRates = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { source, amount, currencyList, fixedDecimal = true } = req.body;
    if (typeof source !== "string" || !source.trim() || !Array.isArray(currencyList) || currencyList.length === 0 || currencyList.length > 50) {
      return errorResponseHelper(res, 400, "source (string) and currencyList (1-50 currency codes) are required");
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return errorResponseHelper(res, 400, "amount must be a non-negative number");
    }

    const currencyRateList = await convertToMultiple(source, currencyList, numericAmount, fixedDecimal);

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


