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

import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { decrypt } from "../helper/encryption";

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

interface CustomerRecord {
  id: string;
  customer_id: number;
  customer_name: string;
  email: string;
  company_id: number;
}

/**
 * Validates API key and extracts company data
 */
const validateApiKey = async (apiKey: string): Promise<ApiKeyData | null> => {
  try {
    const decryptedData = decrypt(apiKey, process.env.API_SECRET || '');
    
    if (!decryptedData.includes("DYNOPAY_USER_API")) {
      apiLogger.info("[LegacyAuth] Invalid API key format");
      return null;
    }
    
    // Extract the JSON part after "DYNOPAY_USER_API-"
    const apiKeyPart = decryptedData.split("DYNOPAY_USER_API-")[1];
    const apiData = JSON.parse(apiKeyPart) as ApiKeyData;
    const { company_id, adm_id } = apiData;
    
    // Verify company exists
    const tempData = await sequelize.query<{ company_id: number }>(
      `SELECT company_id FROM tbl_company WHERE company_id=$1 AND user_id=$2`,
      { 
        bind: [company_id, adm_id],
        type: QueryTypes.SELECT 
      }
    );
    
    if (tempData.length === 0) {
      apiLogger.info("[LegacyAuth] Company not found for API key");
      return null;
    }
    
    // Fetch current base_currency + webhook config + environment + test_mode_restrictions
    // from DB (source of truth). The encrypted key payload may have stale values if
    // settings were updated after key creation.
    const dbApiData = await sequelize.query<{
      base_currency: string;
      webhook_url: string | null;
      webhook_secret: string | null;
      environment: "production" | "development" | null;
      test_mode_restrictions: string | Record<string, unknown> | null;
    }>(
      `SELECT base_currency, webhook_url, webhook_secret, environment, test_mode_restrictions
         FROM tbl_api
        WHERE company_id=$1 AND user_id=$2 AND "apiKey"=$3 AND status='active'
        LIMIT 1`,
      {
        bind: [company_id, adm_id, apiKey],
        type: QueryTypes.SELECT,
      }
    );

    if (dbApiData.length === 0) {
      // Key was revoked/deleted OR user_id/company mismatch → treat as invalid.
      apiLogger.info(
        `[LegacyAuth] API key not found or revoked (company ${company_id})`
      );
      return null;
    }

    apiData.base_currency = dbApiData[0].base_currency || apiData.base_currency;
    if (dbApiData[0].webhook_url) apiData.webhook_url = dbApiData[0].webhook_url;
    if (dbApiData[0].webhook_secret) apiData.webhook_secret = dbApiData[0].webhook_secret;
    apiData.environment = dbApiData[0].environment || "production";

    // Parse test_mode_restrictions (Postgres JSONB may return as object OR string
    // depending on the driver setting; handle both defensively).
    const raw = dbApiData[0].test_mode_restrictions;
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
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
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
 * Finds or creates a default customer for legacy API calls
 */
const findOrCreateDefaultCustomer = async (
  companyId: number, 
  admId: number,
  baseCurrency: string
): Promise<CustomerRecord | null> => {
  try {
    // Look for existing default customer for this company
    const existingCustomer = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id 
       FROM tbl_customer 
       WHERE company_id = $1 AND email LIKE 'legacy-api-%'
       ORDER BY "createdAt" DESC LIMIT 1`,
      {
        bind: [companyId],
        type: QueryTypes.SELECT
      }
    );
    
    if (existingCustomer.length > 0) {
      apiLogger.info(`[LegacyAuth] Found existing default customer: ${existingCustomer[0].customer_id}`);
      return existingCustomer[0];
    }
    
    // Create a new default customer for legacy API calls
    const crypto = await import("crypto");
    const customerId = crypto.randomUUID();
    const defaultEmail = `legacy-api-${companyId}-${Date.now()}@dynopay.internal`;
    
    await sequelize.query(
      `INSERT INTO tbl_customer (id, customer_name, email, company_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      {
        bind: [customerId, 'Legacy API Customer', defaultEmail, companyId],
        type: QueryTypes.INSERT
      }
    );
    
    // Get the created customer with auto-generated customer_id
    const newCustomer = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id 
       FROM tbl_customer WHERE id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT
      }
    );
    
    if (newCustomer.length > 0) {
      // Create wallet for the customer
      const walletId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 0, NOW(), NOW())`,
        {
          bind: [walletId, newCustomer[0].customer_id, baseCurrency],
          type: QueryTypes.INSERT
        }
      );
      
      apiLogger.info(`[LegacyAuth] Created default customer: ${newCustomer[0].customer_id}`);
      return newCustomer[0];
    }
    
    return null;
  } catch (error) {
    apiLogger.error("[LegacyAuth] Error creating default customer:", error);
    return null;
  }
};

/**
 * Generate a temporary customer token for legacy API calls
 */
const generateCustomerToken = (customer: CustomerRecord): string => {
  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
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
      return res.status(403).json({
        success: false,
        message: "API key is required in x-api-key header"
      });
    }
    
    const apiKeyData = await validateApiKey(apiKey);
    if (!apiKeyData) {
      return res.status(403).json({
        success: false,
        message: "Invalid API key"
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
      return res.status(400).json({
        success: false,
        code: "sandbox_restriction",
        message: sandboxError,
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
    
    const defaultCustomer = await findOrCreateDefaultCustomer(
      apiKeyData.company_id,
      apiKeyData.adm_id,
      apiKeyData.base_currency || 'USD'
    );
    
    if (!defaultCustomer) {
      return res.status(500).json({
        success: false,
        message: "Failed to create customer context for legacy API"
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
    return res.status(500).json({
      success: false,
      message: "Authentication error: " + (error instanceof Error ? error.message : String(error))
    });
  }
};

export default legacyApiAuthMiddleware;
export { validateApiKey, validateCustomerToken, findOrCreateDefaultCustomer };
