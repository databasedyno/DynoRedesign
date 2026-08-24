import { raw as envRaw } from "../utils/config";
import express from "express";
import {
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  successResponseHelper,
} from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { convertToMultiple, convertToUSD, convertToFiat } from "../utils/currencyUtils";
import { adminLogger } from "../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "../utils/redisInstance";
import jwt from "jsonwebtoken";
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  feesModel,
} from "../models";
import tatumApi from "../apis/tatumApi";
import { getAdminWalletAddress } from "../utils/adminUtils";
import sequelize from "../utils/dbInstance";
import { IAdminWallet } from "../utils/types";
import { QueryTypes } from "sequelize";
import sha256 from "crypto-js/sha256";
import bcrypt from "bcryptjs";
import {
  selfTransactionModel,
  userModel,
  userTransactionModel,
} from "../models/userModels";
import { adminUnlockAccount } from "../services/accountLockoutService";

const BCRYPT_ROUNDS = 12;
import crypto from "crypto";

const getTransactionFee = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    const { fee } = await (
      await feesModel.findOne({
        where: {
          feeType: "TRANSACTION_FEE",
        },
      })
    ).dataValues;

    const blockchainData = await feesModel.findOne({
      where: {
        feeType: "BLOCKCHAIN_FEE",
      },
    });

    const transaction_fee = fee;
    const blockchain_fee = blockchainData.dataValues.fee;
    // Fix: Combine both fees in single Redis call to prevent overwrite
    await setRedisItem("admin_fee", { transaction_fee, blockchain_fee });

    successResponseHelper(res, 200, "", {
      transaction_fee,
      blockchain_fee,
    });
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const newTransactionFee = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { fee, blockchainFeeInput } = req.body;
    await feesModel.update(
      {
        fee: fee ?? 0,
      },
      {
        where: {
          feeType: "TRANSACTION_FEE",
        },
      }
    );

    await feesModel.update(
      {
        fee: blockchainFeeInput ?? 0,
      },
      {
        where: {
          feeType: "BLOCKCHAIN_FEE",
        },
      }
    );
    const transaction_fee = fee;
    const blockchain_fee = blockchainFeeInput ?? 0;
    // Fix: Combine both fees in single Redis call to prevent overwrite
    await setRedisItem("admin_fee", { transaction_fee, blockchain_fee });
    successResponseHelper(res, 200, "Admin fees retrieved successfully", { transaction_fee, blockchain_fee });
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const getWallets = async (_req: express.Request, res: express.Response) => {
  try {
    const walletData = await adminWalletModel.findAll({
      attributes: {
        exclude: ["privateKey", "mnemonic", "xpub", "wallet_account_id"],
      },
    });
    const currencyList = [];

    const allUserWalletData = await sequelize.query<{ total_balance: number; wallet_type: string }>(
      "select sum(amount) as total_balance,wallet_type from tbl_user_wallet group by wallet_type",
      { type: QueryTypes.SELECT }
    );

    for (let i = 0; i < walletData.length; i++) {
      currencyList.push(walletData[i].dataValues.wallet_type);
    }

    const currencyData = await convertToMultiple("USD", currencyList, 1, false);

    const returnData = [];

    for (let i = 0; i < currencyData.length; i++) {
      const currentIndex = walletData.findIndex(
        (x) => x.dataValues.wallet_type === currencyData[i].currency
      );
      const userIndex = allUserWalletData.findIndex(
        (x) => x.wallet_type === currencyData[i].currency
      );
      adminLogger.info(currentIndex);
      const currentWallet = walletData[currentIndex].dataValues;
      const userWallet = allUserWalletData[userIndex];

      const finalAmount = Number(
        userWallet.total_balance / currencyData[i].transferRate
      );
      const feeAmount = Number(
        currentWallet.fee / currencyData[i].transferRate
      );
      const amount_in_usd = Number(finalAmount).toFixed(2);
      const fee_in_usd = Number(feeAmount).toFixed(2);
      returnData.push({
        ...currentWallet,
        amount: userWallet.total_balance,
        amount_in_usd,
        fee_in_usd,
        transfer_rate: currencyData[i].transferRate,
      });
    }
    const fiatWallets = returnData.filter((x) => x.currency_type === "FIAT");
    const cryptoWallets = returnData.filter(
      (x) => x.currency_type === "CRYPTO"
    );
    const totalWallets = (fiatWallets?.length || 0) + (cryptoWallets?.length || 0);
    const message = totalWallets === 0
      ? "No wallets found in the system"
      : `Successfully retrieved ${totalWallets} wallet${totalWallets === 1 ? '' : 's'} (${fiatWallets.length} fiat, ${cryptoWallets.length} crypto)`;
    
    successResponseHelper(res, 200, message, { fiatWallets, cryptoWallets });
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const createWallets = async (_req: express.Request, res: express.Response) => {
  const transaction = await sequelize.transaction();
  try {
    const count = (await adminWalletModel.findAndCountAll()).count;
    if (count === 0) {
      const fiatData = ["EUR", "GBP", "NGN", "KES", "UGX", "GHS", "RWF", "USD"];
      const cryptoData = ["BTC", "ETH", "TRX", "BSC", "LTC", "DOGE", "BCH", "SOL", "XRP", "POLYGON"];

      for (let i = 0; i < fiatData.length; i++) {
        await adminWalletModel.create(
          {
            wallet_type: fiatData[i],
            currency_type: "FIAT",
          },
          { transaction }
        );
      }

      for (let i = 0; i < cryptoData.length; i++) {
        const wallet = await tatumApi.generateWallet(cryptoData[i]);

        await adminWalletModel.create(
          {
            wallet_type: cryptoData[i],
            wallet_address: wallet.address,
            wallet_account_id: null,
            currency_type: "CRYPTO",
            xpub: wallet.xpub,
            mnemonic: wallet.mnemonic,
            privateKey: wallet.privateKey,
            customer_id: null,
          },
          { transaction }
        );
        if (cryptoData[i] === "ETH") {
          await adminWalletModel.create(
            {
              wallet_type: "USDT-ERC20",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
        if (cryptoData[i] === "TRX") {
          await adminWalletModel.create(
            {
              wallet_type: "USDT-TRC20",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
        // XRP wallet also hosts RLUSD token
        if (cryptoData[i] === "XRP") {
          await adminWalletModel.create(
            {
              wallet_type: "RLUSD",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
        // Polygon wallet also hosts USDT-POLYGON token
        if (cryptoData[i] === "POLYGON") {
          await adminWalletModel.create(
            {
              wallet_type: "USDT-POLYGON",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
        // ETH wallet also hosts RLUSD-ERC20 token
        if (cryptoData[i] === "ETH") {
          await adminWalletModel.create(
            {
              wallet_type: "RLUSD-ERC20",
              wallet_address: wallet.address,
              wallet_account_id: null,
              currency_type: "CRYPTO",
              xpub: wallet.xpub,
              mnemonic: wallet.mnemonic,
              privateKey: wallet.privateKey,
              customer_id: null,
            },
            { transaction }
          );
        }
      }
      transaction.commit();
    } else {
      transaction.rollback();
      throw { message: "Wallets already exists" };
    }
    successResponseHelper(res, 200, "Wallets generated!");
  } catch (e) {
    transaction.rollback();
    const message = getErrorMessage(e);
    adminLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    
    // Use parameterized query to prevent SQL injection — fetch admin by email only
    const data = await sequelize.query<{ email: string; password: string }>(
      `SELECT * FROM tbl_admin WHERE email = :email`,
      { 
        replacements: { email },
        type: QueryTypes.SELECT 
      }
    );

    if (data.length === 0) {
      throw { message: "Invalid username or password!" };
    }

    const admin = data[0];
    const storedHash = admin.password;

    // Check if stored hash is bcrypt format ($2a$, $2b$, $2y$)
    const isBcryptHash = /^\$2[aby]?\$/.test(storedHash);
    let passwordValid = false;

    if (isBcryptHash) {
      passwordValid = bcrypt.compareSync(password, storedHash);
    } else {
      // Legacy SHA-256 comparison
      const sha256Hash = sha256(password).toString();
      if (sha256Hash === storedHash) {
        passwordValid = true;
        // Transparent migration: rehash with bcrypt and update DB
        try {
          const bcryptHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
          await sequelize.query(
            `UPDATE tbl_admin SET password = :newPassword WHERE email = :email`,
            { replacements: { newPassword: bcryptHash, email: admin.email }, type: QueryTypes.UPDATE }
          );
          adminLogger.info(`[PasswordMigration] Admin ${admin.email} migrated from SHA-256 to bcrypt`);
        } catch (migErr) {
          adminLogger.error(`[PasswordMigration] Failed to migrate admin ${admin.email}:`, migErr);
        }
      }
    }

    if (passwordValid) {
      const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
      const userData = {
        email,
        role: "ADMIN",
      };

      if (tokenSecret) {
        const accessToken = jwt.sign(userData, tokenSecret, {
          expiresIn: "30d",
        });
        successResponseHelper(res, 200, "Login Success!", { accessToken });
      }
    } else {
      throw { message: "Invalid username or password!" };
    }
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const withdrawAssets = async (req: express.Request, res: express.Response) => {
  try {
    const { currency, amount, address } = req.body;

    const adminWallet: IAdminWallet = (
      await adminWalletModel.findOne({
        where: {
          wallet_type: currency,
        },
      })
    ).dataValues;

    const envAddress = getAdminWalletAddress(currency);
    if (envAddress) {
      adminWallet.wallet_address = envAddress;
    }

    let fees,
      sendAmount: string | number = amount;
    if (["BTC", "LTC", "DOGE"].indexOf(adminWallet.wallet_type) !== -1) {
      fees = (
        await tatumApi.feeEstimation(
          adminWallet.wallet_type,
          adminWallet.wallet_address,
          address,
          Number(amount)
        )
      )?.fast;

      sendAmount = Number(Number(Number(amount) - Number(fees)).toFixed(8));
    }

    if (["ETH", "BSC", "USDT-ERC20"].indexOf(adminWallet.wallet_type) !== -1) {
      fees = await tatumApi.feeEstimation(
        adminWallet.wallet_type,
        adminWallet.wallet_address,
        address,
        Number(amount)
      );

      sendAmount = Number(
        Number(amount) -
        Number(((fees?.gasPrice + 1) * fees?.gasLimit) / 1000000000)
      ).toFixed(8);
    }

    adminLogger.info(fees);

    const transactionDetails = await tatumApi.assetToOtherAddress({
      currency: currency,
      fromAddress: adminWallet.wallet_address,
      toAddress: address,
      privateKey: adminWallet.privateKey,
      amount: sendAmount,
      fee: fees,
    });

    successResponseHelper(res, 200, "Amount withdrawed!", transactionDetails);
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const getFeeWalletBalance = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    const adminFeesWallets = await adminFeeModel.findAll({
      attributes: { exclude: ["privateKey", "mnemonic", "xpub"] },
    });
    const transactions = await adminFeeTransactionModel.findAll({
      attributes: { exclude: ["amount_to_be_paid"] },
      order: [["createdAt", "desc"]],
    });
    const cryptoWallets = [];
    for (let i = 0; i < adminFeesWallets.length; i++) {
      let amount = adminFeesWallets[i]?.dataValues.amount;

      // BUGFIX 2026-07-09: Fee wallet balance was showing stale / zero values in
      // the admin UI because this call was reading from Redis (10-min TTL) and
      // any Tatum error (e.g. account.not.found → fallback '0') was clobbering
      // the DB `amount` column with bad data. Mirror the correct pattern used
      // by checkFeeBalance in paymentController.ts (skipCache + try/catch + NaN guard).
      let currentBalance;
      try {
        currentBalance = await tatumApi.getAddressBalance(
          adminFeesWallets[i]?.dataValues.wallet_address,
          adminFeesWallets[i]?.dataValues.wallet_type,
          true // skipCache — admin UI must always see real-time data
        );
      } catch (balErr: unknown) {
        const balError = balErr as { message?: string; body?: { errorCode?: string } };
        const errMsg = balError?.message || '';
        const errCode = balError?.body?.errorCode || '';
        // Not-yet-activated accounts (XRP reserve, unfunded TRX) return
        // account.not.found — keep the last known DB value instead of overwriting to 0.
        if (errMsg.includes('account.not.found') || errMsg.includes('Account not found') ||
            errCode.includes('account.failed') || errMsg.includes('not.found')) {
          adminLogger.info(`[getFeeWalletBalance] ⏭️ Skipping refresh for ${adminFeesWallets[i]?.dataValues.wallet_type} — account not activated (${adminFeesWallets[i]?.dataValues.wallet_address?.substring(0, 12)}...)`);
        } else {
          adminLogger.warn(`[getFeeWalletBalance] Tatum balance fetch failed for ${adminFeesWallets[i]?.dataValues.wallet_type}: ${errMsg} — using last known DB value.`);
        }
        currentBalance = null;
      }

      // NOTE: getAddressBalance() already converts SUN→TRX for TRX currency.
      // Do NOT divide by 1,000,000 again — double-division caused wrong admin display.
      const newBalance = currentBalance?.balance;
      const parsedBalance = Number(newBalance);
      // Only update DB if the fresh value is a valid finite number AND actually changed.
      // Prevents clobbering the real balance with undefined/null/NaN from a bad response.
      if (
        newBalance !== undefined &&
        newBalance !== null &&
        Number.isFinite(parsedBalance) &&
        parsedBalance !== Number(adminFeesWallets[i]?.dataValues.amount)
      ) {
        adminLogger.info(`[getFeeWalletBalance] ${adminFeesWallets[i]?.dataValues.wallet_type}: balance changed ${amount} → ${parsedBalance}`);
        amount = parsedBalance;
        await adminFeeModel.update(
          { amount },
          {
            where: {
              fee_wallet_id: adminFeesWallets[i]?.dataValues.fee_wallet_id,
            },
          }
        );
      }
      const usdAmount = await convertToUSD(adminFeesWallets[i]?.dataValues.wallet_type, amount);
      cryptoWallets.push({
        ...adminFeesWallets[i].dataValues,
        amount,
        amount_in_usd: usdAmount,
      });
    }
    successResponseHelper(res, 200, "", {
      cryptoWallets,
      transactions,
    });
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const changePassword = async (req: express.Request, res: express.Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const adminData = jwt.decode(res.locals.token) as { email?: string } | null;

    // Fetch admin by email using parameterized query
    const data = await sequelize.query<{ email: string; password: string }>(
      `SELECT * FROM tbl_admin WHERE email = :email`,
      { 
        replacements: { email: adminData?.email },
        type: QueryTypes.SELECT 
      }
    );
    
    if (data.length === 0) {
      return errorResponseHelper(res, 500, "Admin account not found!");
    }

    const admin = data[0];
    const storedHash = admin.password;
    const isBcryptHash = /^\$2[aby]?\$/.test(storedHash);
    let passwordValid = false;

    if (isBcryptHash) {
      passwordValid = bcrypt.compareSync(oldPassword, storedHash);
    } else {
      // Legacy SHA-256 comparison
      const sha256Hash = sha256(oldPassword).toString();
      passwordValid = sha256Hash === storedHash;
    }

    if (passwordValid) {
      // Always hash new password with bcrypt
      const bcryptHash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
      await sequelize.query(
        `UPDATE tbl_admin SET password = :newPassword WHERE email = :email`,
        {
          replacements: { newPassword: bcryptHash, email: adminData?.email },
          type: QueryTypes.UPDATE,
        }
      );
      successResponseHelper(res, 200, "Password updated successfully!", null);
    } else {
      errorResponseHelper(res, 500, "Old password not recognized!");
    }
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const updateEmail = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp } = req.body;
    const adminData = jwt.decode(res.locals.token) as { email?: string } | null;
    if (!otp) {
      const data = await sequelize.query(
        `SELECT * FROM tbl_admin WHERE email = :adminEmail`,
        { replacements: { adminEmail: adminData?.email }, type: QueryTypes.SELECT }
      );
      if (data.length > 0) {
        const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
        await sendEmail(
          email,
          "Admin",
          "OTP for Email change",
          "Here is OTP for updating the email: " + randomNumberOTP
        );
        await setRedisItem(email + "-update-otp", {
          otp: randomNumberOTP.toString(),
          expiresAt: new Date().getTime() + 5 * 60 * 1000,
        });
        successResponseHelper(res, 200, "OTP sent for confirmation!");
      }
    } else {
      const storedOtp = await getRedisItem(email + "-update-otp");
      adminLogger.info(storedOtp);
      if (storedOtp.otp != otp) {
        errorResponseHelper(res, 500, "OTP did not match!");
      } else {
        if (new Date().getTime() > Number(storedOtp?.expiresAt)) {
          throw { message: "OTP expired!" };
        }

        await sequelize.query(
          `UPDATE tbl_admin SET email = :newEmail WHERE email = :adminEmail`,
          {
            replacements: { newEmail: email, adminEmail: adminData?.email },
            type: QueryTypes.UPDATE,
          }
        );
        const tokenSecret = envRaw("ACCESS_TOKEN_SECRET");
        const userData = {
          email,
          role: "ADMIN",
        };

        if (tokenSecret) {
          const accessToken = jwt.sign(userData, tokenSecret, {
            expiresIn: "30d",
          });
          await deleteRedisItem(email + "-update-otp");
          successResponseHelper(res, 200, "Email updated successfully!", {
            accessToken,
          });
        }
      }
    }
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const updateFeeLimits = async (req: express.Request, res: express.Response) => {
  try {
    const { feeLimit, alert_duration } = req.body;
    await adminFeeModel.update(
      {
        feeLimit,
        alert_duration,
      },
      {
        where: {
          wallet_type: ["ETH", "TRX"],
        },
      }
    );
    successResponseHelper(res, 200, "Limits updated successfully!");
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const updateTransferFees = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { feesData } = req.body;

    for (let i = 0; i < feesData.length; i++) {
      const { wallet_type, speed, transfer_speed_id } = feesData[i];

      await adminTransferFeeModel.update(
        {
          wallet_type,
          speed,
        },
        {
          where: {
            transfer_speed_id,
          },
        }
      );
    }
    successResponseHelper(res, 200, "Transfer fees updated successfully!");
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const getTransferFees = async (_req: express.Request, res: express.Response) => {
  try {
    const resData = await adminTransferFeeModel.findAll();
    successResponseHelper(res, 200, "", resData);
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const getAllTransactions = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { rowsPerPage, page, filters } = req.body;
    let column, sortType, offset, limit;
    if (filters) {
      column = filters?.column ?? "createdAt";
      sortType = !filters?.asc ? "desc" : "asc";
    } else {
      column = "createdAt";
      sortType = "desc";
    }
    if (rowsPerPage && page) {
      offset = (page - 1) * rowsPerPage;
      limit = rowsPerPage;
    }
    const selfData = await selfTransactionModel.findAll({
      attributes: { exclude: ["wallet_id", "transaction_id"] },
      ...(column && sortType && { order: [[column, sortType]] }),
      ...(offset !== -1 && limit && { offset, limit }),
    });

    // Whitelist allowed columns for ORDER BY to prevent SQL injection
    const ALLOWED_COLUMNS: Record<string, string> = {
      createdAt: '"createdAt"', updatedAt: '"updatedAt"', base_amount: 'base_amount',
      status: 'status', id: 'id',
    };
    const safeCol = (column && ALLOWED_COLUMNS[column]) ? ALLOWED_COLUMNS[column] : '"createdAt"';
    const safeSort = sortType === 'asc' ? 'ASC' : 'DESC';

    let adminQuery = `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id
      order by ${safeCol} ${safeSort}`;
    const adminReplacements: Record<string, unknown> = {};
    if (offset !== -1 && limit) {
      adminQuery += ` offset :offset limit :limit`;
      adminReplacements.offset = offset;
      adminReplacements.limit = limit;
    }

    const tempData = await sequelize.query(adminQuery, {
      type: QueryTypes.SELECT,
      replacements: adminReplacements,
    });
    const customer_data = tempData.map((x: Record<string, unknown>) => {
      const { wallet_id, transaction_id, ...rest } = x;
      return rest;
    });

    const totalTransactions = customer_data.length + selfData.length;
    const message = totalTransactions === 0
      ? "No transactions found"
      : `Successfully retrieved ${totalTransactions} transaction${totalTransactions === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, {
      customers_transactions: customer_data,
      users_transactions: selfData,
    });
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const getAdminAnalytics = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const {
      periodType,
      year = new Date().getFullYear(),
      month = new Date().getMonth() + 1,
    } = req.body;
    const activeUsers = (
      await userModel.findAndCountAll({
        where: {
          status: "active",
        },
      })
    ).count;

    const totalTransactionsIncoming = (
      await userTransactionModel.findAndCountAll()
    ).count;

    const totalTransactionOutgoing = (
      await selfTransactionModel.findAndCountAll({
        where: {
          transaction_type: "DEBIT",
        },
      })
    ).count;

    let where = "";
    const safeYear = parseInt(year) || new Date().getFullYear();
    const safeMonth = parseInt(month) || (new Date().getMonth() + 1);
    if (periodType === "YEAR") {
      where = `where extract(year from ut."createdAt")=${safeYear}`;
    } else if (periodType === "MONTH") {
      where = `where extract(year from ut."createdAt")=${safeYear} and extract(month from ut."createdAt")=${safeMonth}`;
    } else {
      where = "";
    }

    const popularCurrency = await sequelize.query(
      `select aw.wallet_type,count(ut.base_currency) as transaction_count,aw.currency_type from tbl_admin_wallet aw 
      left join tbl_user_transaction ut on  aw.wallet_type=ut.base_currency
      ${where} group by ut.base_currency,aw.wallet_type,aw.currency_type order by transaction_count desc`,
      { type: QueryTypes.SELECT }
    );

    const invoicesCreatedIn30Days = await sequelize.query(
      `select date_trunc('day', "createdAt") as date_temp, count(*) as invoices_created
    from tbl_user_transaction group by date_temp order by date_temp desc limit 30`,
      { type: QueryTypes.SELECT }
    );

    const paymentSuccessRates = await sequelize.query(
      `select count(*) filter (where status='successful') as successful_payments,
      count(*) filter (where status = 'failed') as failed_payments,
	  count(*) filter (where status = 'pending') as pending_payments
    from tbl_user_transaction ut ${where}`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const growthTrends = await sequelize.query(
      `with users_per_month as (
      select
        date_trunc('month', "createdAt") as month,
        count(*) as new_users
      from tbl_user
      group by month
    ),
    transactions_per_month as (
      select
        date_trunc('month', "createdAt") as month,
        count(*) as new_transactions
      from tbl_user_transaction
      group by month
    )
    select
      extract(month from t.month) as t_month,
	  extract (month from u.month) as u_month,
      COALESCE(u.new_users, 0) as new_users,
      COALESCE(t.new_transactions, 0) as new_transactions
    from users_per_month u
    full outer join transactions_per_month t on u.month = t.month
    order by u.month desc`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const revenue_performance: Array<Record<string, unknown>> = [];
    const totalIncome = await sequelize.query<{ base_currency: string; amount: number }>(
      `select base_currency,sum(base_amount) as amount from tbl_user_transaction ut ${where} group by base_currency`,
      { type: QueryTypes.SELECT }
    );
    const totalFee = await sequelize.query<{ wallet_type: string; fee_amount: number }>(
      `
      select wallet_type,sum(blockchain_fee) as fee_amount from tbl_user_temp_address ut ${where} group by wallet_type
      `,
      {
        type: QueryTypes.SELECT,
      }
    );

    for (let i = 0; i < totalIncome.length; i++) {
      const feeIndex = totalFee.findIndex(
        (x) => x.wallet_type === totalIncome[i]?.base_currency
      );
      const fiatResult = await convertToFiat(totalIncome[i]?.base_currency, 'USD', totalIncome[i].amount);
      const currencyData = [{ amount: fiatResult.amount, transferRate: fiatResult.rate }];
      const feeAmount = totalFee[feeIndex]?.fee_amount || 0;
      revenue_performance.push({
        ...totalIncome[i],
        amount_in_usd: currencyData[0].amount,
        fee_amount: Number(feeAmount).toFixed(8),
        fee_in_usd: Number(feeAmount * currencyData[0].transferRate).toFixed(
          2
        ),
      });
    }

    const returnData = {
      activeUsers,
      totalTransactionsIncoming,
      totalTransactionOutgoing,
      popularCurrency,
      invoicesCreatedIn30Days,
      paymentSuccessRates,
      growthTrends,
      revenue_performance,
    };

    successResponseHelper(res, 200, "Dashboard statistics retrieved successfully", returnData);
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

const getAllUsers = async (_req: express.Request, res: express.Response) => {
  try {
    const userData = await userModel.findAll({
      attributes: { exclude: ["password"] },
    });
    const message = userData.length === 0
      ? "No users found in the system"
      : `Successfully retrieved ${userData.length} user${userData.length === 1 ? '' : 's'}`;
    
    successResponseHelper(res, 200, message, userData);
  } catch (e) {

      handleControllerError(res, e, adminLogger);
  }
};

/**
 * PUT /api/admin/users/:userId/ban
 * Ban or suspend a user account
 */
const banUser = async (req: express.Request, res: express.Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const { reason, action } = req.body; // action: 'ban' | 'suspend' | 'activate'

    if (isNaN(userId)) {
      return errorResponseHelper(res, 400, "Invalid user ID");
    }

    const validActions = ["ban", "suspend", "activate"];
    const selectedAction = action || "ban";
    if (!validActions.includes(selectedAction)) {
      return errorResponseHelper(res, 400, `Invalid action. Must be one of: ${validActions.join(", ")}`);
    }

    const user = await userModel.findOne({ where: { user_id: userId } });
    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    const statusMap: Record<string, string> = {
      ban: "banned",
      suspend: "suspended",
      activate: "active",
    };
    const newStatus = statusMap[selectedAction];

    await userModel.update(
      { status: newStatus },
      { where: { user_id: userId } }
    );

    adminLogger.info(`[Admin] User ${userId} status changed to '${newStatus}' by admin. Reason: ${reason || "N/A"}`);

    successResponseHelper(res, 200, `User ${selectedAction}${selectedAction === "activate" ? "d" : "ned"} successfully`, {
      user_id: userId,
      new_status: newStatus,
      reason: reason || null,
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

/**
 * POST /api/admin/users/:userId/unlock
 * Unlock a locked-out account
 */
const unlockUser = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }

    const unlocked = await adminUnlockAccount(email);

    if (unlocked) {
      successResponseHelper(res, 200, `Account ${email} unlocked successfully`);
    } else {
      errorResponseHelper(res, 500, "Failed to unlock account");
    }
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

/**
 * GET /api/admin/users/:userId
 * Get detailed user info for admin
 */
const getUserDetail = async (req: express.Request, res: express.Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return errorResponseHelper(res, 400, "Invalid user ID");
    }

    const user = await userModel.findOne({
      where: { user_id: userId },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    // Get transaction count
    const [txCount] = await sequelize.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM tbl_user_transaction WHERE user_id = :userId",
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    successResponseHelper(res, 200, "User details retrieved", {
      ...user.dataValues,
      transaction_count: parseInt(txCount?.count || "0"),
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

/**
 * Credit customer wallet (admin or API)
 * POST /api/admin/customers/:customerId/credit
 */
const creditCustomerWallet = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { customerId } = req.params;
    const { amount, description } = req.body;
    const authType = res.locals.authType;

    // Validation
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return errorResponseHelper(res, 400, "Valid positive amount is required");
    }

    if (!description || description.trim() === "") {
      return errorResponseHelper(res, 400, "Description is required");
    }

    const creditAmount = Number(amount);

    // Get customer with company info
    const customerData = await sequelize.query<{
      customer_id: number;
      company_id: number;
      customer_name: string;
      email: string;
      company_name: string;
    }>(
      `SELECT c.customer_id, c.company_id, c.customer_name, c.email, cm.company_name
       FROM tbl_customer c
       LEFT JOIN tbl_company cm ON cm.company_id = c.company_id
       WHERE c.customer_id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT,
      }
    );

    if (customerData.length === 0) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    const customer = customerData[0];

    // If using API key, verify it belongs to the same company
    if (authType === "api_key") {
      if (res.locals.company_id !== customer.company_id) {
        return errorResponseHelper(res, 403, "You can only manage customers from your own company");
      }
    }

    // Get wallet
    const walletData = await sequelize.query<{
      wallet_id: number;
      amount: number;
      wallet_type: string;
    }>(
      `SELECT wallet_id, amount, wallet_type FROM tbl_customer_wallet WHERE customer_id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT,
      }
    );

    if (walletData.length === 0) {
      return errorResponseHelper(res, 404, "Customer wallet not found");
    }

    const wallet = walletData[0];
    const newBalance = Number(wallet.amount) + creditAmount;

    // Update wallet balance in a transaction
    await sequelize.transaction(async (t) => {
      // Update wallet
      await sequelize.query(
        `UPDATE tbl_customer_wallet SET amount = $1, "updatedAt" = NOW() WHERE customer_id = $2`,
        {
          bind: [newBalance.toFixed(2), customerId],
          type: QueryTypes.UPDATE,
          transaction: t,
        }
      );

      // Create transaction record
      const txId = crypto.randomUUID();
      const txRef = crypto.randomUUID();

      await sequelize.query(
        `INSERT INTO tbl_customer_transaction 
         (id, company_id, customer_id, payment_mode, base_amount, base_currency,
          paid_amount, paid_currency, transaction_type, transaction_details,
          transaction_reference, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ADMIN', $4, $5, $4, $5, 'CREDIT', $6, $7, 'successful', NOW(), NOW())`,
        {
          bind: [
            txId,
            customer.company_id,
            customerId,
            creditAmount.toFixed(2),
            wallet.wallet_type,
            description.trim(),
            txRef,
          ],
          type: QueryTypes.INSERT,
          transaction: t,
        }
      );
    });

    adminLogger.info(
      `[CustomerWallet] Credited ${creditAmount} ${wallet.wallet_type} to customer ${customerId} (${customer.email}). Auth: ${authType}`
    );

    successResponseHelper(res, 200, "Wallet credited successfully", {
      customer_id: customerId,
      previous_balance: Number(wallet.amount).toFixed(2),
      amount_credited: creditAmount.toFixed(2),
      new_balance: newBalance.toFixed(2),
      currency: wallet.wallet_type,
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

/**
 * Debit customer wallet (admin or API)
 * POST /api/admin/customers/:customerId/debit
 */
const debitCustomerWallet = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { customerId } = req.params;
    const { amount, description } = req.body;
    const authType = res.locals.authType;

    // Validation
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return errorResponseHelper(res, 400, "Valid positive amount is required");
    }

    if (!description || description.trim() === "") {
      return errorResponseHelper(res, 400, "Description is required");
    }

    const debitAmount = Number(amount);

    // Get customer with company info
    const customerData = await sequelize.query<{
      customer_id: number;
      company_id: number;
      customer_name: string;
      email: string;
      company_name: string;
    }>(
      `SELECT c.customer_id, c.company_id, c.customer_name, c.email, cm.company_name
       FROM tbl_customer c
       LEFT JOIN tbl_company cm ON cm.company_id = c.company_id
       WHERE c.customer_id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT,
      }
    );

    if (customerData.length === 0) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    const customer = customerData[0];

    // If using API key, verify it belongs to the same company
    if (authType === "api_key") {
      if (res.locals.company_id !== customer.company_id) {
        return errorResponseHelper(res, 403, "You can only manage customers from your own company");
      }
    }

    // Get wallet
    const walletData = await sequelize.query<{
      wallet_id: number;
      amount: number;
      wallet_type: string;
    }>(
      `SELECT wallet_id, amount, wallet_type FROM tbl_customer_wallet WHERE customer_id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT,
      }
    );

    if (walletData.length === 0) {
      return errorResponseHelper(res, 404, "Customer wallet not found");
    }

    const wallet = walletData[0];

    // Check sufficient balance
    if (Number(wallet.amount) < debitAmount) {
      return errorResponseHelper(
        res,
        400,
        `Insufficient balance. Current balance: ${Number(wallet.amount).toFixed(2)} ${wallet.wallet_type}`
      );
    }

    const newBalance = Number(wallet.amount) - debitAmount;

    // Update wallet balance in a transaction
    await sequelize.transaction(async (t) => {
      // Update wallet
      await sequelize.query(
        `UPDATE tbl_customer_wallet SET amount = $1, "updatedAt" = NOW() WHERE customer_id = $2`,
        {
          bind: [newBalance.toFixed(2), customerId],
          type: QueryTypes.UPDATE,
          transaction: t,
        }
      );

      // Create transaction record
      const txId = crypto.randomUUID();
      const txRef = crypto.randomUUID();

      await sequelize.query(
        `INSERT INTO tbl_customer_transaction 
         (id, company_id, customer_id, payment_mode, base_amount, base_currency,
          paid_amount, paid_currency, transaction_type, transaction_details,
          transaction_reference, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ADMIN', $4, $5, $4, $5, 'DEBIT', $6, $7, 'successful', NOW(), NOW())`,
        {
          bind: [
            txId,
            customer.company_id,
            customerId,
            debitAmount.toFixed(2),
            wallet.wallet_type,
            description.trim(),
            txRef,
          ],
          type: QueryTypes.INSERT,
          transaction: t,
        }
      );
    });

    adminLogger.info(
      `[CustomerWallet] Debited ${debitAmount} ${wallet.wallet_type} from customer ${customerId} (${customer.email}). Auth: ${authType}`
    );

    successResponseHelper(res, 200, "Wallet debited successfully", {
      customer_id: customerId,
      previous_balance: Number(wallet.amount).toFixed(2),
      amount_debited: debitAmount.toFixed(2),
      new_balance: newBalance.toFixed(2),
      currency: wallet.wallet_type,
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

export default {
  createWallets,
  login,
  getWallets,
  getAdminAnalytics,
  getAllTransactions,
  getAllUsers,
  withdrawAssets,
  getTransactionFee,
  newTransactionFee,
  getFeeWalletBalance,
  changePassword,
  updateEmail,
  updateFeeLimits,
  updateTransferFees,
  getTransferFees,
  banUser,
  unlockUser,
  getUserDetail,
  creditCustomerWallet,
  debitCustomerWallet,
};
