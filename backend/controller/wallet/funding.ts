import { Crypto } from "./fundingMethods";
import express from "express";
import jwt from "jsonwebtoken";
import {
  IFundData,
  IUserType,
} from "../../utils/types";
import {
  decrypt,
  successResponseHelper,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import {
  setRedisItem,
} from "../../utils/redisInstance";
import { paymentTypes } from "../../utils/enums";
import { walletLogger } from "../../utils/loggers";
import { PaymentState, toRedisStatus } from "../../services/paymentStateMachine";

export const addFunds = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { data } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (data) {
      const value: IFundData = JSON.parse(decrypt(data));
      if (typeof value === "object") {
        let finalRes;
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





