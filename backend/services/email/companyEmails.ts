import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang, resolveEmailLang, firstNameOnly, formatEmailDate } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail, brandSubject, greetingLine } from "./emailShared";

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
    const subject = brandSubject(companyName, t('merchant.companyCreated.subject', L));
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.companyCreated.intro1', L, { companyName }))}
    ${p(t('merchant.companyCreated.intro2', L))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyCreated.whyTitle', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyCreated.whyText', L)}</p>
    `)}`;

    const html = dynoPayEmailTemplate(t('merchant.companyCreated.heading', L), content, true, t('merchant.companyCreated.cta', L), `${FRONTEND_BASE_URL}/wallet`, t('merchant.companyCreated.preheader', L), L, 'store');
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

    const html = dynoPayEmailTemplate(t('merchant.companyContactWelcome.heading', L), content, true, t('merchant.companyContactWelcome.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.companyContactWelcome.preheader', L), L, 'store');
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
    const subject = brandSubject(companyName, t('merchant.companyUpdated.subject', L));
    const fieldsList = updatedFields.length > 0
      ? updatedFields.map(field => dataRow(field, statusBadge(t('merchant.badges.updated', L), 'info'))).join('')
      : dataRow(t('merchant.general', L), statusBadge(t('merchant.badges.updated', L), 'info'), true);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.companyUpdated.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${fieldsList}
      </table>
    `, '#12B76A')}
    ${p(t('merchant.companyUpdated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.companyUpdated.heading', L), content, true, t('merchant.companyUpdated.cta', L), `${FRONTEND_BASE_URL}/company`, t('merchant.companyUpdated.preheader', L), L, 'store');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Company profile updated email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Company profile updated email error:", e);
  }
};

/**
 * Template 2d: Teammate joined — notify the OWNER when an invited teammate
 * accepts and joins the business. Plain-English (mirrors the referral-email
 * style); outbound is suppressed in preview via DISABLE_OUTBOUND_EMAIL.
 */
export const sendTeamMemberJoinedEmail = async (
  ownerEmail: string,
  ownerName: string,
  memberName: string,
  memberEmail: string,
  companyName: string
) => {
  try {
    const who = escapeHtml(memberName || memberEmail);
    const subject = `${memberName || memberEmail} joined ${companyName} on Dynopay`;
    const content = `${p(ownerName ? `Hey ${escapeHtml(firstNameOnly(ownerName))},` : `Hey there,`)}
    ${p(`<strong>${who}</strong> just accepted your invite and joined <strong>${escapeHtml(companyName)}</strong>.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Teammate', escapeHtml(memberEmail), true)}
        ${dataRow('Business', escapeHtml(companyName))}
      </table>
    `, '#12B76A')}
    ${p(`They now have the access you granted. You can review or change their permissions anytime from Settings → Team.`)}`;

    const html = dynoPayEmailTemplate(`A teammate joined`, content, true, `Manage your team`, `${FRONTEND_BASE_URL}/settings?section=team`, `${who} now has access to ${escapeHtml(companyName)}.`, undefined, 'team');
    await mailTransporter({ to: ownerEmail, name: ownerName, subject, body: html });
    apiLogger.info(`[Email] Teammate-joined notice sent to owner ${ownerEmail} (${memberEmail} -> ${companyName})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendTeamMemberJoinedEmail' });
  }
};

// ============================================================
// SECTION 4b: BRAND DELETION (OTP + confirmation)
// ============================================================

/**
 * Brand deletion — step 1: one-time code to confirm the delete.
 */
export const sendCompanyDeleteOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  companyName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const brand = escapeHtml(companyName);
    const subject = t('merchant.companyDeleteOtp.subject', L, { companyName: brand });
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.companyDeleteOtp.intro', L, { companyName: brand }))}
    ${otpBlock(otpCode)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`)}
        ${dataRow(t('merchant.labels.action', L), statusBadge(t('merchant.badges.permanentDeletion', L), 'error'), true)}
      </table>
    `, '#ef4444')}
    ${warnText(t('merchant.companyDeleteOtp.expiry', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.companyDeleteOtp.heading', L), content, false, "", "", t('merchant.companyDeleteOtp.preheader', L, { companyName: brand }), L, 'lock-red');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Brand delete OTP email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Brand delete OTP email error:", e);
  }
};

/**
 * Brand deletion — step 2: confirmation + security net after the delete ran.
 */
export const sendCompanyDeletedEmail = async (
  email: string,
  name: string,
  companyName: string,
  revokedApiKeys: number,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const brand = escapeHtml(companyName);
    const subject = t('merchant.companyDeleted.subject', L, { companyName: brand });
    const li = (text: string) =>
      `<tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">• ${text}</td></tr>`;
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.companyDeleted.intro', L, { companyName: brand }))}
    ${infoBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.companyDeleted.removedTitle', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${li(t('merchant.companyDeleted.removed1', L))}
        ${li(t('merchant.companyDeleted.removed2', L, { apiKeys: revokedApiKeys }))}
        ${li(t('merchant.companyDeleted.removed3', L))}
      </table>
    `, '#ef4444')}
    ${p(t('merchant.companyDeleted.note', L))}
    ${p(t('merchant.companyDeleted.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.companyDeleted.heading', L), content, true, t('merchant.companyDeleted.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.companyDeleted.preheader', L, { companyName: brand }), L, 'trash');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Brand deleted email sent to ${email} (${companyName})`);
  } catch (e) {
    apiLogger.error("Brand deleted email error:", e);
  }
};

// ============================================================
// SECTION 4c: BRAND SOFT-DELETE (7-day grace period)
// ============================================================

/**
 * Brand soft-deleted — the merchant has a 7-day window to get it back.
 * Sent immediately when a brand is deleted (data retained, not yet purged).
 */
export const sendBrandSoftDeletedEmail = async (
  email: string,
  name: string,
  companyName: string,
  purgeAt: Date,
  lang?: string,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const K = 'merchant.brandSoftDeleted';
    const brand = escapeHtml(companyName);
    const date = escapeHtml(formatEmailDate(purgeAt, L));
    const subject = t(`${K}.subject`, L, { companyName });
    const content = `${greetingLine(L, name)}
    ${p(t(`${K}.intro`, L, { companyName: brand }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(t(`${K}.status`, L), 'pending'))}
        ${dataRow(t(`${K}.restoreBefore`, L), `<strong>${date}</strong>`, true)}
      </table>
    `, '#f59e0b')}
    ${p(t(`${K}.changedMind`, L, { date }))}
    ${warnText(t(`${K}.afterDate`, L, { date }))}
    ${p(t(`${K}.didntDoThis`, L))}`;

    const html = dynoPayEmailTemplate(t(`${K}.heading`, L), content, true, t(`${K}.cta`, L), `${FRONTEND_BASE_URL}/help-support`, t(`${K}.preheader`, L, { companyName: brand, date }), L, 'trash');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Brand soft-deleted notice sent to ${email} (${companyName}, purge ${purgeAt.toISOString()}, lang=${L})`);
  } catch (e) {
    apiLogger.error("Brand soft-deleted email error:", e);
  }
};

/**
 * Brand permanently deleted — the 7-day grace window elapsed and the purge ran.
 */
export const sendBrandPermanentlyDeletedEmail = async (
  email: string,
  name: string,
  companyName: string,
  lang?: string,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const K = 'merchant.brandPermanentlyDeleted';
    const brand = escapeHtml(companyName);
    const subject = t(`${K}.subject`, L, { companyName });
    const content = `${greetingLine(L, name)}
    ${p(t(`${K}.intro`, L, { companyName: brand }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(t(`${K}.status`, L), 'error'), true)}
      </table>
    `, '#ef4444')}
    ${p(t(`${K}.createNew`, L))}
    ${p(t(`${K}.didntExpect`, L))}`;

    const html = dynoPayEmailTemplate(t(`${K}.heading`, L), content, true, t(`${K}.cta`, L), `${FRONTEND_BASE_URL}/dashboard`, t(`${K}.preheader`, L, { companyName: brand }), L, 'trash');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Brand permanently-deleted notice sent to ${email} (${companyName}, lang=${L})`);
  } catch (e) {
    apiLogger.error("Brand permanently-deleted email error:", e);
  }
};

/**
 * Brand restored — support/admin brought a soft-deleted brand back within the
 * grace window. Reassures the merchant that everything is intact.
 */
export const sendBrandRestoredEmail = async (
  email: string,
  name: string,
  companyName: string,
  lang?: string,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const K = 'merchant.brandRestored';
    const brand = escapeHtml(companyName);
    const subject = t(`${K}.subject`, L, { companyName });
    const content = `${greetingLine(L, name)}
    ${p(t(`${K}.intro`, L, { companyName: brand }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(t(`${K}.status`, L), 'success'), true)}
      </table>
    `, '#12B76A')}
    ${p(t(`${K}.pickUp`, L))}`;

    const html = dynoPayEmailTemplate(t(`${K}.heading`, L), content, true, t(`${K}.cta`, L), `${FRONTEND_BASE_URL}/dashboard`, t(`${K}.preheader`, L, { companyName: brand }), L, 'store');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Brand restored notice sent to ${email} (${companyName}, lang=${L})`);
  } catch (e) {
    apiLogger.error("Brand restored email error:", e);
  }
};

/**
 * Day-5 nudge: a soft-deleted brand is about to be permanently purged.
 * Sent by the daily reminder cron ~2 days before scheduled_purge_at.
 */
export const sendBrandDeleteReminderEmail = async (
  email: string,
  name: string,
  companyName: string,
  purgeAt: Date,
  daysLeft: number,
  lang?: string,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const K = 'merchant.brandDeleteReminder';
    const brand = escapeHtml(companyName);
    const date = escapeHtml(formatEmailDate(purgeAt, L));
    const daysLabel = daysLeft === 1 ? t(`${K}.dayOne`, L) : t(`${K}.dayOther`, L, { count: daysLeft });
    const subject = t(`${K}.subject`, L, { companyName, daysLabel });
    const content = `${greetingLine(L, name)}
    ${p(t(`${K}.intro`, L, { companyName: brand, date, daysLabel }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`)}
        ${dataRow(t(`${K}.timeLeft`, L), statusBadge(t(`${K}.timeLeftBadge`, L, { daysLabel }), 'pending'))}
        ${dataRow(t(`${K}.deletesOn`, L), `<strong>${date}</strong>`, true)}
      </table>
    `, '#f59e0b')}
    ${p(t(`${K}.wantItBack`, L, { date }))}`;

    const html = dynoPayEmailTemplate(t(`${K}.heading`, L), content, true, t(`${K}.cta`, L), `${FRONTEND_BASE_URL}/help-support`, t(`${K}.preheader`, L, { companyName: brand, daysLabel }), L, 'trash');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Brand delete reminder (${daysLeft}d left) sent to ${email} (${companyName}, lang=${L})`);
  } catch (e) {
    apiLogger.error("Brand delete reminder email error:", e);
  }
};

// ============================================================
// SECTION 5: WALLET EMAILS
// ============================================================

