import express from "express";
import Joi from "joi";

const apiMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { company_id, base_currency, plan_name, amount, interval } = req.body;
  let validateFields, schema;
  const pathname = req.path;

  if (pathname.includes("addApi")) {
    validateFields = { company_id, base_currency };

    schema = {
      company_id: Joi.number().required().messages({
        "number.empty": "Company is Required",
      }),
      base_currency: Joi.string().required().messages({
        "string.empty": "Currency is Required",
      }),
    };
  } else if (pathname.includes("createPlan")) {
    validateFields = { plan_name, amount, interval, company_id };

    schema = {
      plan_name: Joi.string().required().messages({
        "string.empty": "Currency is Required",
      }),

      amount: Joi.number()
        .required()
        .min(5)
        .messages({
          "number.min": `Amount must be greater then or equal to ${5}`,
        }),
      interval: Joi.string().valid("monthly", "yearly").required(),
      company_id: Joi.number().required().messages({
        "number.empty": "Company is Required",
      }),
    };
  }
  const validationSchema = Joi.object({ ...schema });

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

export default apiMiddleware;
