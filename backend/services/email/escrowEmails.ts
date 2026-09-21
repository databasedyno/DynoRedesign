/**
 * Escrow lifecycle emails. Thin wrappers over the shared sendEmail() so escrow
 * notifications inherit the branded template automatically.
 *
 * Brand-aware: deals with source='safedeal' render in the SafeDeal chrome and
 * speak purely as SafeDeal ("held securely in SafeDeal escrow"); merchant-dashboard
 * escrow deals keep the Dynopay chrome and custody wording.
 *
 * Every deal email leads with a clean "deal card" (title + amount + the one thing
 * that matters next) so the recipient sees WHAT deal, HOW MUCH and their NEXT STEP
 * at a glance — no wall of text.
 *
 * In the SAFE-MODE preview DISABLE_OUTBOUND_EMAIL=true, so these are no-ops that
 * are logged rather than actually delivered.
 */
import { sendEmail, SendEmailOptions } from "./emailShared";
import { p, otpBlock, infoBox, dataRow, amountHero, type EmailHero } from "../../utils/emailTemplate";

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
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

interface BrandVoice {
  /** Product name used in copy. */
  name: string;
  /** Who arbitrates an escalated dispute. */
  reviewer: string;
  /** How custody is described in-copy (brand-aware — SafeDeal never says "Dynopay"). */
  held: string;
  /** Brand accent used for the deal-card left border. */
  accent: string;
  opts: (hero: EmailHero, cta?: { text: string; link: string }) => SendEmailOptions;
}

const voice = (deal: DealLike): BrandVoice => {
  const sd = deal.source === "safedeal";
  return {
    name: sd ? "SafeDeal" : "Dynopay",
    reviewer: sd ? "the SafeDeal team" : "a Dynopay admin",
    held: sd ? "held securely in SafeDeal escrow" : "held by Dynopay",
    accent: sd ? "#FFC61A" : "#4338CA",
    opts: (hero, cta) => ({ brand: sd ? "safedeal" : "dynopay", audience: sd ? "buyer" : "merchant", hero, cta }),
  };
};

/** Clean deal summary card: title + amount, plus any extra "next step" rows. */
const dealCard = (deal: DealLike, accent: string, extra: Array<[string, string]> = []): string => {
  const rows: Array<[string, string]> = [["Deal", esc(deal.title)], ["Amount", money(deal)], ...extra];
  const body =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">` +
    rows.map(([k, v], i) => dataRow(k, v, i === rows.length - 1)).join("") +
    `</table>`;
  return infoBox(body, accent);
};

export async function sendEscrowInviteEmail(
  toEmail: string,
  toName: string,
  deal: DealLike,
  fromName: string,
  counterpartyRole: string,
  inviteUrl: string
): Promise<void> {
  const v = voice(deal);
  const role = counterpartyRole === "buyer" ? "buyer" : "seller";
  const roleLine =
    role === "buyer"
      ? "Once you accept, you'll pay into escrow — and nothing reaches the seller until you're happy the work is done."
      : "Once you accept, the buyer funds the escrow first — so you only start when the money is already secured.";
  const message =
    `<p>${esc(fromName)} would like to do a deal with you on ${v.name}, with the payment protected by escrow.</p>` +
    dealCard(deal, v.accent, [["Your role", cap(role)]]) +
    `<p>${roleLine} The money is ${v.held} in USDT and is only released when the deal is complete — neither side can walk away with it.</p>`;
  await sendEmail(toEmail, toName || toEmail, `You're invited to a deal: ${deal.title}`, message, false, v.opts("shield", { text: "Review & respond", link: inviteUrl }));
}

export async function sendEscrowAcceptedEmail(toEmail: string, toName: string, deal: DealLike, actorName: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>${esc(actorName)} has <b>accepted</b> the terms — you're all set.</p>` +
    dealCard(deal, v.accent, [["Next step", "The buyer funds the escrow"]]) +
    `<p>We'll email you both the moment the money is ${v.held}, so the seller knows exactly when to start.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Accepted — ${deal.title}`, message, false, v.opts("check"));
}

export async function sendEscrowDeclinedEmail(toEmail: string, toName: string, deal: DealLike, actorName: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>${esc(actorName)} has <b>declined</b> this deal.</p>` +
    dealCard(deal, v.accent) +
    `<p>No money moved and nothing was charged. You can start a fresh deal on ${v.name} whenever you're ready.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Declined — ${deal.title}`, message, false, v.opts("block"));
}

/** Pre-funding cancellation by either party (free — nothing was paid). */
export async function sendEscrowCancelledEmail(toEmail: string, toName: string, deal: DealLike, byRole: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The <b>${esc(byRole)}</b> has <b>cancelled</b> this deal before it was funded.</p>` +
    dealCard(deal, v.accent) +
    `<p>No money moved and nothing was charged. You can start a fresh deal on ${v.name} whenever you're ready.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Cancelled — ${deal.title}`, message, false, v.opts("block"));
}

export async function sendEscrowFundedEmail(toEmail: string, toName: string, deal: DealLike): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Good news — the buyer has funded the escrow. You're clear to start.</p>` +
    amountHero(money(deal), { pill: "FUNDED", pillType: "success", sublabel: cap(v.held) + " (in USDT)" }) +
    dealCard(deal, v.accent, [["Next step", "Deliver, then mark it delivered"]]) +
    `<p>Go ahead and deliver, then mark the deal as delivered on ${v.name} — that starts the buyer's inspection window.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Funded — you're clear to start: ${deal.title}`, message, false, v.opts("lock"));
}

export async function sendEscrowDeliveredEmail(toEmail: string, toName: string, deal: DealLike, autoReleaseDays: number): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The seller has marked this deal as <b>delivered</b> — it's over to you to check it.</p>` +
    dealCard(deal, v.accent, [["Auto-releases in", `${autoReleaseDays} day${autoReleaseDays === 1 ? "" : "s"}`]]) +
    `<p>Happy with everything? Release the payment. If you do nothing, the funds release to the seller automatically when the timer ends. Something not right? Ask for changes or open a dispute on ${v.name} before then.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Please confirm delivery — ${deal.title}`, message, false, v.opts("truck"));
}

export async function sendEscrowReleasedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>This deal is <b>complete</b> — the payment has been released to the seller.</p>` +
    amountHero(money(deal), { pill: "RELEASED", pillType: "success" }) +
    dealCard(deal, v.accent) +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Completed — ${deal.title}`, message, false, v.opts("check"));
}

export async function sendEscrowRefundedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>This deal has been <b>refunded</b> to the buyer.</p>` +
    amountHero(money(deal), { pill: "REFUNDED", pillType: "info" }) +
    dealCard(deal, v.accent) +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Refunded — ${deal.title}`, message, false, v.opts("refund"));
}

export async function sendEscrowDisputeOpenedEmail(toEmail: string, toName: string, deal: DealLike, raisedBy: string, reason: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>A dispute has been opened on this deal by the <b>${esc(raisedBy)}</b>.</p>` +
    dealCard(deal, v.accent, [["Reason", esc(reason) || "None provided"]]) +
    `<p>The auto-release timer is paused while it's sorted out. ${cap(v.reviewer)} will review and resolve it.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute opened — ${deal.title}`, message, false, v.opts("shield-alert"));
}

export async function sendEscrowDisputeResolvedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The dispute on this deal has been resolved by ${v.reviewer}.</p>` +
    dealCard(deal, v.accent) +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute resolved — ${deal.title}`, message, false, v.opts("shield-green"));
}

export async function sendEscrowOtpEmail(toEmail: string, deal: DealLike, otp: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Use this one-time code to verify your email for the deal <b>${esc(deal.title)}</b> (${money(deal)}):</p>` +
    otpBlock(otp, deal.source === "safedeal" ? "#FFC61A" : undefined) +
    p("It expires in 10 minutes. If you didn't request it, you can safely ignore this email.");
  await sendEmail(toEmail, toEmail, `${otp} is your ${v.name} verification code`, message, false, { ...v.opts("key"), heading: "Your verification code" });
}

export async function sendEscrowPayoutPendingEmail(toEmail: string, toName: string, deal: DealLike, role: string, addUrl: string): Promise<void> {
  const v = voice(deal);
  const what = role === "buyer" ? "refund" : "payout";
  const addr = role === "buyer" ? "refund address" : "stablecoin payout address";
  const message =
    `<p>This deal has been decided in your favour — your ${what} is ready to send.</p>` +
    dealCard(deal, v.accent, [["Waiting on", `Your ${addr}`]]) +
    `<p>Add a <b>${addr}</b> and we'll send it straight there. Your funds are held in USDT and won't lose value while you add one.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Add a ${addr} to get paid — ${deal.title}`, message, false, v.opts("wallet", { text: `Add your ${addr}`, link: addUrl }));
}

export async function sendEscrowPaidEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Your funds for this deal are on their way.</p>` +
    dealCard(deal, v.accent) +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Funds sent — ${deal.title}`, message, false, v.opts("payout"));
}

// ── Dispute negotiation (parties settle first; the team is the fallback) ──────

function describeProposal(outcome: string, splitPercentSeller?: number | null): string {
  if (outcome === "release") return "Release the full amount to the seller";
  if (outcome === "refund") return "Refund the full amount to the buyer";
  const s = Number(splitPercentSeller ?? 50);
  return `Split it — seller keeps ${s}%, buyer is refunded ${100 - s}%`;
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
      `<p>The <b>${esc(fromRole)}</b> has asked to <b>cancel</b> this deal.</p>` +
      dealCard(deal, v.accent, note ? [["Their note", esc(note)]] : []) +
      `<p>Because it's already funded, cancelling needs your agreement. If you agree, the buyer is refunded the held amount <b>minus the cancellation fee and the real network / exchange costs</b> (those aren't refundable).</p>` +
      `<p>You can <b>agree</b>, make a <b>counter-offer</b>, or <b>escalate to ${v.reviewer}</b>.</p>`;
    await sendEmail(toEmail, toName || toEmail, `Cancellation requested — ${deal.title}`, message, false, v.opts("alert", { text: "Review the request", link: inviteUrl }));
    return;
  }
  const lead = isCounter
    ? `The <b>${esc(fromRole)}</b> has made a <b>counter-offer</b> to settle this dispute.`
    : `The <b>${esc(fromRole)}</b> has opened a dispute and proposed how to settle it.`;
  const rows: Array<[string, string]> = [["Proposal", describeProposal(outcome, splitPercentSeller)]];
  if (note) rows.push(["Their note", esc(note)]);
  const message =
    `<p>${lead}</p>` +
    dealCard(deal, v.accent, rows) +
    `<p>You can <b>accept</b> it, send a <b>counter-offer</b>, or <b>escalate to ${v.reviewer}</b> if you can't reach an agreement.</p>`;
  await sendEmail(toEmail, toName || toEmail, `${isCounter ? "Counter-offer" : "Dispute proposal"} — ${deal.title}`, message, false, v.opts("shield-alert", { text: "Open the dispute", link: inviteUrl }));
}

/** Sent to both parties when a dispute is escalated to team arbitration. */
export async function sendEscrowDisputeEscalatedEmail(toEmail: string, toName: string, deal: DealLike, byRole: string): Promise<void> {
  const v = voice(deal);
  const how = byRole && byRole !== "system" ? ` by the <b>${esc(byRole)}</b>` : " automatically, because no agreement was reached in time";
  const message =
    `<p>This dispute has been <b>escalated to ${v.reviewer}</b>${how}.</p>` +
    dealCard(deal, v.accent) +
    `<p>We'll review the case — including any messages you've exchanged — and decide the outcome. Your funds stay ${v.held} in USDT in the meantime.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Dispute escalated — ${deal.title}`, message, false, v.opts("shield-alert"));
}

/** Sent to both parties when a dispute is resolved by mutual agreement (no arbitration). */
export async function sendEscrowDisputeAgreedEmail(toEmail: string, toName: string, deal: DealLike, summary: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Nice — you've <b>settled this dispute between yourselves</b>, no arbitration needed.</p>` +
    dealCard(deal, v.accent) +
    `<p>${summary}</p>`;
  await sendEmail(toEmail, toName || toEmail, `Settled by agreement — ${deal.title}`, message, false, v.opts("shield-green"));
}

// ── Batch 2: request changes / amend ─────────────────────────────────────────

/** Buyer sent the delivery back for changes — seller must re-deliver. */
export async function sendEscrowChangesRequestedEmail(toEmail: string, toName: string, deal: DealLike, request: string, round: number, maxRounds: number, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>The buyer has asked for <b>changes</b> before releasing payment.</p>` +
    dealCard(deal, v.accent, [["Revision", `Round ${round} of ${maxRounds}`], ["What they need", esc(request)]]) +
    `<p>The inspection timer is paused and the deal is back to <b>Funded</b> — the money stays ${v.held}. Make the changes, then mark it delivered again on ${v.name}.</p>`;
  await sendEmail(toEmail, toName || toEmail, `Changes requested — ${deal.title}`, message, false, v.opts("alert", { text: "See what changed", link: url }));
}

/** Creator changed the terms before funding — counterparty (re-)accepts. */
export async function sendEscrowAmendedEmail(toEmail: string, toName: string, deal: DealLike, byName: string, changes: string[], needsReaccept: boolean, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>${esc(byName)} has <b>updated the terms</b> of this deal.</p>` +
    dealCard(deal, v.accent) +
    `<p><b>What changed:</b></p><ul>${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` +
    (needsReaccept
      ? `<p>Because you'd already accepted, your acceptance was reset — please review the new terms and accept again before the buyer funds the escrow.</p>`
      : `<p>Review the updated terms on ${v.name} and accept when you're happy.</p>`);
  await sendEmail(toEmail, toName || toEmail, `Terms updated — please review: ${deal.title}`, message, false, v.opts("shield", { text: "Review the new terms", link: url }));
}

// ── Batch 3: once-only reminders ─────────────────────────────────────────────

export async function sendEscrowInviteReminderEmail(toEmail: string, deal: DealLike, fromName: string, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>Just a nudge — ${esc(fromName)} invited you to a deal on ${v.name} a few days ago, and it's still waiting on you.</p>` +
    dealCard(deal, v.accent) +
    `<p>Nothing is charged until the buyer funds the escrow. Not for you? You can decline in one click.</p>`;
  await sendEmail(toEmail, toEmail, `Still interested? ${deal.title}`, message, false, v.opts("shield", { text: "Accept or decline", link: url }));
}

export async function sendEscrowUnfundedReminderEmail(toEmail: string, deal: DealLike, buyerPays: number, url: string): Promise<void> {
  const v = voice(deal);
  const message =
    `<p>You're both agreed — the only thing left is your payment into escrow.</p>` +
    dealCard(deal, v.accent, [["You pay", `${fmt(buyerPays)} USD`]]) +
    `<p>The seller won't start until the deal shows <b>Funded</b>. Your payment is ${v.held} and only released once you confirm delivery.</p>`;
  await sendEmail(toEmail, toEmail, `Ready when you are — fund ${deal.title}`, message, false, v.opts("lock", { text: "Fund the escrow", link: url }));
}

export async function sendEscrowInspectionEndingEmail(toEmail: string, deal: DealLike, autoReleaseAt: Date, url: string): Promise<void> {
  const v = voice(deal);
  const when = autoReleaseAt.toUTCString().replace(/:\d\d GMT$/, " UTC");
  const message =
    `<p>Heads up — your inspection window is nearly up.</p>` +
    dealCard(deal, v.accent, [["Auto-releases", esc(when)]]) +
    `<p>Do nothing and the funds release to the seller automatically. Happy with the delivery? Release now. Something wrong? Ask for changes or open a dispute on ${v.name} before the timer ends.</p>`;
  await sendEmail(toEmail, toEmail, `About 24 hours left to check — ${deal.title}`, message, false, v.opts("truck", { text: "Review the delivery", link: url }));
}

export async function sendEscrowDeliveryOverdueEmail(toEmail: string, deal: DealLike, role: "buyer" | "seller", dueAt: Date, url: string): Promise<void> {
  const v = voice(deal);
  const due = dueAt.toUTCString().slice(0, 16);
  const message =
    role === "seller"
      ? `<p>The delivery date you agreed has passed and this deal isn't marked delivered yet.</p>` +
        dealCard(deal, v.accent, [["Due", esc(due)]]) +
        `<p>The escrow is funded and waiting. Deliver and mark it delivered on ${v.name}, or message the buyer if you need a little more time.</p>`
      : `<p>The delivery date has passed without the seller marking this deal delivered.</p>` +
        dealCard(deal, v.accent, [["Due", esc(due)]]) +
        `<p>Your money is still ${v.held}. You can wait, or request a cancellation or open a dispute on ${v.name}.</p>`;
  await sendEmail(toEmail, toEmail, `Delivery overdue — ${deal.title}`, message, false, v.opts("alert", { text: "Open the deal", link: url }));
}
