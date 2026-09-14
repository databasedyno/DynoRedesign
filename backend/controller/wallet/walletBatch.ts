/**
 * Wallet "Full Package" — bulk add / edit / delete (POST /wallet/batch).
 * Gated by requireWalletSudo (see walletSudo.ts) + company ownership.
 */
import express from "express";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import { IUserType } from "../../utils/types";
import {
  errorResponseHelper,
  successResponseHelper,
  generateWalletName,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { userModel } from "../../models/userModels";
import { userWalletModel, companyModel } from "../../models";
import { tatumClient } from "../../integrations/tatum/TatumClient";
import * as merchantPoolService from "../../services/merchantPoolService";
import { walletLogger } from "../../utils/loggers";
import { invalidateWalletCache } from "./walletShared";
import { ensureLiveApiKey } from "./walletOtp";
import { sendWalletBatchSummaryEmail } from "../../services/emailService";
import { notifyWalletChanges, WalletChange, assertWalletNotFrozen } from "../../services/wallet/walletChangeAlert";

const MAX_BATCH_OPS = 50;

const MERCHANT_POOL_CRYPTO_TYPES = [
  "BTC", "ETH", "LTC", "DOGE", "TRX", "BCH", "USDT-TRC20", "USDT-ERC20",
  "USDC-ERC20", "SOL", "XRP", "RLUSD", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON",
];
const TAG_BASED_CHAINS = ["XRP", "RLUSD"];

/** Strict address-format guard so a typo/invalid string never creates a wallet. */
export function isPlausibleAddress(address: string, currency: string): boolean {
  const a = (address || "").trim();
  const EVM = ["ETH", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "POLYGON", "USDT-POLYGON"];
  const TRON = ["TRX", "USDT-TRC20"];
  const XRPL = ["XRP", "RLUSD"];
  if (EVM.includes(currency)) return /^0x[0-9a-fA-F]{40}$/.test(a);
  if (TRON.includes(currency)) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
  if (XRPL.includes(currency)) return /^r[0-9a-zA-Z]{24,34}$/.test(a);
  if (currency === "BTC") return /^(bc1[0-9a-z]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  if (currency === "LTC") return /^(ltc1[0-9a-z]{20,80}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  if (currency === "DOGE") return /^D[a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(a);
  if (currency === "BCH") return /^((bitcoincash:)?[qp][a-z0-9]{38,50}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  if (currency === "SOL") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  return true; // unknown family — defer entirely to the on-chain check
}

/** Validate an address (format guard + on-chain); throws when invalid. */
async function validateAddressOnChain(wallet_address: string, currency: string) {
  if (!isPlausibleAddress(wallet_address, currency)) {
    throw new Error(`Invalid ${currency} address format`);
  }
  if (currency === "TRX" || currency === "USDT-TRC20") {
    await tatumClient.validateTronAddress(wallet_address);
  } else {
    await tatumClient.getAddressBalance(wallet_address, currency);
  }
}

type BatchOp = {
  action?: string;
  wallet_id?: number | string;
  currency?: string;
  wallet_address?: string;
  wallet_name?: string;
  destination_tag?: string | number | null;
};

type OpResult = {
  index: number;
  action: string;
  currency?: string;
  wallet_id?: number;
  status: "ok" | "error";
  message: string;
};

// ============================================
// POST /wallet/batch — bulk add / edit / delete (sudo-gated, owner-only)
// ============================================
export const batchWalletMutate = async (
  req: express.Request,
  res: express.Response,
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const { company_id } = req.body;

    if (await assertWalletNotFrozen(res, user_id)) return;

    const operations: BatchOp[] = Array.isArray(req.body?.operations)
      ? req.body.operations
      : [];

    if (!company_id) return errorResponseHelper(res, 400, "Company ID is required!");
    if (operations.length === 0)
      return errorResponseHelper(res, 400, "No changes to save.");
    if (operations.length > MAX_BATCH_OPS)
      return errorResponseHelper(res, 400, `Too many changes (max ${MAX_BATCH_OPS}).`);

    const company = await companyModel.findOne({ where: { company_id, user_id } });
    if (!company) {
      return errorResponseHelper(res, 403, "You don't have access to this company!");
    }

    const results: OpResult[] = [];
    const added: string[] = [];
    const updated: string[] = [];
    const removed: string[] = [];
    const changeRecords: WalletChange[] = [];
    const seenAddCurrencies = new Set<string>();

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i] || {};
      const action = String(op.action || "").toLowerCase();
      try {
        if (action === "add") {
          const currency = String(op.currency || "").trim();
          const wallet_address = String(op.wallet_address || "").trim();
          const wallet_name = String(op.wallet_name || "").trim();
          if (!currency || !wallet_address) {
            results.push({ index: i, action, currency, status: "error", message: "Currency and address are required." });
            continue;
          }
          if (seenAddCurrencies.has(currency)) {
            results.push({ index: i, action, currency, status: "error", message: `Duplicate ${currency} in this request.` });
            continue;
          }
          const existing = await userWalletModel.findOne({
            where: { wallet_address: { [Op.not]: null }, wallet_type: currency, user_id, company_id },
          });
          if (existing) {
            results.push({ index: i, action, currency, status: "error", message: `A ${currency} wallet already exists for this brand.` });
            continue;
          }
          try {
            await validateAddressOnChain(wallet_address, currency);
          } catch {
            results.push({ index: i, action, currency, status: "error", message: `Please enter a valid ${currency} address.` });
            continue;
          }
          let slot = await userWalletModel.findOne({
            where: { user_id, wallet_type: currency, company_id: null, wallet_address: null },
          });
          if (!slot) {
            slot = await userWalletModel.create({
              user_id, wallet_type: currency, currency_type: "CRYPTO", amount: 0, wallet_address: null, company_id: null,
            });
          }
          await userWalletModel.update(
            {
              wallet_address,
              company_id,
              wallet_name: wallet_name || generateWalletName(),
              destination_tag:
                TAG_BASED_CHAINS.includes(currency) && op.destination_tag
                  ? Number(op.destination_tag)
                  : null,
            },
            { where: { wallet_id: slot.dataValues.wallet_id } },
          );
          // For pool-backed currencies the deposit pool must initialize for the
          // brand to actually receive payments. If it fails (e.g. a chain that
          // isn't fully provisioned), roll back the payout wallet we just saved
          // and surface a clear error — otherwise the brand looks enabled but
          // silently can't take payments on that network.
          if (MERCHANT_POOL_CRYPTO_TYPES.includes(currency)) {
            try {
              await merchantPoolService.initializeMerchantPool(user_id, currency);
            } catch (pe) {
              walletLogger.error(
                `[walletBatch] pool init FAILED for ${currency} (user ${user_id}): ${(pe as Error).message}`,
              );
              await userWalletModel.update(
                { wallet_address: null, wallet_name: null, company_id: null, destination_tag: null },
                { where: { wallet_id: slot.dataValues.wallet_id } },
              );
              results.push({
                index: i,
                action,
                currency,
                status: "error",
                message: `${currency} couldn't be enabled right now — we couldn't set up a receiving address for this network. Please try again shortly or contact support.`,
              });
              continue;
            }
          }
          seenAddCurrencies.add(currency);
          added.push(currency);
          changeRecords.push({
            wallet_id: slot.dataValues.wallet_id,
            currency,
            action: "add",
            previous_address: null,
            previous_name: null,
            previous_tag: null,
            new_address: wallet_address,
          });
          results.push({ index: i, action, currency, wallet_id: slot.dataValues.wallet_id, status: "ok", message: "Added" });
        } else if (action === "edit") {
          const wallet_id = parseInt(String(op.wallet_id), 10);
          if (Number.isNaN(wallet_id)) {
            results.push({ index: i, action, status: "error", message: "wallet_id is required." });
            continue;
          }
          const w = await userWalletModel.findOne({ where: { wallet_id, user_id, company_id } });
          if (!w) {
            results.push({ index: i, action, wallet_id, status: "error", message: "Wallet not found." });
            continue;
          }
          const currency = w.dataValues.wallet_type;
          const newAddress =
            op.wallet_address !== undefined ? String(op.wallet_address).trim() : undefined;
          const newName =
            op.wallet_name !== undefined ? String(op.wallet_name).trim() : undefined;
          const isAddrChange = newAddress !== undefined && newAddress !== w.dataValues.wallet_address;

          if (isAddrChange) {
            try {
              await validateAddressOnChain(newAddress as string, currency);
            } catch {
              results.push({ index: i, action, wallet_id, currency, status: "error", message: `Please enter a valid ${currency} address.` });
              continue;
            }
          }
          const upd: Record<string, unknown> = {};
          if (isAddrChange) upd.wallet_address = newAddress;
          if (newName !== undefined) upd.wallet_name = newName || null;
          if (TAG_BASED_CHAINS.includes(currency) && op.destination_tag !== undefined) {
            upd.destination_tag = op.destination_tag ? Number(op.destination_tag) : null;
          }
          if (Object.keys(upd).length === 0) {
            results.push({ index: i, action, wallet_id, currency, status: "ok", message: "No changes" });
            continue;
          }
          await userWalletModel.update(upd, { where: { wallet_id, user_id, company_id } });
          updated.push(currency);
          if (isAddrChange) {
            changeRecords.push({
              wallet_id,
              currency,
              action: "edit",
              previous_address: w.dataValues.wallet_address,
              previous_name: w.dataValues.wallet_name,
              previous_tag: w.dataValues.destination_tag != null ? Number(w.dataValues.destination_tag) : null,
              new_address: newAddress as string,
            });
          }
          results.push({ index: i, action, wallet_id, currency, status: "ok", message: "Updated" });
        } else if (action === "delete") {
          const wallet_id = parseInt(String(op.wallet_id), 10);
          if (Number.isNaN(wallet_id)) {
            results.push({ index: i, action, status: "error", message: "wallet_id is required." });
            continue;
          }
          const w = await userWalletModel.findOne({ where: { wallet_id, user_id, company_id } });
          if (!w) {
            results.push({ index: i, action, wallet_id, status: "error", message: "Wallet not found." });
            continue;
          }
          const currency = w.dataValues.wallet_type;
          await userWalletModel.update(
            { wallet_address: null, wallet_name: null, company_id: null },
            { where: { wallet_id, user_id, company_id } },
          );
          removed.push(currency);
          results.push({ index: i, action, wallet_id, currency, status: "ok", message: "Removed" });
        } else {
          results.push({ index: i, action, status: "error", message: "Unknown action." });
        }
      } catch (opErr) {
        walletLogger.error(`[walletBatch] op ${i} failed`, opErr);
        results.push({ index: i, action, status: "error", message: (opErr as Error).message || "Operation failed." });
      }
    }

    await invalidateWalletCache(user_id);

    // Auto-create a LIVE API key when the first wallet is added (mirrors verifyOtp).
    let autoApiKeyCreated = false;
    if (added.length > 0) {
      autoApiKeyCreated = await ensureLiveApiKey(
        company_id,
        user_id,
        userData.email,
        company.dataValues.company_name,
        company.dataValues.email,
      );
    }

    // Notify the merchant. Address adds/changes get the security-grade alert
    // (one-tap "this wasn't me" revert); name/remove-only batches get the
    // lightweight summary. Non-fatal; email suppressed in SAFE MODE.
    try {
      if (added.length || updated.length || removed.length) {
        const acct = await userModel.findOne({
          where: { user_id },
          attributes: ["email", "name", "language"],
        });
        if (acct?.dataValues?.email) {
          if (changeRecords.length > 0) {
            await notifyWalletChanges({
              user_id,
              company_id,
              email: acct.dataValues.email,
              name: acct.dataValues.name,
              companyName: company.dataValues.company_name,
              changes: changeRecords,
              lang: acct.dataValues.language,
            });
          } else {
            await sendWalletBatchSummaryEmail(
              acct.dataValues.email,
              acct.dataValues.name,
              { companyName: company.dataValues.company_name, added, updated, removed },
              acct.dataValues.language,
            );
          }
        }
      }
    } catch (ee) {
      walletLogger.warn(`[walletBatch] summary email skipped: ${(ee as Error).message}`);
    }

    const okCount = results.filter((r) => r.status === "ok").length;
    const errCount = results.length - okCount;
    return successResponseHelper(
      res,
      200,
      `Saved ${okCount} change${okCount === 1 ? "" : "s"}${errCount ? `, ${errCount} failed` : ""}.`,
      {
        results,
        summary: { added: added.length, updated: updated.length, removed: removed.length, failed: errCount },
        auto_api_key_created: autoApiKeyCreated,
      },
    );
  } catch (e) {
    handleControllerError(res, e, walletLogger, {
      user_id: userData?.user_id,
      email: userData?.email,
    });
  }
};
