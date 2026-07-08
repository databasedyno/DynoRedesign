import mailTransporter from "../utils/mailTransporter";
import { apiLogger } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "./pdfReceiptService";
import { t, normalizeLang, resolveEmailLang } from "../utils/emailI18n";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../utils/emailTemplate";

/** Dynamic base URL for all email CTA links — uses FRONTEND_URL env var */
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'https://dynopay.com').replace(/\/$/, '');

/**
 * DynoPay Unified Email Service
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
 * Send a generic email with the DynoPay template
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

// ============================================================
// SECTION 3: USER & AUTH EMAILS
// ============================================================

/**
 * Template 1: Welcome Email
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.welcome.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.welcome.intro1', L))}
    ${p(t('merchant.welcome.intro2', L))}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;"><strong>${t('merchant.welcome.nextTitle', L)}</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.welcome.next1', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.welcome.next2', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.welcome.next3', L)}</td></tr>
      </table>
    `)}
    ${p(t('merchant.welcome.questions', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.welcome.heading', L), content, true, t('merchant.welcome.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Welcome email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Welcome email error:", e);
  }
};

/**
 * Volume-Tier Upgrade
 * Fired by volumeTierReconciliation when a merchant's tier improves (lower %).
 * Silent on downgrades — no email sent for tier drops.
 */
export const sendVolumeTierUpgradeEmail = async (
  email: string,
  opts: {
    name: string;
    previousTier: string;
    previousPercent: number;
    newTier: string;
    newPercent: number;
    totalVolumeUsd: number;
    language?: string;
  }
) => {
  try {
    const {
      name, previousTier, previousPercent,
      newTier, newPercent, totalVolumeUsd, language,
    } = opts;
    const savingsPct = Math.max(0, previousPercent - newPercent).toFixed(2);
    const volumeStr = `$${totalVolumeUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const subject = `You just unlocked the ${newTier} tier — ${newPercent}% fees`;

    const content = `${p(`Hey ${name},`)}
    ${p(`Great news — you've crossed <strong>${volumeStr}</strong> in lifetime processed volume, and your platform-fee tier has just been upgraded from <strong>${previousTier}</strong> to <strong>${newTier}</strong>.`)}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;"><strong>Your new rate</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Previous fee</td>
          <td style="padding: 4px 0; font-size: 14px; color: #6b7280; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;"><s>${previousPercent}%</s></td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 15px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">New fee (${newTier})</td>
          <td style="padding: 4px 0; font-size: 20px; font-weight: 700; color: #0a0a0a; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${newPercent}%</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #16a34a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">You save</td>
          <td style="padding: 4px 0; font-size: 13px; color: #16a34a; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${savingsPct}% per transaction</td>
        </tr>
      </table>
    `)}
    ${p(`This is applied automatically to every new payment starting now — no action needed. Keep processing, and the next tier down is waiting for you.`)}
    ${p(`Thanks for building on Dynopay.`)}`;

    const html = dynoPayEmailTemplate(
      `You're now ${newTier} — enjoy ${newPercent}% fees`,
      content,
      true,
      "View your dashboard",
      `${FRONTEND_BASE_URL}/dashboard`
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Volume-tier upgrade email sent to ${email} (${previousTier}→${newTier})`);
  } catch (e) {
    apiLogger.error("Volume-tier upgrade email error:", e);
  }
};

/**
 * Template 8: Email Verification OTP
 */
export const sendEmailVerificationOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.emailVerifyOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.emailVerifyOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${p(t('merchant.emailVerifyOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.emailVerifyOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Email verification OTP sent to ${email}`);
  } catch (e) {
    apiLogger.error("Email verification OTP email error:", e);
  }
};

/**
 * Template 9: Login OTP
 */
export const sendLoginOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.loginOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.loginOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${p(t('merchant.loginOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.loginOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Login OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Login OTP email error:", e);
  }
};

/**
 * Template 10: Forgot Password OTP
 */
export const sendForgotPasswordOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.forgotPasswordOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.forgotPasswordOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${p(t('merchant.forgotPasswordOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.forgotPasswordOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Forgot password OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Forgot password OTP email error:", e);
  }
};

/**
 * Template 11: Password Changed
 */
export const sendPasswordChangedEmail = async (
  email: string,
  name: string,
  date: string,
  time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.passwordChanged.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.passwordChanged.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `, '#22c55e')}
    ${warnText(t('merchant.passwordChanged.securityNotice', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.passwordChanged.heading', L), content, true, t('merchant.passwordChanged.cta', L), `${FRONTEND_BASE_URL}/dashboard/settings`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Password changed email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Password changed email error:", e);
  }
};

/**
 * Template 2b: User Profile Updated
 */
export const sendUserProfileUpdatedEmail = async (
  email: string,
  name: string,
  updatedFields: string[],
  oldEmail?: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.profileUpdated.subject', L);
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const fieldsList = updatedFields.length > 0
      ? updatedFields.map(field => dataRow(field, statusBadge(t('merchant.badges.updated', L), 'info'))).join('')
      : dataRow(t('merchant.general', L), statusBadge(t('merchant.badges.updated', L), 'info'), true);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.profileUpdated.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fieldsList}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `, '#22c55e')}
    ${warnText(t('merchant.profileUpdated.securityNotice', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.profileUpdated.heading', L), content, true, t('merchant.profileUpdated.cta', L), `${FRONTEND_BASE_URL}/dashboard/profile`);
    await mailTransporter({ to: email, name, subject, body: html });

    if (oldEmail && oldEmail !== email) {
      const content2 = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
      ${p(t('merchant.profileUpdated.emailChangedIntro', L, { oldEmail, email }))}
      ${infoBox(`
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.profileUpdated.emailChangedImportantTitle', L)}</p>
        <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.profileUpdated.emailChangedImportantText', L)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
          ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
        </table>
      `, '#ef4444')}`;

      const oldEmailHtml = dynoPayEmailTemplate(t('merchant.profileUpdated.emailChangedHeading', L), content2, true, t('merchant.profileUpdated.emailChangedCta', L), `${FRONTEND_BASE_URL}/support`);
      await mailTransporter({ to: oldEmail, name, subject: t('merchant.profileUpdated.emailChangedSubject', L), body: oldEmailHtml });
      apiLogger.info(`[ProfileUpdate] Email change notification sent to old email: ${oldEmail}`);
    }

    apiLogger.info(`[ProfileUpdate] Profile updated email sent to ${email}`);
  } catch (e) {
    apiLogger.error("[ProfileUpdate] Email error:", e);
  }
};

/**
 * Template 17: Security Alert
 */
export const sendSecurityAlertEmail = async (
  email: string,
  name: string,
  alertType: string,
  details: string,
  date?: string,
  time?: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.securityAlert.subject', L);
    const now = new Date();
    const dateStr = date || now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = time || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.securityAlert.intro', L))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.securityAlert.detailsTitle', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.type', L), alertType)}
        ${dataRow(t('labels.date', L), `${dateStr} at ${timeStr}`)}
        ${dataRow(t('merchant.labels.details', L), details, true)}
      </table>
    `, '#ef4444')}
    ${p(t('merchant.securityAlert.wasThisYou', L))}
    ${p(t('merchant.securityAlert.didntPerform', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.securityAlert.heading', L), content, true, t('merchant.securityAlert.cta', L), `${FRONTEND_BASE_URL}/dashboard/security`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Security alert email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Security alert email error:", e);
  }
};

/**
 * Template 23: New Device Login Alert
 */
export const sendNewDeviceLoginEmail = async (
  email: string,
  name: string,
  ipAddress: string,
  userAgent: string,
  location: string | null,
  date: string,
  time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.newDeviceLogin.subject', L);

    let deviceInfo = t('merchant.newDeviceLogin.unknownDevice', L);
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      deviceInfo = userAgent.includes('iPad') ? 'iPad' : 'iPhone';
    } else if (userAgent.includes('Android')) {
      deviceInfo = 'Android Device';
    } else if (userAgent.includes('Windows')) {
      deviceInfo = 'Windows PC';
    } else if (userAgent.includes('Mac')) {
      deviceInfo = 'Mac';
    } else if (userAgent.includes('Linux')) {
      deviceInfo = 'Linux';
    } else if (userAgent.includes('Mobile')) {
      deviceInfo = 'Mobile Device';
    }

    let browser = '';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    }
    if (browser) {
      deviceInfo += ` (${browser})`;
    }

    const locationDisplay = location || t('merchant.newDeviceLogin.unknownLocation', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.newDeviceLogin.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.location', L), locationDisplay)}
        ${dataRow(t('merchant.labels.device', L), deviceInfo)}
        ${dataRow(t('merchant.labels.ipAddress', L), `<span style="font-family: monospace; font-size: 13px;">${ipAddress}</span>`)}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `)}
    ${p(t('merchant.newDeviceLogin.wasThisYou', L))}
    ${p(t('merchant.newDeviceLogin.didntLogin', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.newDeviceLogin.heading', L), content, true, t('merchant.newDeviceLogin.cta', L), `${FRONTEND_BASE_URL}/dashboard/settings`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] New device login alert sent to ${email} from ${locationDisplay} (${ipAddress})`);
  } catch (e) {
    apiLogger.error("New device login email error:", e);
  }
};

/**
 * Template 23b: Login Activity Notification (sent on EVERY login)
 * Includes a "Not you?" security link
 */
export const sendLoginNotificationEmail = async (
  email: string,
  name: string,
  ipAddress: string,
  device: string,
  browser: string,
  os: string,
  location: string | null,
  date: string,
  time: string,
  securityToken: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.loginNotification.subject', L);
    const locationDisplay = location || t('merchant.loginNotification.unknownLocation', L);
    const deviceDisplay = `${device}${browser ? ` · ${browser}` : ''}${os ? ` · ${os}` : ''}`;
    const secureAccountUrl = `${FRONTEND_BASE_URL}/auth/secure-account?token=${securityToken}`;

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.loginNotification.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.device', L), deviceDisplay)}
        ${dataRow(t('merchant.labels.location', L), locationDisplay)}
        ${dataRow(t('merchant.labels.ipAddress', L), `<span style="font-family: monospace; font-size: 13px;">${ipAddress}</span>`)}
        ${dataRow(t('merchant.labels.time', L), `${date} at ${time}`, true)}
      </table>
    `)}
    ${p(t('merchant.loginNotification.wasThisYou', L))}
    ${p(t('merchant.loginNotification.notYou', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.loginNotification.heading', L), content, true, t('merchant.loginNotification.cta', L), secureAccountUrl);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Login notification sent to ${email} (${deviceDisplay}, ${locationDisplay})`);
  } catch (e) {
    apiLogger.error("Login notification email error:", e);
  }
};

/**
 * Template 24: Failed Login Attempts Alert
 */
export const sendFailedLoginAttemptsEmail = async (
  email: string,
  name: string,
  attemptCount: number,
  ipAddress: string,
  date: string,
  time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.failedLogins.subject', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.failedLogins.intro', L, { count: attemptCount }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.failedAttempts', L), `<strong>${attemptCount}</strong>`)}
        ${dataRow(t('labels.date', L), `${date} at ${time}`)}
        ${dataRow(t('merchant.labels.ipAddress', L), `<span style="font-family: monospace; font-size: 13px;">${ipAddress}</span>`, true)}
      </table>
    `, '#ef4444')}
    ${p(t('merchant.failedLogins.wasThisYou', L))}
    ${p(t('merchant.failedLogins.wasntYou', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.failedLogins.heading', L), content, true, t('merchant.failedLogins.cta', L), `${FRONTEND_BASE_URL}/forgot-password`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Failed login attempts alert sent to ${email} - ${attemptCount} attempts from ${ipAddress}`);
  } catch (e) {
    apiLogger.error("Failed login attempts email error:", e);
  }
};

// ============================================================
// SECTION 4: COMPANY EMAILS
// ============================================================

/**
 * Template 2: Company Profile Created
 */
export const sendCompanyProfileCreatedEmail = async (
  email: string,
  name: string,
  companyName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.companyCreated.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.companyCreated.intro1', L, { companyName }))}
    ${p(t('merchant.companyCreated.intro2', L))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyCreated.whyTitle', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyCreated.whyText', L)}</p>
    `)}`;

    const html = dynoPayEmailTemplate(t('merchant.companyCreated.heading', L), content, true, t('merchant.companyCreated.cta', L), `${FRONTEND_BASE_URL}/dashboard/wallets`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Company profile created email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Company profile created email error:", e);
  }
};

/**
 * Template 2b: Company Contact Welcome Email
 */
export const sendCompanyContactWelcomeEmail = async (
  companyContactEmail: string,
  companyName: string,
  accountHolderName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, companyContactEmail);
    const subject = t('merchant.companyContactWelcome.subject', L, { companyName });
    const content = `${p(t('merchant.companyContactWelcome.hello', L))}
    ${p(t('merchant.companyContactWelcome.intro1', L, { companyName, accountHolderName }))}
    ${p(t('merchant.companyContactWelcome.intro2', L))}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyContactWelcome.meansTitle', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyContactWelcome.means1', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyContactWelcome.means2', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyContactWelcome.means3', L)}</td></tr>
      </table>
    `)}
    ${p(t('merchant.companyContactWelcome.outro', L, { accountHolderName }))}`;

    const html = dynoPayEmailTemplate(t('merchant.companyContactWelcome.heading', L), content, true, t('merchant.companyContactWelcome.cta', L), `${FRONTEND_BASE_URL}`);
    await mailTransporter({ to: companyContactEmail, name: companyName, subject, body: html });
    apiLogger.info(`Company contact welcome email sent to ${companyContactEmail}`);
  } catch (e) {
    apiLogger.error("Company contact welcome email error:", e);
  }
};

/**
 * Template 2c: Company Profile Updated
 */
export const sendCompanyProfileUpdatedEmail = async (
  email: string,
  name: string,
  companyName: string,
  updatedFields: string[],
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.companyUpdated.subject', L);
    const fieldsList = updatedFields.length > 0
      ? updatedFields.map(field => dataRow(field, statusBadge(t('merchant.badges.updated', L), 'info'))).join('')
      : dataRow(t('merchant.general', L), statusBadge(t('merchant.badges.updated', L), 'info'), true);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.companyUpdated.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fieldsList}
      </table>
    `, '#22c55e')}
    ${p(t('merchant.companyUpdated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.companyUpdated.heading', L), content, true, t('merchant.companyUpdated.cta', L), `${FRONTEND_BASE_URL}/dashboard/company`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Company profile updated email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Company profile updated email error:", e);
  }
};

// ============================================================
// SECTION 5: WALLET EMAILS
// ============================================================

/**
 * Template 3: Wallet OTP
 */
export const sendWalletOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  walletAddressMasked: string,
  network: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.address', L), walletAddressMasked)}
        ${dataRow(t('merchant.labels.network', L), network, true)}
      </table>
    `)}
    ${p(t('merchant.walletOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet OTP email error:", e);
  }
};

/**
 * Template 4: Wallet Verified
 */
export const sendWalletVerifiedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletVerified.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletVerified.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.address', L), walletAddressMasked)}
        ${dataRow(t('merchant.labels.network', L), network)}
        ${dataRow(t('labels.status', L), statusBadge(t('merchant.badges.active', L), 'success'), true)}
      </table>
    `, '#22c55e')}
    ${p(t('merchant.walletVerified.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletVerified.heading', L), content, true, t('merchant.walletVerified.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet verified email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet verified email error:", e);
  }
};

/**
 * Template 5: Wallet Update OTP
 */
export const sendWalletUpdateOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  oldWalletMasked: string,
  newWalletMasked: string,
  network: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletUpdateOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletUpdateOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.current', L), oldWalletMasked)}
        ${dataRow(t('merchant.labels.new', L), newWalletMasked)}
        ${dataRow(t('merchant.labels.network', L), network, true)}
      </table>
    `)}
    ${warnText(t('merchant.walletUpdateOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletUpdateOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet update OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet update OTP email error:", e);
  }
};

/**
 * Template 27: Wallet Deleted
 */
export const sendWalletDeletedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  date: string,
  time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletDeleted.subject', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletDeleted.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.address', L), walletAddressMasked)}
        ${dataRow(t('merchant.labels.network', L), network)}
        ${dataRow(t('merchant.labels.removed', L), `${date} at ${time}`, true)}
      </table>
    `, '#ef4444')}
    ${p(t('merchant.walletDeleted.outro', L))}
    ${p(t('merchant.walletDeleted.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletDeleted.heading', L), content, true, t('merchant.walletAdded.cta', L), `${FRONTEND_BASE_URL}/dashboard/wallets`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Wallet deleted notification sent to ${email} for ${network}`);
  } catch (e) {
    apiLogger.error("Wallet deleted email error:", e);
  }
};

/**
 * Template 7: Add Wallet Reminder
 */
export const sendAddWalletReminderEmail = async (
  email: string,
  name: string,
  companyName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.addWalletReminder.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.addWalletReminder.intro', L, { companyName }))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.addWalletReminder.whyTitle', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.addWalletReminder.whyText', L)}</p>
    `)}
    ${p(t('merchant.addWalletReminder.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.addWalletReminder.heading', L), content, true, t('merchant.addWalletReminder.cta', L), `${FRONTEND_BASE_URL}/dashboard/wallets`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Add wallet reminder email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Add wallet reminder email error:", e);
  }
};

/**
 * Wallet Added Confirmation
 * Sent when a new payout wallet is successfully verified and added
 */
export const sendWalletAddedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  companyName: string,
  walletName?: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletAdded.subject', L, { network });
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletAdded.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.address', L), `<span style="font-family: monospace; font-size: 13px;">${walletAddressMasked}</span>`)}
        ${dataRow(t('merchant.labels.blockchain', L), network)}
        ${walletName ? dataRow(t('merchant.labels.walletName', L), walletName) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('merchant.badges.active', L), 'success'), true)}
      </table>
    `, '#22c55e')}
    ${p(t('merchant.walletAdded.outro', L, { network }))}
    ${warnText(t('merchant.walletAdded.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletAdded.heading', L), content, true, t('merchant.walletAdded.cta', L), `${FRONTEND_BASE_URL}/dashboard/wallets`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet added email sent to ${email} for ${network}`);
  } catch (e) {
    apiLogger.error("Wallet added email error:", e);
  }
};

/**
 * Wallet Updated Confirmation
 * Sent when a wallet address is successfully changed
 */
export const sendWalletUpdatedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  companyName: string,
  walletName?: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletUpdated.subject', L, { network });
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletUpdated.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.newAddress', L), `<span style="font-family: monospace; font-size: 13px;">${walletAddressMasked}</span>`)}
        ${dataRow(t('merchant.labels.blockchain', L), network)}
        ${walletName ? dataRow(t('merchant.labels.walletName', L), walletName) : ''}
        ${dataRow(t('merchant.labels.updated', L), `${dateStr} at ${timeStr}`, true)}
      </table>
    `, '#f59e0b')}
    ${p(t('merchant.walletUpdated.outro', L, { network }))}
    ${warnText(t('merchant.walletUpdated.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletUpdated.heading', L), content, true, t('merchant.walletUpdated.cta', L), `${FRONTEND_BASE_URL}/dashboard/wallets`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet updated email sent to ${email} for ${network}`);
  } catch (e) {
    apiLogger.error("Wallet updated email error:", e);
  }
};

/**
 * Withdrawal OTP Email
 * Sent when user requests a crypto withdrawal
 */
export const sendWithdrawalOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  amount: string,
  currency: string,
  destinationAddress: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.withdrawalOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.withdrawalOtp.intro', L, { amount, currency }))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${dataRow(t('merchant.labels.toAddress', L), `<span style="font-family: monospace; font-size: 13px;">${destinationAddress}</span>`, true)}
      </table>
    `, '#f59e0b')}
    ${warnText(t('merchant.withdrawalOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.withdrawalOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Withdrawal OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Withdrawal OTP email error:", e);
  }
};

/**
 * Withdrawal Success Email
 * Sent when a crypto withdrawal is submitted to the blockchain
 */
export const sendWithdrawalSuccessEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  destinationAddress: string,
  transactionReference: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.withdrawalSuccess.subject', L, { amount, currency });
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.withdrawalSuccess.intro', L, { amount, currency }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(t('merchant.badges.inProgress', L), 'pending'))}
        ${dataRow(t('merchant.labels.toAddress', L), `<span style="font-family: monospace; font-size: 13px;">${destinationAddress}</span>`)}
        ${dataRow(t('labels.reference', L), `<span style="font-family: monospace; font-size: 13px;">${transactionReference}</span>`)}
        ${dataRow(t('labels.date', L), `${dateStr} at ${timeStr}`, true)}
      </table>
    `, '#3b82f6')}
    ${p(t('merchant.withdrawalSuccess.outro1', L))}
    ${p(t('merchant.withdrawalSuccess.outro2', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.withdrawalSuccess.heading', L), content, true, t('merchant.withdrawalSuccess.cta', L), `${FRONTEND_BASE_URL}/dashboard/transactions`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Withdrawal success email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Withdrawal success email error:", e);
  }
};

/**
 * Exchange OTP Email
 * Sent when user initiates a currency exchange with another user
 */
export const sendExchangeOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  amountUsd: string,
  fromCurrency: string,
  toCurrency: string,
  otherPartyName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.exchangeOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.exchangeOtp.intro', L, { otherParty: otherPartyName }))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>$${amountUsd}</strong>`)}
        ${dataRow(t('merchant.labels.from', L), fromCurrency)}
        ${dataRow(t('merchant.labels.to', L), toCurrency)}
        ${dataRow(t('merchant.labels.with', L), otherPartyName, true)}
      </table>
    `, '#3b82f6')}
    ${p(t('merchant.exchangeOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.exchangeOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Exchange OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Exchange OTP email error:", e);
  }
};

/**
 * Wallet Edit OTP Email (new wallet system)
 * Sent when user requests to edit a wallet address
 */
export const sendWalletEditOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  walletAddressMasked: string,
  network: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletEditOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletEditOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.wallet', L), `<span style="font-family: monospace; font-size: 13px;">${walletAddressMasked}</span>`)}
        ${dataRow(t('merchant.labels.network', L), network, true)}
      </table>
    `)}
    ${p(t('merchant.walletEditOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletEditOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet edit OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet edit OTP email error:", e);
  }
};

/**
 * Wallet Delete OTP Email (new wallet system)
 * Sent when user requests to delete a wallet address permanently
 */
export const sendWalletDeleteOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  walletAddressMasked: string,
  network: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletDeleteOtp.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletDeleteOtp.intro', L))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.wallet', L), `<span style="font-family: monospace; font-size: 13px;">${walletAddressMasked}</span>`)}
        ${dataRow(t('merchant.labels.network', L), network)}
        ${dataRow(t('merchant.labels.action', L), statusBadge(t('merchant.badges.permanentDeletion', L), 'error'), true)}
      </table>
    `, '#ef4444')}
    ${warnText(t('merchant.walletDeleteOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletDeleteOtp.heading', L), content);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet delete OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet delete OTP email error:", e);
  }
};

// ============================================================
// SECTION 6: PAYMENT LIFECYCLE EMAILS
// ============================================================

/**
 * Template 6: Payment Received
 * Unified version - date/time optional for backwards compatibility
 */
export const sendPaymentReceivedEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  companyName: string,
  transactionId: string,
  date?: string,
  time?: string,
  lang: string = 'en',
  cryptoAmount?: string,
  cryptoCurrency?: string
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('paymentReceived.subject', L, { amount, currency });
    const dateTimeStr = date && time ? `${date} at ${time}` : new Date().toLocaleString(L === 'en' ? 'en-GB' : L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('paymentReceived.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${cryptoAmount} ${cryptoCurrency}`) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.received', L), 'success'))}
        ${dataRow(t('labels.date', L), dateTimeStr)}
        ${dataRow(t('labels.transactionId', L), `<span style="font-size: 12px; font-family: monospace;">${transactionId}</span>`, true)}
      </table>
    `, '#22c55e')}
    ${p(t('paymentReceived.outro', L))}`;

    const html = dynoPayEmailTemplate(t('paymentReceived.heading', L), content, true, t('paymentReceived.cta', L), `${FRONTEND_BASE_URL}/dashboard/transactions`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Payment received email sent to ${email}`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentReceivedEmail' });
  }
};

/**
 * Payment Pending - blockchain unconfirmed transaction detected
 */
export const sendPaymentPendingEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  confirmationsRequired: number = 1,
  lang: string = 'en',
  cryptoAmount?: string,
  cryptoCurrency?: string
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('paymentPending.subject', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('paymentPending.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${cryptoAmount} ${cryptoCurrency}`) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.awaitingConfirmation', L), 'pending'))}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#f59e0b')}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPending.estimatedTimes', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPending.btcTime', L, { confirmations: confirmationsRequired })}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPending.ethTime', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPending.trxTime', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 13px; color: #78350f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPending.ltcTime', L)}</td></tr>
      </table>
    `, '#f59e0b')}
    ${p(t('paymentPending.outro', L))}`;

    const html = dynoPayEmailTemplate(t('paymentPending.heading', L), content);
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentPendingEmail' });
  }
};

/**
 * Payment Confirming - transaction being confirmed (multiple confirmations)
 */
export const sendPaymentConfirmingEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  currentConfirmations: number,
  requiredConfirmations: number,
  lang: string = 'en',
  cryptoAmount?: string,
  cryptoCurrency?: string
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('paymentConfirming.subject', L, { current: currentConfirmations, required: requiredConfirmations });
    const progressPct = Math.min(100, Math.round((currentConfirmations / requiredConfirmations) * 100));
    const isComplete = currentConfirmations >= requiredConfirmations;
    const remaining = requiredConfirmations - currentConfirmations;

    const htmlContent = `
      ${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
      ${p(t('paymentConfirming.intro', L, { companyName }))}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.amount', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            ${cryptoAmount && cryptoCurrency ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.cryptoAmount', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${cryptoAmount} ${cryptoCurrency}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.confirmations', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${t('paymentConfirming.confirmationsOf', L, { current: currentConfirmations, required: requiredConfirmations })}</td></tr>
            <tr><td colspan="2" style="padding: 12px 0 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e5e7eb; border-radius: 4px; height: 8px;">
                <tr><td style="width: ${progressPct}%; background: ${isComplete ? '#22c55e' : '#3b82f6'}; border-radius: 4px; height: 8px;">&nbsp;</td><td style="height: 8px;">&nbsp;</td></tr>
              </table>
            </td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('labels.transactionId', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'SF Mono', 'Fira Code', monospace, Arial, sans-serif; text-align: right; word-break: break-all;">${transactionId}</td></tr>
          </table>
        </td></tr>
      </table>
      ${p(isComplete
        ? t('paymentConfirming.completeMsg', L)
        : t('paymentConfirming.pendingMsg', L, { remaining }))}`;

    const html = dynoPayEmailTemplate(t('paymentConfirming.heading', L), htmlContent);
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentConfirmingEmail' });
  }
};

/**
 * Transaction Confirmed
 */
export const sendTransactionConfirmedEmail = async (
  recipientEmail: string,
  name: string,
  transactionId: string,
  amount: string,
  currency: string,
  status: string,
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('transactionConfirmed.subject', L, { status });
    const statusType: 'success' | 'info' = status.toLowerCase() === 'confirmed' ? 'success' : 'info';

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('transactionConfirmed.intro', L, { statusLower: status.toLowerCase() }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`)}
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(status, statusType), true)}
      </table>
    `)}
    ${p(t('transactionConfirmed.outro', L))}`;

    const html = dynoPayEmailTemplate(t('transactionConfirmed.heading', L, { status }), content);
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendTransactionConfirmedEmail' });
  }
};

/**
 * Partial Payment Received
 */
export const sendPaymentPartialEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  remainingAmount: string,
  currency: string,
  transactionId: string,
  walletAddress: string,
  gracePeriodMinutes: number = 30,
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('paymentPartial.subject', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('paymentPartial.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.expectedAmount', L), `${expectedAmount} ${currency}`)}
        ${dataRow(t('labels.received', L), `<strong style="color: #166534;">${receivedAmount} ${currency}</strong>`)}
        ${dataRow(t('labels.remaining', L), `<strong style="color: #dc2626;">${remainingAmount} ${currency}</strong>`)}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#f59e0b')}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPartial.actionRequired', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #7f1d1d; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentPartial.actionText', L, { minutes: gracePeriodMinutes, remaining: remainingAmount, currency })}</p>
    `, '#dc2626')}
    ${p(`<strong>${t('paymentPartial.sendTo', L)}</strong>`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 6px; margin: 0 0 24px 0;">
      <tr><td style="padding: 12px 16px; font-size: 13px; color: #1a1a2e; font-family: 'SF Mono', 'Fira Code', monospace, Arial, sans-serif; word-break: break-all;">${walletAddress}</td></tr>
    </table>
    ${p(t('paymentPartial.graceNote', L, { minutes: gracePeriodMinutes }), `font-size: 14px; color: #6b7280;`)}`;

    const html = dynoPayEmailTemplate(t('paymentPartial.heading', L), content);
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentPartialEmail' });
  }
};

/**
 * Partial Payment Expired
 */
export const sendPaymentPartialExpiredEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  currency: string,
  transactionId: string,
  status: "completed_partial" | "incomplete_expired",
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const isCompleted = status === "completed_partial";
    const subject = isCompleted
      ? t('paymentPartialExpired.subjectCompleted', L)
      : t('paymentPartialExpired.subjectExpired', L);
    const heading = isCompleted ? t('paymentPartialExpired.headingCompleted', L) : t('paymentPartialExpired.headingExpired', L);
    const borderColor = isCompleted ? '#22c55e' : '#f59e0b';
    const badgeType: 'success' | 'pending' = isCompleted ? 'success' : 'pending';
    const statusLabel = isCompleted ? t('statusLabels.processed', L) : t('statusLabels.expired', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(isCompleted
      ? t('paymentPartialExpired.introCompleted', L, { companyName })
      : t('paymentPartialExpired.introExpired', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.expectedAmount', L), `${expectedAmount} ${currency}`)}
        ${dataRow(t('labels.receivedAmount', L), `<strong>${receivedAmount} ${currency}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(statusLabel, badgeType))}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, borderColor)}
    ${p(isCompleted
      ? t('paymentPartialExpired.outroCompleted', L)
      : t('paymentPartialExpired.outroExpired', L)
    )} ${p(t('paymentPartialExpired.viewDetails', L))}`;

    const html = dynoPayEmailTemplate(heading, content);
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentPartialExpiredEmail' });
  }
};

/**
 * Template 25: Payment Failed/Underpaid
 */
export const sendPaymentFailedEmail = async (
  customerEmail: string,
  customerName: string | null,
  merchantEmail: string | null,
  merchantName: string | null,
  companyName: string,
  reason: 'expired' | 'underpaid' | 'cancelled' | 'timeout',
  amount: string,
  currency: string,
  paidAmount: string | null,
  transactionId: string,
  customerLang: string = 'en',
  merchantLang: string = 'en'
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const CL = normalizeLang(customerLang);

    const reasonKey = `paymentFailed.reason${reason.charAt(0).toUpperCase() + reason.slice(1)}`;
    const reasonVars = { paidAmount, currency, amount };
    const reasonMessage = t(reasonKey, CL, reasonVars);

    const subject = reason === 'underpaid'
      ? t('paymentFailed.subjectUnderpaid', CL, { paidAmount, amount, currency })
      : t('paymentFailed.subject', CL, { companyName });

    const customerContent = `${p(t('common.greeting', CL, { name: displayName }))}
    ${p(t('paymentFailed.customerIntro', CL, { companyName }))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentFailed.issue', CL)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${reasonMessage}</p>
    `, '#ef4444')}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', CL), `${amount} ${currency}`)}
        ${paidAmount ? dataRow(t('labels.amountReceived', CL), `${paidAmount} ${currency}`) : ''}
        ${dataRow(t('labels.transactionId', CL), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `)}
    ${reason === 'underpaid' ? p(t('paymentFailed.underpaidNote', CL, { companyName })) : ''}
    ${reason === 'expired' || reason === 'timeout' ? p(t('paymentFailed.expiredNote', CL, { companyName })) : ''}`;

    const customerHtml = dynoPayEmailTemplate(t('paymentFailed.heading', CL), customerContent);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: customerHtml });
    apiLogger.info(`[Email] Payment failed notification sent to customer ${customerEmail} - reason: ${reason}`);

    if (merchantEmail) {
      const ML = normalizeLang(merchantLang);
      const merchantDisplayName = merchantName || 'Merchant';
      const merchantReasonMessage = t(reasonKey, ML, reasonVars);
      const merchantSubject = reason === 'underpaid'
        ? t('paymentFailed.merchantSubjectUnderpaid', ML, { paidAmount, amount, currency })
        : t('paymentFailed.merchantSubject', ML, { transactionId });

      const merchantContent = `${p(t('common.greeting', ML, { name: merchantDisplayName }))}
      ${p(t('paymentFailed.merchantIntro', ML, { customerName: displayName }))}
      ${infoBox(`
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('paymentFailed.issue', ML)}</p>
        <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${merchantReasonMessage}</p>
      `, '#f59e0b')}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t('labels.customer', ML), customerEmail)}
          ${dataRow(t('labels.amount', ML), `${amount} ${currency}`)}
          ${paidAmount ? dataRow(t('labels.amountReceived', ML), `${paidAmount} ${currency}`) : ''}
          ${dataRow(t('labels.transactionId', ML), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
        </table>
      `)}
      ${reason === 'underpaid' ? p(t('paymentFailed.merchantUnderpaidNote', ML)) : ''}`;

      const merchantHtml = dynoPayEmailTemplate(t('paymentFailed.merchantHeading', ML), merchantContent, true, t('paymentFailed.cta', ML), `${FRONTEND_BASE_URL}/dashboard/transactions`);
      await mailTransporter({ to: merchantEmail, name: merchantDisplayName, subject: merchantSubject, body: merchantHtml });
      apiLogger.info(`[Email] Payment failed notification sent to merchant ${merchantEmail} - reason: ${reason}`);
    }
  } catch (e) {
    apiLogger.error("Payment failed email error:", e);
  }
};

/**
 * Template 19: Customer Payment Confirmation with PDF Receipt
 */
export const sendCustomerPaymentConfirmationEmail = async (
  customerEmail: string,
  customerName: string | null,
  companyName: string,
  amount: string,
  currency: string,
  transactionId: string,
  description: string | null,
  date: string,
  time: string,
  cryptoAmount?: string,
  cryptoCurrency?: string,
  transactionReference?: string,
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const displayName = customerName || customerEmail.split('@')[0];
    const subject = t('customerPaymentConfirmation.subject', L, { companyName });

    let pdfAttachment: { name: string; content: string; contentType: string } | undefined;
    try {
      const receiptData = {
        transactionId,
        transactionReference,
        amount,
        currency,
        cryptoAmount,
        cryptoCurrency,
        companyName,
        customerEmail,
        customerName: displayName,
        paymentDate: new Date(`${date} ${time}`),
        description: description || undefined,
        paymentMethod: cryptoCurrency ? `${t('receipt.cryptocurrency', L)} (${cryptoCurrency})` : t('receipt.cryptocurrency', L),
        status: t('receipt.completed', L),
        lang: L,
      };

      const pdfBuffer = await generatePaymentReceipt(receiptData);
      const filename = getReceiptFilename(transactionId);

      pdfAttachment = {
        name: filename,
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      };
      apiLogger.info(`[Email] Generated PDF receipt: ${filename}`);
    } catch (pdfError) {
      apiLogger.error("[Email] Failed to generate PDF receipt:", pdfError);
    }

    const content = `${p(t('common.greeting', L, { name: displayName }))}
    ${p(t('customerPaymentConfirmation.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.complete', L), 'success'))}
        ${dataRow(t('labels.amountPaid', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${cryptoAmount} ${cryptoCurrency}`) : ''}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`)}
        ${transactionReference ? dataRow(t('labels.reference', L), transactionReference) : ''}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `, '#22c55e')}
    ${pdfAttachment ? p(t('customerPaymentConfirmation.pdfAttached', L)) : ''}
    ${p(t('customerPaymentConfirmation.contact', L, { companyName }))}
    ${p(`<span style="font-size: 13px; color: #6b7280;">${t('common.securedBy', L)}</span>`)}`;

    const html = dynoPayEmailTemplate(t('customerPaymentConfirmation.heading', L), content);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html, attachments: pdfAttachment ? [pdfAttachment] : undefined });
    apiLogger.info(`[Email] Customer payment confirmation sent to ${customerEmail} for ${amount} ${currency}${pdfAttachment ? ' with PDF receipt' : ''}`);
  } catch (e) {
    apiLogger.error("Customer payment confirmation email error:", e);
  }
};

/**
 * Template 28: Large Transaction Alert
 */
export const sendLargeTransactionAlertEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  cryptoAmount: string,
  cryptoCurrency: string,
  customerEmail: string | null,
  transactionId: string,
  companyName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.largeTransaction.subject', L, { amount, currency });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.largeTransaction.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${dataRow(t('merchant.labels.crypto', L), `${cryptoAmount} ${cryptoCurrency}`)}
        ${customerEmail ? dataRow(t('labels.customer', L), customerEmail) : ''}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#22c55e')}
    ${p(t('merchant.largeTransaction.outro1', L))}
    ${p(t('merchant.largeTransaction.outro2', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.largeTransaction.heading', L), content, true, t('merchant.largeTransaction.cta', L), `${FRONTEND_BASE_URL}/dashboard/transactions`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Large transaction alert sent to ${email} - ${amount} ${currency}`);
  } catch (e) {
    apiLogger.error("Large transaction alert email error:", e);
  }
};

// ============================================================
// SECTION 7: ADMIN EMAILS
// ============================================================

/**
 * Admin Fee Received notification
 */
export const sendAdminFeeReceivedEmail = async (
  recipientEmail: string,
  name: string,
  feeAmount: string,
  currency: string,
  transactionId: string,
  companyName: string,
  merchantAmount: string,
  totalAmount: string
) => {
  try {
    const subject = `Platform Fee Received - ${feeAmount} ${currency}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const merchantAmountNum = parseFloat(merchantAmount);
    const feeAmountNum = parseFloat(feeAmount);
    const totalAmountNum = parseFloat(totalAmount);
    const isUnderThreshold = merchantAmountNum === 0 && feeAmountNum === totalAmountNum;

    let detailContent: string;
    let noticeBlock = '';

    if (isUnderThreshold) {
      detailContent = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Total Received', `<strong>${feeAmount} ${currency}</strong>`)}
          ${dataRow('Status', statusBadge('Under Threshold', 'pending'))}
          ${dataRow('Merchant Received', `${merchantAmount} ${currency}`)}
          ${dataRow('Platform Received', `<strong>${feeAmount} ${currency} (100%)</strong>`)}
          ${dataRow('Date', `${dateStr} at ${timeStr}`)}
          ${dataRow('Company', companyName)}
          ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
        </table>`;
      noticeBlock = infoBox(`
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;"><strong>Under Threshold:</strong> This payment was below the minimum forwarding threshold. All funds have been credited to the admin ${currency} wallet.</p>
      `, '#f59e0b');
    } else {
      detailContent = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Platform Fee', `<strong>${feeAmount} ${currency}</strong>`)}
          ${dataRow('Status', statusBadge('Processed', 'success'))}
          ${dataRow('Merchant Net', `${merchantAmount} ${currency}`)}
          ${dataRow('Total Processed', `${totalAmount} ${currency}`)}
          ${dataRow('Date', `${dateStr} at ${timeStr}`)}
          ${dataRow('Company', companyName)}
          ${dataRow('Transaction ID', `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
        </table>`;
    }

    const htmlContent = `
      ${p(`Platform fee received from <strong>${companyName}</strong>.`)}
      ${infoBox(detailContent, '#22c55e')}
      ${noticeBlock}
      ${p(`The fee has been credited to the admin ${currency} wallet.`)}`;

    const htmlBody = dynoPayEmailTemplate("Platform Fee Received", `${p(`Hey ${name},`)}\n${htmlContent}`);
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: htmlBody });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendAdminFeeReceivedEmail' });
  }
};

/**
 * Admin Fee Sweep notification
 */
export const sendAdminFeeSweepEmail = async (
  recipientEmail: string,
  amountSwept: string,
  currency: string,
  fromAddress: string,
  toAddress: string,
  sweepTxId: string,
  gasUsed: string,
  sweepMode: string
) => {
  try {
    const subject = `Admin Fee Swept — ${amountSwept} ${currency}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const sweepModeDisplay = sweepMode === 'threshold' ? 'USD Threshold' : sweepMode.startsWith('auto-convert') ? 'Auto-Convert (Direct Transfer)' : 'Time-Based';

    const htmlContent = `
      ${p(`Admin fees have been swept from a pool address to the admin wallet.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount Swept', `<strong style="color: #166534;">${amountSwept} ${currency}</strong>`)}
          ${dataRow('Status', statusBadge('Swept', 'success'))}
          ${dataRow('Sweep Mode', sweepModeDisplay)}
          ${dataRow('Gas Used', gasUsed)}
          ${dataRow('From Address', `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${fromAddress}</span>`)}
          ${dataRow('To Admin Wallet', `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${toAddress}</span>`)}
          ${dataRow('Date', `${dateStr} at ${timeStr}`)}
          ${dataRow('Sweep TX ID', `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${sweepTxId}</span>`, true)}
        </table>
      `, '#3b82f6')}
      ${p(`The admin fees have been transferred to the admin ${currency} wallet. You can verify the transaction on the blockchain explorer.`)}`;

    const htmlBody = dynoPayEmailTemplate("Admin Fee Sweep Completed", `${p(`Hey DynoPay Admin,`)}\n${htmlContent}`);
    const info = await mailTransporter({
      to: recipientEmail,
      name: "DynoPay Admin",
      subject,
      body: htmlBody,
    });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendAdminFeeSweepEmail' });
  }
};

// ============================================================
// SECTION 8: AUTO-CONVERSION EMAILS
// ============================================================

/**
 * Auto-conversion payout email (complex layout with volatility, savings, fee breakdown)
 */
export const sendAutoConversionPayoutEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  data: {
    sourceCurrency: string;
    sourceAmount: string;
    sourceAmountUsd: string;
    targetCurrency: string;
    payoutAmount: string;
    conversionRate: string;
    priceAtConversion: number;
    currentPrice: number;
    priceMovementPct: number;
    marketState: string;
    feeTierUsed: string;
    transactionId: string;
    conversionId: string;
    withdrawalTxHash?: string;
    platformFeeUsd?: number;
    sweepGasFeeUsd?: number;
    tradeFeeUsd?: number;
    binanceWithdrawalFeeUsd?: number;
    grossSaleUsd?: number;
    totalReceivedUsd?: number;
  },
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, recipientEmail);
    const {
      sourceCurrency, sourceAmount, sourceAmountUsd,
      targetCurrency, payoutAmount, conversionRate,
      priceAtConversion, currentPrice, priceMovementPct,
      marketState, feeTierUsed, transactionId, conversionId,
      withdrawalTxHash,
      platformFeeUsd = 0, sweepGasFeeUsd = 0, tradeFeeUsd = 0,
      binanceWithdrawalFeeUsd = 0, grossSaleUsd = 0, totalReceivedUsd = 0,
    } = data;

    const totalFeesUsd = platformFeeUsd + sweepGasFeeUsd + tradeFeeUsd + binanceWithdrawalFeeUsd;
    const hasDetailedFees = totalFeesUsd > 0;

    const isVolatile = ["VOLATILE", "DECLINING"].includes(marketState);
    const priceDiffSinceConversion = ((currentPrice - priceAtConversion) / priceAtConversion) * 100;
    const priceDroppedSinceConversion = priceDiffSinceConversion < -0.1;
    const savedAmount = priceDroppedSinceConversion
      ? Math.abs(priceDiffSinceConversion / 100) * parseFloat(payoutAmount)
      : 0;

    const subject = t('merchant.autoConversion.subject', L, { payoutAmount, targetCurrency, sourceAmount, sourceCurrency });

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const volatilityVisual = isVolatile ? errorBox(`
      <p class="warn-text" style="margin: 0 0 10px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Market Volatility at Time of Conversion</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius: 4px; height: 10px; margin-bottom: 8px;">
        <tr>
          <td class="neutral-box" style="width: ${Math.min(100, Math.abs(priceMovementPct) * 20)}%; background: #ef4444; border-radius: 4px; height: 10px;">&nbsp;</td>
          <td style="height: 10px;">&nbsp;</td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        ${sourceCurrency} moved <strong>${Math.abs(priceMovementPct).toFixed(2)}%</strong> during conversion window &mdash; ${feeTierUsed === 'fast' || feeTierUsed === 'fastest' ? 'fast-tracked with priority fees' : 'processed with standard fees'}
      </p>
    `) : '';

    const savingsBlock = priceDroppedSinceConversion ? successBox(`
      <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Auto-Conversion Protected You</p>
      <p class="stat-value-green" style="font-size: 28px; font-weight: 700; margin: 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center;">~$${savedAmount.toFixed(2)} saved</p>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        ${sourceCurrency} has dropped <strong>${Math.abs(priceDiffSinceConversion).toFixed(2)}%</strong> since your conversion<br/>
        Converted at $${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &mdash; Now $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    `) : '';

    const priceUpBlock = !priceDroppedSinceConversion && Math.abs(priceDiffSinceConversion) > 0.1 ? infoBox(`
      <p style="margin: 0; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        ${sourceCurrency} is currently at <strong>$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        (${priceDiffSinceConversion > 0 ? '+' : ''}${priceDiffSinceConversion.toFixed(2)}% since conversion).
        Your payout was locked in at <strong>$${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for price certainty.
      </p>
    `) : '';

    // Compute the effective platform-fee % from the actual charged fee vs. gross sale.
    // This shows the merchant's REAL tier rate on the receipt (1.5% → 0.5% depending on
    // volume tier), instead of a hardcoded "1.5%" string.
    const effectivePlatformPct =
      grossSaleUsd > 0 && platformFeeUsd > 0
        ? (platformFeeUsd / grossSaleUsd) * 100
        : 0;
    const platformPctLabel = effectivePlatformPct > 0
      ? effectivePlatformPct.toFixed(effectivePlatformPct < 1 ? 2 : 1) + "%"
      : "";

    const feeRows = [
      feeRow('Gross Conversion', `$${grossSaleUsd.toFixed(2)} ${targetCurrency}`),
      platformFeeUsd > 0 ? feeRow(`Platform Fee${platformPctLabel ? ` (${platformPctLabel})` : ''}`, `-$${platformFeeUsd.toFixed(4)}`, true) : '',
      sweepGasFeeUsd > 0 ? feeRow('Network Gas Fee (sweep)', `-$${sweepGasFeeUsd.toFixed(4)}`, true) : '',
      tradeFeeUsd > 0 ? feeRow('Exchange Fee (0.1%)', `-$${tradeFeeUsd.toFixed(4)}`, true) : '',
      binanceWithdrawalFeeUsd > 0
        ? feeRow('Withdrawal Fee (on-chain)', `-$${binanceWithdrawalFeeUsd.toFixed(4)}`, true)
        : feeRow('Withdrawal Fee', '$0.00 (off-chain)'),
      feeTotalRow('Net Payout', `${payoutAmount} ${targetCurrency}`),
    ].filter(Boolean).join('');

    const htmlContent = `
      ${p(t('merchant.autoConversion.intro', L))}
      ${twoColumnStats(
        statCard('Received', `${sourceAmount} ${sourceCurrency}`, `~$${parseFloat(sourceAmountUsd).toFixed(2)} USD`),
        statCard('Payout', `${payoutAmount} ${targetCurrency}`, 'Sent to your wallet', 'green')
      )}
      ${volatilityVisual}
      ${savingsBlock}
      ${priceUpBlock}
      ${hasDetailedFees ? feeTable(feeRows) : ''}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Conversion Rate', `<strong>1 ${sourceCurrency} = ${parseFloat(conversionRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${targetCurrency}</strong>`)}
          ${dataRow('Market State', statusBadge(marketState, isVolatile ? 'pending' : 'success'))}
          ${dataRow('Date', `${dateStr} at ${timeStr}`)}
          ${withdrawalTxHash ? dataRow('Withdrawal TX', mono(withdrawalTxHash)) : ''}
          ${dataRow('Conversion ID', mono(`#${conversionId}`), true)}
        </table>
      `)}
      ${p(t('merchant.autoConversion.outro', L))}`;

    const htmlBody = dynoPayEmailTemplate(t('merchant.autoConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\n${htmlContent}`);
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Auto-conversion payout email sent to ${recipientEmail} (conversion #${conversionId})`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendAutoConversionPayoutEmail' });
  }
};

/**
 * Weekly conversion summary email (complex layout with charts and breakdown)
 */
export const sendWeeklyConversionSummaryEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  data: {
    periodStart: string;
    periodEnd: string;
    totalConversions: number;
    totalSourceUsd: number;
    totalPayoutUsd: number;
    totalSavedUsd: number;
    totalVolatileConversions: number;
    avgPriceMovementPct: number;
    cryptoBreakdown: Array<{
      currency: string;
      count: number;
      totalAmount: string;
      totalPayoutUsd: number;
      avgMovementPct: number;
    }>;
    dailyVolume: Array<{
      day: string;
      label: string;
      payoutUsd: number;
    }>;
  },
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, recipientEmail);
    const {
      periodStart, periodEnd, totalConversions,
      totalSourceUsd, totalPayoutUsd, totalSavedUsd,
      totalVolatileConversions, avgPriceMovementPct,
      cryptoBreakdown, dailyVolume,
    } = data;

    if (totalConversions === 0) return;

    const subject = `Weekly Conversion Report — ${totalConversions} conversion${totalConversions !== 1 ? 's' : ''}, $${totalPayoutUsd.toFixed(2)} paid out`;

    const maxDailyVolume = Math.max(...dailyVolume.map(d => d.payoutUsd), 1);
    const chartRows = dailyVolume.map(d => {
      const barWidth = Math.max(2, Math.round((d.payoutUsd / maxDailyVolume) * 100));
      const hasActivity = d.payoutUsd > 0;
      return `
        <tr class="fee-row">
          <td style="padding: 4px 8px 4px 0; font-size: 12px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; white-space: nowrap; width: 40px;">${d.label}</td>
          <td style="padding: 4px 0; width: 100%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 3px; height: 18px;">
              <tr>
                <td style="width: ${barWidth}%; background: ${hasActivity ? '#3b82f6' : 'transparent'}; border-radius: 3px; height: 18px;">&nbsp;</td>
                <td style="height: 18px;">&nbsp;</td>
              </tr>
            </table>
          </td>
          <td style="padding: 4px 0 4px 8px; font-size: 12px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; white-space: nowrap; text-align: right; width: 60px; font-weight: ${hasActivity ? '600' : '400'};">${hasActivity ? '$' + d.payoutUsd.toFixed(0) : '-'}</td>
        </tr>`;
    }).join('');

    const breakdownRows = cryptoBreakdown.map(c => {
      const movementColor = c.avgMovementPct < -1 ? '#dc2626' : c.avgMovementPct < 0 ? '#f59e0b' : '#22c55e';
      const movementSign = c.avgMovementPct >= 0 ? '+' : '';
      return `
        <tr class="fee-row">
          <td style="padding: 10px 0; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${c.currency}</td>
          <td style="padding: 10px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center; border-bottom: 1px solid #f3f4f6;">${c.count}</td>
          <td style="padding: 10px 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">$${c.totalPayoutUsd.toFixed(2)}</td>
          <td style="padding: 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">
            <span style="color: ${movementColor}; font-size: 13px; font-weight: 500;">${movementSign}${c.avgMovementPct.toFixed(2)}%</span>
          </td>
        </tr>`;
    }).join('');

    const savingsBlock = totalSavedUsd > 0.01 ? successBox(`
      <p style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0 0 4px;">Total Protected This Week</p>
      <p class="stat-value-green" style="font-size: 32px; font-weight: 700; margin: 8px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">~$${totalSavedUsd.toFixed(2)}</p>
      <p style="font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center;">
        saved by converting before further price drops<br/>
        ${totalVolatileConversions} of ${totalConversions} conversions occurred during volatile markets
      </p>
    `) : '';

    const htmlContent = `
      ${p(t('merchant.weeklyConversion.intro', L, { companyName }))}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="padding: 0 4px 8px 0; width: 33%;">
            ${statCard('Conversions', `${totalConversions}`, '', 'blue')}
          </td>
          <td style="padding: 0 4px 8px 4px; width: 34%;">
            ${statCard('Total Payout', `$${totalPayoutUsd.toFixed(0)}`, '', 'green')}
          </td>
          <td style="padding: 0 0 8px 4px; width: 33%;">
            ${statCard('Avg Movement', `${avgPriceMovementPct >= 0 ? '+' : ''}${avgPriceMovementPct.toFixed(1)}%`, '', avgPriceMovementPct < -0.5 ? 'green' : 'blue')}
          </td>
        </tr>
      </table>

      ${savingsBlock}

      ${neutralBox(`
        <p style="font-size: 13px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Daily Conversion Volume</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${chartRows}
        </table>
      `)}

      ${infoBox(`
        <p style="font-size: 13px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Breakdown by Crypto</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr class="fee-row">
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Asset</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Count</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Payout</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Avg Move</td>
          </tr>
          ${breakdownRows}
        </table>
      `)}

      ${p(`<span style="font-size: 13px; color: #9ca3af;">Report period: ${periodStart} to ${periodEnd}. Auto-conversion protects your revenue from crypto price volatility by instantly converting to stablecoins.</span>`)}`;

    const htmlBody = dynoPayEmailTemplate(t('merchant.weeklyConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\n${htmlContent}`);
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Weekly conversion summary sent to ${recipientEmail} (${totalConversions} conversions)`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendWeeklyConversionSummaryEmail' });
  }
};

// ============================================================
// SECTION 9: MARKETING & REMINDER EMAILS
// ============================================================

/**
 * Template 12: Payment Link Created
 */
export const sendPaymentLinkCreatedEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  paymentLink: string,
  description: string,
  expiresAt: string | null,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.paymentLinkCreated.subject', L, { amount, currency });

    let shortDisplayUrl = paymentLink;
    try {
      const url = new URL(paymentLink);
      const pathParts = url.pathname + url.search;
      if (pathParts.length > 20) {
        const lastChars = pathParts.slice(-8);
        shortDisplayUrl = `${url.host}/pay/...${lastChars}`;
      }
    } catch {
      // Keep original if URL parsing fails
    }

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.paymentLinkCreated.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('merchant.labels.expires', L), expiresAt || t('merchant.never', L))}
        ${dataRow(t('merchant.labels.link', L), `<a href="${paymentLink}" style="color: #0a0a0a; text-decoration: none;">${shortDisplayUrl}</a>`, true)}
      </table>
    `)}
    ${p(t('merchant.paymentLinkCreated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.paymentLinkCreated.heading', L), content, true, t('merchant.paymentLinkCreated.cta', L), paymentLink);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Payment link created email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Payment link created email error:", e);
  }
};

/**
 * Template 22: Payment Link Expiring Soon
 */
export const sendPaymentExpiringEmail = async (
  customerEmail: string,
  customerName: string | null,
  companyName: string,
  amount: string,
  currency: string,
  paymentLink: string,
  expiresIn: string,
  description: string | null
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const subject = `Payment link expires ${expiresIn} - ${amount} ${currency}`;

    const content = `${p(`Hey ${displayName},`)}
    ${p(`This is a friendly reminder that your payment link from <strong>${companyName}</strong> will expire <strong>${expiresIn}</strong>.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `<strong>${amount} ${currency}</strong>`)}
        ${description ? dataRow('Description', description) : ''}
        ${dataRow('Expires', statusBadge(expiresIn, 'pending'), true)}
      </table>
    `, '#f59e0b')}
    ${p(`Complete your payment now to avoid missing this deadline.`)}`;

    const html = dynoPayEmailTemplate("Payment Expiring Soon", content, true, "Pay Now", paymentLink);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html });
    apiLogger.info(`[Email] Payment expiring reminder sent to ${customerEmail} - expires ${expiresIn}`);
  } catch (e) {
    apiLogger.error("Payment expiring email error:", e);
  }
};

/**
 * Referee Code Reminder email
 */
export const sendRefereeCodeReminderEmail = async (
  recipientEmail: string,
  code: string,
  discountPercent: number,
  discountDurationDays: number,
  daysRemaining: number,
  reminderType: 'week1' | 'week2' | 'week3' | 'final',
  unsubscribeToken: string
) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || process.env.CHECKOUT_URL || 'https://dynopay.io';
    const signupUrl = `${baseUrl}/signup?ref=${code}`;
    const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;

    let subject: string;
    let urgencyMessage: string;
    let ctaText: string;

    switch (reminderType) {
      case 'week1':
        subject = "Don't forget your exclusive DynoPay offer!";
        urgencyMessage = `You still have <strong>${daysRemaining} days</strong> to claim your exclusive discount.`;
        ctaText = "Claim Your Discount";
        break;
      case 'week2':
        subject = "Your 50% discount is waiting - DynoPay";
        urgencyMessage = `Your exclusive <strong>${discountPercent}% discount</strong> is still available! Only <strong>${daysRemaining} days</strong> remaining.`;
        ctaText = "Start Saving Today";
        break;
      case 'week3':
        subject = `Only ${daysRemaining} days left on your DynoPay offer!`;
        urgencyMessage = `<strong>Time is running out!</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>.`;
        ctaText = "Don't Miss Out";
        break;
      case 'final':
        subject = "LAST CHANCE: Your DynoPay discount expires in 3 days!";
        urgencyMessage = `<strong style="color: #dc2626;">FINAL REMINDER:</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>. This is your last chance!`;
        ctaText = "Claim Now Before It's Gone";
        break;
    }

    const message = `
<p>We noticed you haven't claimed your exclusive DynoPay discount yet!</p>

<div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
  <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 18px;">Your Exclusive Offer</h3>
  <p style="margin: 0 0 8px 0; color: #14532d; font-size: 16px;">
    <strong>${discountPercent}% OFF</strong> all transaction fees for <strong>${discountDurationDays} days</strong>
  </p>
  <p style="margin: 0; font-size: 14px;">
    Your code: <strong style="background: #dcfce7; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 16px;">${code}</strong>
  </p>
</div>

<p style="font-size: 15px;">${urgencyMessage}</p>

<h4 style="margin: 24px 0 12px 0; color: #1034a6;">Why DynoPay?</h4>
<ul style="margin: 0; padding-left: 20px; color: #4a4a4a;">
  <li>Accept crypto payments from customers worldwide</li>
  <li>Support for Bitcoin, Ethereum, USDT, and more</li>
  <li>Instant notifications and easy dashboard</li>
  <li>Lower fees than traditional payment processors</li>
</ul>

<div style="text-align: center; margin: 32px 0;">
  <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText}</a>
</div>

<p style="font-size: 13px; color: #6b7280; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a> from these reminders
</p>
    `.trim();

    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate("Your Discount is Waiting!", `${p(`Hey ${recipientName},`)}\n${message}`);

    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Referee reminder (${reminderType}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendRefereeCodeReminderEmail' });
  }
};

/**
 * Payment Link Reminder email
 */
export const sendPaymentLinkReminderEmail = async (
  recipientEmail: string,
  companyName: string,
  amount: string,
  currency: string,
  description: string | null,
  paymentLink: string,
  expiresAt: Date | null,
  reminderType: 'reminder1' | 'reminder2' | 'final',
  unsubscribeToken: string
) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || process.env.CHECKOUT_URL || 'https://dynopay.io';
    const backendUrl = process.env.SERVER_URL || baseUrl;
    const unsubscribeUrl = `${backendUrl}/api/user/unsubscribe-payment-reminders?token=${unsubscribeToken}`;

    let subject: string;
    let urgencyMessage: string;
    let ctaText: string;
    let headerText: string;

    let timeRemaining = '';
    if (expiresAt) {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        timeRemaining = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        timeRemaining = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      } else {
        timeRemaining = 'less than an hour';
      }
    }

    switch (reminderType) {
      case 'reminder1':
        subject = `Complete your payment to ${companyName}`;
        headerText = "Payment Reminder";
        urgencyMessage = expiresAt
          ? `You have <strong>${timeRemaining}</strong> to complete this payment.`
          : `Please complete your payment at your earliest convenience.`;
        ctaText = "Complete Payment";
        break;
      case 'reminder2':
        subject = `Your payment to ${companyName} is still pending`;
        headerText = "Payment Still Pending";
        urgencyMessage = expiresAt
          ? `<strong>Don't forget!</strong> You have <strong>${timeRemaining}</strong> remaining to complete this payment.`
          : `We noticed you haven't completed your payment yet. Need help?`;
        ctaText = "Pay Now";
        break;
      case 'final':
        subject = expiresAt
          ? `Payment expires soon - ${companyName}`
          : `Final reminder: Payment pending - ${companyName}`;
        headerText = expiresAt ? "Expiring Soon!" : "Final Reminder";
        urgencyMessage = expiresAt
          ? `<strong style="color: #dc2626;">URGENT:</strong> Your payment link expires in <strong>${timeRemaining}</strong>. Please complete your payment now to avoid missing the deadline.`
          : `This is a final reminder about your pending payment. Please complete it soon or contact ${companyName} if you have questions.`;
        ctaText = "Complete Payment Now";
        break;
    }

    const message = `
<p>You have a pending payment request from <strong>${companyName}</strong>.</p>

<div style="margin: 24px 0; padding: 20px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6;">
  <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Amount Due:</strong> ${amount} ${currency}</p>
  ${description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>` : ''}
  ${expiresAt ? `<p style="margin: 0;"><strong>Expires:</strong> ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}</p>` : ''}
</div>

<p style="font-size: 15px;">${urgencyMessage}</p>

<div style="text-align: center; margin: 32px 0;">
  <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText}</a>
</div>

<p style="font-size: 14px; color: #6b7280;">
  If you've already completed this payment, please disregard this email. If you have any questions about this payment, please contact ${companyName} directly.
</p>

<p style="font-size: 13px; color: #9ca3af; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe</a> from payment reminders
</p>
    `.trim();

    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate(headerText, `${p(`Hey ${recipientName},`)}\n${message}`);

    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Payment link reminder (${reminderType}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentLinkReminderEmail' });
  }
};

// ============================================================
// SECTION 10: KYC EMAILS
// ============================================================

/**
 * Template 13: KYC Required
 */
export const sendKYCRequiredEmail = async (
  email: string,
  name: string,
  totalVolume: string,
  currency: string = 'USD',
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const currencySymbol = getCurrencySymbol(currency);
    const thresholdAmount = currency === 'USD' ? '5,000' : '5,000 USD equivalent';
    const subject = t('merchant.kycRequired.subject', L, { symbol: currencySymbol, threshold: thresholdAmount });
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.kycRequired.intro', L, { symbol: currencySymbol, volume: totalVolume, currency }))}
    ${p(t('merchant.kycRequired.intro2', L, { symbol: currencySymbol, threshold: thresholdAmount }))}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycRequired.needTitle', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycRequired.need1', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycRequired.need2', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycRequired.need3', L)}</td></tr>
      </table>
    `)}
    ${p(t('merchant.kycRequired.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.kycRequired.heading', L), content, true, t('merchant.kycRequired.cta', L), `${FRONTEND_BASE_URL}/dashboard/kyc`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`KYC required email sent to ${email}`);
  } catch (e) {
    apiLogger.error("KYC required email error:", e);
  }
};

export const sendKYCApprovedEmail = async (email: string, name: string, lang?: string) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.kycApproved.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.kycApproved.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.status', L), statusBadge(t('merchant.badges.approved', L), 'success'), true)}
      </table>
    `, '#22c55e')}
    ${p(t('merchant.kycApproved.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.kycApproved.heading', L), content, true, t('merchant.kycApproved.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`KYC approved email sent to ${email}`);
  } catch (e) {
    apiLogger.error("KYC approved email error:", e);
  }
};

export const sendKYCRejectedEmail = async (email: string, name: string, rejectionReason: string, lang?: string) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.kycRejected.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.kycRejected.intro', L))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycRejected.reasonTitle', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${rejectionReason}</p>
    `, '#ef4444')}
    ${p(t('merchant.kycRejected.outro1', L))}
    ${p(t('merchant.kycRejected.outro2', L))}
    ${p(t('merchant.kycRejected.outro3', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.kycRejected.heading', L), content, true, t('merchant.kycRejected.cta', L), `${FRONTEND_BASE_URL}/dashboard/kyc`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`KYC rejected email sent to ${email}`);
  } catch (e) {
    apiLogger.error("KYC rejected email error:", e);
  }
};

export const sendKYCStartedEmail = async (email: string, name: string, verificationUrl: string, lang?: string) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.kycStarted.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.kycStarted.intro', L))}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycStarted.needTitle', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycStarted.need1', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycStarted.need2', L)}</td></tr>
        <tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycStarted.need3', L)}</td></tr>
      </table>
    `)}
    ${p(t('merchant.kycStarted.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.kycStarted.heading', L), content, true, t('merchant.kycStarted.cta', L), verificationUrl);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`KYC started email sent to ${email}`);
  } catch (e) {
    apiLogger.error("KYC started email error:", e);
  }
};

export const sendKYCResubmissionRequiredEmail = async (email: string, name: string, reason: string, lang?: string) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.kycResubmission.subject', L);
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.kycResubmission.intro', L))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.kycResubmission.reasonTitle', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${reason}</p>
    `, '#f59e0b')}
    ${p(t('merchant.kycResubmission.outro1', L))}
    ${p(t('merchant.kycResubmission.outro2', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.kycResubmission.heading', L), content, true, t('merchant.kycResubmission.cta', L), `${FRONTEND_BASE_URL}/dashboard/kyc`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`KYC resubmission required email sent to ${email}`);
  } catch (e) {
    apiLogger.error("KYC resubmission required email error:", e);
  }
};

// ============================================================
// SECTION 11: WEEKLY SUMMARY & INVOICE EMAILS
// ============================================================

/**
 * Template 16: Weekly Summary (merchant platform summary)
 */
export const sendWeeklySummaryEmail = async (
  email: string,
  name: string,
  periodStart: string,
  periodEnd: string,
  transactionCount: number,
  totalVolume: string,
  completedCount: number,
  pendingCount: number,
  topCurrency: string,
  baseCurrency: string = 'USD',
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const currencySymbol = getCurrencySymbol(baseCurrency);
    const subject = t('merchant.weeklySummary.subject', L);
    const totalVolumeNum = parseFloat(totalVolume);
    const hasActivity = transactionCount > 0;
    const hasCompleted = completedCount > 0;

    let contextMessage = '';
    if (!hasActivity) {
      contextMessage = p(t('merchant.weeklySummary.noActivity', L));
    } else if (hasCompleted && totalVolumeNum > 0) {
      contextMessage = p(t('merchant.weeklySummary.greatWeek', L, { symbol: currencySymbol, volume: totalVolume, currency: baseCurrency, completed: completedCount }));
    } else if (pendingCount > 0 && !hasCompleted) {
      contextMessage = p(t('merchant.weeklySummary.pendingMsg', L, { pending: pendingCount }));
    } else {
      contextMessage = p(t('merchant.weeklySummary.genericMsg', L, { count: transactionCount }));
    }

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.weeklySummary.intro', L, { periodStart, periodEnd }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.totalTransactions', L), `<strong>${transactionCount}</strong>`)}
        ${dataRow(t('merchant.labels.totalVolume', L), `<strong>${currencySymbol}${totalVolume} ${baseCurrency}</strong>`)}
        ${dataRow(t('merchant.labels.completed', L), statusBadge(String(completedCount), 'success'))}
        ${dataRow(t('merchant.labels.pending', L), statusBadge(String(pendingCount), 'pending'))}
        ${dataRow(t('merchant.labels.topCurrency', L), topCurrency === 'None' ? t('merchant.noCompletedTx', L) : topCurrency, true)}
      </table>
    `)}
    ${contextMessage}`;

    const html = dynoPayEmailTemplate(t('merchant.weeklySummary.heading', L), content, true, t('merchant.weeklySummary.cta', L), `${FRONTEND_BASE_URL}/dashboard/analytics`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Weekly summary email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Weekly summary email error:", e);
  }
};

/**
 * Template 18: Invoice Generated
 */
export const sendInvoiceGeneratedEmail = async (
  email: string,
  name: string,
  invoiceData: {
    invoice_number: string;
    transaction_id: number;
    total_usd: number;
    total_amount?: number;
    currency?: string;
    invoice_date: Date;
    invoice_url: string;
  },
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const currency = invoiceData.currency || 'USD';
    const amount = invoiceData.total_amount || invoiceData.total_usd;
    const currencySymbol = getCurrencySymbol(currency);

    const subject = t('merchant.invoice.subject', L, { number: invoiceData.invoice_number });
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.invoice.intro', L, { transactionId: invoiceData.transaction_id }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.invoiceNumber', L), invoiceData.invoice_number)}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${invoiceData.transaction_id}</span>`)}
        ${dataRow(t('merchant.labels.totalAmount', L), `<strong>${currencySymbol}${amount.toFixed(2)} ${currency}</strong>`)}
        ${dataRow(t('merchant.labels.invoiceDate', L), new Date(invoiceData.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), true)}
      </table>
    `)}
    ${p(t('merchant.invoice.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.invoice.heading', L), content, true, t('merchant.invoice.cta', L), invoiceData.invoice_url);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Invoice email sent to ${email} for invoice ${invoiceData.invoice_number}`);
  } catch (error) {
    apiLogger.error(`Failed to send invoice email to ${email}:`, error);
    throw error;
  }
};

// ============================================================
// SECTION 12: API KEY & SUBSCRIPTION EMAILS
// ============================================================

export const sendApiKeyCreatedEmail = async (
  email: string, name: string, keyType: 'development' | 'production',
  action: 'created' | 'regenerated', keyPreview: string, date: string, time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const keyTypeWord = keyType === 'production' ? t('merchant.typeProduction', L) : t('merchant.typeDevelopment', L);
    const subject = action === 'created'
      ? t('merchant.apiKey.subjectCreated', L, { keyType: keyTypeWord })
      : t('merchant.apiKey.subjectRegenerated', L, { keyType: keyTypeWord });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(action === 'created' ? t('merchant.apiKey.introCreated', L, { keyType: keyTypeWord }) : t('merchant.apiKey.introRegenerated', L, { keyType: keyTypeWord }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.environment', L), keyType === 'production' ? statusBadge(t('merchant.badges.production', L), 'error') : statusBadge(t('merchant.badges.development', L), 'pending'))}
        ${dataRow(t('merchant.labels.keyPreview', L), `<span style="font-family: monospace; font-size: 13px;">${keyPreview}...</span>`)}
        ${action === 'regenerated' ? dataRow(t('merchant.labels.note', L), t('merchant.apiKey.oldInvalid', L)) : ''}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `)}
    ${keyType === 'production' ? warnText(t('merchant.apiKey.productionWarn', L)) : ''}
    ${p(action === 'created' ? t('merchant.apiKey.didntCreate', L) : t('merchant.apiKey.didntRegenerate', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.apiKey.heading', L), content, true, t('merchant.apiKey.cta', L), `${FRONTEND_BASE_URL}/dashboard/api-keys`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] API key ${action} notification sent to ${email} for ${keyType} environment`);
  } catch (e) {
    apiLogger.error("API key created email error:", e);
  }
};

export const sendSubscriptionCreatedEmail = async (
  customerEmail: string, customerName: string | null, merchantEmail: string, merchantName: string,
  planName: string, amount: string, currency: string, interval: string, nextBillingDate: string, companyName: string
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const CL = await resolveEmailLang(null, customerEmail);
    const ML = await resolveEmailLang(null, merchantEmail);

    const customerSubject = t('merchant.subscriptionCreated.custSubject', CL, { planName });
    const customerContent = `${p(displayName ? t('common.greeting', CL, { name: displayName }) : t('common.greetingDefault', CL))}
    ${p(t('merchant.subscriptionCreated.custIntro', CL, { planName, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.plan', CL), planName)}
        ${dataRow(t('labels.amount', CL), `<strong>${amount} ${currency} / ${interval}</strong>`)}
        ${dataRow(t('merchant.labels.nextBilling', CL), nextBillingDate, true)}
      </table>
    `, '#22c55e')}
    ${p(t('merchant.subscriptionCreated.custOutro', CL))}`;

    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.custHeading', CL), customerContent);
    await mailTransporter({ to: customerEmail, name: displayName, subject: customerSubject, body: customerHtml });

    const merchantSubject = t('merchant.subscriptionCreated.merchSubject', ML, { planName });
    const merchantContent = `${p(merchantName ? t('common.greeting', ML, { name: merchantName }) : t('common.greetingDefault', ML))}
    ${p(t('merchant.subscriptionCreated.merchIntro', ML, { planName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.customer', ML), customerEmail)}
        ${dataRow(t('merchant.labels.plan', ML), planName)}
        ${dataRow(t('merchant.labels.revenue', ML), `<strong>${amount} ${currency} / ${interval}</strong>`)}
        ${dataRow(t('merchant.labels.nextBilling', ML), nextBillingDate, true)}
      </table>
    `, '#22c55e')}`;

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.merchHeading', ML), merchantContent, true, t('merchant.subscriptionCreated.cta', ML), `${FRONTEND_BASE_URL}/dashboard/subscriptions`);
    await mailTransporter({ to: merchantEmail, name: merchantName, subject: merchantSubject, body: merchantHtml });
    apiLogger.info(`[Email] Subscription created notifications sent for ${planName}`);
  } catch (e) {
    apiLogger.error("Subscription created email error:", e);
  }
};

export const sendSubscriptionCancelledEmail = async (
  customerEmail: string, customerName: string | null, merchantEmail: string, merchantName: string,
  planName: string, companyName: string, effectiveDate: string, cancelledBy: 'customer' | 'merchant'
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const CL = await resolveEmailLang(null, customerEmail);
    const ML = await resolveEmailLang(null, merchantEmail);

    const customerSubject = t('merchant.subscriptionCancelled.custSubject', CL, { planName });
    const customerContent = `${p(displayName ? t('common.greeting', CL, { name: displayName }) : t('common.greetingDefault', CL))}
    ${p(t('merchant.subscriptionCancelled.custIntro', CL, { planName, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.plan', CL), planName)}
        ${dataRow(t('merchant.labels.effective', CL), effectiveDate)}
        ${dataRow(t('merchant.labels.cancelledBy', CL), cancelledBy === 'customer' ? t('merchant.you', CL) : companyName, true)}
      </table>
    `, '#f59e0b')}
    ${p(t('merchant.subscriptionCancelled.custOutro1', CL, { effectiveDate }))}
    ${p(t('merchant.subscriptionCancelled.custOutro2', CL))}`;

    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', CL), customerContent);
    await mailTransporter({ to: customerEmail, name: displayName, subject: customerSubject, body: customerHtml });

    const merchantSubject = t('merchant.subscriptionCancelled.merchSubject', ML, { name: displayName });
    const merchantContent = `${p(merchantName ? t('common.greeting', ML, { name: merchantName }) : t('common.greetingDefault', ML))}
    ${p(t('merchant.subscriptionCancelled.merchIntro', ML, { planName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.customer', ML), customerEmail)}
        ${dataRow(t('merchant.labels.plan', ML), planName)}
        ${dataRow(t('merchant.labels.effective', ML), effectiveDate)}
        ${dataRow(t('merchant.labels.cancelledBy', ML), cancelledBy === 'customer' ? t('merchant.customerWord', ML) : t('merchant.you', ML), true)}
      </table>
    `, '#f59e0b')}`;

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', ML), merchantContent, true, t('merchant.subscriptionCancelled.cta', ML), `${FRONTEND_BASE_URL}/dashboard/subscriptions`);
    await mailTransporter({ to: merchantEmail, name: merchantName, subject: merchantSubject, body: merchantHtml });
    apiLogger.info(`[Email] Subscription cancelled notifications sent for ${planName}`);
  } catch (e) {
    apiLogger.error("Subscription cancelled email error:", e);
  }
};

export const sendSubscriptionPaymentFailedEmail = async (
  customerEmail: string, customerName: string | null, merchantEmail: string, merchantName: string,
  planName: string, amount: string, currency: string, companyName: string, failureReason: string, retryDate: string | null
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const CL = await resolveEmailLang(null, customerEmail);
    const ML = await resolveEmailLang(null, merchantEmail);

    const customerSubject = t('merchant.subscriptionPaymentFailed.custSubject', CL, { planName });
    const customerContent = `${p(displayName ? t('common.greeting', CL, { name: displayName }) : t('common.greetingDefault', CL))}
    ${p(t('merchant.subscriptionPaymentFailed.custIntro', CL, { planName, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', CL), `${amount} ${currency}`)}
        ${dataRow(t('merchant.labels.reason', CL), failureReason)}
        ${retryDate ? dataRow(t('merchant.labels.nextRetry', CL), retryDate, true) : ''}
      </table>
    `, '#ef4444')}
    ${p(t('merchant.subscriptionPaymentFailed.custSteps', CL))}
    ${warnText(t('merchant.subscriptionPaymentFailed.custWarn', CL))}`;

    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.custHeading', CL), customerContent, true, t('merchant.subscriptionPaymentFailed.custCta', CL), `${FRONTEND_BASE_URL}/dashboard/subscriptions`);
    await mailTransporter({ to: customerEmail, name: displayName, subject: customerSubject, body: customerHtml });

    const merchantSubject = t('merchant.subscriptionPaymentFailed.merchSubject', ML, { name: displayName });
    const merchantContent = `${p(merchantName ? t('common.greeting', ML, { name: merchantName }) : t('common.greetingDefault', ML))}
    ${p(t('merchant.subscriptionPaymentFailed.merchIntro', ML, { planName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.customer', ML), customerEmail)}
        ${dataRow(t('merchant.labels.plan', ML), planName)}
        ${dataRow(t('labels.amount', ML), `${amount} ${currency}`)}
        ${dataRow(t('merchant.labels.reason', ML), failureReason)}
        ${retryDate ? dataRow(t('merchant.labels.retryScheduled', ML), retryDate, true) : ''}
      </table>
    `, '#f59e0b')}
    ${p(t('merchant.subscriptionPaymentFailed.merchOutro', ML))}`;

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.merchHeading', ML), merchantContent, true, t('merchant.subscriptionPaymentFailed.merchCta', ML), `${FRONTEND_BASE_URL}/dashboard/subscriptions`);
    await mailTransporter({ to: merchantEmail, name: merchantName, subject: merchantSubject, body: merchantHtml });
    apiLogger.info(`[Email] Subscription payment failed notifications sent for ${planName}`);
  } catch (e) {
    apiLogger.error("Subscription payment failed email error:", e);
  }
};

// ============================================================
// SECTION 12B: ADMIN — NEW USER REGISTRATION NOTIFICATION
// ============================================================

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
}) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping new user admin notification");
      return;
    }

    const displayName = userData.name || "N/A";
    const contactInfo = userData.email || userData.mobile || "N/A";
    const registrationMethod = userData.login_type || "Unknown";
    const userId = userData.user_id || "N/A";
    const companyName = userData.company_name || "Not yet provided";
    const registrationTime = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";

    const subject = `New Merchant Registration — ${displayName} (${registrationMethod})`;

    const content = `${p(`A new merchant has registered on DynoPay.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Name', displayName)}
        ${dataRow('Contact', contactInfo)}
        ${dataRow('Registration Method', registrationMethod)}
        ${dataRow('User ID', String(userId))}
        ${dataRow('Company', companyName)}
        ${dataRow('Registered At', registrationTime)}
        ${dataRow('Fee-Free Balance', '$500.00 (trial)', true)}
      </table>
    `, '#3b82f6')}
    ${p(`The account is now <strong>active</strong>. The merchant can begin setting up their payment integration immediately.`)}
    ${p(`You can review this account in the admin dashboard.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("New Merchant Registration", content);
    await mailTransporter({ to: adminEmail, name: "DynoPay Admin", subject, body: html });
    apiLogger.info(`[Email] New user admin notification sent for ${contactInfo} (${registrationMethod})`);
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
    const adminEmail = process.env.ADMIN_EMAIL;
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

    const html = baseEmailTemplate("Onboarding Stuck Alert", content);
    await mailTransporter({ to: adminEmail, name: "DynoPay Admin", subject, body: html });
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
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const displayName = userData.name || "N/A";
    const contact = userData.email || "N/A";
    const hoursStr = userData.hours_to_complete < 1
      ? "< 1 hour"
      : `${Math.round(userData.hours_to_complete)} hours`;

    const subject = `✅ Onboarding Complete — ${displayName} is ready to accept payments`;

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
    `, '#22c55e')}
    ${p(`All onboarding steps completed: email verified, company created, wallet address configured.`)}
    ${p(`This merchant is now live and can receive their first payment.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("Onboarding Complete", content);
    await mailTransporter({ to: adminEmail, name: "DynoPay Admin", subject, body: html });
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
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const merchantName = data.merchant_name || "N/A";
    const daysStr = data.days_since_registration != null
      ? `${data.days_since_registration} days after registration`
      : "N/A";

    const subject = `🎉 First Payment! — ${merchantName} received ${data.amount} ${data.currency}`;

    const content = `${p(`A merchant has received their <strong>very first payment</strong> on DynoPay! 🎉`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Merchant', merchantName)}
        ${dataRow('Email', data.merchant_email || 'N/A')}
        ${dataRow('Company', data.company_name || 'N/A')}
        ${dataRow('User ID', String(data.user_id))}
        ${dataRow('Amount', `<strong>${data.amount} ${data.currency}</strong>${data.amount_usd ? ` (~$${data.amount_usd} USD)` : ''}`)}
        ${dataRow('Payment Method', data.payment_method)}
        ${dataRow('Customer', data.customer_email || 'Anonymous')}
        ${dataRow('Transaction ID', data.transaction_id)}
        ${dataRow('Time to First Payment', daysStr, true)}
      </table>
    `, '#8b5cf6')}
    ${p(`This is a key milestone — the merchant is now actively processing payments.`)}
    ${p(`You can view the full transaction details in the admin dashboard.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("First Payment Milestone", content);
    await mailTransporter({ to: adminEmail, name: "DynoPay Admin", subject, body: html });
    apiLogger.info(`[Email] First payment notification sent for user ${data.user_id} — ${data.amount} ${data.currency}`);
  } catch (e) {
    apiLogger.error("[Email] First payment notification error:", e);
  }
};

// ============================================================
// SECTION 12F: ADMIN — NEW WEBSITE VISITOR NOTIFICATION
// ============================================================

/**
 * Send notification to admin when a new unique visitor arrives at the website.
 */
export const sendNewVisitorAdminEmail = async (visitorData: {
  ip: string;
  country?: string | null;
  city?: string | null;
  referrer?: string | null;
  page: string;
  user_agent?: string | null;
  timestamp: string;
}) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    const country = visitorData.country || "Unknown";
    const referrer = visitorData.referrer || "Direct";
    const page = visitorData.page || "/";

    // Mask IP for privacy (show first 2 octets only)
    const ipParts = visitorData.ip.split('.');
    const maskedIp = ipParts.length === 4
      ? `${ipParts[0]}.${ipParts[1]}.*.*`
      : visitorData.ip.substring(0, Math.min(visitorData.ip.length, 12)) + '...';

    // Parse user agent for readable browser/OS
    const ua = visitorData.user_agent || "Unknown";
    let browser = "Unknown";
    if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("bot") || ua.includes("Bot") || ua.includes("crawl")) browser = "Bot/Crawler";

    const subject = `👀 New Visitor — ${country} via ${referrer === "Direct" ? "Direct" : new URL(referrer).hostname}`;

    const content = `${p(`A new unique visitor has arrived at DynoPay.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Location', `${visitorData.city ? visitorData.city + ', ' : ''}${country}`)}
        ${dataRow('IP (masked)', maskedIp)}
        ${dataRow('Page', page)}
        ${dataRow('Referrer', referrer === "Direct" ? "Direct visit (no referrer)" : referrer)}
        ${dataRow('Browser', browser)}
        ${dataRow('Time', visitorData.timestamp)}
      </table>
    `, '#3b82f6')}
    ${p(`This visitor may become a potential merchant. Monitor sign-ups in the admin dashboard.`, `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate("New Website Visitor", content);
    await mailTransporter({ to: adminEmail, name: "DynoPay Admin", subject, body: html });
    apiLogger.info(`[Email] New visitor notification sent — ${country}, page: ${page}`);
  } catch (e) {
    apiLogger.error("[Email] New visitor notification error:", e);
  }
};

// ============================================================
// SECTION 13: DEFAULT EXPORT
// ============================================================

export default {
  // Template helpers
  dynoPayEmailTemplate,
  dynoPayGreetingTemplate,
  formatAmountWithCurrency,
  // Generic
  sendEmail,
  // User & Auth
  sendWelcomeEmail,
  sendEmailVerificationOTPEmail,
  sendLoginOTPEmail,
  sendForgotPasswordOTPEmail,
  sendPasswordChangedEmail,
  sendUserProfileUpdatedEmail,
  sendSecurityAlertEmail,
  sendNewDeviceLoginEmail,
  sendLoginNotificationEmail,
  sendFailedLoginAttemptsEmail,
  // Company
  sendCompanyProfileCreatedEmail,
  sendCompanyContactWelcomeEmail,
  sendCompanyProfileUpdatedEmail,
  // Wallet
  sendWalletOTPEmail,
  sendWalletVerifiedEmail,
  sendWalletUpdateOTPEmail,
  sendWalletDeletedEmail,
  sendAddWalletReminderEmail,
  sendWalletAddedEmail,
  sendWalletUpdatedEmail,
  sendWithdrawalOTPEmail,
  sendWithdrawalSuccessEmail,
  sendExchangeOTPEmail,
  sendWalletEditOTPEmail,
  sendWalletDeleteOTPEmail,
  // Payment lifecycle
  sendPaymentReceivedEmail,
  sendPaymentPendingEmail,
  sendPaymentConfirmingEmail,
  sendTransactionConfirmedEmail,
  sendPaymentPartialEmail,
  sendPaymentPartialExpiredEmail,
  sendPaymentFailedEmail,
  sendCustomerPaymentConfirmationEmail,
  sendLargeTransactionAlertEmail,
  // Admin
  sendAdminFeeReceivedEmail,
  sendAdminFeeSweepEmail,
  // Auto-conversion
  sendAutoConversionPayoutEmail,
  sendWeeklyConversionSummaryEmail,
  // Marketing & Reminders
  sendPaymentLinkCreatedEmail,
  sendPaymentExpiringEmail,
  sendRefereeCodeReminderEmail,
  sendPaymentLinkReminderEmail,
  // KYC
  sendKYCRequiredEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendKYCStartedEmail,
  sendKYCResubmissionRequiredEmail,
  // Summary & Invoice
  sendWeeklySummaryEmail,
  sendInvoiceGeneratedEmail,
  // API Key & Subscriptions
  sendApiKeyCreatedEmail,
  sendSubscriptionCreatedEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionPaymentFailedEmail,
  // Admin notifications
  sendNewUserAdminNotification,
  sendOnboardingStuckAdminEmail,
  sendOnboardingCompletedAdminEmail,
  sendFirstPaymentAdminEmail,
  sendNewVisitorAdminEmail,
  // Volume-based fee tier
  sendVolumeTierUpgradeEmail,
};
