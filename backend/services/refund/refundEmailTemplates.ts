/**
 * Pure builders for the refund receipt emails (customer + merchant record copy).
 * No I/O — safe to unit test. Consumed by refundEmails.ts (which sends).
 *
 * Rendered on the shared Dynopay template (logo header, hero, sign-off, legal
 * footer, dark-mode-safe helpers) so refund mail looks like every other
 * Dynopay email in both light and dark inboxes.
 */
import { getChainMeta, explorerTxUrl } from "./refundChains";
import { baseEmailTemplate, p, infoBox, dataRow, mono, ctaButton, statusBadge } from "../../utils/emailTemplate";
import { escapeHtml } from "../email/emailShared";
import { assetNetworkLabel } from "../../utils/networkLabels";

export type RefundEmailKind = "forwarding" | "completed";

export interface RefundEmailInput {
  refund_amount: number | string;
  asset: string;
  chain: string;
  forward_txid?: string | null;
  /** Merchant/brand display name so the customer knows WHO refunded them. */
  brand_name?: string | null;
  /** Reference of the original payment being refunded (hash or payment id). */
  original_transaction_ref?: string | null;
  /** Native gas the merchant funded for the refund (merchant copy only). */
  gas_buffer_native?: number | string | null;
  gas_buffer_symbol?: string | null;
}

/** Extra fields available on the merchant record-copy email. */
export interface MerchantRefundEmailInput extends RefundEmailInput {
  refund_id?: string | null;
  customer_email?: string | null;
}

const amountLabel = (r: RefundEmailInput) => `${Number(r.refund_amount)} ${r.asset}`;
const networkLabel = (r: RefundEmailInput) => {
  const meta = getChainMeta(r.chain);
  return assetNetworkLabel(meta ? meta.walletType : r.chain);
};

/** Explorer CTA + full URL (or a plain tx id when no explorer is known). */
const txBlock = (r: RefundEmailInput): string => {
  const meta = getChainMeta(r.chain);
  const url = meta ? explorerTxUrl(meta, r.forward_txid) : null;
  if (url) {
    return `${ctaButton("View transaction on-chain", url)}
      ${p(`Transaction ID: ${mono(r.forward_txid || "")}`, "font-size: 12px; color: #6b7280; text-align: center; word-break: break-all;")}`;
  }
  if (r.forward_txid) {
    return p(`Transaction ID: ${mono(r.forward_txid)}`, "font-size: 13px; color: #6b7280;");
  }
  return "";
};

const footnote = (text: string) =>
  p(text, "font-size: 13px; color: #6b7280; margin-top: 24px;");

/** Build the subject + HTML body for a customer refund status email. */
export const buildRefundEmail = (
  refund: RefundEmailInput,
  kind: RefundEmailKind
): { subject: string; html: string } => {
  const amountStr = amountLabel(refund);
  const network = networkLabel(refund);
  const brand = escapeHtml(String(refund.brand_name || "").trim());
  const fromBrand = brand ? ` from <strong>${brand}</strong>` : "";
  const merchantRow = brand ? dataRow("Merchant", `<strong>${brand}</strong>`) : "";
  const origRef = String(refund.original_transaction_ref || "").trim();
  const origRow = origRef ? dataRow("Original payment", mono(origRef.length > 20 ? `${origRef.slice(0, 10)}…${origRef.slice(-6)}` : origRef)) : "";
  const footer = "This is an automated message from Dynopay about your refund.";

  if (kind === "forwarding") {
    const body = `${p("Hey there,")}
      ${p(`Good news — your refund of <strong>${amountStr}</strong>${fromBrand} is being sent back to your wallet on the <strong>${network}</strong> network.`)}
      ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${merchantRow}
        ${dataRow("Status", statusBadge("On its way", "pending"))}
        ${dataRow("Refund", `<strong>${amountStr}</strong>`)}
        ${origRow}
        ${dataRow("Network", network, true)}
      </table>`)}
      ${p("We'll email you the on-chain transaction link as soon as it's confirmed.")}
      ${footnote(footer)}`;
    return {
      subject: `Your Dynopay refund of ${amountStr} is on its way`,
      html: baseEmailTemplate("Your refund is on its way", body, { hero: "refund", preheader: `${amountStr} is heading back to your wallet`, audience: "buyer" }),
    };
  }

  const body = `${p("Hey there,")}
    ${p(`Your refund of <strong>${amountStr}</strong>${fromBrand} has been sent on the <strong>${network}</strong> network and should arrive in your wallet shortly.`)}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${merchantRow}
      ${dataRow("Status", statusBadge("Complete", "success"))}
      ${dataRow("Refund", `<strong>${amountStr}</strong>`)}
      ${origRow}
      ${dataRow("Network", network, true)}
    </table>`, "#12B76A")}
    ${txBlock(refund)}
    ${footnote(footer)}`;
  return {
    subject: `Your Dynopay refund of ${amountStr} is complete`,
    html: baseEmailTemplate("Your refund is complete", body, { hero: "refund", preheader: `${amountStr} was sent back to your wallet`, audience: "buyer" }),
  };
};

/**
 * Merchant record copy — sent to the MERCHANT when a refund they issued
 * completes, so both sides (customer + merchant) have a record of it.
 */
export const buildMerchantRefundEmail = (
  refund: MerchantRefundEmailInput
): { subject: string; html: string } => {
  const amountStr = amountLabel(refund);
  const network = networkLabel(refund);
  const customer = String(refund.customer_email || "").trim();

  const body = `${p("Hey there,")}
    ${p("The refund you issued has been sent back to your customer's wallet. Here is your record copy.")}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${dataRow("Status", statusBadge("Complete", "success"))}
      ${dataRow("Amount", `<strong>${amountStr}</strong>`)}
      ${Number(refund.gas_buffer_native) > 0 ? dataRow("Network fee (you funded)", `${String(refund.gas_buffer_native)} ${escapeHtml(String(refund.gas_buffer_symbol || ""))}`) : ""}
      ${dataRow("Network", network)}
      ${String(refund.original_transaction_ref || "").trim() ? dataRow("Original payment", mono(String(refund.original_transaction_ref))) : ""}
      ${customer ? dataRow("Customer", customer, !refund.refund_id) : ""}
      ${refund.refund_id ? dataRow("Refund ID", mono(String(refund.refund_id)), true) : ""}
    </table>`, "#12B76A")}
    ${txBlock(refund)}
    ${footnote("This is an automated record copy from Dynopay about a refund you issued.")}`;

  return {
    subject: `Refund of ${amountStr} to ${customer || "your customer"} is complete`,
    html: baseEmailTemplate("Refund completed", body, { hero: "refund", preheader: `Record copy · ${amountStr} refunded on ${network}` }),
  };
};
