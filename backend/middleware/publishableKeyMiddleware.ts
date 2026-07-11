/**
 * Publishable Key middleware — Phase 2 (Buy Button)
 *
 * Validates the `x-publishable-key` header on `/api/embed/public/*` endpoints.
 * Cross-origin request from a merchant browser page:
 *   1. Look up the pk by SHA-256 hash (constant-time compared to plaintext scan).
 *   2. Reject if status != 'active'.
 *   3. Match the request's Origin (fallback Referer) against `allowed_domains`.
 *      Supports exact origins ("https://shop.com") and wildcard subdomains
 *      ("*.shop.com" matches "www.shop.com" and "checkout.shop.com").
 *   4. Reflect the Origin in Access-Control-Allow-Origin so the browser accepts
 *      the response (per-key CORS, independent of the app-wide CORS).
 *   5. Enforce per-key rate limit (Redis TTL counter).
 *   6. Bump usage_count / last_used_at.
 *
 * On success:
 *   res.locals.publishableKey = the model row
 *   res.locals.pkOrigin       = the validated origin (already reflected in CORS)
 */

import type express from "express";
import crypto from "crypto";
import { publishableKeyModel } from "../models";
import { redis as redisClient } from "../utils/redisInstance";
import { apiLogger } from "../utils/loggers";

const PK_RATE_LIMIT_WINDOW_SEC = 60;

/** Normalize a URL/origin string to just the origin ("https://host[:port]"). */
function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    // Bare host without scheme — still worth normalising if we can
    return null;
  }
}

/** Match `candidate` against a list of allowed origins with wildcard support. */
function originAllowed(candidate: string, allowed: string[]): boolean {
  const cand = candidate.toLowerCase();
  for (const raw of allowed) {
    if (!raw) continue;
    const rule = raw.trim().toLowerCase();
    if (!rule) continue;
    // Exact origin match
    if (rule === cand) return true;
    // Wildcard subdomain — "*.shop.com" or "https://*.shop.com"
    // Normalize the rule to always compare host portion.
    const wildcardMatch = rule.match(/^(?:https?:\/\/)?\*\.(.+)$/);
    if (wildcardMatch) {
      const baseDomain = wildcardMatch[1];
      try {
        const candHost = new URL(cand).hostname;
        // e.g. baseDomain = "shop.com" — allow "www.shop.com", "any.shop.com", "shop.com" itself
        if (candHost === baseDomain || candHost.endsWith("." + baseDomain)) return true;
      } catch {
        /* ignore */
      }
    }
  }
  return false;
}

/** Extract the request Origin, falling back to Referer. */
function requestOrigin(req: express.Request): string | null {
  const originHdr = req.headers.origin;
  if (typeof originHdr === "string") {
    const o = normalizeOrigin(originHdr);
    if (o) return o;
  }
  const referer = req.headers.referer;
  if (typeof referer === "string") {
    const o = normalizeOrigin(referer);
    if (o) return o;
  }
  return null;
}

export interface PublishableKeyRow {
  pub_key_id: number;
  company_id: number;
  user_id: number;
  environment: "production" | "development";
  publishable_key: string;
  key_prefix: string;
  status: string;
  allowed_domains: string;
  max_amount: number;
  allowed_currencies: string | null;
  base_currency: string;
  rate_limit_per_minute: number;
}

/**
 * Preflight/CORS handler for /api/embed/public/*.
 * Runs BEFORE validatePublishableKey — OPTIONS requests never carry the pk
 * header so we can't authenticate them; instead we reflect any origin that
 * asks. The subsequent POST re-validates against the pk's allow-list.
 */
export const publishablePublicCors = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, x-publishable-key, x-dynopay-source, Accept"
    );
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

export const validatePublishableKey = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const rawKey = (req.headers["x-publishable-key"] || req.headers["X-Publishable-Key"] || "").toString().trim();
    if (!rawKey) {
      res.status(401).json({ success: false, message: "Missing x-publishable-key header" });
      return;
    }
    if (!/^pk_(live|test)_[A-Za-z0-9_-]{16,}$/.test(rawKey)) {
      res.status(401).json({ success: false, message: "Invalid publishable key format" });
      return;
    }

    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const row = (await publishableKeyModel.findOne({ where: { key_hash: keyHash } })) as unknown as
      | { dataValues: PublishableKeyRow }
      | null;
    if (!row) {
      res.status(401).json({ success: false, message: "Publishable key not found" });
      return;
    }
    const pk = row.dataValues;
    if (pk.status !== "active") {
      res.status(401).json({ success: false, message: `Publishable key is ${pk.status}` });
      return;
    }

    // Origin / Referer check
    const origin = requestOrigin(req);
    let allowed: string[] = [];
    try {
      allowed = JSON.parse(pk.allowed_domains || "[]");
    } catch {
      allowed = [];
    }
    if (!Array.isArray(allowed) || allowed.length === 0) {
      res.status(403).json({
        success: false,
        message: "Publishable key has no allowed_domains configured — set one in the dashboard before using this key in production.",
      });
      return;
    }
    if (!origin) {
      res.status(403).json({
        success: false,
        message: "Origin header missing — publishable keys can only be used from a browser page.",
      });
      return;
    }
    if (!originAllowed(origin, allowed)) {
      apiLogger.warn(
        `[PublishableKey] Rejected — origin ${origin} not in allow-list for pk ${pk.key_prefix}… (pub_key_id=${pk.pub_key_id})`
      );
      res.status(403).json({
        success: false,
        message: `Origin ${origin} is not in this publishable key's allowed_domains.`,
      });
      return;
    }
    // Reflect the validated origin (in case publishablePublicCors ran earlier
    // and set a different value)
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");

    // Rate limit
    const rateLimit = pk.rate_limit_per_minute || 30;
    if (rateLimit > 0) {
      try {
        if (redisClient) {
          const bucket = Math.floor(Date.now() / (PK_RATE_LIMIT_WINDOW_SEC * 1000));
          const rlKey = `pk_ratelimit:${pk.pub_key_id}:${bucket}`;
          const count = await redisClient.incr(rlKey);
          if (count === 1) {
            await redisClient.expire(rlKey, PK_RATE_LIMIT_WINDOW_SEC + 2);
          }
          if (count > rateLimit) {
            res.status(429).json({
              success: false,
              message: `Publishable key rate limit exceeded (${rateLimit} req/min)`,
            });
            return;
          }
        }
      } catch (rlErr) {
        apiLogger.warn(
          `[PublishableKey] Rate limit check failed (allowing through): ${(rlErr as Error).message}`
        );
      }
    }

    // Bump usage stats (fire-and-forget — never block the request)
    publishableKeyModel
      .increment(
        { usage_count: 1 },
        { where: { pub_key_id: pk.pub_key_id } }
      )
      .catch((err: unknown) => {
        apiLogger.warn(`[PublishableKey] usage_count update failed: ${(err as Error).message}`);
      });
    publishableKeyModel
      .update({ last_used_at: new Date() }, { where: { pub_key_id: pk.pub_key_id } })
      .catch(() => { /* best-effort */ });

    res.locals.publishableKey = pk;
    res.locals.pkOrigin = origin;
    next();
  } catch (err) {
    apiLogger.error(
      `[PublishableKey] Middleware error: ${(err as Error).message}`
    );
    res.status(500).json({ success: false, message: "Publishable key validation failed" });
  }
};

// Exported for the verification script.
export const __internal = { normalizeOrigin, originAllowed, requestOrigin };
