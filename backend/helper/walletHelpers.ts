/**
 * Wallet Increment Helpers
 *
 * Centralizes all wallet balance mutations (admin fee, user wallet, customer wallet).
 * Provides a single point of change for:
 *   - Field name updates
 *   - Adding audit/logging hooks
 *   - Changing increment logic
 */

import { Transaction } from "sequelize";
import { adminWalletModel, userWalletModel, customerWalletModel } from "../models";

/**
 * Credit the admin fee wallet for a given currency.
 * Used after fee deduction on every successful payment.
 */
export const incrementAdminFee = async (
  currency: string,
  amount: number,
): Promise<void> => {
  await adminWalletModel.increment("fee", {
    by: amount,
    where: { wallet_type: currency },
  });
};

/**
 * Credit a user (merchant) wallet.
 * @param transaction – optional Sequelize transaction for atomicity
 */
export const incrementUserWallet = async (
  walletId: number,
  amount: number,
  transaction?: Transaction,
): Promise<void> => {
  await userWalletModel.increment("amount", {
    by: Number(amount),
    where: { wallet_id: walletId },
    ...(transaction && { transaction }),
  });
};

/**
 * Credit a customer wallet (end-user receiving overpayment refund, etc.).
 * @param transaction – optional Sequelize transaction for atomicity
 */
export const incrementCustomerWallet = async (
  customerId: number,
  amount: number,
  transaction?: Transaction,
): Promise<void> => {
  await customerWalletModel.increment("amount", {
    by: Number(amount),
    where: { customer_id: customerId },
    ...(transaction && { transaction }),
  });
};
