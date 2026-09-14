import express from "express";
import Joi from "joi";
// IUserType import removed - not used

const walletMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const method = req.method;

  if (method === "GET") {
    return next();
  }

  let validateFields;
  let schema: Joi.PartialSchemaMap<any>;

  const pathname = req.path;

  if (pathname.includes("exchangeCreate")) {
    const {
      mobile,
      email,
      customer_id,
      username,
      identifier,
      wallet_address,
      req_currency,
      exchange_currency,
      amount_in_usd,
    } = req.body;

    schema = {
      mobile: Joi.string().when("identifier", {
        is: "MOBILE",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      email: Joi.string().email().when("identifier", {
        is: "EMAIL",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      customer_id: Joi.string().when("identifier", {
        is: "CUSTOMER_ID",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      username: Joi.string().when("identifier", {
        is: "USERNAME",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      wallet_address: Joi.string().when("identifier", {
        is: "WALLET_ADDRESS",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      identifier: Joi.string()
        .valid("MOBILE", "CUSTOMER_ID", "EMAIL", "USERNAME", "WALLET_ADDRESS")
        .required(),
      req_currency: Joi.string().required(),
      exchange_currency: Joi.string().required(),
      amount_in_usd: Joi.number().required(),
    };
    validateFields = {
      mobile,
      email,
      customer_id,
      username,
      identifier,
      wallet_address,
      req_currency,
      exchange_currency,
      amount_in_usd,
    };
  } else if (pathname.includes("confirmExchange")) {
    const { otp1, otp2, id } = req.body;
    schema = {
      otp1: Joi.number().required(),
      otp2: Joi.number().required(),
      id: Joi.string().required(),
    };
    validateFields = {
      otp1,
      otp2,
      id,
    };
  } else {
    return next();
  }

  const validationSchema = Joi.object({
    ...schema,
  });

  const validationResult = validationSchema.validate(validateFields, {
    abortEarly: false,
  });

  if (validationResult.error && validationResult.error?.details.length !== 0) {
    const errors = validationResult.error.details.map((x) => {
      return { key: x.context.key, error: x.message };
    });
    return res.status(400).json({
      message: "Please enter proper values!",
      errors,
    });
  }
  next();
};

export default walletMiddleware;
