/**
 * Merchant API Router (unified)
 * 
 * Single source of truth for all merchant-facing API endpoints.
 * All endpoints use direct DB/controller calls — no HTTP self-calls.
 * 
 * Auth: x-api-key header (required) + customer JWT (optional for some endpoints)
 * 
 * Endpoints:
 *   POST /api/user/createUser          - Create a customer
 *   POST /api/user/cryptoPayment       - Create a direct crypto payment (returns QR + address)
 *   POST /api/user/createPayment       - Create a checkout payment (returns redirect URL)
 *   POST /api/user/addFunds            - Add funds to customer wallet (returns redirect URL)
 *   POST /api/user/useWallet           - Debit from customer wallet
 *   GET  /api/user/getBalance          - Get customer wallet balance
 *   GET  /api/user/getTransactions     - Get customer transaction history
 *   GET  /api/user/getSingleTransaction/:id - Get single transaction
 *   GET  /api/user/getCryptoTransaction/:address - Verify crypto payment by address
 *   GET  /api/user/getSupportedCurrency - Get supported currencies
 *
 * Phase 5: responses go through sendSuccess/sendError and handlers are wrapped
 * with asyncHandler (removing per-handler try/catch). Response shapes are
 * byte-identical to the previous hand-written envelopes.
 */

import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import Crypto from "crypto";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { getEffectiveMinOrderUsd } from "../services/checkout/orderMinimums";
import legacyApiAuthMiddleware, { validateApiKey } from "../middleware/legacyApiAuthMiddleware";
import idempotencyMiddleware from "../middleware/idempotencyMiddleware";
import { setRedisItem } from "../utils/redisInstance";
import { convertToMultiple } from "../utils/currencyUtils";
import { paymentController } from "../controller";
import { parseState, toExternalStatus, toConversionDisplayStatus } from "../services/paymentStateMachine";
import { sendSuccess, sendError, asyncHandler } from "../helper/apiResponse";
import config from "../utils/config";
import { toFixedStr } from "../utils/money";
import { buildPaymentObject } from "../utils/paymentObject";

const router = express.Router();

// Supported crypto types
const CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];

// Helper to get available currencies for a company
const getAvailableCurrencies = async (userId: number, companyId: number): Promise<string[]> => {
  const wallets = await sequelize.query<{ wallet_type: string }>(
    `SELECT DISTINCT wallet_type FROM tbl_user_wallet 
     WHERE user_id = $1 
     AND company_id = $2 
     AND wallet_type IN (${CRYPTO_TYPES.map((_, i) => `$${i + 3}`).join(',')})
     AND wallet_address IS NOT NULL`,
    {
      bind: [userId, companyId, ...CRYPTO_TYPES],
      type: QueryTypes.SELECT,
    }
  );
  return wallets.map((w) => w.wallet_type);
};

/**
 * Find customer by UUID, or auto-recreate if deleted.
 * When a merchant's customer JWT is valid but the DB record was deleted,
 * this re-inserts the customer so payments can proceed without a 400.
 */
const findOrRecreateCustomer = async (
  userUuid: string,
  email: string | undefined,
  companyId: number,
  baseCurrency: string
): Promise<{ customer_id: number }> => {
  // 1. Try to find the existing customer
  const existing = await sequelize.query<{ customer_id: number }>(
    `SELECT customer_id FROM tbl_customer WHERE id = $1`,
    { bind: [userUuid], type: QueryTypes.SELECT }
  );
  if (existing.length > 0) return existing[0];

  // 2. Customer was deleted — recreate the record with the same UUID
  const fallbackEmail = email || `recovered-${userUuid.slice(0, 8)}@dynopay.internal`;
  apiLogger.info(`[MerchantAPI] Auto-recreating deleted customer ${userUuid} for company ${companyId}`);

  await sequelize.query(
    `INSERT INTO tbl_customer (id, customer_name, email, company_id, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    { bind: [userUuid, 'Recovered Customer', fallbackEmail, companyId], type: QueryTypes.INSERT }
  );

  const created = await sequelize.query<{ customer_id: number }>(
    `SELECT customer_id FROM tbl_customer WHERE id = $1`,
    { bind: [userUuid], type: QueryTypes.SELECT }
  );

  if (created.length === 0) {
    throw new Error('Failed to recreate customer record');
  }

  // 3. Create a wallet for the recovered customer
  const walletId = Crypto.randomUUID();
  await sequelize.query(
    `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 0, NOW(), NOW())`,
    { bind: [walletId, created[0].customer_id, baseCurrency], type: QueryTypes.INSERT }
  );

  apiLogger.info(`[MerchantAPI] Recreated customer ${userUuid} → customer_id ${created[0].customer_id}`);
  return created[0];
};

/**
 * API Key validation middleware (for endpoints that don't need customer auth)
 */
const apiKeyOnlyMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    
    if (!apiKey) {
      return sendError(res, {
        status: 401,
        message: "API key is required in x-api-key header",
        type: "authentication_error",
        code: "api_key_missing",
      });
    }
    
    const apiKeyData = await validateApiKey(apiKey);
    if (!apiKeyData) {
      return sendError(res, {
        status: 401,
        message: "Invalid API key",
        type: "authentication_error",
        code: "api_key_invalid",
      });
    }
    
    res.locals.apiKeyData = apiKeyData;
    next();
  } catch (error) {
    apiLogger.error("[MerchantAPI] apiKeyOnly error:", error);
    return sendError(res, {
      status: 500,
      message: "API key validation error",
    });
  }
};

// ============================================================
// POST /api/user/createUser
// Create a new customer for the merchant
// ============================================================
router.post("/createUser", apiKeyOnlyMiddleware, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const { name, email, mobile } = req.body;
  const data = res.locals.apiKeyData;

  if (!email || !name) {
    return sendError(res, {
      status: 400,
      message: "Name and email are required",
      code: "parameter_missing",
      param: !name ? "name" : "email",
      extra: {
        errors: [
          !name ? { key: "name", error: "Name is Required" } : null,
          !email ? { key: "email", error: "Email is Required" } : null
        ].filter(Boolean),
      },
    });
  }

  // Check if customer already exists for this company
  const existingCustomer = await sequelize.query<{ id: string; customer_id: number }>(
    `SELECT id, customer_id FROM tbl_customer WHERE email = $1 AND company_id = $2`,
    {
      bind: [email, data.company_id],
      type: QueryTypes.SELECT
    }
  );

  if (existingCustomer.length > 0) {
    const tokenSecret = config.accessTokenSecret;
    if (!tokenSecret) {
      return sendError(res, { status: 500, message: "Server configuration error" });
    }

    const token = jwt.sign({
      id: existingCustomer[0].id,
      customer_id: existingCustomer[0].customer_id,
      email,
      company_id: data.company_id
    }, tokenSecret);

    return sendSuccess(res, {
      status: 200,
      message: "Customer already exists",
      data: { token, customer_id: existingCustomer[0].id },
    });
  }

  const customerId = Crypto.randomUUID();

  await sequelize.query(
    `INSERT INTO tbl_customer (id, customer_name, email, mobile, company_id, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
    {
      bind: [customerId, name, email, mobile || null, data.company_id],
      type: QueryTypes.INSERT
    }
  );

  const newCustomer = await sequelize.query<{ customer_id: number }>(
    `SELECT customer_id FROM tbl_customer WHERE id = $1`,
    {
      bind: [customerId],
      type: QueryTypes.SELECT
    }
  );

  const walletId = Crypto.randomUUID();
  await sequelize.query(
    `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 0, NOW(), NOW())`,
    {
      bind: [walletId, newCustomer[0].customer_id, data.base_currency || 'USD'],
      type: QueryTypes.INSERT
    }
  );

  const tokenSecret = config.accessTokenSecret;
  if (!tokenSecret) {
    return sendError(res, { status: 500, message: "Server configuration error" });
  }

  const token = jwt.sign({
    id: customerId,
    customer_id: newCustomer[0].customer_id,
    email,
    company_id: data.company_id
  }, tokenSecret);

  apiLogger.info(`[MerchantAPI] Created customer ${customerId} for company ${data.company_id}`);

  return sendSuccess(res, {
    status: 200,
    message: "Registered Successful!",
    data: { token, customer_id: customerId },
  });
}, { logger: apiLogger, label: "[MerchantAPI] createUser" }));

// ============================================================
// POST /api/user/cryptoPayment
// Create a direct crypto payment (returns QR code + address)
// ============================================================
router.post("/cryptoPayment", legacyApiAuthMiddleware, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const data = res.locals.apiKeyData;

  const {
    amount,
    currency,
    redirect_uri,
    meta_data,
    topUp = false,
    fee_payer = 'company',
    callback_url,
    webhook_url,
    accepted_currencies,
  } = req.body;

  apiLogger.info(`[MerchantAPI] cryptoPayment body keys: ${Object.keys(req.body).join(', ')}`);

  if (!amount || amount <= 0) {
    return sendError(res, {
      status: 400,
      message: "Valid payment amount is required",
      code: "amount_invalid",
      param: "amount",
    });
  }

  if (!currency) {
    return sendError(res, {
      status: 400,
      message: "Currency is required",
      code: "currency_required",
      param: "currency",
      extra: { available_currencies: CRYPTO_TYPES },
    });
  }

  const allConfiguredCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);

  if (allConfiguredCurrencies.length === 0) {
    return sendError(res, {
      status: 400,
      message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment.",
      code: "no_wallet_configured",
    });
  }

  let effectiveAvailableCurrencies = allConfiguredCurrencies;

  if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
    const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
    const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));

    if (unconfiguredCurrencies.length > 0) {
      return sendError(res, {
        status: 400,
        message: `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Available currencies: ${allConfiguredCurrencies.join(', ')}`,
        code: "currency_not_available",
        param: "accepted_currencies",
      });
    }

    effectiveAvailableCurrencies = requestedCurrencies;
  }

  const normalizedCurrency = currency.toUpperCase().trim();
  if (!effectiveAvailableCurrencies.includes(normalizedCurrency)) {
    return sendError(res, {
      status: 400,
      message: `${currency} is not available for this payment. Available currencies: ${effectiveAvailableCurrencies.join(', ')}`,
      code: "currency_not_available",
      param: "currency",
    });
  }

  const customerData = await findOrRecreateCustomer(
    userData.id, userData.email, data.company_id, data.base_currency || 'USD'
  );

  // Direct currency conversion (no HTTP self-call)
  const localCurrency = normalizedCurrency.includes("USDT") ? "usdt" : normalizedCurrency.toLowerCase();
  let cryptoRates;
  try {
    cryptoRates = await convertToMultiple(
      data.base_currency || 'USD',
      [localCurrency],
      amount,
      false,
    );
  } catch (rateError) {
    apiLogger.error("[MerchantAPI] Currency rate error:", rateError);
    return sendError(res, { status: 500, message: "Failed to get currency rates", code: "rate_unavailable" });
  }

  if (!cryptoRates || cryptoRates.length === 0 || !cryptoRates[0]?.amount) {
    return sendError(res, { status: 500, message: "Failed to get currency conversion rate", code: "rate_unavailable" });
  }

  const cryptoAmount = cryptoRates[0].amount;

  const effectiveWebhookUrl = webhook_url || data.webhook_url || null;
  const effectiveWebhookSecret = data.webhook_secret || null;

  apiLogger.info(`[MerchantAPI] cryptoPayment - Company: ${data.company_id}, Amount: ${amount}, Currency: ${normalizedCurrency}`);
  apiLogger.info(`[MerchantAPI] webhook_url from body: ${webhook_url || 'NOT PROVIDED'}`);
  apiLogger.info(`[MerchantAPI] webhook_url from API key: ${data.webhook_url || 'NOT SET'}`);
  apiLogger.info(`[MerchantAPI] effectiveWebhookUrl: ${effectiveWebhookUrl || 'NULL'}`);
  apiLogger.info(`[MerchantAPI] callback_url: ${callback_url || 'NOT PROVIDED'}`);

  const redisPayload = {
    customer_id: customerData.customer_id,
    company_id: data.company_id,
    adm_id: data.adm_id,
    base_currency: data.base_currency || 'USD',
    base_amount: amount,
    amount: amount,
    pathType: topUp ? "addFund" : "cryptoPayment",
    redirect_uri,
    fee_payer: fee_payer,
    available_currencies: effectiveAvailableCurrencies,
    all_configured_currencies: allConfiguredCurrencies,
    webhook_url: effectiveWebhookUrl,
    webhook_secret: effectiveWebhookSecret,
    callback_url: callback_url || null,
    // Cached exchange rate avoids redundant ~100-300ms FastForex call in createCryptoPayment
    cached_transfer_rate: cryptoRates[0]?.transferRate || null,
    cached_crypto_amount: cryptoRates[0]?.amount || null,
    cached_crypto_currency: normalizedCurrency,
    ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
  };

  const transactionId = Crypto.randomBytes(24).toString("hex");
  await setRedisItem("customer-" + transactionId, redisPayload);

  // Direct controller call (no HTTP self-call)
  const paymentBody = {
    uniqueRef: transactionId,
    amount: cryptoAmount,
    currency: normalizedCurrency,
  };

  let capturedData: Record<string, unknown> | null = null;
  let capturedStatus = 200;

  const mockRes = {
    locals: { token: res.locals.token },
    status(code: number) {
      capturedStatus = code;
      return {
        json(body: unknown) {
          capturedData = body as Record<string, unknown>;
          return this;
        }
      };
    },
  } as unknown as express.Response;

  const mockReq = { ...req, body: paymentBody } as express.Request;

  await paymentController.createCryptoPayment(mockReq, mockRes);

  if (capturedStatus !== 200 || !capturedData) {
    apiLogger.error("[MerchantAPI] createCryptoPayment failed:", capturedData);
    return sendError(res, {
      status: capturedStatus || 500,
      message: ((capturedData as Record<string, unknown>)?.message as string) || "Failed to create crypto payment",
    });
  }

  const paymentData = (capturedData as Record<string, unknown>).data as Record<string, unknown>;
  const { qr_code, address, transaction_id, destination_tag } = paymentData;

  apiLogger.info(`[MerchantAPI] Payment created - TX: ${transaction_id}, Address: ${address}${destination_tag ? `, Tag: ${destination_tag}` : ''}`);

  const responseAddress = normalizedCurrency === "BCH" && address && !String(address).startsWith("bitcoincash:") ? "bitcoincash:" + address : address;

  return sendSuccess(res, {
    status: 200,
    message: "Payment Created!",
    data: {
      transaction_id,
      qr_code,
      address: responseAddress,
      amount: cryptoAmount,
      currency: normalizedCurrency,
      base_amount: amount,
      base_currency: data.base_currency || 'USD',
      redirect_uri,
      // XRP/RLUSD: Include destination tag so merchant can display it to customer
      ...(destination_tag && { destination_tag: Number(destination_tag) }),
      // API review §5.3.1 — first-class payment object (additive).
      payment: buildPaymentObject({
        id: String(transaction_id),
        status: 'waiting',
        hostedUrl: null,
        redirectUrl: redirect_uri ?? null,
        baseAmount: amount,
        baseCurrency: data.base_currency || 'USD',
        cryptoAmount: cryptoAmount as number | string | null,
        cryptoCurrency: normalizedCurrency,
        cryptoAddress: responseAddress as string | null,
        destinationTag: destination_tag ? Number(destination_tag) : null,
        createdAt: new Date().toISOString(),
      }),
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] cryptoPayment" }));

// ============================================================
// POST /api/user/createPayment
// Create a checkout payment (returns redirect URL for hosted checkout page)
// ============================================================
router.post("/createPayment", legacyApiAuthMiddleware, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const data = res.locals.apiKeyData;

  const {
    amount,
    redirect_uri,
    meta_data,
    fee_payer,
    callback_url,
    webhook_url,
    accepted_currencies,
  } = req.body;

  const apiMinUsd = getEffectiveMinOrderUsd("api");
  if (!amount || amount < apiMinUsd) {
    return sendError(res, {
      status: 400,
      message: `Amount must be greater than or equal to ${apiMinUsd}`,
      code: "amount_below_minimum",
      param: "amount",
    });
  }

  if (!redirect_uri) {
    return sendError(res, {
      status: 400,
      message: "redirect_uri is required",
      code: "parameter_missing",
      param: "redirect_uri",
    });
  }

  const allConfiguredCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);

  if (allConfiguredCurrencies.length === 0) {
    return sendError(res, {
      status: 400,
      message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment.",
      code: "no_wallet_configured",
    });
  }

  let effectiveAvailableCurrencies = allConfiguredCurrencies;

  if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
    const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
    const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
    if (unconfiguredCurrencies.length > 0) {
      return sendError(res, {
        status: 400,
        message: `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Available currencies: ${allConfiguredCurrencies.join(', ')}`,
        code: "currency_not_available",
        param: "accepted_currencies",
      });
    }
    effectiveAvailableCurrencies = requestedCurrencies;
  }

  const customerData = await findOrRecreateCustomer(
    userData.id, userData.email, data.company_id, data.base_currency || 'USD'
  );

  const effectiveWebhookUrl = webhook_url || data.webhook_url || null;
  const effectiveWebhookSecret = data.webhook_secret || null;

  apiLogger.info(`[MerchantAPI] createPayment - Company: ${data.company_id}, Amount: ${amount}`);

  const redisPayload = {
    customer_id: customerData.customer_id,
    company_id: data.company_id,
    adm_id: data.adm_id,
    base_currency: data.base_currency || 'USD',
    base_amount: amount,
    amount: amount,
    redirect_uri,
    pathType: "createPayment",
    fee_payer: fee_payer || 'company',
    available_currencies: effectiveAvailableCurrencies,
    all_configured_currencies: allConfiguredCurrencies,
    webhook_url: effectiveWebhookUrl,
    webhook_secret: effectiveWebhookSecret,
    callback_url: callback_url || null,
    ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
  };

  const transactionId = Crypto.randomBytes(24).toString("hex");
  await setRedisItem("customer-" + transactionId, redisPayload);

  const checkoutUrl = config.checkoutUrl;
  const redirect_url = checkoutUrl + "/pay?d=" + transactionId;

  return sendSuccess(res, {
    status: 200,
    message: "Link Generated!",
    data: {
      redirect_url,
      fee_payer: redisPayload.fee_payer,
      available_currencies: effectiveAvailableCurrencies,
      webhook_url: effectiveWebhookUrl ? 'configured' : 'not configured',
      // API review §5.3.1 — first-class payment object (additive; existing
      // fields above are unchanged). id is now returned explicitly, not only
      // inside redirect_url.
      payment: buildPaymentObject({
        id: transactionId,
        status: 'waiting',
        hostedUrl: redirect_url,
        redirectUrl: redirect_url,
        baseAmount: amount,
        baseCurrency: redisPayload.base_currency,
        metadata: meta_data ?? null,
        createdAt: new Date().toISOString(),
      }),
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] createPayment" }));

// ============================================================
// POST /api/user/embed/session
// Create an EMBEDDED checkout session for Dynopay Embedded Checkout (embed.js).
// Auth: SECRET api key (x-api-key) — call this from your SERVER only.
// Returns a payment-method-agnostic shape. The `client_secret` is an opaque
// handle loaded by embed.js in an iframe (it is NOT the api key). Reuses the
// exact hosted-checkout flow (pathType "createPayment") so the /pay page renders
// identically; only creates a Redis session (no address is reserved yet).
// ============================================================
router.post("/embed/session", legacyApiAuthMiddleware, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const data = res.locals.apiKeyData;

  const {
    amount,
    redirect_uri,
    meta_data,
    fee_payer,
    callback_url,
    webhook_url,
    accepted_currencies,
    allowed_origins,
  } = req.body;

  if (!amount || amount < 5) {
    return sendError(res, {
      status: 400,
      message: "Amount must be greater than or equal to 5",
    });
  }

  const allConfiguredCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);

  if (allConfiguredCurrencies.length === 0) {
    return sendError(res, {
      status: 400,
      message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment.",
    });
  }

  let effectiveAvailableCurrencies = allConfiguredCurrencies;

  if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
    const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
    const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
    if (unconfiguredCurrencies.length > 0) {
      return sendError(res, {
        status: 400,
        message: `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Available currencies: ${allConfiguredCurrencies.join(', ')}`,
      });
    }
    effectiveAvailableCurrencies = requestedCurrencies;
  }

  const customerData = await findOrRecreateCustomer(
    userData.id, userData.email, data.company_id, data.base_currency || 'USD'
  );

  const effectiveWebhookUrl = webhook_url || data.webhook_url || null;
  const effectiveWebhookSecret = data.webhook_secret || null;

  // Normalize merchant origins (stored for future frame-ancestors enforcement).
  let normalizedOrigins: string[] | null = null;
  if (Array.isArray(allowed_origins) && allowed_origins.length > 0) {
    normalizedOrigins = allowed_origins
      .map((o: string) => { try { return new URL(o).origin; } catch { return null; } })
      .filter((o): o is string => !!o);
  }

  const redisPayload = {
    customer_id: customerData.customer_id,
    company_id: data.company_id,
    adm_id: data.adm_id,
    base_currency: data.base_currency || 'USD',
    base_amount: amount,
    amount: amount,
    redirect_uri: redirect_uri || null,
    pathType: "createPayment",
    fee_payer: fee_payer || 'company',
    available_currencies: effectiveAvailableCurrencies,
    all_configured_currencies: allConfiguredCurrencies,
    webhook_url: effectiveWebhookUrl,
    webhook_secret: effectiveWebhookSecret,
    callback_url: callback_url || null,
    ui_mode: 'embedded',
    allowed_origins: normalizedOrigins,
    ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
  };

  const transactionId = Crypto.randomBytes(24).toString("hex");
  await setRedisItem("customer-" + transactionId, redisPayload);

  const checkoutUrl = config.str("CHECKOUT_URL") || config.publicBaseUrl || 'https://checkout.dynopay.com';
  const client_secret = transactionId;
  const checkout_url = checkoutUrl + "/pay?d=" + transactionId + "&embed=1";
  const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  apiLogger.info(`[MerchantAPI] embed/session - Company: ${data.company_id}, Amount: ${amount}`);

  return sendSuccess(res, {
    status: 200,
    message: "Embedded checkout session created",
    data: {
      client_secret,
      checkout_url,
      expires_at,
      ui_mode: 'embedded',
      fee_payer: redisPayload.fee_payer,
      payment_methods: [
        { type: 'crypto', currencies: effectiveAvailableCurrencies },
      ],
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] embed/session" }));

// ============================================================
// POST /api/user/addFunds
// Add funds to customer wallet (returns redirect URL)
// ============================================================
router.post("/addFunds", legacyApiAuthMiddleware, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const data = res.locals.apiKeyData;

  const { amount, redirect_uri, fee_payer } = req.body;

  if (!amount || amount < 5) {
    return sendError(res, {
      status: 400,
      message: "Amount must be greater than or equal to 5",
    });
  }

  if (!redirect_uri) {
    return sendError(res, {
      status: 400,
      message: "redirect_uri is required",
    });
  }

  const availableCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);

  if (availableCurrencies.length === 0) {
    return sendError(res, {
      status: 400,
      message: "No crypto wallet configured. Please add at least one crypto wallet address before adding funds.",
    });
  }

  const customerData = await findOrRecreateCustomer(
    userData.id, userData.email, data.company_id, data.base_currency || 'USD'
  );

  const redisPayload = {
    customer_id: customerData.customer_id,
    company_id: data.company_id,
    adm_id: data.adm_id,
    base_currency: data.base_currency || 'USD',
    base_amount: amount,
    amount: amount,
    redirect_uri,
    pathType: "addFund",
    fee_payer: fee_payer || 'company',
    available_currencies: availableCurrencies,
  };

  const transactionId = Crypto.randomBytes(24).toString("hex");
  await setRedisItem("customer-" + transactionId, redisPayload);

  const checkoutUrl = config.checkoutUrl;
  const redirect_url = checkoutUrl + "/pay?d=" + transactionId;

  return sendSuccess(res, {
    status: 200,
    message: "Link Generated!",
    data: {
      redirect_url,
      fee_payer: redisPayload.fee_payer,
      available_currencies: availableCurrencies,
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] addFunds" }));

// ============================================================
// POST /api/user/useWallet
// Debit amount from customer wallet
// ============================================================
router.post("/useWallet", legacyApiAuthMiddleware, idempotencyMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const data = res.locals.apiKeyData;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return sendError(res, {
      status: 400,
      message: "Please add a valid amount",
    });
  }

  const customerResult = await findOrRecreateCustomer(
    userData.id, userData.email, data.company_id, data.base_currency || 'USD'
  );

  const customerId = customerResult.customer_id;

  // Get wallet balance
  const walletData = await sequelize.query<{ amount: number; wallet_type: string }>(
    `SELECT amount, wallet_type FROM tbl_customer_wallet WHERE customer_id = $1 LIMIT 1`,
    {
      bind: [customerId],
      type: QueryTypes.SELECT
    }
  );

  if (walletData.length === 0) {
    return sendError(res, { status: 404, message: "Wallet not found" });
  }

  if (walletData[0].amount < amount) {
    return sendError(res, { status: 400, message: "Insufficient Balance!" });
  }

  const newAmount = toFixedStr(Number(walletData[0].amount) - Number(amount), 2);

  // Debit wallet
  await sequelize.query(
    `UPDATE tbl_customer_wallet SET amount = $1, "updatedAt" = NOW() WHERE customer_id = $2`,
    {
      bind: [newAmount, customerId],
      type: QueryTypes.UPDATE
    }
  );

  // Get company name for transaction details
  const companyData = await sequelize.query<{ company_name: string }>(
    `SELECT company_name FROM tbl_company WHERE company_id = $1`,
    {
      bind: [data.company_id],
      type: QueryTypes.SELECT
    }
  );

  const companyName = companyData.length > 0 ? companyData[0].company_name : 'Unknown';

  // Create transaction record
  const txId = Crypto.randomUUID();
  const txRef = Crypto.randomUUID();

  await sequelize.query(
    `INSERT INTO tbl_customer_transaction 
     (id, company_id, customer_id, payment_mode, base_amount, base_currency, 
      paid_amount, paid_currency, transaction_type, transaction_details, 
      transaction_reference, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'WALLET', $4, $5, $4, $5, 'DEBIT', $6, $7, 'successful', NOW(), NOW())`,
    {
      bind: [
        txId,
        data.company_id,
        customerId,
        toFixedStr(amount, 2),
        data.base_currency || 'USD',
        `wallet transaction on ${companyName}`,
        txRef
      ],
      type: QueryTypes.INSERT
    }
  );

  apiLogger.info(`[MerchantAPI] useWallet - Debited ${amount} from customer ${customerId}`);

  return sendSuccess(res, {
    status: 200,
    message: "amount debited successfully!",
    data: {
      new_balance: newAmount,
      transaction_id: txId,
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] useWallet" }));

// ============================================================
// GET /api/user/getBalance
// Get customer wallet balance
// ============================================================
router.get("/getBalance", legacyApiAuthMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;

  const wallets = await sequelize.query<{ wallet_type: string; amount: number }>(
    `SELECT wallet_type, amount FROM tbl_customer_wallet 
     WHERE customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)`,
    {
      bind: [userData.id],
      type: QueryTypes.SELECT
    }
  );

  return sendSuccess(res, {
    status: 200,
    message: "Balance retrieved",
    data: wallets,
  });
}, { logger: apiLogger, label: "[MerchantAPI] getBalance" }));

// ============================================================
// GET /api/user/getTransactions
// Get customer transaction history
// ============================================================
router.get("/getTransactions", legacyApiAuthMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const apiKeyData = res.locals.apiKeyData;
  const baseCurrency = apiKeyData?.base_currency || "USD";
  const { page = 1, limit = 10, starting_after } = req.query;
  const effLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const offset = (Number(page) - 1) * effLimit;

  // Cursor pagination (API review §5.3.3): `starting_after=<payment_id>` walks
  // the list by keyset over (createdAt, id) DESC — stable under new inserts.
  // Legacy `page`/`limit` offset mode still works unchanged. Both fetch one
  // extra row to compute `has_more`.
  const useCursor = typeof starting_after === "string" && starting_after.length > 0;
  let cursorCreatedAt: string | null = null;
  let cursorId: string | null = null;
  if (useCursor) {
    const cur = await sequelize.query<{ createdAt: string; id: string }>(
      `SELECT "createdAt", id FROM tbl_customer_transaction
        WHERE id = $1 AND customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $2)
        LIMIT 1`,
      { bind: [starting_after, userData.id], type: QueryTypes.SELECT }
    );
    if (cur.length > 0) {
      const rawCreatedAt = (cur[0] as { createdAt: unknown }).createdAt;
      // Sequelize returns timestamptz as a JS Date; bind an ISO string so
      // Postgres can parse it as $2::timestamptz (String(Date) is not valid SQL).
      cursorCreatedAt = new Date(rawCreatedAt as string | number | Date).toISOString();
      cursorId = cur[0].id;
    }
  }

  const TX_SELECT_FROM = `SELECT ct.*,
      sc.conversion_id as auto_convert_id,
      sc.status as auto_convert_status,
      sc.source_currency as auto_convert_source_currency,
      sc.source_amount as auto_convert_source_amount,
      sc.source_amount_usd as auto_convert_source_amount_usd,
      sc.target_currency as auto_convert_target_currency,
      sc.target_amount as auto_convert_target_amount,
      sc.settlement_chain as auto_convert_settlement_chain,
      sc.conversion_rate as auto_convert_rate,
      sc.completed_at as auto_convert_completed_at
     FROM tbl_customer_transaction ct
     LEFT JOIN tbl_user_transaction ut ON ut.customer_id = ct.customer_id
       AND ut.base_amount = ct.base_amount
       AND ut."createdAt" BETWEEN ct."createdAt" - INTERVAL '5 minutes' AND ct."createdAt" + INTERVAL '5 minutes'
     LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id`;

  const rows = useCursor
    ? await sequelize.query<Record<string, unknown>>(
        `${TX_SELECT_FROM}
     WHERE ct.customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)
       AND ($2::timestamptz IS NULL OR ct."createdAt" < $2::timestamptz OR (ct."createdAt" = $2::timestamptz AND ct.id < $3))
     ORDER BY ct."createdAt" DESC, ct.id DESC
     LIMIT $4`,
        { bind: [userData.id, cursorCreatedAt, cursorId, effLimit + 1], type: QueryTypes.SELECT }
      )
    : await sequelize.query<Record<string, unknown>>(
        `${TX_SELECT_FROM}
     WHERE ct.customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)
     ORDER BY ct."createdAt" DESC, ct.id DESC
     LIMIT $2 OFFSET $3`,
        { bind: [userData.id, effLimit + 1, offset], type: QueryTypes.SELECT }
      );

  const hasMore = rows.length > effLimit;
  const transactions = hasMore ? rows.slice(0, effLimit) : rows;

  // Map transactions with auto-convert data and base currency display
  const data = transactions.map((tx) => {
    const {
      auto_convert_id,
      auto_convert_status,
      auto_convert_source_currency,
      auto_convert_source_amount,
      auto_convert_source_amount_usd,
      auto_convert_target_currency,
      auto_convert_target_amount,
      auto_convert_settlement_chain,
      auto_convert_rate,
      auto_convert_completed_at,
      ...rest
    } = tx;
    return {
      ...rest,
      payment_status: toExternalStatus(parseState(rest.status as string) || undefined as any) || rest.status,
      display_currency: baseCurrency,
      auto_converted: !!auto_convert_id,
      auto_convert: auto_convert_id
        ? {
            conversion_id: auto_convert_id,
            status: auto_convert_status,
            display_status: toConversionDisplayStatus(auto_convert_status as string),
            source_currency: auto_convert_source_currency,
            source_amount: auto_convert_source_amount ? Number(auto_convert_source_amount) : null,
            source_amount_usd: auto_convert_source_amount_usd ? Number(auto_convert_source_amount_usd) : null,
            target_currency: auto_convert_target_currency,
            target_amount: auto_convert_target_amount ? Number(auto_convert_target_amount) : null,
            settlement_chain: auto_convert_settlement_chain,
            conversion_rate: auto_convert_rate ? Number(auto_convert_rate) : null,
            completed_at: auto_convert_completed_at,
          }
        : null,
    };
  });

  const nextCursor = hasMore && data.length > 0 ? String((data[data.length - 1] as { id?: unknown }).id) : null;

  return sendSuccess(res, {
    status: 200,
    message: "Transactions retrieved",
    data,
    extra: { display_currency: baseCurrency, has_more: hasMore, next_cursor: nextCursor, limit: effLimit },
  });
}, { logger: apiLogger, label: "[MerchantAPI] getTransactions" }));

// ============================================================
// GET /api/user/getSingleTransaction/:id
// Get a single transaction by ID
// ============================================================
router.get("/getSingleTransaction/:id", legacyApiAuthMiddleware, asyncHandler(async (req, res) => {
  const userData = res.locals.user;
  const apiKeyData = res.locals.apiKeyData;
  const baseCurrency = apiKeyData?.base_currency || "USD";
  const { id } = req.params;

  if (!id || id === 'undefined' || id === 'null') {
    return sendError(res, {
      status: 400,
      message: "Please provide a valid transaction_id (received: " + id + ")",
    });
  }

  const transaction = await sequelize.query<Record<string, unknown>>(
    `SELECT ct.id, ct.payment_mode, ct.base_amount, ct.base_currency, ct.paid_amount, ct.paid_currency,
            ct.transaction_type, ct.transaction_details, ct.transaction_reference, ct.status, ct."createdAt",
            sc.conversion_id as auto_convert_id,
            sc.status as auto_convert_status,
            sc.source_currency as auto_convert_source_currency,
            sc.source_amount as auto_convert_source_amount,
            sc.source_amount_usd as auto_convert_source_amount_usd,
            sc.target_currency as auto_convert_target_currency,
            sc.target_amount as auto_convert_target_amount,
            sc.settlement_chain as auto_convert_settlement_chain,
            sc.conversion_rate as auto_convert_rate,
            sc.completed_at as auto_convert_completed_at
     FROM tbl_customer_transaction ct
     LEFT JOIN tbl_user_transaction ut ON ut.customer_id = ct.customer_id
       AND ut.base_amount = ct.base_amount
       AND ut."createdAt" BETWEEN ct."createdAt" - INTERVAL '5 minutes' AND ct."createdAt" + INTERVAL '5 minutes'
     LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id
     WHERE ct.customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)
     AND ct.id = $2`,
    {
      bind: [userData.id, id],
      type: QueryTypes.SELECT
    }
  );

  if (transaction.length === 0) {
    return sendError(res, {
      status: 404,
      message: "Please provide a valid transaction_id!",
    });
  }

  const txRaw = transaction[0];
  const {
    auto_convert_id,
    auto_convert_status,
    auto_convert_source_currency,
    auto_convert_source_amount,
    auto_convert_source_amount_usd,
    auto_convert_target_currency,
    auto_convert_target_amount,
    auto_convert_settlement_chain,
    auto_convert_rate,
    auto_convert_completed_at,
    ...txRest
  } = txRaw;
  const data = {
    ...txRest,
    payment_status: toExternalStatus(parseState(txRest.status as string) || undefined as any) || txRest.status,
    display_currency: baseCurrency,
    auto_converted: !!auto_convert_id,
    auto_convert: auto_convert_id
      ? {
          conversion_id: auto_convert_id,
          status: auto_convert_status,
          display_status: toConversionDisplayStatus(auto_convert_status as string),
          source_currency: auto_convert_source_currency,
          source_amount: auto_convert_source_amount ? Number(auto_convert_source_amount) : null,
          source_amount_usd: auto_convert_source_amount_usd ? Number(auto_convert_source_amount_usd) : null,
          target_currency: auto_convert_target_currency,
          target_amount: auto_convert_target_amount ? Number(auto_convert_target_amount) : null,
          settlement_chain: auto_convert_settlement_chain,
          conversion_rate: auto_convert_rate ? Number(auto_convert_rate) : null,
          completed_at: auto_convert_completed_at,
        }
      : null,
  };

  return sendSuccess(res, {
    status: 200,
    message: "Transaction retrieved",
    data,
    extra: { display_currency: baseCurrency },
  });
}, { logger: apiLogger, label: "[MerchantAPI] getSingleTransaction" }));

// ============================================================
// GET /api/user/getCryptoTransaction/:address
// Verify a crypto payment by blockchain address
// ============================================================
router.get("/getCryptoTransaction/:address", legacyApiAuthMiddleware, asyncHandler(async (req, res) => {
  const { address } = req.params;

  if (!address) {
    return sendError(res, { status: 400, message: "Please add address!" });
  }

  // Check if address exists in temp addresses. Merchant-pool payments store the
  // receiving address in tbl_merchant_temp_address (not the legacy tbl_user_temp_address),
  // so the verify endpoint must recognise BOTH tables — otherwise pool payments return
  // 400 on re-verify even though the payment settled successfully.
  const addressExists = await sequelize.query<{ wallet_address: string }>(
    `SELECT wallet_address FROM tbl_user_temp_address WHERE wallet_address = $1
     UNION ALL
     SELECT wallet_address FROM tbl_merchant_temp_address WHERE wallet_address = $1
     LIMIT 1`,
    {
      bind: [address],
      type: QueryTypes.SELECT,
    }
  );

  if (addressExists.length === 0) {
    return sendError(res, { status: 400, message: "Please add valid address!" });
  }

  // Direct controller call instead of HTTP self-call
  let capturedData: Record<string, unknown> | null = null;
  let capturedStatus = 200;

  const mockRes = {
    locals: { token: res.locals.token },
    status(code: number) {
      capturedStatus = code;
      return {
        json(body: unknown) {
          capturedData = body as Record<string, unknown>;
          return this;
        }
      };
    },
  } as unknown as express.Response;

  const mockReq = { ...req, body: { address } } as express.Request;

  await paymentController.verifyCryptoPayment(mockReq, mockRes);

  if (capturedStatus !== 200 || !capturedData) {
    return sendError(res, {
      status: capturedStatus || 500,
      message: ((capturedData as Record<string, unknown>)?.message as string) || "Failed to verify crypto payment",
    });
  }

  return sendSuccess(res, {
    status: 200,
    message: ((capturedData as Record<string, unknown>)?.message as string) || "Transaction verified",
    data: (capturedData as Record<string, unknown>)?.data,
  });
}, { logger: apiLogger, label: "[MerchantAPI] getCryptoTransaction" }));

// ============================================================
// GET /api/user/getPaymentStatus/:payment_id
// Verify a payment by its DynoPay payment_id (the id returned when the payment
// was created). Unlike getCryptoTransaction/:address, this is keyed on the
// unique, immutable payment_id — so it never breaks on reusable merchant-pool
// addresses and returns the AUTHORITATIVE final status from the database even
// after the short-lived Redis session has expired. Recommended for webhook
// re-verification.
// ============================================================
router.get("/getPaymentStatus/:payment_id", legacyApiAuthMiddleware, asyncHandler(async (req, res) => {
  const apiKeyData = res.locals.apiKeyData;
  const baseCurrency = apiKeyData?.base_currency || "USD";
  const companyId = apiKeyData?.company_id;
  const { payment_id } = req.params;

  if (!payment_id || payment_id === "undefined" || payment_id === "null") {
    return sendError(res, {
      status: 400,
      message: "Please provide a valid payment_id (received: " + payment_id + ")",
    });
  }

  if (!companyId) {
    return sendError(res, { status: 401, message: "Invalid or missing API key" });
  }

  // Scope strictly to the authenticated merchant's company so a merchant can
  // only ever read their own payments.
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT ut.id, ut.payment_mode, ut.base_amount, ut.base_currency,
            ut.crypto_amount, ut.crypto_currency, ut.usd_value, ut.transaction_fee,
            ut.received_amount, ut.remaining_amount,
            ut.tax_amount, ut.confirmations, ut.required_confirmations,
            ut.transaction_reference, ut.incoming_tx_hash, ut.outgoing_tx_hash,
            ut.status, ut."createdAt", ut."updatedAt",
            sc.conversion_id as auto_convert_id,
            sc.status as auto_convert_status,
            sc.source_currency as auto_convert_source_currency,
            sc.source_amount as auto_convert_source_amount,
            sc.source_amount_usd as auto_convert_source_amount_usd,
            sc.target_currency as auto_convert_target_currency,
            sc.target_amount as auto_convert_target_amount,
            sc.settlement_chain as auto_convert_settlement_chain,
            sc.conversion_rate as auto_convert_rate,
            sc.completed_at as auto_convert_completed_at
     FROM tbl_user_transaction ut
     LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id
     WHERE ut.id = $1 AND ut.company_id = $2
     LIMIT 1`,
    {
      bind: [payment_id, companyId],
      type: QueryTypes.SELECT,
    }
  );

  if (rows.length === 0) {
    return sendError(res, {
      status: 404,
      message: "Please provide a valid payment_id!",
    });
  }

  const row = rows[0];
  const rawStatus = row.status as string;
  const formalState = parseState(rawStatus);
  const paymentStatus = formalState ? toExternalStatus(formalState) : rawStatus;
  // "settled" is the terminal state where funds have been forwarded to the merchant.
  const isPaid = paymentStatus === "settled";

  // ── Underpayment amounts (currency-aware) ────────────────────────────────
  // A payment can be created in any base currency (USD, EUR, …), so we report
  // the received/remaining both in the crypto asset AND in that base currency.
  // `crypto_amount` is the FULL expected crypto; `base_amount` is the full fiat
  // owed in `base_currency`.
  const expectedCrypto = row.crypto_amount != null ? Number(row.crypto_amount) : 0;
  const baseAmountFiat = row.base_amount != null ? Number(row.base_amount) : 0;
  const storedReceived = row.received_amount != null ? Number(row.received_amount) : null;
  const storedRemaining = row.remaining_amount != null ? Number(row.remaining_amount) : null;
  // Paid-in-full states → received is the full expected amount, remaining is 0.
  const isPaidState = ["confirmed", "processing", "settled"].includes(paymentStatus);
  let amountReceived: number;
  let amountRemaining: number;
  if (isPaidState) {
    amountReceived = expectedCrypto;
    amountRemaining = 0;
  } else if (paymentStatus === "underpaid") {
    amountReceived = storedReceived ?? 0;
    amountRemaining = storedRemaining ?? Math.max(0, expectedCrypto - (storedReceived ?? 0));
  } else {
    // waiting / pending / failed / expired / refunded — nothing (or whatever
    // partial was recorded) has been received; nothing counted as remaining yet.
    amountReceived = storedReceived ?? 0;
    amountRemaining = storedRemaining ?? 0;
  }
  const round8 = (n: number) => Number(n.toFixed(8));
  // Base currency can be fiat (USD/EUR → 2 dp) or a crypto asset when the
  // merchant priced in crypto (→ keep 8 dp so we never truncate the amount).
  const baseIsCrypto = !!row.base_currency && !!row.crypto_currency
    && String(row.base_currency).toUpperCase() === String(row.crypto_currency).toUpperCase();
  const roundBase = (n: number) => Number(n.toFixed(baseIsCrypto ? 8 : 2));
  // Derive the base-currency (fiat) equivalents from the received ratio.
  const receivedRatio = expectedCrypto > 0 ? amountReceived / expectedCrypto : 0;
  const amountReceivedBase = roundBase(baseAmountFiat * Math.min(1, receivedRatio));
  const amountRemainingBase = roundBase(Math.max(0, baseAmountFiat - amountReceivedBase));

  const data: Record<string, unknown> = {
    payment_id: row.id,
    payment_status: paymentStatus, // waiting | pending | confirmed | processing | settled | underpaid | failed | expired | refunded
    status: rawStatus, // raw DB status (backward compatibility)
    is_paid: isPaid, // convenience flag: funds settled to the merchant
    payment_mode: row.payment_mode,
    amount: row.crypto_amount != null ? Number(row.crypto_amount) : null,
    currency: row.crypto_currency,
    // Underpayment amounts — how much crypto was actually received vs. still
    // owed. `paid_amount` is an alias of `amount_received`. The `_base` values
    // are the same figures expressed in the payment's base_currency (USD/EUR/…).
    amount_received: round8(amountReceived),
    amount_remaining: round8(amountRemaining),
    paid_amount: round8(amountReceived),
    amount_received_base: amountReceivedBase,
    amount_remaining_base: amountRemainingBase,
    base_amount: row.base_amount != null ? Number(row.base_amount) : null,
    base_currency: row.base_currency || baseCurrency,
    usd_value: row.usd_value != null ? Number(row.usd_value) : null,
    fee: row.transaction_fee != null ? Number(row.transaction_fee) : null,
    tax_amount: row.tax_amount != null ? Number(row.tax_amount) : null,
    confirmations: row.confirmations != null ? Number(row.confirmations) : null,
    required_confirmations: row.required_confirmations != null ? Number(row.required_confirmations) : null,
    transaction_reference: row.transaction_reference,
    incoming_tx_hash: row.incoming_tx_hash,
    outgoing_tx_hash: row.outgoing_tx_hash,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    auto_converted: !!row.auto_convert_id,
    auto_convert: row.auto_convert_id
      ? {
          conversion_id: row.auto_convert_id,
          status: row.auto_convert_status,
          display_status: toConversionDisplayStatus(row.auto_convert_status as string),
          source_currency: row.auto_convert_source_currency,
          source_amount: row.auto_convert_source_amount ? Number(row.auto_convert_source_amount) : null,
          source_amount_usd: row.auto_convert_source_amount_usd ? Number(row.auto_convert_source_amount_usd) : null,
          target_currency: row.auto_convert_target_currency,
          target_amount: row.auto_convert_target_amount ? Number(row.auto_convert_target_amount) : null,
          settlement_chain: row.auto_convert_settlement_chain,
          conversion_rate: row.auto_convert_rate ? Number(row.auto_convert_rate) : null,
          completed_at: row.auto_convert_completed_at,
        }
      : null,
  };

  return sendSuccess(res, {
    status: 200,
    message: "Payment status retrieved",
    data: {
      ...data,
      // API review §5.3.1 — same first-class payment object as create/list.
      payment: buildPaymentObject({
        id: String(row.id),
        status: paymentStatus,
        hostedUrl: null,
        baseAmount: row.base_amount as number | null,
        baseCurrency: (row.base_currency as string) || baseCurrency,
        cryptoAmount: row.crypto_amount as number | string | null,
        cryptoCurrency: row.crypto_currency as string | null,
        fee: row.transaction_fee as number | null,
        taxAmount: row.tax_amount as number | null,
        createdAt: row.createdAt as string | Date | null,
        updatedAt: row.updatedAt as string | Date | null,
        autoConverted: !!row.auto_convert_id,
        autoConvert: data.auto_convert,
      }),
    },
    extra: { display_currency: baseCurrency },
  });
}, { logger: apiLogger, label: "[MerchantAPI] getPaymentStatus" }));

// ============================================================
// GET /api/user/getSupportedCurrency
// Get list of supported cryptocurrencies for this merchant
// ============================================================
router.get("/getSupportedCurrency", apiKeyOnlyMiddleware, asyncHandler(async (req, res) => {
  const data = res.locals.apiKeyData;

  const currencies = await getAvailableCurrencies(data.adm_id, data.company_id);

  return sendSuccess(res, {
    status: 200,
    message: "Supported currencies retrieved",
    data: {
      currencies,
      all_supported: CRYPTO_TYPES
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] getSupportedCurrency" }));

// ============================================================
// GET /api/user/events
// Webhook event / delivery reconciliation (API review §5.1.4). Lists the
// merchant's webhook deliveries (from tbl_webhook_delivery_log) so a merchant
// who missed a webhook can catch up without polling getPaymentStatus per
// payment. Cursor-paginated (limit + starting_after + has_more); filter by
// `type` (event name) and `status` (success|failed). Scoped to the API key's
// company.
// ============================================================
router.get("/events", apiKeyOnlyMiddleware, asyncHandler(async (req, res) => {
  const companyId = res.locals.apiKeyData?.company_id;
  if (!companyId) {
    return sendError(res, { status: 401, message: "Invalid or missing API key" });
  }

  const { limit = 20, starting_after, type, status } = req.query;
  const effLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const repl: Record<string, unknown> = { companyId, lim: effLimit + 1 };
  let where = `WHERE company_id = :companyId`;
  if (typeof type === "string" && type.length > 0) {
    where += ` AND event_type = :type`;
    repl.type = type;
  }
  if (typeof status === "string" && ["success", "failed"].includes(status)) {
    where += ` AND status = :status`;
    repl.status = status;
  }

  // Keyset cursor over (created_at, log_id) DESC — stable under new deliveries.
  let cursorClause = "";
  if (typeof starting_after === "string" && starting_after.length > 0) {
    const cur = await sequelize.query<{ created_at: string | Date; log_id: number }>(
      `SELECT created_at, log_id FROM tbl_webhook_delivery_log
        WHERE log_id = :sa AND company_id = :companyId LIMIT 1`,
      { replacements: { sa: Number(starting_after), companyId }, type: QueryTypes.SELECT }
    );
    if (cur.length > 0) {
      repl.cCreated = new Date(cur[0].created_at).toISOString();
      repl.cId = cur[0].log_id;
      cursorClause = ` AND (created_at < :cCreated OR (created_at = :cCreated AND log_id < :cId))`;
    }
  }

  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT log_id, event_type, webhook_id, webhook_url, status, response_status,
            response_time_ms, error_message, retry_count, created_at, completed_at
       FROM tbl_webhook_delivery_log
       ${where}${cursorClause}
      ORDER BY created_at DESC, log_id DESC
      LIMIT :lim`,
    { replacements: repl, type: QueryTypes.SELECT }
  );

  const hasMore = rows.length > effLimit;
  const page = hasMore ? rows.slice(0, effLimit) : rows;
  const data = page.map((r) => ({
    id: r.log_id,
    object: "event",
    event: r.event_type,
    webhook_id: r.webhook_id,
    url: r.webhook_url,
    status: r.status, // 'success' | 'failed'
    response_status: r.response_status,
    response_time_ms: r.response_time_ms,
    attempts: r.retry_count,
    error: r.error_message,
    created_at: r.created_at,
    completed_at: r.completed_at,
  }));
  const nextCursor = hasMore && data.length > 0 ? String(data[data.length - 1].id) : null;

  return sendSuccess(res, {
    status: 200,
    message: "Events retrieved",
    data,
    extra: { has_more: hasMore, next_cursor: nextCursor, limit: effLimit },
  });
}, { logger: apiLogger, label: "[MerchantAPI] getEvents" }));

// ============================================================
// POST /api/user/events/:id/resend
// Re-deliver a single logged webhook to its original URL (API review §5.1.4).
// Uses the stored payload and the company's CURRENT signing secret, with a
// fresh webhook_id/timestamp/signature. Scoped to the API key's company.
// ============================================================
router.post("/events/:id/resend", apiKeyOnlyMiddleware, asyncHandler(async (req, res) => {
  const companyId = res.locals.apiKeyData?.company_id;
  if (!companyId) {
    return sendError(res, { status: 401, message: "Invalid or missing API key" });
  }
  const { id } = req.params;
  if (!id || !/^\d+$/.test(String(id))) {
    return sendError(res, { status: 400, message: "Please provide a valid numeric event id" });
  }

  const rows = await sequelize.query<{ log_id: number; event_type: string; webhook_url: string | null; payload: string | null }>(
    `SELECT log_id, event_type, webhook_url, payload
       FROM tbl_webhook_delivery_log
      WHERE log_id = $1 AND company_id = $2 LIMIT 1`,
    { bind: [Number(id), companyId], type: QueryTypes.SELECT }
  );
  if (rows.length === 0) {
    return sendError(res, { status: 404, message: "Event not found" });
  }
  const row = rows[0];
  if (!row.webhook_url) {
    return sendError(res, { status: 400, message: "This event has no delivery URL to resend to" });
  }

  let eventData: Record<string, unknown> = {};
  try {
    eventData = row.payload ? (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) : {};
  } catch {
    eventData = {};
  }
  if (!eventData.event) eventData.event = row.event_type;

  // Sign with the company's CURRENT secret (merchants verify with the secret
  // shown in their dashboard). No secret → delivered unsigned (§5.1.2).
  const secretRows = await sequelize.query<{ webhook_secret: string | null }>(
    `SELECT webhook_secret FROM tbl_company WHERE company_id = $1 LIMIT 1`,
    { bind: [companyId], type: QueryTypes.SELECT }
  );
  const secret = secretRows[0]?.webhook_secret || null;

  const { redeliverWebhook } = require("../webhooks");
  const result = await redeliverWebhook(row.webhook_url, eventData, secret, Number(companyId), "webhook");

  return sendSuccess(res, {
    status: 200,
    message: result?.success ? "Event resent" : "Resend attempted",
    data: {
      id: row.log_id,
      event: row.event_type,
      url: row.webhook_url,
      resent: !!result?.success,
      error: result?.success ? null : (result?.error || "delivery failed"),
    },
  });
}, { logger: apiLogger, label: "[MerchantAPI] resendEvent" }));

export default router;

// Re-export internal helpers so the Phase 2 public embed router (which needs
// to build the SAME redis session payload used by /embed/session) can reuse
// them without duplicating logic.
export { getAvailableCurrencies, findOrRecreateCustomer };
