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
import { tatumClient } from "../../integrations/tatum/TatumClient";
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
import { generateOtpCode } from "../../helper/otpGuard";

export const sendDeletePaymentWalletOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id } = req.body;

    if (!wallet_id) {
      return errorResponseHelper(res, 400, "wallet_id is required!");
    }

    const user_id = userData.user_id;

    // Build where clause with multi-tenant security
    const whereClause: Record<string, unknown> = {
      user_id,
      wallet_id: parseInt(wallet_id),
    };

    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Verify wallet exists and belongs to user
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet || !wallet.dataValues.wallet_address) {
      return errorResponseHelper(
        res,
        404,
        "Wallet address not found or you don't have permission to delete it"
      );
    }

    // Generate and send OTP
    const randomNumberOTP = generateOtpCode();
    
    await userModel.update(
      {
        verified_otp: randomNumberOTP.toString(),
        otp_expired: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        otp_currency: wallet.dataValues.wallet_type, // Store currency for validation
      },
      {
        where: { user_id },
      }
    );

    // Send OTP email
    const maskDelAddr = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : 'N/A';
    await sendWalletDeleteOTPEmail(
      userData.email,
      userData.name,
      String(randomNumberOTP),
      maskDelAddr(wallet.dataValues.wallet_address),
      wallet.dataValues.wallet_type
    );

    walletLogger.info(
      `Delete wallet OTP sent`,
      { user_id, wallet_id, email: userData.email }
    );

    return successResponseHelper(res, 200, "OTP sent to your email", {
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      wallet_address: wallet.dataValues.wallet_address,
      email: userData.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      warning: "This action is permanent and cannot be undone",
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// DELETE WALLET WITH OTP - Step 2: Verify and Delete (For Payment Forwarding Wallets)
// ============================================
export const deletePaymentWalletWithOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id, otp } = req.body;

    if (!wallet_id || !otp) {
      return errorResponseHelper(res, 400, "wallet_id and otp are required!");
    }

    const user_id = userData.user_id;

    // Verify OTP - ensure string comparison
    const otpString = String(otp).trim();
    
    const user = await userModel.findOne({
      where: { user_id, verified_otp: otpString },
    });

    if (!user) {
      walletLogger.warn(`Invalid OTP attempt`, { user_id, otp_provided: otpString });
      return errorResponseHelper(res, 400, "Invalid OTP!");
    }

    // Check OTP expiry
    if (new Date() > user.dataValues.otp_expired) {
      return errorResponseHelper(res, 400, "OTP has expired! Please request a new one.");
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {
      user_id,
      wallet_id: parseInt(wallet_id),
    };

    if (company_id) {
      whereClause.company_id = company_id;
    }

    // Get wallet before deleting
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet) {
      return errorResponseHelper(
        res,
        404,
        "Wallet not found or you don't have permission to delete it"
      );
    }

    // Validate OTP currency matches
    if (user.dataValues.otp_currency && user.dataValues.otp_currency !== wallet.dataValues.wallet_type) {
      return errorResponseHelper(
        res,
        400,
        `OTP was issued for ${user.dataValues.otp_currency} wallet, but you're trying to delete ${wallet.dataValues.wallet_type} wallet!`
      );
    }

    // Soft delete: Clear wallet address
    await userWalletModel.update(
      {
        wallet_address: null,
        wallet_name: null,
        company_id: null,
      },
      {
        where: whereClause,
      }
    );

    // Clear OTP
    await userModel.update(
      {
        verified_otp: null,
        otp_expired: null,
        otp_currency: null,
      },
      {
        where: { user_id },
      }
    );

    walletLogger.info(
      `Wallet deleted successfully`,
      { user_id, wallet_id, company_id }
    );

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    // Send confirmation email
    const companyData = await companyModel.findOne({
      where: { company_id }
    });
    
    const companyName = companyData?.dataValues.company_name || "Your Company";
    const maskAddress = (addr: string) => `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
    
    await sendWalletDeletedEmail(
      userData.email,
      userData.name,
      maskAddress(wallet.dataValues.wallet_address),
      wallet.dataValues.wallet_type,
      new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    );

    return successResponseHelper(res, 200, "Wallet address removed successfully!", {
      removed: true,
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      company_id: wallet.dataValues.company_id,
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Edit wallet address with OTP verification
 * PUT /api/wallet/address/:id
 */
export const editWalletAddress = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { id } = req.params;
    const { wallet_address, wallet_name, otp } = req.body;
    const user_id = userData.user_id;

    // BUG FIX (2026-08-27): the `:id` sent by the frontend (wallet list `id`) is a
    // tbl_user_wallet.wallet_id — the SAME key every other wallet mutation uses
    // (delete / delete-OTP / update-OTP). This handler previously looked the id up
    // in the *unrelated* tbl_user_addresses table by user_address_id, so a plain
    // "edit → Save with no changes" returned "Wallet address not found" (and, when
    // an id happened to collide with an address-book row, it edited the WRONG
    // currency). We now operate on tbl_user_wallet by wallet_id, so a no-op save
    // succeeds and updates always target the correct wallet.
    const walletId = parseInt(String(id), 10);
    if (Number.isNaN(walletId)) {
      return errorResponseHelper(res, 400, "Invalid wallet id");
    }

    if (wallet_address === undefined && wallet_name === undefined) {
      return errorResponseHelper(res, 400, "wallet_address or wallet_name is required");
    }

    // Verify the wallet belongs to the user (source of truth = tbl_user_wallet)
    const existingWallet = await userWalletModel.findOne({
      where: { wallet_id: walletId, user_id },
    });

    if (!existingWallet) {
      return errorResponseHelper(res, 404, "Wallet not found");
    }

    const currency = existingWallet.dataValues.wallet_type;
    const oldAddress = existingWallet.dataValues.wallet_address;

    // Only an actual address CHANGE requires OTP + on-chain validation.
    // A name-only update (or a no-op save) needs neither.
    const isAddressChange = !!wallet_address && wallet_address !== oldAddress;

    if (isAddressChange) {
      if (!otp) {
        return errorResponseHelper(res, 400, "OTP is required to update wallet address. Request OTP first.");
      }

      // Verify OTP from Redis
      const storedOTPData = await getRedisItem(`wallet_edit_otp_${id}`);

      if (!storedOTPData || Object.keys(storedOTPData).length === 0) {
        return errorResponseHelper(res, 400, "OTP expired or not found. Please request a new one.");
      }

      const otpData = storedOTPData as { otp: string; user_id: string; expiry: string };

      if (otpData.otp !== otp) {
        return errorResponseHelper(res, 400, "Invalid OTP");
      }

      if (otpData.user_id !== user_id.toString()) {
        return errorResponseHelper(res, 403, "Unauthorized");
      }

      if (new Date(otpData.expiry) < new Date()) {
        await deleteRedisItem(`wallet_edit_otp_${id}`);
        return errorResponseHelper(res, 400, "OTP expired. Please request a new one.");
      }

      // Validate the new address on-chain
      try {
        if (currency === "TRX" || currency === "USDT-TRC20") {
          await tatumClient.validateTronAddress(wallet_address);
        } else {
          await tatumClient.getAddressBalance(wallet_address, currency);
        }
      } catch (e) {
        return errorResponseHelper(res, 400, `Invalid ${currency} address`);
      }

      // Delete OTP from Redis after successful validation
      await deleteRedisItem(`wallet_edit_otp_${id}`);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (wallet_address) updateData.wallet_address = wallet_address;
    if (wallet_name !== undefined) updateData.wallet_name = wallet_name;

    // Update the merchant wallet (tbl_user_wallet) — what the /wallet page reads.
    await userWalletModel.update(updateData, {
      where: { wallet_id: walletId, user_id },
    });

    // Best-effort: keep the legacy address book (tbl_user_addresses) in sync IF a
    // matching row exists. Never fail the request when it doesn't.
    try {
      const addrWhere: Record<string, unknown> = {
        user_id,
        currency,
        wallet_address: oldAddress,
      };
      if (existingWallet.dataValues.company_id) {
        addrWhere.company_id = existingWallet.dataValues.company_id;
      }
      const addrUpdate: Record<string, unknown> = {};
      if (wallet_address) addrUpdate.wallet_address = wallet_address;
      if (wallet_name !== undefined) addrUpdate.wallet_name = wallet_name;
      if (Object.keys(addrUpdate).length > 0) {
        await userWalletAddressModel.update(addrUpdate, { where: addrWhere });
      }
    } catch (syncErr) {
      walletLogger.warn(`[editWalletAddress] address-book sync skipped: ${(syncErr as Error).message}`);
    }

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    // Fetch updated record
    const updatedWallet = await userWalletModel.findOne({
      where: { wallet_id: walletId, user_id },
    });

    const updateType = isAddressChange ? "address and name" : "name";
    walletLogger.info(`Wallet ${updateType} for wallet_id ${walletId} edited by user ${user_id}`);

    return successResponseHelper(res, 200, "Wallet updated successfully", updatedWallet);

  } catch (e) {


      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * Get transaction details by ID
 * GET /api/wallet/transaction/:id
 */
/**
 * GET /api/wallet/transaction/:id
 * Get detailed transaction information - scoped by company
 */

