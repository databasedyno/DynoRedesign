import express from "express";
import { errorResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { verifyAccessToken, consumeStepUp, AdminAuthError } from "../services/adminAuthService";
import type { AdminStepUpReason } from "../services/adminAuthService";

/**
 * Admin console auth (SEC-002 hardened).
 *
 * Verifies a short-lived, session-backed admin JWT (issuer/audience pinned),
 * then confirms the session is live (exists, jti matches, not revoked, not
 * expired) and that the token predates no "sign out everywhere" cutoff. Legacy
 * 30-day tokens (no iss/aud/sid) fail verification and force a fresh 2FA login.
 *
 * res.locals.user = { admin_id, email, role:"ADMIN", sid } — `email` + role are
 * preserved for existing admin controllers; `res.locals.token` stays the raw JWT.
 */
const adminAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return errorResponseHelper(res, 403, "Your Login has Expired");

    const admin = await verifyAccessToken(token);
    res.locals.token = token;
    res.locals.user = admin; // { admin_id, email, role, sid }
    next();
  } catch (e) {
    if (e instanceof AdminAuthError) return errorResponseHelper(res, e.status, e.message);
    apiLogger.error("Admin Auth Middleware Error:", e);
    return errorResponseHelper(res, 500, "Server error");
  }
};

/**
 * requireAdminStepUp("platform-settings") — gate a sensitive write behind a
 * fresh, reason-bound, one-use step-up grant (X-Admin-Step-Up header). Must run
 * AFTER adminAuthMiddleware.
 */
export const requireAdminStepUp =
  (reason: AdminStepUpReason) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const sid = (res.locals.user as { sid?: string })?.sid;
      const token = String(req.header("x-admin-step-up") || "");
      const ok = sid ? await consumeStepUp(sid, reason, token) : false;
      if (!ok) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          code: "ADMIN_STEPUP_REQUIRED",
          reason,
          message: "Please verify it's you to continue.",
        });
      }
      next();
    } catch (e) {
      apiLogger.error("Admin StepUp Middleware Error:", e);
      return errorResponseHelper(res, 500, "Server error");
    }
  };

export default adminAuthMiddleware;
