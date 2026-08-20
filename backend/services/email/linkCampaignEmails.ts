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
 * Template 12: Payment Link Created
 */
export const sendPaymentLinkCreatedEmail = async (
  email: string,
  name: string,
  amount: string,
  currency: string,
  paymentLink: string,
  description: string,
  expiresAt: string | null,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
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
        ${dataRow(t('labels.amount', L), `<strong>${amount} ${currency}</strong>`)}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('merchant.labels.expires', L), expiresAt || t('merchant.never', L))}
        ${dataRow(t('merchant.labels.link', L), `<a href="${paymentLink}" style="color: #0a0a0a; text-decoration: none;">${shortDisplayUrl}</a>`, true)}
      </table>
    `)}
    ${p(t('merchant.paymentLinkCreated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.paymentLinkCreated.heading', L), content, true, t('merchant.paymentLinkCreated.cta', L), paymentLink);
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
  campaignTitle: string,
  goalAmount: number | null,
  currency: string,
  campaignLink: string,
  purpose: string | null,
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
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
        ${dataRow(t('merchant.crowdfundingCreated.labelCampaign', L), `<strong>${safeTitle}</strong>`)}
        ${dataRow(t('merchant.crowdfundingCreated.labelGoal', L), goalDisplay)}
        ${purpose ? dataRow(t('labels.description', L), purpose) : ''}
        ${dataRow(t('merchant.crowdfundingCreated.labelLink', L), `<a href="${campaignLink}" style="color: #0a0a0a; text-decoration: none;">${shortDisplayUrl}</a>`, true)}
      </table>
    `)}
    ${p(t('merchant.crowdfundingCreated.outro', L))}`;

    const html = dynoPayEmailTemplate(t('merchant.crowdfundingCreated.heading', L), content, true, t('merchant.crowdfundingCreated.cta', L), campaignLink);
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

    const html = dynoPayEmailTemplate(
      t('contributor.crowdfundingUpdate.heading', L, { campaign: safeCampaign }),
      content,
      true,
      t('contributor.crowdfundingUpdate.cta', L),
      campaignLink
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`Crowdfunding update email sent to ${email}`);
  } catch (e) {
    apiLogger.error("Crowdfunding update email error:", e);
  }
};

/**
 * Template 22: Payment Link Expiring Soon
 */
export const sendPaymentExpiringEmail = async (
  customerEmail: string,
  customerName: string | null,
  companyName: string,
  amount: string,
  currency: string,
  paymentLink: string,
  expiresIn: string,
  description: string | null
) => {
  try {
    const displayName = customerName || customerEmail.split('@')[0];
    const subject = `Payment link expires ${expiresIn} - ${amount} ${currency}`;

    const content = `${p(`Hey ${displayName},`)}
    ${p(`This is a friendly reminder that your payment link from <strong>${companyName}</strong> will expire <strong>${expiresIn}</strong>.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow('Amount', `<strong>${amount} ${currency}</strong>`)}
        ${description ? dataRow('Description', description) : ''}
        ${dataRow('Expires', statusBadge(expiresIn, 'pending'), true)}
      </table>
    `, '#f59e0b')}
    ${p(`Complete your payment now to avoid missing this deadline.`)}`;

    const html = dynoPayEmailTemplate("Payment Expiring Soon", content, true, "Pay Now", paymentLink);
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html });
    apiLogger.info(`[Email] Payment expiring reminder sent to ${customerEmail} - expires ${expiresIn}`);
  } catch (e) {
    apiLogger.error("Payment expiring email error:", e);
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
    const baseUrl = process.env.FRONTEND_URL || process.env.CHECKOUT_URL || 'https://dynopay.io';
    const signupUrl = `${baseUrl}/signup?ref=${code}`;
    const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;

    let subject: string;
    let urgencyMessage: string;
    let ctaText: string;

    switch (reminderType) {
      case 'week1':
        subject = "Don't forget your exclusive Dynopay offer!";
        urgencyMessage = `You still have <strong>${daysRemaining} days</strong> to claim your exclusive discount.`;
        ctaText = "Claim Your Discount";
        break;
      case 'week2':
        subject = "Your 50% discount is waiting - Dynopay";
        urgencyMessage = `Your exclusive <strong>${discountPercent}% discount</strong> is still available! Only <strong>${daysRemaining} days</strong> remaining.`;
        ctaText = "Start Saving Today";
        break;
      case 'week3':
        subject = `Only ${daysRemaining} days left on your Dynopay offer!`;
        urgencyMessage = `<strong>Time is running out!</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>.`;
        ctaText = "Don't Miss Out";
        break;
      case 'final':
        subject = "LAST CHANCE: Your Dynopay discount expires in 3 days!";
        urgencyMessage = `<strong style="color: #dc2626;">FINAL REMINDER:</strong> Your exclusive ${discountPercent}% discount expires in just <strong>${daysRemaining} days</strong>. This is your last chance!`;
        ctaText = "Claim Now Before It's Gone";
        break;
    }

    const message = `
<p>We noticed you haven't claimed your exclusive Dynopay discount yet!</p>

<div style="margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #12B76A; border-radius: 0 8px 8px 0;">
  <h3 style="margin: 0 0 12px 0; color: #166534; font-size: 18px;">Your Exclusive Offer</h3>
  <p style="margin: 0 0 8px 0; color: #14532d; font-size: 16px;">
    <strong>${discountPercent}% OFF</strong> all transaction fees for <strong>${discountDurationDays} days</strong>
  </p>
  <p style="margin: 0; font-size: 14px;">
    Your code: <strong style="background: #dcfce7; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 16px;">${code}</strong>
  </p>
</div>

<p style="font-size: 15px;">${urgencyMessage}</p>

<h4 style="margin: 24px 0 12px 0; color: ${EMAIL_TOKENS.brandDeep};">Why Dynopay?</h4>
<ul style="margin: 0; padding-left: 20px; color: #4a4a4a;">
  <li>Accept crypto payments from customers worldwide</li>
  <li>Support for Bitcoin, Ethereum, USDT, and more</li>
  <li>Instant notifications and easy dashboard</li>
  <li>Lower fees than traditional payment processors</li>
</ul>

<div style="text-align: center; margin: 32px 0;">
  <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, ${EMAIL_TOKENS.brandHover} 0%, ${EMAIL_TOKENS.brand} 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText}</a>
</div>

<p style="font-size: 13px; color: #6b7280; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe</a> from these reminders
</p>
    `.trim();

    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate("Your Discount is Waiting!", `${p(`Hey ${recipientName},`)}\n${message}`);

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
 * Payment Link Reminder email
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
  unsubscribeToken: string
) => {
  try {
    const baseUrl = process.env.FRONTEND_URL || process.env.CHECKOUT_URL || 'https://dynopay.io';
    const backendUrl = process.env.SERVER_URL || baseUrl;
    const unsubscribeUrl = `${backendUrl}/api/user/unsubscribe-payment-reminders?token=${unsubscribeToken}`;

    let subject: string;
    let urgencyMessage: string;
    let ctaText: string;
    let headerText: string;

    let timeRemaining = '';
    if (expiresAt) {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        timeRemaining = `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      } else if (diffHours > 0) {
        timeRemaining = `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      } else {
        timeRemaining = 'less than an hour';
      }
    }

    switch (reminderType) {
      case 'reminder1':
        subject = `Complete your payment to ${companyName}`;
        headerText = "Payment Reminder";
        urgencyMessage = expiresAt
          ? `You have <strong>${timeRemaining}</strong> to complete this payment.`
          : `Please complete your payment at your earliest convenience.`;
        ctaText = "Complete Payment";
        break;
      case 'reminder2':
        subject = `Your payment to ${companyName} is still pending`;
        headerText = "Payment Still Pending";
        urgencyMessage = expiresAt
          ? `<strong>Don't forget!</strong> You have <strong>${timeRemaining}</strong> remaining to complete this payment.`
          : `We noticed you haven't completed your payment yet. Need help?`;
        ctaText = "Pay Now";
        break;
      case 'final':
        subject = expiresAt
          ? `Payment expires soon - ${companyName}`
          : `Final reminder: Payment pending - ${companyName}`;
        headerText = expiresAt ? "Expiring Soon!" : "Final Reminder";
        urgencyMessage = expiresAt
          ? `<strong style="color: #dc2626;">URGENT:</strong> Your payment link expires in <strong>${timeRemaining}</strong>. Please complete your payment now to avoid missing the deadline.`
          : `This is a final reminder about your pending payment. Please complete it soon or contact ${companyName} if you have questions.`;
        ctaText = "Complete Payment Now";
        break;
    }

    const message = `
<p>You have a pending payment request from <strong>${companyName}</strong>.</p>

<div style="margin: 24px 0; padding: 20px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid ${EMAIL_TOKENS.brandDeep};">
  <p style="margin: 0 0 8px 0; font-size: 16px;"><strong>Amount Due:</strong> ${amount} ${currency}</p>
  ${description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>` : ''}
  ${expiresAt ? `<p style="margin: 0;"><strong>Expires:</strong> ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}</p>` : ''}
</div>

<p style="font-size: 15px;">${urgencyMessage}</p>

<div style="text-align: center; margin: 32px 0;">
  <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, ${EMAIL_TOKENS.brandHover} 0%, ${EMAIL_TOKENS.brand} 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">${ctaText}</a>
</div>

<p style="font-size: 14px; color: #6b7280;">
  If you've already completed this payment, please disregard this email. If you have any questions about this payment, please contact ${companyName} directly.
</p>

<p style="font-size: 13px; color: #9ca3af; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
  <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe</a> from payment reminders
</p>
    `.trim();

    const recipientName = recipientEmail.split('@')[0] || "there";
    const htmlBody = dynoPayEmailTemplate(headerText, `${p(`Hey ${recipientName},`)}\n${message}`);

    const info = await mailTransporter({
      to: recipientEmail,
      name: recipientName,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Payment link reminder (${reminderType}) sent to ${recipientEmail}`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendPaymentLinkReminderEmail' });
  }
};

// ============================================================
// SECTION 10: KYC EMAILS
// ============================================================

