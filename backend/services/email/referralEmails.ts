import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { p, infoBox, dataRow } from "../../utils/emailTemplate";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate } from "./emailShared";
import { firstNameOnly } from "../../utils/emailI18n";

/**
 * Referral revenue-share payout emails (merchant-facing).
 * Plain-English (like the webhook-disabled alert); Provider: Brevo.
 */

const REFERRALS_URL = `${FRONTEND_BASE_URL}/referrals`;

/** Balance crossed the cash-out minimum — nudge the referrer. */
export const sendReferralPayoutReadyEmail = async (
  email: string,
  name: string,
  unpaidUsd: number,
  mode: string,
  lang?: string
) => {
  try {
    void lang;
    const amount = `$${Number(unpaidUsd).toFixed(2)}`;
    const isCash = mode === "cash";
    const subject = `You can cash out ${amount} in referral rewards 🎉`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`Nice work — you've earned <strong>${amount}</strong> in Dynopay referral rewards from the merchants you referred.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Available to cash out', `<strong style="color:#166534;">${amount}</strong>`, true)}
        </table>
      `, '#12B76A')}
      ${isCash
        ? p(`Your payout method is set to <strong>USDT (TRC-20) cash-out</strong> — head to your referrals page to withdraw it to your wallet.`)
        : p(`It's currently reducing your own Dynopay fees automatically. Prefer cash? Switch to <strong>USDT (TRC-20) cash-out</strong> on your referrals page and withdraw it to your wallet.`)}`;

    const html = dynoPayEmailTemplate(`Referral rewards ready`, content, true, isCash ? `Cash out now` : `View rewards`, REFERRALS_URL);
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
    void lang;
    const min = `$${Number(autoMinUsd).toFixed(2)}`;
    const subject = `Auto cash-out is on for your referral rewards`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`Automatic cash-out is now <strong>ON</strong>. Whenever your referral balance reaches <strong>${min}</strong>, we'll send it to your USDT (TRC-20) wallet automatically — no action needed.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Auto-pay at', `<strong>${min}</strong>`)}
          ${dataRow('Wallet', `<span style="font-family:monospace;font-size:13px;">${escapeHtml(addressMasked)}</span>`, true)}
        </table>
      `, '#05936A')}
      ${p(`You can turn this off or change the amount anytime on your referrals page.`)}`;

    const html = dynoPayEmailTemplate(`Auto cash-out enabled`, content, true, `Manage payouts`, REFERRALS_URL);
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
    void lang;
    const amount = `$${Number(amountUsd).toFixed(2)}`;
    const subject = `Your ${amount} referral cash-out is on the way`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`${viaAuto ? `Auto cash-out triggered — we're` : `We're`} sending <strong>${amount}</strong> in referral rewards to your USDT (TRC-20) wallet.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount', `<strong>${amount}</strong>`)}
          ${dataRow('Wallet', `<span style="font-family:monospace;font-size:13px;">${escapeHtml(addressMasked)}</span>`, true)}
        </table>
      `, '#05936A')}
      ${p(`You'll get another email with the transaction link once it lands on-chain. This usually takes a few minutes.`)}`;

    const html = dynoPayEmailTemplate(`Cash-out requested`, content, true, `View history`, REFERRALS_URL);
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
    void lang;
    const amount = `$${Number(amountUsd).toFixed(2)}`;
    const subject = `Your ${amount} referral cash-out couldn't be sent`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`We tried to send <strong>${amount}</strong> in referral rewards to your USDT (TRC-20) wallet, but the transfer didn't go through.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount', `<strong>${amount}</strong>`)}
          ${dataRow('Wallet', `<span style="font-family:monospace;font-size:13px;">${escapeHtml(addressMasked)}</span>`)}
          ${dataRow('Reason', `<span style="font-family:monospace;font-size:12px;">${escapeHtml(reason)}</span>`, true)}
        </table>
      `, '#f59e0b')}
      ${p(`Your rewards are safe and still in your balance. Please double-check your payout wallet on your referrals page and try again — if it keeps failing, just reply to this email and we'll help.`)}`;

    const html = dynoPayEmailTemplate(`Cash-out failed`, content, true, `Review payout`, REFERRALS_URL);
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
    void lang;
    const earned = `$${Number(newCommissionUsd).toFixed(2)}`;
    const balance = `$${Number(unpaidBalanceUsd).toFixed(2)}`;
    const merchant = escapeHtml(merchantName || 'a merchant you referred');
    const subject = `You just earned ${earned} in referral rewards 🎉`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`Good news — <strong>${merchant}</strong> just processed a payment, so you earned <strong>${earned}</strong> in Dynopay referral rewards (25% of their fees).`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Just earned', `<strong style="color:#166534;">${earned}</strong>`)}
          ${dataRow('From', `<strong>${merchant}</strong>`)}
          ${dataRow('Available balance', `<strong>${balance}</strong>`, true)}
        </table>
      `, '#12B76A')}
      ${p(`Your rewards keep building for the full 12-month window. Take them as automatic fee credit, or switch to USDT (TRC-20) cash-out anytime on your referrals page.`)}`;

    const html = dynoPayEmailTemplate(`You earned ${earned}`, content, true, `View referral rewards`, REFERRALS_URL);
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
    void lang;
    const merchant = escapeHtml(merchantName || 'a merchant you referred');
    const subject = `${merchant} just went live — your rewards start now 🚀`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`Great news — <strong>${merchant}</strong>, a merchant you referred, just processed their first qualifying payment and is now <strong>active</strong>.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Referred merchant', `<strong>${merchant}</strong>`)}
          ${dataRow('Your reward', `<strong style="color:#166534;">25% of their Dynopay fees</strong>`, true)}
        </table>
      `, '#12B76A')}
      ${p(`From now on you earn <strong>25% of the platform fees</strong> ${merchant} generates, for a full 12 months. We'll keep you posted as the rewards roll in.`)}`;

    const html = dynoPayEmailTemplate(`${merchant} is now active`, content, true, `View referral rewards`, REFERRALS_URL);
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
    void lang;
    const total = `$${Number(totalUsd).toFixed(2)}`;
    const isCash = mode === 'cash';
    const top = perMerchant.slice(0, 12);
    const rowsHtml = top
      .map((m, i) => dataRow(escapeHtml(m.name), `<strong>$${Number(m.usd).toFixed(2)}</strong>`, i === top.length - 1))
      .join('');
    const subject = `Your referrals earned you ${total} in ${monthLabel} 🎉`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`Here's your Dynopay referral recap for <strong>${escapeHtml(monthLabel)}</strong> — the merchants you referred generated fees, and you earned 25% of them.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow(`Earned in ${escapeHtml(monthLabel)}`, `<strong style="color:#166534;">${total}</strong>`, true)}
        </table>
      `, '#12B76A')}
      ${top.length
        ? p(`<strong>Where it came from</strong>`) +
          infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      `, '#05936A')
        : ''}
      ${isCash
        ? p(`Your rewards are set to <strong>USDT (TRC-20) cash-out</strong> — withdraw anytime on your referrals page.`)
        : p(`These rewards automatically lower your own Dynopay fees. Prefer cash? Switch to <strong>USDT (TRC-20) cash-out</strong> on your referrals page.`)}
      ${p(`Keep sharing your link to grow next month's total.`)}`;

    const html = dynoPayEmailTemplate(`You earned ${total} in ${monthLabel}`, content, true, `View referral rewards`, REFERRALS_URL);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral monthly digest sent to ${email} (${total}, ${monthLabel}, ${perMerchant.length} merchant(s))`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralMonthlyDigestEmail' });
  }
};


/**
 * SHARE NUDGE — for referrers who have a code but have never referred anyone
 * (0 referrals, $0 earned). A gentle "your link is ready, here's why it pays"
 * push so dormant referrers actually start sharing. Plain English, matches the
 * other referral emails in this file. Idempotency + eligibility live in
 * referralNudgeService; sending is gated by DISABLE_OUTBOUND_EMAIL.
 */
export const sendReferralShareNudgeEmail = async (
  email: string,
  name: string,
  code: string,
  lang?: string
) => {
  try {
    void lang;
    const signupLink = `${FRONTEND_BASE_URL}/signup?ref=${code}`;
    const subject = `Your Dynopay referral link is ready — earn 25% for a year 💸`;
    const content = `
      ${p(`Hey ${escapeHtml(firstNameOnly(name))},`)}
      ${p(`Your Dynopay referral link is set up and ready to share — but it hasn't been used yet. Here's a quick nudge, because it genuinely pays off.`)}
      ${p(`Refer another business. When they take their first payment, <strong>you earn 25% of the Dynopay fee on every payment they make for a full 12 months</strong> — and they get <strong>50% off their own fees for 30 days</strong>, so it's an easy pitch.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Your referral code', `<strong style="font-family:monospace;color:#166534;">${escapeHtml(code)}</strong>`)}
          ${dataRow('Your link', `<a href="${signupLink}" style="color:#05936A;word-break:break-all;">${escapeHtml(signupLink)}</a>`, true)}
        </table>
      `, '#12B76A')}
      ${p(`Share it once and it keeps earning in the background — no extra work.`)}`;

    const html = dynoPayEmailTemplate(`Start earning with referrals`, content, true, `Share your link`, REFERRALS_URL);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Referral share nudge sent to ${email} (code=${code})`);
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendReferralShareNudgeEmail' });
  }
};
