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

    const html = dynoPayEmailTemplate(t('merchant.kycRequired.heading', L), content, true, t('merchant.kycRequired.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
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
    `, '#12B76A')}
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

    const html = dynoPayEmailTemplate(t('merchant.kycRejected.heading', L), content, true, t('merchant.kycRejected.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
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

    const html = dynoPayEmailTemplate(t('merchant.kycResubmission.heading', L), content, true, t('merchant.kycResubmission.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`KYC resubmission required email sent to ${email}`);
  } catch (e) {
    apiLogger.error("KYC resubmission required email error:", e);
  }
};

// ============================================================
// SECTION 11: WEEKLY SUMMARY & INVOICE EMAILS
// ============================================================

