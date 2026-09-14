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
import { notifyWalletChanges, assertWalletNotFrozen } from "../../services/wallet/walletChangeAlert";
import { generateOtpCode } from "../../helper/otpGuard";

export const deleteWalletAddress = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    // Support wallet_id from URL params (DELETE /wallet/:wallet_id) or body (POST /wallet/delete)
    const wallet_id_param = req.params.wallet_id;
    const { currency, company_id, wallet_id: wallet_id_body } = req.body;
    
    const wallet_id = wallet_id_param || wallet_id_body;
    
    // Support both wallet_id (preferred) and currency (legacy) methods
    if (!wallet_id && (!currency || typeof currency !== "string")) {
      return errorResponseHelper(res, 400, "Either wallet_id or currency is required!");
    }

    const user_id = userData.user_id;

    // Build where clause for deletion
    const whereClause: Record<string, unknown> = {
      user_id,
    };

    // Preferred method: Use wallet_id for precise deletion
    if (wallet_id) {
      whereClause.wallet_id = parseInt(wallet_id);
      
      // Add company_id for multi-tenant security
      if (company_id) {
        whereClause.company_id = company_id;
      }
    } 
    // Legacy method: Use currency (only works when one wallet per blockchain)
    else {
      whereClause.wallet_type = currency;
      
      // Add company_id if provided for multi-tenant security
      if (company_id) {
        whereClause.company_id = company_id;
      }
    }

    // First verify the wallet exists and belongs to the user
    const wallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!wallet) {
      return errorResponseHelper(
        res, 
        404, 
        "Wallet address not found or you don't have permission to delete it"
      );
    }

    // Store wallet info for notification before clearing
    const deletedWalletAddress = wallet.dataValues.wallet_address;
    const deletedWalletType = wallet.dataValues.wallet_type;

    // Clear the wallet address (set to null) instead of deleting the record
    // This preserves the wallet structure for future use
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

    // Send wallet deleted notification email
    if (deletedWalletAddress) {
      try {
        const { sendWalletDeletedEmail } = await import("../../services/emailService");
        const now = new Date();
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const maskedAddress = deletedWalletAddress.substring(0, 8) + '...' + deletedWalletAddress.slice(-6);
        await sendWalletDeletedEmail(
          userData.email,
          userData.name || 'User',
          maskedAddress,
          deletedWalletType,
          date,
          time
        );
        walletLogger.info(`[Wallet] Deletion notification sent to ${userData.email} for ${deletedWalletType}`);
      } catch (emailError) {
        walletLogger.error("[Wallet] Failed to send deletion notification:", emailError);
      }
    }

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

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

// ============================================
// UPDATE WALLET WITH OTP - Step 1: Send OTP
// ============================================
export const sendUpdateWalletOTP = async (
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

    if (await assertWalletNotFrozen(res, user_id)) return;

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
        "Wallet address not found or you don't have permission to update it"
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
    const maskWalletAddr = (a: string) => a ? `${a.substring(0, 8)}...${a.substring(a.length - 6)}` : 'N/A';
    await sendWalletUpdateOTPEmail(
      userData.email,
      userData.name,
      String(randomNumberOTP),
      maskWalletAddr(wallet.dataValues.wallet_address),
      "Pending update",
      wallet.dataValues.wallet_type
    );

    walletLogger.info(
      `Update wallet OTP sent`,
      { user_id, wallet_id, email: userData.email }
    );

    return successResponseHelper(res, 200, "OTP sent to your email", {
      wallet_id: wallet.dataValues.wallet_id,
      wallet_type: wallet.dataValues.wallet_type,
      current_address: wallet.dataValues.wallet_address,
      email: userData.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// UPDATE WALLET WITH OTP - Step 2: Verify and Update
// ============================================
export const updateWalletWithOTP = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_id, company_id, otp, wallet_address, wallet_name, currency, destination_tag } = req.body;

    if (!wallet_id || !otp) {
      return errorResponseHelper(res, 400, "wallet_id and otp are required!");
    }

    if (!wallet_address && !wallet_name) {
      return errorResponseHelper(res, 400, "Provide wallet_address or wallet_name to update!");
    }

    const user_id = userData.user_id;

    if (await assertWalletNotFrozen(res, user_id)) return;

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

    // Get existing wallet
    const existingWallet = await userWalletModel.findOne({
      where: whereClause,
    });

    if (!existingWallet) {
      return errorResponseHelper(
        res,
        404,
        "Wallet not found or you don't have permission to update it"
      );
    }

    // Snapshot previous state for the change-alert / revert flow.
    const prevAddress = existingWallet.dataValues.wallet_address;
    const prevName = existingWallet.dataValues.wallet_name;
    const prevTag = existingWallet.dataValues.destination_tag != null
      ? Number(existingWallet.dataValues.destination_tag)
      : null;

    // If updating wallet address, validate it
    if (wallet_address) {
      const currencyToValidate = currency || existingWallet.dataValues.wallet_type;

      // Validate OTP currency matches if changing address
      if (user.dataValues.otp_currency && user.dataValues.otp_currency !== currencyToValidate) {
        return errorResponseHelper(
          res,
          400,
          `OTP was issued for ${user.dataValues.otp_currency} wallet, but you're trying to update ${currencyToValidate} wallet!`
        );
      }

      // Validate address format
      let balance;
      if (currencyToValidate === "TRX" || currencyToValidate === "USDT-TRC20") {
        balance = await tatumClient.validateTronAddress(wallet_address);
      } else {
        balance = await tatumClient.getAddressBalance(wallet_address, currencyToValidate);
      }

      if (!balance || balance.error) {
        return errorResponseHelper(res, 400, "Invalid wallet address for this blockchain!");
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (wallet_address) updateData.wallet_address = wallet_address;
    if (wallet_name) updateData.wallet_name = wallet_name;
    if (currency) updateData.wallet_type = currency;
    // Allow setting destination_tag (can be set to null to remove it)
    if (destination_tag !== undefined) {
      updateData.destination_tag = destination_tag ? Number(destination_tag) : null;
    }

    // Update wallet
    await userWalletModel.update(updateData, {
      where: whereClause,
    });

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
      `Wallet updated successfully`,
      { user_id, wallet_id, company_id }
    );

    // Invalidate wallet cache so getWallet returns fresh data
    await invalidateWalletCache(userData.user_id);

    // Get updated wallet
    const updatedWallet = await userWalletModel.findOne({
      where: whereClause,
    });

    // Send confirmation email
    const companyData = await companyModel.findOne({
      where: { company_id }
    });
    
    const companyName = companyData?.dataValues.company_name || "Your Company";
    const maskAddress = (addr: string) => addr ? `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}` : 'N/A';

    const newAddress = updatedWallet.dataValues.wallet_address;
    const addressChanged = !!wallet_address && newAddress !== prevAddress;

    if (addressChanged) {
      // Payout address changed — send the security-grade alert with the one-tap
      // "this wasn't me" revert link + drop an in-app notice.
      await notifyWalletChanges({
        user_id,
        company_id,
        email: userData.email,
        name: userData.name,
        companyName,
        changes: [
          {
            wallet_id: updatedWallet.dataValues.wallet_id,
            currency: updatedWallet.dataValues.wallet_type,
            action: "edit",
            previous_address: prevAddress,
            previous_name: prevName,
            previous_tag: prevTag,
            new_address: newAddress,
          },
        ],
      });
    } else {
      // Name/tag-only edit — keep the lightweight confirmation email.
      await sendWalletUpdatedEmail(
        userData.email,
        userData.name,
        maskAddress(newAddress),
        updatedWallet.dataValues.wallet_type,
        companyName,
        updatedWallet.dataValues.wallet_name || undefined
      );
    }

    return successResponseHelper(res, 200, "Wallet address updated successfully!", {
      wallet_id: updatedWallet.dataValues.wallet_id,
      wallet_type: updatedWallet.dataValues.wallet_type,
      wallet_address: updatedWallet.dataValues.wallet_address,
      wallet_name: updatedWallet.dataValues.wallet_name,
      company_id: updatedWallet.dataValues.company_id,
      destination_tag: updatedWallet.dataValues.destination_tag || null,
    });
  } catch (e) {

      return handleControllerErrorReturn(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

// ============================================
// DELETE WALLET WITH OTP - Step 1: Send OTP (For Payment Forwarding Wallets)
// ============================================

