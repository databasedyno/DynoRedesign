/**
 * Merchant Pool Monitoring
 * 
 * Handles subscription health, missed payment detection, and orphan payment recovery.
 */

import { Op } from "sequelize";
import {
  merchantTempAddressModel,
  merchantPoolTransactionModel,
  customerTransactionModel,
} from "../../models";
import { getRedisItem, setRedisItem, setRedisItemWithTTL, deleteRedisItem } from "../../utils/redisInstance";
import tatumApi from "../../apis/tatumApi";
import { getErrorMessage } from "../../helper";
import { cronLogger } from "../../utils/loggers";
import { paymentController } from "../../controller";
import { deliverMerchantWebhook } from "../outbox/merchantWebhookOutbox";
import {
  POOL_CONFIG,
  TOKEN_CHAINS,
  WEBHOOK_GRACE_PERIOD_MINUTES,
  getCryptoRedisKey,
  isTagBasedChain,
} from "./merchantPoolConfig";
import { recordPoolTransaction } from "./merchantPoolTransaction";

/**
 * Subscription Health Monitor
 */
export const ensurePoolSubscriptions = async (): Promise<{
  checked: number;
  valid: number;
  resubscribed: number;
  failed: number;
  errors: string[];
}> => {
  const result = {
    checked: 0,
    valid: 0,
    resubscribed: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    cronLogger.info("[MerchantPool] 🔍 Starting subscription health check...");

    const activeSubscriptions = await tatumApi.listAllSubscriptions();
    
    const activeSubsMap = new Map<string, Record<string, unknown>>();
    for (const sub of activeSubscriptions as Array<{ attr?: { address?: string }; id?: string }>) {
      const address = sub.attr?.address?.toLowerCase();
      if (address) {
        activeSubsMap.set(address, sub as Record<string, unknown>);
      }
    }
    
    cronLogger.info(`[MerchantPool] 📋 Found ${activeSubscriptions.length} active Tatum subscriptions`);

    const poolAddresses = await merchantTempAddressModel.findAll({
      attributes: ['temp_address_id', 'wallet_address', 'wallet_type', 'status', 'subscription_id'],
    });

    cronLogger.info(`[MerchantPool] 📋 Found ${poolAddresses.length} merchant pool addresses in DB`);

    for (const addr of poolAddresses) {
      result.checked++;
      
      const walletAddressOriginal = addr.dataValues.wallet_address;
      const walletAddressLower = walletAddressOriginal.toLowerCase();
      const dbSubId = addr.dataValues.subscription_id;
      const walletType = addr.dataValues.wallet_type;
      
      // FIX: BCH CashAddr format includes "bitcoincash:" prefix in DB,
      // but Tatum stores just the hash part. Try both formats for lookup.
      let activeSub = activeSubsMap.get(walletAddressLower);
      if (!activeSub && walletAddressLower.startsWith('bitcoincash:')) {
        const bchHash = walletAddressLower.replace('bitcoincash:', '');
        activeSub = activeSubsMap.get(bchHash);
      }
      // Also handle ecash: prefix (BCH fork) and other prefixed formats
      if (!activeSub && walletAddressLower.includes(':')) {
        const hashOnly = walletAddressLower.split(':')[1];
        if (hashOnly) {
          activeSub = activeSubsMap.get(hashOnly);
        }
      }

      if (activeSub && dbSubId === activeSub.id) {
        result.valid++;
        continue;
      }

      if (activeSub && dbSubId !== activeSub.id) {
        cronLogger.info(`[MerchantPool] 🔄 Updating subscription ID for ${walletAddressOriginal}: ${dbSubId} -> ${activeSub.id}`);
        await addr.update({ subscription_id: activeSub.id });
        result.valid++;
        continue;
      }

      if (!activeSub) {
        cronLogger.info(`[MerchantPool] ⚠️ Missing subscription for ${walletAddressOriginal} (${walletType}), creating...`);
        
        try {
          const newSub = await tatumApi.createSubscription(walletAddressOriginal, walletType, true);
          
          if (newSub?.id) {
            await addr.update({ subscription_id: newSub.id });
            cronLogger.info(`[MerchantPool] ✅ Created subscription for ${walletAddressOriginal}: ${newSub.id}`);
            result.resubscribed++;
          } else {
            throw new Error("No subscription ID returned");
          }
        } catch (subError: unknown) {
          const err = subError as { response?: { data?: { errorCode?: string; message?: string } }; message?: string };
          const errorData = err.response?.data;
          if (errorData?.errorCode === 'subscription.exists.on.address-and-currency') {
            const match = errorData.message?.match(/already exists \(([a-f0-9]+)\)/);
            if (match && match[1]) {
              const existingSubId = match[1];
              cronLogger.info(`[MerchantPool] 🔄 Subscription already exists, updating DB: ${existingSubId}`);
              await addr.update({ subscription_id: existingSubId });
              result.valid++;
              continue;
            }
          }
          
          cronLogger.error(`[MerchantPool] ❌ Failed to create subscription for ${walletAddressOriginal}: ${err.message}`);
          result.failed++;
          result.errors.push(`${walletAddressOriginal}: ${err.message}`);
        }
      }
    }

    cronLogger.info(`[MerchantPool] ✅ Subscription health check complete:`);
    cronLogger.info(`   - Checked: ${result.checked}`);
    cronLogger.info(`   - Valid: ${result.valid}`);
    cronLogger.info(`   - Re-subscribed: ${result.resubscribed}`);
    cronLogger.info(`   - Failed: ${result.failed}`);

    if (result.errors.length > 0) {
      cronLogger?.warn?.("Subscription health check had failures", { errors: result.errors });
    }

  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.error("[MerchantPool] ❌ Subscription health check failed:", err.message);
    cronLogger?.error?.("Subscription health check failed", {}, error as Error);
    result.errors.push(`Global error: ${err.message}`);
  }

  return result;
};

/**
 * Fallback mechanism to check for missed payments when webhooks fail.
 * 
 * HARDENED: 
 * - Concurrency control (max 5 parallel address checks)
 * - Per-address timeout protection (30s per address)
 * - Rate limiting between batches to avoid API throttling
 * - Per-address error isolation (one failure doesn't block others)
 * - Circuit breaker: stops if >50% of addresses fail (API may be down)
 */
const CONCURRENCY_LIMIT = 5;
const PER_ADDRESS_TIMEOUT_MS = 30000;
const BATCH_DELAY_MS = 500; // 500ms between batches to avoid rate limiting
const CIRCUIT_BREAKER_THRESHOLD = 0.5; // Stop if >50% fail

export const checkMissedPayments = async (): Promise<{
  checked: number;
  found: number;
  processed: number;
  alreadyProcessed: number;
  skippedTooRecent: number;
  released: number;
  errors: string[];
  timing?: { totalMs: number; avgPerAddressMs: number };
}> => {
  const startTime = Date.now();
  const result = {
    checked: 0,
    found: 0,
    processed: 0,
    alreadyProcessed: 0,
    skippedTooRecent: 0,
    released: 0,
    errors: [] as string[],
    timing: { totalMs: 0, avgPerAddressMs: 0 },
  };

  try {
    cronLogger.info("[MerchantPool] 🔍 Checking for missed payments (webhook fallback)...");
    cronLogger.info(`[MerchantPool] ⏱️ Webhook grace period: ${WEBHOOK_GRACE_PERIOD_MINUTES} minutes`);

    const reservedAddresses = await merchantTempAddressModel.findAll({
      where: { status: 'RESERVED' },
      attributes: [
        'temp_address_id', 'wallet_address', 'wallet_type', 'owner_user_id',
        'current_company_id', 'current_payment_id', 'reserved_until',
        'expected_amount', 'received_amount', 'admin_fee_balance',
        'is_partial_payment', 'partial_payment_timestamp', 'destination_tag'
      ],
    });

    // Quiet mode: only log when there are reserved addresses to check or actual results
    if (reservedAddresses.length === 0) {
      return result;
    }
    cronLogger.info(`[MerchantPool] 📋 Found ${reservedAddresses.length} reserved addresses to check (concurrency: ${CONCURRENCY_LIMIT}, timeout: ${PER_ADDRESS_TIMEOUT_MS}ms)`);

    // Process addresses in batches with concurrency limit
    let consecutiveErrors = 0;
    const totalAddresses = reservedAddresses.length;

    for (let batchStart = 0; batchStart < totalAddresses; batchStart += CONCURRENCY_LIMIT) {
      // Circuit breaker: if too many errors, API might be down
      if (result.checked > 0 && result.errors.length / result.checked > CIRCUIT_BREAKER_THRESHOLD && result.errors.length > 3) {
        cronLogger.error(`[MerchantPool] 🛑 Circuit breaker triggered: ${result.errors.length}/${result.checked} addresses failed (>${CIRCUIT_BREAKER_THRESHOLD * 100}%). Stopping.`);
        result.errors.push(`Circuit breaker: stopped after ${result.checked} addresses, ${result.errors.length} failures`);
        break;
      }

      const batch = reservedAddresses.slice(batchStart, batchStart + CONCURRENCY_LIMIT);
      
      // Process batch concurrently with per-address timeout
      await Promise.allSettled(batch.map(async (addr) => {
        const addrStartTime = Date.now();
        return Promise.race([
          processAddress(addr, result),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${PER_ADDRESS_TIMEOUT_MS}ms`)), PER_ADDRESS_TIMEOUT_MS)
          ),
        ]).catch((timeoutErr: Error) => {
          const wa = addr.dataValues.wallet_address;
          cronLogger.error(`[MerchantPool] ⏰ ${wa} — address processing timed out after ${Date.now() - addrStartTime}ms`);
          result.errors.push(`Timeout for ${wa}: ${timeoutErr.message}`);
        });
      }));

      // Rate limiting between batches
      if (batchStart + CONCURRENCY_LIMIT < totalAddresses) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Timing metrics
    result.timing = {
      totalMs: Date.now() - startTime,
      avgPerAddressMs: result.checked > 0 ? Math.round((Date.now() - startTime) / result.checked) : 0,
    };

    // Quiet mode: only log detailed stats when something meaningful happened
    const hasActivity = result.found > 0 || result.processed > 0 || result.released > 0 || result.errors.length > 0;
    if (hasActivity) {
      cronLogger.info(`[MerchantPool] ✅ Missed payment check complete:`);
      cronLogger.info(`[MerchantPool]   - Checked: ${result.checked}/${totalAddresses}`);
      cronLogger.info(`[MerchantPool]   - Found: ${result.found}, Processed: ${result.processed}, Already: ${result.alreadyProcessed}`);
      cronLogger.info(`[MerchantPool]   - Skipped (recent): ${result.skippedTooRecent}, Released (stuck): ${result.released}`);
      cronLogger.info(`[MerchantPool]   - Timing: ${result.timing.totalMs}ms total, ${result.timing.avgPerAddressMs}ms avg/addr`);
      if (result.errors.length > 0) {
        cronLogger.info(`[MerchantPool]   - Errors: ${result.errors.length}`);
      }
    }
    
  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.error("[MerchantPool] ❌ Missed payment check failed:", err.message);
    result.errors.push(`Global error: ${err.message}`);
    result.timing = { totalMs: Date.now() - startTime, avgPerAddressMs: 0 };
  }

  return result;
};

/**
 * Process a single address for missed payment detection.
 * Extracted from the main loop for timeout/concurrency wrapping.
 */
const processAddress = async (addr: any, result: {
  checked: number; found: number; processed: number; alreadyProcessed: number;
  skippedTooRecent: number; released: number; errors: string[];
}): Promise<void> => {
    result.checked++;
      
      const walletAddress = addr.dataValues.wallet_address;
      const walletType = addr.dataValues.wallet_type;
      const currentPaymentId = addr.dataValues.current_payment_id;
      const expectedAmount = parseFloat(addr.dataValues.expected_amount || '0');
      const ownerId = addr.dataValues.owner_user_id;
      const companyId = addr.dataValues.current_company_id;
      const reservedUntil = addr.dataValues.reserved_until ? new Date(addr.dataValues.reserved_until) : null;
      const destinationTag = addr.dataValues.destination_tag ? Number(addr.dataValues.destination_tag) : null;
      const cryptoRedisKey = getCryptoRedisKey(walletAddress, destinationTag);
      const now = new Date();
      
      if (!reservedUntil) {
        // BUG-6 DEFINITIVE FIX: Instead of just skipping, auto-release addresses
        // stuck in IN_USE with no reserved_until timestamp. This address is permanently 
        // stuck and will never expire on its own. The previous fix (BUG-7) only handled 
        // NaN dates but not NULL dates — this closes that gap.
        const updatedAtCheck = addr.dataValues.updatedAt ? new Date(addr.dataValues.updatedAt) : null;
        const updatedAtMs = updatedAtCheck ? updatedAtCheck.getTime() : 0;
        const stuckDurationMs = updatedAtMs > 0 ? (Date.now() - updatedAtMs) : Infinity;
        const stuckMinutes = stuckDurationMs / 60000;
        
        // Auto-release if stuck for more than 2 hours with no reserved_until
        if (stuckMinutes > 120) {
          cronLogger.warn(`[MerchantPool] ⚠️ BUG-6 FIX: ${walletAddress} (${walletType}) stuck IN_USE with no reserved_until for ${stuckMinutes > 1440 ? (stuckMinutes/1440).toFixed(1) + ' days' : stuckMinutes.toFixed(0) + ' min'} — auto-releasing`);
          const MerchantTempAddress = require("../../models/merchantPoolModels/merchantTempAddressModel").default;
          
          // Clear all reservation fields and set status to AVAILABLE
          await MerchantTempAddress.update(
            { 
              status: 'AVAILABLE', 
              current_payment_id: null, 
              expected_amount: null, 
              reserved_until: null, 
              current_company_id: null,
              // NOTE: Preserve admin_fee_balance — accumulated fees from prior
              // settlements must NOT be wiped. Only sweep should reset to 0.
            },
            { where: { wallet_address: walletAddress } }
          );
          cronLogger.info(`[MerchantPool] ✅ BUG-6 FIX: Released stuck address ${walletAddress} — now AVAILABLE`);
          result.released++;
        } else {
          cronLogger.info(`[MerchantPool] ⏭️ Skipping ${walletAddress} - no reserved_until but updated recently (${stuckMinutes.toFixed(0)} min ago)`);
        }
        return;
      }
      
      const minutesUntilExpiry = (reservedUntil.getTime() - now.getTime()) / 60000;
      const minutesSinceReserved = POOL_CONFIG.RESERVATION_TIMEOUT_MINUTES - minutesUntilExpiry;
      
      // FIX BUG-7: Handle NaN reserved_until (invalid date in DB) — auto-release the stuck address
      if (isNaN(minutesSinceReserved) || isNaN(minutesUntilExpiry)) {
        cronLogger.warn(`[MerchantPool] ⚠️ BUG-7 FIX: ${walletAddress} (${walletType}) has NaN reserved_until — releasing stuck address`);
        const MerchantTempAddress = require("../../models/merchantPoolModels/merchantTempAddressModel").default;
        await MerchantTempAddress.update(
          { status: 'AVAILABLE', current_payment_id: null, expected_amount: null, reserved_until: null, current_company_id: null },
          { where: { wallet_address: walletAddress } }
        );
        cronLogger.info(`[MerchantPool] ✅ Released stuck address ${walletAddress} — now AVAILABLE`);
        return;
      }
      
      if (minutesSinceReserved < WEBHOOK_GRACE_PERIOD_MINUTES) {
        result.skippedTooRecent++;
        if (minutesSinceReserved > 5) {
          cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - reserved ${minutesSinceReserved.toFixed(1)} min ago (waiting for ${WEBHOOK_GRACE_PERIOD_MINUTES} min grace period)`);
        }
        return;
      }

      try {
        // FIX BUG-3: Check if this address is being actively processed by a webhook handler.
        // The webhook processor stores data in Redis (via cryptoRedisKey) during processing.
        // If the Redis key has an active status (processing/retrying), the balance API may
        // return stale data (e.g., 0 for unconfirmed mempool txs). Skip to avoid false "no balance".
        const activeRedisData = await getRedisItem(cryptoRedisKey);
        if (activeRedisData && typeof activeRedisData === 'object') {
          const activeStatus = (activeRedisData as Record<string, unknown>).status as string | undefined;
          const activeTxId = (activeRedisData as Record<string, unknown>).txId as string | undefined;
          // FIX (2026-04-10): Only skip balance check when a webhook IS actively being processed
          // (status is processing/retrying/detected AND txId exists). When status is "pending"
          // with txId=undefined, it means no webhook was received yet — the balance check is the
          // ONLY safety net to detect the payment. Previously, "pending" was in the skip list,
          // causing $33 USDT-ERC20 payment to go undetected after the spam filter rejected the webhook.
          const hasActiveTxId = !!activeTxId && activeTxId !== 'undefined';
          if (activeStatus && hasActiveTxId && ['processing', 'retrying', 'detected'].includes(activeStatus)) {
            cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} — webhook actively processing (status=${activeStatus}, txId=${activeTxId?.substring(0, 12)}...), skipping balance check`);
            result.skippedTooRecent++;
            return;
          }
        }

        let balance: number;
        let balanceResult;

        // FIX: For tag-based chains (XRP/RLUSD), the on-chain balance is for the
        // master address (shared across all destination tags). Instead, use
        // getIncomingTransactions filtered by destination tag to determine actual payments.
        if (isTagBasedChain(walletType) && destinationTag) {
          try {
            const taggedTxs = await tatumApi.getIncomingTransactions(walletAddress, walletType, 20, destinationTag);
            const taggedTotal = taggedTxs.reduce((sum, tx) => sum + tx.amount, 0);
            balance = taggedTotal;
            cronLogger.info(`[MerchantPool] 🏷️ ${walletAddress} tag:${destinationTag} — incoming txs for this tag: ${taggedTxs.length}, total: ${taggedTotal} ${walletType}`);
          } catch (tagErr: unknown) {
            const err = tagErr as { message?: string };
            // If tag-filtered lookup fails, fallback to received_amount from DB
            const dbReceivedAmount = parseFloat(addr.dataValues.received_amount || '0');
            if (dbReceivedAmount > 0) {
              balance = dbReceivedAmount;
              cronLogger.info(`[MerchantPool] 🏷️ ${walletAddress} tag:${destinationTag} — tx lookup failed (${err?.message}), using DB received_amount: ${dbReceivedAmount}`);
            } else {
              cronLogger.warn(`[MerchantPool] ⚠️ ${walletAddress} tag:${destinationTag} — tx lookup failed and no DB received_amount, skipping`);
              return;
            }
          }
        } else {
          try {
            balanceResult = await tatumApi.getAddressBalance(walletAddress, walletType);
          } catch (balanceError: unknown) {
            const balErr = balanceError as { message?: string };
            const errMsg = balErr.message || '';
            if (errMsg.includes('account.not.found') || errMsg.includes('not.found')) {
              cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - account not yet activated on-chain (${walletType}), skipping`);
              return;
            }
            throw balanceError;
          }
          balance = parseFloat(balanceResult?.balance || '0');
          // NaN guard: if balance parsing fails (e.g., API returned unexpected format),
          // log a warning instead of silently treating as "no balance"
          if (!Number.isFinite(balance)) {
            cronLogger.warn(`[MerchantPool] ⚠️ ${walletAddress} - balance parsed as NaN for ${walletType}, raw: ${JSON.stringify(balanceResult?.balance)}. Skipping (potential API issue).`);
            return;
          }
        }

        if (balance <= 0) {
          cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - no balance (customer hasn't paid)`);
          return;
        }

        // ═══════════════════════════════════════════════════════════════════
        // ADMIN FEE BASELINE SUBTRACTION
        // Pool addresses may hold residual admin fees from previous transactions.
        // The on-chain balance includes these old fees. We must subtract them
        // to determine if a NEW payment has actually been received.
        // ═══════════════════════════════════════════════════════════════════
        const adminFeeBalance = parseFloat(addr.dataValues.admin_fee_balance || '0');
        const effectiveBalance = Math.max(0, balance - adminFeeBalance);
        
        if (adminFeeBalance > 0) {
          cronLogger.info(`[MerchantPool] 📊 ${walletAddress} — on-chain: ${balance} ${walletType}, admin_fee_residual: ${adminFeeBalance}, effective_new_payment: ${effectiveBalance.toFixed(8)}`);
        }

        // Skip dust balances — leftover gas residue is not a real payment
        const DUST_THRESHOLDS: Record<string, number> = {
          ETH: 0.0005,      // ~$1
          BTC: 0.00002,     // ~$1
          LTC: 0.01,        // ~$1
          DOGE: 5,           // ~$1
          TRX: 5,            // ~$1
          'USDT-ERC20': 0.5,
          'USDT-TRC20': 0.5,
          'USDC-ERC20': 0.5,
          'RLUSD': 0.5,
          'RLUSD-ERC20': 0.5,
          'USDT-POLYGON': 0.5,
        };
        const dustThreshold = DUST_THRESHOLDS[walletType] || 0.001;
        
        // Use effectiveBalance (after admin fee subtraction) for dust check
        if (effectiveBalance < dustThreshold) {
          cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - effective balance ${effectiveBalance.toFixed(8)} ${walletType} is admin fee residual (on-chain: ${balance}, admin_fee: ${adminFeeBalance}), skipping`);
          return;
        }

        // Skip if expected_amount is 0 — no payment was actually requested for this address
        if (expectedAmount <= 0) {
          cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - expected_amount is ${expectedAmount}, likely stale reservation with dust. Skipping.`);
          return;
        }

        cronLogger.info(`[MerchantPool] 💰 ${walletAddress} has balance: ${effectiveBalance.toFixed(8)} ${walletType} (on-chain: ${balance}, admin_fee: ${adminFeeBalance}, reserved ${minutesSinceReserved.toFixed(1)} min ago)`);

        let redisData = await getRedisItem(cryptoRedisKey);
        
        if (redisData?.txId) {
          // BUG FIX: If status is "failed" or "permanently_failed", the webhook fired but settlement FAILED.
          // We already have the txId, receivedAmount, and full payment context in Redis.
          // Directly reprocess instead of waiting for Tatum tx discovery (which may fail for ERC20 tokens).
          // NOTE: "permanently_failed" can be caused by gas race conditions (eth.tx.preparation)
          //   where gas funding TX was in-flight during settlement. By now, gas should be on-chain.
          //   The pool monitor runs every 5 min — plenty of time for ETH gas to confirm.
          const isFailedRecoverable = redisData?.status === 'failed' || redisData?.status === 'permanently_failed' || redisData?.status === 'gas_pending';
          if (isFailedRecoverable) {
            const savedTxId = redisData.txId;
            const savedReceivedAmount = parseFloat(redisData.receivedAmount || '0');
            cronLogger.info(`[MerchantPool] ⚠️ ${walletAddress} - ${redisData.status === 'permanently_failed' ? 'PERMANENTLY ' : ''}FAILED PAYMENT RECOVERY (txId: ${savedTxId})`);
            cronLogger.info(`[MerchantPool]   - Status: ${redisData.status}`);
            cronLogger.info(`[MerchantPool]   - Permanent fail reason: ${redisData.permanentFailReason || 'N/A'}`);
            cronLogger.info(`[MerchantPool]   - Error: ${redisData.lastError || 'unknown'}`);
            cronLogger.info(`[MerchantPool]   - Failed at: ${redisData.failedAt || redisData.permanentlyFailedAt || 'unknown'}`);
            cronLogger.info(`[MerchantPool]   - Received amount: ${savedReceivedAmount} ${walletType}`);
            cronLogger.info(`[MerchantPool] 🔄 Directly reprocessing with preserved payment context...`);
            
            // Update Redis: set status to processing, remove error fields, keep all context
            const recoveryData = { ...redisData };
            delete recoveryData.failedAt;
            delete recoveryData.lastError;
            recoveryData.status = 'processing';
            recoveryData.retryFromFailed = 'true';
            recoveryData.retriedAt = new Date().toISOString();
            // Keep txId and receivedAmount — they are correct from the original webhook
            
            await setRedisItem(cryptoRedisKey, recoveryData);
            cronLogger.info(`[MerchantPool] 📝 Redis restored: status=processing, txId=${savedTxId}, ref=${recoveryData.ref}`);
            
            // Mark the tx as NOT already processed so cryptoVerification won't skip it
            const processedTxKey = `processed-tx-${savedTxId}`;
            await deleteRedisItem(processedTxKey);
            
            // FIX: Send pending notification for failed payment recovery too
            try {
              const { sendPendingPaymentNotification } = await import("../pendingPaymentService");
              await sendPendingPaymentNotification(
                walletAddress,
                savedTxId,
                savedReceivedAmount,
                walletType,
                {
                  adm_id: ownerId,
                  company_id: companyId,
                }
              );
              cronLogger.info(`[MerchantPool] 📧 Pending notification sent for recovered payment on ${walletAddress}`);
            } catch (notifError: unknown) {
              const notifErr = notifError as { message?: string };
              cronLogger.warn(`[MerchantPool] ⚠️ Failed to send pending notification (non-critical): ${notifErr?.message}`);
            }

            // Directly call cryptoVerification — all data is in Redis
            try {
              const verificationResult = await paymentController.cryptoVerification(walletAddress, true, cryptoRedisKey) as { duplicate?: boolean; status?: number; paymentStatus?: string };
              
              if (verificationResult?.duplicate) {
                cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - Payment already processed (duplicate)`);
                result.alreadyProcessed++;
              } else if (verificationResult?.status === 200 || verificationResult?.paymentStatus === 'completed' || verificationResult?.paymentStatus === 'complete') {
                cronLogger.info(`[MerchantPool] ✅ FAILED PAYMENT RECOVERED: ${walletAddress} — ${savedReceivedAmount} ${walletType} (txId: ${savedTxId})`);
                result.processed++;
              } else {
                cronLogger.info(`[MerchantPool] ⚠️ Recovery returned:`, JSON.stringify(verificationResult));
                result.errors.push(`Recovery returned unexpected result for ${walletAddress}: ${JSON.stringify(verificationResult)}`);
              }
            } catch (verifyError: unknown) {
              const err = verifyError as { paymentStatus?: string; amount?: number; message?: string; status?: number };
              if (err?.paymentStatus === 'incomplete') {
                cronLogger.info(`[MerchantPool] 📋 Partial payment recovered for ${walletAddress}`);
                result.processed++;
              } else {
                // Mark as failed again so next cron cycle can retry
                const failedData = { ...recoveryData, status: 'failed', failedAt: new Date().toISOString(), lastError: err?.message || 'cryptoVerification failed on retry' };
                await setRedisItem(cryptoRedisKey, failedData);
                cronLogger.error(`[MerchantPool] ❌ Recovery failed for ${walletAddress}: ${err?.message || verifyError}`);
                result.errors.push(`Recovery failed for ${walletAddress}: ${err?.message}`);
              }
            }
            return;
          } else {
            cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - Redis has txId (webhook already fired): ${redisData.txId}`);
            result.alreadyProcessed++;
            return;
          }
        }
        
        if (redisData?.status === 'processing' || redisData?.status === 'retrying') {
          cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - Webhook currently processing (status: ${redisData.status})`);
          result.alreadyProcessed++;
          return;
        }

        if (redisData?.incomplete === 'true' || redisData?.incomplete === true) {
          const receivedSoFar = parseFloat(redisData?.receivedAmount || '0');
          const originalExpected = parseFloat(redisData?.originalExpectedAmount || redisData?.amount || '0');
          const remaining = originalExpected - receivedSoFar;
          
          cronLogger.info(`[MerchantPool] ⏸️ ${walletAddress} - PARTIAL PAYMENT in progress`);
          cronLogger.info(`[MerchantPool]    - Received so far: ${receivedSoFar} ${walletType}`);
          cronLogger.info(`[MerchantPool]    - Expected: ${originalExpected} ${walletType}`);
          cronLogger.info(`[MerchantPool]    - Remaining: ${remaining} ${walletType}`);
          
          const partialTimestamp = redisData?.partialPaymentTimestamp;
          if (partialTimestamp) {
            const partialTime = new Date(partialTimestamp);
            const minutesSincePartial = (now.getTime() - partialTime.getTime()) / 60000;
            
            if (minutesSincePartial < 20) {
              cronLogger.info(`[MerchantPool] ⏭️ Waiting for completion - partial received ${minutesSincePartial.toFixed(1)} min ago`);
              result.skippedTooRecent++;
              return;
            } else {
              cronLogger.info(`[MerchantPool] ⚠️ Partial payment expired (${minutesSincePartial.toFixed(1)} min) - will process as-is`);
            }
          }
        }

        const poolAddressRecord = await merchantTempAddressModel.findOne({
          where: { wallet_address: walletAddress }
        });
        
        if (poolAddressRecord?.dataValues?.is_partial_payment === true) {
          const dbReceivedAmount = parseFloat(poolAddressRecord.dataValues.received_amount || '0');
          const dbExpectedAmount = parseFloat(poolAddressRecord.dataValues.expected_amount || '0');
          const partialTimestamp = poolAddressRecord.dataValues.partial_payment_timestamp;
          
          cronLogger.info(`[MerchantPool] ⏸️ ${walletAddress} - DB shows partial payment`);
          cronLogger.info(`[MerchantPool]    - DB Received: ${dbReceivedAmount}, Expected: ${dbExpectedAmount}`);
          
          if (partialTimestamp) {
            const partialTime = new Date(partialTimestamp);
            const minutesSincePartial = (now.getTime() - partialTime.getTime()) / 60000;
            
            if (minutesSincePartial < 20) {
              cronLogger.info(`[MerchantPool] ⏭️ Waiting for completion - DB partial ${minutesSincePartial.toFixed(1)} min ago`);
              result.skippedTooRecent++;
              return;
            }
          }
        }

        if (currentPaymentId) {
          const existingTx = await customerTransactionModel.findOne({
            where: {
              [Op.or]: [
                { transaction_reference: currentPaymentId },
                { transaction_reference: { [Op.like]: `%${walletAddress}%` } }
              ],
              status: { [Op.in]: ['successful', 'completed', 'confirmed'] }
            }
          });

          if (existingTx) {
            cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - Already processed in DB (tx: ${existingTx.dataValues.transaction_reference})`);
            result.alreadyProcessed++;
            return;
          }
        }

        const poolTx = await merchantPoolTransactionModel.findOne({
          where: {
            temp_address_id: addr.dataValues.temp_address_id,
            status: { [Op.in]: ['completed', 'swept'] }
          },
          order: [['created_at', 'DESC']]
        });

        if (poolTx) {
          const txCreatedAt = new Date(poolTx.dataValues.created_at);
          const hoursSinceTx = (now.getTime() - txCreatedAt.getTime()) / 3600000;
          
          if (hoursSinceTx < 1) {
            cronLogger.info(`[MerchantPool] ⏭️ ${walletAddress} - Recent pool transaction exists (${hoursSinceTx.toFixed(1)}h ago)`);
            result.alreadyProcessed++;
            return;
          }
        }

        result.found++;
        cronLogger.info(`[MerchantPool] ⚠️ MISSED PAYMENT DETECTED: ${walletAddress}`);
        cronLogger.info(`[MerchantPool]   - On-chain balance: ${balance} ${walletType}`);
        cronLogger.info(`[MerchantPool]   - Admin fee residual: ${adminFeeBalance} ${walletType}`);
        cronLogger.info(`[MerchantPool]   - Effective new payment: ${effectiveBalance.toFixed(8)} ${walletType}`);
        cronLogger.info(`[MerchantPool]   - Expected: ${expectedAmount} ${walletType}`);
        cronLogger.info(`[MerchantPool]   - Payment ID: ${currentPaymentId || 'N/A'}`);
        cronLogger.info(`[MerchantPool]   - Reserved ${minutesSinceReserved.toFixed(1)} min ago`);
        
        const tolerance = expectedAmount * 0.01;
        // Use effectiveBalance (after admin fee subtraction) for underpayment comparison
        const isUnderpayment = effectiveBalance < (expectedAmount - tolerance);
        
        if (isUnderpayment && minutesSinceReserved < 25) {
          cronLogger.info(`[MerchantPool] ⏸️ UNDERPAYMENT detected - waiting for customer to send remaining`);
          cronLogger.info(`[MerchantPool]    - Received (effective): ${effectiveBalance.toFixed(8)} ${walletType}`);
          cronLogger.info(`[MerchantPool]    - Expected: ${expectedAmount} ${walletType}`);
          cronLogger.info(`[MerchantPool]    - Shortfall: ${(expectedAmount - effectiveBalance).toFixed(8)} ${walletType}`);
          cronLogger.info(`[MerchantPool]    - Reserved ${minutesSinceReserved.toFixed(1)} min ago (waiting until 25 min)`);
          result.skippedTooRecent++;
          return;
        }
        
        if (isUnderpayment) {
          cronLogger.info(`[MerchantPool] ⚠️ UNDERPAYMENT - processing as partial (reservation expired)`);
          cronLogger.info(`[MerchantPool]    - Received (effective): ${effectiveBalance.toFixed(8)} ${walletType} (${((effectiveBalance/expectedAmount)*100).toFixed(1)}% of expected)`);
        }
        
        cronLogger.info(`[MerchantPool] 🔄 Fetching transaction details from blockchain...`);
        const incomingTxs = await tatumApi.getIncomingTransactions(walletAddress, walletType, 5);
        
        if (!incomingTxs || incomingTxs.length === 0) {
          // Track repeated failures to avoid infinite retry loops
          const failKey = `missed-check-fail:${walletAddress}`;
          const failData = await getRedisItem(failKey);
          const failCount = parseInt(failData?.count || '0', 10) + 1;
          
          await setRedisItem(failKey, { count: String(failCount), lastCheck: new Date().toISOString() });
          
          if (failCount >= 3) {
            // Before giving up, check if this is a REAL payment with significant balance
            // If address has current_payment_id and effectiveBalance is above dust, try to process using last_payment_context
            const hasPaymentContext = !!currentPaymentId && effectiveBalance > (dustThreshold * 5); // Well above dust
            
            if (hasPaymentContext) {
              cronLogger.info(`[MerchantPool] ⚠️ ${walletAddress} - Tatum tx lookup failed ${failCount} times BUT address has payment context and significant effective balance ${effectiveBalance.toFixed(8)} ${walletType} (on-chain: ${balance}, admin_fee: ${adminFeeBalance})`);
              cronLogger.info(`[MerchantPool] 🔄 Attempting to process using payment context (bypassing tx lookup)...`);
              
              // FIRST: Check if valid Redis data already exists for the CURRENT payment
              // This prevents stale last_payment_context from overwriting correct data
              const existingRedisData = await getRedisItem(cryptoRedisKey);
              const existingRedisIsValid = existingRedisData 
                && existingRedisData.payment_id === currentPaymentId 
                && existingRedisData.webhook_url;
              
              if (existingRedisIsValid) {
                cronLogger.info(`[MerchantPool] ✅ Existing Redis data is valid for current payment ${currentPaymentId} (webhook: ${existingRedisData.webhook_url}). Skipping reconstruction from last_payment_context.`);
                
                // Update status and amounts, but preserve the correct webhook_url and other payment-specific fields
                const updatedRedisData = {
                  ...existingRedisData,
                  status: 'processing',
                  receivedAmount: String(effectiveBalance),
                  originalExpectedAmount: String(expectedAmount),
                  processedByFallback: 'true',
                  txLookupFailed: 'true',
                  lastAttempt: new Date().toISOString(),
                };
                await setRedisItem(cryptoRedisKey, updatedRedisData);
                cronLogger.info(`[MerchantPool] 📝 Updated existing Redis data for ${walletAddress} (preserved webhook_url) — processing via cryptoVerification`);
              } else {
                // No valid Redis data exists — reconstruct from last_payment_context as fallback
                cronLogger.warn(`[MerchantPool] ⚠️ No valid Redis data for current payment ${currentPaymentId}. Falling back to last_payment_context reconstruction.`);
              
              // Try to get last_payment_context from DB — use temp_address_id (unique) instead of wallet_address
              // because XRP/RLUSD share the same master address with different destination tags
              const addrRecord = await merchantTempAddressModel.findOne({ where: { temp_address_id: addr.dataValues.temp_address_id } });
              const lastContextRaw = addrRecord?.dataValues?.last_payment_context;
              let paymentContext = null;
              
              if (lastContextRaw) {
                try {
                  paymentContext = typeof lastContextRaw === 'string' ? JSON.parse(lastContextRaw) : lastContextRaw;
                  cronLogger.info(`[MerchantPool] 📝 Found last_payment_context for ${walletAddress} (payment: ${paymentContext.payment_id})`);
                  
                  // SAFETY CHECK: Warn if last_payment_context is for a DIFFERENT payment than current
                  if (paymentContext.payment_id && paymentContext.payment_id !== currentPaymentId) {
                    cronLogger.warn(`[MerchantPool] ⚠️ STALE CONTEXT DETECTED: last_payment_context is for payment ${paymentContext.payment_id} but current payment is ${currentPaymentId}. Webhook URL may be incorrect!`);
                    // Clear stale context fields that are payment-specific to avoid cross-contamination
                    paymentContext.webhook_url = null;
                    paymentContext.callback_url = null;
                    paymentContext.ref = null;
                    paymentContext.link_id = null;
                  }
                } catch (e) {
                  cronLogger.warn(`[MerchantPool] ⚠️ Failed to parse last_payment_context for ${walletAddress}`);
                }
              }
              
              // Reconstruct Redis data from payment context or DB fields
              // Use effectiveBalance (not raw balance) to exclude admin fee residuals
              const reconstructedRedis = {
                mode: 'CRYPTO',
                amount: String(expectedAmount),
                status: 'processing',
                currency: walletType,
                payment_id: currentPaymentId,
                unique_tx_id: currentPaymentId,
                is_merchant_pool: 'true',
                temp_id: String(addr.dataValues.temp_address_id),
                adm_id: String(paymentContext?.adm_id || ownerId),
                company_id: String(paymentContext?.company_id || companyId),
                receivedAmount: String(effectiveBalance),
                originalExpectedAmount: String(expectedAmount),
                fee_payer: paymentContext?.fee_payer || 'company',
                merchant_amount: paymentContext?.merchant_amount || null,
                base_currency: paymentContext?.base_currency || 'USD',
                base_amount: paymentContext?.base_amount || null,
                webhook_url: paymentContext?.webhook_url || null,
                callback_url: paymentContext?.callback_url || null,
                link_id: paymentContext?.link_id || null,
                ref: paymentContext?.ref || `customer-${currentPaymentId}`,
                pathType: paymentContext?.pathType || 'cryptoPayment',
                processedByFallback: 'true',
                txLookupFailed: 'true',
                lastAttempt: new Date().toISOString(),
              };
              
              // Also reconstruct customer ref
              const custRef = reconstructedRedis.ref;
              const existingCustData = await getRedisItem(custRef);
              if (!existingCustData || Object.keys(existingCustData).length === 0) {
                const custData = {
                  adm_id: reconstructedRedis.adm_id,
                  company_id: reconstructedRedis.company_id,
                  base_currency: reconstructedRedis.base_currency,
                  base_amount: reconstructedRedis.base_amount,
                  fee_payer: reconstructedRedis.fee_payer,
                  merchant_amount: reconstructedRedis.merchant_amount,
                  webhook_url: reconstructedRedis.webhook_url,
                  callback_url: reconstructedRedis.callback_url,
                  link_id: reconstructedRedis.link_id,
                  pathType: reconstructedRedis.pathType,
                  customer_name: paymentContext?.customer_name || null,
                  customer_email: paymentContext?.customer_email || null,
                };
                await setRedisItem(custRef, custData);
                cronLogger.info(`[MerchantPool] 📝 Reconstructed customer data: ${custRef}`);
              }
              
              await setRedisItem(cryptoRedisKey, reconstructedRedis);
              cronLogger.info(`[MerchantPool] 📝 Reconstructed Redis data for ${walletAddress} (key: ${cryptoRedisKey}) — processing via cryptoVerification`);
              } // end: reconstruction else block
              
              // Call cryptoVerification (shared by both valid-Redis and reconstruction paths)
              try {
                const verificationResult = await paymentController.cryptoVerification(walletAddress, true, cryptoRedisKey) as { duplicate?: boolean; status?: number; paymentStatus?: string };
                
                if (verificationResult?.duplicate) {
                  cronLogger.info(`[MerchantPool] ⏭️ Payment already processed (duplicate)`);
                  result.alreadyProcessed++;
                } else if (verificationResult?.status === 200 || verificationResult?.paymentStatus === 'completed' || verificationResult?.paymentStatus === 'complete') {
                  cronLogger.info(`[MerchantPool] ✅ MISSED PAYMENT RECOVERED (via context fallback)!`);
                  cronLogger.info(`[MerchantPool]   - Address: ${walletAddress}, Amount: ${balance} ${walletType}`);
                  result.processed++;
                  
                  cronLogger?.info?.("MISSED PAYMENT RECOVERED VIA CONTEXT", {
                    address: walletAddress,
                    currency: walletType,
                    amount: balance,
                    expectedAmount,
                    paymentId: currentPaymentId,
                    txLookupFailed: true,
                  });
                } else {
                  cronLogger.info(`[MerchantPool] ⚠️ cryptoVerification returned:`, verificationResult);
                  result.errors.push(`Context fallback verification returned unexpected result for ${walletAddress}`);
                }
              } catch (verifyError: unknown) {
                const err = verifyError as { paymentStatus?: string; amount?: number; message?: string };
                if (err?.paymentStatus === 'incomplete') {
                  cronLogger.info(`[MerchantPool] 📋 Partial payment via context fallback - ${err.amount} ${walletType} remaining`);
                  result.processed++;
                } else {
                  cronLogger.error(`[MerchantPool] ❌ Context fallback cryptoVerification failed:`, err.message || verifyError);
                  result.errors.push(`Context fallback verification failed for ${walletAddress}: ${err.message}`);
                }
              }
              
              await deleteRedisItem(failKey);
              return;
            } // end: hasPaymentContext
            
            // No payment context or effective balance too low — admin fee residual, release
            cronLogger.info(`[MerchantPool] ⚠️ ${walletAddress} - No incoming txs found after ${failCount} checks. Effective balance ${effectiveBalance.toFixed(8)} ${walletType} (on-chain: ${balance}, admin_fee: ${adminFeeBalance}) is likely pre-existing admin fee. Releasing address.`);
            await merchantTempAddressModel.update(
              { status: 'AVAILABLE', current_payment_id: null, expected_amount: null, reserved_until: null, current_company_id: null },
              { where: { wallet_address: walletAddress } }
            );
            await deleteRedisItem(failKey);
            result.errors.push(`Released ${walletAddress} after ${failCount} failed tx lookups (dust: ${balance} ${walletType})`);
          } else {
            cronLogger.info(`[MerchantPool] ❌ No incoming transactions found for ${walletAddress} (attempt ${failCount}/3). Will retry.`);
            result.errors.push(`No transactions found for ${walletAddress} (attempt ${failCount}/3)`);
          }
          return;
        }

        const latestTx = incomingTxs[0];
        
        const totalFromTxs = incomingTxs.reduce((sum, tx) => sum + tx.amount, 0);
        cronLogger.info(`[MerchantPool] 📝 Found ${incomingTxs.length} transaction(s): latest txId=${latestTx.txId}`);
        cronLogger.info(`[MerchantPool]    - Latest tx amount: ${latestTx.amount} ${walletType}`);
        cronLogger.info(`[MerchantPool]    - Total from all txs: ${totalFromTxs} ${walletType}`);

        const confirmationCheck = await tatumApi.getTransactionConfirmations(latestTx.txId, walletType);
        
        if (!confirmationCheck.confirmed) {
          cronLogger.info(`[MerchantPool] ⏳ Transaction not yet confirmed - waiting for confirmations`);
          cronLogger.info(`[MerchantPool]    - Current: ${confirmationCheck.confirmations}/${confirmationCheck.required} confirmations`);
          cronLogger.info(`[MerchantPool]    - ${walletType} requires ${confirmationCheck.required} confirmation(s) before processing`);
          result.skippedTooRecent++;
          return;
        }
        
        cronLogger.info(`[MerchantPool] ✅ Transaction confirmed: ${confirmationCheck.confirmations}/${confirmationCheck.required} confirmations`);

        const processedTxKey = `processed-tx-${latestTx.txId}`;
        const alreadyProcessedTx = await getRedisItem(processedTxKey);
        if (alreadyProcessedTx && Object.keys(alreadyProcessedTx).length > 0) {
          cronLogger.info(`[MerchantPool] ⏭️ Transaction ${latestTx.txId} already processed previously. Skipping.`);
          result.alreadyProcessed++;
          return;
        }

        if (!redisData || Object.keys(redisData).length === 0) {
          cronLogger.info(`[MerchantPool] ⚠️ No Redis data for ${walletAddress}, attempting to reconstruct...`);
          
          redisData = {
            mode: 'CRYPTO',
            amount: expectedAmount,
            status: 'pending',
            currency: walletType,
            payment_id: currentPaymentId,
            is_merchant_pool: 'true',
            adm_id: ownerId,
            company_id: companyId,
          };
          
          const customerRef = `customer-${currentPaymentId}`;
          let customerData = await getRedisItem(customerRef);
          
          if (!customerData || Object.keys(customerData).length === 0) {
            customerData = {
              adm_id: ownerId,
              company_id: companyId,
              base_currency: 'USD',
            };
            await setRedisItem(customerRef, customerData);
            cronLogger.info(`[MerchantPool] 📝 Reconstructed customer data: ${customerRef}`);
          }
          
          redisData.ref = customerRef;
        }

        // Use effectiveBalance (minus admin fees) as the actual received amount
        const receivedAmount = effectiveBalance;
        const isPartialPayment = receivedAmount < (expectedAmount - tolerance);
        
        const updatedRedisData = {
          ...redisData,
          status: 'processing',
          receivedAmount: receivedAmount,
          txId: latestTx.txId,
          originalExpectedAmount: expectedAmount,
          retryCount: '0',
          lastAttempt: new Date().toISOString(),
          processedByFallback: 'true',
          incomplete: isPartialPayment ? 'true' : 'false',
          ...(isPartialPayment && {
            partialPaymentTimestamp: new Date().toISOString(),
            remaining: (expectedAmount - receivedAmount).toFixed(8),
          }),
        };
        
        await setRedisItem(cryptoRedisKey, updatedRedisData);
        cronLogger.info(`[MerchantPool] 📝 Updated Redis with txId: ${latestTx.txId} (key: ${cryptoRedisKey})`);
        if (isPartialPayment) {
          cronLogger.info(`[MerchantPool] 📝 Marked as partial payment - received ${receivedAmount}, expected ${expectedAmount}`);
        }

        await setRedisItem(processedTxKey, {
          address: walletAddress,
          amount: receivedAmount,
          expectedAmount,
          isPartialPayment,
          processedAt: new Date().toISOString(),
          processedBy: 'checkMissedPayments',
        });

        // FIX: Send pending payment notification (was missing in checkMissedPayments flow)
        // The webhook handler sends this, but when payment is detected by checkMissedPayments
        // the pending email was never sent. This ensures merchants are notified.
        try {
          const { sendPendingPaymentNotification } = await import("../pendingPaymentService");
          await sendPendingPaymentNotification(
            walletAddress,
            latestTx.txId,
            receivedAmount,
            walletType,
            {
              adm_id: ownerId,
              company_id: companyId,
              amount: expectedAmount,
            }
          );
          cronLogger.info(`[MerchantPool] 📧 Pending payment notification sent for missed payment on ${walletAddress}`);
        } catch (notifError: unknown) {
          const notifErr = notifError as { message?: string };
          cronLogger.warn(`[MerchantPool] ⚠️ Failed to send pending notification (non-critical): ${notifErr?.message}`);
        }

        cronLogger.info(`[MerchantPool] 🚀 Processing missed payment via cryptoVerification...`);
        
        try {
          const verificationResult = await paymentController.cryptoVerification(walletAddress, true, cryptoRedisKey) as { duplicate?: boolean; status?: number; paymentStatus?: string };
          
          if (verificationResult?.duplicate) {
            cronLogger.info(`[MerchantPool] ⏭️ Payment was already processed (duplicate detected)`);
            result.alreadyProcessed++;
          } else if (verificationResult?.status === 200 || verificationResult?.paymentStatus === 'completed' || verificationResult?.paymentStatus === 'complete') {
            cronLogger.info(`[MerchantPool] ✅ MISSED PAYMENT SUCCESSFULLY PROCESSED!`);
            cronLogger.info(`[MerchantPool]   - Address: ${walletAddress}`);
            cronLogger.info(`[MerchantPool]   - Amount: ${receivedAmount} ${walletType}`);
            cronLogger.info(`[MerchantPool]   - TxId: ${latestTx.txId}`);
            cronLogger.info(`[MerchantPool]   - Type: ${isPartialPayment ? 'PARTIAL' : 'FULL'} payment`);
            result.processed++;
            
            cronLogger?.info?.("MISSED PAYMENT RECOVERED", {
              address: walletAddress,
              currency: walletType,
              amount: receivedAmount,
              txId: latestTx.txId,
              expectedAmount,
              isPartialPayment,
              ownerId,
              companyId,
            });
          } else {
            cronLogger.info(`[MerchantPool] ⚠️ cryptoVerification returned:`, verificationResult);
            result.errors.push(`Verification returned unexpected result for ${walletAddress}`);
          }
        } catch (verifyError: unknown) {
          const err = verifyError as { paymentStatus?: string; amount?: number; message?: string };
          if (err?.paymentStatus === 'incomplete') {
            cronLogger.info(`[MerchantPool] 📋 Partial payment detected - ${err.amount} ${walletType} remaining`);
            result.processed++;
          } else {
            cronLogger.error(`[MerchantPool] ❌ cryptoVerification failed:`, err.message || verifyError);
            result.errors.push(`Verification failed for ${walletAddress}: ${err.message || 'Unknown error'}`);
          }
        }
        
      } catch (error: unknown) {
        const err = error as { message?: string };
        cronLogger.error(`[MerchantPool] ❌ Error processing ${walletAddress}:`, err.message);
        result.errors.push(`Processing failed for ${walletAddress}: ${err.message}`);
      }
};

/**
 * Detect orphan payments on AVAILABLE addresses
 */
export const detectOrphanPayments = async (): Promise<{
  checked: number;
  found: number;
  processed: number;
  alreadyProcessed: number;
  sweptToAdmin: number;
  errors: string[];
}> => {
  const result = {
    checked: 0,
    found: 0,
    processed: 0,
    alreadyProcessed: 0,
    sweptToAdmin: 0,
    errors: [] as string[],
  };

  try {
    cronLogger.info("[OrphanDetect] 🔍 Scanning AVAILABLE addresses for orphan payments...");

    const availableAddresses = await merchantTempAddressModel.findAll({
      where: { status: "AVAILABLE" },
      attributes: [
        'temp_address_id', 'wallet_address', 'wallet_type',
        'owner_user_id', 'admin_fee_balance', 'last_payment_context',
        'subscription_id', 'destination_tag',
      ],
    });

    cronLogger.info(`[OrphanDetect] 📋 Found ${availableAddresses.length} AVAILABLE addresses to scan`);

    // TATUM CREDIT OPTIMIZATION: Track how many addresses were skipped due to recent zero-balance cache
    let skippedCachedZero = 0;

    for (const addr of availableAddresses) {
      result.checked++;

      const walletAddress = addr.dataValues.wallet_address;
      const walletType = addr.dataValues.wallet_type;
      const ownerId = addr.dataValues.owner_user_id;
      const tempAddressId = addr.dataValues.temp_address_id;
      const existingAdminBalance = parseFloat(addr.dataValues.admin_fee_balance || '0');
      const lastContextRaw = addr.dataValues.last_payment_context;
      const orphanDestTag = addr.dataValues.destination_tag ? Number(addr.dataValues.destination_tag) : null;
      const orphanCryptoKey = getCryptoRedisKey(walletAddress, orphanDestTag);

      try {
        // TATUM CREDIT OPTIMIZATION: Skip addresses that were confirmed zero-balance recently.
        // The Redis key is set when balance=0 and lasts 6 hours (matching cron interval).
        // This means only the FIRST scan after startup or cache expiry makes the API call.
        const zeroCacheKey = `orphan:zero:${walletType}:${walletAddress}`;
        const recentlyZero = await getRedisItem(zeroCacheKey).catch(() => null);
        if (recentlyZero) {
          skippedCachedZero++;
          continue;
        }

        let balance: number;
        let balanceResult;

        // FIX: For tag-based chains (XRP/RLUSD), use incoming txs filtered by tag
        if (isTagBasedChain(walletType) && orphanDestTag) {
          try {
            const taggedTxs = await tatumApi.getIncomingTransactions(walletAddress, walletType, 20, orphanDestTag);
            balance = taggedTxs.reduce((sum, tx) => sum + tx.amount, 0);
          } catch {
            continue; // Can't determine tag-specific balance, skip
          }
        } else {
          try {
            balanceResult = await tatumApi.getAddressBalance(walletAddress, walletType);
          } catch (balanceError: unknown) {
            const balErr = balanceError as { message?: string };
            const errMsg = balErr.message || '';
            if (errMsg.includes('account.not.found') || errMsg.includes('not.found')) {
              continue;
            }
            throw balanceError;
          }
          balance = parseFloat(balanceResult?.balance || '0');
          // NaN guard for orphan detection
          if (!Number.isFinite(balance)) {
            cronLogger.warn(`[OrphanDetect] ⚠️ ${walletAddress} - balance parsed as NaN for ${walletType}, raw: ${JSON.stringify(balanceResult?.balance)}. Skipping.`);
            continue;
          }
        }

        if (balance <= 0) {
          // TATUM CREDIT OPTIMIZATION: Remember this address had zero balance for 6 hours
          const zeroCacheKey = `orphan:zero:${walletType}:${walletAddress}`;
          await setRedisItemWithTTL(zeroCacheKey, "1", 21600).catch(() => {}); // 6 hours
          continue;
        }

        const DUST_THRESHOLDS: Record<string, number> = {
          BTC: 0.00005, ETH: 0.002, TRX: 20, LTC: 0.05,
          DOGE: 25, BCH: 0.01, BSC: 0.008,
          SOL: 0.01, XRP: 0.5, POLYGON: 0.05,
        };
        const dustThreshold = DUST_THRESHOLDS[walletType] || 0;
        if (!TOKEN_CHAINS.includes(walletType) && balance < dustThreshold) {
          continue;
        }

        if (existingAdminBalance > 0 && Math.abs(balance - existingAdminBalance) / existingAdminBalance < 0.01) {
          continue;
        }

        if (TOKEN_CHAINS.includes(walletType) && balance <= existingAdminBalance * 1.01) {
          continue;
        }

        const existingRedis = await getRedisItem(orphanCryptoKey);
        if (existingRedis?.txId || existingRedis?.status === 'processing') {
          result.alreadyProcessed++;
          continue;
        }

        // FIX: Skip addresses where the last orphan scan already confirmed tx was processed
        // Prevents noisy re-detection of residual balances (XRP reserves, admin fee remnants)
        const orphanSkipKey = `orphan-skip:${walletAddress}`;
        const orphanSkipped = await getRedisItem(orphanSkipKey);
        if (orphanSkipped && Object.keys(orphanSkipped).length > 0) {
          result.alreadyProcessed++;
          continue;
        }

        const recentPoolTx = await merchantPoolTransactionModel.findOne({
          where: {
            temp_address_id: tempAddressId,
            status: { [Op.in]: ['completed', 'swept'] },
          },
          order: [['created_at', 'DESC']],
        });
        if (recentPoolTx) {
          const hoursSince = (Date.now() - new Date(recentPoolTx.dataValues.created_at).getTime()) / 3600000;
          if (hoursSince < 4) {
            result.alreadyProcessed++;
            continue;
          }
        }

        result.found++;
        cronLogger.info(`[OrphanDetect] ⚠️ ORPHAN PAYMENT DETECTED on AVAILABLE address: ${walletAddress}`);
        cronLogger.info(`[OrphanDetect]   - Balance: ${balance} ${walletType}`);
        cronLogger.info(`[OrphanDetect]   - Known admin fees: ${existingAdminBalance}`);
        cronLogger.info(`[OrphanDetect]   - Excess (orphan amount): ${(balance - existingAdminBalance).toFixed(8)} ${walletType}`);
        cronLogger.info(`[OrphanDetect]   - Owner merchant: ${ownerId}`);
        cronLogger.info(`[OrphanDetect]   - Has saved context: ${!!lastContextRaw}`);

        // RECONCILIATION FIX: If on-chain balance > DB admin_fee_balance for token addresses,
        // update the DB to reflect actual on-chain state. This ensures the threshold sweep
        // sees the real balance and can trigger when combined fees reach threshold.
        if (TOKEN_CHAINS.includes(walletType) && balance > existingAdminBalance * 1.05) {
          cronLogger.info(`[OrphanDetect] 🔧 Reconciling admin_fee_balance: DB=${existingAdminBalance} → on-chain=${balance} for ${walletAddress}`);
          try {
            await addr.update({ admin_fee_balance: balance });
            cronLogger.info(`[OrphanDetect] ✅ admin_fee_balance updated to ${balance} for ${walletAddress} (was ${existingAdminBalance})`);
          } catch (reconcileErr) {
            cronLogger.error(`[OrphanDetect] ❌ Failed to reconcile admin_fee_balance for ${walletAddress}:`, reconcileErr instanceof Error ? reconcileErr.message : reconcileErr);
          }
        }

        const incomingTxs = await tatumApi.getIncomingTransactions(walletAddress, walletType, 10);
        if (!incomingTxs || incomingTxs.length === 0) {
          // BUG-1 FIX: Instead of skipping, attempt a direct sweep to admin wallet.
          // Some TRC20/ERC20 transactions may not appear in Tatum's transaction list
          // (e.g., old TXs pruned from their index), but balance is confirmed on-chain.
          const orphanAmount = balance - existingAdminBalance;
          if (orphanAmount > 0) {
            cronLogger.info(`[OrphanDetect] ⚠️ No incoming TXs from Tatum for ${walletAddress}. Marking for admin sweep (${orphanAmount.toFixed(8)} ${walletType}).`);
            // Store context so scheduled sweep picks it up
            try {
              await setRedisItemWithTTL(`orphan-sweep:${walletAddress}`, {
                balance: orphanAmount,
                walletType,
                tempAddressId,
                ownerId,
                detectedAt: new Date().toISOString(),
                reason: 'no_tatum_txs_but_balance_confirmed',
              }, 86400); // 24 hours
              result.sweptToAdmin++;
              cronLogger.info(`[OrphanDetect] ✅ Flagged ${walletAddress} for orphan sweep (${orphanAmount.toFixed(8)} ${walletType})`);
            } catch (sweepErr) {
              cronLogger.error(`[OrphanDetect] ❌ Failed to flag orphan sweep for ${walletAddress}:`, sweepErr instanceof Error ? sweepErr.message : sweepErr);
              result.errors.push(`Failed to flag sweep for ${walletAddress}: ${sweepErr instanceof Error ? sweepErr.message : sweepErr}`);
            }
          } else {
            cronLogger.info(`[OrphanDetect] ❌ No incoming transactions found for ${walletAddress} despite balance. Orphan amount ≤ 0 after admin fee deduction. Skipping.`);
            result.errors.push(`No transactions found for ${walletAddress} despite balance ${balance} (all admin fees)`);
          }
          continue;
        }

        const latestTx = incomingTxs[0];

        const processedTxKey = `processed-tx-${latestTx.txId}`;
        const alreadyProcessedTx = await getRedisItem(processedTxKey);
        if (alreadyProcessedTx && Object.keys(alreadyProcessedTx).length > 0) {
          cronLogger.info(`[OrphanDetect] ⏭️ Transaction ${latestTx.txId} already processed. Skipping (cached for 24h).`);
          result.alreadyProcessed++;
          // FIX: Cache this skip for 24h to prevent re-detection of residual balances every cycle
          await setRedisItemWithTTL(`orphan-skip:${walletAddress}`, {
            txId: latestTx.txId,
            balance,
            reason: 'tx_already_processed',
            skippedAt: new Date().toISOString(),
          }, 86400); // 24 hours
          continue;
        }

        const confirmationCheck = await tatumApi.getTransactionConfirmations(latestTx.txId, walletType);
        if (!confirmationCheck.confirmed) {
          cronLogger.info(`[OrphanDetect] ⏳ Tx not yet confirmed (${confirmationCheck.confirmations}/${confirmationCheck.required}). Will retry next cycle.`);
          continue;
        }

        let paymentContext: Record<string, unknown> | null = null;
        if (lastContextRaw) {
          try {
            paymentContext = JSON.parse(lastContextRaw as string);
            cronLogger.info(`[OrphanDetect] 📋 Loaded payment context: payment_id=${paymentContext?.payment_id}, company=${paymentContext?.company_id}`);
          } catch {
            cronLogger.warn(`[OrphanDetect] ⚠️ Failed to parse last_payment_context for ${walletAddress}`);
          }
        }

        const companyId = paymentContext?.company_id || null;
        const paymentId = paymentContext?.payment_id || `orphan-${walletAddress}-${Date.now()}`;
        const feePayer = (paymentContext?.fee_payer as string) || 'company';
        const expectedAmount = parseFloat((paymentContext?.expected_amount as string) || '0');
        const baseCurrency = (paymentContext?.base_currency as string) || 'USD';
        const baseAmount = paymentContext?.base_amount || paymentContext?.expected_amount || null;

        const customerRef = paymentContext?.ref || `orphan-customer-${paymentId}`;

        const reconstructedRedis = {
          mode: 'CRYPTO',
          amount: expectedAmount || balance,
          status: 'processing',
          currency: walletType,
          payment_id: paymentId,
          is_merchant_pool: 'true',
          adm_id: ownerId,
          company_id: companyId,
          fee_payer: feePayer,
          base_currency: baseCurrency,
          base_amount: baseAmount,
          txId: latestTx.txId,
          receivedAmount: Math.max(0, balance - existingAdminBalance),
          originalExpectedAmount: expectedAmount || balance,
          processedByOrphanDetect: 'true',
          recoveredAt: new Date().toISOString(),
          ref: customerRef as string,
          ...(paymentContext?.webhook_url && { webhook_url: paymentContext.webhook_url }),
          ...(paymentContext?.callback_url && { callback_url: paymentContext.callback_url }),
          ...(paymentContext?.link_id && { link_id: paymentContext.link_id }),
        };
        const customerData = {
          adm_id: paymentContext?.adm_id || ownerId,
          company_id: companyId,
          base_currency: baseCurrency,
          customer_name: paymentContext?.customer_name || null,
          customer_email: paymentContext?.customer_email || null,
          webhook_url: paymentContext?.webhook_url || null,
          callback_url: paymentContext?.callback_url || null,
          link_id: paymentContext?.link_id || null,
        };

        await setRedisItem(orphanCryptoKey, reconstructedRedis);
        await setRedisItem(customerRef as string, customerData);

        await setRedisItem(processedTxKey, {
          address: walletAddress,
          amount: balance,
          processedAt: new Date().toISOString(),
          processedBy: 'detectOrphanPayments',
          hadContext: !!lastContextRaw,
        });

        cronLogger.info(`[OrphanDetect] 📝 Redis reconstructed. Calling cryptoVerification...`);

        try {
          const verificationResult = await paymentController.cryptoVerification(walletAddress, true, orphanCryptoKey) as { 
            duplicate?: boolean; 
            status?: number; 
            paymentStatus?: string 
          };

          if (verificationResult?.duplicate) {
            cronLogger.info(`[OrphanDetect] ⏭️ Payment was already processed (duplicate)`);
            result.alreadyProcessed++;
          } else if (
            verificationResult?.status === 200 || 
            verificationResult?.paymentStatus === 'completed' || 
            verificationResult?.paymentStatus === 'complete'
          ) {
            cronLogger.info(`[OrphanDetect] ✅ ORPHAN PAYMENT SUCCESSFULLY RECOVERED!`);
            cronLogger.info(`[OrphanDetect]   - Address: ${walletAddress}`);
            cronLogger.info(`[OrphanDetect]   - Amount: ${balance} ${walletType}`);
            cronLogger.info(`[OrphanDetect]   - TxId: ${latestTx.txId}`);
            cronLogger.info(`[OrphanDetect]   - Original payment: ${paymentContext?.payment_id || 'unknown'}`);
            cronLogger.info(`[OrphanDetect]   - Merchant: ${ownerId}, Company: ${companyId || 'unknown'}`);
            result.processed++;

            await recordPoolTransaction({
              tempAddressId: tempAddressId,
              ownerUserId: ownerId,
              companyId: companyId as number,
              paymentReference: `orphan-recovery:${paymentId as string}`,
              walletType: walletType,
              paymentAmount: balance,
              merchantAmount: 0,
              adminFeeAmount: 0,
              incomingTxId: latestTx.txId,
              status: 'completed',
            });

            if (paymentContext?.webhook_url || paymentContext?.callback_url || companyId) {
              try {
                await deliverMerchantWebhook(customerData, {
                  event: 'payment.confirmed',
                  payment_id: paymentId,
                  transaction_reference: latestTx.txId,
                  status: 'completed',
                  payment_status: 'confirmed',
                  amount: balance,
                  currency: walletType,
                  recovered: true,
                  recovery_type: 'orphan_detection',
                  original_payment_id: paymentContext?.payment_id || null,
                  customer_name: paymentContext?.customer_name || null,
                  customer_email: paymentContext?.customer_email || null,
                  created_at: new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                });
                cronLogger.info(`[OrphanDetect] 📤 Recovery webhook sent to merchant`);
              } catch (webhookError) {
                cronLogger.warn(`[OrphanDetect] ⚠️ Recovery webhook failed (non-blocking):`, webhookError);
              }
            }

            await addr.update({ last_payment_context: null });

            cronLogger?.info?.("ORPHAN PAYMENT RECOVERED", {
              address: walletAddress,
              currency: walletType,
              amount: balance,
              txId: latestTx.txId,
              originalPaymentId: paymentContext?.payment_id,
              ownerId,
              companyId,
              hadContext: !!lastContextRaw,
            });
          } else {
            cronLogger.info(`[OrphanDetect] ⚠️ cryptoVerification returned:`, verificationResult);
            result.errors.push(`Verification returned unexpected result for ${walletAddress}`);
          }
        } catch (verifyError: unknown) {
          const err = verifyError as { paymentStatus?: string; amount?: number; message?: string };
          if (err?.paymentStatus === 'incomplete') {
            cronLogger.info(`[OrphanDetect] 📋 Partial orphan payment - ${err.amount} remaining`);
            result.processed++;
            await addr.update({ last_payment_context: null });
          } else {
            cronLogger.error(`[OrphanDetect] ❌ cryptoVerification failed:`, err.message || verifyError);
            result.errors.push(`Verification failed for ${walletAddress}: ${err.message || 'Unknown error'}`);
          }
        }

      } catch (error: unknown) {
        const err = error as { message?: string };
        cronLogger.error(`[OrphanDetect] ❌ Error processing ${walletAddress}:`, err.message);
        result.errors.push(`Processing failed for ${walletAddress}: ${err.message}`);
      }
    }

    cronLogger.info(`[OrphanDetect] ✅ Orphan payment scan complete:`);
    cronLogger.info(`[OrphanDetect]   - Scanned: ${result.checked}`);
    cronLogger.info(`[OrphanDetect]   - Skipped (cached zero-balance): ${skippedCachedZero}`);
    cronLogger.info(`[OrphanDetect]   - Already processed: ${result.alreadyProcessed}`);
    cronLogger.info(`[OrphanDetect]   - Orphans found: ${result.found}`);
    cronLogger.info(`[OrphanDetect]   - Successfully recovered: ${result.processed}`);
    cronLogger.info(`[OrphanDetect]   - Swept to admin: ${result.sweptToAdmin}`);
    if (result.errors.length > 0) {
      cronLogger.info(`[OrphanDetect]   - Errors: ${result.errors.length}`);
    }

  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.error("[OrphanDetect] ❌ Orphan detection scan failed:", err.message);
    result.errors.push(`Global error: ${err.message}`);
  }

  return result;
};
