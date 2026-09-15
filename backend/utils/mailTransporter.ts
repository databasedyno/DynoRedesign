import { raw as envRaw } from "./config";
import axios from "axios";
import { captureError } from "../services/errorMonitoringService";
import { log } from "../utils/loggers";
import { TO_EMAIL_TOKEN } from "./emailTemplate";

interface Attachment {
  name: string;
  content: string; // Base64 encoded content
  contentType?: string;
}

interface mailOptions {
  to: string;
  name: string;
  subject: string;
  body?: string;
  attachments?: Attachment[];
}

/**
 * Strip HTML tags for plain text fallback
 */
const stripHtml = (html: string): string => {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Basic email validation (catches obvious bad inputs before hitting Brevo)
 */
const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Send email using Brevo (formerly Sendinblue) API
 */
/** Preview-only: when EMAIL_DUMP_DIR is set, suppressed emails are written as HTML for review. */
const dumpForReview = (to: string, subject: string, body: string) => {
  const dir = envRaw("EMAIL_DUMP_DIR");
  if (!dir) return;
  try {
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    fs.mkdirSync(dir, { recursive: true });
    const slug = String(subject).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    const file = path.join(dir, `${Date.now()}_${slug}.html`);
    fs.writeFileSync(file, `<!-- to: ${to} | subject: ${subject} -->\n${body}`);
  } catch (e) {
    log(`[Email] dump failed: ${(e as Error).message}`);
  }
};

const mailTransporter = async ({ to, subject, body: rawBody, name, attachments }: mailOptions) => {
  // Footer "you're receiving this because … (email)" — resolved here so every
  // template gets the real recipient without threading it through 110 senders.
  const body = String(rawBody || "").split(TO_EMAIL_TOKEN).join(
    String(to || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  );
  // --- PREVIEW/SANDBOX SAFETY: never send real email from a non-prod pod ---
  // When DISABLE_OUTBOUND_EMAIL=true (the Emergent preview is wired to the LIVE
  // production DB), skip the Brevo API entirely so no real merchant / customer /
  // admin email is ever sent from this environment. Production never sets this flag.
  //
  // EXCEPTION — EMAIL_TEST_ALLOWLIST: a comma-separated list of addresses that
  // are STILL allowed to receive mail while suppression is on. Used to verify the
  // real "payment confirmed" receipt end-to-end against a single throwaway inbox
  // without opening the floodgates to real merchants/customers. Leave empty in
  // normal preview operation.
  if (envRaw("DISABLE_OUTBOUND_EMAIL") === "true") {
    const allowlist = String(envRaw("EMAIL_TEST_ALLOWLIST") || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const recipient = String(to || "").trim().toLowerCase();
    if (!allowlist.includes(recipient)) {
      log(`[Email] SUPPRESSED (DISABLE_OUTBOUND_EMAIL) -> to=${to} | subject=${subject}`);
      dumpForReview(to, subject, body);
      return { suppressed: true } as unknown;
    }
    log(`[Email] TEST-ALLOWLISTED (DISABLE_OUTBOUND_EMAIL bypassed) -> to=${to} | subject=${subject}`);
  }

  // --- Input validation (prevent Brevo 400s from bad data) ---
  if (!to || !isValidEmail(to)) {
    const err = new Error(`Invalid recipient email: "${to}"`);
    captureError(err, 'email', { extraContext: `mailTransporter validation | subject=${subject}` });
    throw err;
  }
  if (!subject || subject.trim().length === 0) {
    const err = new Error(`Empty subject for email to ${to}`);
    captureError(err, 'email', { extraContext: 'mailTransporter validation' });
    throw err;
  }
  if (!body || body.trim().length === 0) {
    const err = new Error(`Empty body for email to ${to} | subject=${subject}`);
    captureError(err, 'email', { extraContext: 'mailTransporter validation' });
    throw err;
  }

  // Sanitize name: Brevo rejects empty string names
  const safeName = (name && name.trim().length > 0) ? name.trim() : to;

  const payload: Record<string, unknown> = {
    sender: {
      name: "Dynopay",
      email: envRaw("BREVO_SENDER_EMAIL") || "hi@dynopay.com",
    },
    subject: subject.trim(),
    to: [
      {
        email: to.trim(),
        name: safeName,
      },
    ],
    htmlContent: body,
    textContent: stripHtml(body).substring(0, 50000), // Brevo textContent cap: prevent oversized payloads
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    payload.attachment = attachments.map(att => ({
      name: att.name,
      content: att.content,
      contentType: att.contentType || 'application/pdf',
    }));
  }

  // Retry Brevo with short exponential backoff to absorb transient 5xx / network
  // blips. Most Brevo "invalid_request 500" events we've seen recover within
  // <1s, so 3 attempts at 300ms/900ms/2700ms is enough without noticeable delay.
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [300, 900, 2700];
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data } = await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        payload,
        {
          headers: {
            "api-key": envRaw("BREVO_API_KEY"),
          },
          timeout: 15000,
        }
      );
      if (attempt > 1) {
        log(`[Email] Sent to ${to} (attempt ${attempt}/${MAX_ATTEMPTS}): ${subject}`);
      } else {
        log(`[Email] Sent to ${to}: ${subject}${attachments ? ` (with ${attachments.length} attachment(s))` : ''}`);
      }
      return data;
    } catch (apiError: any) {
      lastError = apiError;
      const status = apiError?.response?.status;
      // Only retry on 5xx / network errors. 4xx (bad payload) is permanent.
      const isRetryable =
        !status ||                    // network error (ECONNRESET, timeout, etc.)
        status >= 500 ||
        apiError?.code === 'ECONNABORTED' ||
        apiError?.code === 'ETIMEDOUT' ||
        apiError?.code === 'ECONNRESET';

      if (!isRetryable || attempt === MAX_ATTEMPTS) {
        // Final failure — capture and rethrow
        captureError(apiError, 'email', {
          extraContext: `Brevo API call | to=${to} | subject=${subject.substring(0, 60)} | payloadSize=${JSON.stringify(payload).length} | attempts=${attempt}/${MAX_ATTEMPTS}`,
        });
        throw apiError;
      }

      // Retryable — wait and try again (don't spam captureError for transient 5xx)
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }
  }

  // Unreachable, but keeps TS happy
  throw lastError;
};

export default mailTransporter;
export type { mailOptions, Attachment };
