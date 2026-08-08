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
}

/** { success: true, message, [data], ...extra } */
export function sendSuccess(res: Response, opts: SuccessOptions): Response {
  const body: Record<string, unknown> = { success: true, message: opts.message };
  if (opts.data !== undefined) body.data = opts.data;
  if (opts.extra) Object.assign(body, opts.extra);
  return res.status(opts.status ?? 200).json(body);
}

/** { success: false, message, ...extra } */
export function sendError(res: Response, opts: ErrorOptions): Response {
  const body: Record<string, unknown> = { success: false, message: opts.message };
  if (opts.extra) Object.assign(body, opts.extra);
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
