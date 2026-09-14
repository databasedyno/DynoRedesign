/**
 * Merchant-facing aliases for customer wallet adjustments (x-api-key auth).
 * Mounted at /api/user/customers — the legacy /api/admin/customers/:id/credit|debit
 * routes keep working; these give integrators a path that isn't labelled "admin".
 */
import express from "express";
import adminOrApiKeyMiddleware from "../middleware/adminOrApiKeyMiddleware";
import adminController from "../controller/adminController";

const router = express.Router();

router.post("/:customerId/credit", adminOrApiKeyMiddleware, adminController.creditCustomerWallet);
router.post("/:customerId/debit", adminOrApiKeyMiddleware, adminController.debitCustomerWallet);

export default router;
