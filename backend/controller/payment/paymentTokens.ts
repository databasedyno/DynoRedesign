/**
 * JWT token helpers for checkout/customer links.
 * Extracted verbatim from paymentController.ts (no behavior change).
 */
import { raw as envRaw } from "../../utils/config";
import jwt from "jsonwebtoken";
import { customerModel } from "../../models";
import { cronLogger } from "../../utils/loggers";

export const getLinkAccessToken = async (email, ref, pathType, id) => {
  const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");

  if (tokenSecret) {
    const token = jwt.sign({ email, ref, pathType, transaction_id: id }, tokenSecret);
    return token;
  }
};

export const getAccessToken = async (id, ref) => {
  const user = await customerModel.findOne({
    where: {
      customer_id: id,
    },
  });

  const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");

  const { customer_id, company_id, ...userData } = user.dataValues;
  cronLogger.info(userData);
  if (tokenSecret) {
    const token = jwt.sign({ ...userData, ref, pathType: "" }, tokenSecret);
    return token;
  }
};
