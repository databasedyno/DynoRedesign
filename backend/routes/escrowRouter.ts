import express from "express";
import escrowController from "../controller/escrowController";
import authMiddleware from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware";

const escrowRouter = express.Router();

// ── Public (counterparty) — no session; email OTP + escrow session token ─────
escrowRouter.get("/escrow/public/:token", escrowController.getPublicDeal);
escrowRouter.post("/escrow/public/:token/send-otp", escrowController.sendOtp);
escrowRouter.post("/escrow/public/:token/verify-otp", escrowController.verifyOtp);
escrowRouter.post("/escrow/public/:token/respond", escrowController.respondInvite);
escrowRouter.post("/escrow/public/:token/action", escrowController.publicAction);

// ── Admin (dispute arbitration, oversight, maintenance scans) ────────────────
escrowRouter.get("/escrow/admin/deals", adminAuthMiddleware, escrowController.adminListDeals);
escrowRouter.get("/escrow/admin/disputes", adminAuthMiddleware, escrowController.adminDisputeQueue);
escrowRouter.post("/escrow/admin/run-auto-release", adminAuthMiddleware, escrowController.adminRunAutoRelease);
escrowRouter.post("/escrow/admin/run-payout-reminders", adminAuthMiddleware, escrowController.adminRunPayoutReminders);
escrowRouter.post("/escrow/admin/:id/resolve", adminAuthMiddleware, escrowController.adminResolveDispute);

// ── Merchant (authenticated) ─────────────────────────────────────────────────
escrowRouter.post("/escrow/fee-preview", authMiddleware, escrowController.previewFee);
escrowRouter.get("/escrow", authMiddleware, escrowController.listDeals);
escrowRouter.post("/escrow", authMiddleware, escrowController.createDeal);
escrowRouter.get("/escrow/:id", authMiddleware, escrowController.getDeal);
escrowRouter.post("/escrow/:id/payout-info", authMiddleware, escrowController.setPayoutInfo);
escrowRouter.post("/escrow/:id/deliver", authMiddleware, escrowController.markDelivered);
escrowRouter.post("/escrow/:id/release", authMiddleware, escrowController.confirmRelease);
escrowRouter.post("/escrow/:id/dispute", authMiddleware, escrowController.raiseDispute);
escrowRouter.post("/escrow/:id/cancel", authMiddleware, escrowController.cancelDeal);
escrowRouter.post("/escrow/:id/simulate-fund", authMiddleware, escrowController.simulateFund);

export default escrowRouter;
