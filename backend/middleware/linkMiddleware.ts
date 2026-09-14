import express from "express";
import Joi from "joi";
// LanguageMessages import removed - not used
import { paymentTypes } from "../utils/enums";

const linkMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { 
    email, 
    base_currency,  // NEW format (recommended)
    currency,       // LEGACY format (backward compatibility)
    amount,         // Both formats use 'amount'
    base_amount,    // Alternative field name
    modes,
    link_type       // Check if this is a donation link
  } = req.body;

  // Donation links don't require amount (donors choose amount)
  const isDonation = String(link_type || '').toLowerCase() === 'donation';

  // Support both new and legacy field names
  // Priority: base_currency > currency > 'USD' (default)
  const normalizedCurrency = base_currency || currency || 'USD';
  // Priority: base_amount > amount
  const normalizedAmount = base_amount || amount;
  // Default modes to ['CRYPTO'] if not provided
  const normalizedModes = modes || ['CRYPTO'];

  // Update req.body with normalized/defaulted values
  req.body.currency = normalizedCurrency;
  req.body.base_currency = normalizedCurrency;
  req.body.modes = normalizedModes;

  const validateFields = { 
    email, 
    currency: normalizedCurrency, 
    amount: normalizedAmount, 
    modes: normalizedModes 
  };

  const allowedCurrency = [
    // Fiat - Major International
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "CAD",
    "CHF",
    "CNY",
    "JPY",
    "HKD",
    "NZD",
    "SGD",  // Singapore Dollar
    // Fiat - South & Southeast Asia
    "INR",  // Indian Rupee
    "PKR",  // Pakistani Rupee
    "AED",  // UAE Dirham
    "SAR",  // Saudi Riyal
    "PHP",  // Philippine Peso
    "THB",  // Thai Baht
    "IDR",  // Indonesian Rupiah
    "MYR",  // Malaysian Ringgit
    "VND",  // Vietnamese Dong
    "KRW",  // South Korean Won
    "TWD",  // Taiwan Dollar
    // Fiat - European (non-EUR)
    "SEK",  // Swedish Krona
    "NOK",  // Norwegian Krone
    "DKK",  // Danish Krone
    "PLN",  // Polish Zloty
    "CZK",  // Czech Koruna
    "HUF",  // Hungarian Forint
    "RON",  // Romanian Leu
    "TRY",  // Turkish Lira
    "ILS",  // Israeli Shekel
    // Fiat - Latin America (high crypto adoption)
    "BRL",  // Brazilian Real
    "ARS",  // Argentine Peso
    "COP",  // Colombian Peso
    "CLP",  // Chilean Peso
    "PEN",  // Peruvian Sol
    "MXN",  // Mexican Peso
    "VES",  // Venezuelan Bolívar
    "UYU",  // Uruguayan Peso
    // Fiat - African (high crypto adoption regions)
    "NGN",  // Nigerian Naira (#1 Africa, #2 Global)
    "ZAR",  // South African Rand (#5 Africa)
    "KES",  // Kenyan Shilling (#4 Africa)
    "GHS",  // Ghanaian Cedi (#9 Africa)
    "TZS",  // Tanzanian Shilling
    "XAF",  // CFA Franc BEAC (Cameroon, Chad, CAR, Congo, Gabon, Eq. Guinea)
    "XOF",  // CFA Franc BCEAO (Senegal, Ivory Coast, Benin, Burkina Faso, Mali, Niger, Togo, Guinea-Bissau)
    "EGP",  // Egyptian Pound
    "MAD",  // Moroccan Dirham
    "UGX",  // Ugandan Shilling
    "RWF",  // Rwandan Franc
    "ETB",  // Ethiopian Birr
    "ZMW",  // Zambian Kwacha
    "BWP",  // Botswanan Pula
    "MUR",  // Mauritian Rupee
    "AOA",  // Angolan Kwanza
    "MZN",  // Mozambican Metical
    "CDF",  // Congolese Franc (DRC)
    // Crypto
    "BTC",
    "LTC",
    "DOGE",
  ];
  const allowedModes = [
    ...Object.keys(paymentTypes).filter((x) => x !== "WALLET" && x),
  ];

  const schema = {
    email: Joi.string().optional().email().allow('', null).messages({
      "string.email": "Please provide a valid email address",
    }),

    // Amount is required for standard links, but optional for donation links
    amount: isDonation 
      ? Joi.number().optional().allow(null)
      : Joi.number()
          .required()
          .min(0.01)
          .messages({
            "number.min": `Amount must be greater than 0`,
            "any.required": "Amount is required. Please provide either 'amount' or 'base_amount' field.",
          }),
    currency: Joi.string()
      .optional()
      .valid(...allowedCurrency)
      .default('USD')
      .messages({
        "any.only": `Currency must be one of: ${allowedCurrency.join(', ')}`,
      }),
    modes: Joi.array()
      .optional()
      .items(Joi.string().valid(...allowedModes))
      .default(['CRYPTO']),
  };

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

export default linkMiddleware;
