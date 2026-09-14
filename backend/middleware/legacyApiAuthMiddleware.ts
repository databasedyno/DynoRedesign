/**
 * Legacy API Authentication Middleware
 * 
 * Provides backward compatibility with the OLD Dynopay API (user-api.dynopay.com)
 * that used x-api-key + wallet_token authentication.
 * 
 * OLD API Flow:
 *   Headers: x-api-key + Authorization: Bearer {wallet_token}
 *   Direct call to /api/user/cryptoPayment
 * 
 * NEW API Flow:
 *   1. Create customer via /api/user/createUser
 *   2. Use customer JWT token for /api/user/cryptoPayment
 * 
 * This middleware bridges both flows by:
 *   1. Validating x-api-key (required for both)
 *   2. If Authorization contains a valid customer JWT → use NEW flow
 *   3. If Authorization is empty or invalid JWT → create/find default customer (OLD flow)
 */

import { raw as envRaw } from "../utils/config";
import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { hashApiKey, looksLikeApiKey } from "../helper/apiKeyToken";
import { findOrCreateDefaultCustomer, findOrCreateEmailCustomer, type CustomerRecord } from "./legacy/customerResolver";
import { isValidBuyerEmail } from "../utils/transactionSource";
import { sendError } from "../helper/apiResponse";

interface TestModeRestrictions {
  max_amount?: number;
  allowed_currencies?: string[];
  sandbox_mode?: boolean;
}

interface ApiKeyData {
  company_id: number;
  adm_id: number;
  base_currency: string;
  webhook_url?: string;
  webhook_secret?: string;
  environment?: "production" | "development";
  test_mode_restrictions?: TestModeRestrictions | null;
}

interface CustomerJwtPayload {
  id: string;
  customer_id?: number;
  email?: string;
  company_id?: number;
}


/**
 * Validates an x-api-key by one-way hash lookup (never decrypts, never compares
 * plaintext). Legacy ciphertext keys and new opaque tokens share the same path
 * because migration 0025 hashed every existing key in place.
 */
const validateApiKey = async (apiKey: string): Promise<ApiKeyData | null> => {
  try {
    if (!looksLikeApiKey(apiKey)) {
      apiLogger.info("[LegacyAuth] Invalid API key format");
      return null;
    }

    const rows = await sequelize.query<{
      company_id: number;
      user_id: number;
      base_currency: string | null;
      webhook_url: string | null;
      webhook_secret: string | null;
      environment: "production" | "development" | null;
      test_mode_restrictions: string | Record<string, unknown> | null;
    }>(
      `SELECT a.company_id, a.user_id, a.base_currency, a.webhook_url, a.webhook_secret,
              a.environment, a.test_mode_restrictions
         FROM tbl_api a
         JOIN tbl_company c ON c.company_id = a.company_id AND c.user_id = a.user_id
        WHERE a.key_hash = $1
          AND a.status = 'active'
          AND (a.expires_at IS NULL OR a.expires_at > NOW())
          AND c.deleted_at IS NULL
        LIMIT 1`,
      { bind: [hashApiKey(apiKey)], type: QueryTypes.SELECT }
    );

    if (rows.length === 0) {
      apiLogger.info("[LegacyAuth] API key not found, revoked or expired");
      return null;
    }

    const row = rows[0];
    const apiData: ApiKeyData = {
      company_id: row.company_id,
      adm_id: row.user_id,
      base_currency: row.base_currency || "USD",
      environment: row.environment || "production",
    };
    if (row.webhook_url) apiData.webhook_url = row.webhook_url;
    if (row.webhook_secret) apiData.webhook_secret = row.webhook_secret;

    // Parse test_mode_restrictions (Postgres JSONB may return as object OR string
    // depending on the driver setting; handle both defensively).
    const raw = row.test_mode_restrictions;
    if (raw) {
      if (typeof raw === "string") {
        try {
          apiData.test_mode_restrictions = JSON.parse(raw) as TestModeRestrictions;
        } catch {
          apiData.test_mode_restrictions = null;
        }
      } else if (typeof raw === "object") {
        apiData.test_mode_restrictions = raw as TestModeRestrictions;
      }
    }

    return apiData;
  } catch (error) {
    apiLogger.error("[LegacyAuth] API key validation error:", error);
    return null;
  }
};

/**
 * Validates customer JWT token
 */
const validateCustomerToken = (token: string): CustomerJwtPayload | null => {
  try {
    const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
    if (!tokenSecret) return null;
    
    const decoded = jwt.verify(token, tokenSecret) as CustomerJwtPayload;
    if (decoded && (decoded.id || decoded.customer_id)) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Generate a temporary customer token for legacy API calls
 */
const generateCustomerToken = (customer: CustomerRecord): string => {
  const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
  if (!tokenSecret) throw new Error("ACCESS_TOKEN_SECRET not configured");
  
  const payload: CustomerJwtPayload = {
    id: customer.id,
    customer_id: customer.customer_id,
    email: customer.email,
    company_id: customer.company_id
  };
  
  return jwt.sign(payload, tokenSecret, { expiresIn: '365d' });
};

/**
 * Enforces sandbox restrictions on a request when the calling API key is a
 * dpk_test_ (environment='development') key with test_mode_restrictions.sandbox_mode=true.
 *
 * Restrictions checked (all optional in the JSON blob):
 *  - `max_amount` — rejects when body/query has `amount` or `base_amount` > max.
 *  - `allowed_currencies` — rejects when body has `currency`/`wallet_type` outside
 *    the list, OR when `accepted_currencies` array contains any disallowed value.
 *
 * Live (`dpk_live_`) keys skip enforcement entirely. Test keys with `sandbox_mode:false`
 * (or no restrictions blob) also skip. Returns null when OK, or an error string when rejected.
 */
const checkSandboxRestrictions = (
  req: express.Request,
  apiKeyData: ApiKeyData
): string | null => {
  if (apiKeyData.environment !== "development") return null;
  const r = apiKeyData.test_mode_restrictions;
  if (!r || !r.sandbox_mode) return null;

  // Amount check — pull from body first, then query. Common field names.
  const rawAmount =
    (req.body && (req.body.amount ?? req.body.base_amount)) ??
    (req.query && (req.query.amount ?? req.query.base_amount));
  if (rawAmount !== undefined && rawAmount !== null && rawAmount !== "") {
    const numAmount = Number(rawAmount);
    if (
      Number.isFinite(numAmount) &&
      typeof r.max_amount === "number" &&
      numAmount > r.max_amount
    ) {
      return `Sandbox key limit exceeded: amount ${numAmount} > max_amount ${r.max_amount}. Sandbox keys are capped for safety — use a live (dpk_live_) key for production amounts.`;
    }
  }

  // Currency check — accept upper-case allow-list from the blob.
  if (Array.isArray(r.allowed_currencies) && r.allowed_currencies.length > 0) {
    const allowed = new Set(
      r.allowed_currencies.map((c) => String(c).toUpperCase())
    );
    const single =
      (req.body && (req.body.currency || req.body.wallet_type)) ||
      (req.query && (req.query.currency || req.query.wallet_type));
    if (typeof single === "string" && !allowed.has(single.toUpperCase())) {
      return `Sandbox key limit: currency "${single}" is not in the allowed list. Allowed: ${Array.from(
        allowed
      ).join(", ")}. Use a live (dpk_live_) key to unlock more currencies.`;
    }
    const list = req.body && req.body.accepted_currencies;
    if (Array.isArray(list)) {
      const bad = list.filter(
        (c: unknown) =>
          typeof c === "string" && !allowed.has(String(c).toUpperCase())
      );
      if (bad.length > 0) {
        return `Sandbox key limit: accepted_currencies contains disallowed value(s) [${bad.join(
          ", "
        )}]. Allowed: ${Array.from(allowed).join(
          ", "
        )}. Use a live (dpk_live_) key to unlock more currencies.`;
      }
    }
  }

  return null;
};

/**
 * Legacy API Authentication Middleware
 * 
 * Supports both OLD and NEW authentication flows:
 * - OLD: x-api-key + wallet_token (auto-creates default customer)
 * - NEW: x-api-key + customer JWT token
 */
const legacyApiAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    // Step 1: Validate x-api-key (required for both flows)
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
    
    // Store API key data for later use
    res.locals.apiKeyData = apiKeyData;
    res.locals.apiEnvironment = apiKeyData.environment || "production";
    res.locals.testMode = apiKeyData.environment === "development";
    res.locals.testModeRestrictions = apiKeyData.test_mode_restrictions || null;

    // Enforce sandbox restrictions on dpk_test_ keys (no-op for live keys).
    const sandboxError = checkSandboxRestrictions(req, apiKeyData);
    if (sandboxError) {
      apiLogger.info(
        `[LegacyAuth] Sandbox restriction violation on company ${apiKeyData.company_id}: ${sandboxError}`
      );
      return sendError(res, {
        status: 400,
        message: sandboxError,
        type: "invalid_request_error",
        code: "sandbox_restriction",
        extra: { code: "sandbox_restriction" },
      });
    }

    // Step 2: Check Authorization header
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    
    if (token) {
      // Try to validate as customer JWT (NEW flow)
      const customerData = validateCustomerToken(token);
      
      if (customerData) {
        // Valid customer JWT - use NEW flow
        apiLogger.info(`[LegacyAuth] Valid customer JWT for customer: ${customerData.id}`);
        res.locals.token = token;
        res.locals.user = customerData;
        return next();
      }
    }
    
    // Step 3: No valid customer token - use LEGACY flow
    // This handles: no auth header, invalid JWT, or wallet_token (old style)
    apiLogger.info(`[LegacyAuth] Using legacy flow - creating/finding default customer`);

    // If the merchant supplied the payer's email (optional `customer_email`
    // body field, with optional `customer_name`), attribute the request to a
    // REAL customer row instead of the shared synthetic default — this enables
    // customer receipts and post-payment referral auto-invites.
    const rawPayerEmail =
      typeof req.body?.customer_email === "string"
        ? req.body.customer_email.trim().toLowerCase()
        : "";
    // Lenient: accept only a real, buyer-supplied address. Anything invalid or
    // synthetic (incl. any *.local such as buyer@nameword.local) falls back to
    // the shared default customer below — the payment never gets blocked.
    const payerEmailValid = isValidBuyerEmail(rawPayerEmail);

    let defaultCustomer: CustomerRecord | null = null;
    if (payerEmailValid) {
      const payerName =
        typeof req.body?.customer_name === "string"
          ? req.body.customer_name.trim()
          : null;
      defaultCustomer = await findOrCreateEmailCustomer(
        apiKeyData.company_id,
        rawPayerEmail,
        payerName,
        apiKeyData.base_currency || 'USD'
      );
    }

    if (!defaultCustomer) {
      defaultCustomer = await findOrCreateDefaultCustomer(
        apiKeyData.company_id,
        apiKeyData.adm_id,
        apiKeyData.base_currency || 'USD'
      );
    }
    
    if (!defaultCustomer) {
      return sendError(res, {
        status: 500,
        message: "Failed to create customer context for legacy API",
        code: "customer_context_failed",
      });
    }
    
    // Generate temporary token for this request
    const tempToken = generateCustomerToken(defaultCustomer);
    
    res.locals.token = tempToken;
    res.locals.user = {
      id: defaultCustomer.id,
      customer_id: defaultCustomer.customer_id,
      email: defaultCustomer.email,
      company_id: defaultCustomer.company_id
    };
    
    apiLogger.info(`[LegacyAuth] Legacy flow authenticated for company ${apiKeyData.company_id}`);
    next();
    
  } catch (error) {
    apiLogger.error("[LegacyAuth] Middleware error:", error);
    return sendError(res, {
      status: 500,
      message: "Authentication error: " + (error instanceof Error ? error.message : String(error)),
    });
  }
};

export default legacyApiAuthMiddleware;
export { validateApiKey, validateCustomerToken, findOrCreateDefaultCustomer, findOrCreateEmailCustomer };
