/**
 * Escrow lifecycle emails. Thin wrappers over the shared sendEmail() so escrow
 * notifications inherit the Dynopay branded template automatically.
 *
 * In the SAFE-MODE preview DISABLE_OUTBOUND_EMAIL=true, so these are no-ops that
 * are logged rather than actually delivered.
 */
import { sendEmail } from "./emailShared";

interface DealLike {
  title: string;
  amount: number | string;
  currency: string;
  deal_token: string;
}

const money = (d: DealLike) => `${Number(d.amount).toFixed(2)} ${d.currency}`;

export async function sendEscrowInviteEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  fromName: string,
  counterpartyRole: string,
  inviteUrl: string
): Promise<void> {
  const roleLine =
    counterpartyRole === "buyer"
      ? "You have been invited to <b>pay into escrow</b> for this deal."
      : "You have been invited as the <b>seller</b> for this deal.";
  const message =
    `<p>${fromName} has invited you to an escrow deal on Dynopay.</p>` +
    `<p><b>${deal.title}</b><br/>Amount: <b>${money(deal)}</b></p>` +
    `<p>${roleLine} Funds are held safely by Dynopay and only released when the deal is completed.</p>` +
    `<p><a href="${inviteUrl}">Review &amp; respond to this escrow invitation</a></p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow invitation: ${deal.title}`, message);
}

export async function sendEscrowAcceptedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  actorName: string
): Promise<void> {
  const message =
    `<p>${actorName} has <b>accepted</b> the terms for your escrow deal <b>${deal.title}</b> (${money(deal)}).</p>` +
    `<p>The buyer can now fund the escrow to move things forward.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow accepted: ${deal.title}`, message);
}

export async function sendEscrowDeclinedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  actorName: string
): Promise<void> {
  const message =
    `<p>${actorName} has <b>declined</b> the escrow deal <b>${deal.title}</b> (${money(deal)}).</p>` +
    `<p>No funds have moved. You can create a new deal if needed.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow declined: ${deal.title}`, message);
}

/** Pre-funding cancellation by either party (free — nothing was paid). */
export async function sendEscrowCancelledEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  byRole: string
): Promise<void> {
  const message =
    `<p>The <b>${byRole}</b> has <b>cancelled</b> the escrow deal <b>${deal.title}</b> (${money(deal)}) before it was funded.</p>` +
    `<p>No funds have moved and nothing was charged. You can create a new deal if needed.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow cancelled: ${deal.title}`, message);
}

export async function sendEscrowFundedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike
): Promise<void> {
  const message =
    `<p>Good news — the buyer has funded the escrow for <b>${deal.title}</b> (${money(deal)}).</p>` +
    `<p>The funds are now <b>held safely</b> by Dynopay. The seller can proceed and mark the deal as delivered.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow funded: ${deal.title}`, message);
}

export async function sendEscrowDeliveredEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  autoReleaseDays: number
): Promise<void> {
  const message =
    `<p>The seller has marked <b>${deal.title}</b> (${money(deal)}) as <b>delivered</b>.</p>` +
    `<p>Please confirm you received everything to release the funds. If you do nothing, the funds auto-release to the seller in <b>${autoReleaseDays} day(s)</b>. If something is wrong, you can raise a dispute.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Action needed — confirm delivery: ${deal.title}`, message);
}

export async function sendEscrowReleasedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  summary: string
): Promise<void> {
  const message =
    `<p>The escrow deal <b>${deal.title}</b> (${money(deal)}) is <b>complete</b> — funds have been released to the seller.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow completed: ${deal.title}`, message);
}

export async function sendEscrowRefundedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  summary: string
): Promise<void> {
  const message =
    `<p>The escrow deal <b>${deal.title}</b> (${money(deal)}) has been <b>refunded</b> to the buyer.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow refunded: ${deal.title}`, message);
}

export async function sendEscrowDisputeOpenedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  raisedBy: string,
  reason: string
): Promise<void> {
  const message =
    `<p>A dispute has been opened on the escrow deal <b>${deal.title}</b> (${money(deal)}) by the <b>${raisedBy}</b>.</p>` +
    `<p>Reason: ${reason || "(none provided)"}</p>` +
    `<p>The auto-release timer is paused. A Dynopay admin will review and resolve the dispute.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow dispute opened: ${deal.title}`, message);
}

export async function sendEscrowDisputeResolvedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  summary: string
): Promise<void> {
  const message =
    `<p>The dispute on <b>${deal.title}</b> (${money(deal)}) has been resolved by a Dynopay admin.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow dispute resolved: ${deal.title}`, message);
}

export async function sendEscrowOtpEmail(
  toEmail: string,
  deal: DealLike,
  otp: string
): Promise<void> {
  const message =
    `<p>Use this code to verify your email for the escrow deal <b>${deal.title}</b> (${money(deal)}):</p>` +
    `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p>` +
    `<p>This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>`;
  await sendEmail(toEmail, toEmail, `Your escrow verification code: ${otp}`, message);
}

export async function sendEscrowPayoutPendingEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  role: string,
  addUrl: string
): Promise<void> {
  const what = role === "buyer" ? "refund" : "payout";
  const addr = role === "buyer" ? "refund address" : "stablecoin payout address";
  const message =
    `<p>The escrow deal <b>${deal.title}</b> (${money(deal)}) has been decided in your favour — your ${what} is ready.</p>` +
    `<p>We just need a <b>${addr}</b> to send it. Your funds are held safely in a stablecoin and won't lose value while you add it.</p>` +
    `<p><a href="${addUrl}">Add your ${addr} to receive the ${what}</a></p>`;
  await sendEmail(toEmail, toName || toEmail, `Action needed — add a ${addr}: ${deal.title}`, message);
}

export async function sendEscrowPaidEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  summary: string
): Promise<void> {
  const message =
    `<p>Your funds for the escrow deal <b>${deal.title}</b> have been sent.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow funds sent: ${deal.title}`, message);
}


// ── Dispute negotiation (parties settle first; admin is the fallback) ────────

function describeProposal(outcome: string, splitPercentSeller?: number | null): string {
  if (outcome === "release") return "release the full amount to the seller";
  if (outcome === "refund") return "refund the full amount to the buyer";
  const s = Number(splitPercentSeller ?? 50);
  return `a partial settlement — seller keeps ${s}%, buyer is refunded ${100 - s}%`;
}

/** A proposal (dispute opened WITH a proposal, or a counter-offer) sent to the other party. */
export async function sendEscrowDisputeProposalEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  fromRole: string,
  outcome: string,
  splitPercentSeller: number | null | undefined,
  note: string | undefined,
  inviteUrl: string,
  isCounter = false,
  kind: string | null = null
): Promise<void> {
  if (kind === "cancellation" && !isCounter) {
    const message =
      `<p>The <b>${fromRole}</b> has asked to <b>cancel</b> the escrow deal <b>${deal.title}</b> (${money(deal)}).</p>` +
      `<p>Because the deal is already funded, cancelling needs your agreement. If you agree, the buyer is refunded the held amount <b>minus the escrow fee and network/exchange costs</b> (these are non-refundable).</p>` +
      (note ? `<p>Their note: ${note}</p>` : "") +
      `<p>You can <b>agree</b>, make a <b>counter-offer</b>, or <b>escalate to a Dynopay admin</b>.</p>` +
      `<p><a href="${inviteUrl}">Review the request</a></p>`;
    await sendEmail(toEmail, toName || toEmail, `Cancellation requested: ${deal.title}`, message);
    return;
  }
  const lead = isCounter
    ? `The <b>${fromRole}</b> has made a <b>counter-offer</b> to resolve the dispute on`
    : `The <b>${fromRole}</b> has opened a dispute and proposed a resolution for`;
  const message =
    `<p>${lead} <b>${deal.title}</b> (${money(deal)}):</p>` +
    `<p><b>Proposal:</b> ${describeProposal(outcome, splitPercentSeller)}.</p>` +
    (note ? `<p>Their note: ${note}</p>` : "") +
    `<p>You can <b>accept</b> it, make a <b>counter-offer</b>, or <b>escalate to a Dynopay admin</b> if you can't reach an agreement.</p>` +
    `<p><a href="${inviteUrl}">Open the dispute</a></p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute proposal: ${deal.title}`, message);
}

/** Sent to both parties when a dispute is escalated to admin arbitration. */
export async function sendEscrowDisputeEscalatedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  byRole: string
): Promise<void> {
  const how =
    byRole && byRole !== "system"
      ? ` by the <b>${byRole}</b>`
      : " automatically because no agreement was reached in time";
  const message =
    `<p>The dispute on <b>${deal.title}</b> (${money(deal)}) has been <b>escalated to a Dynopay admin</b>${how}.</p>` +
    `<p>An admin will review the case (including any messages exchanged) and decide the outcome. Your funds remain held safely in a stablecoin in the meantime.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute escalated: ${deal.title}`, message);
}

/** Sent to both parties when a dispute is resolved by mutual agreement (no admin). */
export async function sendEscrowDisputeAgreedEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  summary: string
): Promise<void> {
  const message =
    `<p>The dispute on <b>${deal.title}</b> (${money(deal)}) has been <b>resolved by mutual agreement</b>.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute resolved by agreement: ${deal.title}`, message);
}
