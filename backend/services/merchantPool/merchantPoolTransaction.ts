/**
 * Merchant Pool Transaction Recording
 * 
 * Handles transaction recording and pool status queries.
 */

import {
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  MERCHANT_POOL_CRYPTO_TYPES,
} from "../../models";
import { POOL_CONFIG, getSweepConfig } from "./merchantPoolConfig";
import { sum } from "../../utils/money";

/**
 * Record pool transaction for audit
 */
export const recordPoolTransaction = async (data: {
  tempAddressId: number;
  ownerUserId: number;
  companyId?: number;
  customerId?: number;
  paymentReference?: string;
  walletType: string;
  paymentAmount: number;
  merchantAmount: number;
  adminFeeAmount: number;
  gasFunded?: number;
  gasUsed?: number;
  incomingTxId?: string;
  merchantTxId?: string;
  gasFundingTxId?: string;
  status: string;
}): Promise<unknown> => {
  return await merchantPoolTransactionModel.create({
    temp_address_id: data.tempAddressId,
    owner_user_id: data.ownerUserId,
    company_id: data.companyId,
    customer_id: data.customerId,
    payment_reference: data.paymentReference,
    wallet_type: data.walletType,
    payment_amount: data.paymentAmount,
    merchant_amount: data.merchantAmount,
    admin_fee_amount: data.adminFeeAmount,
    gas_funded: data.gasFunded || 0,
    gas_used: data.gasUsed || 0,
    incoming_tx_id: data.incomingTxId,
    merchant_tx_id: data.merchantTxId,
    gas_funding_tx_id: data.gasFundingTxId,
    status: data.status,
  });
};

/**
 * Get pool status for dashboard
 */
export const getPoolStatus = async (userId?: number): Promise<unknown> => {
  const whereClause: Record<string, unknown> = {};
  if (userId) whereClause.owner_user_id = userId;

  const addresses = await merchantTempAddressModel.findAll({
    where: whereClause,
    attributes: [
      "temp_address_id",
      "owner_user_id",
      "wallet_type",
      "wallet_address",
      "status",
      "admin_fee_balance",
      "gas_balance",
      "total_transactions",
      "last_used_at",
      "last_swept_at",
    ],
  });

  const byType: Record<string, Array<Record<string, unknown>>> = {};
  for (const addr of addresses) {
    const type = addr.dataValues.wallet_type;
    if (!byType[type]) byType[type] = [];
    byType[type].push(addr.dataValues);
  }

  const result: Record<string, unknown> = {};
  for (const [type, addrs] of Object.entries(byType)) {
    const totalFees = sum(addrs.map((a) => String(a.admin_fee_balance || 0))).toNumber();
    result[type] = {
      addresses: addrs,
      totalAddresses: addrs.length,
      availableCount: addrs.filter(a => a.status === "AVAILABLE").length,
      reservedCount: addrs.filter(a => a.status === "RESERVED").length,
      processingCount: addrs.filter(a => a.status === "PROCESSING").length,
      sweepingCount: addrs.filter(a => a.status === "SWEEPING").length,
      totalAccumulatedFees: totalFees,
      sweepConfig: getSweepConfig(type),
    };
  }

  return {
    ...result,
    config: POOL_CONFIG,
    supportedChains: MERCHANT_POOL_CRYPTO_TYPES,
  };
};

/**
 * Find pool address by wallet address
 */
export const findByWalletAddress = async (walletAddress: string): Promise<unknown> => {
  return await merchantTempAddressModel.findOne({
    where: { wallet_address: walletAddress },
  });
};
