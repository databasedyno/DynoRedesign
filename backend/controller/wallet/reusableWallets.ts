import { ensureLiveApiKey } from "./walletOtp";
import express from "express";
import jwt from "jsonwebtoken";
import {
  FW_API_Response,
  IFundData,
  IUserType,
  IVerifyResponse,
} from "../../utils/types";
import sequelize from "../../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import {
  decrypt,
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  successResponseHelper,
  generateWalletName,
  generateApiKeyName,
} from "../../helper";
import {
  sendWithdrawalOTPEmail,
  sendWithdrawalSuccessEmail,
  sendExchangeOTPEmail,
  sendWalletAddedEmail,
  sendWalletUpdatedEmail,
  sendWalletUpdateOTPEmail,
  sendWalletDeletedEmail,
  sendWalletDeleteOTPEmail,
} from "../../services/emailService";
import { handleControllerError, handleControllerErrorReturn, asyncController } from "../../helper/controllerErrorHandler";
import { parseSortAndPagination } from "../../helper/queryHelpers";
import { incrementAdminFee, incrementUserWallet } from "../../helper/walletHelpers";
import { formatAmountForDisplay, getCurrencyInfo, COMPANY_CURRENCY_QUERY, convertToUSD, convertToFiat, convertToMultiple, getUserDisplayCurrency } from "../../utils/currencyUtils";
import { resolveTransactionSource } from "../../utils/transactionSource";
import { deriveTxDisplayStatus } from "../../utils/transactionDisplayStatus";
import { PROCESSED_USD_EXPR, PROCESSED_STATUS_SQL } from "../../utils/processedVolume";
import crypto from "crypto";
import flw from "../../apis/flutterwaveApi";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
  setRedisTTL,
  redis,
} from "../../utils/redisInstance";
import { paymentTypes } from "../../utils/enums";
import axios from "axios";
import QR_Code from "qrcode";
import { generateQRCodeWithLogo } from "../../utils/qrCodeWithLogo";
import { adminWalletModel, userWalletModel, companyModel } from "../../models";
import { apiModel, customerModel, customerWalletModel } from "../../models";
import { validateCompanyOwnership } from "../../utils/validateCompanyOwnership";
import { walletLogger } from "../../utils/loggers";
import {
  selfTransactionModel,
  userExchangeModel,
  userModel,
  userTransactionModel,
  userWalletAddressModel,
  userTempAddressModel,
} from "../../models/userModels";
import tatumApi from "../../apis/tatumApi";
import blockchairApi from "../../apis/blockchairApi";
import { getTransactionFee, getBlockchainFee } from "../../services/feeService";
import mailTransporter from "../../utils/mailTransporter";
import { getAdminWalletAddress } from "../../utils/adminUtils";
import WAValidator from "wallet-address-validator";
import * as merchantPoolService from "../../services/merchantPoolService";
import { PaymentState, parseState, toRedisStatus } from "../../services/paymentStateMachine";
import {
  getBlockchainNetworkFee,
  getAllBlockchainFees,
  calculateCustomerPaymentAmount
} from "../../services/blockchainFeeService";
import { escapeHtml, buildTransactionFilters, invalidateWalletCache } from "./walletShared";

export const getReusableWallets = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const excludeCompanyId = req.query.exclude_company_id;

    // tbl_user_wallet (userWalletModel) is the authoritative, displayed set of
    // a merchant's configured wallets per company. (tbl_user_addresses is a
    // secondary address book that isn't always populated for older accounts.)
    const wallets = await userWalletModel.findAll({
      where: { user_id },
      order: [["company_id", "ASC"]],
    });

    const companies = await companyModel.findAll({
      where: { user_id },
      attributes: ["company_id", "company_name"],
    });
    const nameMap = new Map<number, string>();
    companies.forEach((c: { dataValues: { company_id: number; company_name: string } }) =>
      nameMap.set(Number(c.dataValues.company_id), c.dataValues.company_name)
    );

    // Currencies the TARGET (current) company ALREADY has. These must NOT be
    // offered for reuse: the copy action skips any currency the target already
    // holds, so surfacing them only produces a confusing "0 copied / already
    // exists" no-op (this is exactly the bug a merchant hit after copying one
    // company's wallets into another and then re-opening Add-Wallet on the
    // original). Reuse should ONLY show wallets the current company is missing.
    const targetCurrencies = new Set<string>();
    if (excludeCompanyId) {
      for (const w of wallets) {
        if (String(w.dataValues.company_id) === String(excludeCompanyId)) {
          targetCurrencies.add(w.dataValues.wallet_type);
        }
      }
    }

    // Group wallets by company, skipping: the excluded (target) company, any
    // currency the target already has, and duplicate currencies within a single
    // company (a company can hold several rows of the same coin).
    const grouped = new Map<number, Array<Record<string, unknown>>>();
    const seenPerCompany = new Map<number, Set<string>>();
    for (const w of wallets) {
      const cid = w.dataValues.company_id;
      if (cid === null || cid === undefined) continue;
      if (excludeCompanyId && String(cid) === String(excludeCompanyId)) continue;
      const currency = w.dataValues.wallet_type as string;
      if (targetCurrencies.has(currency)) continue; // current company already has it
      if (!seenPerCompany.has(cid)) seenPerCompany.set(cid, new Set());
      if (seenPerCompany.get(cid)!.has(currency)) continue; // dedupe within company
      seenPerCompany.get(cid)!.add(currency);
      if (!grouped.has(cid)) grouped.set(cid, []);
      const addr: string = w.dataValues.wallet_address || "";
      grouped.get(cid)!.push({
        currency,
        label: w.dataValues.wallet_name,
        wallet_name: w.dataValues.wallet_name,
        wallet_address_preview: addr.length >= 4 ? `****${addr.slice(-4)}` : addr,
      });
    }

    const result = Array.from(grouped.entries()).map(([cid, list]) => ({
      company_id: cid,
      company_name: nameMap.get(Number(cid)) || `Company #${cid}`,
      wallet_count: list.length,
      wallets: list,
    }));

    const message =
      result.length === 0
        ? "No new wallets from your other companies to reuse."
        : `Found ${result.length} compan${result.length === 1 ? "y" : "ies"} with reusable wallets`;
    successResponseHelper(res, 200, message, result);
  } catch (e) {
    handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * POST /api/wallet/copyWalletAddresses
 * Body: { source_company_id, target_company_id, currencies?: string[] }
 * Copies the source company's saved wallet addresses to the target company as
 * INDEPENDENT copies (same address, fresh balance/stats). Idempotent: skips any
 * currency the target company already has. No OTP — the merchant is reusing
 * their own, already-saved addresses.
 */
export const copyWalletAddresses = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const { source_company_id, target_company_id, currencies } = req.body;

    if (!source_company_id || !target_company_id) {
      return errorResponseHelper(res, 400, "source_company_id and target_company_id are required.");
    }
    if (String(source_company_id) === String(target_company_id)) {
      return errorResponseHelper(res, 400, "Source and target company must be different.");
    }

    // Ownership checks for BOTH companies (each sends its own 403 on failure).
    const sourceCompany = await validateCompanyOwnership(res, source_company_id, user_id);
    if (!sourceCompany) return;
    const targetCompany = await validateCompanyOwnership(res, target_company_id, user_id);
    if (!targetCompany) return;

    const sourceWallets = await userWalletModel.findAll({
      where: { user_id, company_id: source_company_id },
    });
    if (sourceWallets.length === 0) {
      return errorResponseHelper(res, 404, "The selected company has no saved wallets to copy.");
    }

    const wanted: string[] | null =
      Array.isArray(currencies) && currencies.length > 0 ? currencies.map((c: string) => String(c)) : null;

    const existingTarget = await userWalletModel.findAll({
      where: { user_id, company_id: target_company_id },
      attributes: ["wallet_type"],
    });
    const existingCurrencies = new Set(
      existingTarget.map((w: { dataValues: { wallet_type: string } }) => w.dataValues.wallet_type)
    );

    const copied: Array<{ currency: string; wallet_address_preview: string }> = [];
    const skipped: Array<{ currency: string; reason: string }> = [];

    for (const w of sourceWallets) {
      const currency = w.dataValues.wallet_type;
      const wallet_address = w.dataValues.wallet_address;
      const currency_type = w.dataValues.currency_type || "CRYPTO";
      const wallet_name = w.dataValues.wallet_name;
      const label = wallet_name;

      if (wanted && !wanted.includes(currency)) continue;
      if (existingCurrencies.has(currency)) {
        skipped.push({ currency, reason: "already exists on target company" });
        continue;
      }

      // Primary record: userWalletModel (dashboard/wallet page) with fresh balance.
      await userWalletModel.create({
        user_id,
        company_id: target_company_id,
        wallet_name: wallet_name || generateWalletName(),
        amount: 0,
        wallet_type: currency,
        wallet_address,
        currency_type,
      });

      // Secondary record: address book (kept consistent with addWalletAddress).
      try {
        await userWalletAddressModel.create({
          wallet_address,
          currency,
          label: label ?? currency,
          user_id,
          company_id: target_company_id,
          wallet_name: wallet_name || generateWalletName(),
        });
      } catch (addrErr) {
        walletLogger.warn(
          `[copyWalletAddresses] address-book mirror failed for ${currency} (non-fatal): ${(addrErr as Error).message}`
        );
      }

      const addr = wallet_address || "";
      copied.push({ currency, wallet_address_preview: addr.length >= 4 ? `****${addr.slice(-4)}` : addr });
      existingCurrencies.add(currency); // guard against duplicate source rows
    }

    await invalidateWalletCache(user_id);

    walletLogger.info(
      `[copyWalletAddresses] Copied ${copied.length} wallet(s) from company ${source_company_id} -> ${target_company_id} for user ${user_id} (skipped ${skipped.length})`
    );

    // AUTO-CREATE LIVE API KEY on the target company if it now has ≥1 wallet
    // (freshly copied OR pre-existing) and doesn't yet have an active production key.
    // Non-fatal + idempotent (helper wraps its own try/catch and guards on env='production').
    let auto_live_key_created = false;
    if (copied.length > 0 || existingCurrencies.size > 0) {
      const targetName = (targetCompany as { company_name?: string; email?: string }).company_name;
      const targetEmail = (targetCompany as { company_name?: string; email?: string }).email;
      auto_live_key_created = await ensureLiveApiKey(
        Number(target_company_id),
        Number(user_id),
        userData.email,
        targetName,
        targetEmail,
      );
    }

    const srcName = (sourceCompany as { company_name?: string }).company_name || `Company #${source_company_id}`;
    const message =
      copied.length === 0
        ? "No wallets copied — all selected currencies already exist on this company."
        : `${copied.length} wallet${copied.length === 1 ? "" : "s"} copied from ${srcName}.`;

    successResponseHelper(res, 200, message, {
      copied,
      skipped,
      source_company_name: srcName,
      auto_live_key_created,
    });
  } catch (e) {
    handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};



