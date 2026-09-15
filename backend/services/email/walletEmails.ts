import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { emailDateParts, t, normalizeLang, resolveEmailLang, firstNameOnly } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, formatMoneyForEmail, sendEmail, brandSubject } from "./emailShared";
import { assetNetworkLabel } from "../../utils/networkLabels";
import { explorerTxUrl } from "../receiptLinkService";
import { sendStepUpCodeEmail } from "./securityEmails";

export const sendWalletBatchSummaryEmail = async (
  email: string,
  name: string,
  changes: { companyName?: string | null; added?: string[]; updated?: string[]; removed?: string[] },
  _lang?: string
) => {
  try {
    const list = (arr?: string[]) => (arr && arr.length ? arr.map(escapeHtml).join(", ") : "");
    const rows: string[] = [];
    if (changes.added?.length) rows.push(dataRow("Added", list(changes.added)));
    if (changes.updated?.length) rows.push(dataRow("Updated", list(changes.updated)));
    if (changes.removed?.length) rows.push(dataRow("Removed", list(changes.removed), true));
    const subject = brandSubject(changes.companyName, "Your payout wallets were updated");
    const content = `${p(name ? `Hey ${escapeHtml(firstNameOnly(name))},` : "Hey there,")}
    ${p(`Your payout wallets for ${escapeHtml(changes.companyName || "your brand")} were just updated.`)}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`)}
    ${warnText("If you didn't make these changes, contact support immediately.")}`;
    const html = dynoPayEmailTemplate(subject, content, true, "View payout wallets", `${FRONTEND_BASE_URL}/wallet`, "A summary of the payout wallet changes you just made.", undefined, 'wallet');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet batch summary email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet batch summary email error:", e);
  }
};


/**
 * Template 27: Wallet Deleted
 */
export const sendWalletDeletedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  date: string,
  time: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.walletDeleted.subject', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletDeleted.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.address', L), walletAddressMasked)}
        ${dataRow(t('merchant.labels.network', L), assetNetworkLabel(network))}
        ${dataRow(t('merchant.labels.removed', L), `${date} · ${time}`, true)}
      </table>
    `, '#ef4444')}
    ${p(t('merchant.walletDeleted.outro', L))}
    ${p(t('merchant.walletDeleted.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletDeleted.heading', L), content, true, t('merchant.walletDeleted.cta', L), `${FRONTEND_BASE_URL}/wallet`, "", L, 'wallet-red');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Wallet deleted notification sent to ${email} for ${network}`);
  } catch (e) {
    apiLogger.error("Wallet deleted email error:", e);
  }
};

/**
 * Template 7: Add Wallet Reminder
 */
export const sendAddWalletReminderEmail = async (
  email: string,
  name: string,
  companyName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = brandSubject(companyName, t('merchant.addWalletReminder.subject', L));
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.addWalletReminder.intro', L, { companyName }))}
    ${infoBox(`
      <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.addWalletReminder.whyTitle', L)}</p>
      <p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t('merchant.addWalletReminder.whyText', L)}</p>
    `)}
    ${p(t('merchant.addWalletReminder.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.addWalletReminder.heading', L), content, true, t('merchant.addWalletReminder.cta', L), `${FRONTEND_BASE_URL}/wallet`, "", L, 'wallet');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Add wallet reminder email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Add wallet reminder email error:", e);
  }
};

/**
 * Wallet Added Confirmation
 * Sent when a new payout wallet is successfully verified and added
 */
export const sendWalletAddedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  companyName: string,
  walletName?: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = brandSubject(companyName, t('merchant.walletAdded.subject', L, { network }));
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletAdded.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.address', L), `<span style="font-family: monospace; font-size: 13px;">${walletAddressMasked}</span>`)}
        ${dataRow(t('merchant.labels.network', L), assetNetworkLabel(network))}
        ${walletName ? dataRow(t('merchant.labels.walletName', L), walletName) : ''}
        ${dataRow(t('labels.status', L), statusBadge(t('merchant.badges.active', L), 'success'), true)}
      </table>
    `, '#12B76A')}
    ${p(t('merchant.walletAdded.outro', L, { network }))}
    ${warnText(t('merchant.walletAdded.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletAdded.heading', L), content, true, t('merchant.walletAdded.cta', L), `${FRONTEND_BASE_URL}/wallet`, "", L, 'wallet-green');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet added email sent to ${email} for ${network}`);
  } catch (e) {
    apiLogger.error("Wallet added email error:", e);
  }
};

/**
 * Wallet Updated Confirmation
 * Sent when a wallet address is successfully changed
 */
export const sendWalletUpdatedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  companyName: string,
  walletName?: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = brandSubject(companyName, t('merchant.walletUpdated.subject', L, { network }));
    const now = new Date();
    const { date: dateStr, time: timeStr } = emailDateParts(now);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.walletUpdated.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('merchant.labels.newAddress', L), `<span style="font-family: monospace; font-size: 13px;">${walletAddressMasked}</span>`)}
        ${dataRow(t('merchant.labels.network', L), assetNetworkLabel(network))}
        ${walletName ? dataRow(t('merchant.labels.walletName', L), walletName) : ''}
        ${dataRow(t('merchant.labels.updated', L), `${dateStr} · ${timeStr}`, true)}
      </table>
    `, '#f59e0b')}
    ${p(t('merchant.walletUpdated.outro', L, { network }))}
    ${warnText(t('merchant.walletUpdated.didntDoThis', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.walletUpdated.heading', L), content, true, t('merchant.walletUpdated.cta', L), `${FRONTEND_BASE_URL}/wallet`, "", L, 'wallet');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Wallet updated email sent to ${email} for ${network}`);
  } catch (e) {
    apiLogger.error("Wallet updated email error:", e);
  }
};

export const sendWithdrawalSuccessEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  destinationAddress: string,
  transactionReference: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t('merchant.withdrawalSuccess.subject', L, { amount, currency });
    const now = new Date();
    const { date: dateStr, time: timeStr } = emailDateParts(now);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.withdrawalSuccess.intro', L, { amount, currency }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.amount', L), `<strong>${formatMoneyForEmail(amount, currency)} ${currency}</strong>`)}
        ${dataRow(t('labels.status', L), statusBadge(t('merchant.badges.inProgress', L), 'pending'))}
        ${dataRow(t('merchant.labels.toAddress', L), `<span style="font-family: monospace; font-size: 13px;">${destinationAddress}</span>`)}
        ${dataRow(t('labels.reference', L), (() => { const x = explorerTxUrl(currency, transactionReference); return x ? `<a href="${x}" style="font-family: monospace; font-size: 12px; color: #4F46E5; word-break: break-all; text-decoration: underline;" target="_blank" rel="noopener">${transactionReference}</a>` : `<span style="font-family: monospace; font-size: 13px; word-break: break-all;">${transactionReference}</span>`; })())}
        ${dataRow(t('labels.network', L), assetNetworkLabel(currency))}
        ${dataRow(t('labels.date', L), `${dateStr} · ${timeStr}`, true)}
      </table>
    `, EMAIL_TOKENS.brand)}
    ${p(t('merchant.withdrawalSuccess.outro1', L))}
    ${p(t('merchant.withdrawalSuccess.outro2', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.withdrawalSuccess.heading', L), content, true, t('merchant.withdrawalSuccess.cta', L), `${FRONTEND_BASE_URL}/payouts`, "", L, 'payout');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Withdrawal success email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Withdrawal success email error:", e);
  }
};

// ── Wallet OTP family → ONE template (Wave 4d): the step-up security code email.
// Thin wrappers keep the historical call sites; the address/amount context now
// lives in the UI that asked for the code, not in the email.
export const sendWalletUpdateOTPEmail = (email: string, name: string, otpCode: string, _oldMasked?: string, _newMasked?: string, _network?: string, lang?: string) =>
  sendStepUpCodeEmail(email, name, otpCode, "wallet", lang);
export const sendWalletDeleteOTPEmail = (email: string, name: string, otpCode: string, _masked?: string, _network?: string, lang?: string) =>
  sendStepUpCodeEmail(email, name, otpCode, "wallet", lang);
export const sendWithdrawalOTPEmail = (email: string, name: string, otpCode: string, _amount?: string, _currency?: string, _address?: string, lang?: string) =>
  sendStepUpCodeEmail(email, name, otpCode, "withdrawal", lang);
export const sendExchangeOTPEmail = (email: string, name: string, otpCode: string, _amount?: string, _from?: string, _to?: string, _counterparty?: string, lang?: string) =>
  sendStepUpCodeEmail(email, name, otpCode, "exchange", lang);
