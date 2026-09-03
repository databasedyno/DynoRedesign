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
import { toFixedStr } from "../../utils/money";

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
  cryptoCurrency?: string,
  campaignName?: string,
  referralCreditAppliedUsd: number = 0
) => {
  try {
    const L = normalizeLang(lang);
    const isContribution = !!(campaignName && campaignName.trim());
    const subject = isContribution
      ? t('contributionReceived.subject', L, { amount, currency, campaignName })
      : t('paymentReceived.subject', L, { amount, currency });
    const dateTimeStr = date && time ? `${date} at ${time}` : new Date().toLocaleString(L === 'en' ? 'en-GB' : L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(
      isContribution
        ? t('contributionReceived.intro', L, { campaignName })
        : t('paymentReceived.intro', L, { companyName })
    )}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.received', L), 'success'))}
        ${dataRow(t('labels.date', L), dateTimeStr)}
        ${dataRow(t('labels.transactionId', L), `<span style="font-size: 12px; font-family: monospace;">${transactionId}</span>`, true)}
      </table>
    `, '#12B76A')}
    ${Number(referralCreditAppliedUsd) > 0
        ? p(t('paymentReceived.referralCredit', L, { amount: `$${toFixedStr(referralCreditAppliedUsd, 2)}` }))
        : ''}
    ${p(
      isContribution
        ? t('contributionReceived.outro', L)
        : t('paymentReceived.outro', L)
    )}`;

    const html = dynoPayEmailTemplate(
      isContribution ? t('contributionReceived.heading', L) : t('paymentReceived.heading', L),
      content,
      true,
      isContribution ? t('contributionReceived.cta', L) : t('paymentReceived.cta', L),
      `${FRONTEND_BASE_URL}/transactions`
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`${isContribution ? 'Contribution' : 'Payment'} received email sent to ${email}`);
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
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid ${EMAIL_TOKENS.brand}; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.amount', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            ${cryptoAmount && cryptoCurrency ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.cryptoAmount', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.confirmations', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${t('paymentConfirming.confirmationsOf', L, { current: currentConfirmations, required: requiredConfirmations })}</td></tr>
            <tr><td colspan="2" style="padding: 12px 0 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #e5e7eb; border-radius: 4px; height: 8px;">
                <tr><td style="width: ${progressPct}%; background: ${isComplete ? '#12B76A' : EMAIL_TOKENS.brand}; border-radius: 4px; height: 8px;">&nbsp;</td><td style="height: 8px;">&nbsp;</td></tr>
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
    const borderColor = isCompleted ? '#12B76A' : '#f59e0b';
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
    const hasRealName = !!(customerName && customerName.trim() && !customerName.includes('@'));
    const displayName = hasRealName ? customerName.trim() : (customerEmail ? customerEmail.split('@')[0] : '');
    const CL = normalizeLang(customerLang);

    const reasonKey = `paymentFailed.reason${reason.charAt(0).toUpperCase() + reason.slice(1)}`;
    const reasonVars = { paidAmount, currency, amount };
    const reasonMessage = t(reasonKey, CL, reasonVars);

    const subject = reason === 'underpaid'
      ? t('paymentFailed.subjectUnderpaid', CL, { paidAmount, amount, currency })
      : t('paymentFailed.subject', CL, { companyName });

    const customerContent = `${p(hasRealName ? t('common.greeting', CL, { name: displayName }) : t('common.greetingDefault', CL))}
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

      const merchantHtml = dynoPayEmailTemplate(t('paymentFailed.merchantHeading', ML), merchantContent, true, t('paymentFailed.cta', ML), `${FRONTEND_BASE_URL}/transactions`);
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
  lang: string = 'en',
  campaignName?: string
) => {
  try {
    const L = normalizeLang(lang);
    const hasRealName = !!(customerName && customerName.trim() && !customerName.includes('@'));
    const displayName = hasRealName ? customerName.trim() : (customerEmail ? customerEmail.split('@')[0] : '');
    const isContribution = !!(campaignName && campaignName.trim());
    const subject = isContribution
      ? t('contributionThankYou.subject', L, { campaignName })
      : t('customerPaymentConfirmation.subject', L, { companyName });

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

    const content = `${p(hasRealName ? t('common.greeting', L, { name: displayName }) : t('common.greetingNoName', L))}
    ${p(
      isContribution
        ? t('contributionThankYou.intro', L, { campaignName })
        : t('customerPaymentConfirmation.intro', L, { companyName })
    )}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.complete', L), 'success'))}
        ${dataRow(t('labels.amountPaid', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`)}
        ${transactionReference ? dataRow(t('labels.reference', L), transactionReference) : ''}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `, '#12B76A')}
    ${pdfAttachment ? p(t('customerPaymentConfirmation.pdfAttached', L)) : ''}
    ${p(
      isContribution
        ? t('contributionThankYou.contact', L, { campaignName })
        : t('customerPaymentConfirmation.contact', L, { companyName })
    )}
    ${isContribution ? p(t('contributionThankYou.outro', L)) : ''}
    ${p(`<span style="font-size: 13px; color: #6b7280;">${t('common.securedBy', L)}</span>`)}`;

    const html = dynoPayEmailTemplate(
      isContribution
        ? t('contributionThankYou.heading', L, { campaignName })
        : t('customerPaymentConfirmation.heading', L),
      content
    );
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html, attachments: pdfAttachment ? [pdfAttachment] : undefined });
    apiLogger.info(`[Email] Customer payment confirmation sent to ${customerEmail} for ${amount} ${currency}${pdfAttachment ? ' with PDF receipt' : ''}`);
  } catch (e) {
    apiLogger.error("Customer payment confirmation email error:", e);
  }
};

