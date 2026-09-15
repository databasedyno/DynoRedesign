import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { t, normalizeLang, resolveEmailLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail } from "./emailShared";
import { toFixedStr } from "../../utils/money";
import { PaymentMoneyPath, renderMoneyPath } from "./paymentSettled";
import { getCoinSymbol } from "../../utils/networkLabels";
export type { PaymentMoneyPath } from "./paymentSettled";

/**
 * Template 6: Payment Received / Payment settled
 * Unified version - date/time optional for backwards compatibility.
 * When `moneyPath` is given the email becomes "Payment settled" and shows the
 * full money path (gross → fee → network fee → net forwarded → destination).
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
  referralCreditAppliedUsd: number = 0,
  paymentSourceKey?: string,
  moneyPath?: PaymentMoneyPath | null
) => {
  try {
    const L = normalizeLang(lang);
    const isContribution = !!(campaignName && campaignName.trim());
    const settled = !!moneyPath;
    const subject = settled
      ? t('paymentSettled.subject', L, { amount, currency, companyName })
      : isContribution
        ? t('contributionReceived.subject', L, { amount, currency, campaignName })
        : t('paymentReceived.subject', L, { amount, currency });
    const dateTimeStr = date && time ? `${date} at ${time}` : new Date().toLocaleString(L === 'en' ? 'en-GB' : L);
    const txLink = settled && moneyPath?.txRowId
      ? `${FRONTEND_BASE_URL}/transactions?tx=${encodeURIComponent(String(moneyPath.txRowId))}`
      : `${FRONTEND_BASE_URL}/transactions`;

    const legacyBox = infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
        ${paymentSourceKey ? dataRow(t('labels.paymentMethod', L), t('paymentSource.' + paymentSourceKey, L)) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.received', L), 'success'))}
        ${dataRow(t('labels.date', L), dateTimeStr)}
        ${dataRow(t('labels.transactionId', L), `<span style="font-size: 12px; font-family: monospace;">${transactionId}</span>`, true)}
      </table>
    `, '#12B76A');

    const intro = settled
      ? t(moneyPath?.belowMinimum ? 'paymentSettled.introBelowMinimum' : (moneyPath?.forwardTxHash || moneyPath?.autoConvertTarget) ? 'paymentSettled.intro' : 'paymentSettled.introForwarding', L, { companyName: escapeHtml(companyName) })
      : isContribution
        ? t('contributionReceived.intro', L, { campaignName })
        : t('paymentReceived.intro', L, { companyName });
    const outro = settled
      ? t('paymentSettled.nothingToDo', L)
      : isContribution ? t('contributionReceived.outro', L) : t('paymentReceived.outro', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(intro)}
    ${settled && isContribution ? p(t('contributionReceived.intro', L, { campaignName })) : ''}
    ${settled && moneyPath ? renderMoneyPath(L, { ...moneyPath, paidFor: moneyPath.paidFor ?? campaignName ?? null }) : legacyBox}
    ${Number(referralCreditAppliedUsd) > 0
        ? p(t('paymentReceived.referralCredit', L, { amount: `$${toFixedStr(referralCreditAppliedUsd, 2)}` }))
        : ''}
    ${p(outro)}`;

    const heading = settled ? t('paymentSettled.heading', L) : isContribution ? t('contributionReceived.heading', L) : t('paymentReceived.heading', L);
    const cta = settled ? t('paymentSettled.cta', L) : isContribution ? t('contributionReceived.cta', L) : t('paymentReceived.cta', L);
    const preheader = settled
      ? moneyPath?.belowMinimum
        ? t('paymentSettled.preheaderBelowMinimum', L, { amount, currency })
        : t('paymentSettled.preheader', L, { net: moneyPath?.netCrypto ?? cryptoAmount ?? amount, asset: getCoinSymbol(moneyPath?.autoConvertTarget ?? moneyPath?.asset ?? currency) })
      : isContribution ? t('contributionReceived.preheader', L) : t('paymentReceived.preheader', L);
    const html = dynoPayEmailTemplate(heading, content, true, cta, txLink, preheader, L, 'check');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`${settled ? 'Payment settled' : isContribution ? 'Contribution' : 'Payment'} received email sent to ${email}`);
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
    const subject = t('paymentPending.subject', L, { amount, currency, companyName });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('paymentPending.intro', L, { amount, currency, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.awaitingConfirmation', L), 'pending'))}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#f59e0b')}
    ${p(t('paymentPending.outro', L))}`;

    const html = dynoPayEmailTemplate(t('paymentPending.heading', L), content, true, t('paymentReceived.cta', L), `${FRONTEND_BASE_URL}/transactions`, t('paymentPending.preheader', L), L, 'hourglass');
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="hl-box" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid ${EMAIL_TOKENS.brand}; margin: 24px 0;">
        <tr><td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.amount', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 16px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${amount} ${currency}</td></tr>
            ${cryptoAmount && cryptoCurrency ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.cryptoAmount', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${t('labels.confirmations', L)}</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${t('paymentConfirming.confirmationsOf', L, { current: currentConfirmations, required: requiredConfirmations })}</td></tr>
            <tr><td colspan="2" style="padding: 12px 0 4px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="track" style="background: #e5e7eb; border-radius: 4px; height: 8px;">
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

    const html = dynoPayEmailTemplate(t('paymentConfirming.heading', L), htmlContent, true, t('paymentReceived.cta', L), `${FRONTEND_BASE_URL}/transactions`, t('paymentConfirming.preheader', L), L, 'hourglass');
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentConfirmingEmail' });
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
    const subject = t('paymentPartial.subject', L, { received: receivedAmount, expected: expectedAmount, currency });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('paymentPartial.intro', L, { received: receivedAmount, expected: expectedAmount, currency, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.expectedAmount', L), `${expectedAmount} ${currency}`)}
        ${dataRow(t('labels.received', L), `<strong style="color: #166534;">${receivedAmount} ${currency}</strong>`)}
        ${dataRow(t('labels.remaining', L), `<strong style="color: #dc2626;">${remainingAmount} ${currency}</strong>`)}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#f59e0b')}
    ${p(t('paymentPartial.windowNote', L, { minutes: gracePeriodMinutes, remaining: remainingAmount, currency }))}`;

    const html = dynoPayEmailTemplate(t('paymentPartial.heading', L), content, true, t('paymentReceived.cta', L), `${FRONTEND_BASE_URL}/transactions`, t('paymentPartial.preheader', L), L, 'alert');
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentPartialEmail' });
  }
};

/**
 * Buyer "you're almost there" nudge — sent to the CUSTOMER when their payment
 * is underpaid and the deposit address is still open during the grace period.
 * Distinct from sendPaymentPartialEmail (which notifies the MERCHANT).
 */
export const sendBuyerUnderpaidNudgeEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  remainingAmount: string,
  currency: string,
  checkoutUrl: string,
  gracePeriodMinutes: number = 30,
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('buyerUnderpaid.subject', L, { remaining: remainingAmount, currency });

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('buyerUnderpaid.intro', L, { received: receivedAmount, expected: expectedAmount, currency, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.expectedAmount', L), `${expectedAmount} ${currency}`)}
        ${dataRow(t('labels.received', L), `<strong style="color: #166534;">${receivedAmount} ${currency}</strong>`)}
        ${dataRow(t('labels.remaining', L), `<strong style="color: #dc2626;">${remainingAmount} ${currency}</strong>`, true)}
      </table>
    `, '#f97316')}
    ${p(t('buyerUnderpaid.windowNote', L, { minutes: gracePeriodMinutes, remaining: remainingAmount, currency }))}`;

    const ctaUrl = checkoutUrl && /^https?:\/\//i.test(checkoutUrl) ? checkoutUrl : `${FRONTEND_BASE_URL}`;
    const html = dynoPayEmailTemplate(t('buyerUnderpaid.heading', L), content, true, t('buyerUnderpaid.cta', L), ctaUrl, t('buyerUnderpaid.preheader', L), L, 'alert');
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendBuyerUnderpaidNudgeEmail' });
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

    const html = dynoPayEmailTemplate(heading, content, true, t('paymentReceived.cta', L), `${FRONTEND_BASE_URL}/transactions`, isCompleted ? t('paymentPartialExpired.preheaderCompleted', L) : t('paymentPartialExpired.preheaderExpired', L), L, 'expired');
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentPartialExpiredEmail' });
  }
};


/**
 * Merchant daily underpaid digest — a once-a-day roundup of payments that came
 * up short in the last 24h so merchants can chase shortfalls. Only sent when
 * there is at least one underpaid payment (caller guarantees non-empty rows).
 */
export const sendMerchantUnderpaidDigestEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  rows: Array<{
    reference: string;
    received: string;
    expected: string;
    remaining: string;
    currency: string;
    baseAmount?: string | null;
    baseCurrency?: string | null;
  }>,
  totalCount: number,
  transactionsUrl: string,
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const subject = t('underpaidDigest.subject', L, { count: totalCount });

    const headerCells = [
      t('underpaidDigest.colPayment', L),
      t('underpaidDigest.colReceived', L),
      t('underpaidDigest.colRemaining', L),
    ];
    const headerRow = `<tr>${headerCells
      .map((h, i) => `<th style="text-align:${i === 0 ? 'left' : 'right'}; padding:8px 10px; font-size:12px; color:#6b7280; border-bottom:1px solid #e5e7eb; font-weight:600;">${escapeHtml(h)}</th>`)
      .join('')}</tr>`;

    const bodyRows = rows
      .map((r) => {
        const base = r.baseAmount && r.baseCurrency
          ? `<div style="font-size:11px; color:#9ca3af;">${escapeHtml(r.baseAmount)} ${escapeHtml(r.baseCurrency)}</div>`
          : '';
        return `<tr>
          <td style="padding:8px 10px; font-size:12px; border-bottom:1px solid #f3f4f6;"><span style="font-family:monospace; word-break:break-all;">${escapeHtml(r.reference)}</span>${base}</td>
          <td style="padding:8px 10px; font-size:12px; text-align:right; border-bottom:1px solid #f3f4f6;">${escapeHtml(r.received)} / ${escapeHtml(r.expected)} ${escapeHtml(r.currency)}</td>
          <td style="padding:8px 10px; font-size:12px; text-align:right; border-bottom:1px solid #f3f4f6; color:#c2410c; font-weight:700;">${escapeHtml(r.remaining)} ${escapeHtml(r.currency)}</td>
        </tr>`;
      })
      .join('');

    const moreNote = totalCount > rows.length
      ? p(t('underpaidDigest.moreNote', L, { extra: totalCount - rows.length }))
      : '';

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('underpaidDigest.intro', L, { count: totalCount, companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${headerRow}
        ${bodyRows}
      </table>
    `, '#f97316')}
    ${moreNote}
    ${p(t('underpaidDigest.outro', L))}`;

    const html = dynoPayEmailTemplate(t('underpaidDigest.heading', L), content, true, t('underpaidDigest.cta', L), transactionsUrl, t('underpaidDigest.preheader', L, { count: totalCount }), L, 'alert');
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: html });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendMerchantUnderpaidDigestEmail' });
  }
};


export { sendCustomerPaymentConfirmationEmail } from "./customerReceiptEmail";
