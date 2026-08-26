/**
 * Merchant Pool Address Reservation
 * 
 * Handles address reservation, release, payment tracking, and cleanup.
 */

import { Op, Transaction } from "sequelize";
import { cronLogger } from "../../utils/loggers";
import { merchantTempAddressModel } from "../../models";
import { getRedisItem, setRedisItem, withLock } from "../../utils/redisInstance";
import tatumApi from "../../apis/tatumApi";
import sequelize from "../../utils/dbInstance";
import { getErrorMessage } from "../../helper";
import {
  POOL_CONFIG,
  UTXO_CHAINS,
  TOKEN_CHAINS,
  getSweepConfig,
  getCryptoRedisKey,
} from "./merchantPoolConfig";
import { addAddressToMerchantPool } from "./merchantPoolWallet";
import { recordPoolTransaction } from "./merchantPoolTransaction";

/**
 * Max PRE_RESERVED rows to consider in the lock-free fast path per call. A
 * burst of concurrent same-merchant checkouts spreads across these candidates
 * (each claimed via an atomic optimistic UPDATE), so a loser retries another
 * row instead of taking the per-merchant lock.
 */
const FAST_PATH_CANDIDATE_LIMIT = 16;

/**
 * Reserve an address from merchant's pool for a payment
 */
export const reserveAddress = async (
  walletType: string,
  paymentId: string,
  userId: number,
  companyId: number | null,
  expectedAmount: number
): Promise<unknown> => {
  const lockKey = `reserve-address:${userId}:${walletType}`;
  
  // ═══════════════════════════════════════════════════════════════════════
  // PERF FIX 3: Fast path — check for PRE_RESERVED address first
  // Pre-warmed addresses skip the full lock+transaction cycle (~400-600ms savings)
  // If no pre-reserved address, fall back to the standard reservation flow
  // ═══════════════════════════════════════════════════════════════════════
  const effectiveCompanyId = companyId && companyId > 0 ? companyId : null;
  
  try {
    // Fetch a BATCH of pre-reserved candidates (lock-free). Under a burst of
    // concurrent same-merchant checkouts, each request claims a row via an
    // atomic optimistic UPDATE (WHERE status='PRE_RESERVED'); a loser tries the
    // NEXT candidate instead of dropping to the per-merchant Redis lock. A
    // random start offset spreads concurrent callers so they don't all collide
    // on the same top row. Growing POOL_CONFIG.PRE_RESERVE_TARGET therefore
    // linearly grows lock-free burst headroom with zero over-reservation risk.
    const preReservedCandidates = await merchantTempAddressModel.findAll({
      where: {
        owner_user_id: userId,
        wallet_type: walletType,
        status: "PRE_RESERVED",
      },
      order: [
        ["admin_fee_balance", "DESC"],
        ["total_transactions", "DESC"],
      ],
      limit: FAST_PATH_CANDIDATE_LIMIT,
    });

    const candidateCount = preReservedCandidates.length;
    if (candidateCount > 0) {
      const reservedUntil = new Date();
      reservedUntil.setMinutes(reservedUntil.getMinutes() + POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES);
      const startOffset = Math.floor(Math.random() * candidateCount);

      for (let attempt = 0; attempt < candidateCount; attempt++) {
        const preReserved = preReservedCandidates[(startOffset + attempt) % candidateCount];

        const [updatedCount] = await merchantTempAddressModel.update(
          {
            status: "RESERVED",
            current_payment_id: paymentId,
            current_company_id: effectiveCompanyId,
            expected_amount: expectedAmount,
            received_amount: 0,
            is_partial_payment: false,
            partial_payment_timestamp: null,
            reserved_until: reservedUntil,
            locked_at: new Date(),
            last_payment_context: null,
          },
          {
            where: {
              temp_address_id: preReserved.dataValues.temp_address_id,
              status: "PRE_RESERVED", // Optimistic lock — only succeeds if still PRE_RESERVED
            },
          }
        );

        if (updatedCount > 0) {
          cronLogger.info(`[MerchantPool] ⚡ FAST PATH: Used pre-reserved ${walletType} address for payment ${paymentId}`);
          cronLogger.info(`[MerchantPool]    - Address: ${preReserved.dataValues.wallet_address}`);
          cronLogger.info(`[MerchantPool]    - Merchant: ${userId}, Company: ${effectiveCompanyId}`);

          // Async: Update subscription with company info (non-blocking)
          const addressToSubscribe = preReserved.dataValues.wallet_address;
          const addressId = preReserved.dataValues.temp_address_id;
          (async () => {
            try {
              const subResult = await tatumApi.createSubscriptionBlockBeeStyle(
                addressToSubscribe as string,
                walletType,
                effectiveCompanyId || 0,
                userId,
                addressId as number
              );
              if (subResult?.id) {
                await preReserved.update({ subscription_id: subResult.id });
              }
            } catch (subError: unknown) {
              cronLogger.error(`[MerchantPool] ⚠️ Async subscription update failed:`, (subError as Error).message);
            }
          })();

          // Trigger background replenishment (fire-and-forget)
          replenishPreReservedPool(userId, walletType).catch(() => {});

          return preReserved;
        }
        // updatedCount === 0: another concurrent request grabbed THIS row —
        // try the next pre-reserved candidate before falling back to the lock.
      }

      // Every pre-reserved candidate was grabbed concurrently — fall through to
      // the standard (locked) flow.
      cronLogger.info(`[MerchantPool] All ${candidateCount} pre-reserved ${walletType} addresses grabbed concurrently, falling back to standard flow`);
    }
  } catch (fastPathErr) {
    cronLogger.warn(`[MerchantPool] Fast path failed, falling through to standard flow:`, (fastPathErr as Error).message);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // Standard flow: Full lock + DB transaction (original logic preserved)
  // ═══════════════════════════════════════════════════════════════════════
  const lockResult = await withLock(lockKey, async () => {
    const transaction = await sequelize.transaction();

    try {
      const effectiveCompanyId = companyId && companyId > 0 ? companyId : null;
      
      await releaseExpiredReservations(userId, walletType, transaction);

      let poolAddress = await merchantTempAddressModel.findOne({
        where: {
          owner_user_id: userId,
          wallet_type: walletType,
          status: "AVAILABLE",
        },
        order: [
          ["admin_fee_balance", "DESC"],
          ["total_transactions", "DESC"],
        ],
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!poolAddress) {
        cronLogger.info(`[MerchantPool] No available ${walletType} address for merchant ${userId}, creating new...`);
        const newAddress = await addAddressToMerchantPool(userId, walletType, transaction);
        poolAddress = newAddress as typeof poolAddress;
      }

      const addressToSubscribe = poolAddress.dataValues.wallet_address;
      const addressId = poolAddress.dataValues.temp_address_id;
      
      let subscriptionId = poolAddress.dataValues.subscription_id;
      
      // ASYNC: Update subscription URL with company info in background
      // The base subscription already exists (from pre-warming or initial creation)
      // so webhooks will still be delivered even if this update is delayed
      // The checkMissedPayments cron (5 min) acts as safety net
      const subscriptionUpdatePromise = (async () => {
        try {
          cronLogger.info(`[MerchantPool] 🔄 Updating subscription with company info for ${addressToSubscribe} (async)`);
          const subResult = await tatumApi.createSubscriptionBlockBeeStyle(
            addressToSubscribe,
            walletType,
            effectiveCompanyId || 0,
            userId,
            addressId
          );
          
          if (subResult?.id) {
            subscriptionId = subResult.id;
            // Update DB with new subscription ID if changed
            await poolAddress.update({ subscription_id: subscriptionId });
            cronLogger.info(`[MerchantPool] ✅ Subscription updated with company info: ${subscriptionId}`);
            cronLogger.info(`[MerchantPool]    URL: ${subResult.url}`);
          }
        } catch (subError: unknown) {
          const errorMsg = subError instanceof Error ? subError.message : String(subError);
          cronLogger.error(`[MerchantPool] ⚠️ Async subscription update failed (will retry via cron):`, errorMsg);
        }
      })();

      // Don't await — let it run in background while we complete the reservation

      const reservedUntil = new Date();
      reservedUntil.setMinutes(reservedUntil.getMinutes() + POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES);

      await poolAddress.update(
        {
          status: "RESERVED",
          current_payment_id: paymentId,
          current_company_id: effectiveCompanyId,
          expected_amount: expectedAmount,
          received_amount: 0,
          is_partial_payment: false,
          partial_payment_timestamp: null,
          reserved_until: reservedUntil,
          locked_at: new Date(),
          subscription_id: subscriptionId,
          last_payment_context: null, // Clear stale context from previous payment to prevent webhook URL mismatch
        },
        { transaction }
      );

      await transaction.commit();

      cronLogger.info(`[MerchantPool] ✅ Reserved ${walletType} address for payment ${paymentId}`);
      cronLogger.info(`[MerchantPool]    - Merchant: ${userId}`);
      cronLogger.info(`[MerchantPool]    - Company: ${effectiveCompanyId}`);
      cronLogger.info(`[MerchantPool]    - Address: ${poolAddress.dataValues.wallet_address}`);
      cronLogger.info(`[MerchantPool]    - Expected: ${expectedAmount} ${walletType}`);
      cronLogger.info(`[MerchantPool]    - Reserved until: ${reservedUntil}`);
      cronLogger.info(`[MerchantPool]    - Subscription: ${subscriptionId}`);

      return poolAddress;
    } catch (error) {
      await transaction.rollback();
      const message = getErrorMessage(error);
      cronLogger.error(`[MerchantPool] ❌ Failed to reserve address:`, message);
      throw error;
    }
  }, 60);
  
  if (!lockResult.success) {
    throw new Error(`Address reservation busy for merchant ${userId}. Please try again.`);
  }
  
  return lockResult.result;
};

/**
 * Get an available address from merchant's pool (for checking only, no reservation)
 */
export const getAvailableAddress = async (
  userId: number,
  walletType: string
): Promise<unknown> => {
  return await merchantTempAddressModel.findOne({
    where: {
      owner_user_id: userId,
      wallet_type: walletType,
      status: "AVAILABLE",
    },
    order: [
      ["admin_fee_balance", "DESC"],
      ["total_transactions", "DESC"],
    ],
  });
};

/**
 * Mark payment as received (status: PROCESSING)
 */
export const markPaymentReceived = async (
  tempAddressId: number,
  receivedAmount: number,
  incomingTxId: string
): Promise<void> => {
  const processingTimeout = new Date();
  processingTimeout.setMinutes(processingTimeout.getMinutes() + POOL_CONFIG.PROCESSING_TIMEOUT_MINUTES);

  await merchantTempAddressModel.update(
    {
      status: "PROCESSING",
      received_amount: receivedAmount,
      reserved_until: processingTimeout,
    },
    { where: { temp_address_id: tempAddressId } }
  );

  cronLogger.info(`[MerchantPool] 💰 Payment received: ${receivedAmount} (TX: ${incomingTxId})`);
};

/**
 * Handle partial payment
 */
export const handlePartialPayment = async (
  tempAddressId: number,
  receivedAmount: number,
  expectedAmount: number,
  _incomingTxId: string
): Promise<void> => {
  const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId);
  
  if (!poolAddress) {
    throw new Error(`Pool address not found: ${tempAddressId}`);
  }

  const previousAmount = parseFloat(poolAddress.dataValues.received_amount) || 0;
  const totalReceived = previousAmount + receivedAmount;
  
  const graceDeadline = new Date();
  graceDeadline.setMinutes(graceDeadline.getMinutes() + POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES);

  await poolAddress.update({
    received_amount: totalReceived,
    is_partial_payment: true,
    partial_payment_timestamp: new Date(),
    reserved_until: graceDeadline,
  });

  cronLogger.info(`[MerchantPool] ⚠️ PARTIAL payment for ${poolAddress.dataValues.wallet_address}`);
  cronLogger.info(`[MerchantPool]    - Payment ID: ${poolAddress.dataValues.current_payment_id}`);
  cronLogger.info(`[MerchantPool]    - Received: ${receivedAmount} (Total: ${totalReceived})`);
  cronLogger.info(`[MerchantPool]    - Expected: ${expectedAmount}`);
  cronLogger.info(`[MerchantPool]    - Grace period extended to: ${graceDeadline}`);
};

/**
 * Handle below-threshold payment (100% to admin)
 */
export const handleBelowThresholdPayment = async (
  tempAddressId: number,
  receivedAmount: number,
  incomingTxId: string
): Promise<void> => {
  const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId);
  
  if (!poolAddress) {
    throw new Error(`Pool address not found: ${tempAddressId}`);
  }

  const currentAdminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
  const currentTxCount = poolAddress.dataValues.total_transactions || 0;

  await poolAddress.update({
    status: "AVAILABLE",
    admin_fee_balance: currentAdminBalance + receivedAmount,
    total_transactions: currentTxCount + 1,
    current_payment_id: null,
    current_company_id: null,
    expected_amount: null,
    received_amount: null,
    is_partial_payment: false,
    partial_payment_timestamp: null,
    reserved_until: null,
    locked_at: null,
    last_used_at: new Date(),
    last_payment_context: null,
  });

  await recordPoolTransaction({
    tempAddressId,
    ownerUserId: poolAddress.dataValues.owner_user_id,
    companyId: poolAddress.dataValues.current_company_id,
    walletType: poolAddress.dataValues.wallet_type,
    paymentAmount: receivedAmount,
    merchantAmount: 0,
    adminFeeAmount: receivedAmount,
    incomingTxId,
    status: "below_threshold",
  });

  cronLogger.info(`[MerchantPool] 📉 BELOW THRESHOLD: ${receivedAmount} ${poolAddress.dataValues.wallet_type}`);
  cronLogger.info(`[MerchantPool]    - 100% to admin fee`);
  cronLogger.info(`[MerchantPool]    - New admin balance: ${currentAdminBalance + receivedAmount}`);
};

/**
 * Release expired reservations
 */
export const releaseExpiredReservations = async (
  userId?: number,
  walletType?: string,
  transaction?: Transaction
): Promise<number> => {
  const expiredNoPayment = await merchantTempAddressModel.findAll({
    where: {
      status: "RESERVED",
      is_partial_payment: false,
      [Op.or]: [
        { received_amount: 0 },
        { received_amount: null },
        { received_amount: '0' },
        { received_amount: '0.00000000' },
      ],
      reserved_until: { [Op.lt]: new Date() },
      ...(userId && { owner_user_id: userId }),
      ...(walletType && { wallet_type: walletType }),
    },
    transaction,
  });

  const expiredWithPartial = await merchantTempAddressModel.findAll({
    where: {
      status: "RESERVED",
      is_partial_payment: true,
      received_amount: { [Op.gt]: 0 },
      reserved_until: { [Op.lt]: new Date() },
      ...(userId && { owner_user_id: userId }),
      ...(walletType && { wallet_type: walletType }),
    },
    transaction,
  });

  let releasedCount = 0;

  for (const address of expiredNoPayment) {
    try {
      const addrWalletType = address.dataValues.wallet_type;
      const walletAddr = address.dataValues.wallet_address;
      
      // ORPHAN RECOVERY: Save payment context BEFORE wiping
      if (address.dataValues.current_payment_id) {
        try {
          const addrDestTag = address.dataValues.destination_tag ? Number(address.dataValues.destination_tag) : null;
          const redisData = await getRedisItem(getCryptoRedisKey(walletAddr, addrDestTag));
          let customerData: Record<string, unknown> = {};
          if (redisData?.ref) {
            customerData = await getRedisItem(redisData.ref) || {};
          }
          
          const paymentContext = {
            payment_id: address.dataValues.current_payment_id,
            company_id: address.dataValues.current_company_id,
            owner_user_id: address.dataValues.owner_user_id,
            expected_amount: address.dataValues.expected_amount,
            wallet_type: addrWalletType,
            reserved_until: address.dataValues.reserved_until,
            saved_at: new Date().toISOString(),
            fee_payer: redisData?.fee_payer || 'company',
            merchant_amount: redisData?.merchant_amount || null,
            base_currency: redisData?.base_currency || customerData?.base_currency || 'USD',
            base_amount: redisData?.base_amount || redisData?.amount || null,
            webhook_url: redisData?.webhook_url || null,
            callback_url: redisData?.callback_url || null,
            link_id: redisData?.link_id || customerData?.link_id || null,
            apply_tax: redisData?.apply_tax || null,
            ref: redisData?.ref || null,
            customer_name: customerData?.customer_name || null,
            customer_email: customerData?.customer_email || null,
            adm_id: customerData?.adm_id || address.dataValues.owner_user_id,
          };
          
          await address.update({
            last_payment_context: JSON.stringify(paymentContext),
          }, { transaction });
          
          cronLogger.info(`[MerchantPool] 💾 Saved payment context for ${walletAddr} (payment: ${paymentContext.payment_id})`);
        } catch (ctxError) {
          cronLogger.warn(`[MerchantPool] ⚠️ Failed to save payment context for ${walletAddr}:`, ctxError);
        }
      }
      
      let subscriptionId = address.dataValues.subscription_id;
      try {
        const subResult = await tatumApi.createSubscription(
          address.dataValues.wallet_address,
          addrWalletType,
          true
        );
        subscriptionId = subResult?.id || subscriptionId;
      } catch (subError) {
        cronLogger.warn(`[MerchantPool] ⚠️ Failed to create subscription for expired address ${address.dataValues.wallet_address}`);
      }

      await address.update({
        status: "AVAILABLE",
        current_payment_id: null,
        current_company_id: null,
        expected_amount: null,
        received_amount: null,
        reserved_until: null,
        locked_at: null,
        subscription_id: subscriptionId,
      }, { transaction });

      cronLogger.info(`[MerchantPool] ⏰ Released expired reservation: ${address.dataValues.wallet_address} (no payment, context saved)`);
      releasedCount++;
    } catch (error) {
      cronLogger.error(`[MerchantPool] ❌ Failed to release expired address ${address.dataValues.wallet_address}:`, error);
    }
  }

  for (const address of expiredWithPartial) {
    try {
      cronLogger.info(`[MerchantPool] ⏰ Processing expired partial payment: ${address.dataValues.wallet_address}`);
      cronLogger.info(`[MerchantPool]    - Received: ${address.dataValues.received_amount}`);
      cronLogger.info(`[MerchantPool]    - Expected: ${address.dataValues.expected_amount}`);
      releasedCount++;
    } catch (error) {
      cronLogger.error(`[MerchantPool] ❌ Failed to process expired partial for ${address.dataValues.wallet_address}:`, error);
    }
  }

  if (releasedCount > 0) {
    cronLogger.info(`[MerchantPool] ⏰ Processed ${releasedCount} expired reservations (${expiredNoPayment.length} released, ${expiredWithPartial.length} partials)`);
  }

  return releasedCount;
};

/**
 * Release address back to pool after payment completion
 */
export const releaseAddress = async (
  tempAddressId: number,
  adminFeeAmount: number,
  gasUsed: number = 0,
  pendingSweep: boolean = false
): Promise<void> => {
  cronLogger.info(`[releaseAddress] Called with tempAddressId=${tempAddressId}, adminFeeAmount=${adminFeeAmount}, gasUsed=${gasUsed}, pendingSweep=${pendingSweep}`);
  
  const poolAddress = await merchantTempAddressModel.findByPk(tempAddressId);
  
  if (!poolAddress) {
    throw new Error(`Pool address not found: ${tempAddressId}`);
  }

  const walletType = poolAddress.dataValues.wallet_type;
  const sweepConfig = getSweepConfig(walletType);
  const isUTXO = UTXO_CHAINS.includes(walletType);
  const isToken = TOKEN_CHAINS.includes(walletType);

  cronLogger.info(`[releaseAddress] walletType=${walletType}, isUTXO=${isUTXO}, isToken=${isToken}, pendingSweep=${pendingSweep}`);

  const currentAdminBalance = parseFloat(poolAddress.dataValues.admin_fee_balance) || 0;
  const currentGasBalance = parseFloat(poolAddress.dataValues.gas_balance) || 0;
  const currentTxCount = poolAddress.dataValues.total_transactions || 0;

  // For UTXO chains: normally the admin fee is sent in the same multi-output TX,
  // so we don't track it (balance stays 0, status AVAILABLE).
  // EXCEPTION: pendingSweep=true means funds are still in the address (e.g., auto-convert
  // where settleCryptoTransaction failed or account-based fallback was used).
  // In that case, track the balance and keep IN_USE so sweep can pick it up.
  const newAdminBalance = (isUTXO && !pendingSweep) ? currentAdminBalance : (currentAdminBalance + adminFeeAmount);
  
  let newStatus: string;
  if (isUTXO && !pendingSweep) {
    newStatus = "AVAILABLE";
  } else {
    // FIX: All chains (token + native) release as AVAILABLE even with admin fees.
    // This makes addresses with accumulated fees VISIBLE to reserveAddress() and
    // preWarmAddressPool(), enabling fee concentration on fewer addresses instead
    // of spreading across 4+ addresses that never reach sweep threshold.
    // The admin_fee_balance DESC ordering in reservation ensures these addresses
    // are picked FIRST for the next payment.
    // Sweep pipeline (sweepByThreshold/sweepByTime) queries BOTH AVAILABLE and
    // IN_USE statuses, so sweep still finds these addresses.
    // Race safety: sweepByThreshold uses conditional update (only if still AVAILABLE),
    // reservation uses DB row locks (SELECT FOR UPDATE).
    newStatus = "AVAILABLE";
  }

  cronLogger.info(`[releaseAddress] Setting newStatus=${newStatus}, newAdminBalance=${newAdminBalance}`);

  await poolAddress.update({
    status: newStatus,
    admin_fee_balance: newAdminBalance,
    gas_balance: Math.max(0, currentGasBalance - gasUsed),
    total_transactions: currentTxCount + 1,
    current_payment_id: null,
    current_company_id: null,
    expected_amount: null,
    received_amount: null,
    is_partial_payment: false,
    partial_payment_timestamp: null,
    reserved_until: null,
    locked_at: null,
    last_used_at: new Date(),
    last_merchant_payout: (isUTXO && !pendingSweep) ? null : new Date(),
    last_payment_context: null,
  });

  cronLogger.info(`[MerchantPool] ✅ Released address ${poolAddress.dataValues.wallet_address} (${walletType})`);
  cronLogger.info(`[MerchantPool]    - Chain type: ${isUTXO ? 'UTXO' : isToken ? 'Token' : 'Native'}`);
  cronLogger.info(`[MerchantPool]    - New status: ${newStatus}`);
  cronLogger.info(`[MerchantPool]    - Admin fee balance: ${newAdminBalance}`);
  
  // Log sweep mode for addresses with admin fees (even though AVAILABLE for reuse)
  if (newAdminBalance > 0) {
    cronLogger.info(`[MerchantPool]    - Sweep mode: ${sweepConfig.mode}:${sweepConfig.value || 'N/A'} (AVAILABLE for reuse + sweep)`);
  }

  if (newStatus === "AVAILABLE") {
    try {
      const subResult = await tatumApi.createSubscription(
        poolAddress.dataValues.wallet_address,
        walletType,
        true
      );
      if (subResult?.id) {
        await poolAddress.update({ subscription_id: subResult.id });
        cronLogger.info(`[MerchantPool]    - Subscription renewed: ${subResult.id}`);
      }
    } catch (subError) {
      cronLogger.warn(`[MerchantPool]    - ⚠️ Failed to renew subscription (will retry on next reserve)`);
    }
  }
};

/**
 * Cleanup stale addresses (safety net)
 */
export const cleanupStaleAddresses = async (
  walletType?: string
): Promise<number> => {
  const safetyTimeout = new Date();
  safetyTimeout.setMinutes(safetyTimeout.getMinutes() - POOL_CONFIG.STALE_LOCK_TIMEOUT_MINUTES);

  const sweepingTimeout = new Date();
  sweepingTimeout.setMinutes(sweepingTimeout.getMinutes() - 10);

  const whereClause: Record<string, unknown> = {
    [Op.or]: [
      {
        status: { [Op.in]: ["RESERVED", "PROCESSING"] },
        locked_at: { [Op.lt]: safetyTimeout },
      },
      {
        status: "SWEEPING",
        updated_at: { [Op.lt]: sweepingTimeout },
      },
    ],
  };

  if (walletType) whereClause.wallet_type = walletType;

  const stuckAddresses = await merchantTempAddressModel.findAll({ where: whereClause });

  let releasedCount = 0;
  let retryCount = 0;

  for (const address of stuckAddresses) {
    const status = address.dataValues.status;
    const addrStr = address.dataValues.wallet_address;
    
    if (status === "SWEEPING") {
      // Reset to AVAILABLE instead of IN_USE so the address is visible to reservation
      // pipeline for fee concentration. The sweep failed/timed out (>10 min in SWEEPING),
      // so making it available for new payments accumulates more fees. sweepByThreshold
      // will retry the sweep on the next run if threshold is met.
      cronLogger.info(`[MerchantPool] 🔄 Resetting stuck SWEEPING address for reuse: ${addrStr}`);
      await address.update({ status: "AVAILABLE" });
      retryCount++;
    } else {
      cronLogger.info(`[MerchantPool] 🚨 Force-releasing stuck address: ${addrStr}`);
      
      if (address.dataValues.current_payment_id) {
        try {
          const staleDestTag = address.dataValues.destination_tag ? Number(address.dataValues.destination_tag) : null;
          const staleRedisData = await getRedisItem(getCryptoRedisKey(addrStr, staleDestTag));
          let staleCustomerData: Record<string, unknown> = {};
          if (staleRedisData?.ref) {
            staleCustomerData = await getRedisItem(staleRedisData.ref) || {};
          }
          const staleContext = {
            payment_id: address.dataValues.current_payment_id,
            company_id: address.dataValues.current_company_id,
            owner_user_id: address.dataValues.owner_user_id,
            expected_amount: address.dataValues.expected_amount,
            wallet_type: address.dataValues.wallet_type,
            saved_at: new Date().toISOString(),
            saved_by: 'cleanupStaleAddresses',
            fee_payer: staleRedisData?.fee_payer || 'company',
            base_currency: staleRedisData?.base_currency || staleCustomerData?.base_currency || 'USD',
            base_amount: staleRedisData?.base_amount || staleRedisData?.amount || null,
            webhook_url: staleRedisData?.webhook_url || null,
            callback_url: staleRedisData?.callback_url || null,
            link_id: staleRedisData?.link_id || staleCustomerData?.link_id || null,
            ref: staleRedisData?.ref || null,
            adm_id: staleCustomerData?.adm_id || address.dataValues.owner_user_id,
            customer_name: staleCustomerData?.customer_name || null,
            customer_email: staleCustomerData?.customer_email || null,
          };
          await address.update({ last_payment_context: JSON.stringify(staleContext) });
          cronLogger.info(`[MerchantPool] 💾 Saved context for stuck address ${addrStr}`);
        } catch (ctxErr) {
          cronLogger.warn(`[MerchantPool] ⚠️ Failed to save context for stuck address ${addrStr}`);
        }
      }
      
      await address.update({
        status: "AVAILABLE",
        current_payment_id: null,
        current_company_id: null,
        expected_amount: null,
        reserved_until: null,
        locked_at: null,
      });
      releasedCount++;
    }
  }

  if (releasedCount > 0) {
    cronLogger.info(`[MerchantPool] 🚨 Force-released ${releasedCount} stuck addresses`);
  }
  if (retryCount > 0) {
    cronLogger.info(`[MerchantPool] 🔄 Reset ${retryCount} stuck SWEEPING addresses for retry`);
  }

  return releasedCount + retryCount;
};

/**
 * Process queued payments (arrived during sweep)
 */
export const processQueuedPayments = async (tempAddressId: number): Promise<void> => {
  cronLogger.info(`[MerchantPool] Processing queued payments for address ${tempAddressId}`);
};


// ═══════════════════════════════════════════════════════════════════════
// PERF FIX 3: Pre-reserved Address Pool
// ═══════════════════════════════════════════════════════════════════════

/**
 * Number of addresses to keep pre-reserved per merchant per currency.
 * Env-tunable via MERCHANT_PRE_RESERVE_TARGET (see POOL_CONFIG). A larger value
 * gives the lock-free fast path more burst headroom for flash-sales.
 */
const PRE_RESERVE_TARGET = POOL_CONFIG.PRE_RESERVE_TARGET;

/**
 * Replenish pre-reserved addresses for a specific merchant+currency.
 * Called after a pre-reserved address is consumed (fire-and-forget).
 */
export const replenishPreReservedPool = async (
  userId: number,
  walletType: string,
): Promise<number> => {
  const lockKey = `pre-reserve:${userId}:${walletType}`;
  
  try {
    const lockResult = await withLock(lockKey, async () => {
      // Count current pre-reserved
      const currentCount = await merchantTempAddressModel.count({
        where: {
          owner_user_id: userId,
          wallet_type: walletType,
          status: "PRE_RESERVED",
        },
      });

      const needed = PRE_RESERVE_TARGET - currentCount;
      if (needed <= 0) return 0;
      
      // Find AVAILABLE addresses to pre-reserve (prioritize highest admin_fee_balance for concentration)
      const availableAddresses = await merchantTempAddressModel.findAll({
        where: {
          owner_user_id: userId,
          wallet_type: walletType,
          status: "AVAILABLE",
        },
        order: [
          ["admin_fee_balance", "DESC"],
          ["total_transactions", "DESC"],
        ],
        limit: needed,
      });
      
      let preReservedCount = 0;
      for (const addr of availableAddresses) {
        await addr.update({ status: "PRE_RESERVED" });
        preReservedCount++;
      }
      
      if (preReservedCount > 0) {
        cronLogger.info(`[MerchantPool] 🔥 Pre-reserved ${preReservedCount} ${walletType} addresses for merchant ${userId} (target: ${PRE_RESERVE_TARGET})`);
      }
      
      return preReservedCount;
    }, 30, true); // silent=true: suppress lock acquire/release logs for pre-reserve (high frequency)
    
    return lockResult.success ? (lockResult.result as number) : 0;
  } catch (err) {
    cronLogger.warn(`[MerchantPool] Pre-reserve replenish failed for ${userId}/${walletType}: ${(err as Error).message}`);
    return 0;
  }
};

/**
 * Pre-warm the address pool for ALL active merchants.
 * Called by cron job every 2 minutes. Ensures each merchant with pool addresses
 * has PRE_RESERVE_TARGET addresses ready for instant reservation.
 */
export const preWarmAddressPool = async (): Promise<void> => {
  try {
    // Find all distinct merchant+currency combos that have addresses
    const activePools = await merchantTempAddressModel.findAll({
      attributes: ['owner_user_id', 'wallet_type'],
      where: {
        status: { [Op.in]: ["AVAILABLE", "PRE_RESERVED"] },
      },
      group: ['owner_user_id', 'wallet_type'],
      raw: true,
    }) as unknown as Array<{ owner_user_id: number; wallet_type: string }>;

    let totalPreReserved = 0;
    for (const pool of activePools) {
      const count = await replenishPreReservedPool(pool.owner_user_id, pool.wallet_type);
      totalPreReserved += count;
    }

    if (totalPreReserved > 0) {
      cronLogger.info(`[MerchantPool] 🔥 Pre-warm complete: ${totalPreReserved} addresses pre-reserved across ${activePools.length} pools`);
    }
  } catch (err) {
    cronLogger.error(`[MerchantPool] Pre-warm failed: ${(err as Error).message}`);
  }
};
