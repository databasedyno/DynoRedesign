import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { infoBox, dataRow, statusBadge, p } from "../../utils/emailTemplate";
import { dynoPayEmailTemplate } from "./emailShared";

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
  companyLogo?: string | null
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
          merchantReceives: `${formatCryptoAmount(breakdown.merchantAmount, breakdown.currency)} ${breakdown.currency}`,
          platformFee: `${formatCryptoAmount(breakdown.feeAmount, breakdown.currency)} ${breakdown.currency}`,
          feePayer: breakdown.feePayer,
        }
      : undefined;

    let pdfAttachment: { name: string; content: string; contentType: string } | undefined;
    try {
      const receiptData = {
        transactionId,
        transactionReference,
        amount,
        currency,
        cryptoAmount,
        cryptoCurrency,
        companyName,
        companyLogo: companyLogo || undefined,
        customerEmail,
        customerName: displayName,
        paymentDate: new Date(`${date} ${time}`),
        description: description || undefined,
        paymentMethod: cryptoCurrency ? `${t('receipt.cryptocurrency', L)} (${cryptoCurrency})` : t('receipt.cryptocurrency', L),
        status: t('receipt.completed', L),
        lang: L,
        breakdown: split,
      };

      const pdfBuffer = await generatePaymentReceipt(receiptData);
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

    const content = `${p(hasRealName ? t('common.greeting', L, { name: displayName }) : t('common.greetingNoName', L))}
    ${p(
      isContribution
        ? t('contributionThankYou.intro', L, { campaignName })
        : t('customerPaymentConfirmation.intro', L, { companyName })
    )}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t('labels.status', L), statusBadge(t('statusLabels.complete', L), 'success'))}
        ${dataRow(t('labels.amountPaid', L), `<strong>${amount} ${currency}</strong>`)}
        ${cryptoAmount && cryptoCurrency ? dataRow(t('labels.cryptoAmount', L), `${formatCryptoAmount(cryptoAmount, cryptoCurrency)} ${cryptoCurrency}`) : ''}
        ${split ? dataRow(t('labels.merchantReceives', L), split.merchantReceives) : ''}
        ${split ? dataRow(t('labels.platformFee', L), `${split.platformFee} <span style="color:#6b7280;font-size:12px;">(${t(split.feePayer === 'customer' ? 'labels.feePaidByCustomer' : 'labels.feePaidByMerchant', L)})</span>`) : ''}
        ${description ? dataRow(t('labels.description', L), description) : ''}
        ${dataRow(t('labels.transactionId', L), `<span style="font-family: monospace; font-size: 13px;">${transactionId}</span>`)}
        ${transactionReference ? dataRow(t('labels.reference', L), transactionReference) : ''}
        ${dataRow(t('labels.date', L), `${date} at ${time}`, true)}
      </table>
    `, '#12B76A')}
    ${pdfAttachment ? p(t('customerPaymentConfirmation.pdfAttached', L)) : ''}
    ${p(
      isContribution
        ? t('contributionThankYou.contact', L, { campaignName })
        : t('customerPaymentConfirmation.contact', L, { companyName })
    )}
    ${isContribution ? p(t('contributionThankYou.outro', L)) : ''}
    ${p(`<span style="font-size: 13px; color: #6b7280;">${t('common.securedBy', L)}</span>`)}`;

    const html = dynoPayEmailTemplate(
      isContribution
        ? t('contributionThankYou.heading', L, { campaignName })
        : t('customerPaymentConfirmation.heading', L),
      content
    );
    await mailTransporter({ to: customerEmail, name: displayName, subject, body: html, attachments: pdfAttachment ? [pdfAttachment] : undefined });
    apiLogger.info(`[Email] Customer payment confirmation sent to ${customerEmail} for ${amount} ${currency}${pdfAttachment ? ' with PDF receipt' : ''}`);
  } catch (e) {
    apiLogger.error("Customer payment confirmation email error:", e);
  }
};

