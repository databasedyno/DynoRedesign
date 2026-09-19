/**
 * Escrow lifecycle emails. Thin wrappers over the shared sendEmail() so escrow
 * notifications inherit the branded template automatically.
 *
 * Brand-aware: deals with source='safedeal' render in the SafeDeal chrome and
 * speak as SafeDeal ("held by Dynopay" stays, since Dynopay is the custodian);
 * merchant-dashboard escrow deals keep the Dynopay chrome.
 *
 * In the SAFE-MODE preview DISABLE_OUTBOUND_EMAIL=true, so these are no-ops that
 * are logged rather than actually delivered.
 */
import { sendEmail, SendEmailOptions } from "./emailShared";
import { p, otpBlock, type EmailHero } from "../../utils/emailTemplate";

interface DealLike {
  title: string;
  amount: number | string;
  currency: string;
  deal_token: string;
  source?: string | null;
}

const money = (d: DealLike) => `${Number(d.amount).toFixed(2)} ${d.currency}`;
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface BrandVoice {
  /** Product name used in copy. */
  name: string;
  /** Who arbitrates an escalated dispute. */
  reviewer: string;
  opts: (hero: EmailHero, cta?: { text: string; link: string }) => SendEmailOptions;
}

const voice = (deal: DealLike): BrandVoice => {
  const sd = deal.source === "safedeal";
  return {
    name: sd ? "SafeDeal" : "Dynopay",
    reviewer: sd ? "the SafeDeal team" : "a Dynopay admin",
    opts: (hero, cta) => ({ brand: sd ? "safedeal" : "dynopay", audience: sd ? "buyer" : "merchant", hero, cta }),
  };
};

const dealLine = (deal: DealLike) => `<p><b>${esc(deal.title)}</b><br/>Amount: <b>${money(deal)}</b></p>`;

export async function sendEscrowInviteEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  fromName: string,
  counterpartyRole: string,
  inviteUrl: string
): Promise<void> {
  const v = voice(deal);
  const roleLine =
    counterpartyRole === "buyer"
      ? "You've been invited as the <b>buyer</b> — once you accept, you'll pay into escrow."
      : "You've been invited as the <b>seller</b> — once you accept, the buyer funds the escrow before you deliver.";
  const message =
    `<p>${esc(fromName)} has invited you to an escrow deal on ${v.name}.</p>` +
    dealLine(deal) +
    `<p>${roleLine} The money is held by Dynopay and only released when the deal is completed — neither side can walk away with it.</p>`;
  await sendEmail(toEmail, toName || toEmail, `You're invited to an escrow deal: ${deal.title}`, message, false, v.opts("shield", { text: "Review & respond", link: inviteUrl }));
}

export async function sendEscrowAcceptedEmail(toEmail: string, toName: string, deal: DealLike, actorName: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>${esc(actorName)} has <b>accepted</b> the terms for your escrow deal <b>${esc(deal.title)}</b> (${money(deal)}).</p>` +
    `<p>Next step: the buyer funds the escrow. We'll email both of you the moment the money is held.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Deal accepted: ${deal.title}`, message, false, v.opts("check"));
}

export async function sendEscrowDeclinedEmail(toEmail: string, toName: string, deal: DealLike, actorName: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>${esc(actorName)} has <b>declined</b> the escrow deal <b>${esc(deal.title)}</b> (${money(deal)}).</p>` +
    `<p>No money has moved and nothing was charged. You can start a new deal on ${v.name} any time.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Deal declined: ${deal.title}`, message, false, v.opts("block"));
}

/** Pre-funding cancellation by either party (free — nothing was paid). */
export async function sendEscrowCancelledEmail(toEmail: string, toName: string, deal: DealLike, byRole: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The <b>${esc(byRole)}</b> has <b>cancelled</b> the escrow deal <b>${esc(deal.title)}</b> (${money(deal)}) before it was funded.</p>` +
    `<p>No money has moved and nothing was charged. You can start a new deal on ${v.name} any time.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Deal cancelled: ${deal.title}`, message, false, v.opts("block"));
}

export async function sendEscrowFundedEmail(toEmail: string, toName: string, deal: DealLike): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Good news — the buyer has funded the escrow for <b>${esc(deal.title)}</b> (${money(deal)}).</p>` +
    `<p>The money is now <b>held by Dynopay</b>. You can go ahead and deliver, then mark the deal as delivered on ${v.name}.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Escrow funded — you can deliver: ${deal.title}`, message, false, v.opts("lock"));
}

export async function sendEscrowDeliveredEmail(toEmail: string, toName: string, deal: DealLike, autoReleaseDays: number): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The seller has marked <b>${esc(deal.title)}</b> (${money(deal)}) as <b>delivered</b>.</p>` +
    `<p>Please check you received everything, then confirm to release the funds. If you do nothing, the funds auto-release to the seller in <b>${autoReleaseDays} day(s)</b>. If something is wrong, open a dispute on ${v.name} before then.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Action needed — confirm delivery: ${deal.title}`, message, false, v.opts("truck"));
}

export async function sendEscrowReleasedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The escrow deal <b>${esc(deal.title)}</b> (${money(deal)}) is <b>complete</b> — the funds have been released to the seller.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Deal completed: ${deal.title}`, message, false, v.opts("check"));
}

export async function sendEscrowRefundedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The escrow deal <b>${esc(deal.title)}</b> (${money(deal)}) has been <b>refunded</b> to the buyer.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Deal refunded: ${deal.title}`, message, false, v.opts("refund"));
}

export async function sendEscrowDisputeOpenedEmail(toEmail: string, toName: string, deal: DealLike, raisedBy: string, reason: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>A dispute has been opened on the escrow deal <b>${esc(deal.title)}</b> (${money(deal)}) by the <b>${esc(raisedBy)}</b>.</p>` +
    `<p>Reason: ${esc(reason) || "(none provided)"}</p>` +
    `<p>The auto-release timer is paused. ${v.reviewer[0].toUpperCase() + v.reviewer.slice(1)} will review and resolve the dispute.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute opened: ${deal.title}`, message, false, v.opts("shield-alert"));
}

export async function sendEscrowDisputeResolvedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The dispute on <b>${esc(deal.title)}</b> (${money(deal)}) has been resolved by ${v.reviewer}.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute resolved: ${deal.title}`, message, false, v.opts("shield-green"));
}

export async function sendEscrowOtpEmail(toEmail: string, deal: DealLike, otp: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Use this code to verify your email for the escrow deal <b>${esc(deal.title)}</b> (${money(deal)}):</p>` +
    otpBlock(otp) +
    p("This code expires in 10 minutes. If you didn't request it, you can ignore this email.");
  await sendEmail(toEmail, toEmail, `${otp} is your ${v.name} verification code`, message, false, { ...v.opts("key"), heading: "Your verification code" });
}

export async function sendEscrowPayoutPendingEmail(toEmail: string, toName: string, deal: DealLike, role: string, addUrl: string): Promise<void> {
  const v = voice(deal);
  const what = role === "buyer" ? "refund" : "payout";
  const addr = role === "buyer" ? "refund address" : "stablecoin payout address";
  const message =
    `<p>The escrow deal <b>${esc(deal.title)}</b> (${money(deal)}) has been decided in your favour — your ${what} is ready.</p>` +
    `<p>We just need a <b>${addr}</b> to send it. Your funds are held in a stablecoin and won't lose value while you add it.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Action needed — add a ${addr}: ${deal.title}`, message, false, v.opts("wallet", { text: `Add your ${addr}`, link: addUrl }));
}

export async function sendEscrowPaidEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message = `<p>Your funds for the escrow deal <b>${esc(deal.title)}</b> have been sent.</p><p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Funds sent: ${deal.title}`, message, false, v.opts("payout"));
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
  const v = voice(deal);
  if (kind === "cancellation" && !isCounter) {
    const message =
      `<p>The <b>${esc(fromRole)}</b> has asked to <b>cancel</b> the escrow deal <b>${esc(deal.title)}</b> (${money(deal)}).</p>` +
      `<p>Because the deal is already funded, cancelling needs your agreement. If you agree, the buyer is refunded the held amount <b>minus the escrow fee and network/exchange costs</b> (these are non-refundable).</p>` +
      (note ? `<p>Their note: ${esc(note)}</p>` : "") +
      `<p>You can <b>agree</b>, make a <b>counter-offer</b>, or <b>escalate to ${v.reviewer}</b>.</p>`;
    await sendEmail(toEmail, toName || toEmail, `Cancellation requested: ${deal.title}`, message, false, v.opts("alert", { text: "Review the request", link: inviteUrl }));
    return;
  }
  const lead = isCounter
    ? `The <b>${esc(fromRole)}</b> has made a <b>counter-offer</b> to resolve the dispute on`
    : `The <b>${esc(fromRole)}</b> has opened a dispute and proposed a resolution for`;
  const message =
    `<p>${lead} <b>${esc(deal.title)}</b> (${money(deal)}):</p>` +
    `<p><b>Proposal:</b> ${describeProposal(outcome, splitPercentSeller)}.</p>` +
    (note ? `<p>Their note: ${esc(note)}</p>` : "") +
    `<p>You can <b>accept</b> it, make a <b>counter-offer</b>, or <b>escalate to ${v.reviewer}</b> if you can't reach an agreement.</p>`;
  await sendEmail(toEmail, toName || toEmail, `${isCounter ? "Counter-offer" : "Dispute proposal"}: ${deal.title}`, message, false, v.opts("shield-alert", { text: "Open the dispute", link: inviteUrl }));
}

/** Sent to both parties when a dispute is escalated to admin arbitration. */
export async function sendEscrowDisputeEscalatedEmail(toEmail: string, toName: string, deal: DealLike, byRole: string): Promise<void> {
  const v = voice(deal);
  const how = byRole && byRole !== "system" ? ` by the <b>${esc(byRole)}</b>` : " automatically because no agreement was reached in time";
  const message =
    `<p>The dispute on <b>${esc(deal.title)}</b> (${money(deal)}) has been <b>escalated to ${v.reviewer}</b>${how}.</p>` +
    `<p>We'll review the case (including any messages exchanged) and decide the outcome. Your funds remain held in a stablecoin in the meantime.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute escalated: ${deal.title}`, message, false, v.opts("shield-alert"));
}

/** Sent to both parties when a dispute is resolved by mutual agreement (no admin). */
export async function sendEscrowDisputeAgreedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The dispute on <b>${esc(deal.title)}</b> (${money(deal)}) has been <b>resolved by mutual agreement</b>.</p>` +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Resolved by agreement: ${deal.title}`, message, false, v.opts("shield-green"));
}
