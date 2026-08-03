/**
 * Startup Reconciliation Service
 * 
 * Runs on application startup to catch payments that were missed during downtime.
 * 
 * Three reconciliation strategies:
 * 1. Redis Scan: Find payments stuck in "processing" or "retrying" state in Redis
 * 2. Failed Payments: Re-queue failed payments from Redis (failed-payment-* keys)
 * 3. Tatum Failed Webhooks: Query Tatum API for webhook delivery failures and replay them
 */

import { webhookLogs } from "../utils/loggers";
import { redis as redisClient, getRedisItem, setRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { enqueueWebhook, WebhookJobData, webhookQueue } from "./webhookQueue";
import { captureError } from "./errorMonitoringService";
import { parseState, PaymentState } from "./paymentStateMachine";
import { verifySettlementOnChain, markSettlementCompleted } from "./paymentReliability";
import axios from "axios";

/**
 * Run all reconciliation strategies on startup.
 * Safe to call multiple times — uses Redis locks internally.
 */
export async function runStartupReconciliation(): Promise<{
  stuckPayments: number;
  failedPayments: number;
  failedStatePayments: number;
  bullmqFailedJobs: number;
  tatumMissed: number;
  errors: string[];
}> {
  const stats = { stuckPayments: 0, failedPayments: 0, failedStatePayments: 0, bullmqFailedJobs: 0, tatumMissed: 0, errors: [] as string[] };

  webhookLogs.info("[Reconciliation] Starting startup reconciliation...");

  // ── Strategy 1: Redis stuck payments ────────────────────────────────────────
  try {
    stats.stuckPayments = await reconcileStuckPayments();
    webhookLogs.info(`[Reconciliation] Stuck payments re-queued: ${stats.stuckPayments}`);
  } catch (err) {
    const msg = `Stuck payment reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 2: Redis failed payments (failed-payment-* keys) ───────────────
  try {
    stats.failedPayments = await reconcileFailedPayments();
    webhookLogs.info(`[Reconciliation] Failed payments re-queued: ${stats.failedPayments}`);
  } catch (err) {
    const msg = `Failed payment reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 3: Tatum failed webhooks ───────────────────────────────────────
  try {
    stats.tatumMissed = await reconcileTatumFailedWebhooks();
    webhookLogs.info(`[Reconciliation] Tatum missed webhooks re-queued: ${stats.tatumMissed}`);
  } catch (err) {
    const msg = `Tatum reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 4: Direct crypto-* key scan for "failed" status ────────────────
  // Fallback for when failed-payment-* keys were consumed but the re-queued job
  // didn't actually fix the payment (e.g., duplicate check blocked recovery).
  // This scans the source-of-truth crypto-* keys directly.
  try {
    stats.failedStatePayments = await reconcileFailedStatePayments();
    webhookLogs.info(`[Reconciliation] Failed-state payments re-queued: ${stats.failedStatePayments}`);
  } catch (err) {
    const msg = `Failed-state reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 5: BullMQ internal failed jobs ──────────────────────────────────
  // Catches jobs that were silently lost due to stalls, worker crashes, or Redis hiccups.
  // These jobs never updated Redis state, so Strategies 1-4 can't find them.
  try {
    stats.bullmqFailedJobs = await reconcileBullMQFailedJobs();
    webhookLogs.info(`[Reconciliation] BullMQ failed jobs re-queued: ${stats.bullmqFailedJobs}`);
  } catch (err) {
    const msg = `BullMQ failed job reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  const total = stats.stuckPayments + stats.failedPayments + stats.failedStatePayments + stats.bullmqFailedJobs + stats.tatumMissed;
  webhookLogs.info(`[Reconciliation] Complete. Total re-queued: ${total}, Errors: ${stats.errors.length}`);

  if (total > 0) {
    // Severity logic:
    // - Stuck/failed payments are ACTUAL issues → count toward high severity
    // - Tatum missed webhooks are REPLAYS that go through full validation pipeline
    //   (asset check, payment guard, etc.) → only concerning if many are missed
    // - BullMQ failed jobs are internal retries → moderate concern
    const criticalCount = stats.stuckPayments + stats.failedPayments + stats.failedStatePayments;
    const replayCount = stats.tatumMissed + stats.bullmqFailedJobs;

    // Pure tatum replays with no critical issues are expected after restart — don't alert
    if (criticalCount === 0 && stats.bullmqFailedJobs === 0 && stats.tatumMissed <= 10) {
      webhookLogs.info(
        `[Reconciliation] ℹ️ Only ${stats.tatumMissed} Tatum replays (no critical issues) — suppressing alert`
      );
    } else {
      let severity: "high" | "medium" | "low";
      if (criticalCount > 3 || total > 20) {
        severity = "high";  // Actual stuck/failed payments, or huge backlog
      } else if (criticalCount > 0 || replayCount > 10) {
        severity = "medium"; // Some real issues, or notable replay backlog
      } else {
        severity = "low";   // Only Tatum replays — normal after restart
      }

      captureError(
        new Error(`Reconciliation found ${total} items to process`),
        "system",
        {
          severity,
          extraContext: JSON.stringify(stats),
        }
      );
    }
  }

  return stats;
}

/**
 * Strategy 1: Scan Redis for payments stuck in "processing" or "retrying" state.
 * These are payments where the server crashed mid-processing.
 */
async function reconcileStuckPayments(): Promise<number> {
  let count = 0;
  const staleThresholdMs = 60000; // 1 minute — if "processing" for >1min, it's stale

  // Scan Redis for crypto-* keys (these are payment state keys)
  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      try {
        const rawData = await redisClient.get(key);
        if (!rawData) continue;

        const data = JSON.parse(rawData);
        const parsedStatus = parseState(data.status);
        const isStuck = (parsedStatus === PaymentState.PROCESSING)
          && data.txId
          && data.lastAttempt
          && (Date.now() - new Date(data.lastAttempt).getTime()) > staleThresholdMs;

        if (isStuck) {
          webhookLogs.info(`[Reconciliation] Found stuck payment: ${key}, status=${data.status}, txId=${data.txId}`);

          // Idempotency: skip if this incoming tx is already settled in the ledger.
          try {
            const { default: sequelize } = await import("../utils/dbInstance");
            const { QueryTypes } = await import("sequelize");
            const already = (await sequelize.query(
              `SELECT 1 FROM tbl_user_transaction
               WHERE incoming_tx_hash = :txid AND status IN ('successful','completed') LIMIT 1`,
              { replacements: { txid: data.txId }, type: QueryTypes.SELECT }
            )) as unknown[];
            if (Array.isArray(already) && already.length > 0) {
              webhookLogs.info(`[Reconciliation] Skipping stuck payment ${key} — already settled in tbl_user_transaction (tx=${data.txId})`);
              continue;
            }
          } catch (dbErr) {
            webhookLogs.warn(`[Reconciliation] Stuck-payment idempotency check failed (non-fatal): ${(dbErr as Error).message}`);
          }

          await enqueueWebhook({
            payload: {
              address: key.replace("crypto-", "").replace(":json", ""),
              amount: data.receivedAmount || data.amount || "0",
              txId: data.txId,
              asset: data.currency,
            },
            queryParams: {
              company_id: data.company_id ? Number(data.company_id) : undefined,
            },
            receivedAt: new Date().toISOString(),
            source: "reconciliation",
          });
          count++;
        }
      } catch (parseErr) {
        // Skip malformed keys
      }
    }
  } while (cursor !== 0);

  return count;
}

/**
 * Strategy 2: Scan Redis for failed-payment-* keys.
 * These are payments that failed all in-line retries and were stored for later recovery.
 */
async function reconcileFailedPayments(): Promise<number> {
  let count = 0;
  const maxAgeMs = 24 * 60 * 60 * 1000; // Only reconcile failures from last 24h

  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: "failed-payment-*:json", COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      try {
        const rawData = await redisClient.get(key);
        if (!rawData) continue;

        const data = JSON.parse(rawData);
        const failedAt = data.failed_at ? new Date(data.failed_at).getTime() : 0;

        if (failedAt > 0 && (Date.now() - failedAt) < maxAgeMs && data.txId) {
          // Skip known unrecoverable errors (balance=0, funds already moved)
          const lastError = data.error || "";
          if (/balance \[0\]|token balance \[0\]|Insufficient.*balance/i.test(lastError)) {
            webhookLogs.info(`[Reconciliation] Skipping permanently unrecoverable: ${key}`);
            await redisClient.del(key);
            await redisClient.del(key.replace(":json", ""));
            continue;
          }

          webhookLogs.info(`[Reconciliation] Found failed payment: ${key}, txId=${data.txId}`);

          await enqueueWebhook({
            payload: {
              address: data.address,
              amount: data.amount || "0",
              txId: data.txId,
              asset: data.currency,
            },
            queryParams: {
              company_id: data.company_id ? Number(data.company_id) : undefined,
            },
            receivedAt: new Date().toISOString(),
            source: "reconciliation",
          });

          // Remove from failed set to avoid re-reconciling
          await redisClient.del(key);
          await redisClient.del(key.replace(":json", ""));
          count++;
        }
      } catch (parseErr) {
        // Skip malformed keys
      }
    }
  } while (cursor !== 0);

  return count;
}

/**
 * Strategy 4: Direct scan of crypto-* Redis keys for "failed" status.
 * 
 * This is the ultimate fallback for payments that:
 * - Had their failed-payment-* key consumed by a previous reconciliation
 * - Were re-queued but the job hit the old duplicate check and did nothing
 * - Have no remaining failed-payment-* key, but the crypto-* source-of-truth still shows "failed"
 * 
 * Scans the actual payment state keys and re-queues any with status "failed" that have a txId.
 *
 * EXPORTED so a periodic leader cron (server.ts) can re-run it every few minutes —
 * this lets deferred settlements (e.g. `gas_pending` after an empty TRX fee wallet)
 * auto-heal once the underlying condition recovers, WITHOUT needing an app redeploy.
 * Cheap by design: Redis scan + on-chain verification only when retryCount >= 2.
 */
export async function reconcileFailedStatePayments(): Promise<number> {
  let count = 0;
  let skippedPermanent = 0;
  let skippedRetryLimit = 0;
  let skippedRecent = 0;
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // Recover failures up to 7 days old
  const MIN_AGE_MS = 5 * 60 * 1000; // Skip failures < 5 min old (likely being processed already)
  const MAX_RETRY_COUNT = 5; // Allow more retries after root cause fixes (was 3)

  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      try {
        const rawData = await redisClient.get(key);
        if (!rawData) continue;

        const data = JSON.parse(rawData);
        const parsedStatus = parseState(data.status);

        // Target payments that have a txId but never settled:
        // FAILED (explicit failure), DETECTED/PROCESSING (stuck mid-flow),
        // gas_pending (deferred due to energy), permanently_failed (may be recoverable after root cause fix)
        if (!data.txId) continue;
        const isRecoverableStatus = parsedStatus === PaymentState.FAILED
          || parsedStatus === PaymentState.DETECTED
          || parsedStatus === PaymentState.PROCESSING
          || data.status === 'gas_pending';
        if (!isRecoverableStatus && data.status !== "permanently_failed") continue;
        if (data.status === "permanently_failed") {
          // Allow one more retry for permanently_failed payments whose root cause
          // may have been fixed (e.g., fee wallet topped up, gas prices dropped).
          // CRITICAL: Reset retryCount and status in Redis so the webhook processor
          // doesn't immediately reject the re-queued job.
          const pfReason = data.permanentFailReason || "";
          const pfAge = data.permanentlyFailedAt ? Date.now() - new Date(data.permanentlyFailedAt).getTime() : 0;
          // Only retry if permanently failed > 5 min ago (avoid tight loops) and < 7 days
          if (pfAge < 300000 || pfAge > 7 * 86400000) {
            skippedPermanent++;
            continue;
          }
          // Reset Redis state to allow webhook processor to actually retry
          // Note: key from scan already ends with :json, setRedisItem would double-suffix.
          // Use the base key (without :json) since setRedisItem appends :json internally.
          const baseKey = key.endsWith(":json") ? key.slice(0, -5) : key;
          await setRedisItem(baseKey, {
            ...data,
            status: "failed",           // Downgrade from permanently_failed to failed
            retryCount: "0",            // Reset retry count for fresh attempts
            lastError: undefined,       // Clear stale error
            failedAt: undefined,        // Clear stale timestamp
            permanentlyFailedAt: undefined,
            permanentFailReason: undefined,
            reconciledAt: new Date().toISOString(),
            reconciledFrom: "permanently_failed",
            previousError: data.lastError?.slice(0, 200),  // Preserve for debugging
          });
          webhookLogs.info(`[Reconciliation] Strategy 4: Retrying permanently_failed payment (reason=${pfReason}, age=${Math.round(pfAge / 60000)}min) — Redis retryCount RESET to 0`);
        }

        // Skip if already retried too many times
        const retryCount = parseInt(data.retryCount || "0") || 0;
        if (retryCount >= MAX_RETRY_COUNT) {
          skippedRetryLimit++;
          continue;
        }

        // Skip known unrecoverable errors (balance=0, funds already moved)
        const lastError = data.lastError || "";
        if (/balance \[0\]|token balance \[0\]|Insufficient.*balance/i.test(lastError)) {
          skippedPermanent++;
          continue;
        }

        // Check age — failedAt or lastAttempt timestamp
        const failedAt = data.failedAt ? new Date(data.failedAt).getTime()
          : data.lastAttempt ? new Date(data.lastAttempt).getTime()
          : 0;
        if (failedAt > 0 && (Date.now() - failedAt) > maxAgeMs) continue;

        // Skip recently failed payments — they're likely still being retried by BullMQ or other strategies
        if (failedAt > 0 && (Date.now() - failedAt) < MIN_AGE_MS) {
          skippedRecent++;
          continue;
        }

        const address = key.replace("crypto-", "").replace(":json", "");

        // ── IDEMPOTENCY GUARD (fixes orphan "processing" journal rows) ──
        // If this incoming tx already has a SETTLED merchant record, the
        // payment is done. Re-queueing it was re-opening a
        // payment_detected→processing journal entry that never closed (the
        // false "stuck payment" signal) and wasting settlement attempts.
        try {
          const { default: sequelize } = await import("../utils/dbInstance");
          const { QueryTypes } = await import("sequelize");
          const already = (await sequelize.query(
            `SELECT 1 FROM tbl_user_transaction
             WHERE incoming_tx_hash = :txid AND status IN ('successful','completed') LIMIT 1`,
            { replacements: { txid: data.txId }, type: QueryTypes.SELECT }
          )) as unknown[];
          if (Array.isArray(already) && already.length > 0) {
            const baseKey2 = key.endsWith(":json") ? key.slice(0, -5) : key;
            await setRedisItem(baseKey2, {
              ...data,
              status: "completed",
              reconciledAt: new Date().toISOString(),
              reconciledFrom: "already_settled_db",
            });
            webhookLogs.info(
              `[Reconciliation] Strategy 4: Skipping ${address} — already settled in tbl_user_transaction (tx=${data.txId})`
            );
            skippedPermanent++;
            continue;
          }
        } catch (dbErr) {
          webhookLogs.warn(`[Reconciliation] Strategy 4: DB idempotency check failed (non-fatal): ${(dbErr as Error).message}`);
        }
        
        // ── AUTO-RECOVERY: Before re-queueing, check if the settlement already
        // completed on-chain. This prevents the infinite reconciliation loop where
        // the blockchain TX succeeded but the DB was never updated.
        const currency = data.currency || "";
        const paymentId = data.payment_id || data.paymentId || "";
        const isTronOrEth = currency.includes("TRC20") || currency === "TRX" ||
                            currency.includes("ERC20") || currency === "ETH";
        
        if (isTronOrEth && address && retryCount >= 2) {
          try {
            const onChainResult = await verifySettlementOnChain(
              address, currency, null, paymentId || address
            );
            if (onChainResult.settled && onChainResult.outgoingTxId) {
              webhookLogs.info(
                `[Reconciliation] 🔄 AUTO-RECOVERY: Payment at ${address} already settled on-chain! ` +
                `TX: ${onChainResult.outgoingTxId}, amount: ${onChainResult.amount}. ` +
                `Updating Redis state to completed — NOT re-queueing.`
              );
              // Update Redis state to completed so it's not picked up again
              const baseKey = key.endsWith(":json") ? key.slice(0, -5) : key;
              await setRedisItem(baseKey, {
                ...data,
                status: "completed",
                settlementTxId: onChainResult.outgoingTxId,
                settledAmount: onChainResult.amount,
                autoRecoveredAt: new Date().toISOString(),
                autoRecoverySource: "reconciliation_blockchain_verify",
              });
              
              // Also update user_transaction if we can find it
              try {
                const { default: sequelize } = await import("../utils/dbInstance");
                const { QueryTypes } = await import("sequelize");
                const txId = data.txId || "";
                if (txId) {
                  await sequelize.query(
                    `UPDATE tbl_user_transaction 
                     SET status = 'successful', 
                         incoming_tx_hash = :incomingTx, 
                         outgoing_tx_hash = :outgoingTx,
                         "updatedAt" = NOW()
                     WHERE incoming_tx_hash IS NULL 
                     AND status IN ('pending', 'processing', 'failed')
                     AND crypto_currency = :currency
                     AND company_id = :companyId
                     AND "createdAt" BETWEEN :startDate AND :endDate`,
                    {
                      replacements: {
                        incomingTx: txId,
                        outgoingTx: onChainResult.outgoingTxId,
                        currency: currency,
                        companyId: data.company_id ? Number(data.company_id) : 0,
                        startDate: new Date(new Date(data.detectedAt || data.createdAt || Date.now()).getTime() - 60000).toISOString(),
                        endDate: new Date(new Date(data.detectedAt || data.createdAt || Date.now()).getTime() + 60000).toISOString(),
                      },
                      type: QueryTypes.UPDATE,
                    }
                  );
                  webhookLogs.info(`[Reconciliation] ✅ Auto-updated user_transaction for ${address}`);
                }
              } catch (dbErr) {
                webhookLogs.warn(`[Reconciliation] DB auto-update failed (non-critical): ${(dbErr as Error).message}`);
              }
              
              skippedPermanent++;
              continue; // Don't re-queue — it's already settled
            }
          } catch (verifyErr) {
            webhookLogs.warn(
              `[Reconciliation] On-chain verify failed for ${address}: ${(verifyErr as Error).message}. ` +
              `Proceeding with normal re-queue.`
            );
          }
        }

        webhookLogs.info(`[Reconciliation] Strategy 4: Found failed-state payment: ${address}, txId=${data.txId}, retryCount=${retryCount}, failedAt=${data.failedAt || "unknown"}, error=${(data.lastError || "unknown").slice(0, 100)}`);

        await enqueueWebhook({
          payload: {
            address,
            amount: data.receivedAmount || data.amount || "0",
            txId: data.txId,
            asset: data.currency,
          },
          queryParams: {
            company_id: data.company_id ? Number(data.company_id) : undefined,
          },
          receivedAt: new Date().toISOString(),
          source: "reconciliation",
        });
        count++;
      } catch (parseErr) {
        // Skip malformed keys
      }
    }
  } while (cursor !== 0);

  if (skippedPermanent > 0 || skippedRetryLimit > 0 || skippedRecent > 0) {
    webhookLogs.info(`[Reconciliation] Strategy 4: Skipped ${skippedPermanent} permanent, ${skippedRetryLimit} retry-limit, ${skippedRecent} recent`);
  }

  return count;
}



/**
 * Strategy 3: Query Tatum for failed webhook deliveries.
 * Tatum stores failed webhook attempts and exposes them via API.
 */
async function reconcileTatumFailedWebhooks(): Promise<number> {
  let count = 0;
  const MAX_AGE_DAYS = 7;
  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - maxAgeMs;

  const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
  if (!tatumKey) {
    webhookLogs.info("[Reconciliation] No Tatum API key available, skipping Tatum reconciliation");
    return 0;
  }

  // Build a set of fee wallet addresses to skip (internal fund movements are not customer payments)
  let feeWalletAddresses: Set<string> = new Set();
  try {
    const { adminFeeModel } = await import("../models");
    const feeWallets = await adminFeeModel.findAll({ attributes: ["wallet_address"] });
    feeWalletAddresses = new Set(feeWallets.map((w: any) => w.dataValues.wallet_address?.toLowerCase()).filter(Boolean));
    webhookLogs.info(`[Reconciliation] Loaded ${feeWalletAddresses.size} fee wallet addresses to exclude`);
  } catch (feeErr) {
    webhookLogs.error(`[Reconciliation] Could not load fee wallets (non-fatal): ${(feeErr as Error).message}`);
  }

  try {
    // Get failed webhooks from Tatum (most recent first so we can stop early)
    const headers = { "x-api-key": tatumKey };
    
    const { data: failedWebhooks } = await axios.get(
      "https://api.tatum.io/v4/subscription/webhook?pageSize=50&direction=desc",
      { headers, timeout: 15000 }
    );

    if (!failedWebhooks || !Array.isArray(failedWebhooks) || failedWebhooks.length === 0) {
      webhookLogs.info("[Reconciliation] No failed Tatum webhooks found");
      return 0;
    }

    // Filter to only recent webhooks (last 7 days)
    let skippedStale = 0;
    let skippedProcessed = 0;
    let skippedFeeWallet = 0;

    for (const webhook of failedWebhooks) {
      try {
        // Check webhook timestamp — skip anything older than MAX_AGE_DAYS
        const webhookTimestamp = webhook.timestamp || webhook.created || webhook.nextTime;
        if (webhookTimestamp) {
          const webhookTime = new Date(webhookTimestamp).getTime();
          if (!isNaN(webhookTime) && webhookTime < cutoffTime) {
            skippedStale++;
            continue; // Too old, skip
          }
        }

        const webhookData = typeof webhook.data === "string" ? JSON.parse(webhook.data) : webhook.data;
        if (!webhookData?.txId) continue;

        // Skip webhooks targeting fee wallet addresses (internal fund movements, not customer payments)
        const webhookAddress = (webhookData.address || "").toLowerCase();
        if (webhookAddress && feeWalletAddresses.has(webhookAddress)) {
          skippedFeeWallet++;
          // Mark as reconciled so it doesn't appear again
          const reconciledKey = `reconciled-tx-${webhookData.txId}`;
          await setRedisItemWithTTL(reconciledKey, { reconciledAt: new Date().toISOString(), source: "fee-wallet-skip" }, 30 * 24 * 60 * 60);
          continue;
        }

        // Check if we already processed OR already reconciled this transaction
        const processedKey = `processed-tx-${webhookData.txId}`;
        const reconciledKey = `reconciled-tx-${webhookData.txId}`;
        const alreadyProcessed = await getRedisItem(processedKey);
        if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
          skippedProcessed++;
          continue;
        }
        const alreadyReconciled = await getRedisItem(reconciledKey);
        if (alreadyReconciled && Object.keys(alreadyReconciled).length > 0) {
          skippedProcessed++;
          continue;
        }

        // BUG-5 FIX: Also skip outgoing transactions (settlement/sweep TXs)
        const outgoingTxKey = `outgoing-tx-${webhookData.txId}`;
        const isOutgoing = await getRedisItem(outgoingTxKey);
        if (isOutgoing && Object.keys(isOutgoing).length > 0) {
          skippedProcessed++;
          continue;
        }

        // Skip obvious gas/dust transactions — native chain tokens with dust amounts.
        // These are gas-change or spam TXs that the webhook processor would reject anyway
        // via asset validation, but filtering here avoids unnecessary queue churn.
        const GAS_DUST_ASSETS = new Set(["TRON", "ETH", "MATIC", "BNB"]);
        const webhookAmount = parseFloat(webhookData.amount || "0");
        if (GAS_DUST_ASSETS.has((webhookData.asset || "").toUpperCase()) && webhookAmount < 0.01) {
          webhookLogs.info(`[Reconciliation] Skipping gas/dust TX: txId=${webhookData.txId}, asset=${webhookData.asset}, amount=${webhookAmount}`);
          const reconciledKey2 = `reconciled-tx-${webhookData.txId}`;
          await setRedisItemWithTTL(reconciledKey2, { reconciledAt: new Date().toISOString(), source: "gas-dust-skip" }, 30 * 24 * 60 * 60);
          continue;
        }

        webhookLogs.info(`[Reconciliation] Re-queuing Tatum failed webhook: txId=${webhookData.txId}`);

        await enqueueWebhook({
          payload: {
            address: webhookData.address || "",
            counterAddress: webhookData.counterAddress,
            amount: webhookData.amount || "0",
            txId: webhookData.txId,
            asset: webhookData.asset || webhookData.currency,
          },
          queryParams: {},
          receivedAt: new Date().toISOString(),
          source: "reconciliation",
        });

        // Mark as reconciled with 30-day TTL to prevent re-queuing on future restarts
        await setRedisItemWithTTL(reconciledKey, { reconciledAt: new Date().toISOString(), source: "tatum-failed-webhook" }, 30 * 24 * 60 * 60);
        count++;
      } catch (parseErr) {
        webhookLogs.error(`[Reconciliation] Failed to parse Tatum webhook:`, parseErr);
      }
    }

    webhookLogs.info(
      `[Reconciliation] Tatum webhooks: ${count} re-queued, ${skippedStale} skipped (older than ${MAX_AGE_DAYS}d), ${skippedProcessed} skipped (already processed), ${skippedFeeWallet} skipped (fee wallet)`
    );
  } catch (apiErr) {
    const msg = (apiErr as Error).message;
    // Non-critical: Tatum API might not support this endpoint on all plans
    if (msg.includes("403") || msg.includes("401")) {
      webhookLogs.info("[Reconciliation] Tatum failed webhooks API not available on current plan");
    } else {
      throw apiErr;
    }
  }

  return count;
}


/**
 * Clear stale Tatum failed webhooks by marking them all as "reconciled" in Redis.
 * This prevents them from being re-queued on every server restart.
 * Call this once to stop the recurring HIGH severity reconciliation alerts.
 */
export async function clearStaleTatumWebhooks(): Promise<{
  total: number;
  cleared: number;
  alreadyCleared: number;
  errors: string[];
}> {
  const stats = { total: 0, cleared: 0, alreadyCleared: 0, errors: [] as string[] };

  const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
  if (!tatumKey) {
    stats.errors.push("No Tatum API key available");
    return stats;
  }

  try {
    const headers = { "x-api-key": tatumKey };
    const { data: failedWebhooks } = await axios.get(
      "https://api.tatum.io/v4/subscription/webhook?pageSize=50&direction=desc",
      { headers, timeout: 15000 }
    );

    if (!failedWebhooks || !Array.isArray(failedWebhooks) || failedWebhooks.length === 0) {
      webhookLogs.info("[ClearStale] No failed Tatum webhooks found");
      return stats;
    }

    stats.total = failedWebhooks.length;

    for (const webhook of failedWebhooks) {
      try {
        const webhookData = typeof webhook.data === "string" ? JSON.parse(webhook.data) : webhook.data;
        if (!webhookData?.txId) continue;

        const reconciledKey = `reconciled-tx-${webhookData.txId}`;
        const processedKey = `processed-tx-${webhookData.txId}`;

        // Check if already marked
        const alreadyReconciled = await getRedisItem(reconciledKey);
        const alreadyProcessed = await getRedisItem(processedKey);
        if ((alreadyReconciled && Object.keys(alreadyReconciled).length > 0) ||
            (alreadyProcessed && Object.keys(alreadyProcessed).length > 0)) {
          stats.alreadyCleared++;
          continue;
        }

        // Mark as reconciled with 30-day TTL
        await setRedisItemWithTTL(reconciledKey, {
          reconciledAt: new Date().toISOString(),
          source: "manual-clear-stale",
          txId: webhookData.txId,
          address: webhookData.address || "unknown",
        }, 30 * 24 * 60 * 60);

        webhookLogs.info(`[ClearStale] Marked as reconciled: txId=${webhookData.txId}`);
        stats.cleared++;
      } catch (parseErr) {
        stats.errors.push(`Failed to parse webhook: ${(parseErr as Error).message}`);
      }
    }

    webhookLogs.info(
      `[ClearStale] Complete: ${stats.cleared} cleared, ${stats.alreadyCleared} already cleared, ${stats.errors.length} errors out of ${stats.total} total`
    );
  } catch (apiErr) {
    stats.errors.push(`Tatum API error: ${(apiErr as Error).message}`);
  }

  return stats;
}


/**
 * Strategy 5: BullMQ internal failed jobs recovery.
 * 
 * Catches jobs that were silently lost due to:
 * - Worker stalls (event loop blocked, lockDuration exceeded)
 * - Redis connectivity hiccups during processing
 * - Worker crashes mid-processing
 * 
 * These jobs never updated the Redis crypto-* keys, so Strategies 1-4 can't find them.
 * This directly queries BullMQ's failed job list and re-enqueues them.
 */
async function reconcileBullMQFailedJobs(): Promise<number> {
  let requeued = 0;
  
  try {
    const failedJobs = await webhookQueue.getFailed(0, 100); // Get up to 100 failed jobs
    
    if (failedJobs.length === 0) {
      webhookLogs.info("[Reconciliation] Strategy 5: No BullMQ failed jobs found");
      return 0;
    }
    
    webhookLogs.info(`[Reconciliation] Strategy 5: Found ${failedJobs.length} BullMQ failed jobs`);
    
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    for (const job of failedJobs) {
      try {
        const jobData = job.data as WebhookJobData;
        const jobAge = now - (job.timestamp || 0);
        
        // Skip jobs older than 7 days
        if (jobAge > maxAgeMs) {
          webhookLogs.info(`[Reconciliation] Strategy 5: Skipping old BullMQ job ${job.id} (${Math.round(jobAge / 86400000)}d old)`);
          continue;
        }
        
        // Check if this tx was already processed successfully
        const txId = jobData?.payload?.txId;
        if (!txId) {
          webhookLogs.warn(`[Reconciliation] Strategy 5: Skipping job ${job.id} — no txId in payload`);
          continue;
        }
        
        const alreadyProcessed = await getRedisItem(`processed-tx-${txId}`);
        if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
          webhookLogs.info(`[Reconciliation] Strategy 5: Skipping ${job.id} — tx ${txId} already processed`);
          // Clean up the failed job since it was actually processed
          try { await job.remove(); } catch (_) { /* ignore */ }
          continue;
        }
        
        // Re-enqueue the failed job
        webhookLogs.info(`[Reconciliation] Strategy 5: Re-queuing BullMQ failed job ${job.id} (tx: ${txId}, failed: ${job.failedReason})`);
        
        await enqueueWebhook(
          { ...jobData, source: "reconciliation" },
          { jobId: `bullmq-recovery-${txId}-${Date.now()}` }
        );
        
        // Remove the failed job to prevent re-processing on next reconciliation
        try { await job.remove(); } catch (_) { /* ignore */ }
        
        requeued++;
      } catch (jobErr) {
        webhookLogs.error(`[Reconciliation] Strategy 5: Error processing failed job ${job.id}: ${(jobErr as Error).message}`);
      }
    }
    
    webhookLogs.info(`[Reconciliation] Strategy 5: Re-queued ${requeued} of ${failedJobs.length} BullMQ failed jobs`);
  } catch (err) {
    webhookLogs.error(`[Reconciliation] Strategy 5: Error querying BullMQ failed jobs: ${(err as Error).message}`);
    throw err;
  }
  
  return requeued;
}
