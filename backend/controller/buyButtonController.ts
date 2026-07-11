/**
 * Buy Button controller — Phase 2D
 *
 * Endpoints (JWT):
 *   POST   /api/buy-buttons                   — create a button
 *   GET    /api/buy-buttons?company_id=…      — list company's buttons
 *   GET    /api/buy-buttons/:button_id        — fetch one
 *   PATCH  /api/buy-buttons/:button_id        — update fields (except button_id, company_id)
 *   DELETE /api/buy-buttons/:button_id        — soft-delete = archive
 *
 * Consumed by:
 *   /api/embed/public/session — accepts { button_id } instead of { amount }
 *   so the price cannot be tampered with in the merchant's HTML.
 */

import type express from "express";
import crypto from "crypto";
import { buyButtonModel, apiModel } from "../models";
import { apiLogger } from "../utils/loggers";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const generateButtonId = (): string => {
  // 22 char url-safe random ⇒ ~130 bits entropy
  const rand = crypto.randomBytes(16).toString("base64url");
  return `btn_${rand}`;
};

const parseJsonArray = (raw: unknown): string[] | null => {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== "string") return null;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as string[]) : null;
  } catch {
    return null;
  }
};

const normalizeCurrencies = (raw: unknown): string[] | null => {
  if (raw === null || raw === undefined) return null;
  const arr = Array.isArray(raw) ? raw : parseJsonArray(raw);
  if (!Array.isArray(arr)) return null;
  const cleaned = arr
    .map((s) => (typeof s === "string" ? s.trim().toUpperCase() : ""))
    .filter((s) => s.length > 0);
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : null;
};

const parseMetadata = (raw: unknown): Record<string, unknown> | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      /* fallthrough */
    }
  }
  return null;
};

type BuyButtonRow = {
  button_id: string;
  company_id: number;
  user_id: number;
  name: string;
  label: string;
  price_type: "fixed" | "customer";
  amount: number | null;
  min_amount: number | null;
  max_amount: number | null;
  base_currency: string;
  allowed_currencies: string | null;
  description: string | null;
  success_url: string | null;
  metadata: string | null;
  status: "active" | "archived";
  usage_count: number;
  last_used_at: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const shapeButton = (row: BuyButtonRow) => ({
  button_id: row.button_id,
  company_id: row.company_id,
  name: row.name,
  label: row.label,
  price_type: row.price_type,
  amount: row.amount,
  min_amount: row.min_amount,
  max_amount: row.max_amount,
  base_currency: row.base_currency,
  allowed_currencies: parseJsonArray(row.allowed_currencies),
  description: row.description,
  success_url: row.success_url,
  metadata: parseJsonArray(row.metadata) ?? parseMetadata(row.metadata) ?? null,
  status: row.status,
  usage_count: Number(row.usage_count || 0),
  last_used_at: row.last_used_at,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export const createBuyButton = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const userData = res.locals.user;
    const {
      company_id,
      name,
      label,
      price_type = "fixed",
      amount,
      min_amount,
      max_amount,
      base_currency,
      allowed_currencies,
      description,
      success_url,
      metadata,
    } = req.body as {
      company_id: number;
      name?: string;
      label?: string;
      price_type?: "fixed" | "customer";
      amount?: number;
      min_amount?: number;
      max_amount?: number;
      base_currency?: string;
      allowed_currencies?: unknown;
      description?: string;
      success_url?: string;
      metadata?: unknown;
    };

    if (!company_id || Number.isNaN(Number(company_id))) {
      errorResponseHelper(res, 400, "company_id is required");
      return;
    }
    const companyData = await validateCompanyOwnership(
      res,
      Number(company_id),
      userData.user_id,
    );
    if (!companyData) return;

    if (!name || typeof name !== "string" || !name.trim()) {
      errorResponseHelper(res, 400, "name is required");
      return;
    }
    if (price_type !== "fixed" && price_type !== "customer") {
      errorResponseHelper(res, 400, "price_type must be 'fixed' or 'customer'");
      return;
    }

    // Amount validation depends on price_type
    let amt: number | null = null;
    let minA: number | null = null;
    let maxA: number | null = null;
    if (price_type === "fixed") {
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 5) {
        errorResponseHelper(res, 400, "amount must be a number ≥ 5 when price_type='fixed'");
        return;
      }
      amt = amount;
    } else {
      // customer
      if (min_amount !== undefined && min_amount !== null) {
        if (typeof min_amount !== "number" || !Number.isFinite(min_amount) || min_amount < 5) {
          errorResponseHelper(res, 400, "min_amount must be a number ≥ 5 when price_type='customer'");
          return;
        }
        minA = min_amount;
      } else {
        minA = 5;
      }
      if (max_amount !== undefined && max_amount !== null) {
        if (typeof max_amount !== "number" || !Number.isFinite(max_amount) || max_amount <= (minA || 5)) {
          errorResponseHelper(res, 400, "max_amount must be a number greater than min_amount");
          return;
        }
        maxA = max_amount;
      }
    }

    // Locate an active secret key of the SAME company to inherit base_currency.
    // (We do NOT hard-require it exist because a merchant can pre-create buttons
    //  during onboarding — but we WARN downstream if missing.)
    const activeSecret = await apiModel.findOne({
      where: { company_id: Number(company_id), status: "active" },
      order: [["updatedAt", "DESC"]],
    });
    const inheritedBase = (activeSecret?.dataValues as { base_currency?: string } | undefined)
      ?.base_currency;
    const effectiveBase = (base_currency || inheritedBase || "USD").toUpperCase();

    const button_id = generateButtonId();
    const allowedCurr = normalizeCurrencies(allowed_currencies);
    const md = parseMetadata(metadata);

    const created = await buyButtonModel.create({
      button_id,
      company_id: Number(company_id),
      user_id: userData.user_id,
      name: name.trim().slice(0, 120),
      label: (label && String(label).trim()) || "Pay with crypto",
      price_type,
      amount: amt,
      min_amount: minA,
      max_amount: maxA,
      base_currency: effectiveBase,
      allowed_currencies: allowedCurr ? JSON.stringify(allowedCurr) : null,
      description: description ? String(description).slice(0, 500) : null,
      success_url: success_url ? String(success_url).slice(0, 500) : null,
      metadata: md ? JSON.stringify(md) : null,
      status: "active",
    } as unknown as BuyButtonRow);

    successResponseHelper(res, 201, "Buy button created", shapeButton(created.dataValues as BuyButtonRow));
  } catch (err) {
    apiLogger.error(`[BuyButton] create error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to create buy button");
  }
};

export const listBuyButtons = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const userData = res.locals.user;
    const company_id = Number(req.query.company_id);
    if (!company_id) {
      errorResponseHelper(res, 400, "company_id is required");
      return;
    }
    const companyData = await validateCompanyOwnership(res, company_id, userData.user_id);
    if (!companyData) return;

    const rows = await buyButtonModel.findAll({
      where: { company_id },
      order: [["createdAt", "DESC"]],
    });
    successResponseHelper(res, 200, "Buy buttons", {
      buttons: rows.map((r) => shapeButton(r.dataValues as BuyButtonRow)),
    });
  } catch (err) {
    apiLogger.error(`[BuyButton] list error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to list buy buttons");
  }
};

export const getBuyButton = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const userData = res.locals.user;
    const { button_id } = req.params as { button_id: string };
    const row = await buyButtonModel.findOne({ where: { button_id } });
    if (!row) {
      errorResponseHelper(res, 404, "Buy button not found");
      return;
    }
    const v = row.dataValues as BuyButtonRow;
    const companyData = await validateCompanyOwnership(res, v.company_id, userData.user_id);
    if (!companyData) return;
    successResponseHelper(res, 200, "Buy button", shapeButton(v));
  } catch (err) {
    apiLogger.error(`[BuyButton] get error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to fetch buy button");
  }
};

export const updateBuyButton = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const userData = res.locals.user;
    const { button_id } = req.params as { button_id: string };
    const existing = await buyButtonModel.findOne({ where: { button_id } });
    if (!existing) {
      errorResponseHelper(res, 404, "Buy button not found");
      return;
    }
    const v = existing.dataValues as BuyButtonRow;
    const companyData = await validateCompanyOwnership(res, v.company_id, userData.user_id);
    if (!companyData) return;

    // Whitelist of updatable fields (button_id, company_id, user_id, price_type immutable)
    const b = (req.body || {}) as Record<string, unknown>;
    const patch: Partial<BuyButtonRow> = {};

    if (typeof b.name === "string" && b.name.trim()) {
      patch.name = b.name.trim().slice(0, 120);
    }
    if (typeof b.label === "string") {
      patch.label = b.label.trim().slice(0, 80) || "Pay with crypto";
    }
    if (b.amount !== undefined && v.price_type === "fixed") {
      const n = Number(b.amount);
      if (!Number.isFinite(n) || n < 5) {
        errorResponseHelper(res, 400, "amount must be a number ≥ 5");
        return;
      }
      patch.amount = n;
    }
    if (b.min_amount !== undefined && v.price_type === "customer") {
      const n = Number(b.min_amount);
      if (!Number.isFinite(n) || n < 5) {
        errorResponseHelper(res, 400, "min_amount must be a number ≥ 5");
        return;
      }
      patch.min_amount = n;
    }
    if (b.max_amount !== undefined && v.price_type === "customer") {
      if (b.max_amount === null) {
        patch.max_amount = null;
      } else {
        const n = Number(b.max_amount);
        const minRef = patch.min_amount ?? v.min_amount ?? 5;
        if (!Number.isFinite(n) || n <= minRef) {
          errorResponseHelper(res, 400, "max_amount must be greater than min_amount");
          return;
        }
        patch.max_amount = n;
      }
    }
    if (b.allowed_currencies !== undefined) {
      const nc = normalizeCurrencies(b.allowed_currencies);
      patch.allowed_currencies = nc ? JSON.stringify(nc) : null;
    }
    if (b.description !== undefined) {
      patch.description = b.description === null
        ? null
        : String(b.description).slice(0, 500);
    }
    if (b.success_url !== undefined) {
      patch.success_url = b.success_url === null
        ? null
        : String(b.success_url).slice(0, 500);
    }
    if (b.metadata !== undefined) {
      const md = parseMetadata(b.metadata);
      patch.metadata = md ? JSON.stringify(md) : null;
    }
    if (b.status !== undefined) {
      if (b.status !== "active" && b.status !== "archived") {
        errorResponseHelper(res, 400, "status must be 'active' or 'archived'");
        return;
      }
      patch.status = b.status as "active" | "archived";
    }
    if (b.base_currency !== undefined && typeof b.base_currency === "string" && b.base_currency.trim()) {
      patch.base_currency = b.base_currency.trim().toUpperCase().slice(0, 8);
    }

    if (Object.keys(patch).length === 0) {
      errorResponseHelper(res, 400, "no updatable fields provided");
      return;
    }

    await buyButtonModel.update(patch, { where: { button_id } });
    const refreshed = await buyButtonModel.findOne({ where: { button_id } });
    successResponseHelper(
      res,
      200,
      "Buy button updated",
      shapeButton((refreshed as any).dataValues as BuyButtonRow),
    );
  } catch (err) {
    apiLogger.error(`[BuyButton] update error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to update buy button");
  }
};

export const deleteBuyButton = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    const userData = res.locals.user;
    const { button_id } = req.params as { button_id: string };
    const existing = await buyButtonModel.findOne({ where: { button_id } });
    if (!existing) {
      errorResponseHelper(res, 404, "Buy button not found");
      return;
    }
    const v = existing.dataValues as BuyButtonRow;
    const companyData = await validateCompanyOwnership(res, v.company_id, userData.user_id);
    if (!companyData) return;
    // Soft-delete = archive (retain analytics + past sessions)
    await buyButtonModel.update({ status: "archived" }, { where: { button_id } });
    successResponseHelper(res, 200, "Buy button archived", { button_id });
  } catch (err) {
    apiLogger.error(`[BuyButton] delete error: ${(err as Error).message}`);
    errorResponseHelper(res, 500, "Failed to archive buy button");
  }
};

export const __internal = { generateButtonId, parseJsonArray, normalizeCurrencies, parseMetadata, shapeButton };
