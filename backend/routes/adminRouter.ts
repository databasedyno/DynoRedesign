import express from "express";
import adminController from "../controller/adminController";
import supportInboxController from "../controller/supportInboxController";
import { adminAuthMiddleware } from "../middleware";
import adminOrApiKeyMiddleware from "../middleware/adminOrApiKeyMiddleware";
import { loginRateLimiter } from "../middleware/rateLimitMiddleware";

const adminRouter = express.Router();

adminRouter.post("/login", loginRateLimiter, adminController.login);
adminRouter.post(
  "/createWallets",
  adminAuthMiddleware,
  adminController.createWallets
);
adminRouter.post(
  "/withdrawAssets",
  adminAuthMiddleware,
  adminController.withdrawAssets
);
adminRouter.get("/getWallets", adminAuthMiddleware, adminController.getWallets);
adminRouter.get(
  "/getAllTransactions",
  adminAuthMiddleware,
  adminController.getAllTransactions
);

adminRouter.get(
  "/getAllUsers",
  adminAuthMiddleware,
  adminController.getAllUsers
);

adminRouter.post(
  "/getAdminAnalytics",
  adminAuthMiddleware,
  adminController.getAdminAnalytics
);

adminRouter.get(
  "/getTransferFees",
  adminAuthMiddleware,
  adminController.getTransferFees
);
adminRouter.get(
  "/getFeeWalletBalance",
  adminAuthMiddleware,
  adminController.getFeeWalletBalance
);
adminRouter.post(
  "/newTransactionFee",
  adminAuthMiddleware,
  adminController.newTransactionFee
);

adminRouter.put(
  "/changePassword",
  adminAuthMiddleware,
  adminController.changePassword
);

adminRouter.put(
  "/updateTransferFees",
  adminAuthMiddleware,
  adminController.updateTransferFees
);

adminRouter.put(
  "/updateEmail",
  adminAuthMiddleware,
  adminController.updateEmail
);

adminRouter.put(
  "/updateFeeLimits",
  adminAuthMiddleware,
  adminController.updateFeeLimits
);

adminRouter.get(
  "/getTransactionFee",
  adminAuthMiddleware,
  adminController.getTransactionFee
);

// ── User Management ──────────────────────────────────────────────────────────
adminRouter.get(
  "/users/:userId",
  adminAuthMiddleware,
  adminController.getUserDetail
);
adminRouter.put(
  "/users/:userId/ban",
  adminAuthMiddleware,
  adminController.banUser
);
adminRouter.post(
  "/users/unlock",
  adminAuthMiddleware,
  adminController.unlockUser
);

// ── Customer Wallet Management ──────────────────────────────────────────────
// Admin or API key can credit/debit customer wallets
adminRouter.post(
  "/customers/:customerId/credit",
  adminOrApiKeyMiddleware,
  adminController.creditCustomerWallet
);
adminRouter.post(
  "/customers/:customerId/debit",
  adminOrApiKeyMiddleware,
  adminController.debitCustomerWallet
);

// adminRouter.get(
//   "/getBlockchainFeeConfigs",
//   adminAuthMiddleware,
//   adminController.getBlockchainFeeConfigs
// );

// adminRouter.post(
//   "/updateBlockchainFeeConfig",
//   adminAuthMiddleware,
//   adminController.updateBlockchainFeeConfig
// );

// adminRouter.post(
//   "/updateFeeTier",
//   adminAuthMiddleware,
//   adminController.updateFeeTier
// );

// ── Alert Service Endpoints ─────────────────────────────────────────────────
import alertService, { sendAlert, getHealth as getAlertHealth } from "../services/slackAlertService";
import { getTunnelStatus } from "../services/sshTunnelManager";
import { getProxyState } from "../services/binanceService";
import { getStatus as getWsStatus } from "../services/binanceWebSocketService";

adminRouter.get("/alerts/health", adminAuthMiddleware, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Alert service health",
    data: getAlertHealth(),
  });
});

adminRouter.post("/alerts/test", adminAuthMiddleware, async (_req, res) => {
  try {
    const result = await sendAlert({
      title: "Test Alert",
      message: "This is a test alert from Dynopay admin panel.",
      severity: "info",
      fields: { "Triggered by": "Admin test endpoint" },
    });
    res.status(200).json({
      success: true,
      message: "Test alert sent",
      data: { delivered: result },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send test alert", error: (err as Error).message });
  }
});

// ── SSH Tunnel & Binance Status ──────────────────────────────────────────────
adminRouter.get("/tunnel/status", adminAuthMiddleware, (_req, res) => {
  const tunnel = getTunnelStatus();
  const proxy = getProxyState();
  const websocket = getWsStatus();
  res.status(200).json({
    success: true,
    message: "Tunnel and Binance status",
    data: { tunnel, proxy, websocket },
  });
});

// ── Referral Marketing Backfill ──────────────────────────────────────────────
// One-time invite of historical paying customers (no account yet) with the
// standard 50%/30d referee offer. Defaults to a DRY RUN (counts only) — pass
// { "dry_run": false } to actually create codes and send invites.
// Body: { days?: number (default 365), limit?: number (default 200, max 1000), dry_run?: boolean }
adminRouter.post("/referral-invites/backfill", adminAuthMiddleware, async (req, res) => {
  try {
    const { backfillRefereeInvites } = await import("../services/referralService");
    const result = await backfillRefereeInvites({
      days: req.body?.days,
      limit: req.body?.limit,
      dryRun: req.body?.dry_run !== false,
    });
    res.status(200).json({
      success: true,
      message: result.dry_run
        ? "Dry run — no invites sent"
        : result.started
          ? "Backfill started in background (progress in API logs)"
          : result.reason || "Backfill not started",
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// ── Referral Share Nudge ─────────────────────────────────────────────────────
// Email active merchants who have a referral code but have never referred anyone
// (0 referrals, $0 earned) to start sharing. Defaults to a DRY RUN (counts +
// sample only) — pass { "dry_run": false } to actually send. Per-referrer
// idempotency (30d) means each is nudged at most once a month.
// Body: { limit?: number (default 200, max 1000), dry_run?: boolean }
adminRouter.post("/referral/share-nudge", adminAuthMiddleware, async (req, res) => {
  try {
    const { sendReferralShareNudges } = await import("../services/referralNudgeService");
    const result = await sendReferralShareNudges({
      limit: req.body?.limit,
      dryRun: req.body?.dry_run !== false,
    });
    res.status(200).json({
      success: true,
      message: result.dry_run
        ? "Dry run — no nudges sent"
        : `${result.sent} share nudge(s) sent, ${result.skipped} skipped`,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// ── Admin Support Inbox (live chat + AI takeover + email reply) ──────────────
adminRouter.get("/support/summary", adminAuthMiddleware, supportInboxController.summary);
adminRouter.get("/support/sessions", adminAuthMiddleware, supportInboxController.listSessions);
adminRouter.get("/support/sessions/:session_id", adminAuthMiddleware, supportInboxController.getSession);
adminRouter.post("/support/sessions/:session_id/reply", adminAuthMiddleware, supportInboxController.reply);
adminRouter.post("/support/sessions/:session_id/takeover", adminAuthMiddleware, supportInboxController.takeover);
adminRouter.post("/support/sessions/:session_id/handback", adminAuthMiddleware, supportInboxController.handback);
adminRouter.post("/support/sessions/:session_id/close", adminAuthMiddleware, supportInboxController.close);
adminRouter.post("/support/sessions/:session_id/reopen", adminAuthMiddleware, supportInboxController.reopen);
adminRouter.post("/support/sessions/:session_id/email", adminAuthMiddleware, supportInboxController.emailReply);

export default adminRouter;