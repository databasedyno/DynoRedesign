import { Response } from "express";
import { Request, NextFunction, RequestHandler } from "express";
import { getErrorMessage, errorResponseHelper } from "../helper";
import { Logger } from "winston";

/**
 * Standard controller error handler. Extracts message, logs with context, sends 500.
 * Replaces the repeated 7-line catch block pattern across all controllers.
 * 
 * Usage:
 *   } catch (e) {
 *     handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
 *   }
 */
export function handleControllerError(
  res: Response,
  e: unknown,
  logger: Logger,
  context: Record<string, unknown> = {}
): void {
  const message = getErrorMessage(e);
  logger.error(message, context, new Error(e as string));
  errorResponseHelper(res, 500, message);
}

/**
 * Same as handleControllerError but returns the result (for early-return patterns).
 */
export function handleControllerErrorReturn(
  res: Response,
  e: unknown,
  logger: Logger,
  context: Record<string, unknown> = {}
) {
  const message = getErrorMessage(e);
  logger.error(message, context, new Error(e as string));
  return errorResponseHelper(res, 500, message);
}

/**
 * Wrap an async controller so a thrown error is routed through
 * `handleControllerError` (internal `{ success:false, message, statusCode }`
 * envelope) instead of a per-handler try/catch. Behaviour is identical to the
 * existing `} catch (e) { handleControllerError(res, e, logger, ctx); }` blocks.
 *
 * Usage:
 *   export const getX = asyncController(async (req, res) => {
 *     ...
 *     return successResponseHelper(res, 200, "OK", data);
 *   }, walletLogger, "getX");
 *
 * `context` may be a static object or a function of the request.
 */
export function asyncController(
  fn: (req: Request, res: Response, next: NextFunction) => unknown | Promise<unknown>,
  logger: Logger,
  context: Record<string, unknown> | string | ((req: Request) => Record<string, unknown>) = {}
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      const ctx =
        typeof context === "function"
          ? context(req)
          : typeof context === "string"
            ? { handler: context }
            : context;
      handleControllerError(res, e, logger, ctx);
    }
  };
}
