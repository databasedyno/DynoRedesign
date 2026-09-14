/**
 * Webhook Retry Service
 * Implements exponential backoff retry logic for failed webhook deliveries
 * Stores failed webhooks in a dead letter queue after max retries
 */

import axios, { AxiosError } from 'axios';
import { webhookLogs } from "../utils/loggers";
import { setRedisItem, getRedisItem, deleteRedisItem, setRedisTTL } from './redisInstance';

interface WebhookPayload {
  url: string;
  payload: unknown;
  headers: Record<string, string>;
  companyId: number;
  eventType: string;
  webhookId: string;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,      // 1 second
  maxDelayMs: 60000,          // 1 minute
  backoffMultiplier: 2        // Exponential: 1s, 2s, 4s
};

/**
 * Calculate delay for next retry using exponential backoff
 */
const calculateRetryDelay = (
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number => {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber - 1);
  return Math.min(delay, config.maxDelayMs);
};

/**
 * Store failed webhook in retry queue
 */
const storeFailedWebhook = async (
  webhookData: WebhookPayload,
  attemptNumber: number,
  error: string
): Promise<void> => {
  const retryKey = `webhook:retry:${webhookData.webhookId}:${attemptNumber}`;
  const retryData = {
    ...webhookData,
    attemptNumber,
    error,
    scheduledFor: Date.now() + calculateRetryDelay(attemptNumber)
  };
  
  // Store with TTL of 24 hours
  await setRedisItem(retryKey, retryData);
  await setRedisTTL(retryKey, 86400);
  
  // Add to retry queue index
  const queueKey = 'webhook:retry:queue';
  const queueData = await getRedisItem(queueKey) || { items: [] };
  queueData.items.push({
    key: retryKey,
    scheduledFor: retryData.scheduledFor,
    webhookId: webhookData.webhookId
  });
  await setRedisItem(queueKey, queueData);
  await setRedisTTL(queueKey, 86400);
};

/**
 * Move webhook to dead letter queue after max retries
 */
const moveToDeadLetterQueue = async (
  webhookData: WebhookPayload,
  finalError: string
): Promise<void> => {
  const dlqKey = `webhook:dlq:${webhookData.webhookId}`;
  const dlqData = {
    ...webhookData,
    failedAt: Date.now(),
    finalError,
    maxRetriesExceeded: true
  };
  
  // Store in DLQ with 7 day TTL for manual review
  await setRedisItem(dlqKey, dlqData);
  await setRedisTTL(dlqKey, 604800);
  
  // Log to database
  try {
    const sequelize = require('./dbInstance').default;
    await sequelize.query(
      `INSERT INTO tbl_webhook_delivery_log 
       (company_id, webhook_url, event_type, webhook_id, payload, status, error_message, retry_count, created_at, completed_at)
       VALUES (:companyId, :url, :eventType, :webhookId, :payload, 'dead_letter_queue', :error, :retries, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      {
        replacements: {
          companyId: webhookData.companyId,
          url: webhookData.url,
          eventType: webhookData.eventType,
          webhookId: webhookData.webhookId,
          payload: JSON.stringify(webhookData.payload),
          error: finalError,
          retries: DEFAULT_RETRY_CONFIG.maxRetries
        }
      }
    );
  } catch (dbErr) {
    webhookLogs.error('[WebhookRetry] Failed to log DLQ entry:', dbErr);
  }
  
  webhookLogs.error(
    `[WebhookRetry] Webhook ${webhookData.webhookId} moved to DLQ after ${DEFAULT_RETRY_CONFIG.maxRetries} failed attempts. ` +
    `URL: ${webhookData.url}, Error: ${finalError}`
  );

  // Session 49: Circuit-breaker. Track per-(company, URL) DLQ hits over a
  // rolling 24h window; after 3 hits, auto-disable the webhook_url on the
  // company and email the merchant. This prevents indefinite spam of failed
  // deliveries when a merchant's endpoint is misconfigured or truncated.
  try {
    // Use a URL hash to keep the Redis key short & avoid special chars.
    const crypto = require('crypto');
    const urlHash = crypto.createHash('sha256').update(webhookData.url).digest('hex').substring(0, 16);
    const cbKey = `webhook:cb:${webhookData.companyId}:${urlHash}`;
    const existing = (await getRedisItem(cbKey)) || { count: 0, firstAt: Date.now() };
    existing.count = (existing.count || 0) + 1;
    existing.lastError = finalError;
    existing.lastUrl = webhookData.url;
    existing.lastAt = Date.now();
    await setRedisItem(cbKey, existing);
    await setRedisTTL(cbKey, 86400); // 24h rolling window

    const DISABLE_THRESHOLD = 3;
    if (existing.count >= DISABLE_THRESHOLD) {
      const sequelize = require('./dbInstance').default;
      // Only disable if not already disabled — idempotent
      const [rows] = await sequelize.query(
        `SELECT webhook_disabled, email, "user_id" FROM tbl_company WHERE company_id = :cid LIMIT 1`,
        { replacements: { cid: webhookData.companyId } }
      );
      const row = (rows as Array<{ webhook_disabled: boolean; email: string | null; user_id: number }>)[0];
      if (row && !row.webhook_disabled) {
        const reason = `Circuit breaker: ${existing.count} consecutive DLQ hits in 24h — last error: ${String(finalError).substring(0, 300)}`;
        await sequelize.query(
          `UPDATE tbl_company
             SET webhook_disabled = TRUE,
                 webhook_disabled_at = CURRENT_TIMESTAMP,
                 webhook_disabled_reason = :reason
           WHERE company_id = :cid`,
          { replacements: { cid: webhookData.companyId, reason } }
        );
        webhookLogs.error(`[WebhookRetry] 🚨 Circuit breaker TRIPPED — auto-disabled webhook_url for company_id=${webhookData.companyId} (url=${webhookData.url}). Reason: ${reason}`);

        // Send merchant alert email (best-effort, non-blocking)
        try {
          const [ownerRows] = await sequelize.query(
            `SELECT u.email, u.name, c.company_name, u.language
               FROM tbl_user u
               JOIN tbl_company c ON c.user_id = u.user_id
              WHERE c.company_id = :cid LIMIT 1`,
            { replacements: { cid: webhookData.companyId } }
          );
          const owner = (ownerRows as Array<{ email: string | null; name: string | null; company_name: string | null; language: string | null }>)[0];
          if (owner?.email) {
            const emailService = require('../services/emailService');
            const sendFn = emailService.sendWebhookDisabledEmail || emailService.default?.sendWebhookDisabledEmail;
            if (typeof sendFn === 'function') {
              await sendFn(
                owner.email,
                owner.name || 'Merchant',
                owner.company_name || 'your company',
                webhookData.url,
                webhookData.eventType,
                String(finalError).substring(0, 300),
                existing.count
              );
              webhookLogs.info(`[WebhookRetry] 📧 Sent webhook-disabled alert email to ${owner.email}`);
            } else {
              webhookLogs.warn(`[WebhookRetry] sendWebhookDisabledEmail not exported from emailService — falling back to generic email`);
            }
          }
        } catch (mailErr) {
          webhookLogs.warn(`[WebhookRetry] Failed to send webhook-disabled alert email: ${(mailErr as Error).message}`);
        }
      }
    }
  } catch (cbErr) {
    webhookLogs.warn(`[WebhookRetry] Circuit breaker bookkeeping failed (non-critical): ${(cbErr as Error).message}`);
  }
};

/**
 * Deliver webhook with retry logic
 */
export const deliverWebhookWithRetry = async (
  webhookData: WebhookPayload,
  attemptNumber: number = 1,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ success: boolean; error?: string }> => {
  try {
    const startTime = Date.now();
    
    const response = await axios.post(webhookData.url, webhookData.payload, {
      headers: webhookData.headers,
      timeout: 10000,  // 10 second timeout
      validateStatus: (status) => status >= 200 && status < 300
    });
    
    const responseTime = Date.now() - startTime;
    
    // Log successful delivery
    webhookLogs.info(
      `[WebhookRetry] ✅ Webhook delivered successfully on attempt ${attemptNumber}. ` +
      `URL: ${webhookData.url}, Response time: ${responseTime}ms, Status: ${response.status}`
    );
    
    // Clean up retry queue entry if this was a retry
    if (attemptNumber > 1) {
      const retryKey = `webhook:retry:${webhookData.webhookId}:${attemptNumber}`;
      await deleteRedisItem(retryKey);
    }
    
    return { success: true };
    
  } catch (error) {
    const axiosError = error as AxiosError;
    const errorMessage = axiosError.response 
      ? `HTTP ${axiosError.response.status}: ${axiosError.message}`
      : axiosError.message || 'Unknown error';
    
    webhookLogs.error(
      `[WebhookRetry] ❌ Webhook delivery failed (attempt ${attemptNumber}/${config.maxRetries}). ` +
      `URL: ${webhookData.url}, Error: ${errorMessage}`
    );
    
    // Check if we should retry
    if (attemptNumber < config.maxRetries) {
      // Store for retry
      await storeFailedWebhook(webhookData, attemptNumber + 1, errorMessage);
      
      const nextDelay = calculateRetryDelay(attemptNumber + 1, config);
      webhookLogs.info(
        `[WebhookRetry] ⏳ Webhook ${webhookData.webhookId} scheduled for retry in ${nextDelay}ms`
      );
      
      return { success: false, error: `Failed, retry scheduled (attempt ${attemptNumber}/${config.maxRetries})` };
    } else {
      // Max retries exceeded, move to DLQ
      await moveToDeadLetterQueue(webhookData, errorMessage);
      return { success: false, error: `Failed after ${config.maxRetries} attempts, moved to DLQ` };
    }
  }
};

/**
 * Process webhook retry queue (called by cron job)
 */
export const processWebhookRetryQueue = async (): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> => {
  const stats = { processed: 0, succeeded: 0, failed: 0 };
  
  try {
    const queueKey = 'webhook:retry:queue';
    const queueData = await getRedisItem(queueKey);
    
    if (!queueData || !queueData.items || queueData.items.length === 0) {
      return stats;
    }
    
    const now = Date.now();
    const itemsToRetry = queueData.items.filter(
      (item: { scheduledFor: number }) => item.scheduledFor <= now
    );
    
    webhookLogs.info(`[WebhookRetry] Processing ${itemsToRetry.length} webhooks from retry queue`);
    
    for (const item of itemsToRetry) {
      const webhookData = await getRedisItem(item.key);
      
      if (!webhookData) {
        webhookLogs.warn(`[WebhookRetry] Webhook data not found for key: ${item.key}`);
        continue;
      }
      
      stats.processed++;
      
      const result = await deliverWebhookWithRetry(
        webhookData,
        webhookData.attemptNumber
      );
      
      if (result.success) {
        stats.succeeded++;
      } else {
        stats.failed++;
      }
      
      // Remove from queue
      queueData.items = queueData.items.filter(
        (i: { key: string }) => i.key !== item.key
      );
    }
    
    // Update queue
    await setRedisItem(queueKey, queueData);
    await setRedisTTL(queueKey, 86400);
    
    if (stats.processed > 0) {
      webhookLogs.info(
        `[WebhookRetry] Queue processing complete: ` +
        `${stats.succeeded} succeeded, ${stats.failed} failed, ${stats.processed} total`
      );
    }
    
  } catch (error) {
    webhookLogs.error('[WebhookRetry] Error processing retry queue:', error);
  }
  
  return stats;
};

/**
 * Get webhook dead letter queue items for manual review
 */
export const getDeadLetterQueueItems = async (): Promise<unknown[]> => {
  // This would typically query Redis for all webhook:dlq:* keys
  // Implementation depends on Redis client capabilities
  return [];
};

/**
 * Manually retry a webhook from DLQ
 */
export const retryFromDeadLetterQueue = async (webhookId: string): Promise<boolean> => {
  const dlqKey = `webhook:dlq:${webhookId}`;
  const webhookData = await getRedisItem(dlqKey);
  
  if (!webhookData) {
    webhookLogs.error(`[WebhookRetry] Webhook not found in DLQ: ${webhookId}`);
    return false;
  }
  
  webhookLogs.info(`[WebhookRetry] Manually retrying webhook from DLQ: ${webhookId}`);
  
  const result = await deliverWebhookWithRetry(webhookData, 1);
  
  if (result.success) {
    // Remove from DLQ on success
    await deleteRedisItem(dlqKey);
  }
  
  return result.success;
};

export default {
  deliverWebhookWithRetry,
  processWebhookRetryQueue,
  getDeadLetterQueueItems,
  retryFromDeadLetterQueue
};
