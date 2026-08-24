import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage, successResponseHelper } from "../../helper";
import { companyLogger } from "../../utils/loggers";
import { companyModel, stablecoinConversionModel, userWalletModel } from "../../models";
import { IUserType } from "../../utils/types";

/**
 * Auto-Stablecoin Conversion Settings + Conversion History (extracted 2026-08-23n)
 * =============================================================================
 * Moved out of controller/companyController.ts so the parent file drops below
 * the file-size baseline. Behaviour is byte-for-byte unchanged; the parent
 * companyController.ts re-imports and re-exports these under the same names.
 *
 * Routes covered (see routes/companyRouter.ts):
 *   GET  /api/company/auto-convert/:id
 *   PUT  /api/company/auto-convert/:id
 *   GET  /api/company/conversion-history/:id
 *   GET  /api/company/conversion-detail/:conversionId
 *   POST /api/company/retry-conversion/:conversionId
 */

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

export {
  VALID_SETTLEMENT_CURRENCIES,
  VALID_SETTLEMENT_CHAINS,
  getEligibleStablecoinWallets,
  mapSettlementToWalletType,
  getAutoConvertSettings,
  updateAutoConvertSettings,
  getConversionHistory,
  getConversionDetail,
  retryConversion,
};
