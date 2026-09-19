import express from "express";
import escrowController from "../controller/escrowController";
import { adminAuthMiddleware } from "../middleware";

/**
 * Escrow — Dynopay ADMIN surface only (oversight, dispute arbitration, scans).
 * Party-facing escrow lives in the SafeDeal product: routes/safedealRouter.ts.
 */
const escrowRouter = express.Router();

escrowRouter.get("/escrow/admin/deals", adminAuthMiddleware, escrowController.adminListDeals);
escrowRouter.get("/escrow/admin/disputes", adminAuthMiddleware, escrowController.adminDisputeQueue);
escrowRouter.post("/escrow/admin/run-auto-release", adminAuthMiddleware, escrowController.adminRunAutoRelease);
escrowRouter.post("/escrow/admin/run-payout-reminders", adminAuthMiddleware, escrowController.adminRunPayoutReminders);
escrowRouter.post("/escrow/admin/run-dispute-escalations", adminAuthMiddleware, escrowController.adminRunDisputeEscalations);
escrowRouter.post("/escrow/admin/:id/resolve", adminAuthMiddleware, escrowController.adminResolveDispute);

export default escrowRouter;
