/**
 * Publishable Key controller — Phase 2 (Buy Button)
 *
 * Endpoints:
 *   POST   /api/publishable-keys           — create a pk (JWT)
 *   GET    /api/publishable-keys           — list a company's pks (JWT)
 *   GET    /api/publishable-keys/:id       — fetch one (JWT)
 *   PATCH  /api/publishable-keys/:id       — update allowed_domains/max_amount/allowed_currencies/status/key_name (JWT)
 *   DELETE /api/publishable-keys/:id       — soft-delete = mark revoked (JWT)
 *
 *   POST   /api/embed/public/session       — merchant BROWSER creates a checkout session (pk auth + Origin)
 */

import type express from "express";
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import { apiModel, publishableKeyModel, buyButtonModel } from "../models";
import sequelize from "../utils/dbInstance";
import { setRedisItem } from "../utils/redisInstance";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { getAvailableCurrencies, findOrRecreateCustomer } from "../routes/merchantApiRouter";
import type { PublishableKeyRow } from "../middleware/publishableKeyMiddleware";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const generatePkKey = (environment: "production" | "development"): { key: string; prefix: string; hash: string } => {
  const prefix = environment === "production" ? "pk_live_" : "pk_test_";
  const rand = crypto.randomBytes(24).toString("base64url"); // ~32 char url-safe
  const key = prefix + rand;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix: key.slice(0, 18), hash };
};

/** Normalize an incoming allowed_domains entry (accept plain hosts too). */
const normalizeDomain = (raw: string): string | null => {
  const s = (raw || "").trim();
  if (!s) return null;
  // Wildcard rule — keep as-is (validated at runtime by originAllowed())
  if (s.startsWith("*.") || s.startsWith("https://*.") || s.startsWith("http://*.")) return s.toLowerCase();
  try {
    // Accept either a full URL or a bare host
    const withScheme = /^https?:\/\//i.test(s) ? s : "https://" + s;
    return new URL(withScheme).origin.toLowerCase();
  } catch {
    return null;
  }
};

const parseJsonArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as string[]) : [];
  } catch {
    return [];
  }
};

/** Redact key for API responses AFTER creation — only the prefix + tail is shown. */
const maskKey = (key: string): string => {
  if (!key) return "";
  const prefix = key.slice(0, 12);
  const tail = key.slice(-4);
  return `${prefix}…${tail}`;
};

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export const createPublishableKey = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const userData = res.locals.user;
    const {
      company_id,
      environment = "production",
      allowed_domains,
      max_amount,
      allowed_currencies,
      key_name,
    } = req.body as {
      company_id: number;
      environment?: "production" | "development";
      allowed_domains: string[];
      max_amount: number;
      allowed_currencies?: string[] | null;
      key_name?: string;
    };

    if (!company_id) {
      errorResponseHelper(res, 400, "company_id is required");
      return;
    }
    if (!["production", "development"].includes(environment)) {
      errorResponseHelper(res, 400, "environment must be 'production' or 'development'");
      return;
    }
    if (!Array.isArray(allowed_domains) || allowed_domains.length === 0) {
      errorResponseHelper(res, 400, "allowed_domains must be a non-empty array");
      return;
    }
    const normalizedDomains = allowed_domains.map(normalizeDomain).filter((d): d is string => !!d);
    if (normalizedDomains.length === 0) {
      errorResponseHelper(res, 400, "allowed_domains contained no valid entries (use 'https://shop.com' or '*.shop.com')");
      return;
    }
    if (typeof max_amount !== "number" || !Number.isFinite(max_amount) || max_amount <= 0) {
      errorResponseHelper(res, 400, "max_amount is required and must be > 0 (e.g. 2000)");
      return;
    }
    if (max_amount < 5) {
      errorResponseHelper(res, 400, "max_amount must be at least 5 to match the minimum checkout amount");
      return;
    }

    const companyData = await validateCompanyOwnership(res, company_id, userData.user_id);
    if (!companyData) return; // 403 already sent

    // Locate the company's active secret key (source of base_currency + config)
    const activeSecret = await apiModel.findOne({
      where: { company_id, status: "active", environment },
    });
    if (!activeSecret) {
      errorResponseHelper(
        res,
        400,
        `No active ${environment} secret key found for this company. Create one first — a publishable key inherits its base currency and webhook settings from the secret key.`
      );
      return;
    }
    const base_currency = (activeSecret.dataValues as { base_currency?: string }).base_currency || "USD";

    // Optional currency allow-list must be a subset of configured wallets
    let allowedCurrenciesJson: string | null = null;
    if (Array.isArray(allowed_currencies) && allowed_currencies.length > 0) {
      const configured = await getAvailableCurrencies(userData.user_id, company_id);
      const cleaned = allowed_currencies.map((c) => c.toUpperCase().trim());
      const unknown = cleaned.filter((c) => !configured.includes(c));
      if (unknown.length > 0) {
        errorResponseHelper(
          res,
          400,
          `allowed_currencies contains unconfigured wallets: ${unknown.join(", ")}. Configured: ${configured.join(", ") || "(none)"}`
        );
        return;
      }
      allowedCurrenciesJson = JSON.stringify(cleaned);
    }

    // Enforce: 1 active pk per (company, environment) — same pattern as secret keys
    const existing = await publishableKeyModel.findOne({
      where: { company_id, environment, status: "active" },
    });
    if (existing) {
      errorResponseHelper(
        res,
        400,
        `This company already has an active ${environment === "production" ? "pk_live_" : "pk_test_"} key. Revoke or rotate the existing key first.`
      );
      return;
    }

    const { key, prefix, hash } = generatePkKey(environment);

    const row = await publishableKeyModel.create({
      company_id,
      user_id: userData.user_id,
      environment,
      publishable_key: key,
      key_prefix: prefix,
      key_hash: hash,
      status: "active",
      allowed_domains: JSON.stringify(normalizedDomains),
      max_amount,
      allowed_currencies: allowedCurrenciesJson,
      base_currency,
      key_name: key_name || (environment === "production" ? "Live Buy Button" : "Test Buy Button"),
    });

    successResponseHelper(res, 200, "Publishable key created", {
      pub_key_id: (row.dataValues as { pub_key_id: number }).pub_key_id,
      publishable_key: key, // shown ONCE — but pk is public so also re-listable
      key_prefix: prefix,
      key_masked: maskKey(key),
      environment,
      status: "active",
      allowed_domains: normalizedDomains,
      max_amount,
      allowed_currencies: allowedCurrenciesJson ? JSON.parse(allowedCurrenciesJson) : null,
      base_currency,
      rate_limit_per_minute: (row.dataValues as { rate_limit_per_minute?: number }).rate_limit_per_minute || 30,
      key_name: (row.dataValues as { key_name?: string }).key_name,
    });
  } catch (err) {
    apiLogger.error(`[PublishableKey] create error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to create publishable key");
  }
};

export const listPublishableKeys = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const userData = res.locals.user;
    const companyIdRaw = (req.query.company_id as string | undefined) || undefined;
    if (!companyIdRaw) {
      errorResponseHelper(res, 400, "company_id query parameter is required");
      return;
    }
    const company_id = Number(companyIdRaw);
    if (!Number.isFinite(company_id)) {
      errorResponseHelper(res, 400, "company_id must be numeric");
      return;
    }
    const companyData = await validateCompanyOwnership(res, company_id, userData.user_id);
    if (!companyData) return;

    const rows = await publishableKeyModel.findAll({
      where: { company_id },
      order: [["pub_key_id", "DESC"]],
    });

    const data = rows.map((r) => {
      const v = r.dataValues as PublishableKeyRow & { usage_count?: number; last_used_at?: string; key_name?: string; createdAt?: string };
      return {
        pub_key_id: v.pub_key_id,
        publishable_key: v.publishable_key,
        key_prefix: v.key_prefix,
        key_masked: maskKey(v.publishable_key),
        environment: v.environment,
        status: v.status,
        allowed_domains: parseJsonArray(v.allowed_domains),
        max_amount: v.max_amount,
        allowed_currencies: v.allowed_currencies ? parseJsonArray(v.allowed_currencies) : null,
        base_currency: v.base_currency,
        rate_limit_per_minute: v.rate_limit_per_minute,
        usage_count: v.usage_count || 0,
        last_used_at: v.last_used_at || null,
        key_name: v.key_name || null,
        createdAt: v.createdAt || null,
      };
    });
    successResponseHelper(res, 200, "Publishable keys", { keys: data });
  } catch (err) {
    apiLogger.error(`[PublishableKey] list error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to list publishable keys");
  }
};

export const getPublishableKey = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const userData = res.locals.user;
    const id = Number(req.params.id);
    const row = await publishableKeyModel.findOne({ where: { pub_key_id: id } });
    if (!row) { errorResponseHelper(res, 404, "Publishable key not found"); return; }
    const v = row.dataValues as PublishableKeyRow & { usage_count?: number; last_used_at?: string };
    const companyData = await validateCompanyOwnership(res, v.company_id, userData.user_id);
    if (!companyData) return;
    successResponseHelper(res, 200, "Publishable key", {
      pub_key_id: v.pub_key_id,
      publishable_key: v.publishable_key,
      key_prefix: v.key_prefix,
      key_masked: maskKey(v.publishable_key),
      environment: v.environment,
      status: v.status,
      allowed_domains: parseJsonArray(v.allowed_domains),
      max_amount: v.max_amount,
      allowed_currencies: v.allowed_currencies ? parseJsonArray(v.allowed_currencies) : null,
      base_currency: v.base_currency,
      rate_limit_per_minute: v.rate_limit_per_minute,
      usage_count: v.usage_count || 0,
      last_used_at: v.last_used_at || null,
    });
  } catch (err) {
    apiLogger.error(`[PublishableKey] get error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to fetch publishable key");
  }
};

export const updatePublishableKey = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const userData = res.locals.user;
    const id = Number(req.params.id);
    const row = await publishableKeyModel.findOne({ where: { pub_key_id: id } });
    if (!row) { errorResponseHelper(res, 404, "Publishable key not found"); return; }
    const v = row.dataValues as PublishableKeyRow;
    const companyData = await validateCompanyOwnership(res, v.company_id, userData.user_id);
    if (!companyData) return;

    const updates: Record<string, unknown> = {};
    const { allowed_domains, max_amount, allowed_currencies, status, key_name, rate_limit_per_minute } = req.body || {};

    if (Array.isArray(allowed_domains)) {
      const normalized = allowed_domains.map(normalizeDomain).filter((d): d is string => !!d);
      if (normalized.length === 0) { errorResponseHelper(res, 400, "allowed_domains must have at least one valid entry"); return; }
      updates.allowed_domains = JSON.stringify(normalized);
    }
    if (max_amount !== undefined) {
      if (typeof max_amount !== "number" || !Number.isFinite(max_amount) || max_amount < 5) {
        errorResponseHelper(res, 400, "max_amount must be a number ≥ 5"); return;
      }
      updates.max_amount = max_amount;
    }
    if (allowed_currencies !== undefined) {
      if (allowed_currencies === null || (Array.isArray(allowed_currencies) && allowed_currencies.length === 0)) {
        updates.allowed_currencies = null;
      } else if (Array.isArray(allowed_currencies)) {
        const configured = await getAvailableCurrencies(userData.user_id, v.company_id);
        const cleaned = allowed_currencies.map((c: string) => c.toUpperCase().trim());
        const unknown = cleaned.filter((c: string) => !configured.includes(c));
        if (unknown.length > 0) {
          errorResponseHelper(res, 400, `allowed_currencies contains unconfigured wallets: ${unknown.join(", ")}`);
          return;
        }
        updates.allowed_currencies = JSON.stringify(cleaned);
      } else {
        errorResponseHelper(res, 400, "allowed_currencies must be an array or null"); return;
      }
    }
    if (status !== undefined) {
      if (!["active", "inactive", "revoked"].includes(status)) {
        errorResponseHelper(res, 400, "status must be one of active | inactive | revoked");
        return;
      }
      updates.status = status;
    }
    if (typeof key_name === "string") updates.key_name = key_name.slice(0, 100);
    if (typeof rate_limit_per_minute === "number" && rate_limit_per_minute > 0 && rate_limit_per_minute <= 300) {
      updates.rate_limit_per_minute = Math.floor(rate_limit_per_minute);
    }

    if (Object.keys(updates).length === 0) {
      errorResponseHelper(res, 400, "No valid fields to update");
      return;
    }

    await publishableKeyModel.update(updates, { where: { pub_key_id: id } });
    successResponseHelper(res, 200, "Publishable key updated", { pub_key_id: id, updated: Object.keys(updates) });
  } catch (err) {
    apiLogger.error(`[PublishableKey] update error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to update publishable key");
  }
};

export const deletePublishableKey = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const userData = res.locals.user;
    const id = Number(req.params.id);
    const row = await publishableKeyModel.findOne({ where: { pub_key_id: id } });
    if (!row) { errorResponseHelper(res, 404, "Publishable key not found"); return; }
    const v = row.dataValues as PublishableKeyRow;
    const companyData = await validateCompanyOwnership(res, v.company_id, userData.user_id);
    if (!companyData) return;
    // Soft delete = mark revoked (auditable); pk_live keys should NEVER hard-delete
    // so we retain webhook / analytics traceability of past sessions.
    await publishableKeyModel.update({ status: "revoked" }, { where: { pub_key_id: id } });
    successResponseHelper(res, 200, "Publishable key revoked", { pub_key_id: id });
  } catch (err) {
    apiLogger.error(`[PublishableKey] delete error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to delete publishable key");
  }
};

/* ------------------------------------------------------------------ */
/* Public session (Buy Button click → embed session)                   */
/* ------------------------------------------------------------------ */

export const createPublicEmbedSession = async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const pk = res.locals.publishableKey as PublishableKeyRow;
    const origin = res.locals.pkOrigin as string;

    const {
      button_id,
      amount: rawAmount,
      currency,
      redirect_uri,
      meta_data,
    } = (req.body || {}) as {
      button_id?: string;
      amount?: number;
      currency?: string;
      redirect_uri?: string;
      meta_data?: Record<string, unknown>;
    };

    // ------------------------------------------------------------------
    // Resolve button (if button_id supplied) — the canonical Stripe-style
    // path. When button_id is present the client-supplied `amount` is only
    // trusted when the button is a customer-priced button, and even then
    // it's clamped to the button's min/max range.
    // ------------------------------------------------------------------
    let button: any = null;
    let amount: number = 0;
    let buttonLabel: string | undefined;
    let buttonSuccessUrl: string | null = null;
    let buttonMetadata: Record<string, unknown> | null = null;
    let buttonAllowedCurr: string[] | null = null;

    if (button_id && typeof button_id === "string") {
      const row = await buyButtonModel.findOne({ where: { button_id } });
      if (!row) {
        res.status(404).json({ success: false, message: "Buy button not found" });
        return;
      }
      button = row.dataValues;
      if (button.company_id !== pk.company_id) {
        // Do NOT reveal cross-company existence
        res.status(404).json({ success: false, message: "Buy button not found" });
        return;
      }
      if (button.status !== "active") {
        res.status(400).json({ success: false, message: "Buy button is not active" });
        return;
      }

      if (button.price_type === "fixed") {
        if (typeof button.amount !== "number" || button.amount < 5) {
          res.status(500).json({ success: false, message: "Buy button has an invalid fixed price" });
          return;
        }
        // Client `amount` (if any) is IGNORED — this is the anti-tampering point.
        amount = Number(button.amount);
      } else {
        // customer-priced
        const minA = typeof button.min_amount === "number" ? button.min_amount : 5;
        const maxA = typeof button.max_amount === "number" ? button.max_amount : pk.max_amount;
        const a = Number(rawAmount);
        if (!Number.isFinite(a)) {
          res.status(400).json({ success: false, message: "amount is required for a customer-priced buy button" });
          return;
        }
        if (a < minA) {
          res.status(400).json({ success: false, message: `amount must be ≥ ${minA}` });
          return;
        }
        if (typeof maxA === "number" && a > maxA) {
          res.status(400).json({ success: false, message: `amount must be ≤ ${maxA}` });
          return;
        }
        amount = a;
      }

      buttonLabel = button.label;
      buttonSuccessUrl = button.success_url || null;
      try {
        buttonMetadata = button.metadata ? JSON.parse(button.metadata) : null;
      } catch {
        buttonMetadata = null;
      }
      try {
        buttonAllowedCurr = button.allowed_currencies
          ? JSON.parse(button.allowed_currencies)
          : null;
      } catch {
        buttonAllowedCurr = null;
      }
    } else {
      // Inline amount path (backward compat, no button-id)
      if (typeof rawAmount !== "number" || !Number.isFinite(rawAmount) || rawAmount < 5) {
        res.status(400).json({ success: false, message: "amount must be a number ≥ 5" });
        return;
      }
      amount = rawAmount;
    }

    // pk cap enforced in ALL cases (defense in depth)
    if (amount > pk.max_amount) {
      res.status(400).json({
        success: false,
        message: `amount ${amount} exceeds this publishable key's max_amount (${pk.max_amount}). Use the SECRET key server-side for larger amounts.`,
      });
      return;
    }

    // Locate the live secret key of the same environment — inherits webhook/base
    const activeSecret = await apiModel.findOne({
      where: { company_id: pk.company_id, status: "active", environment: pk.environment },
    });
    if (!activeSecret) {
      res.status(400).json({
        success: false,
        message: `Company has no active ${pk.environment} secret key — cannot create session.`,
      });
      return;
    }
    const secretData = activeSecret.dataValues as {
      company_id: number;
      user_id: number;
      base_currency?: string;
      webhook_url?: string | null;
      webhook_secret?: string | null;
    };

    // Configured currencies
    const allConfigured = await getAvailableCurrencies(secretData.user_id, pk.company_id);
    if (allConfigured.length === 0) {
      res.status(400).json({ success: false, message: "No crypto wallets configured for this company." });
      return;
    }

    // Compute effective currency filter: intersect(pk.allowed_currencies, button.allowed_currencies, request.currency, allConfigured)
    let allowedByPk: string[] | null = null;
    if (pk.allowed_currencies) {
      try { allowedByPk = JSON.parse(pk.allowed_currencies); } catch { allowedByPk = null; }
    }
    let effective = allConfigured;
    if (Array.isArray(allowedByPk) && allowedByPk.length > 0) {
      effective = effective.filter((c) => allowedByPk!.includes(c));
    }
    if (Array.isArray(buttonAllowedCurr) && buttonAllowedCurr.length > 0) {
      effective = effective.filter((c) => buttonAllowedCurr!.includes(c));
    }
    if (currency && typeof currency === "string") {
      const cUp = currency.toUpperCase().trim();
      if (!effective.includes(cUp)) {
        res.status(400).json({
          success: false,
          message: `Currency ${cUp} is not allowed for this key. Allowed: ${effective.join(", ") || "(none)"}`,
        });
        return;
      }
      effective = [cUp];
    }
    if (effective.length === 0) {
      res.status(400).json({
        success: false,
        message: "No currencies available for this publishable key. Check allowed_currencies and configured wallets.",
      });
      return;
    }

    // Recreate customer + build the SAME redis session payload the /embed/session uses
    const email = `pk-buyer-${pk.pub_key_id}-${Date.now()}@dynopay.internal`;
    const customerData = await findOrRecreateCustomer(
      crypto.randomUUID(),
      email,
      pk.company_id,
      secretData.base_currency || "USD"
    );

    // Merge merchant meta_data with button metadata — button meta wins on collision.
    let mergedMeta: Record<string, unknown> | null = null;
    if (buttonMetadata || meta_data) {
      mergedMeta = { ...(meta_data || {}), ...(buttonMetadata || {}) };
    }

    const redisPayload = {
      customer_id: customerData.customer_id,
      company_id: pk.company_id,
      adm_id: secretData.user_id,
      base_currency: secretData.base_currency || "USD",
      base_amount: amount,
      amount,
      redirect_uri: buttonSuccessUrl || redirect_uri || null,
      pathType: "createPayment",
      fee_payer: "company", // Buy buttons always cover fees themselves
      available_currencies: effective,
      all_configured_currencies: allConfigured,
      webhook_url: secretData.webhook_url || null,
      webhook_secret: secretData.webhook_secret || null,
      callback_url: null,
      ui_mode: "embedded",
      allowed_origins: [origin],
      pk_id: pk.pub_key_id,
      pk_source: button_id ? "buy-button-object" : "buy-button",
      button_id: button_id || null,
      ...(buttonLabel && { button_label: buttonLabel }),
      ...(mergedMeta && { meta_data: JSON.stringify(mergedMeta) }),
    };

    const transactionId = crypto.randomBytes(24).toString("hex");
    await setRedisItem("customer-" + transactionId, redisPayload);

    // Increment button usage (fire-and-forget)
    if (button_id) {
      buyButtonModel
        .increment("usage_count", { where: { button_id } })
        .catch(() => undefined);
      buyButtonModel
        .update({ last_used_at: new Date() }, { where: { button_id } })
        .catch(() => undefined);
    }

    const checkoutBase = process.env.CHECKOUT_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://checkout.dynopay.com";
    const client_secret = transactionId;
    const checkout_url = `${checkoutBase}/pay?d=${transactionId}&embed=1`;
    const expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    apiLogger.info(
      `[PublishableKey] Public session created — company=${pk.company_id} pk=${pk.pub_key_id} origin=${origin} amount=${amount} ${button_id ? `button=${button_id}` : ""}`
    );

    res.status(200).json({
      success: true,
      message: "Session created",
      data: {
        client_secret,
        checkout_url,
        expires_at,
        ui_mode: "embedded",
        currencies: effective,
        amount,
        ...(button_id && { button_id }),
      },
    });
  } catch (err) {
    apiLogger.error(`[PublishableKey] public session error: ${(err as Error).message}`);
    res.status(500).json({ success: false, message: "Failed to create session" });
  }
};

// Small utility exports for tests
export const __internal = { generatePkKey, normalizeDomain, parseJsonArray, maskKey };
