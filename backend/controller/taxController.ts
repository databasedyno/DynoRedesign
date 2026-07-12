import express from "express";
import axios from "axios";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { taxRateModel } from "../models";
import { taxLogger } from "../utils/loggers";
import {
  FALLBACK_TAX_RATES,
  TAX_ID_ACRONYMS,
  TAX_TYPE_ACRONYMS,
  COUNTRY_NAMES,
  EU_COUNTRIES,
} from "../utils/taxData";

// FIX (BUG C): use TAX_TYPE_ACRONYMS (VAT/IVA/GST/Tax) for RATE display, not
// TAX_ID_ACRONYMS (VAT/EIN/CUIT/GST) which is for the business tax-ID field.
// Previously US returned "EIN" for a tax-RATE lookup, AR returned "CUIT" —
// neither is a valid tax-type label.
const TAX_ACRONYMS = TAX_TYPE_ACRONYMS;

const TAX_DATA_API_URL = process.env.TAX_DATA_API_URL || "https://api.apilayer.com/tax_data";
const TAX_DATA_API_KEY = process.env.TAX_DATA_API_KEY;

// Use centralized FALLBACK_TAX_RATES as FALLBACK_VAT_RATES
const FALLBACK_VAT_RATES = FALLBACK_TAX_RATES;

/**
 * Get VAT/Tax rate for a country (cache-first logic)
 * GET /api/tax/rate/:countryCode
 */
const getTaxRate = async (req: express.Request, res: express.Response) => {
  try {
    const { countryCode } = req.params;
    const upperCountryCode = countryCode.toUpperCase();

    // Validate country code
    if (!upperCountryCode || upperCountryCode.length !== 2) {
      return errorResponseHelper(res, 400, "Invalid country code. Must be 2-letter ISO code.");
    }

    // Step 1: Check cache (tbl_tax_rate)
    const cachedRate = await taxRateModel.findOne({
      where: { country_code: upperCountryCode },
    });

    if (cachedRate) {
      // Return cached data with consistent formatting
      return successResponseHelper(res, 200, "Tax rate retrieved from cache", {
        country_code: cachedRate.dataValues.country_code,
        country_name: cachedRate.dataValues.country_name,
        tax_acronym: cachedRate.dataValues.tax_acronym,
        standard_rate: parseFloat(cachedRate.dataValues.standard_rate),  // Ensure number format
        reduced_rates: cachedRate.dataValues.reduced_rates,
        cached: true,
      });
    }

    // Step 2: Try to fetch from APILayer
    let apiData: Record<string, unknown> | null = null;
    let apiSuccess = false;

    if (TAX_DATA_API_KEY) {
      try {
        const response = await axios.get(`${TAX_DATA_API_URL}/tax_rates`, {
          headers: {
            "apikey": TAX_DATA_API_KEY,
          },
          params: {
            country: upperCountryCode,
          },
          timeout: 10000,
        });

        if (response.data && !response.data.message) {
          apiData = response.data;
          apiSuccess = true;
        }
      } catch (apiError: unknown) {
        // Log API error but continue with fallback
        const err = apiError as { response?: { data?: { message?: string } }; message?: string };
        taxLogger.info(`Tax API error for ${upperCountryCode}:`, err.response?.data?.message || err.message);
      }
    }

    // Step 3: Use fallback data if API fails OR returns null/0
    const taxAcronym = TAX_ACRONYMS[upperCountryCode] || "TAX";
    const countryName = COUNTRY_NAMES[upperCountryCode] || upperCountryCode;
    
    let standardRate: number = 0;
    let reducedRates: unknown = null;
    let source = "fallback";

    if (apiSuccess && apiData) {
      const apiRate = Number(apiData.standard_rate || apiData.rate || 0);
      // Only use API data if it returned a valid non-zero rate
      if (apiRate > 0) {
        standardRate = apiRate;
        reducedRates = apiData.reduced_rates || null;
        source = "api";
      } else if (FALLBACK_VAT_RATES[upperCountryCode] !== undefined) {
        // API returned 0/null, use fallback
        standardRate = FALLBACK_VAT_RATES[upperCountryCode];
        source = "fallback";
      }
    } else if (FALLBACK_VAT_RATES[upperCountryCode] !== undefined) {
      standardRate = FALLBACK_VAT_RATES[upperCountryCode];
      source = "fallback";
    }

    // Step 4: Save to cache
    const newTaxRate = await taxRateModel.create({
      country_code: upperCountryCode,
      country_name: countryName,
      tax_acronym: taxAcronym,
      standard_rate: standardRate,
      reduced_rates: reducedRates,
    });

    return successResponseHelper(res, 200, `Tax rate retrieved from ${source} and cached`, {
      country_code: newTaxRate.dataValues.country_code,
      country_name: newTaxRate.dataValues.country_name,
      tax_acronym: newTaxRate.dataValues.tax_acronym,
      standard_rate: parseFloat(newTaxRate.dataValues.standard_rate),  // Ensure number format
      reduced_rates: newTaxRate.dataValues.reduced_rates,
      cached: false,
      source,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

/**
 * Validate a Tax ID / VAT number
 * POST /api/tax/validate
 */
const validateTaxId = async (req: express.Request, res: express.Response) => {
  try {
    const { tax_id, country_code } = req.body;

    if (!tax_id || !country_code) {
      return errorResponseHelper(res, 400, "tax_id and country_code are required");
    }

    const upperCountryCode = country_code.toUpperCase();

    if (!TAX_DATA_API_KEY) {
      return errorResponseHelper(res, 500, "Tax Data API key not configured");
    }

    // Call APILayer to validate
    try {
      const response = await axios.get(`${TAX_DATA_API_URL}/validate`, {
        headers: {
          "apikey": TAX_DATA_API_KEY,
        },
        params: {
          vat_number: tax_id,
          country_code: upperCountryCode,
        },
        timeout: 10000,
      });

      const validationResult = response.data;

      return successResponseHelper(res, 200, "Tax ID validation completed", {
        tax_id,
        country_code: upperCountryCode,
        valid: validationResult.valid || false,
        company_name: validationResult.company_name || null,
        company_address: validationResult.company_address || null,
        format_valid: validationResult.format_valid || false,
        query_status: validationResult.query || "completed",
      });
    } catch (apiError: unknown) {
      const err = apiError as { response?: { data?: { message?: string }; status?: number }; message?: string };
      // Handle rate limiting gracefully
      if (err.response?.data?.message?.includes("exceeded")) {
        return successResponseHelper(res, 200, "Tax ID validation - API rate limit exceeded, please try again later", {
          tax_id,
          country_code: upperCountryCode,
          valid: null,
          format_valid: null,
          query_status: "rate_limited",
          note: "API rate limit exceeded. Validation could not be performed at this time.",
        });
      }

      // Handle specific API errors
      if (err.response?.status === 400) {
        return successResponseHelper(res, 200, "Tax ID validation completed", {
          tax_id,
          country_code: upperCountryCode,
          valid: false,
          format_valid: false,
          error: "Invalid tax ID format",
        });
      }

      if (err.response?.status === 401) {
        return errorResponseHelper(res, 500, "Tax Data API authentication failed");
      }

      throw apiError;
    }

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

/**
 * Get all tax acronyms by country
 * GET /api/tax/acronyms
 */
const getTaxAcronyms = async (_req: express.Request, res: express.Response) => {
  try {
    // Build response with country names
    const acronymsWithNames = Object.entries(TAX_ACRONYMS).map(([code, acronym]) => ({
      country_code: code,
      country_name: COUNTRY_NAMES[code] || code,
      tax_acronym: acronym,
    }));

    const grouped = {
      european_union: acronymsWithNames.filter(a => EU_COUNTRIES.includes(a.country_code)),
      rest_of_world: acronymsWithNames.filter(a => !EU_COUNTRIES.includes(a.country_code)),
    };

    return successResponseHelper(res, 200, "Tax acronyms retrieved", {
      total_countries: acronymsWithNames.length,
      acronyms: TAX_ACRONYMS,
      by_country: acronymsWithNames,
      grouped,
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

/**
 * Get tax rate for a specific country by country name (lookup)
 * GET /api/tax/lookup?country=Portugal
 */
const lookupByCountryName = async (req: express.Request, res: express.Response) => {
  try {
    const { country } = req.query;

    if (!country || typeof country !== "string") {
      return errorResponseHelper(res, 400, "Country name is required");
    }

    // Find country code by name
    const countryLower = country.toLowerCase();
    const countryCode = Object.entries(COUNTRY_NAMES).find(
      ([_, name]) => name.toLowerCase() === countryLower
    )?.[0];

    if (!countryCode) {
      return errorResponseHelper(res, 404, `Country "${country}" not found. Use 2-letter ISO code instead.`);
    }

    // Redirect to getTaxRate logic
    req.params.countryCode = countryCode;
    return getTaxRate(req, res);

  } catch (e) {


      return handleControllerErrorReturn(res, e, taxLogger);
  }
};

export default {
  getTaxRate,
  validateTaxId,
  getTaxAcronyms,
  lookupByCountryName,
};
