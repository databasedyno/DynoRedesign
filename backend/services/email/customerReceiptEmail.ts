import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { generatePaymentReceipt, getReceiptFilename, type ReceiptData } from "../pdfReceiptService";
import { ensureReceiptLink, explorerTxUrl } from "../receiptLinkService";
import { isMerchantIdentityVerified } from "../../helper/merchantVerification";
import { t, normalizeLang } from "../../utils/emailI18n";
import { formatMoneyForEmail, dynoPayEmailTemplate, greetingLine } from "./emailShared";
import { infoBox, dataRow, statusBadge, p } from "../../utils/emailTemplate";

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
  campaignName?: string,
  breakdown?: { merchantAmount: number; feeAmount: number; feePayer: 'customer' | 'company'; currency: string } | null,
  companyLogo?: string | null,
  /** Merchant company id + owner — mints the shareable /receipt/<token> link and the verified marker. */
  company?: { companyId?: number | null; ownerUserId?: number | null } | null,
  paymentSourceKey?: string,
  /** Buyer Auto-Invite: "Buy from {Brand} again, faster" one-tap link. Omitted when null. */
  buyAgain?: { url: string; kind: "donation" | "default" } | null
) => {
  try {
    const L = normalizeLang(lang);
    const hasRealName = !!(customerName && customerName.trim() && !customerName.includes('@'));
    const displayName = hasRealName ? customerName.trim() : (customerEmail ? customerEmail.split('@')[0] : '');
    const isContribution = !!(campaignName && campaignName.trim());
    const subject = isContribution
      ? t('contributionThankYou.subject', L, { campaignName })
      : t('customerPaymentConfirmation.subject', L, { companyName });
    const split = breakdown
      ? {
          merchantReceives: `${formatMoneyForEmail(breakdown.merchantAmount, breakdown.currency)} ${breakdown.currency}`,
          platformFee: `${formatMoneyForEmail(breakdown.feeAmount, breakdown.currency)} ${breakdown.currency}`,
          feePayer: breakdown.feePayer,
        }
      : undefined;

    // Identity-verified merchant marker (best-effort, read-only) — same signal as the checkout card.
    let merchantVerified = false;
    // F2: proof of a crypto payment is the on-chain hash — link it to the block explorer.
    const explorerUrl = explorerTxUrl(cryptoCurrency, transactionReference);
    if (company?.companyId || company?.ownerUserId) {
      try {
        merchantVerified = await isMerchantIdentityVerified(company?.ownerUserId ?? null, company?.companyId ?? null);
      } catch {
        merchantVerified = false;
      }
    }

    let pdfAttachment: { name: string; content: string; contentType: string } | undefined;
    let receiptUrl: string | undefined;
    try {
      const receiptData: ReceiptData = {
        transactionId,
        transactionReference,
        amount,
        currency,
        cryptoAmount,
        cryptoCurrency,
        companyName,
        companyLogo: companyLogo || undefined,
        merchantVerified,
        customerEmail,
        customerName: displayName,
        paymentDate: new Date(`${date} ${time}`),
        description: description || undefined,
        paymentMethod: undefined, // pdfReceiptService renders localized "Cryptocurrency (<coin>)" + network row
        status: t('receipt.completed', L),
        lang: L,
        breakdown: split,
      };

      // Shareable proof-of-payment link (snapshot of exactly these figures). Best-effort.
      const link = await ensureReceiptLink(receiptData, company?.companyId ?? null);
      receiptUrl = link?.url;

      const pdfBuffer = await generatePaymentReceipt({ ...receiptData, receiptUrl });
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

    const content = `${greetingLine(L, hasRealName ? displayName : null)}
    ${p(
      isContribution
        ? t('contributionThankYou.intro', L, { campaignName })
        : t('customerPaymentConfirmation.intro', L, { companyName })
    )}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.complete', L), 'success'))}
        ${dataRow(t('labels.amountPaid', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatMoneyForEmail(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
        ${paymentSourceKey ? dataRow(t('labels.paymentMethod', L), t('paymentSource.' + paymentSourceKey, L)) : ''}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`)}
        ${transactionReference ? dataRow(t('labels.reference', L), explorerUrl
          ? `<a href="${explorerUrl}" style="font-family: monospace; font-size: 12px; color: #4F46E5; word-break: break-all; text-decoration: underline;" target="_blank" rel="noopener">${transactionReference}</a> <span style="font-size:12px;color:#6b7280;">&nbsp;${t('customerPaymentConfirmation.viewOnExplorer', L)} &#8599;</span>`
          : `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${transactionReference}</span>`) : ''}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `, '#12B76A')}
    ${buyAgain ? `<table role="presentation" class="hl-box" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ff;border:1px solid #e0e7ff;border-radius:12px;margin:20px 0;">
      <tr><td style="padding:18px 20px;">
        <p style="font-size:15px;font-weight:700;color:#1f2937;margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${buyAgain.kind === 'donation' ? t('buyAgainReceipt.titleDonation', L, { brand: companyName }) : t('buyAgainReceipt.title', L, { brand: companyName })}</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${buyAgain.kind === 'donation' ? t('buyAgainReceipt.bodyDonation', L) : t('buyAgainReceipt.body', L)}</p>
        <a href="${buyAgain.url}" class="btn" style="display:inline-block;background-color:#4338CA;color:#FFFFFF;-webkit-text-fill-color:#FFFFFF;text-decoration:none;padding:11px 26px;border-radius:10px;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;" target="_blank" rel="noopener"><span style="color:#FFFFFF;-webkit-text-fill-color:#FFFFFF;">${buyAgain.kind === 'donation' ? t('buyAgainReceipt.ctaDonation', L, { brand: companyName }) : t('buyAgainReceipt.cta', L, { brand: companyName })}</span></a>
      </td></tr>
    </table>` : ''}
    ${pdfAttachment ? p(t('customerPaymentConfirmation.pdfAttached', L)) : ''}
    ${p(
      isContribution
        ? t('contributionThankYou.contact', L, { campaignName })
        : t('customerPaymentConfirmation.contact', L, { companyName })
    )}
    ${isContribution ? p(t('contributionThankYou.outro', L)) : ''}
    ${p(`<span style="font-size: 13px; color: #6b7280;">${t('common.securedBy', L)}</span>`)}`;

    const html = dynoPayEmailTemplate(isContribution
        ? t('contributionThankYou.heading', L, { campaignName })
        : t('customerPaymentConfirmation.heading', L), content, !!receiptUrl, receiptUrl ? t('customerPaymentConfirmation.viewOnlineCta', L) : "", receiptUrl || "", isContribution ? t('contributionThankYou.preheader', L) : t('customerPaymentConfirmation.preheader', L), L, 'check');
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html, attachments: pdfAttachment ? [pdfAttachment] : undefined });
    apiLogger.info(`[Email] Customer payment confirmation sent to ${customerEmail} for ${amount} ${currency}${pdfAttachment ? ' with PDF receipt' : ''}`);
  } catch (e) {
    apiLogger.error("Customer payment confirmation email error:", e);
  }
};

/**
 * F3: buyer-facing notice when a partially-paid checkout's grace window closes.
 * Only sent when the buyer left an email on the session. Best-effort, never throws.
 */
export const sendBuyerPaymentExpiredEmail = async (
  customerEmail: string,
  companyName: string,
  receivedAmount: string,
  expectedAmount: string,
  currency: string,
  reference: string,
  lang: string = 'en'
) => {
  try {
    const L = normalizeLang(lang);
    const displayName = customerEmail ? customerEmail.split('@')[0] : '';
    const content = `${p(t('common.greetingDefault', L))}
    ${p(t('buyerPaymentExpired.intro', L, { companyName }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.expired', L), 'pending'))}
        ${dataRow(t('buyerPaymentExpired.received', L), `<strong>${formatMoneyForEmail(receivedAmount, currency)} ${currency}</strong>`)}
        ${dataRow(t('buyerPaymentExpired.expected', L), `${formatMoneyForEmail(expectedAmount, currency)} ${currency}`)}
        ${dataRow(t('labels.reference', L), `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${reference}</span>`, true)}
      </table>
    `, '#F79009')}
    ${p(t('buyerPaymentExpired.whatNext', L, { companyName }))}
    ${p(`<span style="font-size: 13px; color: #6b7280;">${t('common.securedBy', L)}</span>`)}`;
    const html = dynoPayEmailTemplate(t('buyerPaymentExpired.heading', L), content, false, "", "", t('buyerPaymentExpired.preheader', L), L, 'alert');
    await mailTransporter({ to: customerEmail, name: displayName, subject: t('buyerPaymentExpired.subject', L, { companyName }), body: html });
    apiLogger.info(`[Email] Buyer payment-expired notice sent to ${customerEmail} (ref ${reference})`);
  } catch (e) {
    apiLogger.error("Buyer payment expired email error:", e);
  }
};

