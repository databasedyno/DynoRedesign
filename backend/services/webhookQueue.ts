/**
 * Webhook Job Queue Service
 * 
 * Uses BullMQ + Redis for persistent, reliable processing of incoming Tatum webhooks.
 * 
 * Architecture:
 * 1. tatumCryptoWebHook (thin handler) → enqueues raw payload to "tatum-webhooks" queue → returns 200 immediately
 * 2. Worker picks up job → runs full processing logic (duplicate check, crypto verification, merchant webhook, etc.)
 * 3. On failure: BullMQ retries with exponential backoff (3 attempts: 5s, 30s, 120s)
 * 4. After max retries: job moves to dead-letter queue for manual review
 * 5. On startup: reconciliation service checks for missed webhooks and re-queues them
 */

import { raw as envRaw } from "../utils/config";
import { Queue, Worker, Job, QueueEvents } from "bullmq";
import { webhookLogs } from "../utils/loggers";
import { log } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";
import { baseEmailTemplate, infoBox, dataRow, statusBadge, p } from "../utils/emailTemplate";

// Redis connection config (reuse from environment)
const REDIS_URL = envRaw("REDIS_PUBLIC_URL") || "redis://localhost:6379";

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    username: parsed.username && parsed.username !== "default" ? parsed.username : undefined,
  };
}

const redisConnection = parseRedisUrl(REDIS_URL);
const DLQ_ALERT_COOLDOWN_SEC = 6 * 60 * 60;

// ── Queue Definition ──────────────────────────────────────────────────────────
export const webhookQueue = new Queue("tatum-webhooks", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30000, // 30s, 60s, 120s — gives gas funding TXs time to confirm on-chain
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24h (for debugging)
      count: 1000, // Max 1000 completed jobs
    },
    removeOnFail: false, // Keep failed jobs for review
  },
});

// ── Dead Letter Queue ─────────────────────────────────────────────────────────
export const deadLetterQueue = new Queue("tatum-webhooks-dlq", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

// ── Job Data Interface ────────────────────────────────────────────────────────
export interface WebhookJobData {
  payload: {
    address: string;
    counterAddress?: string;
    amount: string | number;
    txId: string;
    asset?: string;
    [key: string]: unknown;
  };
  queryParams: {
    company_id?: number;
    user_id?: number;
    address_id?: number;
  };
  receivedAt: string;
  source: "webhook" | "reconciliation" | "admin-replay" | "watchdog-recovery";
}

// ── Enqueue Webhook ───────────────────────────────────────────────────────────
export async function enqueueWebhook(
  data: WebhookJobData,
  options?: { priority?: number; jobId?: string }
): Promise<string> {
  const jobId = options?.jobId || `tx-${data.payload.txId}-${Date.now()}`;
  
  const job = await webhookQueue.add("process-webhook", data, {
    jobId,
    priority: options?.priority || 0,
  });

  webhookLogs.info(`[WebhookQueue] Enqueued job ${job.id} for tx ${data.payload.txId}`);
  return job.id;
}

// ── Worker (started separately via startWebhookWorker) ────────────────────────
let worker: Worker | null = null;

export function startWebhookWorker(
  processFunction: (data: WebhookJobData) => Promise<void>
): Worker {
  if (worker) {
    webhookLogs.info("[WebhookQueue] Worker already running, skipping duplicate start");
    return worker;
  }

  worker = new Worker(
    "tatum-webhooks",
    async (job: Job<WebhookJobData>) => {
      webhookLogs.info(`[WebhookQueue] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);
      // Direct console.log backup — ensures Railway captures job lifecycle even during high-load
      log(`[WebhookQueue] 🔄 Job START: ${job.id}, attempt ${job.attemptsMade + 1}/${job.opts.attempts}, tx=${job.data?.payload?.txId || 'unknown'}`);
      
      try {
        await processFunction(job.data);
        webhookLogs.info(`[WebhookQueue] Job ${job.id} completed successfully`);
        log(`[WebhookQueue] ✅ Job DONE: ${job.id}, tx=${job.data?.payload?.txId || 'unknown'}`);
      } catch (error: unknown) {
        const err = error as Error;
        webhookLogs.error(`[WebhookQueue] Job ${job.id} failed: ${err.message}`);
        log(`[WebhookQueue] ❌ Job FAIL: ${job.id}, tx=${job.data?.payload?.txId || 'unknown'}, err=${err.message}`, "error");
        throw error; // BullMQ handles retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 webhooks in parallel
      lockDuration: 300000,      // 5 minutes — prevents stall on heavy cron bursts
      stalledInterval: 60000,    // Check stalled every 60s (default 30s is too aggressive)
      maxStalledCount: 3,        // Allow 3 stall recoveries before marking failed (default 1 = instant failure)
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second (avoid overwhelming Tatum API)
      },
    }
  );

  // ── Event Handlers ──────────────────────────────────────────────────────────
  worker.on("completed", (job: Job) => {
    webhookLogs.info(`[WebhookQueue] Job ${job.id} completed`);
  });

  worker.on("failed", async (job: Job | undefined, error: Error) => {
    if (!job) return;
    
    const attemptsLeft = (job.opts.attempts || 3) - job.attemptsMade;
    
    if (attemptsLeft <= 0) {
      // Max retries exhausted → move to DLQ
      webhookLogs.error(`[WebhookQueue] Job ${job.id} EXHAUSTED all retries. Moving to DLQ.`);
      
      try {
        const txId = job.data.payload?.txId || job.id;
        // One DLQ entry per tx: BullMQ ignores adds with an existing jobId, so
        // reconciliation re-queues of the same stuck payment don't pile up.
        await deadLetterQueue.add("failed-webhook", {
          ...job.data,
          failedAt: new Date().toISOString(),
          error: error.message,
          attempts: job.attemptsMade,
          originalJobId: job.id,
        }, { jobId: `dlq-${txId}` });
        
        captureError(error, "webhook", {
          severity: "high",
          requestContext: `DLQ: tx=${job.data.payload.txId}`,
          extraContext: `Job ${job.id} failed after ${job.attemptsMade} attempts`,
        });

        // One alert email per tx per 6h — the recovery sweep re-queues a stuck
        // payment every 10 min, which must not turn into an email every 10 min.
        const { acquireLock } = await import("../utils/redisInstance");
        const canAlert = await acquireLock(`dlq-alert-${txId}`, DLQ_ALERT_COOLDOWN_SEC, 1, 0);
        if (canAlert) {
          sendDLQAlert(job.data, job.id, job.attemptsMade, error.message).catch(() => {});
        } else {
          webhookLogs.warn(`[WebhookQueue] DLQ alert for tx ${txId} suppressed (cooldown active)`);
        }
      } catch (dlqError) {
        webhookLogs.error(`[WebhookQueue] Failed to add job to DLQ: ${(dlqError as Error).message}`);
      }
    } else {
      webhookLogs.warn(`[WebhookQueue] Job ${job.id} failed (${attemptsLeft} retries left): ${error.message}`);
    }
  });

  worker.on("error", (error: Error) => {
    webhookLogs.error(`[WebhookQueue] Worker error: ${error.message}`);
  });

  // ── Stalled / Close Detection ─────────────────────────────────────────────
  worker.on("stalled", (jobId: string) => {
    webhookLogs.warn(`[WebhookQueue] ⚠️ Job ${jobId} stalled (will be retried)`);
  });

  worker.on("closing", () => {
    webhookLogs.warn("[WebhookQueue] ⚠️ Worker is closing/disconnecting");
  });

  worker.on("closed", () => {
    webhookLogs.error("[WebhookQueue] ❌ Worker CLOSED — will attempt auto-restart");
    // Mark worker as null so health check can restart it
    worker = null;
  });

  // ── Periodic Health Monitor ────────────────────────────────────────────────
  // Check every 60 seconds that the worker is alive and processing
  const healthCheckInterval = setInterval(async () => {
    try {
      if (!worker || (worker as any).closing || !worker.isRunning()) {
        webhookLogs.error("[WebhookQueue] ❌ Worker health check FAILED — worker is dead/closing. Attempting restart...");
        // Clear the stale worker reference
        const oldWorker = worker;
        worker = null;
        if (oldWorker) {
          try { await oldWorker.close(); } catch (_) { /* ignore */ }
        }
        // Restart the worker
        startWebhookWorker(processFunction);
        webhookLogs.info("[WebhookQueue] ✅ Worker restarted by health monitor");
        return;
      }

      // Check queue for stuck jobs (waiting jobs but nothing active)
      const [waiting, active, delayed, failed] = await Promise.all([
        webhookQueue.getWaitingCount(),
        webhookQueue.getActiveCount(),
        webhookQueue.getDelayedCount(),
        webhookQueue.getFailedCount(),
      ]);

      // Alert on delayed or failed jobs that might be silently stuck
      if (delayed > 0) {
        webhookLogs.warn(`[WebhookQueue] ⚠️ Health check: ${delayed} delayed jobs (retrying with backoff)`);
      }
      if (failed > 0) {
        webhookLogs.warn(`[WebhookQueue] ⚠️ Health check: ${failed} failed jobs — cleaning up old failed jobs`);
        // Auto-clean failed jobs older than 1 hour (they've already been moved to DLQ by the "failed" handler)
        try {
          const failedJobs = await webhookQueue.getFailed(0, 50);
          let cleaned = 0;
          for (const fJob of failedJobs) {
            const jobAge = Date.now() - (fJob.finishedOn || fJob.timestamp || 0);
            if (jobAge > 3600_000) { // Older than 1 hour
              await fJob.remove();
              cleaned++;
            }
          }
          if (cleaned > 0) {
            webhookLogs.info(`[WebhookQueue] 🧹 Cleaned ${cleaned} old failed jobs from queue`);
          }
        } catch (cleanErr) {
          webhookLogs.warn(`[WebhookQueue] Failed to clean old jobs: ${(cleanErr as Error).message}`);
        }
      }

      if (waiting > 0 && active === 0) {
        webhookLogs.warn(`[WebhookQueue] ⚠️ Health check: ${waiting} waiting jobs, 0 active — possible worker stall`);
        // If this persists for 2 cycles, force restart
        if ((worker as any).__stallCount === undefined) (worker as any).__stallCount = 0;
        (worker as any).__stallCount++;
        if ((worker as any).__stallCount >= 2) {
          webhookLogs.error("[WebhookQueue] ❌ Worker appears stalled (2 consecutive checks with waiting jobs). Force restarting...");
          const oldWorker = worker;
          worker = null;
          if (oldWorker) {
            try { await oldWorker.close(); } catch (_) { /* ignore */ }
          }
          startWebhookWorker(processFunction);
          webhookLogs.info("[WebhookQueue] ✅ Worker force-restarted by health monitor");
          return;
        }
      } else {
        // Reset stall counter
        if (worker) (worker as any).__stallCount = 0;
      }

      webhookLogs.info(`[WebhookQueue] ✅ Health check OK — worker running, waiting=${waiting}, active=${active}, delayed=${delayed}, failed=${failed}`);
    } catch (err) {
      webhookLogs.error(`[WebhookQueue] Health check error: ${(err as Error).message}`);
    }
  }, 60_000); // Every 60 seconds

  // Clean up interval when worker closes
  worker.on("closed", () => {
    clearInterval(healthCheckInterval);
  });

  webhookLogs.info("[WebhookQueue] Worker started (concurrency: 5)");
  webhookLogs.info("[WebhookQueue] Health monitor started (60s interval)");
  return worker;
}

// ── Queue Health / Monitoring ─────────────────────────────────────────────────
export async function getQueueHealth(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  dlq: number;
  isPaused: boolean;
}> {
  const [waiting, active, completed, failed, delayed, dlqWaiting] = await Promise.all([
    webhookQueue.getWaitingCount(),
    webhookQueue.getActiveCount(),
    webhookQueue.getCompletedCount(),
    webhookQueue.getFailedCount(),
    webhookQueue.getDelayedCount(),
    deadLetterQueue.getWaitingCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    dlq: dlqWaiting,
    isPaused: await webhookQueue.isPaused(),
  };
}

// ── Get DLQ Items for Review ──────────────────────────────────────────────────
export async function getDLQItems(start = 0, end = 20): Promise<Job[]> {
  return deadLetterQueue.getJobs(["waiting", "failed"], start, end);
}

// ── Retry a DLQ Item ──────────────────────────────────────────────────────────
export async function retryDLQItem(jobId: string): Promise<boolean> {
  const jobs = await deadLetterQueue.getJobs(["waiting", "failed"]);
  const job = jobs.find((j) => j.id === jobId || j.data?.originalJobId === jobId);

  if (!job) {
    webhookLogs.error(`[WebhookQueue] DLQ job not found: ${jobId}`);
    return false;
  }

  // Re-enqueue to main queue
  await enqueueWebhook(job.data, { priority: 1 });
  await job.remove();
  
  webhookLogs.info(`[WebhookQueue] DLQ job ${jobId} re-queued for processing`);
  return true;
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
export async function shutdownWebhookQueue(): Promise<void> {
  webhookLogs.info("[WebhookQueue] Shutting down...");
  
  if (worker) {
    await worker.close();
    worker = null;
  }
  await webhookQueue.close();
  await deadLetterQueue.close();
  
  webhookLogs.info("[WebhookQueue] Shutdown complete");
}

// ── DLQ Email Alert ───────────────────────────────────────────────────────────

// Lazy-loaded mail transporter (avoids circular dependency at import time)
let _mailTransporter: ((opts: { to: string; name: string; subject: string; body: string }) => Promise<unknown>) | null = null;

const getMailTransporter = async () => {
  if (!_mailTransporter) {
    const mod = await import("../utils/mailTransporter");
    _mailTransporter = mod.default;
  }
  return _mailTransporter;
};

async function sendDLQAlert(jobData: WebhookJobData, jobId: string, attempts: number, errorMessage: string): Promise<void> {
  const adminEmail = envRaw("ADMIN_EMAIL");
  if (!adminEmail) return;

  const { payload, source } = jobData;
  const serverUrl = envRaw("SERVER_URL") || "unknown";
  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").substring(0, 19) + " UTC";

  const content = `${p(`A webhook job has <strong>exhausted all retries</strong> and been moved to the Dead Letter Queue (DLQ) for manual review.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Transaction ID', `<code style="font-size: 12px; word-break: break-all;">${payload.txId}</code>`, false)}
        ${dataRow('Address', `<code style="font-size: 12px; word-break: break-all;">${payload.address || 'N/A'}</code>`, false)}
        ${dataRow('Amount', `<strong>${payload.amount}</strong> ${payload.asset || 'unknown'}`)}
        ${dataRow('Source', source === 'reconciliation' ? 'Startup Reconciliation' : source === 'admin-replay' ? 'Admin Replay' : 'Live Webhook')}
        ${dataRow('Attempts', `${attempts} (all failed)`)}
        ${dataRow('Status', statusBadge('Dead Letter Queue', 'error'))}
        ${dataRow('Job ID', `<code style="font-size: 12px;">${jobId}</code>`, true)}
      </table>
    `, '#ef4444')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 14px 18px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626;">
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Error</p>
          <p style="margin: 0; font-size: 13px; color: #7f1d1d; font-family: monospace; word-break: break-word;">${errorMessage.substring(0, 500)}</p>
        </td>
      </tr>
    </table>
    ${p(`<strong>What to do:</strong>`)}
    ${p(`1. Review the error above to understand the failure<br/>2. Check the DLQ via: <code>GET /diagnostics/webhook-queue/dlq</code><br/>3. Retry with: <code>POST /diagnostics/webhook-queue/dlq/${jobId}/retry</code>`)}
    <p style="font-size: 12px; color: #9ca3af; margin: 16px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
      Timestamp: ${dateStr} | Server: ${serverUrl}
    </p>`;

  const subject = `DLQ Alert: Webhook failed for tx ${payload.txId.substring(0, 16)}... (${payload.asset || 'crypto'})`;
  const htmlBody = baseEmailTemplate("Webhook Moved to DLQ", content, { audience: "admin" });

  try {
    const transporter = await getMailTransporter();
    await transporter({ to: adminEmail, name: "Dynopay Admin", subject, body: htmlBody });
    webhookLogs.info(`[WebhookQueue] DLQ alert sent to ${adminEmail} for tx ${payload.txId}`);
  } catch (emailErr) {
    webhookLogs.error(`[WebhookQueue] Failed to send DLQ alert: ${(emailErr as Error).message}`);
  }
}
