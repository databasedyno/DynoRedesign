import { raw as envRaw } from "../utils/config";
import mailTransporter from "../utils/mailTransporter";
import { apiLogger } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";
import { infoBox, dataRow, statusBadge, p } from "../utils/emailTemplate";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate } from "./email/emailShared";
import { claimEmitOnce } from "./webhookEvents";
import { createNotification, NOTIFICATION_TYPES } from "../controller/notificationController";
import { companyModel, userModel } from "../models";
import { emailDateParts, t, normalizeLang } from "../utils/emailI18n";
import { toFixedStr } from "../utils/money";
import { getCoinSymbol, assetNetworkLabel } from "../utils/networkLabels";

export interface OverpaymentInfo {
  paymentId: string;
  companyId: number | string | null;
  txId?: string | null;
  currency: string; // crypto currency (e.g. BTC)
  amountReceived: number; // crypto received
  amountExpected: number; // crypto expected
  excessAmount: number; // crypto excess
  excessAmountUsd: number; // excess in base currency
  baseCurrency: string;
  linkId?: number | string | null;
  /** Buyer contact (when left on the checkout) → buyer copy with refund instructions. */
  customerEmail?: string | null;
  customerName?: string | null;
  customerLang?: string | null;
  /** Merchant contact address the buyer should write to for the refund. */
  merchantContactEmail?: string | null;
}

const fmtCrypto = (n: number) => toFixedStr(n ?? 0, 8).replace(/\.?0+$/, "");
const fmtFiat = (n: number) => toFixedStr(n ?? 0, 2);


const overpayAmounts = (info: OverpaymentInfo) => {
  const sym = getCoinSymbol(info.currency);
  return {
    sym,
    excessCrypto: `${fmtCrypto(info.excessAmount)} ${sym}`,
    excessFiat: `${fmtFiat(info.excessAmountUsd)} ${info.baseCurrency}`,
    receivedCrypto: `${fmtCrypto(info.amountReceived)} ${sym}`,
    expectedCrypto: `${fmtCrypto(info.amountExpected)} ${sym}`,
    networkLabel: assetNetworkLabel(info.currency),
    txSearch: `${FRONTEND_BASE_URL}/transactions?search=${encodeURIComponent(String(info.txId || info.paymentId))}`,
  };
};

/** Merchant copy — "a buyer overpaid; the extra is in your payout; refund it in one click". */
export const buildOverpaidMerchantEmail = (
  info: OverpaymentInfo,
  ctx: { companyName: string; merchantName?: string | null; merchantLang?: string | null },
): { subject: string; html: string } => {
  const L = normalizeLang(ctx.merchantLang);
  const { excessCrypto, excessFiat, receivedCrypto, expectedCrypto, networkLabel, txSearch } = overpayAmounts(info);
  const { date: dateStr, time: timeStr } = emailDateParts(new Date(), L);
  const detail = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${dataRow(t("labels.amountReceived", L), `<strong>${receivedCrypto}</strong>`)}
      ${dataRow(t("labels.expectedAmount", L), expectedCrypto)}
      ${dataRow(t("overpayment.overpaidBy", L), `<strong>${excessCrypto}</strong> (≈ ${excessFiat})`)}
      ${dataRow(t("labels.network", L), networkLabel)}
      ${info.customerEmail ? dataRow(t("overpayment.customer", L), String(info.customerEmail)) : ""}
      ${dataRow(t("labels.status", L), statusBadge(t("overpayment.statusOverpaid", L), "success"))}
      ${dataRow(t("labels.date", L), `${dateStr} · ${timeStr}`, !info.txId)}
      ${info.txId ? dataRow(t("labels.transactionId", L), `<span style="font-family: monospace; font-size: 13px; word-break: break-all;">${info.txId}</span>`, true) : ""}
    </table>`;
  const content = `${p(ctx.merchantName ? t("common.greeting", L, { name: ctx.merchantName }) : t("common.greetingDefault", L))}
    ${p(t("overpayment.merchantIntro", L, { company: `<strong>${ctx.companyName}</strong>` }))}
    ${infoBox(detail, "#12B76A")}
    ${p(t("overpayment.merchantBody", L, { excess: `<strong>${excessCrypto}</strong>`, excessFiat }))}
    ${info.customerEmail ? p(t("overpayment.merchantKeep", L), "font-size:13px;color:#6b7280;") : ""}`;
  const html = dynoPayEmailTemplate(t("overpayment.merchantHeading", L), content, true, t("overpayment.refundCta", L), txSearch,
    t("overpayment.merchantPreheader", L, { excess: excessCrypto }), L, "alert");
  return { subject: t("overpayment.merchantSubject", L, { excess: excessCrypto }), html };
};

/** Buyer copy — "you sent a little more than needed; here is how to get the difference back". */
export const buildOverpaidBuyerEmail = (
  info: OverpaymentInfo,
  ctx: { companyName: string },
): { subject: string; html: string } => {
  const BL = normalizeLang(info.customerLang);
  const { excessCrypto, excessFiat, receivedCrypto, expectedCrypto, networkLabel } = overpayAmounts(info);
  const contact = info.merchantContactEmail ? ` (<a href="mailto:${info.merchantContactEmail}" style="color:#4338CA;">${info.merchantContactEmail}</a>)` : "";
  const detail = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${dataRow(t("overpayment.amountDue", BL), expectedCrypto)}
      ${dataRow(t("overpayment.amountSent", BL), `<strong>${receivedCrypto}</strong>`)}
      ${dataRow(t("overpayment.overpaidBy", BL), `<strong>${excessCrypto}</strong> (≈ ${excessFiat})`)}
      ${dataRow(t("labels.network", BL), networkLabel, !info.txId)}
      ${info.txId ? dataRow(t("labels.reference", BL), `<span style="font-family: monospace; font-size: 12px; word-break: break-all;">${info.txId}</span>`, true) : ""}
    </table>`;
  const content = `${p(info.customerName ? t("common.greeting", BL, { name: info.customerName }) : t("common.greetingDefault", BL))}
    ${p(t("overpayment.buyerIntro", BL, { company: `<strong>${ctx.companyName}</strong>`, excess: excessCrypto, excessFiat }))}
    ${infoBox(detail, "#f59e0b")}
    ${p(t("overpayment.buyerBody", BL, { company: ctx.companyName, contact }))}`;
  const html = dynoPayEmailTemplate(t("overpayment.buyerHeading", BL), content,
    !!info.merchantContactEmail, t("overpayment.buyerCta", BL, { company: ctx.companyName }), info.merchantContactEmail ? `mailto:${info.merchantContactEmail}` : "",
    t("overpayment.buyerPreheader", BL, { excess: excessCrypto, company: ctx.companyName }), BL, "alert", "buyer");
  return { subject: t("overpayment.buyerSubject", BL, { company: ctx.companyName }), html };
};

/**
 * Notify the MERCHANT and the platform ADMIN that a customer OVERPAID a
 * payment. Settlement policy: the quoted fee is charged once and the ENTIRE
 * excess is credited to the merchant — this alert makes that explicit so the
 * merchant can refund the buyer if asked.
 *
 * Fires at most ONCE per payment via a Redis dedup lock (safe to call from
 * every settlement path). Never throws.
 */
export async function notifyOverpayment(info: OverpaymentInfo): Promise<void> {
  try {
    if (!info.paymentId) return;

    // Once-only guard (independent of the opt-in webhook dedup key).
    const first = await claimEmitOnce(`overpaid-notify:${info.paymentId}`, 604800);
    if (!first) return;

    // Resolve merchant company + account holder.
    let companyName = "your store";
    let merchantEmail: string | null = null;
    let merchantName = "";
    let merchantUserId: number | null = null;
    let merchantLang = "en";

    if (info.companyId) {
      const company = await companyModel.findOne({ where: { company_id: info.companyId } });
      if (company?.dataValues) {
        companyName = company.dataValues.company_name || companyName;
        merchantUserId = company.dataValues.user_id ?? null;
        merchantEmail = company.dataValues.email || null;
        if (!info.merchantContactEmail && company.dataValues.email) info.merchantContactEmail = company.dataValues.email;
        if (merchantUserId) {
          const user = await userModel.findOne({
            where: { user_id: merchantUserId },
            attributes: ["email", "name", "language"],
          });
          if (user?.dataValues) {
            merchantEmail = user.dataValues.email || merchantEmail;
            merchantName = user.dataValues.name || "";
            merchantLang = normalizeLang(user.dataValues.language);
          }
        }
      }
    }

    const { excessCrypto, excessFiat, receivedCrypto, expectedCrypto } = overpayAmounts(info);
    const { date: dateStr, time: timeStr } = emailDateParts(new Date());
    const txRow = info.txId
      ? dataRow("Transaction", `<span style="font-family: monospace; font-size: 13px;">${info.txId}</span>`, true)
      : "";

    // ── Merchant email (localized to the merchant's language) ────────
    if (merchantEmail) {
      const m = buildOverpaidMerchantEmail(info, { companyName, merchantName, merchantLang });
      await mailTransporter({ to: merchantEmail, name: merchantName || companyName, subject: m.subject, body: m.html });
      apiLogger.info(`[Overpayment] merchant alert (${merchantLang}) sent to ${merchantEmail} (${excessCrypto} extra on ${companyName})`);
    } else {
      apiLogger.warn(`[Overpayment] No merchant email resolved for company ${info.companyId} — skipping merchant alert`);
    }

    // ── Buyer copy: what happened + how to get the difference back ───
    const buyerEmail = String(info.customerEmail || "").trim();
    if (buyerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      const b = buildOverpaidBuyerEmail(info, { companyName });
      await mailTransporter({ to: buyerEmail, name: info.customerName || buyerEmail, subject: b.subject, body: b.html });
      apiLogger.info(`[Overpayment] buyer copy sent to ${buyerEmail}`);
    }

    // ── Admin email ─────────────────────────────────────────────────
    const adminEmail = envRaw("ADMIN_EMAIL");
    if (adminEmail) {
      const detail = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow("Company", companyName)}
          ${dataRow("Amount received", `<strong>${receivedCrypto}</strong>`)}
          ${dataRow("Amount expected", expectedCrypto)}
          ${dataRow("Excess credited to merchant", `<strong>${excessCrypto}</strong> (≈ ${excessFiat})`)}
          ${dataRow("Date", `${dateStr} at ${timeStr}`)}
          ${txRow}
        </table>`;
      const content = `${p("Hey Dynopay Admin,")}
        ${p(`A customer overpaid a payment to <strong>${companyName}</strong>. The quoted fee was charged once; the excess was credited to the merchant's payout (nothing was retained).`)}
        ${infoBox(detail, "#12B76A")}`;
      const html = dynoPayEmailTemplate("Overpayment credited to merchant", content, false, "", "", "", undefined, "alert", "admin");
      await mailTransporter({
        to: adminEmail,
        name: "Dynopay Admin",
        subject: `Overpayment credited to merchant — ${excessCrypto} (${companyName})`,
        body: html,
      });
      apiLogger.info(`[Overpayment] admin alert sent to ${adminEmail}`);
    } else {
      apiLogger.warn("[Overpayment] No ADMIN_EMAIL configured — skipping admin alert");
    }

    // ── In-app merchant notification ────────────────────────────────
    if (merchantUserId) {
      await createNotification(
        merchantUserId,
        NOTIFICATION_TYPES.PAYMENT_OVERPAID,
        "Customer overpaid",
        `A customer sent ${excessCrypto} (≈ ${excessFiat}) more than due on ${companyName}. The extra is included in your payout — refund it from the transaction details if the buyer asks.`,
        {
          payment_id: info.paymentId,
          excess_amount: info.excessAmount,
          excess_amount_usd: info.excessAmountUsd,
          currency: info.currency,
          link_id: info.linkId ?? null,
        },
        info.companyId ? Number(info.companyId) : undefined,
      );
    }
  } catch (e) {
    captureError(e, "email", { extraContext: "notifyOverpayment" });
    apiLogger.error("[Overpayment] notifyOverpayment error:", e);
  }
}
