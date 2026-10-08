import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { p, infoBox, dataRow, amountHero } from "../../utils/emailTemplate";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, greetingLine } from "./emailShared";
import { t, resolveEmailLang } from "../../utils/emailI18n";
import { toFixedStr } from "../../utils/money";

/**
 * Referral revenue-share emails (merchant-facing). Fully localized (6 languages)
 * via the referral.emails.* catalog. Friendly-professional voice; Provider: Brevo.
 * The recipient `email` is always the referrer's own Dynopay account, so the
 * language is resolved from their stored profile when no explicit `lang` is passed.
 */

const REFERRALS_URL = `${FRONTEND_BASE_URL}/referrals`;
const rk = (key: string) => `referral.emails.${key}`;

/** Balance crossed the cash-out minimum — nudge the referrer. */
export const sendReferralPayoutReadyEmail = async (
  email: string,
  name: string,
  unpaidUsd: number,
  mode: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const amount = `$${toFixedStr(unpaidUsd, 2)}`;
    const isCash = mode === "cash";
    const subject = t(rk("payoutReady.subject"), L, { amount });
    const content = `
      ${amountHero(amount, { pill: t(rk("payoutReady.heroPill"), L), pillType: "success", sublabel: t(rk("payoutReady.heroSub"), L) })}
      ${greetingLine(L, name)}
      ${p(t(rk("payoutReady.intro"), L, { amount }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("payoutReady.availableLabel"), L), `<strong style="color:#166534;">${amount}</strong>`, true)}
        </table>
      `)}
      ${p(t(rk(isCash ? "payoutReady.cashLine" : "payoutReady.creditLine"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("payoutReady.heading"), L), content, true, t(rk(isCash ? "payoutReady.ctaCash" : "payoutReady.ctaView"), L), REFERRALS_URL, t(rk("payoutReady.preheader"), L, { amount }), L, 'gift');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral payout-ready nudge sent to ${email} (${amount}, mode=${mode})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralPayoutReadyEmail' });
  }
};

/** Confirmation that auto cash-out was turned on. */
export const sendReferralAutoPayEnabledEmail = async (
  email: string,
  name: string,
  autoMinUsd: number,
  addressMasked: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const min = `$${toFixedStr(autoMinUsd, 2)}`;
    const subject = t(rk("autoPayEnabled.subject"), L);
    const content = `
      ${greetingLine(L, name)}
      ${p(t(rk("autoPayEnabled.intro"), L, { min }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("autoPayEnabled.autoPayAtLabel"), L), `<strong>${min}</strong>`)}
          ${dataRow(t(rk("autoPayEnabled.addressLabel"), L), `<span style="font-family:monospace;font-size:13px;">${escapeHtml(addressMasked)}</span>`, true)}
        </table>
      `)}
      ${p(t(rk("autoPayEnabled.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("autoPayEnabled.heading"), L), content, true, t(rk("autoPayEnabled.cta"), L), REFERRALS_URL, t(rk("autoPayEnabled.preheader"), L, { min }), L, 'gift');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral auto-pay enabled confirmation sent to ${email} (min=${min})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralAutoPayEnabledEmail' });
  }
};

/** A payout has been requested/queued (manual or auto). */
export const sendReferralPayoutRequestedEmail = async (
  email: string,
  name: string,
  amountUsd: number,
  addressMasked: string,
  viaAuto: boolean,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const amount = `$${toFixedStr(amountUsd, 2)}`;
    const subject = t(rk("payoutRequested.subject"), L, { amount });
    const content = `
      ${amountHero(amount, { pill: t(rk("payoutRequested.heroPill"), L), pillType: "info", sublabel: t(rk("payoutRequested.heroSub"), L) })}
      ${greetingLine(L, name)}
      ${p(t(rk(viaAuto ? "payoutRequested.introAuto" : "payoutRequested.introManual"), L, { amount }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("payoutRequested.amountLabel"), L), `<strong>${amount}</strong>`)}
          ${dataRow(t(rk("payoutRequested.addressLabel"), L), `<span style="font-family:monospace;font-size:13px;">${escapeHtml(addressMasked)}</span>`, true)}
        </table>
      `)}
      ${p(t(rk("payoutRequested.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("payoutRequested.heading"), L), content, true, t(rk("payoutRequested.cta"), L), REFERRALS_URL, t(rk("payoutRequested.preheader"), L, { amount }), L, 'payout');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral payout-requested sent to ${email} (${amount}, auto=${viaAuto})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralPayoutRequestedEmail' });
  }
};

/** A payout failed at the provider — reassure + let them retry. */
export const sendReferralPayoutFailedEmail = async (
  email: string,
  name: string,
  amountUsd: number,
  addressMasked: string,
  reason: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const amount = `$${toFixedStr(amountUsd, 2)}`;
    const subject = t(rk("payoutFailed.subject"), L, { amount });
    const content = `
      ${amountHero(amount, { pill: t(rk("payoutFailed.heroPill"), L), pillType: "error", sublabel: t(rk("payoutFailed.heroSub"), L) })}
      ${greetingLine(L, name)}
      ${p(t(rk("payoutFailed.intro"), L, { amount }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("payoutFailed.amountLabel"), L), `<strong>${amount}</strong>`)}
          ${dataRow(t(rk("payoutFailed.addressLabel"), L), `<span style="font-family:monospace;font-size:13px;">${escapeHtml(addressMasked)}</span>`)}
          ${dataRow(t(rk("payoutFailed.reasonLabel"), L), `<span style="font-family:monospace;font-size:12px;">${escapeHtml(reason)}</span>`, true)}
        </table>
      `)}
      ${p(t(rk("payoutFailed.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("payoutFailed.heading"), L), content, true, t(rk("payoutFailed.cta"), L), REFERRALS_URL, t(rk("payoutFailed.preheader"), L, { amount }), L, 'danger');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral payout-failed sent to ${email} (${amount}, reason="${reason}")`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralPayoutFailedEmail' });
  }
};

/** New commission accrued this cycle from a referred merchant's payment(s). */
export const sendReferralAccrualEmail = async (
  email: string,
  name: string,
  newCommissionUsd: number,
  merchantName: string,
  unpaidBalanceUsd: number,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const earned = `$${toFixedStr(newCommissionUsd, 2)}`;
    const balance = `$${toFixedStr(unpaidBalanceUsd, 2)}`;
    const merchantRaw = merchantName || t(rk("merchantFallback"), L);
    const merchant = escapeHtml(merchantRaw);
    const subject = t(rk("accrual.subject"), L, { amount: earned, merchant: merchantRaw });
    const content = `
      ${amountHero(`+${earned}`, { pill: t(rk("accrual.heroPill"), L), pillType: 'success', sublabel: t(rk("accrual.heroSub"), L, { merchant }) })}
      ${greetingLine(L, name)}
      ${p(t(rk("accrual.intro"), L, { amount: earned, merchant }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("accrual.justEarnedLabel"), L), `<strong style="color:#067647;">${earned}</strong>`)}
          ${dataRow(t(rk("accrual.fromLabel"), L), `<strong>${merchant}</strong>`)}
          ${dataRow(t(rk("accrual.balanceLabel"), L), `<strong>${balance}</strong>`, true)}
        </table>
      `)}
      ${p(t(rk("accrual.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("accrual.heading"), L, { amount: earned }), content, true, t(rk("accrual.cta"), L), REFERRALS_URL, t(rk("accrual.preheader"), L, { amount: earned, merchant }), L);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral accrual alert sent to ${email} (+${earned} from ${merchantName}, bal=${balance})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralAccrualEmail' });
  }
};

/** A referred merchant just ACTIVATED (took their first qualifying payment). */
export const sendReferralActivatedEmail = async (
  email: string,
  name: string,
  merchantName: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const merchantRaw = merchantName || t(rk("merchantFallback"), L);
    const merchant = escapeHtml(merchantRaw);
    const subject = t(rk("activated.subject"), L, { merchant: merchantRaw });
    const content = `
      ${greetingLine(L, name)}
      ${p(t(rk("activated.intro"), L, { merchant }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("activated.merchantLabel"), L), `<strong>${merchant}</strong>`)}
          ${dataRow(t(rk("activated.rewardLabel"), L), `<strong style="color:#166534;">${t(rk("activated.rewardValue"), L)}</strong>`, true)}
        </table>
      `)}
      ${p(t(rk("activated.outro"), L, { merchant }))}`;

    const html = dynoPayEmailTemplate(t(rk("activated.heading"), L, { merchant }), content, true, t(rk("activated.cta"), L), REFERRALS_URL, t(rk("activated.preheader"), L, { merchant }), L, 'gift');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral activation alert sent to ${email} (merchant=${merchantName})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralActivatedEmail' });
  }
};

/** Monthly recap: "your referrals earned you $X in <month>" with a per-merchant breakdown. */
export const sendReferralMonthlyDigestEmail = async (
  email: string,
  name: string,
  monthLabel: string,
  totalUsd: number,
  perMerchant: Array<{ name: string; usd: number }>,
  mode: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const total = `$${toFixedStr(totalUsd, 2)}`;
    const month = escapeHtml(monthLabel);
    const isCash = mode === 'cash';
    const top = perMerchant.slice(0, 12);
    const rowsHtml = top
      .map((m, i) => dataRow(escapeHtml(m.name), `<strong>$${toFixedStr(m.usd, 2)}</strong>`, i === top.length - 1))
      .join('');
    const subject = t(rk("monthlyDigest.subject"), L, { month, total });
    const content = `
      ${amountHero(total, { pill: t(rk("monthlyDigest.heroPill"), L), pillType: 'success', sublabel: t(rk("monthlyDigest.heroSub"), L, { month }) })}
      ${greetingLine(L, name)}
      ${p(t(rk("monthlyDigest.intro"), L, { month }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("monthlyDigest.earnedLabel"), L, { month }), `<strong style="color:#166534;">${total}</strong>`, true)}
        </table>
      `)}
      ${top.length
        ? p(`<strong>${t(rk("monthlyDigest.breakdownTitle"), L)}</strong>`) +
          infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      `)
        : ''}
      ${p(t(rk(isCash ? "monthlyDigest.cashLine" : "monthlyDigest.creditLine"), L))}
      ${p(t(rk("monthlyDigest.keepSharing"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("monthlyDigest.heading"), L, { total, month }), content, true, t(rk("monthlyDigest.cta"), L), REFERRALS_URL, t(rk("monthlyDigest.preheader"), L, { total, month }), L, 'chart');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral monthly digest sent to ${email} (${total}, ${monthLabel}, ${perMerchant.length} merchant(s))`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralMonthlyDigestEmail' });
  }
};


/**
 * SHARE NUDGE — for referrers who have a code but have never referred anyone
 * (0 referrals, $0 earned). A gentle "your link is ready, here's why it pays"
 * push so dormant referrers actually start sharing. Idempotency + eligibility live
 * in referralNudgeService; sending is gated by DISABLE_OUTBOUND_EMAIL.
 */
export const sendReferralShareNudgeEmail = async (
  email: string,
  name: string,
  code: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const signupLink = `${FRONTEND_BASE_URL}/signup?ref=${code}`;
    const subject = t(rk("shareNudge.subject"), L);
    const content = `
      ${greetingLine(L, name)}
      ${p(t(rk("shareNudge.intro"), L))}
      ${p(t(rk("shareNudge.pitch"), L))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("shareNudge.codeLabel"), L), `<strong style="font-family:monospace;color:#166534;">${escapeHtml(code)}</strong>`)}
          ${dataRow(t(rk("shareNudge.linkLabel"), L), `<a href="${signupLink}" style="color:#05936A;word-break:break-all;">${escapeHtml(signupLink)}</a>`, true)}
        </table>
      `)}
      ${p(t(rk("shareNudge.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("shareNudge.heading"), L), content, true, t(rk("shareNudge.cta"), L), REFERRALS_URL, t(rk("shareNudge.preheader"), L), L, 'gift');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral share nudge sent to ${email} (code=${code})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralShareNudgeEmail' });
  }
};

/**
 * MATRIX B — referral fee-credit running LOW. Fired once (Redis-guarded) when the
 * referrer's remaining fee-credit balance crosses below the low threshold.
 */
export const sendReferralCreditLowEmail = async (
  email: string,
  name: string,
  remainingUsd: number,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const amount = `$${toFixedStr(remainingUsd, 2)}`;
    const subject = t(rk("creditLow.subject"), L);
    const content = `
      ${amountHero(amount, { pill: t(rk("creditLow.heroPill"), L), pillType: 'pending', sublabel: t(rk("creditLow.heroSub"), L) })}
      ${greetingLine(L, name)}
      ${p(t(rk("creditLow.intro"), L, { amount }))}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(t(rk("creditLow.remainingLabel"), L), `<strong>${amount}</strong>`, true)}
        </table>
      `)}
      ${p(t(rk("creditLow.explain"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("creditLow.heading"), L), content, true, t(rk("creditLow.cta"), L), REFERRALS_URL, t(rk("creditLow.preheader"), L, { amount }), L, 'gift');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral credit-low alert sent to ${email} (${amount} left)`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralCreditLowEmail' });
  }
};

/**
 * MATRIX C — referral fee-credit EXHAUSTED ($0). Fired once (Redis-guarded) when the
 * referrer's fee-credit balance hits zero. Payments revert to the standard fee.
 */
export const sendReferralCreditExhaustedEmail = async (
  email: string,
  name: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const subject = t(rk("creditExhausted.subject"), L);
    const content = `
      ${amountHero("$0.00", { pill: t(rk("creditExhausted.heroPill"), L), pillType: 'error', sublabel: t(rk("creditExhausted.heroSub"), L) })}
      ${greetingLine(L, name)}
      ${p(t(rk("creditExhausted.intro"), L))}
      ${p(t(rk("creditExhausted.explain"), L))}`;

    const html = dynoPayEmailTemplate(t(rk("creditExhausted.heading"), L), content, true, t(rk("creditExhausted.cta"), L), REFERRALS_URL, t(rk("creditExhausted.preheader"), L), L, 'gift');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral credit-exhausted alert sent to ${email}`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralCreditExhaustedEmail' });
  }
};
