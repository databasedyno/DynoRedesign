import express from "express";
import multer from "multer";
import safedealController, { safedealAuth } from "../controller/safedealController";
import authMiddleware from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware";
import { ATTACH_ALLOWED, ATTACH_MAX_BYTES } from "../services/safedeal/safedealAttachments";

const r = express.Router();

// Evidence uploads are held in memory (≤10 MB) and written straight to private object storage.
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACH_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => (ATTACH_ALLOWED[file.mimetype] ? cb(null, true) : cb(new Error("Only PNG, JPG, WEBP, GIF images or PDF files are allowed."))),
});
const uploadSingle = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const handler = evidenceUpload.single("file") as unknown as (rq: express.Request, rs: express.Response, cb: (err?: unknown) => void) => void;
  handler(req, res, (err?: unknown) => {
    if (err) {
      const msg = (err as { code?: string }).code === "LIMIT_FILE_SIZE" ? "File too large (max 10 MB)." : (err as Error).message || "Upload failed.";
      return res.status(400).json({ status: 400, message: msg });
    }
    next();
  });
};

// ── public ───────────────────────────────────────────────────────────────────
r.get("/safedeal/config", safedealController.config);
r.post("/safedeal/fee-preview", safedealController.feePreview);
r.post("/safedeal/auth/send-code", safedealController.sendCode);
r.post("/safedeal/auth/verify-code", safedealController.verifyCode);
r.get("/safedeal/deals/:token/preview", safedealController.previewDeal);
// Dynopay → SafeDeal payment events (HMAC-signed; SafeDeal is an API-key merchant of Dynopay)
r.post("/safedeal/webhooks/dynopay", safedealController.dynopayWebhook);

// ── signed-in SafeDeal user (x-safedeal-token) ───────────────────────────────
r.get("/safedeal/me", safedealAuth, safedealController.me);
r.post("/safedeal/profile", safedealAuth, safedealController.updateProfile);
r.post("/safedeal/auth/step-up", safedealAuth, safedealController.sendStepUp);
r.get("/safedeal/deals", safedealAuth, safedealController.listDeals);
r.post("/safedeal/deals", safedealAuth, safedealController.createDeal);
r.get("/safedeal/deals/:token", safedealAuth, safedealController.getDeal);
r.post("/safedeal/deals/:token/action", safedealAuth, safedealController.dealAction);
r.get("/safedeal/deals/:token/funding", safedealAuth, safedealController.getFunding);
r.post("/safedeal/deals/:token/funding", safedealAuth, safedealController.createFunding);
r.post("/safedeal/deals/:token/payout-destination", safedealAuth, safedealController.setPayoutDestination);
r.get("/safedeal/deals/:token/summary.pdf", safedealAuth, safedealController.dealPdf);
r.post("/safedeal/deals/:token/files", safedealAuth, uploadSingle, safedealController.uploadAttachment);
r.get("/safedeal/deals/:token/files/:id", safedealAuth, safedealController.downloadAttachment);
r.get("/safedeal/wallet", safedealAuth, safedealController.wallet);
r.get("/safedeal/wallet/statement", safedealAuth, safedealController.statement);
r.get("/safedeal/wallet/statement.csv", safedealAuth, safedealController.statementCsv);
r.get("/safedeal/wallet/addresses", safedealAuth, safedealController.addresses);
r.post("/safedeal/wallet/addresses", safedealAuth, safedealController.createAddress);
r.post("/safedeal/wallet/addresses/:id/remove", safedealAuth, safedealController.deleteAddress);
r.post("/safedeal/wallet/withdraw/quote", safedealAuth, safedealController.withdrawQuote);
r.post("/safedeal/wallet/withdraw", safedealAuth, safedealController.withdraw);
r.get("/safedeal/wallet/withdrawals", safedealAuth, safedealController.withdrawals);

// ── Dynopay admin (ops approvals) ────────────────────────────────────────────
r.get("/safedeal/admin/withdrawals", adminAuthMiddleware, safedealController.adminWithdrawals);
r.post("/safedeal/admin/withdrawals/:id/approve", adminAuthMiddleware, safedealController.adminApproveWithdrawal);
r.post("/safedeal/admin/withdrawals/:id/reject", adminAuthMiddleware, safedealController.adminRejectWithdrawal);
r.get("/safedeal/admin/readiness", adminAuthMiddleware, safedealController.adminReadiness);
r.post("/safedeal/admin/run-reminders", adminAuthMiddleware, safedealController.adminRunReminders);
r.get("/safedeal/admin/files/:id", adminAuthMiddleware, safedealController.adminDownloadAttachment);

// ── Dynopay brand owner (dashboard) ──────────────────────────────────────────
r.get("/safedeal/brand/:companyId/totals", authMiddleware, safedealController.brandTotals);
r.get("/safedeal/brand/:companyId/customers/:customerId/statement", authMiddleware, safedealController.brandCustomerStatement);

export default r;
