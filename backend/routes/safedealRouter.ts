import express from "express";
import multer from "multer";
import safedealController, { safedealAuth } from "../controller/safedealController";
import { getSafeDealOgImage } from "../controller/safedeal/safedealOgImage";
import { sdAddressVerify, sdAddressVerifyNonce, sdFundingWalletTx } from "../controller/safedeal/safedealWallet";
import authMiddleware from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware";
import { clientIp, createRateLimiter, otpRateLimiter } from "../middleware/rateLimitMiddleware";
import { ATTACH_ALLOWED, ATTACH_MAX_BYTES } from "../services/safedeal/safedealAttachments";

// Per-route limiter keys (NOT the shared `strict:<ip>` bucket) so one noisy endpoint can't lock
// out cashouts for everyone behind the same NAT.
const sdLimiter = (name: string, maxRequests: number, windowMin = 15) =>
  createRateLimiter((req) => `sd:${name}:${clientIp(req)}`, async () => ({ windowMs: windowMin * 60 * 1000, maxRequests }));
const telegramLimiter = sdLimiter("telegram", 20);
const stepUpLimiter = sdLimiter("stepup", 10);
const addressLimiter = sdLimiter("address", 20);
const withdrawLimiter = sdLimiter("withdraw", 20);
const simulateLimiter = sdLimiter("simulate", 20);

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
r.post("/safedeal/auth/send-code", otpRateLimiter, safedealController.sendCode);
r.post("/safedeal/auth/verify-code", otpRateLimiter, safedealController.verifyCode);
r.post("/safedeal/auth/telegram", telegramLimiter, safedealController.telegramAuth);
r.get("/safedeal/deals/:token/preview", safedealController.previewDeal);
r.get("/safedeal/referral/:code", safedealController.referralCheck);
// Rendered share card for chat/social unfurls of a deal link (public, read-only)
r.get("/safedeal/og-image", getSafeDealOgImage);
// Dynopay → SafeDeal payment events (HMAC-signed; SafeDeal is an API-key merchant of Dynopay)
r.post("/safedeal/webhooks/dynopay", safedealController.dynopayWebhook);

// ── signed-in SafeDeal user (x-safedeal-token) ───────────────────────────────
r.get("/safedeal/me", safedealAuth, safedealController.me);
r.get("/safedeal/rewards", safedealAuth, safedealController.rewards);
r.post("/safedeal/profile", safedealAuth, safedealController.updateProfile);
r.get("/safedeal/telegram", safedealAuth, safedealController.telegramStatus);
r.post("/safedeal/telegram/link", safedealAuth, safedealController.telegramLink);
r.post("/safedeal/telegram/test", safedealAuth, safedealController.telegramTest);
r.post("/safedeal/telegram/unlink", safedealAuth, safedealController.telegramUnlink);
r.post("/safedeal/account/email/start", safedealAuth, otpRateLimiter, safedealController.addEmailStart);
r.post("/safedeal/account/email/verify", safedealAuth, stepUpLimiter, safedealController.addEmailVerify);
r.post("/safedeal/auth/step-up", safedealAuth, stepUpLimiter, safedealController.sendStepUp);
r.get("/safedeal/deals", safedealAuth, safedealController.listDeals);
r.post("/safedeal/deals", safedealAuth, safedealController.createDeal);
r.get("/safedeal/deals/:token", safedealAuth, safedealController.getDeal);
r.post("/safedeal/deals/:token/claim", safedealAuth, safedealController.claimDeal);
r.post("/safedeal/deals/:token/action", safedealAuth, safedealController.dealAction);
r.get("/safedeal/deals/:token/funding", safedealAuth, safedealController.getFunding);
r.post("/safedeal/deals/:token/funding", safedealAuth, safedealController.createFunding);
// Buyer paid from a connected wallet — tx-hash hint for support (ledger stays authoritative)
r.post("/safedeal/deals/:token/funding/wallet-tx", safedealAuth, sdFundingWalletTx);
r.post("/safedeal/deals/:token/payout-destination", safedealAuth, safedealController.setPayoutDestination);
r.get("/safedeal/deals/:token/summary.pdf", safedealAuth, safedealController.dealPdf);
r.post("/safedeal/deals/:token/files", safedealAuth, uploadSingle, safedealController.uploadAttachment);
r.get("/safedeal/deals/:token/files/:id", safedealAuth, safedealController.downloadAttachment);
r.get("/safedeal/wallet", safedealAuth, safedealController.wallet);
r.get("/safedeal/wallet/statement", safedealAuth, safedealController.statement);
r.get("/safedeal/wallet/statement.csv", safedealAuth, safedealController.statementCsv);
r.get("/safedeal/wallet/addresses", safedealAuth, safedealController.addresses);
r.post("/safedeal/wallet/addresses", safedealAuth, addressLimiter, safedealController.createAddress);
r.post("/safedeal/wallet/addresses/:id/remove", safedealAuth, addressLimiter, safedealController.deleteAddress);
// "Verify with wallet" — prove control of a saved cashout address by signing (no funds move)
r.post("/safedeal/wallet/addresses/:id/verify-nonce", safedealAuth, sdAddressVerifyNonce);
r.post("/safedeal/wallet/addresses/:id/verify", safedealAuth, sdAddressVerify);
r.post("/safedeal/wallet/withdraw/quote", safedealAuth, safedealController.withdrawQuote);
r.post("/safedeal/wallet/withdraw", safedealAuth, withdrawLimiter, safedealController.withdraw);
r.get("/safedeal/wallet/withdrawals", safedealAuth, safedealController.withdrawals);
r.get("/safedeal/wallet/topup/coins", safedealAuth, safedealController.topupCoins);
r.get("/safedeal/wallet/topup", safedealAuth, safedealController.topupList);
r.post("/safedeal/wallet/topup", safedealAuth, safedealController.topupCreate);
r.get("/safedeal/wallet/topup/:id", safedealAuth, safedealController.topupGet);
r.post("/safedeal/wallet/topup/:id/simulate", safedealAuth, simulateLimiter, safedealController.topupSimulate);
r.get("/safedeal/wallet/topup/:id/receipt.pdf", safedealAuth, safedealController.topupReceiptPdf);
r.get("/safedeal/invoices", safedealAuth, safedealController.invoices);

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
