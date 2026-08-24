/**
 * Sends customer-facing refund receipt emails via the existing Brevo
 * transporter (which itself honours DISABLE_OUTBOUND_EMAIL, so nothing is sent
 * from the preview pod). Never sent for dry-run refunds. Sending never throws —
 * a failed email must not break the refund state machine.
 */
import mailTransporter from "../../utils/mailTransporter";
import { log } from "../../utils/loggers";
import { buildRefundEmail, RefundEmailKind } from "./refundEmailTemplates";

/**
 * Send the receipt email that matches the refund's CURRENT status.
 * No-op for dry-run refunds, missing customer email, or non-emailable statuses.
 */
export const sendRefundStatusEmail = async (refund: any): Promise<void> => {
  try {
    const r = refund?.dataValues || refund;
    if (!r || r.is_dry_run) return;
    const to = String(r.customer_email || "").trim();
    if (!to) return;
    const kind: RefundEmailKind | null =
      r.status === "forwarding"
        ? "forwarding"
        : r.status === "completed"
        ? "completed"
        : null;
    if (!kind) return;
    const { subject, html } = buildRefundEmail(r, kind);
    await mailTransporter({ to, name: to, subject, body: html });
  } catch (e: any) {
    log(`[refundEmails] failed to send refund receipt: ${e?.message || e}`, "error");
  }
};
