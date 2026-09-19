import express from "express";
import safedealController, { safedealAuth } from "../controller/safedealController";
import authMiddleware from "../middleware/authMiddleware";
import { adminAuthMiddleware } from "../middleware";

const r = express.Router();

// ── public ───────────────────────────────────────────────────────────────────
r.get("/safedeal/config", safedealController.config);
r.post("/safedeal/fee-preview", safedealController.feePreview);
r.post("/safedeal/auth/send-code", safedealController.sendCode);
r.post("/safedeal/auth/verify-code", safedealController.verifyCode);
r.get("/safedeal/deals/:token/preview", safedealController.previewDeal);

// ── signed-in SafeDeal user (x-safedeal-token) ───────────────────────────────
r.get("/safedeal/me", safedealAuth, safedealController.me);
r.post("/safedeal/profile", safedealAuth, safedealController.updateProfile);
r.post("/safedeal/auth/step-up", safedealAuth, safedealController.sendStepUp);
r.get("/safedeal/deals", safedealAuth, safedealController.listDeals);
r.post("/safedeal/deals", safedealAuth, safedealController.createDeal);
r.get("/safedeal/deals/:token", safedealAuth, safedealController.getDeal);
r.post("/safedeal/deals/:token/action", safedealAuth, safedealController.dealAction);
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

// ── Dynopay brand owner (dashboard) ──────────────────────────────────────────
r.get("/safedeal/brand/:companyId/totals", authMiddleware, safedealController.brandTotals);
r.get("/safedeal/brand/:companyId/customers/:customerId/statement", authMiddleware, safedealController.brandCustomerStatement);

export default r;
