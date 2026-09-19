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
  price_currency?: string | null;
  price_amount?: number | string | null;
}

const fmt = (n: number | string) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "300.00 EUR (≈ 344.70 USD)" when priced in another fiat, else "300.00 USD". */
const money = (d: DealLike) =>
  d.price_currency && d.price_currency !== d.currency && d.price_amount != null
    ? `${fmt(d.price_amount)} ${d.price_currency} (≈ ${fmt(d.amount)} ${d.currency})`
    : `${fmt(d.amount)} ${d.currency}`;
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
    otpBlock(otp, deal.source === "safedeal" ? "#FFC61A" : undefined) +
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

// ── Batch 2: request changes / amend ─────────────────────────────────────────

/** Buyer sent the delivery back for changes — seller must re-deliver. */
export async function sendEscrowChangesRequestedEmail(toEmail: string, toName: string, deal: DealLike, request: string, round: number, maxRounds: number, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The buyer has asked for <b>changes</b> on <b>${esc(deal.title)}</b> (${money(deal)}) — round ${round} of ${maxRounds}.</p>` +
    `<p><b>What they need:</b><br/>${esc(request)}</p>` +
    `<p>The inspection timer has been paused and the deal is back to <b>Funded</b>. The money stays held by Dynopay. Make the changes, then mark the deal delivered again on ${v.name}.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Changes requested: ${deal.title}`, message, false, v.opts("alert", { text: "See what changed", link: url }));
}

/** Creator changed the terms before funding — counterparty (re-)accepts. */
export async function sendEscrowAmendedEmail(toEmail: string, toName: string, deal: DealLike, byName: string, changes: string[], needsReaccept: boolean, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>${esc(byName)} has <b>updated the terms</b> of the escrow deal <b>${esc(deal.title)}</b> (${money(deal)}).</p>` +
    `<ul>${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` +
    (needsReaccept
      ? `<p>Because you had already accepted, your acceptance was reset — please review the new terms and accept again before the buyer funds the escrow.</p>`
      : `<p>Review the updated terms on ${v.name} and accept when you're happy.</p>`);
  await sendEmail(toEmail, toName || toEmail, `Terms updated — please review: ${deal.title}`, message, false, v.opts("shield", { text: "Review the new terms", link: url }));
}

// ── Batch 3: once-only reminders ─────────────────────────────────────────────

export async function sendEscrowInviteReminderEmail(toEmail: string, deal: DealLike, fromName: string, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>A quick reminder — ${esc(fromName)} invited you to an escrow deal on ${v.name} a few days ago and it's still waiting for your answer.</p>` +
    dealLine(deal) +
    `<p>Nothing is charged until the buyer funds the escrow. If this isn't for you, you can decline in one click.</p>`;
  await sendEmail(toEmail, toEmail, `Still interested? ${deal.title}`, message, false, v.opts("shield", { text: "Accept or decline", link: url }));
}

export async function sendEscrowUnfundedReminderEmail(toEmail: string, deal: DealLike, buyerPays: number, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Both sides have agreed on <b>${esc(deal.title)}</b> (${money(deal)}) — the only thing left is your payment of <b>${fmt(buyerPays)} USD</b> into escrow.</p>` +
    `<p>The seller won't start until the deal shows <b>Funded</b>. Your money is held by Dynopay and only released when you confirm delivery.</p>`;
  await sendEmail(toEmail, toEmail, `Ready when you are — fund ${deal.title}`, message, false, v.opts("lock", { text: "Fund the escrow", link: url }));
}

export async function sendEscrowInspectionEndingEmail(toEmail: string, deal: DealLike, autoReleaseAt: Date, url: string): Promise<void> {
  const v = voice(deal);
  const when = autoReleaseAt.toUTCString().replace(/:\d\d GMT$/, " UTC");
  const message =
    `<p>Your inspection period for <b>${esc(deal.title)}</b> (${money(deal)}) ends in about <b>24 hours</b> (${esc(when)}).</p>` +
    `<p>If you do nothing, the funds release to the seller automatically. Happy with the delivery? Release now. Something wrong? Ask for changes or open a dispute on ${v.name} before the timer ends.</p>`;
  await sendEmail(toEmail, toEmail, `24 hours left to check: ${deal.title}`, message, false, v.opts("truck", { text: "Review the delivery", link: url }));
}

export async function sendEscrowDeliveryOverdueEmail(toEmail: string, deal: DealLike, role: "buyer" | "seller", dueAt: Date, url: string): Promise<void> {
  const v = voice(deal);
  const due = dueAt.toUTCString().slice(0, 16);
  const message =
    role === "seller"
      ? `<p>The delivery date you agreed for <b>${esc(deal.title)}</b> (${money(deal)}) — <b>${esc(due)}</b> — has passed and the deal isn't marked delivered yet.</p>` +
        `<p>The escrow is funded and waiting. Deliver and mark it delivered on ${v.name}, or message the buyer if you need more time.</p>`
      : `<p>The delivery date agreed for <b>${esc(deal.title)}</b> (${money(deal)}) — <b>${esc(due)}</b> — has passed without the seller marking it delivered.</p>` +
        `<p>Your money is still safely held by Dynopay. You can wait, or request a cancellation / open a dispute on ${v.name}.</p>`;
  await sendEmail(toEmail, toEmail, `Delivery overdue: ${deal.title}`, message, false, v.opts("alert", { text: "Open the deal", link: url }));
}
