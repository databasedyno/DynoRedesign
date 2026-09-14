import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { generatePaymentReceipt, getReceiptFilename } from "../pdfReceiptService";
import { t, normalizeLang, resolveEmailLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, getCurrencySymbol, infoBox, dataRow, statusBadge, p, otpBlock, warnText, alertBox, errorBox, successBox, neutralBox, statCard, twoColumnStats, feeRow, feeTotalRow, feeTable, mono } from "../../utils/emailTemplate";
import { EMAIL_TOKENS } from "../../utils/brandTokens";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate, dynoPayGreetingTemplate, formatAmountWithCurrency, formatMoneyForEmail, sendEmail, brandSubject } from "./emailShared";
import { toFixedStr } from "../../utils/money";

/**
 * Auto-conversion payout email (complex layout with volatility, savings, fee breakdown)
 */
export const sendAutoConversionPayoutEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  data: {
    sourceCurrency: string;
    sourceAmount: string;
    sourceAmountUsd: string;
    targetCurrency: string;
    payoutAmount: string;
    conversionRate: string;
    priceAtConversion: number;
    currentPrice: number;
    priceMovementPct: number;
    marketState: string;
    feeTierUsed: string;
    transactionId: string;
    conversionId: string;
    withdrawalTxHash?: string;
    platformFeeUsd?: number;
    sweepGasFeeUsd?: number;
    tradeFeeUsd?: number;
    binanceWithdrawalFeeUsd?: number;
    grossSaleUsd?: number;
    totalReceivedUsd?: number;
  },
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, recipientEmail);
    const {
      sourceCurrency, sourceAmount, sourceAmountUsd,
      targetCurrency, payoutAmount, conversionRate,
      priceAtConversion, currentPrice, priceMovementPct,
      marketState, feeTierUsed, transactionId, conversionId,
      withdrawalTxHash,
      platformFeeUsd = 0, sweepGasFeeUsd = 0, tradeFeeUsd = 0,
      binanceWithdrawalFeeUsd = 0, grossSaleUsd = 0, totalReceivedUsd = 0,
    } = data;

    const totalFeesUsd = platformFeeUsd + sweepGasFeeUsd + tradeFeeUsd + binanceWithdrawalFeeUsd;
    const hasDetailedFees = totalFeesUsd > 0;

    const isVolatile = ["VOLATILE", "DECLINING"].includes(marketState);
    const priceDiffSinceConversion = ((currentPrice - priceAtConversion) / priceAtConversion) * 100;
    const priceDroppedSinceConversion = priceDiffSinceConversion < -0.1;
    const savedAmount = priceDroppedSinceConversion
      ? Math.abs(priceDiffSinceConversion / 100) * parseFloat(payoutAmount)
      : 0;

    const payoutFmt = formatMoneyForEmail(payoutAmount, targetCurrency);
    const sourceFmt = formatMoneyForEmail(sourceAmount, sourceCurrency);
    const subject = brandSubject(companyName, t('merchant.autoConversion.subject', L, { payoutAmount: payoutFmt, targetCurrency, sourceAmount: sourceFmt, sourceCurrency }));

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const volatilityVisual = isVolatile ? errorBox(`
      <p class="warn-text" style="margin: 0 0 10px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Market Volatility at Time of Conversion</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius: 4px; height: 10px; margin-bottom: 8px;">
        <tr>
          <td style="width: ${Math.min(100, Math.abs(priceMovementPct) * 20)}%; background: #ef4444; border-radius: 4px; height: 10px;">&nbsp;</td>
          <td style="height: 10px;">&nbsp;</td>
        </tr>
      </table>
      <p style="margin: 0; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        ${sourceCurrency} moved <strong>${toFixedStr(Math.abs(priceMovementPct), 2)}%</strong> during conversion window &mdash; ${feeTierUsed === 'fast' || feeTierUsed === 'fastest' ? 'fast-tracked with priority fees' : 'processed with standard fees'}
      </p>
    `) : '';

    const savingsBlock = priceDroppedSinceConversion ? successBox(`
      <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Auto-Conversion Protected You</p>
      <p class="stat-value-green" style="font-size: 28px; font-weight: 700; margin: 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center;">~$${toFixedStr(savedAmount, 2)} saved</p>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        ${sourceCurrency} has dropped <strong>${toFixedStr(Math.abs(priceDiffSinceConversion), 2)}%</strong> since your conversion<br/>
        Converted at $${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &mdash; Now $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    `) : '';

    const priceUpBlock = !priceDroppedSinceConversion && Math.abs(priceDiffSinceConversion) > 0.1 ? infoBox(`
      <p style="margin: 0; font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        ${sourceCurrency} is currently at <strong>$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        (${priceDiffSinceConversion > 0 ? '+' : ''}${toFixedStr(priceDiffSinceConversion, 2)}% since conversion).
        Your payout was locked in at <strong>$${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for price certainty.
      </p>
    `) : '';

    // Compute the effective platform-fee % (tier % + fixed fee) from the actual charged fee vs. gross sale.
    // Labelled "effective" so a $1 fixed fee on a small payment is not mistaken for the tier rate.
    const effectivePlatformPct =
      grossSaleUsd > 0 && platformFeeUsd > 0
        ? (platformFeeUsd / grossSaleUsd) * 100
        : 0;
    const platformPctLabel = effectivePlatformPct > 0
      ? toFixedStr(effectivePlatformPct, effectivePlatformPct < 1 ? 2 : 1) + "% effective"
      : "";

    const feeRows = [
      feeRow('Gross Conversion', `$${toFixedStr(grossSaleUsd, 2)} ${targetCurrency}`),
      platformFeeUsd > 0 ? feeRow(`Platform Fee${platformPctLabel ? ` (${platformPctLabel})` : ''}`, `-$${toFixedStr(platformFeeUsd, 4)}`, true) : '',
      sweepGasFeeUsd > 0 ? feeRow('Network Gas Fee (sweep)', `-$${toFixedStr(sweepGasFeeUsd, 4)}`, true) : '',
      tradeFeeUsd > 0 ? feeRow('Exchange Fee (0.1%)', `-$${toFixedStr(tradeFeeUsd, 4)}`, true) : '',
      binanceWithdrawalFeeUsd > 0
        ? feeRow('Withdrawal Fee (on-chain)', `-$${toFixedStr(binanceWithdrawalFeeUsd, 4)}`, true)
        : feeRow('Withdrawal Fee', '$0.00 (off-chain)'),
      feeTotalRow('Net Payout', `${payoutFmt} ${targetCurrency}`),
    ].filter(Boolean).join('');

    const htmlContent = `
      ${p(t('merchant.autoConversion.intro', L))}
      ${twoColumnStats(
        statCard('Received', `${sourceFmt} ${sourceCurrency}`, `~$${toFixedStr(sourceAmountUsd, 2)} USD`),
        statCard('Payout', `${payoutFmt} ${targetCurrency}`, 'Sent to your wallet', 'green')
      )}
      ${volatilityVisual}
      ${savingsBlock}
      ${priceUpBlock}
      ${hasDetailedFees ? feeTable(feeRows) : ''}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Conversion Rate', `<strong>1 ${sourceCurrency} = ${parseFloat(conversionRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${targetCurrency}</strong>`)}
          ${dataRow('Market State', statusBadge(marketState, isVolatile ? 'pending' : 'success'))}
          ${dataRow('Date', `${dateStr} at ${timeStr}`)}
          ${withdrawalTxHash ? dataRow('Withdrawal TX', mono(withdrawalTxHash)) : ''}
          ${dataRow('Conversion ID', mono(`#${conversionId}`), true)}
        </table>
      `)}
      ${p(t('merchant.autoConversion.outro', L))}`;

    const htmlBody = dynoPayEmailTemplate(t('merchant.autoConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\n${htmlContent}`, true, t('merchant.autoConversion.cta', L), `${FRONTEND_BASE_URL}/transactions`, t('merchant.autoConversion.preheader', L), L, 'swap');
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Auto-conversion payout email sent to ${recipientEmail} (conversion #${conversionId})`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendAutoConversionPayoutEmail' });
  }
};

/**
 * Weekly conversion summary email (complex layout with charts and breakdown)
 */
export const sendWeeklyConversionSummaryEmail = async (
  recipientEmail: string,
  name: string,
  companyName: string,
  data: {
    periodStart: string;
    periodEnd: string;
    totalConversions: number;
    totalSourceUsd: number;
    totalPayoutUsd: number;
    totalSavedUsd: number;
    totalVolatileConversions: number;
    avgPriceMovementPct: number;
    cryptoBreakdown: Array<{
      currency: string;
      count: number;
      totalAmount: string;
      totalPayoutUsd: number;
      avgMovementPct: number;
    }>;
    dailyVolume: Array<{
      day: string;
      label: string;
      payoutUsd: number;
    }>;
  },
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, recipientEmail);
    const {
      periodStart, periodEnd, totalConversions,
      totalSourceUsd, totalPayoutUsd, totalSavedUsd,
      totalVolatileConversions, avgPriceMovementPct,
      cryptoBreakdown, dailyVolume,
    } = data;

    if (totalConversions === 0) return;

    const subject = `Weekly Conversion Report — ${totalConversions} conversion${totalConversions !== 1 ? 's' : ''}, $${toFixedStr(totalPayoutUsd, 2)} paid out`;

    const maxDailyVolume = Math.max(...dailyVolume.map(d => d.payoutUsd), 1);
    const chartRows = dailyVolume.map(d => {
      const barWidth = Math.max(2, Math.round((d.payoutUsd / maxDailyVolume) * 100));
      const hasActivity = d.payoutUsd > 0;
      return `
        <tr class="fee-row">
          <td style="padding: 4px 8px 4px 0; font-size: 12px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; white-space: nowrap; width: 40px;">${d.label}</td>
          <td style="padding: 4px 0; width: 100%;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="track" style="background: #f3f4f6; border-radius: 3px; height: 18px;">
              <tr>
                <td style="width: ${barWidth}%; background: ${hasActivity ? EMAIL_TOKENS.brand : 'transparent'}; border-radius: 3px; height: 18px;">&nbsp;</td>
                <td style="height: 18px;">&nbsp;</td>
              </tr>
            </table>
          </td>
          <td style="padding: 4px 0 4px 8px; font-size: 12px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; white-space: nowrap; text-align: right; width: 60px; font-weight: ${hasActivity ? '600' : '400'};">${hasActivity ? '$' + toFixedStr(d.payoutUsd, 0) : '-'}</td>
        </tr>`;
    }).join('');

    const breakdownRows = cryptoBreakdown.map(c => {
      const movementColor = c.avgMovementPct < -1 ? '#dc2626' : c.avgMovementPct < 0 ? '#f59e0b' : '#12B76A';
      const movementSign = c.avgMovementPct >= 0 ? '+' : '';
      return `
        <tr class="fee-row">
          <td style="padding: 10px 0; font-size: 14px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${c.currency}</td>
          <td style="padding: 10px 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center; border-bottom: 1px solid #f3f4f6;">${c.count}</td>
          <td style="padding: 10px 0; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">$${toFixedStr(c.totalPayoutUsd, 2)}</td>
          <td style="padding: 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">
            <span style="color: ${movementColor}; font-size: 13px; font-weight: 500;">${movementSign}${toFixedStr(c.avgMovementPct, 2)}%</span>
          </td>
        </tr>`;
    }).join('');

    const savingsBlock = totalSavedUsd > 0.01 ? successBox(`
      <p style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0 0 4px;">Total Protected This Week</p>
      <p class="stat-value-green" style="font-size: 32px; font-weight: 700; margin: 8px 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">~$${toFixedStr(totalSavedUsd, 2)}</p>
      <p style="font-size: 13px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center;">
        saved by converting before further price drops<br/>
        ${totalVolatileConversions} of ${totalConversions} conversions occurred during volatile markets
      </p>
    `) : '';

    const htmlContent = `
      ${p(t('merchant.weeklyConversion.intro', L, { companyName }))}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
        <tr>
          <td style="padding: 0 4px 8px 0; width: 33%;">
            ${statCard('Conversions', `${totalConversions}`, '', 'blue')}
          </td>
          <td style="padding: 0 4px 8px 4px; width: 34%;">
            ${statCard('Total Payout', `$${toFixedStr(totalPayoutUsd, 0)}`, '', 'green')}
          </td>
          <td style="padding: 0 0 8px 4px; width: 33%;">
            ${statCard('Avg Movement', `${avgPriceMovementPct >= 0 ? '+' : ''}${toFixedStr(avgPriceMovementPct, 1)}%`, '', avgPriceMovementPct < -0.5 ? 'green' : 'blue')}
          </td>
        </tr>
      </table>

      ${savingsBlock}

      ${neutralBox(`
        <p style="font-size: 13px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Daily Conversion Volume</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${chartRows}
        </table>
      `)}

      ${infoBox(`
        <p style="font-size: 13px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Breakdown by Crypto</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr class="fee-row">
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Asset</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: center; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Count</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Payout</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Avg Move</td>
          </tr>
          ${breakdownRows}
        </table>
      `)}

      ${p(`<span style="font-size: 13px; color: #9ca3af;">Report period: ${periodStart} to ${periodEnd}. Auto-conversion protects your revenue from crypto price volatility by automatically converting to stablecoins.</span>`)}`;

    const htmlBody = dynoPayEmailTemplate(t('merchant.weeklyConversion.heading', L), `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}\n${htmlContent}`, true, t('merchant.weeklySummary.cta', L), `${FRONTEND_BASE_URL}/dashboard`, t('merchant.weeklyConversion.preheader', L), L, 'chart');
    const info = await mailTransporter({
      to: recipientEmail,
      name,
      subject,
      body: htmlBody,
    });

    apiLogger.info(`[Email] Weekly conversion summary sent to ${recipientEmail} (${totalConversions} conversions)`);
    return info;
  } catch (e) {
    captureError(e, 'email', { extraContext: 'sendWeeklyConversionSummaryEmail' });
  }
};


