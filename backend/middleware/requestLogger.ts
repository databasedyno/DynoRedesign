import express from "express";
import crypto from "crypto";
import { apiLogger } from "../utils/loggers";
import { toFixedStr } from "../utils/money";

/**
 * Request-level logging middleware with correlation IDs.
 * Logs: method, URL, status code, response time, and request ID.
 * Attaches X-Request-ID header for distributed tracing.
 */

// Paths to exclude from logging (health checks, static assets)
const EXCLUDE_PATHS = ["/health", "/favicon.ico"];

const requestLoggerMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // Skip logging for excluded paths
  if (EXCLUDE_PATHS.some((path) => req.path === path)) {
    return next();
  }

  // Generate or use existing correlation ID
  const requestId =
    (req.headers["x-request-id"] as string) ||
    crypto.randomUUID();

  // Attach to request and response
  res.setHeader("X-Request-ID", requestId);
  (req as express.Request & { requestId?: string }).requestId = requestId;

  const start = process.hrtime.bigint();

  // Hook into response finish event
  res.on("finish", () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6; // ms
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";

    // Color-code by status
    const statusEmoji =
      statusCode >= 500
        ? "\u274C"
        : statusCode >= 400
        ? "\u26A0\uFE0F"
        : statusCode >= 300
        ? "\u27A1\uFE0F"
        : "\u2705";

    apiLogger.info(
      `${statusEmoji} ${method} ${url} ${statusCode} ${toFixedStr(duration, 1)}ms [${requestId.substring(0, 8)}] ${ip}`
    );
  });

  next();
};

export default requestLoggerMiddleware;
