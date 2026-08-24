import { raw as envRaw } from "./config";
import axios from "axios";
import { captureError } from "../services/errorMonitoringService";
import { log } from "../utils/loggers";

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
const mailTransporter = async ({ to, subject, body, name, attachments }: mailOptions) => {
  // --- PREVIEW/SANDBOX SAFETY: never send real email from a non-prod pod ---
  // When DISABLE_OUTBOUND_EMAIL=true (the Emergent preview is wired to the LIVE
  // production DB), skip the Brevo API entirely so no real merchant / customer /
  // admin email is ever sent from this environment. Production never sets this flag.
  if (envRaw("DISABLE_OUTBOUND_EMAIL") === "true") {
    log(`[Email] SUPPRESSED (DISABLE_OUTBOUND_EMAIL) -> to=${to} | subject=${subject}`);
    return { suppressed: true } as unknown;
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
