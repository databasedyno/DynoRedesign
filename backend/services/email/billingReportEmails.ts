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

    const html = dynoPayEmailTemplate(t('merchant.weeklySummary.heading', L), content, true, t('merchant.weeklySummary.cta', L), `${FRONTEND_BASE_URL}/dashboard`);
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

    const html = dynoPayEmailTemplate(t('merchant.apiKey.heading', L), content, true, t('merchant.apiKey.cta', L), `${FRONTEND_BASE_URL}/developer-keys`);
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
    `, '#12B76A')}
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
    `, '#12B76A')}`;

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCreated.merchHeading', ML), merchantContent, true, t('merchant.subscriptionCreated.cta', ML), `${FRONTEND_BASE_URL}/dashboard`);
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

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionCancelled.heading', ML), merchantContent, true, t('merchant.subscriptionCancelled.cta', ML), `${FRONTEND_BASE_URL}/dashboard`);
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

    const customerHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.custHeading', CL), customerContent, true, t('merchant.subscriptionPaymentFailed.custCta', CL), `${FRONTEND_BASE_URL}/dashboard`);
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

    const merchantHtml = dynoPayEmailTemplate(t('merchant.subscriptionPaymentFailed.merchHeading', ML), merchantContent, true, t('merchant.subscriptionPaymentFailed.merchCta', ML), `${FRONTEND_BASE_URL}/dashboard`);
    await mailTransporter({ to: merchantEmail, name: merchantName, subject: merchantSubject, body: merchantHtml });
    apiLogger.info(`[Email] Subscription payment failed notifications sent for ${planName}`);
  } catch (e) {
    apiLogger.error("Subscription payment failed email error:", e);
  }
};

// ============================================================
// SECTION 12B: ADMIN — NEW USER REGISTRATION NOTIFICATION
// ============================================================

