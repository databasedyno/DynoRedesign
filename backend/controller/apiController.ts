import express from "express";
import {
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
  generateApiKeyName,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import {
  apiModel,
  companyModel,
  customerModel,
  customerWalletModel,
  planModel,
  userWalletModel,
} from "../models";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { apiLogger } from "../utils/loggers";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import flw from "../apis/flutterwaveApi";

const addApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { 
      company_id, 
      base_currency, 
      withdrawal_whitelist, 
      api_name, 
      permissions,
      environment = 'production' // Default to production
    } = req.body;

    // Validate environment
    if (!['production', 'development'].includes(environment)) {
      return errorResponseHelper(res, 400, "Invalid environment. Must be 'production' or 'development'");
    }

    // Validate base_currency - limited to supported currencies only
    const SUPPORTED_BASE_CURRENCIES = [
      'USD',  // US Dollar
      'EUR',  // Euro
      'GBP',  // British Pound
      'AUD',  // Australian Dollar
      'CAD',  // Canadian Dollar
      'INR',  // Indian Rupee
      'NGN',  // Nigerian Naira
      'VND',  // Vietnamese Dong
      'PKR',  // Pakistani Rupee
      'BRL',  // Brazilian Real
      'ARS',  // Argentine Peso
      'PHP',  // Philippine Peso
      'SGD',  // Singapore Dollar
      'AED',  // UAE Dirham
    ];
    
    if (!base_currency || !SUPPORTED_BASE_CURRENCIES.includes(base_currency.toUpperCase())) {
      return errorResponseHelper(
        res, 
        400, 
        `Base currency must be one of: ${SUPPORTED_BASE_CURRENCIES.join(', ')}`
      );
    }

    const requestedCurrency = base_currency.toUpperCase();

    // Check existing keys for this company
    const existingKeys = await apiModel.findAll({
      where: {
        company_id,
        status: 'active',
      },
    });

    const existingProdKey = existingKeys.find(k => k.dataValues.environment === 'production');
    const existingDevKey = existingKeys.find(k => k.dataValues.environment === 'development');

    let finalCurrency = requestedCurrency;
    let devKeyUpdated = false;

    // Currency synchronization logic
    if (environment === 'development') {
      // Creating development key
      if (existingProdKey) {
        // Production key exists - development MUST match production currency
        finalCurrency = existingProdKey.dataValues.base_currency;
        if (requestedCurrency !== finalCurrency) {
          apiLogger.info(`[API] Dev key currency forced to ${finalCurrency} to match production key`);
        }
      }
      // If no production key, development can use any currency
    } else {
      // Creating production key
      // Production key can use any currency, but development key must be updated to match
      if (existingDevKey && existingDevKey.dataValues.base_currency !== requestedCurrency) {
        // Update development key to match new production currency
        await apiModel.update(
          { base_currency: requestedCurrency },
          { where: { api_id: existingDevKey.dataValues.api_id } }
        );
        devKeyUpdated = true;
        apiLogger.info(`[API] Dev key (api_id: ${existingDevKey.dataValues.api_id}) currency updated to ${requestedCurrency} to match new production key`);
      }
    }

    const keyData = {
      base_currency: finalCurrency,
      company_id,
      adm_id: userData.user_id,
      env: environment,
    };

    // Default permissions if not provided
    const defaultPermissions = ["payments", "transactions", "webhooks", "wallets"];
    const apiPermissions = permissions || defaultPermissions;

    // Phase 10 Task 10.1: Check for at least 1 wallet address for this company (only required for production keys)
    if (environment === 'production') {
      const walletCount = await userWalletModel.count({
        where: {
          user_id: userData.user_id,
          wallet_address: { [Op.not]: null },
          ...(company_id && { company_id }),
        },
      });

      if (walletCount < 1) {
        return errorResponseHelper(
          res,
          400,
          "At least one wallet address is required for production API keys"
        );
      }
    }

    // Generate appropriate key prefix based on environment
    const keyPrefix = environment === 'production' ? 'dpk_live_' : 'dpk_test_';
    const keyString = keyPrefix + "DYNOPAY_USER_API-" + JSON.stringify(keyData);

    const apiKey = encrypt(keyString, process.env.API_SECRET);

    // Enforce: Only 1 API key per company (regardless of environment)
    // A company cannot have more than 1 active key due to the currency system
    const existingApiKey = await apiModel.findOne({
      where: {
        company_id,
        status: 'active',
      },
    });

    if (existingApiKey) {
      return errorResponseHelper(
        res,
        400,
        `This company already has an active API key (${existingApiKey.dataValues.base_currency} ${existingApiKey.dataValues.environment}). Use "Regenerate" to get a new key, or disable the existing one first.`
      );
    }
    
    const companyData = await validateCompanyOwnership(res, company_id, userData.user_id);
    if (!companyData) return; // 403 already sent
    
    const createdUser = await customerModel.create({
      id: crypto.randomUUID(),
      customer_name: companyData.company_name + " admin",
      email: companyData.email,
      mobile: companyData.email,
      company_id: company_id,
    });

    await customerWalletModel.create({
      id: crypto.randomUUID(),
      customer_id: createdUser.dataValues.customer_id,
      wallet_type: finalCurrency,
    });

    const token = await getAccessToken(createdUser.dataValues.customer_id);
    
    // Generate admin token (separate from customer token)
    const adminTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    const adminTokenPayload = {
      api_id: null, // Will be set after creation
      company_id,
      user_id: userData.user_id,
      type: 'admin_token',
      environment,
    };
    const adminToken = jwt.sign(adminTokenPayload, adminTokenSecret, { expiresIn: '30d' });
    
    // Default test mode restrictions for development keys
    const testModeRestrictions = environment === 'development' 
      ? JSON.stringify({
          max_amount: 100,
          allowed_currencies: ["BTC", "ETH", "USDT-TRC20", "TRX", "LTC"],
          sandbox_mode: true,
        })
      : null;

    const resData = await apiModel.create({
      company_id,
      base_currency: finalCurrency,
      apiKey,
      user_id: userData.user_id,
      adminToken: token.token, // Customer token (legacy)
      admin_token: adminToken, // New admin token
      withdrawal_whitelist: withdrawal_whitelist,
      api_name: api_name || generateApiKeyName(),
      permissions: JSON.stringify(apiPermissions),
      environment,
      status: 'active',
      test_mode_restrictions: testModeRestrictions,
      request_count: 0,
      rate_limit_per_minute: 60,
      rate_limit_per_hour: 3600,
      rate_limit_per_day: 100000,
    });

    // Build success message
    let successMessage = "API generated successfully!";
    if (devKeyUpdated) {
      successMessage = "API generated successfully! Development key currency has been updated to match.";
    } else if (environment === 'development' && existingProdKey && requestedCurrency !== finalCurrency) {
      successMessage = `API generated successfully! Currency set to ${finalCurrency} to match production key.`;
    }

    successResponseHelper(res, 200, successMessage, {
      ...resData.dataValues,
      ...(companyData as Record<string, unknown>),
      permissions: apiPermissions,
      environment,
      currency_synced: devKeyUpdated,
      ...(devKeyUpdated && { 
        sync_info: `Development key updated from ${existingDevKey?.dataValues.base_currency} to ${finalCurrency}` 
      }),
    });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getAccessToken = async (id) => {
  const user = await customerModel.findOne({
    where: {
      customer_id: id,
    },
  });

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { customer_id, ...userData } = user.dataValues;
  apiLogger.info(userData);
  if (tokenSecret) {
    const token = jwt.sign(userData, tokenSecret, { expiresIn: '30d' });
    const resData = { token, customer_id: userData.id };
    return resData;
  }
};

const getApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { environment, company_id, status } = req.query;
    
    // Build query with optional filters
    let whereClause = `WHERE a.user_id = :user_id`;
    const replacements: Record<string, unknown> = { user_id: userData.user_id };
    
    if (environment && ['production', 'development'].includes(environment as string)) {
      whereClause += ` AND a.environment = :environment`;
      replacements.environment = environment;
    }
    
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userData.user_id);
      if (!companyData) return; // 403 already sent
      whereClause += ` AND a.company_id = :company_id`;
      replacements.company_id = company_id;
    }
    
    if (status && ['active', 'inactive', 'revoked'].includes(status as string)) {
      whereClause += ` AND a.status = :status`;
      replacements.status = status;
    }
    
    const resData = await sequelize.query(
      `SELECT a.*, c.company_id, c.company_name 
       FROM tbl_api a
       JOIN tbl_company c ON a.company_id = c.company_id
       ${whereClause}
       ORDER BY a.environment ASC, a."createdAt" DESC`,
      { 
        replacements,
        type: QueryTypes.SELECT 
      }
    );
    
    // Parse permissions and test_mode_restrictions JSON for each API
    const formattedData = resData.map((api: Record<string, unknown>) => ({
      ...api,
      permissions: api.permissions ? JSON.parse(String(api.permissions)) : ["payments", "transactions", "webhooks", "wallets"],
      test_mode_restrictions: api.test_mode_restrictions ? JSON.parse(String(api.test_mode_restrictions)) : null,
      // Normalize: newer rows store the admin token in `admin_token`; legacy rows in `adminToken`.
      adminToken: api.admin_token || api.adminToken || null,
      // Mask sensitive parts of the API key for display
      apiKey_masked: api.apiKey ? maskApiKey(String(api.apiKey), String(api.environment || '')) : null,
      environment: api.environment,
    }));
    
    // Group by environment for better organization
    const grouped = {
      production: formattedData.filter((api) => api.environment === 'production' || !api.environment),
      development: formattedData.filter((api) => api.environment === 'development'),
    };
    
    successResponseHelper(res, 200, "API keys retrieved successfully", {
      all: formattedData,
      grouped,
      total: formattedData.length,
      production_count: grouped.production.length,
      development_count: grouped.development.length,
    });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Mask API key for secure display
 */
const maskApiKey = (apiKey: string, environment: string = 'production'): string => {
  const prefix = environment === 'development' ? 'dpk_test_' : 'dpk_live_';
  if (apiKey.length <= 16) return prefix + '****';
  const visibleStart = apiKey.substring(0, 8);
  const visibleEnd = apiKey.substring(apiKey.length - 4);
  return `${prefix}${visibleStart}...${visibleEnd}`;
};

/**
 * Toggle API key status (activate/deactivate)
 * PUT /api/userApi/toggleStatus/:id
 */
const toggleApiStatus = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return errorResponseHelper(res, 400, "Invalid status. Must be 'active' or 'inactive'");
    }

    // Check if API exists and belongs to user
    const existingApi = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!existingApi) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    // Can't reactivate revoked keys
    if (existingApi.dataValues.status === 'revoked') {
      return errorResponseHelper(res, 400, "Cannot change status of a revoked API key. Please create a new key.");
    }

    await apiModel.update(
      { status },
      { where: { api_id, user_id: userData.user_id } }
    );

    const updatedApi = await apiModel.findOne({ where: { api_id } });

    apiLogger.info(`API ${api_id} status changed to ${status} by user ${userData.user_id}`);
    successResponseHelper(res, 200, `API key ${status === 'active' ? 'activated' : 'deactivated'} successfully`, {
      api_id,
      status,
      environment: updatedApi?.dataValues.environment,
    });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Revoke API key (permanent deactivation)
 * POST /api/userApi/revoke/:id
 */
const revokeApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { reason } = req.body;

    // Check if API exists and belongs to user
    const existingApi = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!existingApi) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    if (existingApi.dataValues.status === 'revoked') {
      return errorResponseHelper(res, 400, "API key is already revoked");
    }

    await apiModel.update(
      { status: 'revoked' },
      { where: { api_id, user_id: userData.user_id } }
    );

    apiLogger.warn(`API ${api_id} REVOKED by user ${userData.user_id}. Reason: ${reason || 'Not specified'}`);
    successResponseHelper(res, 200, "API key revoked successfully. This action cannot be undone.", {
      api_id,
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      message: "Please create a new API key if needed. Update your integrations to use the new key.",
    });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const deleteApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const resData = await apiModel.destroy({
      where: {
        user_id: userData.user_id,
        api_id,
      },
    });
    successResponseHelper(res, 200, "Api deleted successfully!", resData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getApiCustomers = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { rowsPerPage, page } = req.body;
    let offset, limit;

    if (rowsPerPage && page) {
      offset = (page - 1) * rowsPerPage;
      limit = rowsPerPage;
    }
    const company_data = await (
      await companyModel.findAll({
        attributes: ["company_id"],
        where: {
          user_id: userData.user_id,
        },
      })
    ).map((x) => x.dataValues.company_id);

    const customer_data = await customerModel.findAll({
      where: {
        company_id: {
          [Op.in]: company_data,
        },
      },
    });

    const message = customer_data.length === 0
      ? "No customers found for this API"
      : `Successfully retrieved ${customer_data.length} customer${customer_data.length === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, customer_data);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const createPlan = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { plan_name, amount, interval, company_id } = req.body;

    const apiData = await apiModel.findOne({ where: { company_id } });

    const flwResponse = await flw.PaymentPlan.create({
      name: plan_name,
      amount,
      interval,
      currency: apiData?.dataValues?.base_currency ?? "USD",
    }) as { data?: { id?: string } };

    const payload = {
      id: crypto.randomUUID(),
      user_id: userData.user_id,
      flw_plan_id: flwResponse.data?.id,
      company_id,
      plan_name,
      amount,
      interval,
      currency: (req.body as Record<string, unknown>).currency,
    };

    const planData = await planModel.create({ ...payload });

    successResponseHelper(res, 200, "Plan generated successfully!", planData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

const getPlans = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const company_id = req.params.id;
  try {
    const planData = await planModel.findAll({
      where: {
        company_id,
        user_id: userData.user_id,
      },
    });

    const message = planData.length === 0
      ? "No subscription plans found. Create your first plan."
      : `Successfully retrieved ${planData.length} subscription plan${planData.length === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, planData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get API by ID
 * GET /api/userApi/getApi/:id
 */
const getApiById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    
    const resData = await sequelize.query(
      `SELECT a.*, c.company_id, c.company_name FROM tbl_api a
       JOIN tbl_company c ON a.company_id = c.company_id
       WHERE a.user_id = :user_id AND a.api_id = :api_id`,
      { 
        replacements: { user_id: userData.user_id, api_id },
        type: QueryTypes.SELECT 
      }
    );

    if (!resData || resData.length === 0) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    const api = resData[0] as Record<string, unknown>;
    const formattedData = {
      ...api,
      permissions: api.permissions ? JSON.parse(String(api.permissions)) : ["payments", "transactions", "webhooks", "wallets"],
    };

    successResponseHelper(res, 200, "API retrieved successfully", formattedData);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(message)
    );
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Update API
 * PUT /api/userApi/updateApi/:id
 * Updatable fields: api_name, permissions, withdrawal_whitelist
 */
const updateApi = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { 
      api_name, 
      permissions, 
      withdrawal_whitelist,
      base_currency,
      webhook_url,
      webhook_secret,
      notes
    } = req.body;

    // Check if API exists and belongs to user
    const existingApi = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!existingApi) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (api_name !== undefined) {
      updateData.api_name = api_name;
    }
    
    if (permissions !== undefined) {
      // Validate permissions array
      const validPermissions = ["payments", "transactions", "webhooks", "wallets", "invoices", "customers"];
      const invalidPerms = permissions.filter((p: string) => !validPermissions.includes(p));
      if (invalidPerms.length > 0) {
        return errorResponseHelper(res, 400, `Invalid permissions: ${invalidPerms.join(", ")}`);
      }
      updateData.permissions = JSON.stringify(permissions);
    }
    
    if (withdrawal_whitelist !== undefined) {
      updateData.withdrawal_whitelist = withdrawal_whitelist;
    }
    
    if (base_currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'BRL', 'BTC'];
      if (!validCurrencies.includes(base_currency.toUpperCase())) {
        return errorResponseHelper(res, 400, `Invalid base_currency. Valid options: ${validCurrencies.join(', ')}`);
      }
      updateData.base_currency = base_currency.toUpperCase();
    }
    
    if (webhook_url !== undefined) {
      updateData.webhook_url = webhook_url || null;
    }
    
    if (webhook_secret !== undefined) {
      updateData.webhook_secret = webhook_secret || null;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields to update");
    }

    await apiModel.update(updateData, {
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    // Fetch updated record
    const updatedApi = await apiModel.findOne({
      where: { api_id },
    });

    const responseData = {
      ...updatedApi?.dataValues,
      permissions: updatedApi?.dataValues.permissions 
        ? JSON.parse(updatedApi.dataValues.permissions) 
        : ["payments", "transactions", "webhooks", "wallets"],
    };

    apiLogger.info(`API ${api_id} updated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "API updated successfully", responseData);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Regenerate API Key
 * POST /api/userApi/regenerateKey/:id
 */
const regenerateApiKey = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;

    // Check if API exists and belongs to user
    const existingApi = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!existingApi) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    // Generate new API key
    const keyData = {
      base_currency: existingApi.dataValues.base_currency,
      company_id: existingApi.dataValues.company_id,
      adm_id: userData.user_id,
      regenerated_at: new Date().toISOString(),
    };

    const keyString = "DYNOPAY_USER_API-" + JSON.stringify(keyData);
    const newApiKey = encrypt(keyString, process.env.API_SECRET);

    await apiModel.update(
      { apiKey: newApiKey },
      { where: { api_id, user_id: userData.user_id } }
    );

    // Send API key regenerated notification email
    try {
      const { sendApiKeyCreatedEmail } = await import("../services/emailService");
      const now = new Date();
      const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const keyType = existingApi.dataValues.status === 'production' ? 'production' : 'development';
      await sendApiKeyCreatedEmail(
        userData.email,
        userData.name || 'User',
        keyType,
        'regenerated',
        newApiKey.substring(0, 12),
        date,
        time
      );
      apiLogger.info(`[ApiKey] Regeneration notification sent to ${userData.email}`);
    } catch (emailError) {
      apiLogger.error("[ApiKey] Failed to send regeneration notification:", emailError);
    }

    apiLogger.info(`API key ${api_id} regenerated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "API key regenerated successfully", {
      api_id,
      apiKey: newApiKey,
      message: "Please update your integrations with the new API key"
    });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Update Plan
 * PUT /api/userApi/updatePlan/:id
 */
const updatePlan = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const plan_id = req.params.id;
    const { plan_name, amount, interval } = req.body;

    // Check if plan exists and belongs to user
    const existingPlan = await planModel.findOne({
      where: {
        plan_id,
        user_id: userData.user_id,
      },
    });

    if (!existingPlan) {
      return errorResponseHelper(res, 404, "Plan not found");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (plan_name !== undefined) updateData.plan_name = plan_name;
    if (amount !== undefined) updateData.amount = amount;
    if (interval !== undefined) updateData.interval = interval;

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields to update");
    }

    // Update in Flutterwave if amount or interval changed
    if (amount !== undefined || interval !== undefined) {
      try {
        await flw.PaymentPlan.update({
          id: existingPlan.dataValues.flw_plan_id,
          name: plan_name || existingPlan.dataValues.plan_name,
          amount: amount || existingPlan.dataValues.amount,
        });
      } catch (flwError) {
        apiLogger.warn(`Failed to update plan in Flutterwave: ${getErrorMessage(flwError)}`);
        // Continue with local update even if Flutterwave fails
      }
    }

    await planModel.update(updateData, {
      where: { plan_id, user_id: userData.user_id },
    });

    const updatedPlan = await planModel.findOne({ where: { plan_id } });

    apiLogger.info(`Plan ${plan_id} updated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Plan updated successfully", updatedPlan);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Delete Plan
 * DELETE /api/userApi/deletePlan/:id
 */
const deletePlan = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const plan_id = req.params.id;

    // Check if plan exists and belongs to user
    const existingPlan = await planModel.findOne({
      where: {
        plan_id,
        user_id: userData.user_id,
      },
    });

    if (!existingPlan) {
      return errorResponseHelper(res, 404, "Plan not found");
    }

    // Try to cancel in Flutterwave
    try {
      await flw.PaymentPlan.cancel(existingPlan.dataValues.flw_plan_id);
    } catch (flwError) {
      apiLogger.warn(`Failed to cancel plan in Flutterwave: ${getErrorMessage(flwError)}`);
      // Continue with local delete even if Flutterwave fails
    }

    await planModel.destroy({
      where: { plan_id, user_id: userData.user_id },
    });

    apiLogger.info(`Plan ${plan_id} deleted by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Plan deleted successfully", { plan_id });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Update Customer
 * PUT /api/userApi/updateCustomer/:id
 */
const updateCustomer = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const customer_id = req.params.id;
    const { customer_name, email, mobile } = req.body;

    // Get user's companies
    const userCompanies = await companyModel.findAll({
      attributes: ["company_id"],
      where: { user_id: userData.user_id },
    });
    const companyIds = userCompanies.map((c) => c.dataValues.company_id);

    // Check if customer belongs to user's company
    const existingCustomer = await customerModel.findOne({
      where: {
        customer_id,
        company_id: { [Op.in]: companyIds },
      },
    });

    if (!existingCustomer) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (email !== undefined) updateData.email = email;
    if (mobile !== undefined) updateData.mobile = mobile;

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields to update");
    }

    await customerModel.update(updateData, {
      where: { customer_id },
    });

    const updatedCustomer = await customerModel.findOne({ where: { customer_id } });

    apiLogger.info(`Customer ${customer_id} updated by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Customer updated successfully", updatedCustomer);
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Delete Customer
 * DELETE /api/userApi/deleteCustomer/:id
 */
const deleteCustomer = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const customer_id = req.params.id;

    // Get user's companies
    const userCompanies = await companyModel.findAll({
      attributes: ["company_id"],
      where: { user_id: userData.user_id },
    });
    const companyIds = userCompanies.map((c) => c.dataValues.company_id);

    // Check if customer belongs to user's company
    const existingCustomer = await customerModel.findOne({
      where: {
        customer_id,
        company_id: { [Op.in]: companyIds },
      },
    });

    if (!existingCustomer) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    // Delete customer wallets first
    await customerWalletModel.destroy({
      where: { customer_id },
    });

    // Delete customer
    await customerModel.destroy({
      where: { customer_id },
    });

    apiLogger.info(`Customer ${customer_id} deleted by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Customer deleted successfully", { customer_id });
  } catch (e) {

      handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get customers with wallet balances for dashboard
 * GET /api/userApi/customers
 * Returns customers with their wallet balances for the current company
 */
const getCustomersWithBalances = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id, search, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get user's companies
    const userCompanies = await companyModel.findAll({
      attributes: ["company_id"],
      where: { user_id: userData.user_id },
    });
    const companyIds = company_id 
      ? [company_id] 
      : userCompanies.map((c) => c.dataValues.company_id);

    if (companyIds.length === 0) {
      return successResponseHelper(res, 200, "No companies found", { customers: [], total: 0, aggregates: { total_customers: 0, total_balance: 0 } });
    }

    // Build search filter
    let searchFilter = '';
    const replacements: Record<string, unknown> = { companyIds, limit: Number(limit), offset };
    if (search) {
      searchFilter = `AND (c.customer_name ILIKE :search OR c.email ILIKE :search)`;
      replacements.search = `%${search}%`;
    }

    // Get customers with their wallet balances
    const customers = await sequelize.query(
      `SELECT 
        c.customer_id, c.id, c.customer_name, c.email, c.mobile, c.company_id, c."createdAt",
        cm.company_name,
        COALESCE(cw.amount, 0) as wallet_balance,
        COALESCE(cw.wallet_type, 'USD') as wallet_currency,
        (SELECT COUNT(*) FROM tbl_customer_transaction ct WHERE ct.customer_id = c.customer_id) as transaction_count
      FROM tbl_customer c
      LEFT JOIN tbl_customer_wallet cw ON cw.customer_id = c.customer_id
      LEFT JOIN tbl_company cm ON cm.company_id = c.company_id
      WHERE c.company_id IN (:companyIds) ${searchFilter}
      ORDER BY c."createdAt" DESC
      LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );

    // Get total count
    const countResult = await sequelize.query(
      `SELECT COUNT(DISTINCT c.customer_id) as total 
       FROM tbl_customer c
       WHERE c.company_id IN (:companyIds) ${searchFilter}`,
      { replacements, type: QueryTypes.SELECT }
    ) as Array<{ total: string }>;

    // Get aggregate stats
    const aggregates = await sequelize.query(
      `SELECT 
        COUNT(DISTINCT c.customer_id) as total_customers,
        COALESCE(SUM(cw.amount), 0) as total_balance,
        COALESCE(MAX(cw.wallet_type), 'USD') as currency
      FROM tbl_customer c
      LEFT JOIN tbl_customer_wallet cw ON cw.customer_id = c.customer_id
      WHERE c.company_id IN (:companyIds)`,
      { replacements: { companyIds }, type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;

    const total = parseInt(String(countResult[0]?.total || '0'));
    const agg = aggregates[0] || {};

    successResponseHelper(res, 200, `Retrieved ${customers.length} customers`, {
      customers,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
      aggregates: {
        total_customers: parseInt(String(agg.total_customers || '0')),
        total_balance: parseFloat(String(agg.total_balance || '0')),
        currency: agg.currency || 'USD',
      },
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get customer detail with wallet balance and transaction history
 * GET /api/userApi/customer/:id
 */
const getCustomerDetail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const customer_id = req.params.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Get user's companies
    const userCompanies = await companyModel.findAll({
      attributes: ["company_id"],
      where: { user_id: userData.user_id },
    });
    const companyIds = userCompanies.map((c) => c.dataValues.company_id);

    // Get customer data
    const customerData = await sequelize.query(
      `SELECT c.*, cm.company_name
       FROM tbl_customer c
       LEFT JOIN tbl_company cm ON cm.company_id = c.company_id
       WHERE c.customer_id = :customer_id AND c.company_id IN (:companyIds)`,
      { replacements: { customer_id, companyIds }, type: QueryTypes.SELECT }
    ) as Array<Record<string, unknown>>;

    if (customerData.length === 0) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    // Get wallet balance
    const walletData = await sequelize.query(
      `SELECT * FROM tbl_customer_wallet WHERE customer_id = :customer_id`,
      { replacements: { customer_id }, type: QueryTypes.SELECT }
    );

    // Get transaction history
    const transactions = await sequelize.query(
      `SELECT * FROM tbl_customer_transaction 
       WHERE customer_id = :customer_id 
       ORDER BY "createdAt" DESC 
       LIMIT :limit OFFSET :offset`,
      { replacements: { customer_id, limit: Number(limit), offset }, type: QueryTypes.SELECT }
    );

    const txCountResult = await sequelize.query(
      `SELECT COUNT(*) as total FROM tbl_customer_transaction WHERE customer_id = :customer_id`,
      { replacements: { customer_id }, type: QueryTypes.SELECT }
    ) as Array<{ total: string }>;

    const txTotal = parseInt(String(txCountResult[0]?.total || '0'));

    successResponseHelper(res, 200, "Customer detail retrieved", {
      customer: customerData[0],
      wallet: walletData[0] || null,
      transactions: {
        data: transactions,
        total: txTotal,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(txTotal / Number(limit)),
      },
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};


/**
 * Get API Usage Statistics
 * GET /api/userApi/usage/:id
 */
const getApiUsageStats = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { days = 7 } = req.query;

    // Verify API belongs to user
    const apiKey = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!apiKey) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    // Get usage logs from the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const usageLogs = await sequelize.query(
      `SELECT 
        DATE(request_time) as date,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as success_count,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
       FROM tbl_api_usage_log
       WHERE api_id = :api_id AND request_time >= :startDate
       GROUP BY DATE(request_time)
       ORDER BY date DESC`,
      {
        replacements: { api_id, startDate },
        type: QueryTypes.SELECT,
      }
    );

    // Get endpoint distribution
    const endpointStats = await sequelize.query(
      `SELECT 
        endpoint,
        method,
        COUNT(*) as count
       FROM tbl_api_usage_log
       WHERE api_id = :api_id AND request_time >= :startDate
       GROUP BY endpoint, method
       ORDER BY count DESC
       LIMIT 10`,
      {
        replacements: { api_id, startDate },
        type: QueryTypes.SELECT,
      }
    );

    const stats = {
      api_id: apiKey.dataValues.api_id,
      api_name: apiKey.dataValues.api_name,
      total_requests: apiKey.dataValues.request_count || 0,
      last_used_at: apiKey.dataValues.last_used_at,
      rate_limits: {
        per_minute: apiKey.dataValues.rate_limit_per_minute,
        per_hour: apiKey.dataValues.rate_limit_per_hour,
        per_day: apiKey.dataValues.rate_limit_per_day,
      },
      usage_by_day: usageLogs,
      top_endpoints: endpointStats,
    };

    successResponseHelper(res, 200, "Usage statistics retrieved", stats);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Get Recent API Request Logs
 * GET /api/userApi/logs/:id
 */
const getApiLogs = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { limit = 50, offset = 0, status_code } = req.query;

    // Verify API belongs to user
    const apiKey = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!apiKey) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    let whereClause = `WHERE api_id = :api_id`;
    const replacements: Record<string, unknown> = { api_id, limit: Number(limit), offset: Number(offset) };

    if (status_code) {
      whereClause += ` AND status_code = :status_code`;
      replacements.status_code = Number(status_code);
    }

    const logs = await sequelize.query(
      `SELECT 
        log_id,
        endpoint,
        method,
        status_code,
        ip_address,
        response_time_ms,
        error_message,
        request_time
       FROM tbl_api_usage_log
       ${whereClause}
       ORDER BY request_time DESC
       LIMIT :limit OFFSET :offset`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );

    // Get total count
    const [countResult] = await sequelize.query(
      `SELECT COUNT(*) as total FROM tbl_api_usage_log ${whereClause}`,
      {
        replacements: { api_id, status_code: status_code ? Number(status_code) : null },
        type: QueryTypes.SELECT,
      }
    );

    const total = (countResult as unknown as { total: number }).total;

    successResponseHelper(res, 200, "API logs retrieved", {
      logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        has_more: Number(offset) + Number(limit) < total,
      },
    });
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Update API Rate Limits
 * PUT /api/userApi/rateLimit/:id
 */
const updateRateLimit = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const api_id = req.params.id;
    const { rate_limit_per_minute, rate_limit_per_hour, rate_limit_per_day } = req.body;

    // Verify API belongs to user
    const apiKey = await apiModel.findOne({
      where: {
        api_id,
        user_id: userData.user_id,
      },
    });

    if (!apiKey) {
      return errorResponseHelper(res, 404, "API key not found");
    }

    const updateData: Record<string, unknown> = {};
    if (rate_limit_per_minute) updateData.rate_limit_per_minute = rate_limit_per_minute;
    if (rate_limit_per_hour) updateData.rate_limit_per_hour = rate_limit_per_hour;
    if (rate_limit_per_day) updateData.rate_limit_per_day = rate_limit_per_day;

    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No rate limits provided");
    }

    await apiModel.update(updateData, {
      where: { api_id, user_id: userData.user_id },
    });

    const updatedApi = await apiModel.findOne({ where: { api_id } });

    apiLogger.info(`Rate limits updated for API ${api_id} by user ${userData.user_id}`);
    successResponseHelper(res, 200, "Rate limits updated", {
      api_id,
      rate_limits: {
        per_minute: updatedApi.dataValues.rate_limit_per_minute,
        per_hour: updatedApi.dataValues.rate_limit_per_hour,
        per_day: updatedApi.dataValues.rate_limit_per_day,
      },
    });
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Get Available Currencies for API Key Creation
 * GET /api/userApi/availableCurrencies/:company_id
 * 
 * Returns available currencies based on existing keys:
 * - If production key exists: currency is locked to production key's currency
 * - If only development key exists: all currencies available (prod will set the master)
 * - If no keys exist: all currencies available
 */
const getAvailableCurrencies = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id } = req.params;
    const { environment = 'production' } = req.query;

    // Supported currencies
    const SUPPORTED_BASE_CURRENCIES = [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
      { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
      { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
      { code: 'ARS', name: 'Argentine Peso', symbol: 'ARS$' },
      { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
    ];

    // Check existing keys for this company
    const existingKeys = await apiModel.findAll({
      where: {
        company_id,
        user_id: userData.user_id,
        status: 'active',
      },
    });

    const existingProdKey = existingKeys.find(k => k.dataValues.environment === 'production');
    const existingDevKey = existingKeys.find(k => k.dataValues.environment === 'development');

    let response: {
      currencies: typeof SUPPORTED_BASE_CURRENCIES;
      locked: boolean;
      locked_currency: string | null;
      locked_reason: string | null;
      existing_keys: {
        production: { exists: boolean; currency: string | null };
        development: { exists: boolean; currency: string | null };
      };
      hint: string;
    };

    if (environment === 'development' && existingProdKey) {
      // Creating dev key when prod exists - locked to prod currency
      response = {
        currencies: SUPPORTED_BASE_CURRENCIES.filter(c => c.code === existingProdKey.dataValues.base_currency),
        locked: true,
        locked_currency: existingProdKey.dataValues.base_currency,
        locked_reason: 'Development key must match production key currency',
        existing_keys: {
          production: { exists: true, currency: existingProdKey.dataValues.base_currency },
          development: { exists: !!existingDevKey, currency: existingDevKey?.dataValues.base_currency || null },
        },
        hint: `Currency is locked to ${existingProdKey.dataValues.base_currency} to match your production key.`,
      };
    } else if (environment === 'production' && existingDevKey && !existingProdKey) {
      // Creating prod key when only dev exists - all currencies available, will sync dev
      response = {
        currencies: SUPPORTED_BASE_CURRENCIES,
        locked: false,
        locked_currency: null,
        locked_reason: null,
        existing_keys: {
          production: { exists: false, currency: null },
          development: { exists: true, currency: existingDevKey.dataValues.base_currency },
        },
        hint: `Your development key (${existingDevKey.dataValues.base_currency}) will be automatically updated to match the currency you choose.`,
      };
    } else {
      // No restrictions
      response = {
        currencies: SUPPORTED_BASE_CURRENCIES,
        locked: false,
        locked_currency: null,
        locked_reason: null,
        existing_keys: {
          production: { exists: !!existingProdKey, currency: existingProdKey?.dataValues.base_currency || null },
          development: { exists: !!existingDevKey, currency: existingDevKey?.dataValues.base_currency || null },
        },
        hint: 'Select your preferred base currency for transactions and reporting.',
      };
    }

    successResponseHelper(res, 200, "Available currencies retrieved", response);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, { user_id: userData.user_id }, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

export default {
  addApi,
  getApi,
  getApiById,
  updateApi,
  regenerateApiKey,
  toggleApiStatus,
  revokeApi,
  deleteApi,
  getApiCustomers,
  getCustomersWithBalances,
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
  createPlan,
  getPlans,
  updatePlan,
  deletePlan,
  getApiUsageStats,
  getApiLogs,
  updateRateLimit,
  getAvailableCurrencies,
};
