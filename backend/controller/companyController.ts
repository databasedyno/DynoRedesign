import express from "express";
import {
  encrypt,
  errorResponseHelper,
  generateApiKeyName,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { formatAmountForDisplay, getCurrencyInfo, COMPANY_CURRENCY_QUERY, convertToFiat, getCompanyDisplayCurrency } from "../utils/currencyUtils";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import { apiModel, companyModel, customerModel, customerWalletModel, userModel, stablecoinConversionModel, userWalletModel } from "../models";
import { companyLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import { sendCompanyProfileCreatedEmail, sendCompanyContactWelcomeEmail, sendCompanyProfileUpdatedEmail } from "../services/emailService";
import { deleteRedisItem, getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import crypto from "crypto";

import axios from "axios";
import { toConversionDisplayStatus } from "../services/paymentStateMachine";

const TAX_DATA_API_URL = process.env.TAX_DATA_API_URL || "https://api.apilayer.com/tax_data";
const TAX_DATA_API_KEY = process.env.TAX_DATA_API_KEY;

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
      return errorResponseHelper(res, 400, "Missing company data. Please provide company_name and email.");
    }
    
    let photo;
    if (file) {
      const serverUrl = process.env.SERVER_URL?.endsWith('/') ? process.env.SERVER_URL : process.env.SERVER_URL + '/';
      photo = serverUrl + "images/" + file.filename;
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
          `Company country must match VAT country. Your VAT number (${data.vat_number}) is for ${vatCountryName} (${vatCountryCode}), but company country is set to ${companyCountryName} (${companyCountryCode}). Please update your company country to ${vatCountryName} or correct the VAT number.`
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
    
    const resData = await companyModel.create({
      ...data,
      user_id: userData.user_id,
      photo,
    });

    // AUTO-PROVISION restricted TEST key for the new company (non-fatal, idempotent).
    // Creates a `dpk_test_` (environment='development') key with sandbox restrictions
    // (max_amount $100, curated currencies, sandbox_mode) so the merchant has a
    // sandbox key immediately at signup. The LIVE (`dpk_live_`) key auto-mints
    // separately from `verifyOtp` / `copyWalletAddresses` when the merchant
    // adds/reuses their first wallet. NEVER fails company creation.
    let auto_test_key_created = false;
    try {
      const newCompanyId = resData.dataValues.company_id;
      const existingTestKey = await apiModel.findOne({
        where: { company_id: newCompanyId, environment: 'development', status: 'active' },
      });
      if (!existingTestKey) {
        const baseCurrency = 'USD';
        const keyData = {
          base_currency: baseCurrency,
          company_id: newCompanyId,
          adm_id: userData.user_id,
          env: 'development',
        };
        const keyString = 'dpk_test_' + 'DYNOPAY_USER_API-' + JSON.stringify(keyData);
        const apiKey = encrypt(keyString, process.env.API_SECRET);

        const companyName = data.company_name || 'Company';
        const companyEmail = data.email || userData.email;

        const createdCustomer = await customerModel.create({
          id: crypto.randomUUID(),
          customer_name: companyName + ' admin',
          email: companyEmail,
          mobile: companyEmail,
          company_id: newCompanyId,
        });
        await customerWalletModel.create({
          id: crypto.randomUUID(),
          customer_id: createdCustomer.dataValues.customer_id,
          wallet_type: baseCurrency,
        });

        const secret = process.env.ACCESS_TOKEN_SECRET;
        const customerToken = jwt.sign(
          { customer_id: createdCustomer.dataValues.customer_id },
          secret,
          { expiresIn: '30d' },
        );
        const adminToken = jwt.sign(
          {
            api_id: null,
            company_id: newCompanyId,
            user_id: userData.user_id,
            type: 'admin_token',
            environment: 'development',
          },
          secret,
          { expiresIn: '30d' },
        );

        await apiModel.create({
          company_id: newCompanyId,
          base_currency: baseCurrency,
          apiKey,
          user_id: userData.user_id,
          adminToken: customerToken,
          admin_token: adminToken,
          withdrawal_whitelist: null,
          api_name: generateApiKeyName(),
          permissions: JSON.stringify(['payments', 'transactions', 'webhooks', 'wallets']),
          environment: 'development',
          status: 'active',
          test_mode_restrictions: JSON.stringify({
            max_amount: 100,
            allowed_currencies: ['BTC', 'ETH', 'USDT-TRC20', 'TRX', 'LTC'],
            sandbox_mode: true,
          }),
          request_count: 0,
          rate_limit_per_minute: 60,
          rate_limit_per_hour: 3600,
          rate_limit_per_day: 100000,
        });
        auto_test_key_created = true;
        companyLogger.info(
          `[addCompany] ✅ Auto-created TEST (dpk_test_) key for company ${newCompanyId}`,
          { user_id: userData.user_id },
        );
      }
    } catch (apiKeyErr) {
      // NEVER fail company creation because of key mint failure.
      companyLogger.warn(
        `[addCompany] ⚠️ Auto TEST key creation skipped: ${getErrorMessage(apiKeyErr)}`,
        { user_id: userData.user_id },
      );
    }

    // Update user profile with first_name + last_name if provided
    // (Simplified registration creates accounts without names — names are collected here)
    const firstName = req.body.first_name || data.first_name;
    const lastName = req.body.last_name || data.last_name;
    if (firstName || lastName) {
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      if (fullName) {
        await userModel.update(
          { name: fullName },
          { where: { user_id: userData.user_id } }
        );
        companyLogger.info(`Updated user profile name: "${fullName}"`, { user_id: userData.user_id });
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

    successResponseHelper(res, 200, "Company added successfully!", responseData);
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
             req.body.zip_code || req.body.vat_number) {
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
      return errorResponseHelper(res, 400, "No data provided for update");
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
            `Company country must match VAT country. Your VAT number is for ${vatCountryName} (${vatCountryCode}), but company country is ${companyCountryName} (${companyCountryCode}). Please update to ensure consistency.`
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
            `Company country must match VAT country. Existing VAT number is for ${vatCountryName} (${vatCountryCode}), but you're trying to change country to ${companyCountryName} (${companyCountryCode}). Please update VAT number first or choose ${vatCountryName}.`
          );
        }
      }
    }
    
    let photo;
    if (file) {
      const serverUrl = process.env.SERVER_URL?.endsWith('/') ? process.env.SERVER_URL : process.env.SERVER_URL + '/';
      photo = serverUrl + "images/" + file.filename;
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
    
    // Send email notification to account holder
    try {
      // Get user details
      const user = await userModel.findOne({
        where: { user_id: userData.user_id },
        attributes: ['name', 'email']
      });
      
      if (user) {
        // Track what fields were updated
        const updatedFields = [];
        if (data.company_name) updatedFields.push('Company Name');
        if (data.email) updatedFields.push('Email Address');
        if (data.mobile) updatedFields.push('Phone Number');
        if (data.website) updatedFields.push('Website');
        if (data.address_line1 || data.city || data.state || data.country) updatedFields.push('Address');
        if (data.vat_number) updatedFields.push('VAT/Tax ID');
        if (photo) updatedFields.push('Company Logo');
        
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
      "Company updated successfully!",
      finalArray
    );
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getCompany = async (_req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const resData = await companyModel.findAll({
      where: {
        user_id: userData.user_id,
      },
    });
    
    // Provide helpful message based on results
    let message = "";
    if (resData.length === 0) {
      message = "No companies found. Create your first company using POST /api/company/addCompany";
    } else if (resData.length === 1) {
      message = `Successfully retrieved 1 company`;
    } else {
      message = `Successfully retrieved ${resData.length} companies`;
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
      return errorResponseHelper(res, 404, "Company not found");
    }

    successResponseHelper(res, 200, "Company retrieved successfully", resData);
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
      return errorResponseHelper(res, 404, "Company not found");
    }
    
    // Clean up Redis entries for company's payment links
    try {
      const { paymentLinkModel } = await import("../models");
      const companyPaymentLinks = await paymentLinkModel.findAll({
        where: { company_id },
        attributes: ['payment_link'],
      });
      
      for (const link of companyPaymentLinks) {
        const paymentLinkUrl = link.dataValues.payment_link;
        const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
        if (urlMatch && urlMatch[1]) {
          await deleteRedisItem("customer-" + urlMatch[1]);
        }
      }
      
      // Delete all payment links for this company
      await paymentLinkModel.destroy({ where: { company_id } });
      
      // Invalidate dashboard cache for this user
      await deleteRedisItem(`dashboard:${userData.user_id}:all`);
      
      companyLogger.info(`Redis cleanup completed for company ${company_id}`);
    } catch (redisError) {
      companyLogger.warn(`Redis cleanup failed for company ${company_id}: ${getErrorMessage(redisError)}`);
      // Continue with deletion even if Redis cleanup fails
    }
    
    // Delete the company
    const resData = await companyModel.destroy({
      where: {
        user_id: userData.user_id,
        company_id,
      },
    });
    
    successResponseHelper(res, 200, "Company deleted successfully!", resData);
  } catch (e) {

      handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = req.params.id;

    // Get company's preferred currency
    const preferredCurrency = await getCompanyDisplayCurrency(id);

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
        sc.completed_at as auto_convert_completed_at
      from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id
      left join tbl_stablecoin_conversion sc on sc.transaction_id=ut.transaction_id
      where c.company_id=:company_id`,
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
        displayAmount = Math.round(baseAmount * rate * 100) / 100;
      }

      return {
        ...rest,
        display_amount: displayAmount,
        display_currency: preferredCurrency,
        amount_display: formatAmountForDisplay(displayAmount, preferredCurrency),
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
                  : Math.round(Number(auto_convert_source_amount) * (conversionRates[String(auto_convert_source_currency)] || 0) * 100) / 100)
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
    const { vat_number, country_code } = req.body;

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
    const { webhook_url, webhook_secret } = req.body;

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { company_id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Company not found or unauthorized");
    }

    // Validate webhook URL format if provided
    if (webhook_url) {
      try {
        const url = new URL(webhook_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return errorResponseHelper(res, 400, "Webhook URL must use HTTP or HTTPS protocol");
        }
      } catch {
        return errorResponseHelper(res, 400, "Invalid webhook URL format");
      }
    }

    // Generate new secret if requested (send "generate" as webhook_secret)
    let newSecret = webhook_secret;
    if (webhook_secret === 'generate') {
      const crypto = require('crypto');
      newSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    }

    // Update webhook settings
    await companyModel.update(
      {
        webhook_url: webhook_url || null,
        webhook_secret: newSecret || null,
      },
      { where: { company_id } }
    );

    companyLogger.info(
      `Webhook settings updated for company ${company_id}`,
      { user_id: userData.user_id, email: userData.email }
    );

    successResponseHelper(res, 200, "Webhook settings updated successfully", {
      company_id,
      webhook_url: webhook_url || null,
      webhook_secret_set: !!newSecret,
      // Only show full secret on generation, otherwise mask it
      webhook_secret: webhook_secret === 'generate' ? newSecret : (newSecret ? '***' + newSecret.slice(-8) : null),
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
      `SELECT webhook_url, webhook_secret FROM tbl_company WHERE company_id = :company_id AND user_id = :user_id`,
      {
        replacements: { company_id, user_id: userData.user_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return errorResponseHelper(res, 404, "Company not found or unauthorized");
    }

    // Raw sequelize.query with QueryTypes.SELECT returns plain objects (not model instances)
    // Access properties directly — .dataValues is only available on Sequelize model instances
    const companyData = (Array.isArray(result) ? result[0] : result) as { webhook_url?: string; webhook_secret?: string };
    
    successResponseHelper(res, 200, "Webhook settings retrieved", {
      company_id,
      webhook_url: companyData?.webhook_url || null,
      webhook_secret_set: !!companyData?.webhook_secret,
      webhook_secret_preview: companyData?.webhook_secret ? '***' + companyData.webhook_secret.slice(-8) : null,
    });

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
      return errorResponseHelper(res, 404, "Company not found or unauthorized");
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
    if (result.webhook_secret) {
      const signaturePayload = { ...testPayload, timestamp };
      const hmac = crypto.createHmac('sha256', result.webhook_secret);
      hmac.update(JSON.stringify(signaturePayload));
      headers['X-Dynopay-Signature'] = hmac.digest('hex');
    }

    companyLogger.info(
      `Sending test webhook to ${result.webhook_url}`,
      { user_id: userData.user_id, company_id }
    );

    // Send test webhook
    const startTime = Date.now();
    try {
      const response = await axios.post(result.webhook_url, testPayload, {
        timeout: 10000,
        headers,
      });

      const responseTime = Date.now() - startTime;

      // Log successful test delivery
      await sequelize.query(
        `INSERT INTO tbl_webhook_delivery_log 
         (company_id, webhook_url, event_type, webhook_id, payload, status, response_status, response_time_ms, retry_count, completed_at)
         VALUES (:company_id, :webhook_url, :event_type, :webhook_id, :payload, 'success', :response_status, :response_time_ms, 0, CURRENT_TIMESTAMP)`,
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
         (company_id, webhook_url, event_type, webhook_id, payload, status, response_status, response_time_ms, error_message, retry_count, completed_at)
         VALUES (:company_id, :webhook_url, :event_type, :webhook_id, :payload, 'failed', :response_status, :response_time_ms, :error_message, 0, CURRENT_TIMESTAMP)`,
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
      return errorResponseHelper(res, 404, "Company not found or unauthorized");
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
      return errorResponseHelper(res, 404, "Company not found or unauthorized");
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
      return errorResponseHelper(res, 404, "Company not found or unauthorized");
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
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : '0';

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
// Auto-Stablecoin Conversion Settings
// ============================================

const VALID_SETTLEMENT_CURRENCIES = ["USDT", "USDC"];
const VALID_SETTLEMENT_CHAINS = ["ERC20", "TRC20", "POLYGON", "BEP20", "SOL"];

/**
 * Helper: fetch eligible stablecoin wallets for a company, formatted with preview addresses
 */
const getEligibleStablecoinWallets = async (companyId: number) => {
  const stablecoinWalletTypes = VALID_SETTLEMENT_CURRENCIES.flatMap((currency) =>
    VALID_SETTLEMENT_CHAINS.map((chain) => `${currency}-${chain}`)
  );

  const companyWallets = await userWalletModel.findAll({
    where: {
      company_id: companyId,
      wallet_type: stablecoinWalletTypes,
    },
    attributes: ["wallet_type", "wallet_address"],
  });

  return companyWallets.map((w: { dataValues: { wallet_type: string; wallet_address: string } }) => {
    const parts = w.dataValues.wallet_type.split("-");
    const addr = w.dataValues.wallet_address || "";
    return {
      wallet_type: w.dataValues.wallet_type,
      settlement_currency: parts[0],
      settlement_chain: parts.slice(1).join("-"),
      wallet_address: addr,
      wallet_address_preview: addr.length >= 4 ? `****${addr.slice(-4)}` : addr,
    };
  });
};

/**
 * Get auto-convert settings for a company
 * GET /api/company/auto-convert/:id
 */
const getAutoConvertSettings = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;

  try {
    const company = await companyModel.findOne({
      where: { company_id: id, user_id: userData.user_id },
      attributes: [
        "company_id",
        "company_name",
        "auto_convert_enabled",
        "settlement_currency",
        "settlement_wallet_address",
        "settlement_chain",
      ],
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Company not found");
    }

    const availableOptions = await getEligibleStablecoinWallets(parseInt(id));

    const data = company.dataValues;
    successResponseHelper(res, 200, "Auto-convert settings retrieved", {
      company_id: data.company_id,
      company_name: data.company_name,
      auto_convert_enabled: data.auto_convert_enabled || false,
      settlement_currency: data.settlement_currency || null,
      settlement_wallet_address: data.settlement_wallet_address || null,
      settlement_chain: data.settlement_chain || null,
      valid_currencies: VALID_SETTLEMENT_CURRENCIES,
      valid_chains: VALID_SETTLEMENT_CHAINS,
      available_settlement_options: availableOptions,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    companyLogger.error(errorMessage, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Map settlement_currency + settlement_chain to the wallet_type stored in tbl_user_wallet.
 * e.g. ("USDT", "TRC20") → "USDT-TRC20"
 *      ("USDC", "ERC20") → "USDC-ERC20"
 *      ("USDT", "POLYGON") → "USDT-POLYGON"
 *      ("USDT", "ERC20") → "USDT-ERC20"
 */
const mapSettlementToWalletType = (currency: string, chain: string): string => {
  return `${currency}-${chain}`;
};

/**
 * Update auto-convert settings for a company
 * PUT /api/company/auto-convert/:id
 *
 * Two-step flow:
 *   Step 1 — { auto_convert_enabled: true } (no currency/chain)
 *     → Returns eligible wallets for the merchant to choose from.
 *     → 400 if no eligible stablecoin wallets exist.
 *
 *   Step 2 — { auto_convert_enabled: true, settlement_currency, settlement_chain }
 *     → Enables auto-conversion with the selected wallet.
 *
 *   Disable — { auto_convert_enabled: false }
 *     → Turns off auto-conversion.
 */
const updateAutoConvertSettings = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;
  const { auto_convert_enabled, settlement_currency, settlement_chain } = req.body;

  try {
    const company = await companyModel.findOne({
      where: { company_id: id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Company not found");
    }

    // --- Disabling auto-convert ---
    if (!auto_convert_enabled) {
      const wasEnabled = company.dataValues.auto_convert_enabled;
      await company.update({ auto_convert_enabled: false });
      companyLogger.info(`[AutoConvert] Company ${id} auto-convert disabled (was ${wasEnabled ? "enabled" : "already disabled"})`);

      // Check wallet readiness: which volatile crypto currencies does the merchant
      // have direct wallets for? Without these, incoming payments in that currency
      // will fail because there is no destination address.
      const volatileCurrencies = ["BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "SOL", "XRP"];
      const merchantWallets = await userWalletModel.findAll({
        where: {
          company_id: parseInt(id),
          wallet_type: volatileCurrencies,
        },
        attributes: ["wallet_type", "wallet_address"],
      });

      const walletMap: Record<string, boolean> = {};
      for (const c of volatileCurrencies) {
        walletMap[c] = false;
      }
      const configuredWallets: string[] = [];
      for (const w of merchantWallets) {
        const wt = (w as { dataValues: { wallet_type: string; wallet_address: string } }).dataValues.wallet_type;
        const addr = (w as { dataValues: { wallet_type: string; wallet_address: string } }).dataValues.wallet_address;
        if (addr && addr.length > 5) {
          walletMap[wt] = true;
          configuredWallets.push(wt);
        }
      }

      const missingWallets = volatileCurrencies.filter((c) => !walletMap[c]);
      const hasAllWallets = missingWallets.length === 0;

      let warning: string | null = null;
      if (!hasAllWallets && missingWallets.length > 0) {
        warning =
          `Auto-conversion disabled. Payments will now be forwarded directly to your saved merchant wallets. ` +
          `Warning: You do not have wallets configured for: ${missingWallets.join(", ")}. ` +
          `Payments in these currencies will fail until you add wallet addresses for them.`;
      }

      return successResponseHelper(
        res,
        200,
        warning || "Auto-conversion disabled. Payments will be forwarded directly to your saved merchant wallets.",
        {
          auto_convert_enabled: false,
          forwarding_mode: "direct_to_merchant_wallets",
          previous_settlement: wasEnabled
            ? {
                currency: company.dataValues.settlement_currency,
                chain: company.dataValues.settlement_chain,
              }
            : null,
          wallet_readiness: {
            all_configured: hasAllWallets,
            configured_wallets: configuredWallets,
            missing_wallets: missingWallets,
            total_volatile_currencies: volatileCurrencies.length,
          },
        }
      );
    }

    // --- Enabling: fetch eligible wallets ---
    const availableOptions = await getEligibleStablecoinWallets(parseInt(id));

    // No eligible wallets at all → hard stop
    if (availableOptions.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "Auto-conversion requires a saved stablecoin wallet. Please add a USDT (TRC20/ERC20) or USDC (ERC20/Polygon) wallet to your company settings first."
      );
    }

    // Step 1: No currency/chain specified → return options for selection
    if (!settlement_currency || !settlement_chain) {
      return successResponseHelper(
        res,
        200,
        "Please select a settlement wallet from the available options below.",
        {
          action_required: "select_wallet",
          available_wallets: availableOptions,
        }
      );
    }

    // Step 2: Validate the chosen currency and chain
    if (!VALID_SETTLEMENT_CURRENCIES.includes(settlement_currency)) {
      return errorResponseHelper(
        res,
        400,
        `settlement_currency must be one of: ${VALID_SETTLEMENT_CURRENCIES.join(", ")}`
      );
    }
    if (!VALID_SETTLEMENT_CHAINS.includes(settlement_chain)) {
      return errorResponseHelper(
        res,
        400,
        `settlement_chain must be one of: ${VALID_SETTLEMENT_CHAINS.join(", ")}`
      );
    }

    // Verify the merchant actually has a wallet matching the selection
    const walletType = mapSettlementToWalletType(settlement_currency, settlement_chain);
    const selectedOption = availableOptions.find((o) => o.wallet_type === walletType);

    if (!selectedOption) {
      return errorResponseHelper(
        res,
        400,
        `No ${walletType} wallet found for this company. Available options: ${availableOptions.map((o) => o.wallet_type).join(", ")}`
      );
    }

    const resolvedAddress = selectedOption.wallet_address;

    await company.update({
      auto_convert_enabled: true,
      settlement_currency,
      settlement_wallet_address: resolvedAddress,
      settlement_chain,
    });

    companyLogger.info(
      `[AutoConvert] Company ${id} settings updated: enabled=true, currency=${settlement_currency}, chain=${settlement_chain}, wallet=${resolvedAddress.substring(0, 12)}...`
    );

    return successResponseHelper(res, 200, "Auto-convert enabled successfully", {
      auto_convert_enabled: true,
      settlement_currency,
      settlement_wallet_address: resolvedAddress,
      settlement_wallet_preview: `****${resolvedAddress.slice(-4)}`,
      settlement_chain,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    companyLogger.error(errorMessage, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get conversion history for a company
 * GET /api/company/conversion-history/:id?page=1&limit=20
 */
const getConversionHistory = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const { id } = req.params;
  const { page = 1, limit = 20, status } = req.query;

  try {
    // Verify ownership
    const company = await companyModel.findOne({
      where: { company_id: id, user_id: userData.user_id },
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Company not found");
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const whereClause: Record<string, unknown> = { company_id: parseInt(id) };
    if (status) {
      whereClause.status = status;
    }

    const { count, rows } = await stablecoinConversionModel.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit as string),
      offset,
      order: [["createdAt", "DESC"]],
    });

    successResponseHelper(res, 200, "Conversion history retrieved", {
      conversions: rows.map((r: { dataValues: Record<string, unknown> }) => r.dataValues),
      pagination: {
        total: count,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(count / parseInt(limit as string)),
      },
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    companyLogger.error(errorMessage, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

// Get single conversion detail by conversionId
const getConversionDetail = async (req: express.Request, res: express.Response) => {
  try {
    const conversionId = parseInt(req.params.conversionId);
    if (isNaN(conversionId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversion ID' });
    }

    const conversion = await stablecoinConversionModel.findOne({
      where: { conversion_id: conversionId },
    });

    if (!conversion) {
      return res.status(404).json({ success: false, message: 'Conversion not found' });
    }

    return res.status(200).json({
      success: true,
      data: conversion,
    });
  } catch (error) {
    companyLogger.error('Error getting conversion detail:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Retry a failed conversion
const retryConversion = async (req: express.Request, res: express.Response) => {
  try {
    const conversionId = parseInt(req.params.conversionId);
    if (isNaN(conversionId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversion ID' });
    }

    const conversion = await stablecoinConversionModel.findOne({
      where: { conversion_id: conversionId },
    });

    if (!conversion) {
      return res.status(404).json({ success: false, message: 'Conversion not found' });
    }

    if (conversion.dataValues.status !== 'FAILED') {
      return res.status(400).json({
        success: false,
        message: `Cannot retry conversion with status '${conversion.dataValues.status}'. Only FAILED conversions can be retried.`,
      });
    }

    // Reset status to PENDING_DEPOSIT to re-enter the pipeline
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (conversion as any).update({
      status: 'PENDING_DEPOSIT',
      error_message: null,
      retry_count: (conversion.dataValues.retry_count || 0) + 1,
    });

    // Reload to get updated values
    await conversion.reload();

    return res.status(200).json({
      success: true,
      message: 'Conversion retry initiated. Status reset to PENDING_DEPOSIT.',
      data: conversion,
    });
  } catch (error) {
    companyLogger.error('Error retrying conversion:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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

export default {
  addCompany,
  getCompany,
  getCompanyById,
  deleteCompany,
  updateCompany,
  getTransactions,
  validateTaxId,
  updateWebhookSettings,
  getWebhookSettings,
  testWebhook,
  getWebhookHistory,
  getWebhookDetail,
  getWebhookStats,
  getAutoConvertSettings,
  updateAutoConvertSettings,
  getConversionHistory,
  getConversionDetail,
  retryConversion,
  getFeeFreeStatus,
};
