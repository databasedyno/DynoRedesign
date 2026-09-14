import express from "express";
import xss from "xss";

/**
 * XSS Sanitization Middleware
 * Recursively sanitizes all string values in req.body, req.query, and req.params.
 * Prevents stored XSS attacks by stripping malicious HTML/JS from user inputs.
 *
 * Exceptions:
 * - Password fields are NOT sanitized (they may contain special characters)
 * - Webhook payloads (Tatum) are NOT sanitized (they contain blockchain data)
 */

const PASSWORD_FIELDS = new Set(["password", "oldPassword", "newPassword", "confirm_password"]);

// Paths that should skip sanitization (webhook endpoints)
const SKIP_PATHS = ["/tatum-webhook", "/tatum-crypto-webhook", "/webhook", "/failed_webhook", "/test-webhook"];

/**
 * Recursively sanitize an object's string values
 */
const sanitizeValue = (value: unknown, key?: string): unknown => {
  // Skip password fields
  if (key && PASSWORD_FIELDS.has(key)) {
    return value;
  }

  if (typeof value === "string") {
    return xss(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v, k);
    }
    return sanitized;
  }

  return value;
};

/**
 * Express middleware to sanitize request inputs against XSS
 */
const sanitizeInputMiddleware = (
  req: express.Request,
  _res: express.Response,
  next: express.NextFunction
) => {
  // Skip sanitization for webhook endpoints (they need raw blockchain data)
  if (SKIP_PATHS.some((path) => req.path.includes(path))) {
    return next();
  }

  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body) as typeof req.body;
  }

  if (req.query && typeof req.query === "object") {
    const sanitizedQuery: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(req.query)) {
      sanitizedQuery[key] = sanitizeValue(val, key);
    }
    req.query = sanitizedQuery as typeof req.query;
  }

  if (req.params && typeof req.params === "object") {
    const sanitizedParams: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.params)) {
      sanitizedParams[key] = typeof val === "string" ? xss(val) : val;
    }
    req.params = sanitizedParams;
  }

  next();
};

export default sanitizeInputMiddleware;
