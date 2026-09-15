import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang, resolveEmailLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail } from "./emailShared";
import { lookupCountry } from "../../utils/clientContext";
import { isPlaceholderBuyerEmail } from "../../utils/transactionSource";

/**
 * Send notification to admin when a new user registers.
 * Informational only — user is active immediately.
 */
export const sendNewUserAdminNotification = async (userData: {
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  login_type: string;
  user_id?: number;
  company_name?: string | null;
  signup_ip?: string | null;
  country?: string | null;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping new user admin notification");
      return;
    }

    const displayName = userData.name || "N/A";
    const contactInfo = userData.email || userData.mobile || "N/A";
    const registrationMethod = userData.login_type || "Unknown";
    const userId = userData.user_id || "N/A";
    const companyName = userData.company_name || "Not yet provided";
    // Resolve the signup country so the admin can see name · country · method at
    // a glance. Prefer an explicit country; otherwise geo-locate the signup IP
    // (best-effort — this whole notification is already fire-and-forget, so the
    // ~1s lookup never slows down signup).
    let country = userData.country || null;
    if (!country && userData.signup_ip) {
      try {
        country = await lookupCountry(userData.signup_ip);
      } catch {
        country = null;
      }
    }
    const countryLabel = country || "Unknown";
    const registrationTime = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";

    const subject = `New Merchant Registration — ${displayName} · ${countryLabel} · ${registrationMethod}`;

    const content = `${p(`A new merchant has registered on Dynopay.`)}
    ${p(`<strong>${escapeHtml(displayName)}</strong> &nbsp;·&nbsp; ${escapeHtml(countryLabel)} &nbsp;·&nbsp; ${escapeHtml(registrationMethod)}`, `font-size: 16px; color: #111827; margin: 4px 0 16px;`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Name', displayName)}
        ${dataRow('Contact', contactInfo)}
        ${dataRow('Country', countryLabel)}
        ${dataRow('Signup Method', registrationMethod)}
        ${dataRow('User ID', String(userId))}
        ${dataRow('Company', companyName)}
        ${dataRow('Registered At', registrationTime)}
        ${dataRow('Promo', 'First payment free (platform fee waived on their first settled payment)', true)}
      </table>
    `, EMAIL_TOKENS.brand)}
    ${p(`The account is now <strong>active</strong>. The merchant can begin setting up their payment integration immediately.`)}
    ${p(`You can review this account in the admin dashboard.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("New Merchant Registration", content, { audience: "admin" });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] New user admin notification sent for ${contactInfo} (${registrationMethod}, ${countryLabel})`);
  } catch (e) {
    // Non-blocking — don't fail registration if email fails
    apiLogger.error("[Email] Admin new user notification error:", e);
  }
};

// ============================================================
// SECTION 12C: ADMIN — ONBOARDING STUCK NOTIFICATION
// ============================================================

/**
 * Send notification to admin when a user appears stuck during onboarding.
 */
export const sendOnboardingStuckAdminEmail = async (userData: {
  user_id: number;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  registered_at: string;
  hours_since_registration: number;
  stuck_step: string;
  completed_steps: string[];
  pending_steps: string[];
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) return;

    const displayName = userData.name || "N/A";
    const contact = userData.email || userData.mobile || "N/A";
    const hours = userData.hours_since_registration;
    const stuckLabel = userData.stuck_step;

    const urgency = hours >= 48 ? "🔴 Critical" : hours >= 24 ? "🟡 Warning" : "🟠 Attention";
    const subject = `${urgency} Onboarding Stuck — ${displayName} at "${stuckLabel}" (${hours}h)`;

    const completedList = userData.completed_steps.length > 0
      ? userData.completed_steps.map(s => `✅ ${s}`).join('<br/>')
      : '<em>None yet</em>';
    const pendingList = userData.pending_steps.map(s => `⬜ ${s}`).join('<br/>');

    const content = `${p(`A merchant appears <strong>stuck during onboarding</strong> and may need assistance.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Merchant', displayName)}
        ${dataRow('Contact', contact)}
        ${dataRow('User ID', String(userData.user_id))}
        ${dataRow('Registered', userData.registered_at)}
        ${dataRow('Time Since Registration', `${hours} hours`)}
        ${dataRow('Stuck At', `<strong>${stuckLabel}</strong>`, true)}
      </table>
    `, hours >= 48 ? '#ef4444' : hours >= 24 ? '#f59e0b' : '#f97316')}
    ${p(`<strong>Completed Steps:</strong><br/>${completedList}`)}
    ${p(`<strong>Pending Steps:</strong><br/>${pendingList}`)}
    ${p(`Consider reaching out to help this merchant complete their setup.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("Onboarding Stuck Alert", content, { audience: "admin" });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Onboarding stuck notification sent for user ${userData.user_id} (stuck at: ${stuckLabel}, ${hours}h)`);
  } catch (e) {
    apiLogger.error("[Email] Onboarding stuck notification error:", e);
  }
};

// ============================================================
// SECTION 12D: ADMIN — ONBOARDING COMPLETED NOTIFICATION
// ============================================================

/**
 * Send notification to admin when a user completes onboarding.
 */
export const sendOnboardingCompletedAdminEmail = async (userData: {
  user_id: number;
  name?: string | null;
  email?: string | null;
  company_name?: string | null;
  wallet_count: number;
  registered_at: string;
  hours_to_complete: number;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) return;

    const displayName = userData.name || "N/A";
    const contact = userData.email || "N/A";
    const hoursStr = userData.hours_to_complete < 1
      ? "< 1 hour"
      : `${Math.round(userData.hours_to_complete)} hours`;

    const subject = `Onboarded: ${displayName} (ready to accept payments)`;

    const content = `${p(`A merchant has <strong>completed onboarding</strong> and is now fully set up to accept payments.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Merchant', displayName)}
        ${dataRow('Email', contact)}
        ${dataRow('User ID', String(userData.user_id))}
        ${dataRow('Company', userData.company_name || 'N/A')}
        ${dataRow('Wallets Configured', String(userData.wallet_count))}
        ${dataRow('Registered', userData.registered_at)}
        ${dataRow('Time to Complete', hoursStr, true)}
      </table>
    `, '#12B76A')}
    ${p(`All onboarding steps completed: email verified, company created, wallet address configured.`)}
    ${p(`This merchant is now live and can receive their first payment.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("Onboarding Complete", content, { audience: "admin" });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Onboarding complete notification sent for user ${userData.user_id}`);
  } catch (e) {
    apiLogger.error("[Email] Onboarding complete notification error:", e);
  }
};

// ============================================================
// SECTION 12E: ADMIN — FIRST PAYMENT NOTIFICATION
// ============================================================

/**
 * Send notification to admin when a merchant receives their very first payment.
 */
export const sendFirstPaymentAdminEmail = async (data: {
  user_id: number;
  merchant_name?: string | null;
  merchant_email?: string | null;
  company_name?: string | null;
  company_id?: number | null;
  amount: string;
  currency: string;
  amount_usd?: string | null;
  payment_method: string;
  customer_email?: string | null;
  transaction_id: string;
  registered_at?: string | null;
  days_since_registration?: number | null;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) return;

    const merchantName = data.merchant_name || "N/A";
    const daysStr = data.days_since_registration != null
      ? `${data.days_since_registration} days after registration`
      : "N/A";

    const subject = `First payment: ${merchantName} · ${formatCryptoAmount(data.amount, data.currency)} ${data.currency}`;

    const content = `${p(`A merchant has received their <strong>very first payment</strong> on Dynopay! 🎉`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Merchant', merchantName)}
        ${dataRow('Email', data.merchant_email || 'N/A')}
        ${dataRow('Company', data.company_name || 'N/A')}
        ${dataRow('User ID', String(data.user_id))}
        ${dataRow('Amount', `<strong>${formatCryptoAmount(data.amount, data.currency)} ${data.currency}</strong>${data.amount_usd ? ` (~$${data.amount_usd} USD)` : ''}`)}
        ${dataRow('Payment Method', data.payment_method)}
        ${dataRow('Customer', isPlaceholderBuyerEmail(data.customer_email) ? 'No email provided' : escapeHtml(String(data.customer_email)))}
        ${dataRow('Transaction ID', data.transaction_id)}
        ${dataRow('Time to First Payment', daysStr, true)}
      </table>
    `, EMAIL_TOKENS.brand)}
    ${p(`This is a key milestone — the merchant is now actively processing payments.`)}
    ${p(`You can view the full transaction details in the admin dashboard.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("First Payment Milestone", content, { audience: "admin" });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] First payment notification sent for user ${data.user_id} — ${data.amount} ${data.currency}`);
  } catch (e) {
    apiLogger.error("[Email] First payment notification error:", e);
  }
};

// ============================================================
// SECTION 12F: ADMIN — NEW WEBSITE VISITOR NOTIFICATION
// ============================================================

export const sendBrandDeletedAdminEmail = async (info: {
  companyId: number | string;
  companyName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  deletedAtStr: string;
  purgeDateStr: string;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping brand-deleted admin notification");
      return;
    }
    const brand = escapeHtml(info.companyName || `Brand #${info.companyId}`);
    const owner = escapeHtml(info.ownerName || "Unknown");
    const ownerEmail = escapeHtml(info.ownerEmail || "—");
    const subject = `Brand deleted — "${info.companyName}" — restore by ${info.purgeDateStr}`;

    const content = `${p(`A merchant just deleted a brand. It's <strong>soft-deleted</strong> and will be permanently purged on <strong>${escapeHtml(info.purgeDateStr)}</strong> unless it's restored first.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Brand', `<strong>${brand}</strong>`)}
        ${dataRow('Brand ID', `#${escapeHtml(String(info.companyId))}`)}
        ${dataRow('Owner', owner)}
        ${dataRow('Owner email', ownerEmail)}
        ${dataRow('Deleted at', escapeHtml(info.deletedAtStr))}
        ${dataRow('Auto-purge on', `<strong>${escapeHtml(info.purgeDateStr)}</strong>`, true)}
      </table>
    `, '#f59e0b')}
    ${p(`To bring it back, open <strong>Admin → Merchants → Deleted brands</strong> and hit Restore — one click reinstates the brand and all of its data.`)}`;

    const html = dynoPayEmailTemplate("Brand deleted", `${p(`Hey Dynopay Admin,`)}\n${content}`, true, "Open admin panel", `${FRONTEND_BASE_URL}/admin/merchants`, `${brand} was deleted — restorable until ${escapeHtml(info.purgeDateStr)}.`, undefined, 'trash', 'admin');
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Brand-deleted admin notification sent for ${info.companyName} (#${info.companyId})`);
  } catch (e) {
    apiLogger.error("[Email] Brand-deleted admin notification error:", e);
  }
};

// ============================================================
// SECTION 12E: ADMIN — ACCOUNT DELETED (7-day restore window)
// ============================================================

/**
 * Notify ops when a merchant soft-deletes their WHOLE account. Retained for
 * 7 days and restorable from Admin -> Merchants -> Deleted accounts.
 */
export const sendAccountDeletedAdminEmail = async (info: {
  userId: number | string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  deletedAtStr: string;
  purgeDateStr: string;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping account-deleted admin notification");
      return;
    }
    const owner = escapeHtml(info.ownerName || "Unknown");
    const ownerEmail = escapeHtml(info.ownerEmail || "—");
    const subject = `Account deleted — ${info.ownerEmail || `user #${info.userId}`} — restore by ${info.purgeDateStr}`;

    const content = `${p(`A merchant just deleted their entire account. It's <strong>soft-deleted</strong> and will be permanently purged on <strong>${escapeHtml(info.purgeDateStr)}</strong> unless it's restored first. They have been signed out of all devices and cannot log in until restored.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Account', owner)}
        ${dataRow('Email', ownerEmail)}
        ${dataRow('User ID', `#${escapeHtml(String(info.userId))}`)}
        ${dataRow('Deleted at', escapeHtml(info.deletedAtStr))}
        ${dataRow('Auto-purge on', `<strong>${escapeHtml(info.purgeDateStr)}</strong>`, true)}
      </table>
    `, '#f59e0b')}
    ${p(`To bring it back, open <strong>Admin → Merchants → Deleted accounts</strong> and hit Restore — one click reinstates the account and all of its brands and data.`)}`;

    const html = dynoPayEmailTemplate("Account deleted", `${p(`Hey Dynopay Admin,`)}\n${content}`, true, "Open admin panel", `${FRONTEND_BASE_URL}/admin/merchants`, `${ownerEmail} deleted their account — restorable until ${escapeHtml(info.purgeDateStr)}.`, undefined, 'person-off', 'admin');
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Account-deleted admin notification sent for user #${info.userId}`);
  } catch (e) {
    apiLogger.error("[Email] Account-deleted admin notification error:", e);
  }
};



// ============================================================
// SECTION 13: DEFAULT EXPORT
// ============================================================
// SECTION 13: PRODUCT CATALOG EMAILS (Phase 1)
// ============================================================

