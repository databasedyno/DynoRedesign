/**
 * Sends refund receipt emails via the existing Brevo transporter (which itself
 * honours DISABLE_OUTBOUND_EMAIL, so nothing is sent from the preview pod).
 * Never sent for dry-run refunds. Sending never throws — a failed email must
 * not break the refund state machine.
 *
 * Recipients:
 *  - CUSTOMER: "forwarding" (on its way) and "completed" (with explorer link).
 *  - MERCHANT: record copy when the refund COMPLETES, so both sides have a
 *    record of the refund (looked up via refund.merchant_user_id).
 */
import mailTransporter from "../../utils/mailTransporter";
import { log } from "../../utils/loggers";
import { userModel } from "../../models";
import {
  buildRefundEmail,
  buildMerchantRefundEmail,
  RefundEmailKind,
} from "./refundEmailTemplates";

/**
 * Send the receipt email(s) that match the refund's CURRENT status.
 * No-op for dry-run refunds or non-emailable statuses. The customer email and
 * the merchant record copy are sent independently — a failure (or a missing
 * address) on one never blocks the other.
 */
export const sendRefundStatusEmail = async (refund: any): Promise<void> => {
  try {
    const r = refund?.dataValues || refund;
    if (!r || r.is_dry_run) return;
    const kind: RefundEmailKind | null =
      r.status === "forwarding"
        ? "forwarding"
        : r.status === "completed"
        ? "completed"
        : null;
    if (!kind) return;

    const customerEmail = String(r.customer_email || "").trim();

    // 1) Customer receipt
    if (customerEmail) {
      try {
        const { subject, html } = buildRefundEmail(r, kind);
        await mailTransporter({ to: customerEmail, name: customerEmail, subject, body: html });
      } catch (e: any) {
        log(`[refundEmails] failed to send customer refund receipt: ${e?.message || e}`, "error");
      }
    }

    // 2) Merchant record copy — only when the refund COMPLETES
    if (kind === "completed" && r.merchant_user_id) {
      try {
        const merchant: any = await userModel.findByPk(r.merchant_user_id);
        const m = merchant?.dataValues || merchant;
        const merchantEmail = String(m?.email || "").trim();
        // Skip a duplicate when the merchant used their own email as the
        // customer address (test refunds) — they already got the receipt.
        if (merchantEmail && merchantEmail.toLowerCase() !== customerEmail.toLowerCase()) {
          const { subject, html } = buildMerchantRefundEmail(r);
          await mailTransporter({
            to: merchantEmail,
            name: m?.name || merchantEmail,
            subject,
            body: html,
          });
        }
      } catch (e: any) {
        log(`[refundEmails] failed to send merchant refund record copy: ${e?.message || e}`, "error");
      }
    }
  } catch (e: any) {
    log(`[refundEmails] failed to send refund receipt: ${e?.message || e}`, "error");
  }
};
