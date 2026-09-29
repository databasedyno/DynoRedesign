import express from "express";
import taxController from "../controller/taxController";
import taxReportController from "../controller/taxReportController";
import authMiddleware from "../middleware/authMiddleware";
import { createRateLimiter, clientIp } from "../middleware/rateLimitMiddleware";

const taxRouter = express.Router();

// Public tax lookups proxy a PAID third-party API (APILayer) — rate-limit per IP
// on a dedicated bucket so abuse can't burn the quota (or lock other features).
const taxLookupRateLimiter = createRateLimiter(
  (req) => `tax:${clientIp(req)}`,
  async () => ({ windowMs: 15 * 60 * 1000, maxRequests: 30 })
);

// GET /api/tax/rate/:countryCode - Get VAT rate for a country (cache-first)
taxRouter.get("/rate/:countryCode", taxLookupRateLimiter, taxController.getTaxRate);

// POST /api/tax/validate - Validate a Tax ID / VAT number
taxRouter.post("/validate", taxLookupRateLimiter, taxController.validateTaxId);

// GET /api/tax/acronyms - Get all tax acronyms by country
taxRouter.get("/acronyms", taxLookupRateLimiter, taxController.getTaxAcronyms);

// GET /api/tax/lookup?country=Portugal - Lookup by country name
taxRouter.get("/lookup", taxLookupRateLimiter, taxController.lookupByCountryName);

// Backlog #6 — buyer-side / OSS destination tax report (tax COLLECTED from
// buyers, grouped by destination). Auth-gated (merchant-scoped).
taxRouter.get("/collected-report", authMiddleware, taxReportController.getCollectedTaxReport);
taxRouter.get("/collected-report/csv", authMiddleware, taxReportController.exportCollectedTaxCsv);

// Backlog #5 — AI VAT-treatment suggestion for a product (merchant-scoped).
taxRouter.post("/suggest-treatment", authMiddleware, taxReportController.suggestTaxTreatment);

// Backlog #4 — nexus / registration-threshold monitor (merchant-scoped).
taxRouter.get("/nexus-status", authMiddleware, taxReportController.getNexusStatus);

export default taxRouter;
