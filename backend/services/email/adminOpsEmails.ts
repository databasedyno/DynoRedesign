import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { emailDateParts, t, resolveEmailLang, firstNameOnly } from "../../utils/emailI18n";
import { baseEmailTemplate, infoBox, dataRow, statusBadge, p, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatMoneyForEmail } from "./emailShared";
import { toFixedStr } from "../../utils/money";

const ak = (key: string) => `admin.${key}`;
const WEBHOOK_SETTINGS_URL = `${FRONTEND_BASE_URL}/developer-keys?tab=webhooks`;

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
    const company = escapeHtml(companyName || t(ak("webhookDisabled.companyFallback"), L));
    const subject = t(ak("webhookDisabled.subject"), L, { company: companyName || t(ak("webhookDisabled.companyFallback"), L) });
    const displayUrl = String(webhookUrl || '').length > 80 ? String(webhookUrl).substring(0, 77) + '…' : String(webhookUrl || '(none)');

    const message = `
      ${p(t(ak("webhookDisabled.intro"), L, { company, count: failureCount }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("webhookDisabled.endpointLabel"), L), `<span style="font-family:monospace;font-size:13px;">${escapeHtml(displayUrl)}</span>`)}
          ${dataRow(t(ak("webhookDisabled.lastEventLabel"), L), escapeHtml(eventType || t(ak("webhookDisabled.unknownEvent"), L)))}
          ${dataRow(t(ak("webhookDisabled.lastErrorLabel"), L), `<span style="font-family:monospace;font-size:12px;">${escapeHtml(lastError)}</span>`)}
          ${dataRow(t(ak("webhookDisabled.failuresLabel"), L), String(failureCount), true)}
        </table>
      `, '#f59e0b')}
      ${p(t(ak("webhookDisabled.whatToDoTitle"), L))}
      ${p(t(ak("webhookDisabled.steps"), L, { settingsUrl: escapeHtml(WEBHOOK_SETTINGS_URL) }))}
      ${p(t(ak("webhookDisabled.noLost"), L, { settingsUrl: escapeHtml(WEBHOOK_SETTINGS_URL) }))}
      ${p(t(ak("webhookDisabled.notRecognize"), L))}
    `;

    const html = dynoPayGreetingTemplate(name || 'there', message, t(ak("webhookDisabled.heading"), L), false, L, t(ak("webhookDisabled.preheader"), L, { count: failureCount }), 'webhook');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Webhook auto-disabled alert sent to ${email} (company="${companyName}" url="${displayUrl}" failures=${failureCount})`);
  } catch (e) {
    apiLogger.error("sendWebhookDisabledEmail error:", e);
  }
};

/**
 * Webhook Redirect Notice — fired when a merchant's configured endpoint responds
 * with a 3xx redirect. We follow it safely, but nudge them to point at the final URL.
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
    const company = escapeHtml(companyName || t(ak("webhookRedirect.companyFallback"), L));
    const subject = t(ak("webhookRedirect.subject"), L, { company: companyName || t(ak("webhookRedirect.companyFallback"), L) });
    const clip = (u: string) => (String(u || '').length > 90 ? String(u).substring(0, 87) + '…' : String(u || '(none)'));
    const fromUrl = clip(originalUrl);
    const toUrl = clip(finalUrl);

    const message = `
      ${p(t(ak("webhookRedirect.intro"), L, { company, status }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("webhookRedirect.configuredLabel"), L), `<span style="font-family:monospace;font-size:13px;">${escapeHtml(fromUrl)}</span>`)}
          ${dataRow(t(ak("webhookRedirect.redirectsToLabel"), L), `<span style="font-family:monospace;font-size:13px;">${escapeHtml(toUrl)}</span>`)}
          ${dataRow(t(ak("webhookRedirect.statusLabel"), L), `HTTP ${status}`, true)}
        </table>
      `, '#f59e0b')}
      ${p(t(ak("webhookRedirect.recommended"), L, { settingsUrl: escapeHtml(WEBHOOK_SETTINGS_URL) }))}
      ${p(t(ak("webhookRedirect.nothingBroken"), L))}
    `;

    const html = dynoPayGreetingTemplate(name || 'there', message, t(ak("webhookRedirect.heading"), L), false, L, t(ak("webhookRedirect.preheader"), L, { status }), 'webhook');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Webhook redirect notice sent to ${email} (company="${companyName}" ${fromUrl} → ${toUrl} status=${status})`);
  } catch (e) {
    apiLogger.error("sendWebhookRedirectEmail error:", e);
  }
};

/**
 * Admin Fee Received notification (ops).
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
    const L = await resolveEmailLang(undefined, recipientEmail);
    const feeFmt = formatMoneyForEmail(feeAmount, currency);
    const merchantFmt = formatMoneyForEmail(merchantAmount, currency);
    const totalFmt = formatMoneyForEmail(totalAmount, currency);

    const subject = t(ak("feeReceived.subject"), L, { fee: feeFmt, currency });
    const now = new Date();
    const { date: dateStr, time: timeStr } = emailDateParts(now, L);

    const merchantAmountNum = parseFloat(merchantAmount);
    const feeAmountNum = parseFloat(feeAmount);
    const totalAmountNum = parseFloat(totalAmount);
    const isUnderThreshold = merchantAmountNum === 0 && feeAmountNum === totalAmountNum;

    let detailContent: string;
    let noticeBlock = '';

    if (isUnderThreshold) {
      detailContent = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("feeReceived.totalReceivedLabel"), L), `<strong>${feeFmt} ${escapeHtml(currency)}</strong>`)}
          ${dataRow(t(ak("feeReceived.statusLabel"), L), statusBadge(t(ak("feeReceived.statusUnderThreshold"), L), 'pending'))}
          ${dataRow(t(ak("feeReceived.merchantReceivedLabel"), L), `${merchantFmt} ${escapeHtml(currency)}`)}
          ${dataRow(t(ak("feeReceived.platformReceivedLabel"), L), `<strong>${t(ak("feeReceived.platformReceivedValue"), L, { fee: feeFmt, currency })}</strong>`)}
          ${dataRow(t(ak("feeReceived.dateLabel"), L), `${dateStr} · ${timeStr}`)}
          ${dataRow(t(ak("feeReceived.companyLabel"), L), escapeHtml(companyName))}
          ${dataRow(t(ak("feeReceived.txLabel"), L), `<span style="font-family: monospace; font-size: 13px;">${escapeHtml(transactionId)}</span>`, true)}
        </table>`;
      noticeBlock = infoBox(`
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t(ak("feeReceived.underThresholdNote"), L, { currency })}</p>
      `, '#f59e0b');
    } else {
      detailContent = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("feeReceived.platformFeeLabel"), L), `<strong>${feeFmt} ${escapeHtml(currency)}</strong>`)}
          ${dataRow(t(ak("feeReceived.statusLabel"), L), statusBadge(t(ak("feeReceived.statusProcessed"), L), 'success'))}
          ${dataRow(t(ak("feeReceived.merchantNetLabel"), L), `${merchantFmt} ${escapeHtml(currency)}`)}
          ${dataRow(t(ak("feeReceived.totalProcessedLabel"), L), `${totalFmt} ${escapeHtml(currency)}`)}
          ${dataRow(t(ak("feeReceived.dateLabel"), L), `${dateStr} · ${timeStr}`)}
          ${dataRow(t(ak("feeReceived.companyLabel"), L), escapeHtml(companyName))}
          ${dataRow(t(ak("feeReceived.txLabel"), L), `<span style="font-family: monospace; font-size: 13px;">${escapeHtml(transactionId)}</span>`, true)}
        </table>`;
    }

    const htmlContent = `
      ${p(t(ak("feeReceived.intro"), L, { company: escapeHtml(companyName) }))}
      ${infoBox(detailContent, '#12B76A')}
      ${noticeBlock}
      ${p(t(ak("feeReceived.credited"), L, { currency }))}`;

    const htmlBody = dynoPayEmailTemplate(t(ak("feeReceived.heading"), L), `${p(`${firstNameOnly(name) ? `Hey ${escapeHtml(firstNameOnly(name))},` : t(ak("greeting"), L)}`)}\n${htmlContent}`, false, "", "", "", L, 'check', 'admin');
    const info = await mailTransporter({ to: recipientEmail, name, subject, body: htmlBody });
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendAdminFeeReceivedEmail' });
  }
};

/**
 * Admin Fee Sweep notification (ops).
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
    const L = await resolveEmailLang(undefined, recipientEmail);
    const sweptFmt = formatMoneyForEmail(amountSwept, currency);
    const subject = t(ak("feeSweep.subject"), L, { amount: sweptFmt, currency });
    const now = new Date();
    const { date: dateStr, time: timeStr } = emailDateParts(now, L);

    const sweepModeDisplay = sweepMode === 'threshold' ? t(ak("feeSweep.modeThreshold"), L) : sweepMode.startsWith('auto-convert') ? t(ak("feeSweep.modeAutoConvert"), L) : t(ak("feeSweep.modeTime"), L);

    const htmlContent = `
      ${p(t(ak("feeSweep.intro"), L))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("feeSweep.amountSweptLabel"), L), `<strong style="color: #166534;">${sweptFmt} ${escapeHtml(currency)}</strong>`)}
          ${dataRow(t(ak("feeSweep.statusLabel"), L), statusBadge(t(ak("feeSweep.statusSwept"), L), 'success'))}
          ${dataRow(t(ak("feeSweep.sweepModeLabel"), L), sweepModeDisplay)}
          ${dataRow(t(ak("feeSweep.gasUsedLabel"), L), escapeHtml(gasUsed))}
          ${dataRow(t(ak("feeSweep.fromLabel"), L), `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${escapeHtml(fromAddress)}</span>`)}
          ${dataRow(t(ak("feeSweep.toLabel"), L), `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${escapeHtml(toAddress)}</span>`)}
          ${dataRow(t(ak("feeSweep.dateLabel"), L), `${dateStr} · ${timeStr}`)}
          ${dataRow(t(ak("feeSweep.sweepTxLabel"), L), `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${escapeHtml(sweepTxId)}</span>`, true)}
        </table>
      `, EMAIL_TOKENS.brand)}
      ${p(t(ak("feeSweep.outro"), L, { currency }))}`;

    const htmlBody = dynoPayEmailTemplate(t(ak("feeSweep.heading"), L), `${p(t(ak("greeting"), L))}\n${htmlContent}`, false, "", "", "", L, 'payout', 'admin');
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
 * Treasury-Low Alert (admin/ops) — a payout could not be sent because the Binance
 * balance for the asset is too low. The payout WAITS for a top-up (never failed).
 */
export const sendTreasuryLowAlertEmail = async (
  recipientEmail: string,
  asset: string,
  have: number,
  need: number,
  context: string
) => {
  try {
    const L = await resolveEmailLang(undefined, recipientEmail);
    const subject = t(ak("treasuryLow.subject"), L, { asset });
    const shortfall = Math.max(0, need - have);
    const content = `
      ${p(t(ak("treasuryLow.intro"), L, { asset: escapeHtml(asset) }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("treasuryLow.assetLabel"), L), `<strong>${escapeHtml(asset)}</strong>`)}
          ${dataRow(t(ak("treasuryLow.availableLabel"), L), `${toFixedStr(have, 2)} ${escapeHtml(asset)}`)}
          ${dataRow(t(ak("treasuryLow.requiredLabel"), L), `${toFixedStr(need, 2)} ${escapeHtml(asset)}`)}
          ${dataRow(t(ak("treasuryLow.shortfallLabel"), L), `<strong style="color:#b91c1c;">${toFixedStr(shortfall, 2)} ${escapeHtml(asset)}</strong>`)}
          ${dataRow(t(ak("treasuryLow.contextLabel"), L), escapeHtml(context), true)}
        </table>
      `, '#f59e0b')}
      ${p(t(ak("treasuryLow.waiting"), L, { asset: escapeHtml(asset) }))}
      ${p(t(ak("treasuryLow.action"), L, { asset: escapeHtml(asset), need: toFixedStr(need, 2) }))}`;

    const html = dynoPayEmailTemplate(t(ak("treasuryLow.heading"), L, { asset: escapeHtml(asset) }), `${p(t(ak("greeting"), L))}\n${content}`, false, "", "", "", L, 'danger', 'admin');
    await mailTransporter({ to: recipientEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Treasury-low alert sent to ${recipientEmail} (${asset}: have ${have}, need ${need}, ${context})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendTreasuryLowAlertEmail' });
  }
};

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
    const L = await resolveEmailLang(undefined, recipientEmail);
    const amountLine = `${d.sourceAmount} ${d.sourceCurrency}${d.sourceAmountUsd ? ` (~$${d.sourceAmountUsd})` : ''}`;
    const subject = t(ak("conversionFailed.subject"), L, { amount: amountLine, company: d.companyName });
    const content = `
      ${p(t(ak("conversionFailed.intro"), L, { id: escapeHtml(d.conversionId), company: escapeHtml(d.companyName) }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(ak("conversionFailed.amountLabel"), L), `<strong>${escapeHtml(amountLine)}</strong>`)}
          ${dataRow(t(ak("conversionFailed.targetLabel"), L), `${escapeHtml(d.targetCurrency)}${d.settlementChain ? ` (${escapeHtml(d.settlementChain)})` : ''}`)}
          ${dataRow(t(ak("conversionFailed.reasonLabel"), L), `<span style="color:#b91c1c;">${escapeHtml(d.reason || t(ak("conversionFailed.reasonUnknown"), L))}</span>`)}
          ${dataRow(t(ak("conversionFailed.retriesLabel"), L), String(d.retryCount))}
          ${dataRow(t(ak("conversionFailed.createdLabel"), L), escapeHtml(d.createdAt))}
          ${dataRow(t(ak("conversionFailed.merchantLabel"), L), `${escapeHtml(d.merchantEmail)} · company #${escapeHtml(d.companyId)}`)}
          ${d.settlementWallet ? dataRow(t(ak("conversionFailed.payoutAddressLabel"), L), mono(escapeHtml(d.settlementWallet))) : ''}
          ${d.depositTxHash ? dataRow(t(ak("conversionFailed.depositTxLabel"), L), mono(escapeHtml(d.depositTxHash))) : ''}
          ${d.transactionId ? dataRow(t(ak("conversionFailed.paymentTxLabel"), L), mono(escapeHtml(d.transactionId))) : ''}
          ${dataRow(t(ak("conversionFailed.conversionLabel"), L), mono(`#${escapeHtml(d.conversionId)}`), true)}
        </table>
      `, '#f59e0b')}
      ${p(t(ak("conversionFailed.action"), L, { id: escapeHtml(d.conversionId), currency: escapeHtml(d.sourceCurrency) }))}`;

    const html = dynoPayEmailTemplate(t(ak("conversionFailed.heading"), L, { id: escapeHtml(d.conversionId) }), `${p(t(ak("greeting"), L))}\n${content}`, false, "", "", "", L, 'danger', 'admin');
    await mailTransporter({ to: recipientEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Conversion-failed admin alert sent to ${recipientEmail} (conversion #${d.conversionId}, ${amountLine})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendConversionFailedAdminEmail' });
  }
};
