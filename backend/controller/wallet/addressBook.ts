import express from "express";
import jwt from "jsonwebtoken";
import {
  IUserType,
} from "../../utils/types";
import {
  errorResponseHelper,
  successResponseHelper,
  generateWalletName,
} from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { userWalletModel } from "../../models";
import { walletLogger } from "../../utils/loggers";
import {
  userModel,
  userWalletAddressModel,
} from "../../models/userModels";
import WAValidator from "wallet-address-validator";
import { invalidateWalletCache } from "./walletShared";

export const getWalletAddresses = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user_id = userData.user_id;
    const { company_id } = req.query;
    
    // Build where clause with optional company_id filter
    const whereClause: Record<string, unknown> = {
      user_id,
    };
    
    if (company_id) {
      whereClause.company_id = company_id;
    }

    const resData = await userWalletAddressModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });
    const message = resData.length === 0
      ? "No wallet addresses found. Add your first wallet address to start receiving payments."
      : `Successfully retrieved ${resData.length} wallet address${resData.length === 1 ? '' : 'es'}`;
    
    successResponseHelper(res, 200, message, resData);
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export const addWalletAddress = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { wallet_address, currency, label, company_id, wallet_name } = req.body;
    try {
      const user_id = userData.user_id;

      // Wallet operations require a verified email — security OTPs are delivered by email.
      const accountUser = await userModel.findOne({
        where: { user_id },
        attributes: ['email', 'email_verified'],
      });
      if (!accountUser?.dataValues?.email || !accountUser.dataValues.email_verified) {
        return res.status(403).json({
          success: false,
          statusCode: 403,
          code: "EMAIL_VERIFICATION_REQUIRED",
          message: "Please add and verify an email address before adding a payout address.",
        });
      }

      // Local address validation - no external API calls needed
      let isValidAddress = false;
      
      // Map Dynopay currency codes to wallet-address-validator currency codes
      const currencyMap = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'USDT-ERC20': 'ethereum', // ERC20 uses Ethereum address format
        'TRX': 'tron',
        'USDT-TRC20': 'tron', // TRC20 uses Tron address format
        'LTC': 'litecoin',
        'DOGE': 'dogecoin',
        'BSC': 'ethereum', // BSC uses Ethereum address format
        'BCH': 'bitcoincash',
      };

      const validatorCurrency = currencyMap[currency];
      
      if (validatorCurrency) {
        isValidAddress = WAValidator.validate(wallet_address, validatorCurrency);
      } else {
        // If currency not in map, throw error
        throw new Error(`Unsupported currency: ${currency}`);
      }

      if (!isValidAddress) {
        throw new Error('Invalid address format');
      }
      
      // Check if address already exists for this user and company
      const whereClause: Record<string, unknown> = {
        wallet_address,
        currency,
        user_id,
      };
      
      if (company_id) {
        whereClause.company_id = company_id;
      }

      const isExists = await userWalletAddressModel
        .findOne({
          where: whereClause,
        })
        .then((token) => token !== null)
        .then((isExists) => isExists);

      if (isExists) {
        errorResponseHelper(
          res,
          500,
          `This address with ${currency} currency already exists for this company!`
        );
      } else {
        const resData = await userWalletAddressModel.create({
          wallet_address,
          currency,
          label: label ?? currency,
          user_id,
          company_id: company_id || null,
          wallet_name: wallet_name || label || generateWalletName(),
        });
        
        // Also create/update entry in userWalletModel so it appears on dashboard and wallet page
        const existingWallet = await userWalletModel.findOne({
          where: {
            user_id,
            company_id: company_id || null,
            wallet_type: currency,
          },
        });
        
        if (!existingWallet) {
          await userWalletModel.create({
            user_id,
            company_id: company_id || null,
            wallet_name: wallet_name || label || generateWalletName(),
            amount: 0,
            wallet_type: currency,
            wallet_address,
            currency_type: 'CRYPTO',
          });
          walletLogger.info(`[addWalletAddress] Created wallet entry for ${currency} in userWalletModel for user ${user_id}, company ${company_id}`);
        } else {
          // Update the wallet address if wallet entry already exists
          await userWalletModel.update(
            { wallet_address, wallet_name: wallet_name || existingWallet.dataValues.wallet_name },
            { where: { wallet_id: existingWallet.dataValues.wallet_id } }
          );
          walletLogger.info(`[addWalletAddress] Updated wallet entry for ${currency} in userWalletModel for user ${user_id}, company ${company_id}`);
        }
        
        // Invalidate wallet cache so getWallet returns fresh data
        await invalidateWalletCache(userData.user_id);
        
        successResponseHelper(res, 200, "Address added successfully!", resData);
      }
    } catch (e) {
      errorResponseHelper(
        res,
        500,
        `please enter a valid ${currency} address!`
      );
    }
  } catch (e) {

      handleControllerError(res, e, walletLogger, { user_id: userData.user_id, email: userData.email });
  }
};


