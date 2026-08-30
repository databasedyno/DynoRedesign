import express, { RequestHandler } from "express";
import { companyController } from "../controller";
import { companyMiddleware, uploadImage, authMiddleware } from "../middleware";
import { companyOwnershipMiddleware } from "../middleware/authMiddleware";
import { requirePermission, requireCompanyOwner } from "../middleware/teamPermissionMiddleware";
const companyRouter = express.Router();

companyRouter.post(
  "/addCompany",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  companyMiddleware,
  companyController.addCompany
);

companyRouter.put(
  "/updateCompany/:id",
  authMiddleware,
  companyOwnershipMiddleware,
  requirePermission("manage_company_settings"),
  uploadImage.single("image") as unknown as RequestHandler,
  companyMiddleware,
  companyController.updateCompany
);

companyRouter.get("/getCompany", authMiddleware, companyController.getCompany);
companyRouter.get("/getCompany/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("view_dashboard"), companyController.getCompanyById);
companyRouter.get("/getTransactions/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("view_transactions"), companyController.getTransactions);
companyRouter.delete("/deleteCompany/:id", authMiddleware, companyOwnershipMiddleware, requireCompanyOwner, companyController.deleteCompany);

// TAX ID Validation endpoint
companyRouter.post("/validateTaxId", authMiddleware, companyController.validateTaxId);

// Webhook configuration endpoints
companyRouter.put("/webhook-settings/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.updateWebhookSettings);
companyRouter.get("/webhook-settings/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.getWebhookSettings);
companyRouter.post("/webhook-reenable/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.reenableWebhook);
companyRouter.post("/webhook-test/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.testWebhook);

// Webhook history and stats endpoints
companyRouter.get("/webhook-history/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.getWebhookHistory);
companyRouter.get("/webhook-history/:id/detail/:logId", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.getWebhookDetail);
companyRouter.get("/webhook-stats/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.getWebhookStats);

// Auto-Stablecoin Conversion settings
companyRouter.get("/auto-convert/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("view_dashboard"), companyController.getAutoConvertSettings);
companyRouter.put("/auto-convert/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.updateAutoConvertSettings);
companyRouter.get("/conversion-history/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("view_transactions"), companyController.getConversionHistory);
companyRouter.get("/conversion-savings/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("view_dashboard"), companyController.getConversionSavings);

// Single conversion detail & retry
companyRouter.get("/conversion/:conversionId", authMiddleware, companyController.getConversionDetail);
companyRouter.post("/conversion/:conversionId/retry", authMiddleware, companyController.retryConversion);

// Fee-Free Trial Status (user-based)
companyRouter.get("/fee-free-status", authMiddleware, companyController.getFeeFreeStatus);

// Dashboard Display Currency (presentation-only, decoupled from API-key pricing)
companyRouter.get("/display-currency/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("view_dashboard"), companyController.getDisplayCurrency);
companyRouter.patch("/display-currency/:id", authMiddleware, companyOwnershipMiddleware, requirePermission("manage_company_settings"), companyController.updateDisplayCurrency);

export default companyRouter;
