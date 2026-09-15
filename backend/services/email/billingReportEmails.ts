import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { formatEmailDate, t, normalizeLang, resolveEmailLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail, greetingLine } from "./emailShared";
import { toFixedStr } from "../../utils/money";


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
        ${dataRow(t('merchant.labels.totalAmount', L), `<strong>${currencySymbol}${toFixedStr(amount, 2)} ${currency}</strong>`)}
        ${dataRow(t('merchant.labels.invoiceDate', L), formatEmailDate(new Date(invoiceData.invoice_date), L), true)}
      </table>
    `)}
    ${p(t('merchant.invoice.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.invoice.heading', L), content, true, t('merchant.invoice.cta', L), invoiceData.invoice_url, t('merchant.invoice.preheader', L), L, 'receipt');
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
        ${dataRow(t('merchant.labels.keyPreview', L), `<span style="font-family: monospace; font-size: 13px;">${keyPreview}</span>`)}
        ${action === 'regenerated' ? dataRow(t('merchant.labels.note', L), t('merchant.apiKey.oldInvalid', L)) : ''}
        ${dataRow(t('labels.date', L), `${date} · ${time}`, true)}
      </table>
    `)}
    ${keyType === 'production' ? warnText(t('merchant.apiKey.productionWarn', L)) : ''}
    ${p(action === 'created' ? t('merchant.apiKey.didntCreate', L) : t('merchant.apiKey.didntRegenerate', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.apiKey.heading', L), content, true, t('merchant.apiKey.cta', L), `${FRONTEND_BASE_URL}/developer-keys`, t('merchant.apiKey.preheader', L), L, 'key');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] API key ${action} notification sent to ${email} for ${keyType} environment`);
  } catch (e) {
    apiLogger.error("API key created email error:", e);
  }
};

/**
 * One-time notice: merchant API keys are now hashed at rest and shown only once.
 * Sent ONCE PER ACCOUNT by the prod-gated rollout job (apiKeyHashingRollout.ts).
 */
export const sendApiKeysHashedNoticeEmail = async (
  email: string, name: string, lang?: string | null
) => {
  const L = normalizeLang(lang);
  const content = `${greetingLine(L, name)}
    ${p(t('merchant.apiKeyHashed.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.apiKeyHashed.whatLabel', L), t('merchant.apiKeyHashed.whatValue', L))}
        ${dataRow(t('merchant.apiKeyHashed.keysLabel', L), t('merchant.apiKeyHashed.keysValue', L))}
        ${dataRow(t('merchant.apiKeyHashed.actionLabel', L), t('merchant.apiKeyHashed.actionValue', L), true)}
      </table>
    `)}
    ${p(t('merchant.apiKeyHashed.rotate', L))}
    ${p(t('merchant.apiKeyHashed.outro', L))}`;

  const html = dynoPayEmailTemplate(
    t('merchant.apiKeyHashed.heading', L), content, true,
    t('merchant.apiKeyHashed.cta', L), `${FRONTEND_BASE_URL}/developer-keys`,
    t('merchant.apiKeyHashed.preheader', L), L, 'key'
  );
  await mailTransporter({ to: email, name, subject: t('merchant.apiKeyHashed.subject', L), body: html });
  apiLogger.info(`[Email] API keys hashed notice sent to ${email}`);
};

/**
 * API key deleted / revoked — security confirmation (audit gap: only "created" existed).
 */
export const sendApiKeyRevokedEmail = async (
  email: string, name: string, keyType: 'development' | 'production',
  companyName: string, keyPreview: string, date: string, time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const keyTypeWord = keyType === 'production' ? t('merchant.typeProduction', L) : t('merchant.typeDevelopment', L);
    const brand = escapeHtml(companyName);
    const subject = t('merchant.apiKeyRevoked.subject', L, { keyType: keyTypeWord });
    const li = (text: string) =>
      `<tr><td style="padding: 4px 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">• ${text}</td></tr>`;

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.apiKeyRevoked.intro', L, { keyType: keyTypeWord, companyName: brand }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`)}
        ${dataRow(t('merchant.labels.environment', L), keyType === 'production' ? statusBadge(t('merchant.badges.production', L), 'error') : statusBadge(t('merchant.badges.development', L), 'pending'))}
        ${keyPreview ? dataRow(t('merchant.labels.keyPreview', L), `<span style="font-family: monospace; font-size: 13px;">${escapeHtml(keyPreview)}...</span>`) : ''}
        ${dataRow(t('labels.date', L), `${date} · ${time}`, true)}
      </table>
    `, '#ef4444')}
    ${alertBox(`
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #78350f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.apiKeyRevoked.nextTitle', L)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${li(t('merchant.apiKeyRevoked.next1', L))}
        ${li(t('merchant.apiKeyRevoked.next2', L))}
      </table>
    `)}
    ${p(t('merchant.apiKeyRevoked.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.apiKeyRevoked.heading', L), content, true, t('merchant.apiKeyRevoked.cta', L), `${FRONTEND_BASE_URL}/developer-keys`, t('merchant.apiKeyRevoked.preheader', L, { companyName: brand }), L, 'key-off');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] API key revoked notification sent to ${email} for ${keyType} environment`);
  } catch (e) {
    apiLogger.error("API key revoked email error:", e);
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
    const customerContent = `${greetingLine(CL, customerName)}
    ${p(t('merchant.subscriptionCreated.custIntro', CL, { planName, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.plan', CL), planName)}
        ${dataRow(t('labels.amount', CL), `<strong>${amount} ${currency} / ${interval}</strong>`)}
        ${dataRow(t('merchant.labels.nextBilling', CL), nextBillingDate, true)}
      </table>
    `, '#12B76A')}
    ${p(t('merchant.subscriptionCreated.custOutro', CL))}`;

    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.custHeading', CL), customerContent, false, "", "", t('merchant.subscriptionCreated.custPreheader', CL), CL, 'receipt', 'buyer');
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
    `, '#12B76A')}`;

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.merchHeading', ML), merchantContent, true, t('merchant.subscriptionCreated.cta', ML), `${FRONTEND_BASE_URL}/pay-links`, t('merchant.subscriptionCreated.merchPreheader', ML), ML, 'receipt');
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
    const customerContent = `${greetingLine(CL, customerName)}
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

    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', CL), customerContent, false, "", "", t('merchant.subscriptionCancelled.custPreheader', CL), CL, 'expired', 'buyer');
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

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', ML), merchantContent, true, t('merchant.subscriptionCancelled.cta', ML), `${FRONTEND_BASE_URL}/pay-links`, t('merchant.subscriptionCancelled.merchPreheader', ML), ML, 'expired');
    await mailTransporter({ to: merchantEmail, name: merchantName, subject: merchantSubject, body: merchantHtml });
    apiLogger.info(`[Email] Subscription cancelled notifications sent for ${planName}`);
  } catch (e) {
    apiLogger.error("Subscription cancelled email error:", e);
  }
};


// ============================================================
// SECTION 12B: ADMIN — NEW USER REGISTRATION NOTIFICATION
// ============================================================

