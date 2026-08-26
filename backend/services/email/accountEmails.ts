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
          <td style="padding: 4px 0; font-size: 13px; color: #05936A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">You save</td>
          <td style="padding: 4px 0; font-size: 13px; color: #05936A; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${savingsPct}% per transaction</td>
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
    `, '#12B76A')}
    ${warnText(t('merchant.passwordChanged.securityNotice', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.passwordChanged.heading', L), content, true, t('merchant.passwordChanged.cta', L), `${FRONTEND_BASE_URL}/settings`);
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
    `, '#12B76A')}
    ${warnText(t('merchant.profileUpdated.securityNotice', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.profileUpdated.heading', L), content, true, t('merchant.profileUpdated.cta', L), `${FRONTEND_BASE_URL}/profile`);
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

      const oldEmailHtml = dynoPayEmailTemplate(t('merchant.profileUpdated.emailChangedHeading', L), content2, true, t('merchant.profileUpdated.emailChangedCta', L), `${FRONTEND_BASE_URL}/help-support`);
      await mailTransporter({ to: oldEmail, name, subject: t('merchant.profileUpdated.emailChangedSubject', L), body: oldEmailHtml });
      apiLogger.info(`[ProfileUpdate] Email change notification sent to old email: ${oldEmail}`);
    }

    apiLogger.info(`[ProfileUpdate] Profile updated email sent to ${email}`);
  } catch (e) {
    apiLogger.error("[ProfileUpdate] Email error:", e);
  }
};

/**
 * Creator handle reserved / updated (#9 — process email).
 * Notifies the merchant when their public handle (username) is first set or
 * later changed, with the resulting page URL. Inline English copy — kept
 * out of the email-i18n system to stay self-contained.
 */
export const sendCreatorHandleUpdatedEmail = async (
  email: string,
  name: string,
  handle: string,
  isNew: boolean
) => {
  try {
    const pageUrl = `${FRONTEND_BASE_URL}/${handle}`;
    const now = new Date();
    const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const heading = isNew ? "Your creator handle is live" : "Your creator handle was updated";
    const subject = isNew ? `Your handle @${handle} is reserved` : `Your handle is now @${handle}`;
    const content = `${p(name ? `Hi ${escapeHtml(name)},` : "Hi there,")}
    ${p(isNew
      ? "Your creator handle has been reserved — your public page and storefront are now available at the link below."
      : "Your creator handle has been updated. Your public page and storefront now live at the new link below — remember to update any links you've already shared.")}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow("Handle", `@${escapeHtml(handle)}`)}
        ${dataRow("Page URL", escapeHtml(pageUrl))}
        ${dataRow("Date", `${date} at ${time}`, true)}
      </table>
    `, "#12B76A")}`;
    const html = dynoPayEmailTemplate(heading, content, true, "View my page", pageUrl);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[CreatorHandle] Handle ${isNew ? "reserved" : "updated"} email sent to ${email} (@${handle})`);
  } catch (e) {
    apiLogger.error("[CreatorHandle] Email error:", e);
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

    const html = dynoPayEmailTemplate(t('merchant.securityAlert.heading', L), content, true, t('merchant.securityAlert.cta', L), `${FRONTEND_BASE_URL}/settings`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Security alert email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Security alert email error:", e);
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

    const html = dynoPayEmailTemplate(t('merchant.failedLogins.heading', L), content, true, t('merchant.failedLogins.cta', L), `${FRONTEND_BASE_URL}/auth/login`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Failed login attempts alert sent to ${email} - ${attemptCount} attempts from ${ipAddress}`);
  } catch (e) {
    apiLogger.error("Failed login attempts email error:", e);
  }
};

// ============================================================
// SECTION 4: COMPANY EMAILS
// ============================================================

