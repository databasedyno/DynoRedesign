/**
 * SafeDeal transactional emails (sign-in / step-up codes, payout-address alerts, cashouts,
 * wallet top-ups, deal invoices). Rendered in the SafeDeal chrome; no-ops when
 * DISABLE_OUTBOUND_EMAIL=true.
 *
 * Vocabulary (2026-09 audit): the user-facing word for moving money out of the SafeDeal
 * wallet is "cashout" — never "withdrawal" / "wallet action". Money that leaves to a
 * seller/buyer straight from a closed deal is a "deal payout". Wherever a blockchain
 * transaction exists we show its hash + explorer link.
 */
import { sendEmail, SendEmailOptions } from "./emailShared";
import { amountHero, mono, otpBlock, p, safedealBaseUrl, type EmailHero } from "../../utils/emailTemplate";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const usd = (n: number | string) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Deal emails: footer explains the recipient is a party to a deal. */
const sd = (hero: EmailHero, extra: Partial<SendEmailOptions> = {}): SendEmailOptions => ({ brand: "safedeal", audience: "buyer", hero, ...extra });
/** Account / wallet / security emails: footer explains it's an account notice (no escrow sentence). */
const sdAccount = (hero: EmailHero, extra: Partial<SendEmailOptions> = {}): SendEmailOptions => ({ brand: "safedeal", audience: "account", hero, ...extra });
const walletUrl = () => `${safedealBaseUrl()}/wallet`;
const shortHash = (h: string) => (h.length > 22 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);

/** Blockchain transaction line: monospace hash + optional explorer link. */
export const txHashBlock = (label: string, txHash: string, explorerUrl?: string | null): string => {
  const link = explorerUrl ? ` &nbsp;<a href="${esc(explorerUrl)}" style="color:#B77E00;font-weight:700;text-decoration:underline;">View on explorer</a>` : "";
  return p(`${esc(label)}: ${mono(esc(txHash))}${link}`);
};

// ─── Codes ───────────────────────────────────────────────────────────────────

/** What the user is about to do when a step-up code is requested (drives the email copy). */
export type StepUpAction = "cashout" | "address_add" | "address_remove" | "payout_destination";

const STEP_UP_COPY: Record<StepUpAction, { heading: string; what: string; subject: string }> = {
  cashout: { heading: "Confirm your cashout", what: "confirm your cashout from SafeDeal", subject: "confirm your SafeDeal cashout" },
  address_add: { heading: "Confirm your new payout address", what: "confirm adding a payout address to your SafeDeal wallet", subject: "confirm your new SafeDeal payout address" },
  address_remove: { heading: "Confirm removing a payout address", what: "confirm removing a payout address from your SafeDeal wallet", subject: "confirm removing a SafeDeal payout address" },
  payout_destination: { heading: "Confirm your payout destination", what: "confirm where this deal pays you out", subject: "confirm your SafeDeal payout destination" },
};

export async function sendSafeDealCodeEmail(
  toEmail: string,
  code: string,
  purpose: "signin" | "stepup",
  action?: StepUpAction | string | null
): Promise<void> {
  const stepUp = purpose === "stepup"
    ? (STEP_UP_COPY[action as StepUpAction] ?? { heading: "Confirm this wallet change", what: "confirm this change to your SafeDeal wallet", subject: "confirm your SafeDeal wallet change" })
    : null;
  const what = stepUp ? stepUp.what : "sign in to SafeDeal";
  const message =
    p(`Use this one-time code to ${what}:`) +
    otpBlock(code, "#FFC61A") +
    p("It expires in <b>10 minutes</b>. If you didn't request it, you can safely ignore this email — nothing happens without the code.") +
    (stepUp ? p("<b>Never share this code.</b> SafeDeal staff will never ask you for it.") : "");
  await sendEmail(
    toEmail,
    toEmail,
    stepUp ? `${code} — ${stepUp.subject}` : `${code} is your SafeDeal sign-in code`,
    message,
    false,
    sdAccount("key", { heading: stepUp ? stepUp.heading : "Your sign-in code" })
  );
}

// ─── Payout addresses ────────────────────────────────────────────────────────

export async function sendSafeDealAddressAlertEmail(toEmail: string, action: "added" | "removed", label: string, address: string): Promise<void> {
  const message =
    p(`A payout address was <b>${action}</b> on your SafeDeal wallet:`) +
    p(`<b>${esc(label)}</b><br/>${mono(esc(address))}`) +
    p(`<b>This wasn't you?</b> Sign in and ${action === "added" ? "remove the address" : "review your addresses"} straight away, then contact us through the help centre — we'll freeze cashouts on your wallet while we check.`);
  await sendEmail(toEmail, toEmail, `Payout address ${action} on your SafeDeal wallet`, message, false, sdAccount(action === "added" ? "wallet" : "trash", { cta: { text: "Review my wallet", link: walletUrl() } }));
}

// ─── Cashouts & deal payouts ─────────────────────────────────────────────────

export interface WithdrawalLike {
  withdrawal_id: number;
  amount_usd: string | number;
  fee_usd: string | number;
  net_usd: string | number;
  address: string;
  status: string;
  requires_approval: boolean;
  rejected_reason?: string | null;
  /** 'settlement' = paid straight from a closed deal; anything else = user-requested cashout. */
  source?: string | null;
  escrow_id?: number | null;
  /** Real blockchain hash once the exchange has broadcast (null right after dispatch). */
  chain_tx_hash?: string | null;
}

export interface CashoutEmailOptions {
  /** Manual-review threshold in USD (for the "under review" explanation). */
  approvalThresholdUsd?: number;
  /** Deal title when the payout comes straight from a closed deal. */
  dealTitle?: string | null;
  /** Explorer URL for chain_tx_hash when already known. */
  explorerUrl?: string | null;
}

const isDealPayout = (w: WithdrawalLike) => w.source === "settlement";
const noun = (w: WithdrawalLike) => (isDealPayout(w) ? "deal payout" : "cashout");
const Noun = (w: WithdrawalLike) => (isDealPayout(w) ? "Deal payout" : "Cashout");

export async function sendSafeDealWithdrawalEmail(toEmail: string, w: WithdrawalLike, networkLabel: string, opts: CashoutEmailOptions = {}): Promise<void> {
  const sent = w.status === "sent";
  const pending = w.status === "pending_approval";
  const pill = sent ? "SENT" : pending ? "UNDER REVIEW" : "QUEUED";
  const ref = `<b>#${w.withdrawal_id}</b>`;
  const dealLine = isDealPayout(w) && opts.dealTitle ? p(`Deal: <b>${esc(opts.dealTitle)}</b>${w.escrow_id ? ` (#${w.escrow_id})` : ""}`) : "";
  const threshold = opts.approvalThresholdUsd ? usd(opts.approvalThresholdUsd) : "the review threshold";
  const intro = sent
    ? `Your ${noun(w)} ${ref} has been handed to the network. ` +
      (w.chain_tx_hash
        ? "The blockchain transaction is below."
        : "We'll email you the blockchain transaction hash as soon as the network confirms it — usually within a few minutes.")
    : pending
    ? `Your ${noun(w)} ${ref} is being reviewed by our team — ${noun(w)}s above ${threshold} are checked manually. You'll get another email once it's sent.`
    : `Your ${noun(w)} ${ref} is queued and will be sent shortly.`;
  const message =
    amountHero(usd(w.amount_usd), { pill, pillType: sent ? "success" : "pending", sublabel: `You receive ${usd(w.net_usd)} via ${esc(networkLabel)} (network fee ${usd(w.fee_usd)})` }) +
    dealLine +
    p(intro) +
    p(`To: ${mono(esc(w.address))}`) +
    (sent && w.chain_tx_hash ? txHashBlock("Transaction", w.chain_tx_hash, opts.explorerUrl) : "");
  const statusWord = sent ? "sent" : pending ? "under review" : "queued";
  await sendEmail(
    toEmail,
    toEmail,
    `SafeDeal ${noun(w)} #${w.withdrawal_id} — ${statusWord}`,
    message,
    false,
    sdAccount("payout", { heading: `${Noun(w)} ${statusWord}`, cta: { text: "Open my wallet", link: walletUrl() } })
  );
}

/** Follow-up once the exchange has broadcast: the real blockchain transaction + explorer link. */
export async function sendSafeDealCashoutConfirmedEmail(
  toEmail: string,
  w: WithdrawalLike,
  networkLabel: string,
  chain: { txHash: string; explorerUrl?: string | null; confirmedAt?: Date | string | null },
  opts: CashoutEmailOptions = {}
): Promise<{ suppressed?: boolean } | unknown> {
  const dealLine = isDealPayout(w) && opts.dealTitle ? p(`Deal: <b>${esc(opts.dealTitle)}</b>${w.escrow_id ? ` (#${w.escrow_id})` : ""}`) : "";
  const message =
    amountHero(usd(w.net_usd), { pill: "ON-CHAIN", pillType: "success", sublabel: `${Noun(w)} #${w.withdrawal_id} via ${esc(networkLabel)}` }) +
    dealLine +
    p(`Your ${noun(w)} of <b>${usd(w.net_usd)}</b> has been confirmed on the blockchain and is in your wallet:`) +
    p(`To: ${mono(esc(w.address))}`) +
    txHashBlock("Transaction", chain.txHash, chain.explorerUrl) +
    p(`Don't see it yet? Some wallets take a few minutes to display new ${esc(networkLabel)} transfers — the explorer link above is the source of truth.`);
  return sendEmail(
    toEmail,
    toEmail,
    `SafeDeal ${noun(w)} #${w.withdrawal_id} confirmed on-chain · ${shortHash(chain.txHash)}`,
    message,
    false,
    sdAccount("payout", { heading: `${Noun(w)} confirmed on-chain`, cta: { text: "Open my wallet", link: walletUrl() } })
  );
}

export async function sendSafeDealWithdrawalRejectedEmail(toEmail: string, w: WithdrawalLike, networkLabel: string, opts: CashoutEmailOptions = {}): Promise<void> {
  const dealLine = isDealPayout(w) && opts.dealTitle ? p(`Deal: <b>${esc(opts.dealTitle)}</b>${w.escrow_id ? ` (#${w.escrow_id})` : ""}`) : "";
  const message =
    amountHero(usd(w.amount_usd), { pill: "RETURNED", pillType: "error", sublabel: `${Noun(w)} #${w.withdrawal_id} via ${esc(networkLabel)}` }) +
    dealLine +
    p(`We couldn't send this ${noun(w)}, so the <b>full ${usd(w.amount_usd)}</b> is back in your available balance — nothing was deducted.`) +
    (w.rejected_reason ? p(`Reason: ${esc(w.rejected_reason)}`) : "") +
    p(`To: ${mono(esc(w.address))}`) +
    p("You can request a new cashout any time — double-check the address and network first.");
  await sendEmail(toEmail, toEmail, `SafeDeal ${noun(w)} #${w.withdrawal_id} — returned to your balance`, message, false, sdAccount("wallet-red", { heading: `${Noun(w)} returned`, cta: { text: "Open my wallet", link: walletUrl() } }));
}

// ─── Top-ups & invoices ──────────────────────────────────────────────────────

const pdfAttachment = (name: string, pdf: Buffer) => ({ name, content: pdf.toString("base64"), contentType: "application/pdf" });

/** Wallet top-up credited — send the branded deposit receipt PDF (DEP-<id>) + the funding tx. */
export async function sendSafeDealDepositReceiptEmail(
  toEmail: string,
  t: { topup_id: number; amount_usd: string | number; pays_usd: string | number; seen_tx?: string | null },
  coinLabel: string,
  network: string,
  pdf: Buffer,
  chain?: { txHash?: string | null; explorerUrl?: string | null }
): Promise<void> {
  const txHash = chain?.txHash || t.seen_tx || null;
  const message =
    amountHero(usd(t.amount_usd), { pill: "CREDITED", pillType: "success", sublabel: `Top-up via ${esc(coinLabel)} · ${esc(network)}` }) +
    p(`Your wallet top-up is credited. Your receipt <b>DEP-${t.topup_id}</b> is attached, with the full fee breakdown.`) +
    p(`You sent ${usd(t.pays_usd)} · credited <b>${usd(t.amount_usd)}</b> to your SafeDeal balance.`) +
    (txHash ? txHashBlock("Funding transaction", txHash, chain?.explorerUrl) : "");
  await sendEmail(
    toEmail,
    toEmail,
    `Your SafeDeal top-up receipt — DEP-${t.topup_id}`,
    message,
    false,
    sdAccount("receipt", { heading: "Top-up credited", cta: { text: "Open my wallet", link: walletUrl() }, attachments: [pdfAttachment(`safedeal-topup-${t.topup_id}.pdf`, pdf)] })
  );
}

/** A deal reached its final outcome — send the party their branded SafeDeal invoice PDF (SD-<id>). */
export async function sendSafeDealDealInvoiceEmail(
  toEmail: string,
  deal: { escrow_id: number; title: string; deal_token: string; outcome?: string | null },
  pdf: Buffer,
  role: "buyer" | "seller"
): Promise<void> {
  const outcomeWord = deal.outcome === "refund" ? "refunded" : deal.outcome === "split" ? "split" : "completed";
  const message =
    p(`Deal <b>#${deal.escrow_id}</b> — &ldquo;${esc(deal.title)}&rdquo; is <b>${outcomeWord}</b>. Your SafeDeal invoice <b>SD-${deal.escrow_id}</b> is attached, with the itemised fees and costs.`) +
    p(role === "seller"
      ? "Funds released to you are in your SafeDeal wallet — or already on their way to your payout address if auto-cashout is on (you'll get a separate email with the blockchain transaction)."
      : "Any refund from this deal is in your SafeDeal wallet balance — or on its way to your payout address if auto-cashout is on.");
  await sendEmail(
    toEmail,
    toEmail,
    `Your SafeDeal invoice SD-${deal.escrow_id} — ${outcomeWord}`,
    message,
    false,
    sd("receipt", { heading: `Invoice SD-${deal.escrow_id}`, cta: { text: "Open the deal", link: `${safedealBaseUrl()}/deal/${deal.deal_token}` }, attachments: [pdfAttachment(`safedeal-invoice-${deal.escrow_id}.pdf`, pdf)] })
  );
}
