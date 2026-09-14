/**
 * Admin › Security events
 * - GET  /admin/security/events                 — latest security incidents (2FA resets, freezes)
 * - POST /admin/security/users/:userId/unfreeze — lift a payout-wallet freeze early
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { adminLogger } from "../utils/loggers";
import { listSecurityEvents, recordSecurityEvent, resolveSecurityEvents } from "../services/securityEventService";
import { clearWalletFreeze, isWalletFrozen } from "../services/wallet/walletChangeAlert";

const events = async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const rows = await listSecurityEvents(limit);
    successResponseHelper(res, 200, "Security events", { events: rows, total: rows.length });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const unfreeze = async (req: express.Request, res: express.Response) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) return errorResponseHelper(res, 400, "Invalid user ID");
    const state = await isWalletFrozen(userId);
    if (!state.frozen) return errorResponseHelper(res, 409, "Wallet changes are not frozen for this user.");

    const admin = (res.locals.user || {}) as { email?: string; user_id?: number };
    const by = admin.email || (admin.user_id ? `admin#${admin.user_id}` : "admin");
    await clearWalletFreeze(userId);
    await resolveSecurityEvents(userId, by);
    await recordSecurityEvent({
      user_id: userId,
      type: "wallet_unfrozen",
      severity: "info",
      summary: `Wallet freeze lifted early by ${by}.`,
    });
    adminLogger.warn(`[Security] wallet freeze lifted for user ${userId} by ${by}`);
    successResponseHelper(res, 200, "Wallet changes unlocked for this user.");
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

export default { events, unfreeze };
