import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang, resolveEmailLang, firstNameOnly } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, formatMoneyForEmail, sendEmail } from "./emailShared";
import { toFixedStr } from "../../utils/money";
import { isPlaceholderBuyerEmail } from "../../utils/transactionSource";

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
        ${dataRow(t('labels.customer', L), isPlaceholderBuyerEmail(customerEmail) ? 'No email provided' : escapeHtml(String(customerEmail)))}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`, true)}
      </table>
    `, '#12B76A')}
    ${p(t('merchant.largeTransaction.outro1', L))}
    ${p(t('merchant.largeTransaction.outro2', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.largeTransaction.heading', L), content, true, t('merchant.largeTransaction.cta', L), `${FRONTEND_BASE_URL}/transactions`, "", L, 'alert');
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
    const subject = `Action needed – webhook delivery paused for ${companyName || 'your company'}`;
    const displayUrl = String(webhookUrl || '').length > 80 ? String(webhookUrl).substring(0, 77) + '…' : String(webhookUrl || '(none)');

    const message = `
      ${p(name ? `Hey ${escapeHtml(firstNameOnly(name))},` : `Hey there,`)}
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

    const html = dynoPayGreetingTemplate(name || 'there', message, `Webhook auto-disabled`, false, undefined, `We paused webhook delivery after ${failureCount} failed attempts — action needed.`, 'webhook');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Webhook auto-disabled alert sent to ${email} (company="${companyName}" url="${displayUrl}" failures=${failureCount})`);
  } catch (e) {
    apiLogger.error("sendWebhookDisabledEmail error:", e);
  }
};

/**
 * Webhook Redirect Notice
 *
 * Fired the first time we detect a merchant's CONFIGURED webhook endpoint
 * responding with a 3xx redirect (e.g. 308 apex → www). We now safely follow
 * the redirect (after re-running the SSRF guard on the target) so delivery
 * succeeds, but the extra hop adds latency and is fragile — so we nudge the
 * merchant to point their webhook URL straight at the final address. Throttled
 * to one email per (url → target) pair per 7 days in the caller.
 */
export const sendWebhookRedirectEmail = async (
  email: string,
  name: string,
  companyName: string,
  originalUrl: string,
  finalUrl: string,
  status: number,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = `Heads up – your webhook URL redirects (${companyName || 'your company'})`;
    const clip = (u: string) => (String(u || '').length > 90 ? String(u).substring(0, 87) + '…' : String(u || '(none)'));
    const fromUrl = clip(originalUrl);
    const toUrl = clip(finalUrl);

    const message = `
      ${p(name ? `Hey ${escapeHtml(firstNameOnly(name))},` : `Hey there,`)}
      ${p(`Your webhook endpoint for <strong>${escapeHtml(companyName || 'your company')}</strong> is responding with an <strong>HTTP ${status} redirect</strong>. Good news — we automatically follow it (after a security re-check), so <strong>your webhooks are being delivered</strong>. But the extra redirect hop adds latency and can break if the redirect ever changes.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Configured URL', `<span style="font-family:monospace;font-size:13px;">${escapeHtml(fromUrl)}</span>`)}
          ${dataRow('Redirects to', `<span style="font-family:monospace;font-size:13px;">${escapeHtml(toUrl)}</span>`)}
          ${dataRow('Redirect status', `HTTP ${status}`, true)}
        </table>
      `, '#f59e0b')}
      ${p(`<strong>Recommended:</strong> update your webhook URL to the final address above so delivery is direct and reliable. You can change it on the <a href="${escapeHtml(FRONTEND_BASE_URL)}/settings/webhooks" style="color:#05936A;font-weight:600;">webhook settings page</a>.`)}
      ${p(`Nothing is broken and no action is strictly required — this is just a recommendation to keep your integration fast and resilient.`)}
    `;

    const html = dynoPayGreetingTemplate(name || 'there', message, `Your webhook URL redirects`, false, undefined, `We're auto-following an HTTP ${status} redirect on your webhook — please update the URL.`, 'webhook');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Webhook redirect notice sent to ${email} (company="${companyName}" ${fromUrl} → ${toUrl} status=${status})`);
  } catch (e) {
    apiLogger.error("sendWebhookRedirectEmail error:", e);
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
    // Trim noisy DECIMAL(20,8) trailing zeros for display (e.g. 3.20000000 -> 3.20).
    // NOTE: these MUST be declared before `subject` (which uses feeFmt) — a prior
    // ordering bug referenced feeFmt before init (TDZ) and this email never sent.
    const feeFmt = formatMoneyForEmail(feeAmount, currency);
    const merchantFmt = formatMoneyForEmail(merchantAmount, currency);
    const totalFmt = formatMoneyForEmail(totalAmount, currency);

    const subject = `Platform fee received – ${feeFmt} ${currency}`;
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
          ${dataRow('Total Received', `<strong>${feeFmt} ${currency}</strong>`)}
          ${dataRow('Status', statusBadge('Under Threshold', 'pending'))}
          ${dataRow('Merchant Received', `${merchantFmt} ${currency}`)}
          ${dataRow('Platform Received', `<strong>${feeFmt} ${currency} (100%)</strong>`)}
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
          ${dataRow('Platform Fee', `<strong>${feeFmt} ${currency}</strong>`)}
          ${dataRow('Status', statusBadge('Processed', 'success'))}
          ${dataRow('Merchant Net', `${merchantFmt} ${currency}`)}
          ${dataRow('Total Processed', `${totalFmt} ${currency}`)}
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

    const htmlBody = dynoPayEmailTemplate("Platform Fee Received", `${p(`Hey ${firstNameOnly(name)},`)}\n${htmlContent}`, false, "", "", "", undefined, 'check');
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
    const sweptFmt = formatMoneyForEmail(amountSwept, currency);
    const subject = `Admin Fee Swept — ${sweptFmt} ${currency}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const sweepModeDisplay = sweepMode === 'threshold' ? 'USD Threshold' : sweepMode.startsWith('auto-convert') ? 'Auto-Convert (Direct Transfer)' : 'Time-Based';

    const htmlContent = `
      ${p(`Admin fees have been swept from a pool address to the admin wallet.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount Swept', `<strong style="color: #166534;">${sweptFmt} ${currency}</strong>`)}
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

    const htmlBody = dynoPayEmailTemplate("Admin Fee Sweep Completed", `${p(`Hey Dynopay Admin,`)}\n${htmlContent}`, false, "", "", "", undefined, 'payout');
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

/**
 * Treasury-Low Alert (admin/ops) — a payout/withdrawal could not be sent because
 * the Binance balance for the asset is too low. The payout WAITS for a top-up
 * (never failed). Throttled by utils/treasuryAlert.ts (once per asset per 3h).
 */
export const sendTreasuryLowAlertEmail = async (
  recipientEmail: string,
  asset: string,
  have: number,
  need: number,
  context: string
) => {
  try {
    const subject = `Low ${asset} treasury — top up Binance`;
    const shortfall = Math.max(0, need - have);
    const content = `
      ${p(`A payout could not be sent because the Binance <strong>${escapeHtml(asset)}</strong> balance is too low to cover it.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Asset', `<strong>${escapeHtml(asset)}</strong>`)}
          ${dataRow('Available', `${toFixedStr(have, 2)} ${escapeHtml(asset)}`)}
          ${dataRow('Required', `${toFixedStr(need, 2)} ${escapeHtml(asset)}`)}
          ${dataRow('Shortfall', `<strong style="color:#b91c1c;">${toFixedStr(shortfall, 2)} ${escapeHtml(asset)}</strong>`)}
          ${dataRow('Context', escapeHtml(context), true)}
        </table>
      `, '#f59e0b')}
      ${p(`The affected payout is <strong>safely waiting</strong> and will retry automatically once the Binance ${escapeHtml(asset)} balance is topped up. No funds were lost and nothing was marked failed.`)}
      ${p(`<strong>Action:</strong> top up the Binance ${escapeHtml(asset)} balance to at least ${toFixedStr(need, 2)} ${escapeHtml(asset)}.`)}`;

    const html = dynoPayEmailTemplate(`Low ${asset} treasury`, `${p(`Hey Dynopay Admin,`)}\n${content}`, false, "", "", "", undefined, 'danger');
    await mailTransporter({ to: recipientEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Treasury-low alert sent to ${recipientEmail} (${asset}: have ${have}, need ${need}, ${context})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendTreasuryLowAlertEmail' });
  }
};

// ============================================================
// SECTION 8: AUTO-CONVERSION EMAILS
// ============================================================

export interface ConversionFailedAdminData {
  conversionId: string;
  transactionId: string;
  companyId: string;
  companyName: string;
  merchantEmail: string;
  sourceAmount: string;
  sourceCurrency: string;
  sourceAmountUsd: string | null;
  targetCurrency: string;
  settlementChain: string;
  settlementWallet: string;
  depositTxHash: string;
  retryCount: number;
  reason: string;
  createdAt: string;
}

/**
 * Auto-conversion FAILED (admin/ops only). The merchant is NOT told — the
 * crypto sits in the Binance deposit wallet until ops settles it by hand.
 */
export const sendConversionFailedAdminEmail = async (recipientEmail: string, d: ConversionFailedAdminData) => {
  try {
    const amountLine = `${d.sourceAmount} ${d.sourceCurrency}${d.sourceAmountUsd ? ` (~$${d.sourceAmountUsd})` : ''}`;
    const subject = `Auto-convert failed — ${amountLine} held for ${d.companyName}`;
    const content = `
      ${p(`Auto-conversion <strong>#${escapeHtml(d.conversionId)}</strong> for <strong>${escapeHtml(d.companyName)}</strong> gave up. The crypto is parked in the Binance deposit wallet and will not move until you settle it manually. The merchant has <strong>not</strong> been notified.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount', `<strong>${escapeHtml(amountLine)}</strong>`)}
          ${dataRow('Target', `${escapeHtml(d.targetCurrency)}${d.settlementChain ? ` (${escapeHtml(d.settlementChain)})` : ''}`)}
          ${dataRow('Reason', `<span style="color:#b91c1c;">${escapeHtml(d.reason || 'Unknown')}</span>`)}
          ${dataRow('Retries', String(d.retryCount))}
          ${dataRow('Created', escapeHtml(d.createdAt))}
          ${dataRow('Merchant', `${escapeHtml(d.merchantEmail)} · company #${escapeHtml(d.companyId)}`)}
          ${d.settlementWallet ? dataRow('Payout wallet', mono(d.settlementWallet)) : ''}
          ${d.depositTxHash ? dataRow('Deposit tx', mono(d.depositTxHash)) : ''}
          ${d.transactionId ? dataRow('Payment tx', mono(d.transactionId)) : ''}
          ${dataRow('Conversion', mono(`#${d.conversionId}`), true)}
        </table>
      `, '#f59e0b')}
      ${p(`<strong>Action:</strong> check the Binance deposit for this coin, then either re-run the conversion (<code>POST /api/company/conversion/${escapeHtml(d.conversionId)}/retry</code>) or send the ${escapeHtml(d.sourceCurrency)} to the merchant in the original coin and mark the row COMPLETED.`)}`;

    const html = dynoPayEmailTemplate(`Auto-convert failed — #${d.conversionId}`, `${p(`Hey Dynopay Admin,`)}\n${content}`, false, "", "", "", undefined, 'danger');
    await mailTransporter({ to: recipientEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Conversion-failed admin alert sent to ${recipientEmail} (conversion #${d.conversionId}, ${amountLine})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendConversionFailedAdminEmail' });
  }
};

