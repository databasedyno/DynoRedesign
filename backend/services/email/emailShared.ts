import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { captureError } from "../errorMonitoringService";
import { baseEmailTemplate, getCurrencySymbol, p } from "../../utils/emailTemplate";

/** Dynamic base URL for all email CTA links — uses FRONTEND_URL env var */
export const FRONTEND_BASE_URL = (config.frontendUrl || 'https://dynopay.com').replace(/\/$/, '');

/**
 * Escape untrusted strings for embedding in HTML email bodies.
 */
export const escapeHtml = (s: string | null | undefined): string => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * Dynopay Unified Email Service — shared template helpers
 * Single source of truth for all email notifications
 * Provider: Brevo
 * Uses shared base template from utils/emailTemplate.ts
 */

// ============================================================
// SECTION 1: TEMPLATE HELPERS
// ============================================================

/**
 * Primary email template wrapper with optional button support.
 * Used by platform lifecycle emails (welcome, profile, KYC, etc.)
 */
export const dynoPayEmailTemplate = (
  heading: string,
  content: string,
  showButton: boolean = false,
  buttonText: string = "",
  buttonLink: string = ""
) => {
  return baseEmailTemplate(heading, content, { showButton, buttonText, buttonLink });
};

/**
 * Email template wrapper that includes a greeting.
 * Used by payment lifecycle emails (payment received, admin fees, conversions, etc.)
 * Also used by diagnosticsRouter for test email rendering.
 */
export const dynoPayGreetingTemplate = (
  name: string,
  message: string,
  heading: string,
  _showImage: boolean = false
) => {
  const greeting = p(`Hey ${name || 'there'},`);
  const bodyContent = `${greeting}<div style="font-size: 15px; color: #374151; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${message}</div>`;
  return baseEmailTemplate(heading, bodyContent);
};

export const formatAmountWithCurrency = (amount: number, currency: string = 'USD'): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)} ${currency}`;
};

// ============================================================
// SECTION 2: GENERIC EMAIL
// ============================================================

/**
 * Send a generic email with the Dynopay template
 */
export const sendEmail = async (
  recipientEmail: string,
  name: string,
  subject: string,
  message: string,
  showImage = false
) => {
  try {
    const htmlBody = dynoPayEmailTemplate(subject, `${p(`Hey ${name},`)}\n${message}`);
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendEmail (generic)' });
  }
};
