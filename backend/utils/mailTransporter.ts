import { raw as envRaw } from "./config";
import { captureError } from "../services/errorMonitoringService";
import { log } from "../utils/loggers";
import { TO_EMAIL_TOKEN } from "./emailTemplate";
import { createEmailLog, markEmailLog } from "../services/email/emailLog";
import { getDispatchContext } from "../services/email/dispatchContext";
import {
  BrevoSendError,
  EmailAttachment,
  EmailJobData,
  EmailLane,
  OTP_TTL_MS,
  enqueueEmail,
  sendViaBrevo,
} from "../services/email/emailQueue";

type Attachment = EmailAttachment;

interface mailOptions {
  to: string;
  name: string;
  subject: string;
  body?: string;
  attachments?: Attachment[];
  /** Per-brand "from" identity. Falls back to Dynopay when omitted. */
  sender?: { name?: string; email?: string };
  /** Optional Reply-To. If omitted, SafeDeal mail defaults to its support inbox. */
  replyTo?: { name?: string; email: string };
  /** "otp" = sign-in / step-up codes: priority lane, never delivered after 10 min. */
  lane?: EmailLane;
  /** Short template id for the send log (defaults to the subject). */
  template?: string;
}

export interface MailResult {
  queued?: boolean;
  suppressed?: boolean;
  sent?: boolean;
  jobId?: string;
  logId?: number | null;
  messageId?: string | null;
}

const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/** Preview-only: when EMAIL_DUMP_DIR is set, suppressed emails are written as HTML for review. */
const dumpForReview = (to: string, subject: string, body: string, from?: string) => {
  const dir = envRaw("EMAIL_DUMP_DIR");
  if (!dir) return;
  try {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    fs.mkdirSync(dir, { recursive: true });
    const slug = String(subject).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const file = path.join(dir, `${Date.now()}_${slug}.html`);
    fs.writeFileSync(file, `<!-- from: ${from || "hi@dynopay.com"} | to: ${to} | subject: ${subject} -->\n${body}`);
  } catch (e) {
    log(`[Email] dump failed: ${(e as Error).message}`);
  }
};

/** Last resort when Redis/the queue is unavailable: 3 quick inline attempts (300/900/2700 ms). */
const sendInline = async (job: EmailJobData): Promise<MailResult> => {
  const BACKOFF_MS = [300, 900, 2700];
  let lastError: BrevoSendError | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { messageId } = await sendViaBrevo(job);
      await markEmailLog(job.logId, { status: "sent", attempts: attempt, brevo_message_id: messageId, sent_at: new Date(), job_id: "inline" });
      log(`[Email] Sent inline to ${job.to}${attempt > 1 ? ` (attempt ${attempt}/3)` : ""}: ${job.subject}`);
      return { sent: true, messageId, logId: job.logId };
    } catch (e) {
      lastError = e as BrevoSendError;
      if (!lastError.retryable || attempt === 3) break;
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }
  }
  await markEmailLog(job.logId, { status: "failed", last_error: lastError?.message, job_id: "inline" });
  captureError(lastError, "email", { extraContext: `Brevo inline send | to=${job.to} | subject=${job.subject.substring(0, 60)}` });
  throw lastError;
};

/**
 * Send an email via Brevo. Resolves as soon as the job is durably queued
 * (production) — delivery, retries and bounce handling happen in the
 * emails worker (services/email/emailQueue.ts). Resolves {suppressed:true}
 * on preview pods (DISABLE_OUTBOUND_EMAIL). Throws only on invalid input or
 * when both the queue and the inline fallback are unavailable.
 */
const mailTransporter = async ({ to, subject, body: rawBody, name, attachments, sender, replyTo, lane = "default", template }: mailOptions): Promise<MailResult> => {
  // Per-brand sender: SafeDeal escrow mail sends from hi@safedeal.sh; Dynopay mail
  // stays on hi@dynopay.com. Resolved up-front so the preview log/dump shows it too.
  const senderName = sender?.name || "Dynopay";
  const senderEmail = sender?.email || envRaw("BREVO_SENDER_EMAIL") || "hi@dynopay.com";
  // Reply-To: an explicit value wins; otherwise SafeDeal mail gets a reachable
  // support inbox (so recipients don't reply into the hi@ no-reply box). Dynopay
  // mail keeps no Reply-To (replies to the sender, unchanged behaviour).
  const safedealSenderEmail = (envRaw("SAFEDEAL_SENDER_EMAIL") || "hi@safedeal.sh").trim().toLowerCase();
  const isSafeDealSender = senderEmail.trim().toLowerCase() === safedealSenderEmail;
  const resolvedReplyTo: { name?: string; email: string } | undefined =
    replyTo ||
    (isSafeDealSender
      ? { name: "SafeDeal Support", email: (envRaw("SAFEDEAL_REPLY_TO") || "support@safedeal.sh").trim() }
      : undefined);
  // Footer "you're receiving this because … (email)" — resolved here so every
  // template gets the real recipient without threading it through 110 senders.
  const body = String(rawBody || "").split(TO_EMAIL_TOKEN).join(
    String(to || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  );

  // --- PREVIEW/SANDBOX SAFETY: never send real email from a non-prod pod ---
  // When DISABLE_OUTBOUND_EMAIL=true (the Emergent preview is wired to the LIVE
  // production DB + Redis) nothing is enqueued and Brevo is never called.
  // EXCEPTION — EMAIL_TEST_ALLOWLIST: comma-separated addresses still allowed
  // through (inline send) to verify a template end-to-end against one inbox.
  if (envRaw("DISABLE_OUTBOUND_EMAIL") === "true") {
    const allowlist = String(envRaw("EMAIL_TEST_ALLOWLIST") || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const recipient = String(to || "").trim().toLowerCase();
    if (!allowlist.includes(recipient)) {
      log(`[Email] SUPPRESSED (DISABLE_OUTBOUND_EMAIL) -> from=${senderEmail} to=${to} | lane=${lane} | subject=${subject}${attachments?.length ? ` | attachments=${attachments.length}` : ""}`);
      dumpForReview(to, subject, body, senderEmail);
      return { suppressed: true };
    }
    log(`[Email] TEST-ALLOWLISTED (DISABLE_OUTBOUND_EMAIL bypassed) -> to=${to} | subject=${subject}`);
  }

  // --- Input validation (prevent Brevo 400s from bad data) ---
  if (!to || !isValidEmail(to)) {
    const err = new Error(`Invalid recipient email: "${to}"`);
    captureError(err, "email", { extraContext: `mailTransporter validation | subject=${subject}` });
    throw err;
  }
  if (!subject || subject.trim().length === 0) {
    const err = new Error(`Empty subject for email to ${to}`);
    captureError(err, "email", { extraContext: "mailTransporter validation" });
    throw err;
  }
  if (!body || body.trim().length === 0) {
    const err = new Error(`Empty body for email to ${to} | subject=${subject}`);
    captureError(err, "email", { extraContext: "mailTransporter validation" });
    throw err;
  }

  // Company dispatch context: owner address that gets this exact email again
  // if `to` bounces (see services/email/companyDispatch + fallbackReroute).
  const ctx = getDispatchContext();
  const fallbackTo = ctx?.fallbackTo && ctx.fallbackTo.trim().toLowerCase() !== to.trim().toLowerCase() ? ctx.fallbackTo.trim() : null;

  const job: EmailJobData = {
    to: to.trim(),
    name: name && name.trim().length > 0 ? name.trim() : to.trim(),
    subject: subject.trim(),
    body,
    attachments,
    sender: { name: senderName, email: senderEmail },
    replyTo: resolvedReplyTo || null,
    lane,
    template: template || null,
    companyId: ctx?.companyId ?? null,
    fallbackTo,
    fallbackName: fallbackTo ? ctx?.fallbackName || null : null,
    logId: await createEmailLog({ to, name, subject: subject.trim(), template, lane, senderEmail, companyId: ctx?.companyId ?? null, fallbackTo }),
    expiresAt: lane === "otp" ? Date.now() + OTP_TTL_MS : undefined,
  };

  if (envRaw("DISABLE_OUTBOUND_EMAIL") === "true" || envRaw("EMAIL_QUEUE_DISABLED") === "true") {
    return sendInline(job);
  }

  try {
    const jobId = await enqueueEmail(job);
    await markEmailLog(job.logId, { job_id: jobId });
    log(`[Email] Queued for ${to} (job ${jobId}, lane=${lane}): ${subject}${attachments?.length ? ` (${attachments.length} attachment(s))` : ""}`);
    return { queued: true, jobId, logId: job.logId };
  } catch (queueErr) {
    // Redis down → do not lose the email: send inline right now.
    log(`[Email] queue unavailable (${(queueErr as Error).message}) — sending inline to ${to}`, "warn");
    captureError(queueErr, "email", { extraContext: "mailTransporter enqueue failed — inline fallback" });
    return sendInline(job);
  }
};

export default mailTransporter;
export type { mailOptions, Attachment, EmailLane };
