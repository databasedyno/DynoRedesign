import express from "express";
import {
  downloadUserImage,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import emailService from "../../services/emailService";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel, loginActivityModel } from "../../models";
import { userWalletAddressModel } from "../../models/userModels";
import notificationModel from "../../models/notificationModel";
import notificationPreferencesModel from "../../models/notificationPreferencesModel";
import kycModel from "../../models/kycModel";
import sha256 from "crypto-js/sha256";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../../helper/passwordHelper";
import crypto from "crypto";
import sequelize from "../../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import axios from "axios";
import { userLogger } from "../../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem, setRedisItemWithTTL, redis } from "../../utils/redisInstance";
import { isAccountLocked, recordFailedAttempt, clearFailedAttempts } from "../../services/accountLockoutService";
import { createSession } from "../../services/sessionService";
import { finalizeUploadedImage } from "../../services/objectStorage";
import { is2FARequired } from "../../services/twoFactorService";
import { normalizeLang } from "../../utils/emailI18n";
import { PROFILE_CACHE_TTL, _formatAttribution, parseUserAgent, createUserWallets, generateReferralCode, finalizeLogin, getAccessToken, sendEmailOTP, sendTelnyxSMS } from "./userShared";

export const getUserDisplayCurrency = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cu = require("../../utils/currencyUtils");
    // Read raw override to answer "source"
    const rawRows = (await sequelize.query(
      `SELECT display_currency FROM tbl_user WHERE user_id = :uid LIMIT 1`,
      { replacements: { uid: userData.user_id }, type: QueryTypes.SELECT }
    )) as Array<{ display_currency: string | null }>;
    const userOverride = rawRows.length ? rawRows[0].display_currency : null;
    const companyIdForResolve =
      ((userData as any)?.last_company_id ?? userData?.company_id) || null;
    const resolved: string = await cu.getUserDisplayCurrency(
      userData.user_id,
      companyIdForResolve
    );
    const supported = (cu.SUPPORTED_DISPLAY_CURRENCIES as string[]).map((code: string) => cu.getCurrencyInfo(code));
    const source: "user" | "company" | "default" = userOverride
      ? "user"
      : companyIdForResolve
        ? "company"
        : "default";
    // USD→display-currency FX rate (cached in Redis, 600s TTL). Lets the
    // frontend show a fiat estimate next to crypto amounts in the merchant's
    // chosen display currency without doing any client-side FX guessing.
    let rate = 1;
    try {
      rate = await cu.getUsdToFiatRate(resolved);
    } catch {
      rate = 1;
    }
    return successResponseHelper(res, 200, "Display currency retrieved", {
      display_currency: resolved,
      user_override: userOverride,
      source,
      currency_info: cu.getCurrencyInfo(resolved),
      rate,
      supported,
    });
  } catch (e) {
    userLogger.error(getErrorMessage(e), { user_id: userData?.user_id }, new Error(e as any));
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
};

/**
 * PATCH /api/user/display-currency
 * Body: { display_currency: 'EUR' } to set, or { display_currency: null } to
 * clear the override (falls back to company preference). Validates against
 * the same supported list as company-level.
 */
export const updateUserDisplayCurrency = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const rawCur = req.body?.display_currency;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cu = require("../../utils/currencyUtils");

    // Allow explicit null / "" to clear the override.
    let nextValue: string | null = null;
    if (rawCur !== null && rawCur !== undefined && rawCur !== "") {
      const cur = String(rawCur).toUpperCase();
      if (!cu.isSupportedDisplayCurrency(cur)) {
        return errorResponseHelper(
          res,
          400,
          `display_currency must be one of: ${cu.SUPPORTED_DISPLAY_CURRENCIES.join(", ")}`
        );
      }
      nextValue = cur;
    }

    await sequelize.query(
      `UPDATE tbl_user SET display_currency = :cur WHERE user_id = :uid`,
      {
        replacements: { cur: nextValue, uid: userData.user_id },
        type: QueryTypes.UPDATE,
      }
    );

    userLogger.info(
      `[DisplayCurrency] User ${userData.user_id} display_currency set to ${nextValue || "NULL (inherit)"}`
    );

    const companyIdForResolve2 =
      ((userData as any)?.last_company_id ?? userData?.company_id) || null;
    const resolved: string = await cu.getUserDisplayCurrency(
      userData.user_id,
      companyIdForResolve2
    );
    return successResponseHelper(res, 200, "Display currency updated", {
      display_currency: resolved,
      user_override: nextValue,
      source: nextValue ? "user" : companyIdForResolve2 ? "company" : "default",
      currency_info: cu.getCurrencyInfo(resolved),
    });
  } catch (e) {
    userLogger.error(getErrorMessage(e), { user_id: userData?.user_id }, new Error(e as any));
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
};

// ═════════════════════════════════════════════════════════════════════════
// MERCHANT TAX SETTINGS — Session 57
// ═════════════════════════════════════════════════════════════════════════
// GET  /api/user/tax-settings   → current merchant defaults
// PATCH /api/user/tax-settings  → update any subset of the four fields
//   default_apply_tax, default_tax_inclusive, merchant_country_code,
//   merchant_vat_id
// Applied as defaults for new payment links + all store cart checkouts.
// Per-link `apply_tax` / `tax_inclusive` + per-product `apply_tax_override`
// still take precedence.
export const getMerchantTaxSettings = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = (res.locals as any).user;
  try {
    if (!userData?.user_id) {
      return errorResponseHelper(res, 401, "Authentication required.");
    }
    const user: any = await userModel.findByPk(Number(userData.user_id), {
      attributes: [
        "user_id",
        "default_apply_tax",
        "default_tax_inclusive",
        "merchant_country_code",
        "merchant_vat_id",
      ],
    });
    if (!user) return errorResponseHelper(res, 404, "User not found.");
    return successResponseHelper(res, 200, "Tax settings fetched.", {
      default_apply_tax: !!user.dataValues.default_apply_tax,
      default_tax_inclusive: !!user.dataValues.default_tax_inclusive,
      merchant_country_code: user.dataValues.merchant_country_code || null,
      merchant_vat_id: user.dataValues.merchant_vat_id || null,
    });
  } catch (e) {
    userLogger.error(getErrorMessage(e), { user_id: userData?.user_id }, new Error(e as any));
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
};

export const updateMerchantTaxSettings = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = (res.locals as any).user;
  try {
    if (!userData?.user_id) {
      return errorResponseHelper(res, 401, "Authentication required.");
    }
    const body = req.body || {};
    const patch: any = {};
    if (typeof body.default_apply_tax === "boolean") {
      patch.default_apply_tax = body.default_apply_tax;
    }
    if (typeof body.default_tax_inclusive === "boolean") {
      patch.default_tax_inclusive = body.default_tax_inclusive;
    }
    if (typeof body.merchant_country_code === "string") {
      const cc = body.merchant_country_code.trim().toUpperCase();
      if (cc && !/^[A-Z]{2}$/.test(cc)) {
        return errorResponseHelper(res, 400, "merchant_country_code must be a 2-letter ISO code.");
      }
      patch.merchant_country_code = cc || null;
    } else if (body.merchant_country_code === null) {
      patch.merchant_country_code = null;
    }
    if (typeof body.merchant_vat_id === "string") {
      const v = body.merchant_vat_id.trim().slice(0, 32);
      patch.merchant_vat_id = v || null;
    } else if (body.merchant_vat_id === null) {
      patch.merchant_vat_id = null;
    }
    if (Object.keys(patch).length === 0) {
      return errorResponseHelper(res, 400, "No settings provided to update.");
    }
    await userModel.update(patch, { where: { user_id: Number(userData.user_id) } });
    const user: any = await userModel.findByPk(Number(userData.user_id), {
      attributes: [
        "default_apply_tax",
        "default_tax_inclusive",
        "merchant_country_code",
        "merchant_vat_id",
      ],
    });
    return successResponseHelper(res, 200, "Tax settings updated.", {
      default_apply_tax: !!user.dataValues.default_apply_tax,
      default_tax_inclusive: !!user.dataValues.default_tax_inclusive,
      merchant_country_code: user.dataValues.merchant_country_code || null,
      merchant_vat_id: user.dataValues.merchant_vat_id || null,
    });
  } catch (e) {
    userLogger.error(getErrorMessage(e), { user_id: userData?.user_id }, new Error(e as any));
    return errorResponseHelper(res, 500, getErrorMessage(e));
  }
};




