import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang, resolveEmailLang, firstNameOnly, formatEmailDateTime } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono, ctaButton, formatPercent } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, sendEmail, greetingLine } from "./emailShared";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

/**
 * Referral offer callout — SOLID success surface via the shared successBox
 * (class-based dark-mode overrides, no gradient → survives Gmail's forced dark
 * mode and Apple Mail's prefers-color-scheme alike). Title/line are p/strong,
 * never h3 (headings were not covered by the dark overrides).
 */
const offerBox = (title: string, line: string, codeLabel: string, code: string): string =>
  successBox(`
    <p style="margin: 0 0 6px 0; font-size: 17px; font-weight: 800; color: #14532d; font-family: ${FONT};">${title}</p>
    <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.5; color: #166534; font-family: ${FONT};">${line}</p>
    <p style="margin: 0; font-size: 14px; color: #166534; font-family: ${FONT};">${codeLabel}
      <strong class="chip chip-success" style="display: inline-block; margin-left: 4px; background-color: #dcfce7; color: #14532d; padding: 6px 12px; border-radius: 6px; font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 15px; letter-spacing: 0.5px;">${code}</strong>
    </p>`);

/** "Why Dynopay?" bullets shared by the referee invite + reminders. */
const whyDynopayBlock = (L: string): string => `
<h4 class="accent" style="margin: 24px 0 10px 0; font-size: 15px; color: ${EMAIL_TOKENS.brandDeep}; font-family: ${FONT};">${t('referral.whyTitle', L)}</h4>
<ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.6; font-family: ${FONT};">
  <li style="margin-bottom: 6px;">${t('referral.why1', L)}</li>
  <li style="margin-bottom: 6px;">${t('referral.why2', L)}</li>
  <li style="margin-bottom: 6px;">${t('referral.why3', L)}</li>
  <li>${t('referral.why4', L)}</li>
</ul>`;

/** Muted footer line (unsubscribe etc.) with a dark-mode-safe hairline. */
const footnote = (inner: string): string =>
  `<p class="sep" style="font-size: 13px; color: #6b7280; margin: 32px 0 0 0; padding-top: 16px; border-top: 1px solid #e5e7eb; font-family: ${FONT};">${inner}</p>`;

/**
 * Template 12: Payment Link Created
 */
export const sendPaymentLinkCreatedEmail = async (
  email: string,
  name: string,
  brandName: string,
  amount: string,
  currency: string,
  paymentLink: string,
  description: string,
  expiresAt: string | null,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const brand = escapeHtml(brandName || "");
    const subject = t('merchant.paymentLinkCreated.subject', L, { amount, currency });

    let shortDisplayUrl = paymentLink;
    try {
      const url = new URL(paymentLink);
      const pathParts = url.pathname + url.search;
      if (pathParts.length > 20) {
        const lastChars = pathParts.slice(-8);
        shortDisplayUrl = `${url.host}/pay/...${lastChars}`;
      }
    } catch {
      // Keep original if URL parsing fails
    }

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.paymentLinkCreated.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${brand ? dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`) : ''}
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('merchant.labels.expires', L), expiresAt || t('merchant.never', L))}
        ${dataRow(t('merchant.labels.link', L), `<a href="${paymentLink}" style="color: #0a0a0a; text-decoration: none;">${shortDisplayUrl}</a>`, true)}
      </table>
    `)}
    ${p(t('merchant.paymentLinkCreated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.paymentLinkCreated.heading', L), content, true, t('merchant.paymentLinkCreated.cta', L), paymentLink, t('merchant.paymentLinkCreated.preheader', L), L, 'link');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Payment link created email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Payment link created email error:", e);
  }
};

/**
 * Template 12b: Crowdfunding Campaign Created (merchant notification)
 *
 * Distinct from `sendPaymentLinkCreatedEmail` — a donation/crowdfunding
 * campaign is NOT a single-amount payment request. The email must reference
 * the campaign title + goal (or "open-ended" when no goal), not an "amount to
 * be paid" (which used to say "Payment Link Created for $10,000" for a $10k
 * goal — that was misleading and got flagged as inconsistent by the user).
 */
export const sendCrowdfundingCampaignCreatedEmail = async (
  email: string,
  name: string,
  brandName: string,
  campaignTitle: string,
  goalAmount: number | null,
  currency: string,
  campaignLink: string,
  purpose: string | null,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const brand = escapeHtml(brandName || "");
    const safeTitle = campaignTitle || 'Crowdfunding campaign';
    const subject = t('merchant.crowdfundingCreated.subject', L, { title: safeTitle });

    let shortDisplayUrl = campaignLink;
    try {
      const url = new URL(campaignLink);
      const pathParts = url.pathname + url.search;
      if (pathParts.length > 20) {
        const lastChars = pathParts.slice(-8);
        shortDisplayUrl = `${url.host}/pay/...${lastChars}`;
      }
    } catch {
      // Keep original if URL parsing fails
    }

    const goalDisplay = (goalAmount && goalAmount > 0)
      ? `<strong>${getCurrencySymbol(currency)}${Number(goalAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}</strong>`
      : t('merchant.crowdfundingCreated.labelNoGoal', L);

    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t('merchant.crowdfundingCreated.intro', L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${brand ? dataRow(t('merchant.labels.brand', L), `<strong>${brand}</strong>`) : ''}
        ${dataRow(t('merchant.crowdfundingCreated.labelCampaign', L), `<strong>${safeTitle}</strong>`)}
        ${dataRow(t('merchant.crowdfundingCreated.labelGoal', L), goalDisplay)}
        ${purpose ? dataRow(t('labels.description', L), purpose) : ''}
        ${dataRow(t('merchant.crowdfundingCreated.labelLink', L), `<a href="${campaignLink}" style="color: #0a0a0a; text-decoration: none;">${shortDisplayUrl}</a>`, true)}
      </table>
    `)}
    ${p(t('merchant.crowdfundingCreated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.crowdfundingCreated.heading', L), content, true, t('merchant.crowdfundingCreated.cta', L), campaignLink, t('merchant.crowdfundingCreated.preheader', L), L, 'campaign');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Crowdfunding campaign created email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Crowdfunding campaign created email error:", e);
  }
};

/**
 * Template 12c: Crowdfunding Campaign Update (contributor notification)
 *
 * Sent to a past contributor when the organizer publishes a new update with
 * `notify_contributors=true`. Uses the campaign title + update title/body
 * (Markdown body pre-rendered to plain text for the email — we don't render
 * Markdown in emails to keep the templates cross-client compatible).
 *
 * Anonymous contributors still receive the email (the anonymity flag hides
 * the donor's name from the PUBLIC wall, not from the merchant's contact
 * capture — the email column is populated for all completed contributions).
 * Contributors who never entered an email are silently skipped by the caller.
 */
export const sendCrowdfundingUpdateEmail = async (
  email: string,
  name: string,
  campaignTitle: string,
  updateTitle: string,
  updateBodyMd: string,
  campaignLink: string,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const safeCampaign = campaignTitle || 'the campaign';
    const safeUpdateTitle = updateTitle || 'Campaign update';
    const subject = t('contributor.crowdfundingUpdate.subject', L, {
      title: safeUpdateTitle, campaign: safeCampaign,
    });

    // Strip Markdown for email body — email clients don't reliably render
    // custom Markdown → HTML. We keep line breaks + bullet dashes for
    // readability.
    const stripped = String(updateBodyMd || '')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/(^|[^*])\*(.+?)\*/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/^>\s?/gm, '')
      .replace(/^---+$/gm, '—')
      .trim();
    // Escape HTML then re-wrap paragraphs on double newlines.
    const escape = (s: string) => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = escape(stripped)
      .split(/\n{2,}/)
      .map((para) => `<p style="margin:0 0 16px 0; line-height:1.6;">${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const content = `${p(t('common.greeting', L, { name: name || t('contributor.crowdfundingUpdate.friend', L) }))}
    ${p(t('contributor.crowdfundingUpdate.intro', L, { campaign: safeCampaign }))}
    ${infoBox(`
      <h2 style="margin:0 0 12px 0; font-size:19px; font-weight:800; color:#0a0a0a;">${escape(safeUpdateTitle)}</h2>
      ${paragraphs}
    `)}
    ${p(t('contributor.crowdfundingUpdate.outro', L))}`;

    const html = dynoPayEmailTemplate(t('contributor.crowdfundingUpdate.heading', L, { campaign: safeCampaign }), content, true, t('contributor.crowdfundingUpdate.cta', L), campaignLink, t('contributor.crowdfundingUpdate.preheader', L, { campaign: safeCampaign }), L, 'campaign');
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Crowdfunding update email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Crowdfunding update email error:", e);
  }
};

/**
 * Referee Code Reminder email
 */
export const sendRefereeCodeReminderEmail = async (
  recipientEmail: string,
  code: string,
  discountPercent: number,
  discountDurationDays: number,
  daysRemaining: number,
  reminderType: 'week1' | 'week2' | 'week3' | 'final',
  unsubscribeToken: string
) => {
  try {
    const baseUrl = FRONTEND_BASE_URL;
    const signupUrl = `${baseUrl}/signup?ref=${code}`;
    const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;
    const L = await resolveEmailLang(undefined, recipientEmail);
    const v = { discountPercent: formatPercent(discountPercent), daysRemaining, days: discountDurationDays };

    const keySuffix: Record<typeof reminderType, string> = {
      week1: 'Week1', week2: 'Week2', week3: 'Week3', final: 'Final',
    };
    const sfx = keySuffix[reminderType];
    const subject = t(`referral.reminder.subject${sfx}`, L, v);
    const urgencyMessage = t(`referral.reminder.urgency${sfx}`, L, v);
    const ctaText = t(`referral.reminder.cta${sfx}`, L, v);

    const message = `
${p(t('referral.reminder.intro', L))}
${offerBox(t('referral.reminder.offerTitle', L), t('referral.reminder.offerLine', L, v), t('referral.codeLabel', L), code)}
${p(urgencyMessage)}
${whyDynopayBlock(L)}
${ctaButton(ctaText, signupUrl, { padding: '28px 0 4px 0' })}
${footnote(`<a href="${unsubscribeUrl}" style="color: #6b7280;">${t('referral.unsubscribe', L)}</a> ${t('referral.reminder.unsubscribeSuffix', L)}`)}
    `.trim();

    // We only know the e-mail here → generic localized greeting (never "Hey moxxcompany,").
    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate(t('referral.reminder.heading', L), `${greetingLine(L)}\n${message}`, false, "", "", "", L, 'gift');

    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Referee reminder (${reminderType}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendRefereeCodeReminderEmail' });
  }
};

/**
 * Referee Invite email — sent ONCE, after a customer completes a payment,
 * inviting them to open their own Dynopay merchant account with a one-time
 * discount. Follow-ups are handled by sendRefereeCodeReminderEmail.
 */
export const sendRefereeInviteEmail = async (
  recipientEmail: string,
  code: string,
  discountPercent: number,
  discountDurationDays: number,
  unsubscribeToken?: string
) => {
  try {
    const baseUrl = FRONTEND_BASE_URL;
    const signupUrl = `${baseUrl}/signup?ref=${code}`;
    const recipientName = recipientEmail.split('@')[0] || "there";
    const L = await resolveEmailLang(undefined, recipientEmail);
    const v = { discountPercent: formatPercent(discountPercent), days: discountDurationDays };

    const unsubscribeLine = unsubscribeToken
      ? footnote(`<a href="${baseUrl}/unsubscribe?token=${unsubscribeToken}" style="color: #6b7280;">${t('referral.unsubscribe', L)}</a> ${t('referral.invite.unsubscribeSuffix', L)}`)
      : "";

    const message = `
${p(t('referral.invite.intro', L))}
${offerBox(t('referral.invite.giftTitle', L), t('referral.invite.offerLine', L, v), t('referral.codeLabel', L), code)}
${whyDynopayBlock(L)}
${ctaButton(t('referral.invite.cta', L), signupUrl, { padding: '28px 0 4px 0' })}
${unsubscribeLine}
    `.trim();

    // Buyer's name is unknown (we only have the e-mail) → generic localized greeting.
    const htmlBody = dynoPayEmailTemplate(t('referral.invite.heading', L), `${greetingLine(L)}\n${message}`, false, "", "", "", L, 'gift');

    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject: t('referral.invite.subject', L, v),
      body: htmlBody,
    });

    apiLogger.info(`[Email] Referee invite sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendRefereeInviteEmail' });
  }
};

/**
 * Payment Link Reminder email (buyer-facing, localized).
 * `lang` = the buyer's language when known, else the merchant's (resolved by the
 * cron via resolveCustomerLanguage) — falls back to English.
 */
export const sendPaymentLinkReminderEmail = async (
  recipientEmail: string,
  companyName: string,
  amount: string,
  currency: string,
  description: string | null,
  paymentLink: string,
  expiresAt: Date | null,
  reminderType: 'reminder1' | 'reminder2' | 'final',
  unsubscribeToken: string,
  lang?: string | null
) => {
  try {
    const baseUrl = FRONTEND_BASE_URL;
    const backendUrl = config.raw("SERVER_URL") || baseUrl;
    const unsubscribeUrl = `${backendUrl}/api/user/unsubscribe-payment-reminders?token=${unsubscribeToken}`;
    const L = normalizeLang(lang);
    const K = 'paymentLinkReminder';
    const safeCompany = escapeHtml(companyName);

    let timeRemaining = '';
    if (expiresAt) {
      const diffHours = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays > 0) timeRemaining = diffDays === 1 ? t(`${K}.timeDay`, L) : t(`${K}.timeDays`, L, { count: diffDays });
      else if (diffHours > 0) timeRemaining = diffHours === 1 ? t(`${K}.timeHour`, L) : t(`${K}.timeHours`, L, { count: diffHours });
      else timeRemaining = t(`${K}.timeLessThanHour`, L);
    }

    const v = { companyName: safeCompany, timeRemaining, amount, currency };
    const urgent = `<strong class="warn-text" style="color: #dc2626;">${t(`${K}.urgent`, L)}</strong>`;
    const variant = {
      reminder1: {
        subject: t(`${K}.subjectReminder1`, L, v),
        heading: t(`${K}.headingReminder1`, L),
        urgency: t(expiresAt ? `${K}.urgencyReminder1Expiring` : `${K}.urgencyReminder1`, L, v),
        cta: t(`${K}.ctaReminder1`, L),
      },
      reminder2: {
        subject: t(`${K}.subjectReminder2`, L, v),
        heading: t(`${K}.headingReminder2`, L),
        urgency: t(expiresAt ? `${K}.urgencyReminder2Expiring` : `${K}.urgencyReminder2`, L, v),
        cta: t(`${K}.ctaReminder2`, L),
      },
      final: {
        subject: t(expiresAt ? `${K}.subjectFinalExpiring` : `${K}.subjectFinal`, L, v),
        heading: t(expiresAt ? `${K}.headingFinalExpiring` : `${K}.headingFinal`, L),
        urgency: t(expiresAt ? `${K}.urgencyFinalExpiring` : `${K}.urgencyFinal`, L, { ...v, urgent }),
        cta: t(`${K}.ctaFinal`, L),
      },
    }[reminderType];

    const message = `
${p(t(`${K}.intro`, L, v))}
${infoBox(`
  <p style="margin: 0 0 8px 0; font-size: 16px; color: #1f2937; font-family: ${FONT};"><strong>${t(`${K}.amountDue`, L)}:</strong> ${amount} ${currency}</p>
  ${description ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #374151; font-family: ${FONT};"><strong>${t(`${K}.description`, L)}:</strong> ${escapeHtml(description)}</p>` : ''}
  ${expiresAt ? `<p style="margin: 0; font-size: 14px; color: #374151; font-family: ${FONT};"><strong>${t(`${K}.expires`, L)}:</strong> ${formatEmailDateTime(expiresAt, L)}</p>` : ''}`)}
${p(variant.urgency)}
${ctaButton(variant.cta, paymentLink, { padding: '28px 0 4px 0' })}
${p(t(`${K}.disregard`, L, v), 'font-size: 14px; color: #6b7280; margin-top: 16px;')}
${footnote(`<a href="${unsubscribeUrl}" style="color: #6b7280;">${t(`${K}.unsubscribe`, L)}</a> ${t(`${K}.unsubscribeSuffix`, L)}`)}
    `.trim();

    // Only the buyer's e-mail is known → generic localized greeting.
    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate(variant.heading, `${greetingLine(L)}\n${message}`, false, "", "", t(`${K}.preheader`, L, v), L, 'link');

    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject: variant.subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Payment link reminder (${reminderType}, ${L}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentLinkReminderEmail' });
  }
};

// ============================================================
// SECTION 10: KYC EMAILS
// ============================================================

