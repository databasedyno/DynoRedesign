import express from "express";
import { apiController } from "../controller";
import customerDirectoryController from "../controller/customerDirectoryController";
import { apiMiddleware, authMiddleware } from "../middleware";

const apiRouter = express.Router();

// API Key Management
apiRouter.post("/addApi", authMiddleware, apiMiddleware, apiController.addApi);
apiRouter.get("/getApi", authMiddleware, apiController.getApi);
apiRouter.get("/getApi/:id", authMiddleware, apiController.getApiById);
apiRouter.put("/updateApi/:id", authMiddleware, apiController.updateApi);
apiRouter.post("/regenerateKey/:id", authMiddleware, apiController.regenerateApiKey);
// ALIAS: Frontend compatibility - POST /userApi/regenerateApi/:id -> POST /userApi/regenerateKey/:id
apiRouter.post("/regenerateApi/:id", authMiddleware, apiController.regenerateApiKey);
apiRouter.put("/toggleStatus/:id", authMiddleware, apiController.toggleApiStatus);
apiRouter.post("/revoke/:id", authMiddleware, apiController.revokeApi);
apiRouter.delete("/deleteApi/:id", authMiddleware, apiController.deleteApi);

// Currency Configuration
apiRouter.get("/availableCurrencies/:company_id", authMiddleware, apiController.getAvailableCurrencies);

// API Usage & Monitoring (NEW)
apiRouter.get("/usage/:id", authMiddleware, apiController.getApiUsageStats);
apiRouter.get("/logs/:id", authMiddleware, apiController.getApiLogs);
apiRouter.put("/rateLimit/:id", authMiddleware, apiController.updateRateLimit);

// Plan Management
apiRouter.post("/createPlan", authMiddleware, apiMiddleware, apiController.createPlan);
apiRouter.get("/getPlans/:id", authMiddleware, apiController.getPlans);
apiRouter.put("/updatePlan/:id", authMiddleware, apiController.updatePlan);
apiRouter.delete("/deletePlan/:id", authMiddleware, apiController.deletePlan);

// Customer Management
apiRouter.post("/getApiCustomers", authMiddleware, apiController.getApiCustomers);
// Unified payments-derived customer directory (the re-imagined Customers page).
// NOTE: registered BEFORE the legacy /customers + /customer/:id routes.
apiRouter.get("/customers/directory", authMiddleware, customerDirectoryController.getCustomerDirectory);
apiRouter.get("/customers/directory/detail", authMiddleware, customerDirectoryController.getCustomerDirectoryDetail);
apiRouter.get("/customers", authMiddleware, apiController.getCustomersWithBalances);
apiRouter.get("/customer/:id", authMiddleware, apiController.getCustomerDetail);
apiRouter.put("/updateCustomer/:id", authMiddleware, apiController.updateCustomer);
apiRouter.delete("/deleteCustomer/:id", authMiddleware, apiController.deleteCustomer);

export default apiRouter;
