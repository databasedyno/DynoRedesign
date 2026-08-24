/**
 * Pure builders for the customer-facing refund receipt emails.
 * No I/O — safe to unit test. Consumed by refundEmails.ts (which sends).
 */
import { getChainMeta, explorerTxUrl } from "./refundChains";

export type RefundEmailKind = "forwarding" | "completed";

export interface RefundEmailInput {
  refund_amount: number | string;
  asset: string;
  chain: string;
  forward_txid?: string | null;
}

const shell = (title: string, inner: string): string => `
<div style="margin:0;padding:24px;background:#0B1220;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#111A2E;border:1px solid #1F2A44;border-radius:14px;overflow:hidden;">
    <div style="padding:20px 28px;border-bottom:1px solid #1F2A44;">
      <span style="color:#7CF29B;font-size:18px;font-weight:800;letter-spacing:.3px;">Dynopay</span>
    </div>
    <div style="padding:28px;color:#D7DEEC;font-size:15px;line-height:1.6;">
      <h1 style="margin:0 0 16px;color:#FFFFFF;font-size:20px;">${title}</h1>
      ${inner}
    </div>
    <div style="padding:18px 28px;border-top:1px solid #1F2A44;color:#6B7794;font-size:12px;">
      This is an automated message from Dynopay about your refund.
    </div>
  </div>
</div>`;

/** Build the subject + HTML body for a refund status email. */
export const buildRefundEmail = (
  refund: RefundEmailInput,
  kind: RefundEmailKind
): { subject: string; html: string } => {
  const amountStr = `${Number(refund.refund_amount)} ${refund.asset}`;
  const meta = getChainMeta(refund.chain);
  const network = meta ? meta.walletType : refund.chain;

  if (kind === "forwarding") {
    return {
      subject: `Your Dynopay refund of ${amountStr} is on its way`,
      html: shell(
        "Your refund is on its way",
        `<p>Good news — your refund of <b style="color:#fff;">${amountStr}</b> is being sent back to your wallet on the <b>${network}</b> network.</p>
         <p>We'll email you the on-chain transaction link as soon as it's confirmed.</p>`
      ),
    };
  }

  const url = meta ? explorerTxUrl(meta, refund.forward_txid) : null;
  const txBlock = url
    ? `<p style="margin:24px 0;">
         <a href="${url}" style="display:inline-block;background:#7CF29B;color:#08160B;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">View transaction on-chain</a>
       </p>
       <p style="color:#6B7794;font-size:12px;word-break:break-all;">${url}</p>`
    : refund.forward_txid
    ? `<p style="color:#9AA6BE;">Transaction ID: <span style="word-break:break-all;">${refund.forward_txid}</span></p>`
    : "";

  return {
    subject: `Your Dynopay refund of ${amountStr} is complete`,
    html: shell(
      "Your refund is complete",
      `<p>Your refund of <b style="color:#fff;">${amountStr}</b> has been sent on the <b>${network}</b> network and should arrive in your wallet shortly.</p>
       ${txBlock}`
    ),
  };
};
