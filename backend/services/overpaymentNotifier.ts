import mailTransporter from "../utils/mailTransporter";
import { apiLogger } from "../utils/loggers";
import { captureError } from "./errorMonitoringService";
import { infoBox, dataRow, statusBadge, p } from "../utils/emailTemplate";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate } from "./email/emailShared";
import { claimEmitOnce } from "./webhookEvents";
import { createNotification, NOTIFICATION_TYPES } from "../controller/notificationController";
import { companyModel, userModel } from "../models";

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
}

const fmtCrypto = (n: number) => Number(n ?? 0).toFixed(8).replace(/\.?0+$/, "");
const fmtFiat = (n: number) => Number(n ?? 0).toFixed(2);

/**
 * Notify the MERCHANT and the platform ADMIN that a customer OVERPAID a
 * payment. Per the settlement policy the merchant is credited exactly their
 * expected amount and the excess is routed to the admin wallet — this alert
 * makes that routing transparent so it's never a surprise.
 *
 * Fires at most ONCE per payment via a Redis dedup lock, so the polled
 * verify endpoint can call it repeatedly without spamming. Never throws.
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

    if (info.companyId) {
      const company = await companyModel.findOne({ where: { company_id: info.companyId } });
      if (company?.dataValues) {
        companyName = company.dataValues.company_name || companyName;
        merchantUserId = company.dataValues.user_id ?? null;
        merchantEmail = company.dataValues.email || null;
        if (merchantUserId) {
          const user = await userModel.findOne({
            where: { user_id: merchantUserId },
            attributes: ["email", "name"],
          });
          if (user?.dataValues) {
            merchantEmail = user.dataValues.email || merchantEmail;
            merchantName = user.dataValues.name || "";
          }
        }
      }
    }

    const excessCrypto = `${fmtCrypto(info.excessAmount)} ${info.currency}`;
    const excessFiat = `${fmtFiat(info.excessAmountUsd)} ${info.baseCurrency}`;
    const receivedCrypto = `${fmtCrypto(info.amountReceived)} ${info.currency}`;
    const expectedCrypto = `${fmtCrypto(info.amountExpected)} ${info.currency}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    const txRow = info.txId
      ? dataRow("Transaction", `<span style="font-family: monospace; font-size: 13px;">${info.txId}</span>`, true)
      : "";

    // ── Merchant email ──────────────────────────────────────────────
    if (merchantEmail) {
      const detail = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow("Amount received", `<strong>${receivedCrypto}</strong>`)}
          ${dataRow("Amount expected", expectedCrypto)}
          ${dataRow("Overpaid by", `<strong>${excessCrypto}</strong> (≈ ${excessFiat})`)}
          ${dataRow("Status", statusBadge("Overpaid", "success"))}
          ${dataRow("Date", `${dateStr} at ${timeStr}`)}
          ${txRow}
        </table>`;
      const content = `${p(merchantName ? `Hey ${merchantName},` : "Hey,")}
        ${p(`A customer just completed a payment to <strong>${companyName}</strong> and sent MORE than the amount due.`)}
        ${infoBox(detail, "#12B76A")}
        ${p(`You've been credited your full expected amount. The extra <strong>${excessCrypto}</strong> (≈ ${excessFiat}) was routed to DynoPay per your account's overpayment policy, so there's nothing you need to do.`)}`;
      const html = dynoPayEmailTemplate(
        "A customer overpaid",
        content,
        true,
        "View transactions",
        `${FRONTEND_BASE_URL}/transactions`,
      );
      await mailTransporter({
        to: merchantEmail,
        name: merchantName || companyName,
        subject: `Overpayment received — ${excessCrypto} extra`,
        body: html,
      });
      apiLogger.info(`[Overpayment] merchant alert sent to ${merchantEmail} (${excessCrypto} extra on ${companyName})`);
    } else {
      apiLogger.warn(`[Overpayment] No merchant email resolved for company ${info.companyId} — skipping merchant alert`);
    }

    // ── Admin email ─────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const detail = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow("Company", companyName)}
          ${dataRow("Amount received", `<strong>${receivedCrypto}</strong>`)}
          ${dataRow("Amount expected", expectedCrypto)}
          ${dataRow("Excess routed to admin", `<strong>${excessCrypto}</strong> (≈ ${excessFiat})`)}
          ${dataRow("Date", `${dateStr} at ${timeStr}`)}
          ${txRow}
        </table>`;
      const content = `${p("Hey Dynopay Admin,")}
        ${p(`A customer overpaid a payment to <strong>${companyName}</strong>. The merchant was credited their expected amount; the excess was routed to the admin wallet.`)}
        ${infoBox(detail, "#12B76A")}`;
      const html = dynoPayEmailTemplate("Overpayment routed to admin", content);
      await mailTransporter({
        to: adminEmail,
        name: "Dynopay Admin",
        subject: `Overpayment routed to admin — ${excessCrypto} (${companyName})`,
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
        `A customer sent ${excessCrypto} (≈ ${excessFiat}) more than due on ${companyName}. Your full amount was credited; the excess went to DynoPay.`,
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
