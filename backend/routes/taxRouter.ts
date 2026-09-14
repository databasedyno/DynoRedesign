import express from "express";
import taxController from "../controller/taxController";

const taxRouter = express.Router();

// GET /api/tax/rate/:countryCode - Get VAT rate for a country (cache-first)
taxRouter.get("/rate/:countryCode", taxController.getTaxRate);

// POST /api/tax/validate - Validate a Tax ID / VAT number
taxRouter.post("/validate", taxController.validateTaxId);

// GET /api/tax/acronyms - Get all tax acronyms by country
taxRouter.get("/acronyms", taxController.getTaxAcronyms);

// GET /api/tax/lookup?country=Portugal - Lookup by country name
taxRouter.get("/lookup", taxController.lookupByCountryName);

export default taxRouter;
