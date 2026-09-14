/**
 * Standard API response layer (Phase 5).
 *
 * `sendSuccess` / `sendError` produce the merchant-API envelope
 *   success: { success: true,  message, [data], ...extra }
 *   error:   { success: false, message, ...extra }
 * which is byte-identical to the hand-written `res.status(...).json({ success, … })`
 * objects those routes used before. `asyncHandler` wraps a route handler so any
 * thrown error is caught, logged, and returned as a 500 with the same error
 * envelope — replacing the repeated per-handler try/catch.
 *
 * NOTE: this envelope intentionally differs from the internal
 * `successResponseHelper` ({ message, data }) / `errorResponseHelper`
 * ({ success, message, statusCode }) used by dashboard controllers. Those keep
 * their own shapes; do not cross-migrate without matching the consumer.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { Logger } from "winston";
import crypto from "crypto";

type Extra = Record<string, unknown>;

export interface SuccessOptions {
  /** HTTP status (default 200). */
  status?: number;
  message: string;
  /** Response payload placed under `data`. Omitted entirely when undefined. */
  data?: unknown;
  /** Extra top-level fields merged into the envelope (e.g. display_currency). */
  extra?: Extra;
}

export interface ErrorOptions {
  status: number;
  message: string;
  /** Extra top-level fields (e.g. errors, available_currencies). */
  extra?: Extra;
  /** Machine-readable category. Defaults from the HTTP status. */
  type?: string;
  /** Stable machine code, e.g. "amount_below_minimum". Defaults from status. */
  code?: string;
  /** The offending request parameter, when applicable. */
  param?: string;
  /** Docs link for this error. Defaults to the API error reference. */
  docUrl?: string;
}

const ERROR_DOC_URL = "https://dynopay.com/documentation#errors";

/** Stripe-style error category derived from the HTTP status. */
function errorTypeForStatus(status: number): string {
  if (status === 401 || status === 403) return "authentication_error";
  if (status === 429) return "rate_limit_error";
  if (status >= 500) return "api_error";
  return "invalid_request_error";
}

/** Fallback machine code so every error carries a stable, branchable code. */
function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400: return "invalid_request";
    case 401: return "unauthorized";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 409: return "conflict";
    case 422: return "unprocessable";
    case 429: return "rate_limited";
    default: return status >= 500 ? "internal_error" : "error";
  }
}

/** Reuse the correlation id set by requestLoggerMiddleware, else mint one. */
function resolveRequestId(res: Response): string {
  const existing = res.getHeader("Request-Id") || res.getHeader("X-Request-ID");
  if (existing) return String(existing);
  const fromReq = (res.req as (Request & { requestId?: string }) | undefined)?.requestId;
  return fromReq || crypto.randomUUID();
}

/** { success: true, message, [data], ...extra } */
export function sendSuccess(res: Response, opts: SuccessOptions): Response {
  res.setHeader("Request-Id", resolveRequestId(res));
  const body: Record<string, unknown> = { success: true, message: opts.message };
  if (opts.data !== undefined) body.data = opts.data;
  if (opts.extra) Object.assign(body, opts.extra);
  return res.status(opts.status ?? 200).json(body);
}

/**
 * { success: false, message, ...extra, error } — the legacy success/message/
 * extra fields are unchanged (backward compatible); the additive `error`
 * object ({ type, code, message, param?, doc_url, request_id }) and the
 * `Request-Id` response header make failures machine-readable.
 */
export function sendError(res: Response, opts: ErrorOptions): Response {
  const requestId = resolveRequestId(res);
  res.setHeader("Request-Id", requestId);

  const errorObj: Record<string, unknown> = {
    type: opts.type || errorTypeForStatus(opts.status),
    code: opts.code || defaultCodeForStatus(opts.status),
    message: opts.message,
    doc_url: opts.docUrl || ERROR_DOC_URL,
    request_id: requestId,
  };
  if (opts.param !== undefined) errorObj.param = opts.param;

  const body: Record<string, unknown> = { success: false, message: opts.message };
  if (opts.extra) Object.assign(body, opts.extra);
  body.error = errorObj;
  return res.status(opts.status).json(body);
}

export interface AsyncHandlerOptions {
  /** Winston logger used to record the caught error. */
  logger?: Logger;
  /** Log prefix, e.g. "[MerchantAPI] createUser" → logs "<label> error:". */
  label?: string;
}

/**
 * Wrap an async Express handler so thrown errors don't crash the request:
 * they're logged (when a logger is supplied) and returned as a 500 with the
 * standard error envelope. Behaviour matches the merchant-API catch blocks:
 * `{ success: false, message: err.message || "Internal server error" }`.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>,
  opts: AsyncHandlerOptions = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (opts.logger) {
        opts.logger.error(`${opts.label ? `${opts.label} ` : ""}error:`, error);
      }
      if (!res.headersSent) {
        sendError(res, {
          status: 500,
          message: error instanceof Error ? error.message : "Internal server error",
        });
      }
    }
  };
}

export default { sendSuccess, sendError, asyncHandler };
