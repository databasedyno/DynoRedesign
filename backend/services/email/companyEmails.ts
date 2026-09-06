import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang, resolveEmailLang, firstNameOnly } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail } from "./emailShared";

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

    const html = dynoPayEmailTemplate(t('merchant.companyCreated.heading', L), content, true, t('merchant.companyCreated.cta', L), `${FRONTEND_BASE_URL}/wallet`, t('merchant.companyCreated.preheader', L), L);
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

    const html = dynoPayEmailTemplate(t('merchant.companyContactWelcome.heading', L), content, true, t('merchant.companyContactWelcome.cta', L), `${FRONTEND_BASE_URL}`, t('merchant.companyContactWelcome.preheader', L), L);
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
    `, '#12B76A')}
    ${p(t('merchant.companyUpdated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.companyUpdated.heading', L), content, true, t('merchant.companyUpdated.cta', L), `${FRONTEND_BASE_URL}/company`, t('merchant.companyUpdated.preheader', L), L);
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

    const html = dynoPayEmailTemplate(`A teammate joined`, content, true, `Manage your team`, `${FRONTEND_BASE_URL}/settings?section=team`, `${who} now has access to ${escapeHtml(companyName)}.`);
    await mailTransporter({ to: ownerEmail, name: ownerName, subject, body: html });
    apiLogger.info(`[Email] Teammate-joined notice sent to owner ${ownerEmail} (${memberEmail} -> ${companyName})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendTeamMemberJoinedEmail' });
  }
};

// ============================================================
// SECTION 5: WALLET EMAILS
// ============================================================

