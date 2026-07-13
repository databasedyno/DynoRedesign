import express, { RequestHandler } from "express";
import { companyController } from "../controller";
import { companyMiddleware, uploadImage, authMiddleware } from "../middleware";
import { companyOwnershipMiddleware } from "../middleware/authMiddleware";
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
  uploadImage.single("image") as unknown as RequestHandler,
  companyMiddleware,
  companyController.updateCompany
);

companyRouter.get("/getCompany", authMiddleware, companyController.getCompany);
companyRouter.get("/getCompany/:id", authMiddleware, companyOwnershipMiddleware, companyController.getCompanyById);
companyRouter.get("/getTransactions/:id", authMiddleware, companyOwnershipMiddleware, companyController.getTransactions);
companyRouter.delete("/deleteCompany/:id", authMiddleware, companyOwnershipMiddleware, companyController.deleteCompany);

// TAX ID Validation endpoint
companyRouter.post("/validateTaxId", authMiddleware, companyController.validateTaxId);

// Webhook configuration endpoints
companyRouter.put("/webhook-settings/:id", authMiddleware, companyOwnershipMiddleware, companyController.updateWebhookSettings);
companyRouter.get("/webhook-settings/:id", authMiddleware, companyOwnershipMiddleware, companyController.getWebhookSettings);
companyRouter.post("/webhook-test/:id", authMiddleware, companyOwnershipMiddleware, companyController.testWebhook);

// Webhook history and stats endpoints
companyRouter.get("/webhook-history/:id", authMiddleware, companyOwnershipMiddleware, companyController.getWebhookHistory);
companyRouter.get("/webhook-history/:id/detail/:logId", authMiddleware, companyOwnershipMiddleware, companyController.getWebhookDetail);
companyRouter.get("/webhook-stats/:id", authMiddleware, companyOwnershipMiddleware, companyController.getWebhookStats);

// Auto-Stablecoin Conversion settings
companyRouter.get("/auto-convert/:id", authMiddleware, companyOwnershipMiddleware, companyController.getAutoConvertSettings);
companyRouter.put("/auto-convert/:id", authMiddleware, companyOwnershipMiddleware, companyController.updateAutoConvertSettings);
companyRouter.get("/conversion-history/:id", authMiddleware, companyOwnershipMiddleware, companyController.getConversionHistory);

// Single conversion detail & retry
companyRouter.get("/conversion/:conversionId", authMiddleware, companyController.getConversionDetail);
companyRouter.post("/conversion/:conversionId/retry", authMiddleware, companyController.retryConversion);

// Fee-Free Trial Status (user-based)
companyRouter.get("/fee-free-status", authMiddleware, companyController.getFeeFreeStatus);

// Dashboard Display Currency (presentation-only, decoupled from API-key pricing)
companyRouter.get("/display-currency/:id", authMiddleware, companyOwnershipMiddleware, companyController.getDisplayCurrency);
companyRouter.patch("/display-currency/:id", authMiddleware, companyOwnershipMiddleware, companyController.updateDisplayCurrency);

export default companyRouter;
