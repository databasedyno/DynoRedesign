/**
 * Durable outbound-email queue (BullMQ on the shared Redis).
 *
 *   mailTransporter → enqueueEmail() → "emails" queue → worker → Brevo API
 *
 * - Request handlers return as soon as the job is persisted (no Brevo wait).
 * - Retries: 429 (honours Retry-After), 5xx and network errors are retried with
 *   exponential backoff; other 4xx are permanent (bad payload) → failed at once.
 * - Lanes: "otp" = priority + 10-min TTL (a stale sign-in code must never land
 *   late); "default" = everything else, up to 7 attempts (~45 min window).
 * - Exhausted jobs land in "emails-dlq" and raise an admin alert (1h cooldown).
 * - Addresses that hard-bounced (Brevo webhook) are skipped for non-OTP mail.
 *
 * The worker only runs where outbound email is enabled (never on a preview pod
 * wired to the live Redis — see server.ts); mailTransporter also never enqueues
 * there, so no preview-generated mail can reach a production worker.
 */
import axios, { AxiosError } from "axios";
import { DelayedError, Job, Queue, UnrecoverableError, Worker } from "bullmq";
import { raw as envRaw } from "../../utils/config";
import { bullmqConnection } from "../../utils/redisConnection";
import { log } from "../../utils/loggers";
import { acquireLock, getRedisItem } from "../../utils/redisInstance";
import { captureError } from "../errorMonitoringService";
import { sendAlertSafe } from "../slackAlertService";
import { markEmailLog, purgeOldEmailLogs } from "./emailLog";

export type EmailLane = "otp" | "default";

export interface EmailAttachment {
  name: string;
  content: string;
  contentType?: string;
}

export interface EmailJobData {
  to: string;
  name: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  sender: { name: string; email: string };
  lane: EmailLane;
  template?: string | null;
  logId: number | null;
  /** Epoch ms after which the email is pointless (OTP lane). */
  expiresAt?: number;
}

export const QUEUE_NAME = "emails";
const DLQ_NAME = "emails-dlq";
const JOB_NAME = "send";
export const OTP_TTL_MS = 10 * 60 * 1000;
const DLQ_ALERT_COOLDOWN_SEC = 60 * 60;
export const SUPPRESSED_KEY = (email: string) => `email:suppressed:${email.trim().toLowerCase()}`;

const LANE_OPTS: Record<EmailLane, { priority: number; attempts: number; delay: number }> = {
  otp: { priority: 1, attempts: 4, delay: 15_000 },
  default: { priority: 10, attempts: 7, delay: 45_000 },
};

let queue: Queue<EmailJobData> | null = null;
let dlq: Queue<EmailJobData> | null = null;
let worker: Worker<EmailJobData> | null = null;
let retentionTimer: NodeJS.Timeout | null = null;

export const getEmailQueue = (): Queue<EmailJobData> => {
  if (!queue) {
    queue = new Queue<EmailJobData>(QUEUE_NAME, {
      connection: bullmqConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 7 * 86400, count: 5000 },
        removeOnFail: { age: 30 * 86400 },
      },
    });
  }
  return queue;
};

const getDlq = (): Queue<EmailJobData> => {
  if (!dlq) dlq = new Queue<EmailJobData>(DLQ_NAME, { connection: bullmqConnection(), defaultJobOptions: { removeOnComplete: false, removeOnFail: false } });
  return dlq;
};

export const enqueueEmail = async (data: EmailJobData): Promise<string> => {
  const lane = LANE_OPTS[data.lane] ?? LANE_OPTS.default;
  const job = await getEmailQueue().add(JOB_NAME, data, {
    priority: lane.priority,
    attempts: lane.attempts,
    backoff: { type: "exponential", delay: lane.delay },
  });
  return String(job.id);
};

// ── Brevo ─────────────────────────────────────────────────────────────────────

export class BrevoSendError extends Error {
  status: number | undefined;
  retryAfterMs: number | undefined;
  code: string | undefined;
  constructor(err: AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data as { message?: string; code?: string } | undefined;
    super(data?.message ? `Brevo ${status}: ${data.message}` : err.message);
    this.name = "BrevoSendError";
    this.status = status;
    this.code = data?.code || err.code;
    const ra = Number(err.response?.headers?.["retry-after"]);
    this.retryAfterMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 15 * 60 * 1000) : undefined;
  }
  /** 429 / 5xx / network — worth another attempt. Other 4xx = bad payload, permanent. */
  get retryable(): boolean {
    return !this.status || this.status === 429 || this.status >= 500;
  }
}

export const brevoPayload = (d: EmailJobData): Record<string, unknown> => {
  const text = d.body
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const payload: Record<string, unknown> = {
    sender: d.sender,
    subject: d.subject,
    to: [{ email: d.to, name: d.name }],
    htmlContent: d.body,
    textContent: text.substring(0, 50000),
  };
  if (d.attachments?.length) {
    payload.attachment = d.attachments.map((a) => ({ name: a.name, content: a.content, contentType: a.contentType || "application/pdf" }));
  }
  return payload;
};

/** ONE Brevo API call. Throws BrevoSendError; never retries by itself. */
export const sendViaBrevo = async (d: EmailJobData): Promise<{ messageId: string | null }> => {
  try {
    const { data } = await axios.post("https://api.brevo.com/v3/smtp/email", brevoPayload(d), {
      headers: { "api-key": envRaw("BREVO_API_KEY") },
      timeout: 15000,
    });
    return { messageId: (data as { messageId?: string })?.messageId ?? null };
  } catch (e) {
    throw new BrevoSendError(e as AxiosError);
  }
};

export const isSuppressed = async (email: string): Promise<boolean> => {
  try {
    const v = await getRedisItem(SUPPRESSED_KEY(email));
    return !!v && Object.keys(v as object).length > 0;
  } catch {
    return false;
  }
};

// ── Worker ────────────────────────────────────────────────────────────────────

export const processEmailJob = async (job: Job<EmailJobData>, token?: string): Promise<{ messageId?: string | null; skipped?: string }> => {
  const d = job.data;
  const attempt = job.attemptsMade + 1;

  if (d.expiresAt && Date.now() > d.expiresAt) {
    await markEmailLog(d.logId, { status: "expired", attempts: attempt, last_error: "Code expired before delivery" });
    log(`[EmailQueue] job ${job.id} expired before delivery (to=${d.to})`, "warn");
    return { skipped: "expired" };
  }
  if (d.lane !== "otp" && (await isSuppressed(d.to))) {
    await markEmailLog(d.logId, { status: "suppressed", attempts: attempt, last_error: "Recipient address previously bounced" });
    log(`[EmailQueue] job ${job.id} suppressed — ${d.to} bounced earlier`, "warn");
    return { skipped: "suppressed" };
  }

  try {
    const { messageId } = await sendViaBrevo(d);
    await markEmailLog(d.logId, { status: "sent", attempts: attempt, brevo_message_id: messageId, sent_at: new Date(), last_error: null });
    log(`[Email] Sent to ${d.to}${attempt > 1 ? ` (attempt ${attempt})` : ""}: ${d.subject}`);
    return { messageId };
  } catch (e) {
    const err = e as BrevoSendError;
    if (err.retryable) {
      await markEmailLog(d.logId, { attempts: attempt, last_error: err.message });
      if (err.status === 429 && err.retryAfterMs && token) {
        await job.moveToDelayed(Date.now() + err.retryAfterMs, token);
        throw new DelayedError();
      }
      throw err;
    }
    await markEmailLog(d.logId, { status: "failed", attempts: attempt, last_error: err.message });
    throw new UnrecoverableError(err.message);
  }
};

const onFinalFailure = async (job: Job<EmailJobData> | undefined, err: Error) => {
  if (!job) return;
  const exhausted = err instanceof UnrecoverableError || err.name === "UnrecoverableError" || job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!exhausted) return;
  const d = job.data;
  await markEmailLog(d.logId, { status: "failed", last_error: err.message });
  log(`[EmailQueue] job ${job.id} FAILED permanently (to=${d.to}, subject=${d.subject}): ${err.message}`, "error");
  captureError(err, "email", { extraContext: `EmailQueue DLQ | to=${d.to} | subject=${d.subject.slice(0, 60)} | attempts=${job.attemptsMade}` });
  try {
    await getDlq().add("dead", { ...d, body: d.body, attachments: d.attachments }, { jobId: `dlq-${job.id}` });
  } catch (dlqErr) {
    log(`[EmailQueue] DLQ add failed: ${(dlqErr as Error).message}`, "error");
  }
  try {
    if (await acquireLock("email-dlq-alert", DLQ_ALERT_COOLDOWN_SEC, 1, 0)) {
      await sendAlertSafe({
        severity: "critical",
        title: "Email delivery failing",
        message: `An email to ${d.to} could not be delivered after ${job.attemptsMade} attempt(s) and was parked in the emails DLQ. Check Admin › Email log.`,
        fields: { subject: d.subject.slice(0, 80), error: err.message.slice(0, 200) },
      });
    }
  } catch {
    /* alerting is best-effort */
  }
};

export const startEmailWorker = (): void => {
  if (worker) return;
  worker = new Worker<EmailJobData>(QUEUE_NAME, (job, token) => processEmailJob(job, token), {
    connection: bullmqConnection(),
    concurrency: Number(envRaw("EMAIL_WORKER_CONCURRENCY")) || 4,
    limiter: { max: Number(envRaw("EMAIL_RATE_PER_SEC")) || 10, duration: 1000 },
  });
  worker.on("failed", (job, err) => {
    onFinalFailure(job, err).catch((e) => log(`[EmailQueue] failed-handler error: ${(e as Error).message}`, "error"));
  });
  worker.on("error", (err) => log(`[EmailQueue] worker error: ${err.message}`, "error"));

  retentionTimer = setInterval(() => {
    acquireLock("email-log-retention", 20 * 3600, 1, 0)
      .then((ok) => (ok ? purgeOldEmailLogs() : 0))
      .then((n) => n && log(`[EmailLog] purged ${n} rows older than 90 days`, "info"))
      .catch(() => {});
  }, 6 * 3600 * 1000);
  retentionTimer.unref();
};

export const getEmailQueueHealth = async () => {
  const q = getEmailQueue();
  const [waiting, active, delayed, failed, completed, dead] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getDelayedCount(),
    q.getFailedCount(),
    q.getCompletedCount(),
    getDlq().getWaitingCount(),
  ]);
  return { waiting, active, delayed, failed, completed, dlq: dead, worker_running: !!worker };
};

export const listDlq = async (limit = 50) => {
  const jobs = await getDlq().getJobs(["waiting", "delayed", "paused"], 0, limit - 1);
  return jobs.map((j) => ({
    job_id: String(j.id),
    to: j.data.to,
    subject: j.data.subject,
    lane: j.data.lane,
    log_id: j.data.logId,
    parked_at: j.timestamp ? new Date(j.timestamp).toISOString() : null,
  }));
};

/** Admin: push a parked email back onto the live queue (fresh attempt budget). */
export const retryDlq = async (jobId: string): Promise<boolean> => {
  const job = await getDlq().getJob(jobId);
  if (!job) return false;
  const data = { ...job.data, expiresAt: undefined };
  await enqueueEmail(data);
  await markEmailLog(data.logId, { status: "queued", last_error: null });
  await job.remove();
  return true;
};

export const shutdownEmailQueue = async (): Promise<void> => {
  if (retentionTimer) clearInterval(retentionTimer);
  await Promise.allSettled([worker?.close(), queue?.close(), dlq?.close()]);
  worker = null;
};
