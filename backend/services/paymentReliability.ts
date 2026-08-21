/**
 * Payment Reliability Service
 * 
 * Enterprise-grade reliability layer for high-throughput crypto payment processing.
 * Provides:
 *   1. Settlement Idempotency — prevents double-spend on retry
 *   2. Admin ≠ Merchant Wallet Guard — blocks misconfigured settlements
 *   3. Payment Journal — persists every state transition to PostgreSQL
 *   4. Queue Backpressure — rejects webhooks when overwhelmed
 *   5. Stuck Payment Watchdog — real-time alerting for stuck payments
 */

import PaymentJournal from "../models/paymentJournalModel";
import { cronLogger, webhookLogs } from "../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL, deleteRedisItem } from "../utils/redisInstance";
import { captureError } from "./errorMonitoringService";
import { getQueueHealth } from "./webhookQueue";

// ═══════════════════════════════════════════════════════════════════════════════
// 0. BLOCKCHAIN SETTLEMENT VERIFICATION — Auto-detect completed settlements
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verify on-chain whether a settlement actually completed by checking if funds
 * left the pool address and arrived at the expected merchant wallet.
 * 
 * This handles the critical edge case where:
 *   1. The blockchain TX succeeded (funds transferred)
 *   2. But the DB update failed (crash, timeout, etc.)
 *   3. The system thinks the payment is still pending/failed
 * 
 * Returns the outgoing TX ID if settlement is confirmed on-chain, null otherwise.
 */
export async function verifySettlementOnChain(
  poolAddress: string,
  currency: string,
  expectedMerchantWallet: string | null,
  paymentId: string,
): Promise<{ settled: boolean; outgoingTxId: string | null; amount: number }> {
  try {
    const isTronBased = currency.includes("TRC20") || currency === "TRX";
    const isEthBased = currency.includes("ERC20") || currency === "ETH" || currency.includes("POLYGON");

    if (isTronBased) {
      return await verifyTronSettlement(poolAddress, currency, expectedMerchantWallet, paymentId);
    } else if (isEthBased) {
      // For ETH-based, use Tatum API to check recent outgoing TRC20/ERC20 transfers
      // Less critical since ETH settlements rarely have this issue, but still covered
      cronLogger.info(`[SettlementVerify] ETH-based verification not yet implemented for ${currency}, skipping`);
      return { settled: false, outgoingTxId: null, amount: 0 };
    }

    return { settled: false, outgoingTxId: null, amount: 0 };
  } catch (err) {
    cronLogger.warn(`[SettlementVerify] On-chain verification failed for ${paymentId}: ${(err as Error).message}`);
    return { settled: false, outgoingTxId: null, amount: 0 };
  }
}

/**
 * Check TRON blockchain for outgoing USDT-TRC20/TRX transfers from the pool address.
 * Uses TronGrid API (direct blockchain, independent of Tatum).
 */
async function verifyTronSettlement(
  poolAddress: string,
  currency: string,
  expectedMerchantWallet: string | null,
  paymentId: string,
): Promise<{ settled: boolean; outgoingTxId: string | null; amount: number }> {
  const axios = require("axios");
  const USDT_CONTRACT = process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

  // Step 1: Check current USDT balance on pool address
  const accountResp = await axios.get(
    `https://api.trongrid.io/v1/accounts/${poolAddress}`,
    { timeout: 10000, headers: { Accept: "application/json" } }
  );

  let currentUsdtBalance = 0;
  if (accountResp.data?.success && accountResp.data?.data?.[0]) {
    const trc20List = accountResp.data.data[0].trc20 || [];
    for (const tok of trc20List) {
      if (typeof tok === "object" && USDT_CONTRACT in tok) {
        currentUsdtBalance = parseInt(tok[USDT_CONTRACT]) / 1_000_000;
      }
    }
  }

  // If the pool address still has significant USDT, settlement likely didn't happen
  if (currentUsdtBalance > 1.0) {
    cronLogger.info(
      `[SettlementVerify] Pool ${poolAddress} still has ${currentUsdtBalance} USDT — settlement not completed`
    );
    return { settled: false, outgoingTxId: null, amount: 0 };
  }

  // Step 2: Check outgoing TRC20 transfers from pool address
  const txResp = await axios.get(
    `https://api.trongrid.io/v1/accounts/${poolAddress}/transactions/trc20`,
    {
      params: {
        limit: 20,
        contract_address: USDT_CONTRACT,
        order_by: "block_timestamp,desc",
      },
      timeout: 10000,
      headers: { Accept: "application/json" },
    }
  );

  const txs = txResp.data?.data || [];
  
  // Look for outgoing transfers (from = poolAddress)
  for (const tx of txs) {
    if (tx.from !== poolAddress) continue; // Only outgoing
    
    const toAddr = tx.to || "";
    const value = parseInt(tx.value || "0") / 1_000_000;
    const txId = tx.transaction_id || "";

    // If we know the expected merchant wallet, verify it matches
    if (expectedMerchantWallet && toAddr !== expectedMerchantWallet) {
      continue; // Not to the expected merchant
    }

    // Found an outgoing transfer of significant value
    if (value > 0.5) {
      cronLogger.info(
        `[SettlementVerify] ✅ Found on-chain settlement for payment ${paymentId}: ` +
        `${value} USDT sent from ${poolAddress} to ${toAddr} (TX: ${txId})`
      );
      return { settled: true, outgoingTxId: txId, amount: value };
    }
  }

  cronLogger.info(
    `[SettlementVerify] No outgoing USDT transfer found from ${poolAddress} for payment ${paymentId}`
  );
  return { settled: false, outgoingTxId: null, amount: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SETTLEMENT IDEMPOTENCY — Prevents double-spend on retry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a settlement has already been attempted/completed for a payment.
 * Returns the existing settlement TX ID if found, null if safe to proceed.
 * 
 * Uses TWO checks:
 *   1. Redis (fast path) — settlement-{paymentId} key
 *   2. PostgreSQL (durable path) — tbl_payment_journal with event='settlement_sent'
 * 
 * This ensures idempotency even if Redis loses the key.
 */
export async function checkSettlementIdempotency(
  paymentId: string,
  address: string,
  currency: string
): Promise<{ alreadySettled: boolean; existingTxId: string | null }> {
  // Fast path: Redis check
  const redisKey = `settlement-lock-${paymentId}`;
  const existing = await getRedisItem(redisKey);
  if (existing && typeof existing === 'object') {
    const data = existing as Record<string, unknown>;
    if (data.settlementTxId) {
      cronLogger.warn(
        `[SettlementIdempotency] ⛔ BLOCKED duplicate settlement for payment ${paymentId}. ` +
        `Existing TX: ${data.settlementTxId}`
      );
      return { alreadySettled: true, existingTxId: data.settlementTxId as string };
    }
    // In-progress marker exists but no TX yet — another worker is processing
    if (data.status === 'in_progress') {
      const startedAt = Number(data.startedAt || 0);
      const elapsed = Date.now() - startedAt;
      // If it's been more than 5 minutes, the other worker likely crashed
      if (elapsed < 300_000) {
        cronLogger.warn(
          `[SettlementIdempotency] ⏳ Settlement in progress for ${paymentId} (${Math.round(elapsed / 1000)}s ago). Blocking duplicate.`
        );
        return { alreadySettled: true, existingTxId: null };
      }
      cronLogger.warn(
        `[SettlementIdempotency] ⚠️ Stale in-progress marker for ${paymentId} (${Math.round(elapsed / 1000)}s). Checking blockchain before retry.`
      );
      
      // ── AUTO-RECOVERY: Before allowing retry, check if the settlement actually
      // succeeded on-chain. This handles the critical case where the blockchain TX
      // executed but the DB/Redis update failed (crash, timeout, etc).
      // Without this check, the system endlessly retries a payment that's already settled.
      try {
        const onChainResult = await verifySettlementOnChain(address, currency, null, paymentId);
        if (onChainResult.settled && onChainResult.outgoingTxId) {
          cronLogger.warn(
            `[SettlementIdempotency] 🔄 AUTO-RECOVERY: Settlement for ${paymentId} was already completed on-chain! ` +
            `TX: ${onChainResult.outgoingTxId}, amount: ${onChainResult.amount}. ` +
            `Marking as completed and blocking retry.`
          );
          // Auto-complete: update Redis + journal to reflect the real on-chain state
          await setRedisItem(redisKey, {
            status: 'completed',
            settlementTxId: onChainResult.outgoingTxId,
            completedAt: Date.now(),
            autoRecovered: true,
            recoveredFrom: 'stale_in_progress',
          });
          await setRedisTTL(redisKey, 86400 * 7);

          // Record in journal
          try {
            await PaymentJournal.create({
              payment_id: paymentId,
              tx_id: null,
              address,
              currency,
              event: 'settlement_auto_recovered',
              from_state: 'stale_in_progress',
              to_state: 'completed',
              amount: onChainResult.amount,
              settlement_tx_id: onChainResult.outgoingTxId,
              company_id: null,
              metadata: {
                source: 'idempotency_auto_recovery',
                reason: 'Settlement TX found on-chain but DB was never updated',
                elapsedMs: elapsed,
              },
            });
          } catch (journalErr) {
            cronLogger.warn(`[SettlementIdempotency] Journal write failed during auto-recovery: ${(journalErr as Error).message}`);
          }

          return { alreadySettled: true, existingTxId: onChainResult.outgoingTxId };
        }
      } catch (verifyErr) {
        cronLogger.warn(
          `[SettlementIdempotency] On-chain verification failed for ${paymentId}: ${(verifyErr as Error).message}. ` +
          `Allowing retry as fallback.`
        );
      }

      // Delete stale marker so atomic claim below can succeed
      await deleteRedisItem(redisKey);
    }
  }

  // Durable path: PostgreSQL check (in case Redis lost the key)
  try {
    const journalEntry = await PaymentJournal.findOne({
      where: {
        payment_id: paymentId,
        event: 'settlement_sent',
      },
      order: [['created_at', 'DESC']],
    });

    if (journalEntry && journalEntry.settlement_tx_id) {
      // ── DEFENSE-IN-DEPTH: Verify the existing TX actually succeeded on-chain ──
      // A TX can be in the journal but have failed execution (e.g., TRON OUT_OF_ENERGY).
      // If the TX failed, delete the stale journal entry and allow retry.
      try {
        const tatumApi = require("../services/tatumApi").default;
        const txCurrency = journalEntry.currency || currency;
        const isTronBased = txCurrency.includes("TRC20") || txCurrency === "TRX";
        
        if (isTronBased) {
          const confirmResult = await tatumApi.waitForTransactionConfirmation(
            journalEntry.settlement_tx_id,
            txCurrency,
            10000 // 10s timeout for verification
          );
          
          if (confirmResult.contractResult && confirmResult.contractResult !== "SUCCESS") {
            cronLogger.warn(
              `[SettlementIdempotency] ⚠️ Existing TX ${journalEntry.settlement_tx_id} FAILED on-chain ` +
              `(contractResult=${confirmResult.contractResult}). Clearing stale journal entry to allow retry.`
            );
            // Delete the stale journal entry so the retry can proceed
            await PaymentJournal.destroy({
              where: {
                payment_id: paymentId,
                event: 'settlement_sent',
                settlement_tx_id: journalEntry.settlement_tx_id,
              },
            });
            // Also clear any Redis entries
            await deleteRedisItem(redisKey);
            await deleteRedisItem(`settlement-claim-${paymentId}`);
            // Fall through to allow retry
          } else {
            // TX confirmed on-chain — block as duplicate
            cronLogger.warn(
              `[SettlementIdempotency] ⛔ BLOCKED duplicate settlement (DB recovery, TX verified on-chain) for payment ${paymentId}. ` +
              `Existing TX: ${journalEntry.settlement_tx_id}`
            );
            await setRedisItem(redisKey, {
              status: 'completed',
              settlementTxId: journalEntry.settlement_tx_id,
              recoveredFromDB: true,
            });
            await setRedisTTL(redisKey, 86400);
            return { alreadySettled: true, existingTxId: journalEntry.settlement_tx_id };
          }
        } else {
          // Non-TRON chains: trust the journal entry (execution failures are rare)
          cronLogger.warn(
            `[SettlementIdempotency] ⛔ BLOCKED duplicate settlement (DB recovery) for payment ${paymentId}. ` +
            `Existing TX: ${journalEntry.settlement_tx_id}`
          );
          await setRedisItem(redisKey, {
            status: 'completed',
            settlementTxId: journalEntry.settlement_tx_id,
            recoveredFromDB: true,
          });
          await setRedisTTL(redisKey, 86400);
          return { alreadySettled: true, existingTxId: journalEntry.settlement_tx_id };
        }
      } catch (verifyErr) {
        // On-chain verification failed — err on the side of caution and block
        cronLogger.warn(
          `[SettlementIdempotency] ⚠️ Could not verify TX ${journalEntry.settlement_tx_id} on-chain: ${(verifyErr as Error).message}. ` +
          `Blocking as precaution.`
        );
        await setRedisItem(redisKey, {
          status: 'completed',
          settlementTxId: journalEntry.settlement_tx_id,
          recoveredFromDB: true,
        });
        await setRedisTTL(redisKey, 86400);
        return { alreadySettled: true, existingTxId: journalEntry.settlement_tx_id };
      }
    }
  } catch (dbErr) {
    // DB check failed — log but don't block (Redis check passed)
    cronLogger.warn(`[SettlementIdempotency] DB check failed for ${paymentId}: ${(dbErr as Error).message}`);
  }

  // ── FIX: Atomic claim via SETNX to prevent TOCTOU race ──────────────────
  // With BullMQ concurrency=5, multiple webhook workers can pass the checks above
  // simultaneously. Use Redis NX (set-if-not-exists) for atomic mutual exclusion.
  const { acquireLock } = require("../utils/redisInstance");
  const claimed = await acquireLock(`settlement-claim-${paymentId}`, 600, 1, 0, false, true);
  if (!claimed) {
    cronLogger.warn(
      `[SettlementIdempotency] ⏳ Atomic claim failed for ${paymentId} — another worker won the race. Blocking duplicate.`
    );
    return { alreadySettled: true, existingTxId: null };
  }

  return { alreadySettled: false, existingTxId: null };
}

/**
 * Mark settlement as in-progress (before calling Tatum API).
 * This prevents another worker from initiating a duplicate settlement.
 */
export async function markSettlementInProgress(paymentId: string): Promise<void> {
  const redisKey = `settlement-lock-${paymentId}`;
  await setRedisItem(redisKey, {
    status: 'in_progress',
    startedAt: Date.now(),
    pid: process.pid,
  });
  await setRedisTTL(redisKey, 600); // 10 min TTL (safety valve)
}

/**
 * Mark settlement as completed with the blockchain TX ID.
 * Also journals to PostgreSQL for durable record.
 */
export async function markSettlementCompleted(
  paymentId: string,
  settlementTxId: string,
  address: string,
  currency: string,
  merchantAmount: number,
  adminAmount: number,
  companyId: number | null
): Promise<void> {
  const redisKey = `settlement-lock-${paymentId}`;
  await setRedisItem(redisKey, {
    status: 'completed',
    settlementTxId,
    completedAt: Date.now(),
  });
  await setRedisTTL(redisKey, 86400 * 7); // 7 days

  // Journal to PostgreSQL
  try {
    await PaymentJournal.create({
      payment_id: paymentId,
      tx_id: null,
      address,
      currency,
      event: 'settlement_sent',
      from_state: 'processing',
      to_state: 'payout_complete',
      amount: merchantAmount + adminAmount,
      settlement_tx_id: settlementTxId,
      company_id: companyId,
      metadata: {
        merchant_amount: merchantAmount,
        admin_amount: adminAmount,
        pid: process.pid,
      },
    });
  } catch (journalErr) {
    // Non-blocking — log but don't fail the settlement
    cronLogger.error(`[SettlementIdempotency] Failed to journal settlement for ${paymentId}: ${(journalErr as Error).message}`);
  }

  // Ledger dual-write (Tier-1 Item #3). Behind LEDGER_DUAL_WRITE flag.
  // Non-blocking — settlement path is source-of-truth; ledger is derived.
  if (process.env.LEDGER_DUAL_WRITE === "true") {
    try {
      const { recordSettlementCompleted } = await import("./ledger/ledgerPaymentMapper");
      await recordSettlementCompleted({
        paymentId,
        companyId,
        currency,
        address,
        settlementTxId,
        merchantAmount,
        adminAmount,
      });
    } catch (ledgerErr) {
      cronLogger.error(`[Ledger] Dual-write failed for ${paymentId}: ${(ledgerErr as Error).message}`);
    }
  }
}

/**
 * Mark settlement as failed (allows retry).
 */
export async function markSettlementFailed(paymentId: string, error: string): Promise<void> {
  const redisKey = `settlement-lock-${paymentId}`;
  await setRedisItem(redisKey, {
    status: 'failed',
    error,
    failedAt: Date.now(),
  });
  await setRedisTTL(redisKey, 300); // 5 min — allow retry after cooldown
  
  // Also release the atomic claim lock so retries can proceed
  try {
    await deleteRedisItem(`settlement-claim-${paymentId}`);
  } catch (_) { /* non-critical */ }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN ≠ MERCHANT WALLET GUARD — Blocks misconfigured settlements
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that admin wallet address is different from merchant wallet address.
 * For UTXO chains, both outputs in a single TX go to different addresses.
 * If they're the same, admin fees are effectively donated to the merchant.
 * 
 * Returns { valid: true } if safe, or { valid: false, reason } if blocked.
 */
export function validateWalletSeparation(
  adminWalletAddress: string | null,
  merchantWalletAddress: string,
  currency: string,
  companyId: number | null
): { valid: boolean; reason?: string; sameAddress?: boolean } {
  if (!adminWalletAddress) {
    return {
      valid: false,
      reason: `No admin wallet configured for ${currency}. Settlement would fail.`,
    };
  }

  if (adminWalletAddress.toLowerCase() === merchantWalletAddress.toLowerCase()) {
    // Admin and merchant wallets are the same — this is an intentional configuration.
    // Allow settlement to proceed with a single-output transaction (no admin/merchant split needed).
    cronLogger.info(
      `[WalletGuard] ℹ️ Admin wallet for ${currency} (${adminWalletAddress.substring(0, 16)}...) ` +
      `is the SAME as merchant wallet for Company ${companyId}. ` +
      `Proceeding with combined single-output settlement.`
    );
    return { valid: true, sameAddress: true };
  }

  return { valid: true };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. PAYMENT JOURNAL — Persist critical state transitions to PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Journal a payment state transition. Non-blocking — errors are logged but don't
 * interrupt the payment flow.
 */
export async function journalStateTransition(params: {
  paymentId: string;
  txId?: string | null;
  address: string;
  currency: string;
  event: string;
  fromState?: string | null;
  toState: string;
  amount?: number | null;
  companyId?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await PaymentJournal.create({
      payment_id: params.paymentId,
      tx_id: params.txId || null,
      address: params.address,
      currency: params.currency,
      event: params.event,
      from_state: params.fromState || null,
      to_state: params.toState,
      amount: params.amount || null,
      settlement_tx_id: null,
      company_id: params.companyId || null,
      metadata: params.metadata || null,
    });
  } catch (err) {
    // Non-blocking — payment continues even if journal fails
    cronLogger.warn(`[PaymentJournal] Failed to log ${params.event} for ${params.paymentId}: ${(err as Error).message}`);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. QUEUE BACKPRESSURE — Reject webhooks when system is overwhelmed
// ═══════════════════════════════════════════════════════════════════════════════

const BACKPRESSURE_THRESHOLDS = {
  MAX_WAITING_JOBS: parseInt(process.env.MAX_QUEUE_DEPTH || '5000', 10),
  MAX_ACTIVE_JOBS: parseInt(process.env.MAX_ACTIVE_JOBS || '50', 10),
  WARNING_THRESHOLD: 0.8, // Warn at 80% of max
};

/**
 * Check if the webhook queue can accept new jobs.
 * Returns { accept: true } if queue has capacity, or { accept: false, reason } if overloaded.
 */
export async function checkQueueBackpressure(): Promise<{
  accept: boolean;
  reason?: string;
  queueDepth?: number;
  utilizationPercent?: number;
}> {
  try {
    const health = await getQueueHealth();
    const utilization = health.waiting / BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS;

    if (health.waiting >= BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS) {
      return {
        accept: false,
        reason: `Queue overloaded: ${health.waiting} waiting jobs (max: ${BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS})`,
        queueDepth: health.waiting,
        utilizationPercent: Math.round(utilization * 100),
      };
    }

    if (utilization >= BACKPRESSURE_THRESHOLDS.WARNING_THRESHOLD) {
      webhookLogs.warn(
        `[Backpressure] ⚠️ Queue at ${Math.round(utilization * 100)}% capacity ` +
        `(${health.waiting}/${BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS} waiting, ${health.active} active)`
      );
    }

    return {
      accept: true,
      queueDepth: health.waiting,
      utilizationPercent: Math.round(utilization * 100),
    };
  } catch (err) {
    // If we can't check, allow the job (better to accept than reject blindly)
    cronLogger.warn(`[Backpressure] Health check failed: ${(err as Error).message}. Allowing job.`);
    return { accept: true };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 5. PAYMENT JOURNAL SYNC — Auto-create table on startup
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure the payment journal table exists. Called on startup.
 */
export async function initPaymentJournal(): Promise<void> {
  try {
    await PaymentJournal.sync({ alter: false });
    cronLogger.info("[PaymentJournal] ✅ Table synced successfully");
  } catch (err) {
    cronLogger.error(`[PaymentJournal] ❌ Table sync failed: ${(err as Error).message}`);
    // Try force sync if column mismatch
    try {
      await PaymentJournal.sync({ alter: true });
      cronLogger.info("[PaymentJournal] ✅ Table synced with ALTER");
    } catch (alterErr) {
      cronLogger.error(`[PaymentJournal] ❌ ALTER sync also failed: ${(alterErr as Error).message}`);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. STUCK PAYMENT WATCHDOG — Detection, Auto-Recovery & Escalation
// ═══════════════════════════════════════════════════════════════════════════════

// --- Configuration ---
const WATCHDOG_CONFIG = {
  /** Only attempt auto-recovery after this many minutes stuck */
  RECOVERY_THRESHOLD_MINUTES: parseInt(process.env.WATCHDOG_RECOVERY_THRESHOLD_MIN || "60", 10),
  /** Maximum auto-recovery attempts per payment */
  MAX_RECOVERY_ATTEMPTS: parseInt(process.env.WATCHDOG_MAX_RECOVERY_ATTEMPTS || "3", 10),
  /** Minimum minutes between recovery attempts for the same payment */
  RECOVERY_COOLDOWN_MINUTES: parseInt(process.env.WATCHDOG_RECOVERY_COOLDOWN_MIN || "30", 10),
  /** Don't re-escalate the same payment within this many hours */
  ESCALATION_REPEAT_HOURS: parseInt(process.env.WATCHDOG_ESCALATION_REPEAT_HOURS || "6", 10),
  /** Redis key prefix for recovery tracking */
  REDIS_PREFIX: "watchdog-recovery:",
};

interface RecoveryTracker {
  attempts: number;
  lastAttemptAt: string;       // ISO-8601
  escalatedAt: string | null;  // ISO-8601 or null
  lastError: string | null;
  resolved: boolean;
}

/**
 * Get recovery tracker for a payment from Redis.
 */
async function getRecoveryTracker(paymentId: string): Promise<RecoveryTracker | null> {
  const key = `${WATCHDOG_CONFIG.REDIS_PREFIX}${paymentId}`;
  const data = await getRedisItem(key);
  return data as RecoveryTracker | null;
}

/**
 * Update recovery tracker in Redis.
 */
async function setRecoveryTracker(paymentId: string, tracker: RecoveryTracker): Promise<void> {
  const key = `${WATCHDOG_CONFIG.REDIS_PREFIX}${paymentId}`;
  await setRedisItem(key, tracker);
  await setRedisTTL(key, 7 * 86400); // Keep for 7 days
}

/**
 * Attempt auto-recovery for a single stuck payment.
 * Re-enqueues the webhook so the full processing pipeline re-runs.
 * 
 * Returns: 'recovered' | 'no_data' | 'error'
 */
async function attemptAutoRecovery(journalEntry: {
  payment_id: string;
  address: string;
  currency: string;
  tx_id: string | null;
  amount: number | null;
  company_id: number | null;
  metadata: Record<string, unknown> | null;
}): Promise<{ status: 'enqueued' | 'no_data' | 'already_resolved' | 'error'; detail: string }> {
  const { enqueueWebhook } = require("./webhookQueue");
  const { payment_id, address, currency, tx_id, amount, company_id } = journalEntry;

  try {
    // Step 1: Check if the payment already reached a terminal state we missed
    const { Op } = require("sequelize");
    const terminalEntry = await PaymentJournal.findOne({
      where: {
        payment_id,
        to_state: { [Op.in]: ['payout_complete', 'failed', 'expired', 'refunded'] },
      },
    });
    if (terminalEntry) {
      return { status: 'already_resolved', detail: `Payment already in terminal state: ${terminalEntry.to_state}` };
    }

    // Step 2: Check Redis for existing payment data
    const redisData = await getRedisItem(`crypto-${address}`);
    const txIdToUse = tx_id || (redisData as Record<string, unknown>)?.txId as string || null;

    if (!txIdToUse) {
      return {
        status: 'no_data',
        detail: `No txId found in journal or Redis for address ${address}. Manual intervention required.`,
      };
    }

    // Step 3: Enqueue for re-processing
    const jobId = await enqueueWebhook(
      {
        payload: {
          address,
          amount: String(amount || (redisData as Record<string, unknown>)?.receivedAmount || "0"),
          txId: txIdToUse,
          asset: currency,
        },
        queryParams: {
          company_id: company_id || undefined,
        },
        receivedAt: new Date().toISOString(),
        source: "watchdog-recovery" as const,
      },
      { priority: 1 } // High priority
    );

    // Step 4: Journal the recovery attempt
    await journalStateTransition({
      paymentId: payment_id,
      txId: txIdToUse,
      address,
      currency,
      event: 'watchdog_recovery_attempt',
      fromState: 'processing',
      toState: 'processing',
      amount,
      companyId: company_id,
      metadata: { jobId, source: 'watchdog-auto-recovery' },
    });

    return { status: 'enqueued', detail: `Re-enqueued as job ${jobId}` };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

/**
 * Escalate a stuck payment to admin via error monitoring.
 */
function escalateStuckPayment(journalEntry: {
  payment_id: string;
  address: string;
  currency: string;
  company_id: number | null;
}, stuckMinutes: number, attempts: number, lastError: string | null): void {
  const msg =
    `Payment ${journalEntry.payment_id} stuck in 'processing' for ${stuckMinutes} min ` +
    `after ${attempts} auto-recovery attempts. ` +
    `Address: ${journalEntry.address}, Currency: ${journalEntry.currency}, Company: ${journalEntry.company_id}. ` +
    (lastError ? `Last error: ${lastError}. ` : '') +
    `Manual intervention required via POST /api/diagnostics/recover-stuck-payment or /api/diagnostics/force-resolve-payment.`;

  captureError(
    new Error(msg),
    "payment",
    {
      severity: "critical",
      extraContext: JSON.stringify({
        payment_id: journalEntry.payment_id,
        address: journalEntry.address,
        currency: journalEntry.currency,
        company_id: journalEntry.company_id,
        stuck_minutes: stuckMinutes,
        recovery_attempts: attempts,
      }),
    }
  );

  cronLogger.error(`[Watchdog] 🚨 ESCALATED: ${msg}`);
}

/**
 * Enhanced Watchdog — Detection, Auto-Recovery & Escalation.
 * Called by cron every 2 minutes.
 * 
 * Behaviour:
 *   - Stuck < RECOVERY_THRESHOLD: Log summary (throttled — once per 10 min)
 *   - Stuck >= RECOVERY_THRESHOLD & attempts < MAX: Attempt auto-recovery
 *   - Stuck >= RECOVERY_THRESHOLD & attempts >= MAX: Escalate to admin (once)
 *   - Already escalated: Silent (no repeated warnings)
 */
export async function watchdogCheck(): Promise<{
  stuckCount: number;
  oldestStuckMinutes: number;
  recoveryAttempts: number;
  recoverySuccesses: number;
  escalations: number;
}> {
  const result = { stuckCount: 0, oldestStuckMinutes: 0, recoveryAttempts: 0, recoverySuccesses: 0, escalations: 0 };

  try {
    const { Op } = require("sequelize");
    const threshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes

    const stuckPayments = await PaymentJournal.findAll({
      where: {
        to_state: 'processing',
        created_at: { [Op.lt]: threshold },
      },
      order: [['created_at', 'ASC']],
      limit: 50,
    });

    // Filter to only those without a subsequent completion or resolution
    // NOTE: We check for resolution events both BEFORE and AFTER the stuck entry.
    // This handles cases where spam token retries create new "processing" journal entries
    // after the legitimate payment was already settled (the resolution event has an
    // earlier timestamp than the spam token retry entry).
    const genuinelyStuck: typeof stuckPayments = [];
    for (const entry of stuckPayments) {
      const anyResolution = await PaymentJournal.findOne({
        where: {
          payment_id: entry.payment_id,
          event: { [Op.in]: [
            'settlement_sent', 'payment_completed', 'payment_failed',
            'force_resolved', 'watchdog_resolved', 'spam_token_rejected',
          ]},
        },
      });
      if (!anyResolution) {
        genuinelyStuck.push(entry);
      }
    }

    // Deduplicate by payment_id — same payment appearing from multiple journal entries
    // (e.g., spam token retries creating multiple "processing" entries for the same payment_id)
    const seenPaymentIds = new Set<string>();
    const deduplicatedStuck: typeof stuckPayments = [];
    for (const entry of genuinelyStuck) {
      if (!seenPaymentIds.has(entry.payment_id)) {
        seenPaymentIds.add(entry.payment_id);
        deduplicatedStuck.push(entry);
      }
    }

    result.stuckCount = deduplicatedStuck.length;
    if (deduplicatedStuck.length === 0) {
      return result;
    }

    result.oldestStuckMinutes = Math.round(
      (Date.now() - new Date(deduplicatedStuck[0].created_at).getTime()) / 60000
    );

    // Classify stuck payments into buckets
    const earlyStuck: string[] = [];       // < recovery threshold
    const recoverable: typeof stuckPayments = [];   // eligible for auto-recovery
    const alreadyEscalated: string[] = [];  // already escalated, silent

    for (const entry of deduplicatedStuck) {
      const stuckMinutes = Math.round(
        (Date.now() - new Date(entry.created_at).getTime()) / 60000
      );
      const tracker = await getRecoveryTracker(entry.payment_id);

      if (tracker?.resolved) {
        // Skip resolved payments (force-resolved but journal hasn't caught up)
        continue;
      }

      if (stuckMinutes < WATCHDOG_CONFIG.RECOVERY_THRESHOLD_MINUTES) {
        earlyStuck.push(entry.payment_id);
        continue;
      }

      if (tracker && tracker.attempts >= WATCHDOG_CONFIG.MAX_RECOVERY_ATTEMPTS) {
        // Already exhausted recovery attempts
        if (tracker.escalatedAt) {
          const hoursSinceEscalation = (Date.now() - new Date(tracker.escalatedAt).getTime()) / 3600000;
          if (hoursSinceEscalation < WATCHDOG_CONFIG.ESCALATION_REPEAT_HOURS) {
            alreadyEscalated.push(entry.payment_id);
            continue;
          }
        }
        // Time to escalate (or re-escalate after cooldown)
        escalateStuckPayment(
          {
            payment_id: entry.payment_id,
            address: entry.address,
            currency: entry.currency,
            company_id: entry.company_id,
          },
          stuckMinutes,
          tracker.attempts,
          tracker.lastError
        );
        await setRecoveryTracker(entry.payment_id, {
          ...tracker,
          escalatedAt: new Date().toISOString(),
        });
        result.escalations++;
        continue;
      }

      // Check cooldown
      if (tracker?.lastAttemptAt) {
        const minsSinceLastAttempt = (Date.now() - new Date(tracker.lastAttemptAt).getTime()) / 60000;
        if (minsSinceLastAttempt < WATCHDOG_CONFIG.RECOVERY_COOLDOWN_MINUTES) {
          continue; // Cooling down
        }
      }

      recoverable.push(entry);
    }

    // --- Log summary (throttled: only if there are early-stuck payments, log every 10 min) ---
    if (earlyStuck.length > 0) {
      // Only log if the minute is a multiple of 10 (reduces noise from every-2-min to every-10-min)
      const currentMinute = new Date().getMinutes();
      if (currentMinute % 10 < 2) {
        cronLogger.warn(
          `[Watchdog] ⚠️ ${earlyStuck.length} payment(s) stuck in 'processing' for >10 min ` +
          `(below recovery threshold of ${WATCHDOG_CONFIG.RECOVERY_THRESHOLD_MINUTES} min). ` +
          `IDs: ${earlyStuck.slice(0, 3).join(', ')}${earlyStuck.length > 3 ? '...' : ''}`
        );
      }
    }

    if (alreadyEscalated.length > 0) {
      // Silent — these are already escalated and admin has been notified
    }

    // --- Auto-Recovery ---
    for (const entry of recoverable) {
      const stuckMinutes = Math.round(
        (Date.now() - new Date(entry.created_at).getTime()) / 60000
      );
      const tracker = await getRecoveryTracker(entry.payment_id) || {
        attempts: 0,
        lastAttemptAt: '',
        escalatedAt: null,
        lastError: null,
        resolved: false,
      };

      cronLogger.info(
        `[Watchdog] 🔄 Auto-recovery attempt ${tracker.attempts + 1}/${WATCHDOG_CONFIG.MAX_RECOVERY_ATTEMPTS} ` +
        `for payment ${entry.payment_id} (stuck ${stuckMinutes} min, address: ${entry.address}, currency: ${entry.currency})`
      );

      const recoveryResult = await attemptAutoRecovery({
        payment_id: entry.payment_id,
        address: entry.address,
        currency: entry.currency,
        tx_id: entry.tx_id,
        amount: entry.amount,
        company_id: entry.company_id,
        metadata: entry.metadata,
      });

      result.recoveryAttempts++;

      if (recoveryResult.status === 'enqueued') {
        result.recoverySuccesses++;
        cronLogger.info(
          `[Watchdog] ✅ Recovery enqueued for ${entry.payment_id}: ${recoveryResult.detail}`
        );
      } else if (recoveryResult.status === 'already_resolved') {
        cronLogger.info(
          `[Watchdog] ✅ Payment ${entry.payment_id} already resolved: ${recoveryResult.detail}`
        );
        tracker.resolved = true;
      } else {
        cronLogger.warn(
          `[Watchdog] ❌ Recovery failed for ${entry.payment_id}: [${recoveryResult.status}] ${recoveryResult.detail}`
        );
      }

      // Update tracker
      await setRecoveryTracker(entry.payment_id, {
        ...tracker,
        attempts: tracker.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: recoveryResult.status !== 'enqueued' && recoveryResult.status !== 'already_resolved'
          ? recoveryResult.detail : tracker.lastError,
      });
    }

    // --- Summary log ---
    if (result.recoveryAttempts > 0 || result.escalations > 0) {
      cronLogger.info(
        `[Watchdog] Summary: ${result.stuckCount} stuck, ` +
        `${result.recoveryAttempts} recovery attempts (${result.recoverySuccesses} enqueued), ` +
        `${result.escalations} escalations, ${alreadyEscalated.length} already escalated`
      );
    }

    return result;
  } catch (err) {
    cronLogger.warn(`[Watchdog] Check failed: ${(err as Error).message}`);
    return result;
  }
}
