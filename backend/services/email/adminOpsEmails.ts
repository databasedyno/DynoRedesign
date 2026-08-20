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
        ${dataRow(t('merchant.labels.crypto', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`)}
        ${customerEmail ? dataRow(t('labels.customer', L), customerEmail) : ''}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#12B76A')}
    ${p(t('merchant.largeTransaction.outro1', L))}
    ${p(t('merchant.largeTransaction.outro2', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.largeTransaction.heading', L), content, true, t('merchant.largeTransaction.cta', L), `${FRONTEND_BASE_URL}/transactions`);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Large transaction alert sent to ${email} - ${amount} ${currency}`);
  } catch (e) {
    apiLogger.error("Large transaction alert email error:", e);
  }
};

/**
 * Webhook Auto-Disabled Alert (session 49)
 *
 * Fired when the circuit-breaker in utils/webhookRetry.ts trips after N
 * consecutive DLQ hits on the same (company, webhook_url) inside a 24h
 * rolling window. Tells the merchant their endpoint is broken, quotes the
 * last error, and links to the webhook settings so they can fix and
 * re-enable it.
 */
export const sendWebhookDisabledEmail = async (
  email: string,
  name: string,
  companyName: string,
  webhookUrl: string,
  eventType: string,
  lastError: string,
  failureCount: number,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = `⚠️ Webhook auto-disabled for ${companyName || 'your company'} — Dynopay`;
    const displayUrl = String(webhookUrl || '').length > 80 ? String(webhookUrl).substring(0, 77) + '…' : String(webhookUrl || '(none)');

    const message = `
      ${p(name ? `Hey ${escapeHtml(name)},` : `Hey there,`)}
      ${p(`We had to temporarily <strong>disable webhook delivery</strong> for <strong>${escapeHtml(companyName || 'your company')}</strong> because your endpoint has failed <strong>${failureCount} consecutive delivery attempts</strong> in the past 24 hours.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Endpoint', `<span style="font-family:monospace;font-size:13px;">${escapeHtml(displayUrl)}</span>`)}
          ${dataRow('Last event type', escapeHtml(eventType || 'unknown'))}
          ${dataRow('Last error', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(lastError)}</span>`)}
          ${dataRow('Consecutive failures', String(failureCount), true)}
        </table>
      `, '#f59e0b')}
      ${p(`<strong>What you need to do:</strong>`)}
      ${p(`1. Verify the URL is correct and reachable from the public internet.<br>2. Confirm your endpoint returns HTTP 2xx within 10 seconds.<br>3. Re-enable delivery from the <a href="${escapeHtml(FRONTEND_BASE_URL)}/settings/webhooks" style="color:#05936A;font-weight:600;">webhook settings page</a>.`)}
      ${p(`No payments were lost — every attempt was captured in your <a href="${escapeHtml(FRONTEND_BASE_URL)}/settings/webhooks" style="color:#05936A;">webhook delivery log</a> and can be re-fired once your endpoint is healthy again.`)}
      ${p(`If you don't recognize this endpoint or believe this is a mistake, please reply to this email and we'll investigate immediately.`)}
    `;

    const html = dynoPayGreetingTemplate(name || 'there', message, `Webhook auto-disabled`, false);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Webhook auto-disabled alert sent to ${email} (company="${companyName}" url="${displayUrl}" failures=${failureCount})`);
  } catch (e) {
    apiLogger.error("sendWebhookDisabledEmail error:", e);
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
      ${infoBox(detailContent, '#12B76A')}
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
      `, EMAIL_TOKENS.brand)}
      ${p(`The admin fees have been transferred to the admin ${currency} wallet. You can verify the transaction on the blockchain explorer.`)}`;

    const htmlBody = dynoPayEmailTemplate("Admin Fee Sweep Completed", `${p(`Hey Dynopay Admin,`)}\n${htmlContent}`);
    const info = await mailTransporter({
      to: recipientEmail,
      name: "Dynopay Admin",
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

