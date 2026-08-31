import express from "express";
import { apiController } from "../controller";
import customerDirectoryController from "../controller/customerDirectoryController";
import { apiMiddleware, authMiddleware } from "../middleware";
import { requireCompanyOwnerBy } from "../middleware/teamPermissionMiddleware";
import { auditMutations } from "../utils/activityLog";
import { apiModel } from "../models";

const apiRouter = express.Router();

// OWNER-ONLY guard resolver: map an API key (:id = api_id) to its owning company.
// Deleting / revoking a key is an OWNER_ONLY_ACTION — a teammate (even with
// manage_api_keys) can never destroy the owner's keys.
const resolveApiKeyCompany = async (req: express.Request): Promise<number | null> => {
  const apiId = req.params?.id;
  if (!apiId) return null;
  const row = await apiModel.findOne({ where: { api_id: apiId } });
  return row
    ? Number((row as unknown as { dataValues: { company_id: number } }).dataValues.company_id)
    : null;
};

// Activity-log company resolver for API-key routes: explicit body.company_id
// (addApi) else derive from the api_id in the URL.
const apiAuditCompany = async (req: express.Request): Promise<number | null> => {
  const b = parseInt(String((req.body && req.body.company_id) ?? ""), 10);
  if (!Number.isNaN(b)) return b;
  return resolveApiKeyCompany(req);
};
const auditKey = auditMutations("apikey", { resolveCompany: apiAuditCompany });

// OWNER-ONLY resolver for API-key CREATION: the company comes from body.company_id
// (there is no api_id yet). Minting a new key grants full API power (it can create
// payments/payouts), so — like delete/revoke — creation is OWNER-ONLY. A teammate
// with manage_api_keys may VIEW keys but never mint one (RBAC escalation guard, C1).
const resolveApiKeyCompanyFromBody = async (req: express.Request): Promise<number | null> => {
  const b = parseInt(String((req.body && req.body.company_id) ?? ""), 10);
  return Number.isNaN(b) ? null : b;
};

// API Key Management (mutations audited to the Team Activity Log)
apiRouter.post("/addApi", authMiddleware, requireCompanyOwnerBy(resolveApiKeyCompanyFromBody), auditKey, apiMiddleware, apiController.addApi);
apiRouter.get("/getApi", authMiddleware, apiController.getApi);
apiRouter.get("/getApi/:id", authMiddleware, apiController.getApiById);
apiRouter.put("/updateApi/:id", authMiddleware, auditKey, apiController.updateApi);
apiRouter.post("/regenerateKey/:id", authMiddleware, requireCompanyOwnerBy(resolveApiKeyCompany), auditKey, apiController.regenerateApiKey);
// ALIAS: Frontend compatibility - POST /userApi/regenerateApi/:id -> POST /userApi/regenerateKey/:id
apiRouter.post("/regenerateApi/:id", authMiddleware, requireCompanyOwnerBy(resolveApiKeyCompany), auditKey, apiController.regenerateApiKey);
apiRouter.put("/toggleStatus/:id", authMiddleware, auditKey, apiController.toggleApiStatus);
apiRouter.post("/revoke/:id", authMiddleware, requireCompanyOwnerBy(resolveApiKeyCompany), auditKey, apiController.revokeApi);
apiRouter.delete("/deleteApi/:id", authMiddleware, requireCompanyOwnerBy(resolveApiKeyCompany), auditKey, apiController.deleteApi);

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
