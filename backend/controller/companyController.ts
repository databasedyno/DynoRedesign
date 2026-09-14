import { raw as envRaw } from "../utils/config";
import express from "express";
import {
  encrypt,
  errorResponseHelper,
  generateApiKeyName,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { formatAmountForDisplay, getCurrencyInfo, COMPANY_CURRENCY_QUERY, convertToFiat, getCompanyDisplayCurrency, getUserDisplayCurrency, SUPPORTED_DISPLAY_CURRENCIES, isSupportedDisplayCurrency } from "../utils/currencyUtils";
import { resolveTransactionSource } from "../utils/transactionSource";
import { deriveTxDisplayStatus } from "../utils/transactionDisplayStatus";
import { validateBrandName } from "../utils/brandName";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import { apiModel, companyModel, customerModel, customerWalletModel, userModel, stablecoinConversionModel, userWalletModel, teamMemberModel } from "../models";
import { companyLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import { sendCompanyProfileCreatedEmail, sendCompanyContactWelcomeEmail, sendCompanyProfileUpdatedEmail, sendCompanyDeletedEmail, sendBrandSoftDeletedEmail, sendBrandDeletedAdminEmail } from "../services/emailService";
import { BRAND_DELETE_GRACE_DAYS } from "../services/brandPurgeService";
export const ONLY_BRAND_MESSAGE =
  "Cannot delete your only brand. Add another brand first, then delete this one.";
import { diffCompanyFields } from "./company/profileDiff";
import { finalizeUploadedImage } from "../services/objectStorage";
import { deleteRedisItem, getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import crypto from "crypto";
import { hmacSha256Hex } from "../utils/hmac";
import { ensureSandboxApiKey } from "./api/ensureSandboxApiKey";
import { mul, toFixedStr, toNumber } from "../utils/money";
import { MERCHANT_MIN_ORDER_BOUNDS, invalidateMerchantMinCache } from "../services/checkout/orderMinimums";

import axios from "axios";
import { toConversionDisplayStatus } from "../services/paymentStateMachine";
import { OPT_IN_WEBHOOK_EVENTS, ALWAYS_ON_WEBHOOK_EVENTS, parseSubscribedEvents } from "../services/webhookEvents";

const TAX_DATA_API_URL = envRaw("TAX_DATA_API_URL") || "https://api.apilayer.com/tax_data";
const TAX_DATA_API_KEY = envRaw("TAX_DATA_API_KEY");

// Country names mapping for better error messages
const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland",
  FR: "France", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland",
  IT: "Italy", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SI: "Slovenia", SK: "Slovakia", GB: "United Kingdom", US: "United States",
  CA: "Canada", AU: "Australia", NZ: "New Zealand", IN: "India", JP: "Japan",
  CN: "China", BR: "Brazil", MX: "Mexico", AR: "Argentina", CH: "Switzerland",
  NO: "Norway", IS: "Iceland", LI: "Liechtenstein", TR: "Turkey", RU: "Russia",
  UA: "Ukraine", SA: "Saudi Arabia", AE: "United Arab Emirates", IL: "Israel",
};

/**
 * Get country name from country code
 * @param countryCode - 2-letter ISO country code
 * @returns Country name or country code if not found
 */
const getCountryName = (countryCode: string): string => {
  const upperCode = countryCode.toUpperCase();
  return COUNTRY_NAMES[upperCode] || upperCode;
};

/**
 * Suggest country based on VAT number prefix
 * @param vatNumber - VAT number
 * @returns Suggested country code or null
 */
const suggestCountryFromVAT = (vatNumber: string): string | null => {
  if (!vatNumber || vatNumber.length < 2) return null;
  
  const vatCountry = vatNumber.substring(0, 2).toUpperCase();
  
  // Validate it's a real country code
  if (COUNTRY_NAMES[vatCountry]) {
    return vatCountry;
  }
  
  return null;
};

/**
 * Validate TAX ID/VAT Number using APILayer
 * @param vat_number - Tax ID to validate
 * @param country_code - ISO 2-letter country code
 * @returns Validation result with company details if valid
 */
const validateTaxIdInternal = async (vat_number: string, country_code: string) => {
  if (!TAX_DATA_API_KEY) {
    return {
      valid: null,
      format_valid: null,
      query_status: "api_key_missing",
      note: "Tax validation API key not configured. Proceeding without validation.",
    };
  }

  try {
    const response = await axios.get(`${TAX_DATA_API_URL}/validate`, {
      headers: {
        "apikey": TAX_DATA_API_KEY,
      },
      params: {
        vat_number,
        country_code: country_code.toUpperCase(),
      },
      timeout: 10000,
    });

    return {
      valid: response.data.valid || false,
      company_name: response.data.company_name || null,
      company_address: response.data.company_address || null,
      format_valid: response.data.format_valid || false,
      query_status: "completed",
    };
  } catch (apiError: unknown) {
    const err = apiError as { response?: { data?: { message?: string }; status?: number }; message?: string };
    // Handle rate limiting
    if (err.response?.data?.message?.includes("exceeded")) {
      return {
        valid: null,
        format_valid: null,
        query_status: "rate_limited",
        note: "API rate limit exceeded. Validation skipped.",
      };
    }

    // Invalid format
    if (err.response?.status === 400) {
      return {
        valid: false,
        format_valid: false,
        query_status: "invalid_format",
      };
    }

    // Other errors - don't block company creation
    return {
      valid: null,
      format_valid: null,
      query_status: "validation_failed",
      note: "Tax validation failed. Proceeding without validation.",
    };
  }
};

const addCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const file = req.file as Express.Multer.File;
    
    // Handle multiple input formats for better Swagger UI experience
    let data;
    
    // Format 1: JSON string in "data" field (backwards compatibility)
    if (req.body.data && typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } 
    // Format 2: Object in "data" field (backwards compatibility)
    else if (req.body.data && typeof req.body.data === 'object') {
      data = req.body.data;
    } 
    // Format 3: Individual form fields (NEW - Swagger UI friendly)
    else if (req.body.company_name || req.body.email) {
      data = {
        company_name: req.body.company_name,
        email: req.body.email,
        mobile: req.body.mobile,
        website: req.body.website,
        address_line1: req.body.address_line1,
        address_line2: req.body.address_line2,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        zip_code: req.body.zip_code,
        vat_number: req.body.vat_number,
      };
      // Remove undefined fields
      Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    } else {
      return errorResponseHelper(res, 400, "Missing brand data. Please provide company_name and email.");
    }

    // Reject brand names containing HTML/markup (raw or xss-escaped) so a name
    // can never render as literal tags like "<script>1</script>" in the UI.
    if (data.company_name !== undefined) {
      const nameCheck = validateBrandName(data.company_name);
      if (!nameCheck.ok) {
        return errorResponseHelper(res, 400, nameCheck.message || "Invalid brand name.");
      }
    }

    let photo;
    if (file) {
      // Durable storage: DO Spaces CDN URL when configured (survives redeploys,
      // renders in every environment); local static URL fallback otherwise.
      photo = await finalizeUploadedImage(file, envRaw("SERVER_URL") || "");
    }
    
    // Auto-suggest country from VAT number if country is missing
    if (data.vat_number && data.vat_number.trim() !== "" && (!data.country || data.country.trim() === "")) {
      const suggestedCountry = suggestCountryFromVAT(data.vat_number);
      if (suggestedCountry) {
        data.country = suggestedCountry;
        companyLogger.info(
          `Auto-suggested country ${suggestedCountry} (${getCountryName(suggestedCountry)}) based on VAT number ${data.vat_number}`,
          { user_id: userData.user_id, email: userData.email }
        );
      }
    }
    
    let taxValidation = null;
    if (data.vat_number && data.vat_number.trim() !== "" && data.country && data.country.trim() !== "") {
      // Extract VAT country code from VAT number (first 2 characters for most formats)
      const vatCountryCode = data.vat_number.trim().substring(0, 2).toUpperCase();
      const companyCountryCode = data.country.trim().toUpperCase();
      
      // Validate that company country matches VAT country
      if (vatCountryCode !== companyCountryCode) {
        const vatCountryName = getCountryName(vatCountryCode);
        const companyCountryName = getCountryName(companyCountryCode);
        
        return errorResponseHelper(
          res,
          400,
          `Brand country must match VAT country. Your VAT number (${data.vat_number}) is for ${vatCountryName} (${vatCountryCode}), but brand country is set to ${companyCountryName} (${companyCountryCode}). Please update your brand country to ${vatCountryName} or correct the VAT number.`
        );
      }
      
      companyLogger.info(
        `Validating TAX ID: ${data.vat_number} for country: ${data.country}`,
        { user_id: userData.user_id, email: userData.email }
      );
      
      taxValidation = await validateTaxIdInternal(data.vat_number, data.country);
      
      // If validation completed and format is invalid, return error
      if (taxValidation.query_status === "invalid_format") {
        return errorResponseHelper(
          res,
          400,
          `Invalid TAX ID format for ${data.country}. Please check and try again.`
        );
      }
      
      // If validation completed and VAT is invalid, return error
      if (taxValidation.query_status === "completed" && taxValidation.valid === false) {
        return errorResponseHelper(
          res,
          400,
          `TAX ID ${data.vat_number} is not registered in ${data.country}. Please verify the number.`
        );
      }
      
      // If valid, mark as verified
      if (taxValidation.valid === true) {
        data.vat_verified = true;
      }
      
      companyLogger.info(
        `TAX ID validation result: ${taxValidation.query_status}`,
        { 
          user_id: userData.user_id, 
          vat_number: data.vat_number,
          valid: taxValidation.valid,
          format_valid: taxValidation.format_valid
        }
      );
    }
    
    // Per-company contact person (Solution B): capture the first/last name from the
    // company-create form and persist it ON THE COMPANY ROW — NOT on the shared
    // account-level user.name. This is what stops a 2nd company from clobbering the
    // name used in the 1st company's merchant emails.
    const contactFirstName = (req.body.first_name ?? data.first_name ?? "").toString().trim() || null;
    const contactLastName = (req.body.last_name ?? data.last_name ?? "").toString().trim() || null;
    // Strip raw first_name/last_name so they don't leak into the model spread.
    delete data.first_name;
    delete data.last_name;

    // Individual creators may leave the brand/display name blank — fall back to
    // their own name so the brand is never nameless (matches the create form).
    const isIndividualAccount = String(data.account_type ?? "").toLowerCase() === "individual";
    if (isIndividualAccount && (!data.company_name || !String(data.company_name).trim())) {
      const fallbackName = [contactFirstName, contactLastName].filter(Boolean).join(" ").trim()
        || (userData.name || "").trim();
      if (fallbackName) data.company_name = fallbackName;
    }

    const resData = await companyModel.create({
      ...data,
      user_id: userData.user_id,
      photo,
      contact_first_name: contactFirstName,
      contact_last_name: contactLastName,
    });

    // AUTO-PROVISION restricted TEST key for the new company (non-fatal, idempotent).
    // Delegates to the shared ensureSandboxApiKey() helper (also used by the
    // one-time legacy backfill) so onboarding + backfill mint identical
    // `dpk_test_` sandbox keys (max_amount $100, curated currencies, sandbox_mode).
    // The LIVE (`dpk_live_`) key auto-mints separately from `verifyOtp` /
    // `copyWalletAddresses` when the merchant adds their first wallet.
    const auto_test_key_created = await ensureSandboxApiKey(
      resData.dataValues.company_id,
      userData.user_id,
      userData.email,
      data.company_name,
      data.email,
    );

    // Capture the account holder's display name ONCE (first company only).
    // Bug fix: previously this ran on EVERY company creation, so creating a 2nd
    // company with a different first/last name overwrote user.name and broke the
    // greeting in the 1st company's merchant emails. The per-company contact name
    // now lives on tbl_company (contact_first_name/last_name); user.name is only
    // seeded here when the account has no name yet, and is otherwise never touched
    // (users can still edit it explicitly from the Profile page).
    const contactFullName = [contactFirstName, contactLastName].filter(Boolean).join(" ").trim();
    if (contactFullName) {
      const currentUser = await userModel.findOne({
        where: { user_id: userData.user_id },
        attributes: ["name"],
      });
      const existingName = (currentUser?.dataValues?.name || "").trim();
      if (!existingName) {
        await userModel.update(
          { name: contactFullName },
          { where: { user_id: userData.user_id } }
        );
        companyLogger.info(`Set account name for the first time: "${contactFullName}"`, { user_id: userData.user_id });
      } else {
        companyLogger.info(
          `Account name already set ("${existingName}") — leaving unchanged; per-company contact stored on company ${resData.dataValues.company_id}`,
          { user_id: userData.user_id }
        );
      }
    }

    // Send email notifications (with deduplication guard)
    try {
      const emailDedupKey = `company-email-sent:${userData.user_id}:${resData.dataValues.company_id}`;
      const alreadySent = await getRedisItem(emailDedupKey);
      if (!alreadySent || Object.keys(alreadySent).length === 0) {
        await setRedisItem(emailDedupKey, { sent: true });
        await setRedisTTL(emailDedupKey, 3600); // 1 hour dedup window

        // Fetch user details for email
        const user = await userModel.findOne({
          where: { user_id: userData.user_id },
          attributes: ['name', 'email'],
        });

        if (user) {
          const userDetails = user.dataValues as { name: string; email: string | null };
          const companyName = data.company_name || 'Your Company';
          const companyContactEmail = data.email; // Company contact email from form
          const accountEmail = userDetails.email; // may be null for phone/SMS-only accounts

          // Email 1: Send to account holder (operational confirmation) — only if
          // the account actually has an email. Phone/SMS-only users have none.
          if (accountEmail) {
            await sendCompanyProfileCreatedEmail(
              accountEmail,
              userDetails.name || 'User',
              companyName
            );
            companyLogger.info(
              `Company profile created email sent to account: ${accountEmail}`,
              { user_id: userData.user_id, company_name: companyName }
            );
          }

          // Email 2: Send to company contact (if provided and different from account email)
          if (companyContactEmail && companyContactEmail.toLowerCase() !== (accountEmail || '').toLowerCase()) {
            await sendCompanyContactWelcomeEmail(
              companyContactEmail,
              companyName,
              userDetails.name || 'the account holder'
            );
            companyLogger.info(
              `Company contact welcome email sent to: ${companyContactEmail}`,
              { user_id: userData.user_id, company_name: companyName }
            );
          }
        }
      } else {
        companyLogger.info(
          `Company creation emails already sent (dedup), skipping`,
          { user_id: userData.user_id }
        );
      }
    } catch (emailError) {
      // Log email error but don't fail the company creation
      companyLogger.error(
        `Failed to send company creation emails: ${getErrorMessage(emailError)}`,
        { user_id: userData.user_id },
        new Error(emailError as string)
      );
    }

    // Include tax validation result in response
    const responseData = {
      ...resData.dataValues,
      tax_validation: taxValidation || { note: "No TAX ID provided" },
      auto_test_key_created,
    };

    successResponseHelper(res, 200, "Brand added successfully!", responseData);
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const updateCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const file = req.file as Express.Multer.File;
    
    // Handle multiple input formats for better Swagger UI experience
    let data;
    
    // Format 1: JSON string in "data" field (backwards compatibility)
    if (req.body.data && typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } 
    // Format 2: Object in "data" field (backwards compatibility)
    else if (req.body.data && typeof req.body.data === 'object') {
      data = req.body.data;
    } 
    // Format 3: Individual form fields (NEW - Swagger UI friendly)
    else if (req.body.company_name || req.body.email || req.body.mobile || req.body.website || 
             req.body.address_line1 || req.body.city || req.body.state || req.body.country || 
             req.body.zip_code || req.body.vat_number || req.body.first_name || req.body.last_name) {
      data = {
        company_name: req.body.company_name,
        email: req.body.email,
        mobile: req.body.mobile,
        website: req.body.website,
        address_line1: req.body.address_line1,
        address_line2: req.body.address_line2,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        zip_code: req.body.zip_code,
        vat_number: req.body.vat_number,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
      };
      // Remove undefined fields
      Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
    } else {
      return errorResponseHelper(res, 400, "No data provided for update");
    }

    // Reject brand names containing HTML/markup (raw or xss-escaped).
    if (data.company_name !== undefined && data.company_name !== null) {
      const nameCheck = validateBrandName(data.company_name);
      if (!nameCheck.ok) {
        return errorResponseHelper(res, 400, nameCheck.message || "Invalid brand name.");
      }
    }

    // Map incoming first_name/last_name onto the per-company contact columns
    // (Solution B). updateCompany NEVER touches the account-level user.name.
    if (data.first_name !== undefined || data.last_name !== undefined) {
      if (data.first_name !== undefined) {
        data.contact_first_name = (data.first_name ?? "").toString().trim() || null;
      }
      if (data.last_name !== undefined) {
        data.contact_last_name = (data.last_name ?? "").toString().trim() || null;
      }
      delete data.first_name;
      delete data.last_name;
    }

    const company_id = req.params.id;
    
    // Validate VAT country matches company country if both are provided
    if (data.vat_number && data.vat_number.trim() !== "") {
      // Get current company data to check existing country if not provided in update
      let countryToValidate = data.country;
      
      if (!countryToValidate || countryToValidate.trim() === "") {
        // Fetch existing company country if not provided in update
        const existingCompany = await companyModel.findOne({
          where: {
            user_id: userData.user_id,
            company_id,
          },
        });
        
        if (existingCompany) {
          countryToValidate = existingCompany.dataValues.country;
        }
      }
      
      if (countryToValidate && countryToValidate.trim() !== "") {
        // Extract VAT country code from VAT number (first 2 characters)
        const vatCountryCode = data.vat_number.trim().substring(0, 2).toUpperCase();
        const companyCountryCode = countryToValidate.trim().toUpperCase();
        
        // Validate that company country matches VAT country
        if (vatCountryCode !== companyCountryCode) {
          const vatCountryName = getCountryName(vatCountryCode);
          const companyCountryName = getCountryName(companyCountryCode);
          
          return errorResponseHelper(
            res,
            400,
            `Brand country must match VAT country. Your VAT number is for ${vatCountryName} (${vatCountryCode}), but brand country is ${companyCountryName} (${companyCountryCode}). Please update to ensure consistency.`
          );
        }
        
        companyLogger.info(
          `VAT country validation passed for update: ${vatCountryCode} matches ${companyCountryCode}`,
          { user_id: userData.user_id, company_id }
        );
      }
    }
    
    // Also validate if both country and vat_number exist (from different sources)
    if (data.country && data.country.trim() !== "") {
      // Fetch existing VAT number if not provided in update
      let vatNumberToValidate = data.vat_number;
      
      if (!vatNumberToValidate || vatNumberToValidate.trim() === "") {
        const existingCompany = await companyModel.findOne({
          where: {
            user_id: userData.user_id,
            company_id,
          },
        });
        
        if (existingCompany && existingCompany.dataValues.vat_number) {
          vatNumberToValidate = existingCompany.dataValues.vat_number;
        }
      }
      
      if (vatNumberToValidate && vatNumberToValidate.trim() !== "") {
        const vatCountryCode = vatNumberToValidate.trim().substring(0, 2).toUpperCase();
        const companyCountryCode = data.country.trim().toUpperCase();
        
        if (vatCountryCode !== companyCountryCode) {
          const vatCountryName = getCountryName(vatCountryCode);
          const companyCountryName = getCountryName(companyCountryCode);
          
          return errorResponseHelper(
            res,
            400,
            `Brand country must match VAT country. Existing VAT number is for ${vatCountryName} (${vatCountryCode}), but you're trying to change country to ${companyCountryName} (${companyCountryCode}). Please update VAT number first or choose ${vatCountryName}.`
          );
        }
      }
    }
    
    let photo;
    if (file) {
      // Durable storage: DO Spaces CDN URL when configured (survives redeploys,
      // renders in every environment); local static URL fallback otherwise.
      photo = await finalizeUploadedImage(file, envRaw("SERVER_URL") || "");
    }
    
    // Validate underpayment_threshold_usd: numeric, $0–$100, 2 dp (payment links only)
    if (data.underpayment_threshold_usd !== undefined && data.underpayment_threshold_usd !== null && data.underpayment_threshold_usd !== "") {
      const parsed = Number(String(data.underpayment_threshold_usd).replace(/[$,\s]/g, ""));
      if (!Number.isFinite(parsed) || parsed < 0) {
        return errorResponseHelper(res, 400, "underpayment_threshold_usd must be a number of 0 or more");
      }
      if (parsed > 100) {
        return errorResponseHelper(res, 400, "underpayment_threshold_usd cannot exceed 100");
      }
      data.underpayment_threshold_usd = Math.round(parsed * 100) / 100;
    } else if (data.underpayment_threshold_usd === "") {
      delete data.underpayment_threshold_usd;
    }

    // Validate grace_period_minutes: max 30 minutes (Payment Link only, not Direct API)
    if (data.grace_period_minutes !== undefined && data.grace_period_minutes !== null) {
      const parsed = parseInt(String(data.grace_period_minutes));
      if (isNaN(parsed) || parsed < 1) {
        return errorResponseHelper(res, 400, "grace_period_minutes must be at least 1 minute");
      }
      if (parsed > 30) {
        return errorResponseHelper(res, 400, "grace_period_minutes cannot exceed 30 minutes");
      }
      data.grace_period_minutes = parsed;
    }

    // B12: fee-split visibility — tri-state (null = auto). Reject anything else.
    if (data.show_fee_split_to_customers !== undefined) {
      const v = data.show_fee_split_to_customers;
      if (v === null || v === "" || v === "auto") data.show_fee_split_to_customers = null;
      else if (v === true || v === "true" || v === "always") data.show_fee_split_to_customers = true;
      else if (v === false || v === "false" || v === "never") data.show_fee_split_to_customers = false;
      else return errorResponseHelper(res, 400, "show_fee_split_to_customers must be auto, always or never");
    }

    // Phase 1b: per-brand minimum order (USD). "" / null => clear (inherit the
    // platform defaults). Otherwise a positive number within bounds. This is a
    // floor the merchant RAISES; it is enforced at pay time and shown at checkout.
    if (data.min_order_usd !== undefined) {
      if (data.min_order_usd === null || data.min_order_usd === "") {
        data.min_order_usd = null;
      } else {
        const parsed = Number(String(data.min_order_usd).replace(/[$,\s]/g, ""));
        if (!Number.isFinite(parsed) || parsed < MERCHANT_MIN_ORDER_BOUNDS.min) {
          return errorResponseHelper(res, 400, `min_order_usd must be a number of at least ${MERCHANT_MIN_ORDER_BOUNDS.min}`);
        }
        if (parsed > MERCHANT_MIN_ORDER_BOUNDS.max) {
          return errorResponseHelper(res, 400, `min_order_usd cannot exceed ${MERCHANT_MIN_ORDER_BOUNDS.max}`);
        }
        data.min_order_usd = Math.round(parsed * 100) / 100;
      }
    }
    
    // Snapshot BEFORE the write so the notification lists only what actually changed
    // (the settings form posts every field, so "present in body" != "changed").
    const before = (await companyModel.findOne({
      where: { user_id: userData.user_id, company_id },
      raw: true,
    })) as unknown as Record<string, unknown> | null;

    const resData = await companyModel.update(
      {
        ...data,
        user_id: userData.user_id,
        ...(photo && { photo }),
      },
      {
        where: {
          user_id: userData.user_id,
          company_id,
        },
        returning: true,
      }
    );

    const finalArray = resData[1][0].dataValues;
    invalidateMerchantMinCache(company_id); // Phase 1b: drop cached min after update
    const updatedFields = diffCompanyFields(before, data, photo);
    
    // Send email notification to account holder
    try {
      // Get user details
      const user = await userModel.findOne({
        where: { user_id: userData.user_id },
        attributes: ['name', 'email']
      });
      
      if (user && updatedFields.length > 0) {
        await sendCompanyProfileUpdatedEmail(
          user.dataValues.email,
          user.dataValues.name,
          finalArray.company_name,
          updatedFields
        );
        
        companyLogger.info(
          `Company profile updated email sent to: ${user.dataValues.email}`,
          { user_id: userData.user_id, company_id }
        );
      }
    } catch (emailError) {
      // Log email error but don't fail the update
      companyLogger.error(
        `Failed to send company update email: ${getErrorMessage(emailError)}`,
        { user_id: userData.user_id, company_id },
        new Error(emailError as string)
      );
    }
    
    successResponseHelper(
      res,
      200,
      "Brand updated successfully!",
      finalArray
    );
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Upgrade an INDIVIDUAL account to a BUSINESS account.
 * PUT /api/company/upgrade-to-business/:id  (owner-only)
 *
 * The Account is the tenant; a "Business" is simply an Account that has filled
 * in a business profile. This flips account_type individual -> business in
 * place — it does NOT create a second company, so wallets, API keys, team
 * members, payment history and settings all stay intact. Requires a business
 * name + country (the minimum a business profile needs for invoices/tax);
 * website + VAT/Tax ID are optional and stored when provided.
 */
const upgradeToBusiness = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const { company_name, country, website, vat_number } = req.body ?? {};

    const name = String(company_name ?? "").trim();
    const ctry = String(country ?? "").trim();
    if (!name) return errorResponseHelper(res, 400, "Business name is required");
    if (!ctry) return errorResponseHelper(res, 400, "Country is required");
    const nameCheck = validateBrandName(company_name);
    if (!nameCheck.ok) return errorResponseHelper(res, 400, nameCheck.message || "Invalid brand name.");

    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });
    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found");
    }

    const currentType = String(company.dataValues.account_type ?? "business").toLowerCase();
    if (currentType === "business") {
      return errorResponseHelper(res, 400, "This account is already a business account");
    }

    const updates: Record<string, unknown> = {
      account_type: "business",
      company_name: name,
      country: ctry,
    };
    if (website !== undefined) {
      updates.website = String(website ?? "").trim() || null;
    }
    if (vat_number !== undefined) {
      updates.vat_number = String(vat_number ?? "").trim() || null;
    }

    const resData = await companyModel.update(updates, {
      where: { company_id, user_id: userData.user_id },
      returning: true,
    });

    const updated = resData[1]?.[0]?.dataValues ?? { ...company.dataValues, ...updates };

    companyLogger.info(
      `Account upgraded individual -> business (company_id=${company_id})`,
      { user_id: userData.user_id, company_id }
    );

    return successResponseHelper(res, 200, "Account upgraded to Business successfully!", updated);
  } catch (e) {
    handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getCompany = async (_req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // Companies the user OWNS (ownership is implicit via tbl_company.user_id).
    const owned = await companyModel.findAll({
      where: {
        user_id: userData.user_id,
      },
    });
    const ownedIds = new Set(owned.map((c) => c.dataValues.company_id));

    // RBAC Phase 3: companies the user is an ACTIVE team member of (granted access).
    const memberships = await teamMemberModel.findAll({
      where: { member_user_id: userData.user_id, status: "active" },
    });
    const membershipByCompany = new Map<number, { role?: string; permissions?: unknown }>();
    memberships.forEach((m) =>
      membershipByCompany.set(Number(m.dataValues.company_id), m.dataValues)
    );

    const grantedIds = [...membershipByCompany.keys()].filter((id) => !ownedIds.has(id));
    let granted: Awaited<ReturnType<typeof companyModel.findAll>> = [];
    if (grantedIds.length) {
      granted = await companyModel.findAll({
        where: { company_id: { [Op.in]: grantedIds } },
      });
    }

    // Owned companies carry an owner flag; granted companies carry their member role
    // + permission map so the UI can gate controls without a second round-trip.
    const resData = [
      ...owned.map((c) => ({ ...c.dataValues, is_member: false, member_role: "owner" })),
      ...granted.map((c) => {
        const m = membershipByCompany.get(Number(c.dataValues.company_id));
        return {
          ...c.dataValues,
          is_member: true,
          member_role: (m && m.role) || "member",
          member_permissions: (m && m.permissions) || {},
        };
      }),
    ];

    // Provide helpful message based on results
    let message = "";
    if (resData.length === 0) {
      message = "No brands found. Create your first brand using POST /api/company/addCompany";
    } else if (resData.length === 1) {
      message = `Successfully retrieved 1 brand`;
    } else {
      message = `Successfully retrieved ${resData.length} brands`;
    }
    
    successResponseHelper(res, 200, message, resData);
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get Company by ID
 * GET /api/company/getCompany/:id
 */
const getCompanyById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    
    const resData = await companyModel.findOne({
      where: {
        user_id: userData.user_id,
        company_id,
      },
    });

    if (!resData) {
      return errorResponseHelper(res, 404, "Brand not found");
    }

    successResponseHelper(res, 200, "Brand retrieved successfully", resData);
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const deleteCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    
    // First verify company belongs to user
    const company = await companyModel.findOne({
      where: {
        user_id: userData.user_id,
        company_id,
      },
    });
    
    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found");
    }
    
    // Prevent deleting the ONLY brand — user must always have at least one
    const remainingCount = await companyModel.count({ where: { user_id: userData.user_id } });
    if (remainingCount <= 1) {
      return errorResponseHelper(res, 400, ONLY_BRAND_MESSAGE);
    }

    // Second factor: an active `brand_delete` step-up session (requireStepUp at the router).

    // ── SOFT DELETE (7-day grace period) ───────────────────────────────────
    // Brand deletion is now REVERSIBLE for 7 days. We only mark the brand
    // deleted here (deleted_at set -> paranoid hides it from every merchant
    // read immediately). The heavy, irreversible cleanup (revoke API keys,
    // delete payment links, prune customers, drop the row) is deferred to the
    // daily purge cron (services/brandPurgeService) once scheduled_purge_at
    // passes, OR to an admin manual purge. Until then an admin can restore it
    // with one click from Admin -> Merchants -> Deleted brands.
    const now = new Date();
    const purgeAt = new Date(now.getTime() + BRAND_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);

    const rowsDeleted = await companyModel.update(
      { deleted_at: now, deleted_by: userData.user_id, scheduled_purge_at: purgeAt } as any,
      { where: { user_id: userData.user_id, company_id } },
    );

    if (!rowsDeleted || rowsDeleted[0] === 0) {
      companyLogger.error(`Soft-delete affected 0 rows for company_id=${company_id} user_id=${userData.user_id}`);
      return errorResponseHelper(res, 500, "Delete failed — brand still exists after operation. Contact support if this persists.");
    }

    // Invalidate the merchant's dashboard cache so the brand disappears at once.
    try { await deleteRedisItem(`dashboard:${userData.user_id}:all`); } catch (_e) { /* non-fatal */ }

    const purgeDateStr = purgeAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    companyLogger.info(`Brand ${company_id} soft-deleted by user ${userData.user_id} — purge scheduled for ${purgeAt.toISOString()}`);

    // Merchant "you have 7 days to restore" email + ops notification (best-effort).
    try {
      const owner = await userModel.findOne({ where: { user_id: userData.user_id }, attributes: ["name", "email"] });
      const ownerEmail = owner?.dataValues.email || userData.email;
      const ownerName = owner?.dataValues.name || userData.name || "";
      const brandName = company.dataValues.company_name || "your brand";
      if (ownerEmail) {
        await sendBrandSoftDeletedEmail(ownerEmail, ownerName, brandName, purgeAt);
      }
      await sendBrandDeletedAdminEmail({
        companyId: company_id,
        companyName: brandName,
        ownerName,
        ownerEmail: ownerEmail || null,
        deletedAtStr: now.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC",
        purgeDateStr,
      });
    } catch (emailError) {
      companyLogger.warn(`Brand soft-deleted email/notify failed for company ${company_id}: ${getErrorMessage(emailError)}`);
    }

    return successResponseHelper(res, 200, "Brand deleted. You have 7 days to restore it — contact support if this was a mistake.", {
      company_id: Number(company_id),
      scheduled_purge_at: purgeAt.toISOString(),
      restore_before: purgeDateStr,
      grace_days: BRAND_DELETE_GRACE_DAYS,
    });
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = req.params.id;

    // Preferred currency: user override > company default > 'USD' (Doc-3 §E)
    const preferredCurrency = await getUserDisplayCurrency(userData?.user_id, id);

    const resData = await sequelize.query(
      `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id,
        sc.conversion_id as auto_convert_id,
        sc.status as auto_convert_status,
        sc.source_currency as auto_convert_source_currency,
        sc.source_amount as auto_convert_source_amount,
        sc.source_amount_usd as auto_convert_source_amount_usd,
        sc.target_currency as auto_convert_target_currency,
        sc.target_amount as auto_convert_target_amount,
        sc.settlement_chain as auto_convert_settlement_chain,
        sc.conversion_rate as auto_convert_rate,
        sc.completed_at as auto_convert_completed_at,
        -- Source metadata (payment link / contribution / tip / product order)
        pl.link_id           as source_link_id,
        pl.link_type         as source_link_type,
        pl.title             as source_link_title,
        pl.parent_link_id    as source_parent_link_id,
        pl.is_tip_jar        as source_is_tip_jar,
        parent_pl.title      as source_parent_title,
        parent_pl.is_tip_jar as source_parent_is_tip_jar,
        po.order_id          as source_order_id,
        po.public_ref        as source_order_ref
      from tbl_user_transaction ut 
      left join tbl_customer c on c.customer_id=ut.customer_id
      left join tbl_company cm on cm.company_id = coalesce(c.company_id, ut.company_id)
      left join tbl_stablecoin_conversion sc on sc.transaction_id=ut.transaction_id
      -- Session 54 fix: the payment link and the user transaction live in
      -- SEPARATE id spaces. pl.transaction_id is a payment-intent UUID that is
      -- NOT tbl_user_transaction.id, so the old session-48 join
      -- (pl.transaction_id = ut.id) matched 0 rows and source tagging never
      -- worked (payment-link / contribution / tip / product filters were all
      -- empty). The real bridge written at settlement is the blockchain
      -- settlement reference stored on BOTH tables (transaction_reference).
      -- DISTINCT ON dedups per reference so a ut row is never multiplied even
      -- if two links ever shared a reference.
      left join (
        select distinct on (transaction_reference)
          transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar
        from tbl_payment_link
        where transaction_reference is not null and transaction_reference <> ''
        order by transaction_reference, link_id desc
      ) pl on pl.transaction_reference = ut.transaction_reference
        and ut.transaction_reference is not null and ut.transaction_reference <> ''
      left join tbl_payment_link parent_pl on parent_pl.link_id = pl.parent_link_id
      left join tbl_product_order po on po.payment_link_id = pl.link_id
      -- Session 54 fix (Bug E): filter by the transaction's OWNING company
      -- (coalesce customer's company, else ut.company_id). Previously the
      -- INNER JOIN to tbl_customer plus c.company_id = :company_id silently
      -- dropped every payment that had no customer record -- which is exactly
      -- how settled payment-link payments (CREDIT/CRYPTO, customer_id NULL) are
      -- stored, so completed payment links never appeared in the list at all.
      where coalesce(c.company_id, ut.company_id) = :company_id`,
      { type: QueryTypes.SELECT, replacements: { company_id: parseInt(id as string, 10) } }
    );

    // Build conversion rates: crypto/fiat base_currency → preferred currency
    // Collect unique base currencies from transactions
    const uniqueBaseCurrencies = [...new Set(
      (resData as Array<Record<string, unknown>>)
        .map(t => String(t.base_currency || ''))
        .filter(c => c && c !== preferredCurrency)
    )];

    const conversionRates: Record<string, number> = {};
    for (const srcCurrency of uniqueBaseCurrencies) {
      try {
        const result = await convertToFiat(srcCurrency, preferredCurrency, 1);
        if (result.amount) {
          conversionRates[srcCurrency] = result.amount;
        }
      } catch (convErr) {
        companyLogger.warn(`[getTransactions] Conversion ${srcCurrency}->${preferredCurrency} failed:`, convErr);
      }
    }

    const finalRes = (resData as Array<Record<string, unknown>>).map((x) => {
      const {
        wallet_id,
        auto_convert_id,
        auto_convert_status,
        auto_convert_source_currency,
        auto_convert_source_amount,
        auto_convert_source_amount_usd,
        auto_convert_target_currency,
        auto_convert_target_amount,
        auto_convert_settlement_chain,
        auto_convert_rate,
        auto_convert_completed_at,
        source_link_id,
        source_link_type,
        source_link_title,
        source_parent_link_id,
        source_is_tip_jar,
        source_parent_title,
        source_parent_is_tip_jar,
        source_order_id,
        source_order_ref,
        ...rest
      } = x;
      const baseAmount = Number(rest.base_amount || 0);
      const baseCurrency = String(rest.base_currency || '');

      // Convert: use usd_value if available, otherwise convert base_amount via rate
      let displayAmount: number;
      if (baseCurrency === preferredCurrency) {
        displayAmount = baseAmount;
      } else if (Number(rest.usd_value) > 0 && preferredCurrency === 'USD') {
        displayAmount = Number(rest.usd_value);
      } else {
        const rate = conversionRates[baseCurrency] || 0;
        displayAmount = toNumber(mul(baseAmount, rate), 2);
      }

      // ── Derive `source` via the shared resolver (single source of truth
      // shared with walletController + dashboardController). ──────────────
      const source = resolveTransactionSource({
        source_order_id: source_order_id as string | number | null,
        source_order_ref: source_order_ref as string | null,
        source_link_id: source_link_id as string | number | null,
        source_link_type: source_link_type as string | null,
        source_link_title: source_link_title as string | null,
        source_parent_link_id: source_parent_link_id as string | number | null,
        source_parent_title: source_parent_title as string | null,
        source_parent_is_tip_jar: source_parent_is_tip_jar as boolean | number | null,
        customer_email: (x.email as string) ?? null,
      });

      return {
        ...rest,
        // Stale 'pending' attempts (payment window passed) are shown as 'unpaid'
        status: deriveTxDisplayStatus(rest.status, rest.createdAt),
        display_amount: displayAmount,
        display_currency: preferredCurrency,
        amount_display: formatAmountForDisplay(displayAmount, preferredCurrency),
        // Source metadata for the transactions UX (filter + column badge)
        source,
        // Auto-stablecoin conversion indicator
        auto_converted: !!auto_convert_id,
        auto_convert: auto_convert_id
          ? {
              conversion_id: auto_convert_id,
              status: auto_convert_status,
              display_status: toConversionDisplayStatus(auto_convert_status as string | null | undefined),
              source_currency: auto_convert_source_currency,
              source_amount: auto_convert_source_amount ? Number(auto_convert_source_amount) : null,
              source_amount_usd: auto_convert_source_amount_usd ? Number(auto_convert_source_amount_usd) : null,
              // Show source amount in base key currency
              source_amount_display: auto_convert_source_amount && auto_convert_source_currency
                ? (String(auto_convert_source_currency) === preferredCurrency
                  ? Number(auto_convert_source_amount)
                  : toNumber(Number(auto_convert_source_amount) * (conversionRates[String(auto_convert_source_currency)] || 0), 2))
                : null,
              source_amount_display_currency: preferredCurrency,
              target_currency: auto_convert_target_currency,
              target_amount: auto_convert_target_amount ? Number(auto_convert_target_amount) : null,
              settlement_chain: auto_convert_settlement_chain,
              conversion_rate: auto_convert_rate ? Number(auto_convert_rate) : null,
              completed_at: auto_convert_completed_at,
            }
          : null,
      };
    });

    const message = finalRes.length === 0
      ? "No transactions found for this company"
      : `Successfully retrieved ${finalRes.length} transaction${finalRes.length === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, {
      transactions: finalRes,
      currency: preferredCurrency,
      currency_info: getCurrencyInfo(preferredCurrency),
    });
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Validate TAX ID/VAT Number - Public endpoint
 * POST /api/company/validateTaxId
 */
const validateTaxId = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // Accept both the canonical names and the older client field names
    // (taxId/country) so a payload mismatch can never make every ID "error".
    const vat_number = req.body.vat_number ?? req.body.taxId ?? req.body.vatNumber;
    const country_code = req.body.country_code ?? req.body.country ?? req.body.countryCode;

    if (!vat_number || !country_code) {
      return errorResponseHelper(
        res,
        400,
        "vat_number and country_code are required"
      );
    }

    companyLogger.info(
      `Tax ID validation requested: ${vat_number} for ${country_code}`,
      { user_id: userData.user_id, email: userData.email }
    );

    const validationResult = await validateTaxIdInternal(vat_number, country_code);

    // Return appropriate response based on validation status
    if (validationResult.query_status === "api_key_missing") {
      return errorResponseHelper(res, 503, "Tax validation service not configured");
    }

    if (validationResult.query_status === "invalid_format") {
      return successResponseHelper(res, 200, "Tax ID validation completed", {
        vat_number,
        country_code: country_code.toUpperCase(),
        valid: false,
        format_valid: false,
        message: `Invalid TAX ID format for ${country_code}`,
      });
    }

    if (validationResult.query_status === "rate_limited") {
      return successResponseHelper(res, 200, "Tax ID validation - Rate limit reached", {
        vat_number,
        country_code: country_code.toUpperCase(),
        valid: null,
        format_valid: null,
        message: "API rate limit exceeded. Please try again later.",
      });
    }

    if (validationResult.query_status === "completed") {
      return successResponseHelper(res, 200, "Tax ID validation completed", {
        vat_number,
        country_code: country_code.toUpperCase(),
        valid: validationResult.valid,
        format_valid: validationResult.format_valid,
        company_name: validationResult.company_name,
        company_address: validationResult.company_address,
        message: validationResult.valid 
          ? "Tax ID is valid and registered" 
          : "Tax ID is not registered or invalid",
      });
    }

    // Validation failed for other reasons
    return successResponseHelper(res, 200, "Tax ID validation unavailable", {
      vat_number,
      country_code: country_code.toUpperCase(),
      valid: null,
      format_valid: null,
      message: "Tax validation service temporarily unavailable. Please try again.",
    });

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Update webhook settings for a company
 * PUT /api/company/webhook-settings/:id
 */
const updateWebhookSettings = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const { webhook_url, webhook_secret, webhook_events } = req.body;

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    // Validate webhook URL (format + SSRF guard) so merchants get immediate feedback
    if (webhook_url) {
      try {
        await assertSafeOutboundUrl(webhook_url);
      } catch (e) {
        return errorResponseHelper(res, 400, e instanceof Error ? e.message : "Invalid webhook URL format");
      }
    }

    // Generate a new secret when the merchant explicitly asks ("generate"), OR
    // auto-generate one when a webhook URL is being saved and the endpoint has
    // no secret yet — so every configured endpoint is signed (API review §5.1.2).
    // The shared-default fallback was removed, so an unsigned endpoint would
    // otherwise ship no signature at all.
    const cryptoLib = require('crypto');
    let newSecret = webhook_secret;
    let autoGeneratedSecret = false;
    let rotatedFromExisting: string | null = null; // old secret to keep valid 24h
    if (webhook_secret === 'generate') {
      const existingSecret = (company.get('webhook_secret') as string | null) || null;
      newSecret = 'whsec_' + cryptoLib.randomBytes(24).toString('hex');
      // Zero-downtime rotation: keep the previous secret co-signed for 24h so a
      // merchant who hasn't swapped their stored secret yet still verifies.
      if (existingSecret) rotatedFromExisting = existingSecret;
    } else if (webhook_secret === undefined && webhook_url) {
      const existingSecret = (company.get('webhook_secret') as string | null) || null;
      if (!existingSecret) {
        newSecret = 'whsec_' + cryptoLib.randomBytes(24).toString('hex');
        autoGeneratedSecret = true;
      }
    }

    // Validate the opt-in event list (Tier-1 item #2). Legacy events are always
    // delivered and are not listed here.
    let normalizedEvents: string[] | null | undefined;
    if (webhook_events !== undefined) {
      if (webhook_events === null) {
        normalizedEvents = null;
      } else if (!Array.isArray(webhook_events)) {
        return errorResponseHelper(res, 400, "webhook_events must be an array of event names");
      } else {
        const invalid = webhook_events
          .map(String)
          .filter((e) => !(OPT_IN_WEBHOOK_EVENTS as readonly string[]).includes(e));
        if (invalid.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `Unsupported webhook events: ${invalid.join(", ")}. Subscribable events: ${OPT_IN_WEBHOOK_EVENTS.join(", ")}`
          );
        }
        normalizedEvents = Array.from(new Set(webhook_events.map(String)));
      }
    }

    // Partial update: only touch what the caller actually sent, so saving the
    // URL can no longer wipe the signing secret (and vice versa).
    const updates: Record<string, unknown> = {};
    if (webhook_url !== undefined) updates.webhook_url = webhook_url || null;
    if (webhook_secret !== undefined) updates.webhook_secret = newSecret || null;
    else if (autoGeneratedSecret) updates.webhook_secret = newSecret;
    if (normalizedEvents !== undefined) updates.webhook_events = normalizedEvents;

    // On an explicit rotation, park the old secret with a 24h grace so it keeps
    // verifying (co-signed) until the merchant swaps it in their integration.
    const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;
    let previousExpiresAt: Date | null = null;
    if (rotatedFromExisting) {
      previousExpiresAt = new Date(Date.now() + ROTATION_GRACE_MS);
      updates.webhook_secret_previous = rotatedFromExisting;
      updates.webhook_secret_previous_expires_at = previousExpiresAt;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponseHelper(res, 400, "No webhook settings provided");
    }

    await companyModel.update(updates, { where: { company_id } });

    companyLogger.info(
      `Webhook settings updated for company ${company_id} (${Object.keys(updates).join(", ")})`,
      { user_id: userData.user_id, email: userData.email }
    );

    // The full secret is shown ONCE — on explicit generation OR auto-generation.
    const revealSecret = webhook_secret === 'generate' || autoGeneratedSecret;
    successResponseHelper(res, 200, "Webhook settings updated successfully", {
      company_id,
      webhook_url: webhook_url !== undefined ? (webhook_url || null) : undefined,
      webhook_secret_set: (webhook_secret !== undefined) ? !!newSecret : (autoGeneratedSecret ? true : undefined),
      // Full secret only on (auto-)generation, otherwise masked.
      webhook_secret: revealSecret ? newSecret : (webhook_secret !== undefined && newSecret ? '***' + newSecret.slice(-8) : null),
      webhook_secret_auto_generated: autoGeneratedSecret || undefined,
      // Rotation grace: the old secret still verifies until this instant (24h).
      previous_secret_valid_until: previousExpiresAt ? previousExpiresAt.toISOString() : undefined,
      webhook_events: normalizedEvents !== undefined ? normalizedEvents : undefined,
    });

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get webhook settings for a company
 * GET /api/company/webhook-settings/:id
 */
const getWebhookSettings = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;

    const [result] = await sequelize.query(
      `SELECT webhook_url, webhook_secret, webhook_disabled, webhook_disabled_at, webhook_disabled_reason, webhook_events, webhook_secret_previous_expires_at
         FROM tbl_company WHERE company_id = :company_id AND user_id = :user_id`,
      {
        replacements: { company_id, user_id: userData.user_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    // Raw sequelize.query with QueryTypes.SELECT returns plain objects (not model instances)
    // Access properties directly — .dataValues is only available on Sequelize model instances
    const companyData = (Array.isArray(result) ? result[0] : result) as {
      webhook_url?: string;
      webhook_secret?: string;
      webhook_disabled?: boolean;
      webhook_disabled_at?: string | Date | null;
      webhook_disabled_reason?: string | null;
      webhook_events?: unknown;
      webhook_secret_previous_expires_at?: string | Date | null;
    };
    
    // Session (redirect-fix): surface a "your webhook URL redirects" banner.
    // Written by webhooks/index.ts -> recordWebhookRedirectNotice when we had to
    // follow a 3xx on the company-configured URL. 30-day TTL, null when clean.
    let redirectNotice: unknown = null;
    try {
      const notice = await getRedisItem(`webhook-redirect-notice:${company_id}`);
      if (notice && notice.finalUrl) {
        redirectNotice = {
          original_url: notice.originalUrl || null,
          final_url: notice.finalUrl,
          status: notice.status || null,
          detected_at: notice.detectedAt || null,
          last_seen_at: notice.lastSeenAt || null,
        };
      }
    } catch { /* non-fatal — Redis read failure just hides the banner */ }

    successResponseHelper(res, 200, "Webhook settings retrieved", {
      company_id,
      webhook_url: companyData?.webhook_url || null,
      webhook_secret_set: !!companyData?.webhook_secret,
      webhook_secret_preview: companyData?.webhook_secret ? '***' + companyData.webhook_secret.slice(-8) : null,
      // Session 49: circuit-breaker state so dashboard can surface a re-enable CTA
      webhook_disabled: !!companyData?.webhook_disabled,
      webhook_disabled_at: companyData?.webhook_disabled_at || null,
      webhook_disabled_reason: companyData?.webhook_disabled_reason || null,
      // Two-secret rotation: if set and in the future, the previous secret is
      // still co-signed until this instant (dashboard shows a rotation banner).
      previous_secret_valid_until:
        companyData?.webhook_secret_previous_expires_at &&
        new Date(companyData.webhook_secret_previous_expires_at as string) > new Date()
          ? new Date(companyData.webhook_secret_previous_expires_at as string).toISOString()
          : null,
      // Redirect notice so the dashboard can nudge the merchant to update their URL
      redirect_notice: redirectNotice,
      // Tier-1 item #2: opt-in event subscriptions + the catalogue to render
      webhook_events: parseSubscribedEvents(companyData?.webhook_events),
      subscribable_events: OPT_IN_WEBHOOK_EVENTS,
      always_on_events: ALWAYS_ON_WEBHOOK_EVENTS,
    });

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Re-enable a webhook URL that was auto-disabled by the circuit breaker.
 * Also clears the Redis-side per-URL 404 disable key so the next payment
 * actually attempts delivery again.
 * POST /api/company/webhook-reenable/:id
 */
const reenableWebhook = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;

    // Fetch current state + URL so we can also clear its Redis dedup keys
    const rows = await sequelize.query<{ webhook_url?: string; webhook_disabled?: boolean }>(
      `SELECT webhook_url, webhook_disabled FROM tbl_company WHERE company_id = :company_id AND user_id = :user_id LIMIT 1`,
      { replacements: { company_id, user_id: userData.user_id }, type: QueryTypes.SELECT }
    );
    const row = (Array.isArray(rows) ? rows[0] : rows) as { webhook_url?: string; webhook_disabled?: boolean } | undefined;
    if (!row) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    // Clear DB flag (idempotent)
    await sequelize.query(
      `UPDATE tbl_company
          SET webhook_disabled = FALSE,
              webhook_disabled_at = NULL,
              webhook_disabled_reason = NULL
        WHERE company_id = :company_id AND user_id = :user_id`,
      { replacements: { company_id, user_id: userData.user_id } }
    );

    // Clear Redis 404-counter & per-URL disable key so the next call retries fresh
    if (row.webhook_url) {
      try {
        await deleteRedisItem(`webhook-404-failures:${row.webhook_url}`);
        await deleteRedisItem(`webhook-disabled:${row.webhook_url}`);
        // Also clear the circuit-breaker counter used by utils/webhookRetry.ts DLQ path
        const urlHash = crypto.createHash('sha256').update(row.webhook_url).digest('hex').substring(0, 16);
        await deleteRedisItem(`webhook:cb:${company_id}:${urlHash}`);
      } catch (_e) { /* non-fatal */ }
    }

    companyLogger.info(`Webhook re-enabled for company_id=${company_id} by user_id=${userData.user_id} (was_disabled=${row.webhook_disabled})`);
    return successResponseHelper(res, 200, "Webhook delivery re-enabled", { company_id, was_disabled: !!row.webhook_disabled });
  } catch (e) {
    handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Manually pause webhook delivery to the company's configured URL. Merchant-
 * initiated equivalent of the circuit-breaker disable. Per-request /
 * payment-link webhook URLs are NOT affected — only the company URL is paused.
 * POST /api/company/webhook-disable/:id
 */
const disableWebhook = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;

    const rows = await sequelize.query<{ webhook_disabled?: boolean }>(
      `SELECT webhook_disabled FROM tbl_company WHERE company_id = :company_id AND user_id = :user_id LIMIT 1`,
      { replacements: { company_id, user_id: userData.user_id }, type: QueryTypes.SELECT }
    );
    const row = (Array.isArray(rows) ? rows[0] : rows) as { webhook_disabled?: boolean } | undefined;
    if (!row) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    await sequelize.query(
      `UPDATE tbl_company
          SET webhook_disabled = TRUE,
              webhook_disabled_at = CURRENT_TIMESTAMP,
              webhook_disabled_reason = :reason
        WHERE company_id = :company_id AND user_id = :user_id`,
      { replacements: { company_id, user_id: userData.user_id, reason: "Manually paused by merchant" } }
    );

    companyLogger.info(`Webhook manually paused for company_id=${company_id} by user_id=${userData.user_id}`);
    return successResponseHelper(res, 200, "Webhook delivery paused", { company_id, webhook_disabled: true });
  } catch (e) {
    handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Send a test webhook to verify configuration
 * POST /api/company/webhook-test/:id
 */
const testWebhook = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const crypto = require('crypto');
    const axios = require('axios');

    // Get company webhook settings
    const queryResult = await sequelize.query<{ webhook_url?: string; webhook_secret?: string; company_name?: string }>(
      `SELECT webhook_url, webhook_secret, company_name FROM tbl_company WHERE company_id = :company_id AND user_id = :user_id`,
      {
        replacements: { company_id, user_id: userData.user_id },
        type: QueryTypes.SELECT,
      }
    );
    
    const result = queryResult[0];

    if (!result) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    if (!result.webhook_url) {
      return errorResponseHelper(res, 400, "No webhook URL configured. Please set a webhook URL first.");
    }

    // Create test payload
    const timestamp = Math.floor(Date.now() / 1000);
    const testPayload = {
      event: 'webhook.test',
      webhook_id: crypto.randomUUID(),
      sent_at: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Dynopay',
        company_id,
        company_name: result.company_name,
        test_id: crypto.randomBytes(8).toString('hex'),
      },
    };

    // Build headers - signature only if secret configured
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Dynopay-Event': 'webhook.test',
      'X-Dynopay-Timestamp': timestamp.toString(),
      'X-Dynopay-Webhook-Id': testPayload.webhook_id,
      'User-Agent': 'Dynopay-Webhook/1.0',
    };

    // Only add signature if secret is configured
    const testRawBody = JSON.stringify(testPayload);
    if (result.webhook_secret) {
      const signaturePayload = { ...testPayload, timestamp };
      headers['X-Dynopay-Signature'] = hmacSha256Hex(signaturePayload, result.webhook_secret);
      // Signature v2 (API review §5.1.1): signed over the exact bytes sent.
      const v2 = hmacSha256Hex(`${timestamp}.${testRawBody}`, result.webhook_secret);
      headers['X-Dynopay-Signature-V2'] = `t=${timestamp},v1=${v2}`;
    }

    companyLogger.info(
      `Sending test webhook to ${result.webhook_url}`,
      { user_id: userData.user_id, company_id }
    );

    // Send test webhook
    const startTime = Date.now();
    try {
      const response = await axios.post(result.webhook_url, testRawBody, {
        timeout: 10000,
        headers,
      });

      const responseTime = Date.now() - startTime;

      // Log successful test delivery
      await sequelize.query(
        `INSERT INTO tbl_webhook_delivery_log 
         (company_id, webhook_url, event_type, webhook_id, payload, status, response_status, response_time_ms, retry_count, created_at, completed_at)
         VALUES (:company_id, :webhook_url, :event_type, :webhook_id, :payload, 'success', :response_status, :response_time_ms, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        {
          replacements: {
            company_id,
            webhook_url: result.webhook_url,
            event_type: 'webhook.test',
            webhook_id: testPayload.webhook_id,
            payload: JSON.stringify(testPayload),
            response_status: response.status,
            response_time_ms: responseTime,
          },
          type: QueryTypes.INSERT,
        }
      );

      successResponseHelper(res, 200, "Test webhook sent successfully", {
        status: 'success',
        webhook_url: result.webhook_url,
        response_status: response.status,
        response_time_ms: responseTime,
        payload_sent: testPayload,
        signature_included: !!result.webhook_secret,
      });

    } catch (webhookError: unknown) {
      const err = webhookError as { message?: string; response?: { status?: number } };
      const responseTime = Date.now() - startTime;
      const resultData = result as { webhook_url?: string; webhook_secret?: string; company_name?: string };
      const errorDetails = {
        status: 'failed',
        webhook_url: resultData.webhook_url,
        error: err.message,
        response_status: err.response?.status || null,
        response_time_ms: responseTime,
        payload_attempted: testPayload,
      };

      // Log failed test delivery
      await sequelize.query(
        `INSERT INTO tbl_webhook_delivery_log 
         (company_id, webhook_url, event_type, webhook_id, payload, status, response_status, response_time_ms, error_message, retry_count, created_at, completed_at)
         VALUES (:company_id, :webhook_url, :event_type, :webhook_id, :payload, 'failed', :response_status, :response_time_ms, :error_message, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        {
          replacements: {
            company_id,
            webhook_url: resultData.webhook_url,
            event_type: 'webhook.test',
            webhook_id: testPayload.webhook_id,
            payload: JSON.stringify(testPayload),
            response_status: err.response?.status || null,
            response_time_ms: responseTime,
            error_message: err.message,
          },
          type: QueryTypes.INSERT,
        }
      );

      companyLogger.error(
        `Test webhook failed: ${err.message}`,
        { user_id: userData.user_id, company_id, ...errorDetails }
      );

      return successResponseHelper(res, 200, "Test webhook failed", errorDetails);
    }

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get webhook delivery history for a company
 * GET /api/company/webhook-history/:id
 */
const getWebhookHistory = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string; // 'success' | 'failed' | undefined (all)
    const event_type = req.query.event_type as string; // 'payment.pending' | 'payment.confirmed' | 'webhook.test' | undefined

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    // Build WHERE clause
    let whereClause = 'WHERE company_id = :company_id';
    const replacements: Record<string, unknown> = { company_id, limit, offset };
    
    if (status && ['success', 'failed'].includes(status)) {
      whereClause += ' AND status = :status';
      replacements.status = status;
    }
    
    if (event_type) {
      whereClause += ' AND event_type = :event_type';
      replacements.event_type = event_type;
    }

    // Get total count
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM tbl_webhook_delivery_log ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;

    // Get paginated results
    const logs = await sequelize.query(
      `SELECT 
        log_id,
        event_type,
        webhook_id,
        status,
        response_status,
        response_time_ms,
        error_message,
        retry_count,
        created_at,
        completed_at
       FROM tbl_webhook_delivery_log 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    const total = parseInt(String(countResult.total || '0'));
    const totalPages = Math.ceil(total / limit);

    successResponseHelper(res, 200, "Webhook history retrieved", {
      company_id,
      logs,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    });

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get details of a specific webhook delivery
 * GET /api/company/webhook-history/:id/detail/:logId
 */
const getWebhookDetail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const log_id = req.params.logId;

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    // Get webhook log detail
    const [log] = await sequelize.query(
      `SELECT * FROM tbl_webhook_delivery_log 
       WHERE log_id = :log_id AND company_id = :company_id`,
      { replacements: { log_id, company_id }, type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;

    if (!log) {
      return errorResponseHelper(res, 404, "Webhook log not found");
    }

    successResponseHelper(res, 200, "Webhook detail retrieved", log);

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Manually re-send a specific past webhook delivery from the Webhook Console.
 * Dashboard-authenticated equivalent of POST /api/user/events/:id/resend.
 * Reuses the exact delivery path (fresh webhook_id, timestamp, signature) and
 * signs with the company's CURRENT secret.
 * POST /api/company/webhook-history/:id/resend/:logId
 */
const resendWebhookDelivery = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const log_id = req.params.logId;

    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });
    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    const rows = (await sequelize.query(
      `SELECT log_id, event_type, webhook_url, payload
         FROM tbl_webhook_delivery_log
        WHERE log_id = :log_id AND company_id = :company_id LIMIT 1`,
      { replacements: { log_id, company_id }, type: QueryTypes.SELECT }
    )) as Array<{ log_id: number; event_type: string; webhook_url: string | null; payload: string | null }>;

    if (!rows.length) {
      return errorResponseHelper(res, 404, "Webhook delivery not found");
    }
    const row = rows[0];
    if (!row.webhook_url) {
      return errorResponseHelper(res, 400, "This delivery has no URL to resend to");
    }

    let eventData: Record<string, unknown> = {};
    try {
      eventData = row.payload ? (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) : {};
    } catch {
      eventData = {};
    }
    if (!eventData.event) eventData.event = row.event_type;

    const secret = (company.get("webhook_secret") as string | null) || null;
    const { redeliverWebhook } = require("../webhooks");
    const result = await redeliverWebhook(row.webhook_url, eventData, secret, Number(company_id), "webhook");

    companyLogger.info(
      `Webhook delivery ${row.log_id} resent for company ${company_id} (success=${!!result?.success})`,
      { user_id: userData.user_id }
    );

    return successResponseHelper(res, 200, result?.success ? "Event resent" : "Resend attempted", {
      log_id: row.log_id,
      event: row.event_type,
      url: row.webhook_url,
      resent: !!result?.success,
      error: result?.success ? null : (result?.error || "delivery failed"),
    });
  } catch (e) {
    handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get webhook delivery statistics for a company
 * GET /api/company/webhook-stats/:id
 */
const getWebhookStats = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const days = Math.min(parseInt(req.query.days as string) || 7, 30);

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found or unauthorized");
    }

    // Get overall stats
    const [overallStats] = await sequelize.query(
      `SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        ROUND(AVG(response_time_ms)) as avg_response_time_ms,
        MAX(created_at) as last_delivery
       FROM tbl_webhook_delivery_log 
       WHERE company_id = :company_id 
         AND created_at >= NOW() - INTERVAL '${days} days'`,
      { replacements: { company_id }, type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;

    // Get stats by event type
    const eventStats = await sequelize.query(
      `SELECT 
        event_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM tbl_webhook_delivery_log 
       WHERE company_id = :company_id 
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY event_type`,
      { replacements: { company_id }, type: QueryTypes.SELECT }
    );

    // Get daily breakdown
    const dailyStats = await sequelize.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM tbl_webhook_delivery_log 
       WHERE company_id = :company_id 
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      { replacements: { company_id }, type: QueryTypes.SELECT }
    );

    const total = parseInt(String(overallStats.total_deliveries || '0')) || 0;
    const successful = parseInt(String(overallStats.successful || '0')) || 0;
    const successRate = total > 0 ? toFixedStr(((successful / total) * 100), 1) : '0';

    successResponseHelper(res, 200, "Webhook statistics retrieved", {
      company_id,
      period_days: days,
      summary: {
        total_deliveries: total,
        successful,
        failed: parseInt(String(overallStats.failed || '0')) || 0,
        success_rate: `${successRate}%`,
        avg_response_time_ms: parseInt(String(overallStats.avg_response_time_ms || '0')) || 0,
        last_delivery: overallStats.last_delivery,
      },
      by_event_type: eventStats,
      daily_breakdown: dailyStats,
    });

  } catch (e) {


      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};


// ============================================
// Auto-Stablecoin Conversion Settings — moved to controller/company/autoConvert.ts
// (2026-08-23n) so this file stays under the size baseline. Behaviour is
// preserved via re-export below.
// ============================================
import {
  getAutoConvertSettings,
  updateAutoConvertSettings,
  getConversionHistory,
  getConversionDetail,
  retryConversion,
} from "./company/autoConvert";
import { getConversionSavings } from "./company/conversionSavings";
import { assertSafeOutboundUrl } from "../utils/outboundUrlGuard";


// ── Fee-Free Status ─────────────────────────────────────────────────────────

const getFeeFreeStatus = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as IUserType;
    const userId = userData?.user_id;
    if (!userId) {
      return errorResponseHelper(res, 401, "Authentication required");
    }

    const { getFeeFreeStatus: fetchFeeFreeStatus } = require("../services/feeFreeService");
    const status = await fetchFeeFreeStatus(userId);

    if (!status) {
      return errorResponseHelper(res, 404, "User not found");
    }

    return successResponseHelper(res, 200, "Fee-free status retrieved", status);
  } catch (error: any) {
    return errorResponseHelper(res, 500, "Failed to retrieve fee-free status");
  }
};

// ── Dashboard Display Currency (Session 39) ─────────────────────────────────
// Presentation-only merchant preference, decoupled from the API-key pricing
// base_currency. Never affects stored data, payment pricing, invoices, exports,
// or webhooks. See /app/DISPLAY_CURRENCY_IMPLEMENTATION.md.

/**
 * GET /api/company/display-currency/:id
 * Returns the company's resolved dashboard display currency + the supported list.
 */
const getDisplayCurrency = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;
  try {
    const current = await getCompanyDisplayCurrency(id);
    const supported = SUPPORTED_DISPLAY_CURRENCIES.map((code) => getCurrencyInfo(code));
    return successResponseHelper(res, 200, "Display currency retrieved", {
      display_currency: current,
      currency_info: getCurrencyInfo(current),
      supported,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    companyLogger.error(errorMessage, { user_id: userData?.user_id }, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * PATCH /api/company/display-currency/:id
 * Body: { display_currency: 'EUR' }. Validates against the supported list
 * (400 otherwise) and persists it as a DISPLAY-ONLY preference.
 */
const updateDisplayCurrency = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;
  const cur = String(req.body?.display_currency || "").toUpperCase();

  try {
    if (!isSupportedDisplayCurrency(cur)) {
      return errorResponseHelper(
        res,
        400,
        `display_currency must be one of: ${SUPPORTED_DISPLAY_CURRENCIES.join(", ")}`
      );
    }

    // Ownership is enforced by companyOwnershipMiddleware; re-verify defensively.
    const company = await companyModel.findOne({
      where: { company_id: id, user_id: userData.user_id },
    });
    if (!company) {
      return errorResponseHelper(res, 404, "Brand not found");
    }

    await sequelize.query(
      `UPDATE tbl_company SET display_currency = :cur WHERE company_id = :id`,
      { replacements: { cur, id }, type: QueryTypes.UPDATE }
    );

    companyLogger.info(`[DisplayCurrency] Company ${id} display_currency set to ${cur}`);

    return successResponseHelper(res, 200, "Display currency updated", {
      display_currency: cur,
      currency_info: getCurrencyInfo(cur),
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    companyLogger.error(errorMessage, { user_id: userData?.user_id }, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

export default {
  addCompany,
  getCompany,
  getCompanyById,
  deleteCompany,
  updateCompany,
  upgradeToBusiness,
  getTransactions,
  validateTaxId,
  updateWebhookSettings,
  getWebhookSettings,
  reenableWebhook,
  disableWebhook,
  testWebhook,
  getWebhookHistory,
  getWebhookDetail,
  resendWebhookDelivery,
  getWebhookStats,
  getAutoConvertSettings,
  updateAutoConvertSettings,
  getConversionHistory,
  getConversionSavings,
  getConversionDetail,
  retryConversion,
  getFeeFreeStatus,
  getDisplayCurrency,
  updateDisplayCurrency,
};
