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
import { escapeBasic as esc } from "../../utils/escapeHtml";

const usd = (n: number | string) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Deal emails: footer explains the recipient is a party to a deal. */
const sd = (hero: EmailHero, extra: Partial<SendEmailOptions> = {}): SendEmailOptions => ({ brand: "safedeal", audience: "buyer", hero, ...extra });
/** Account / wallet / security emails: footer explains it's an account notice (no escrow sentence). */
const sdAccount = (hero: EmailHero, extra: Partial<SendEmailOptions> = {}): SendEmailOptions => ({ brand: "safedeal", audience: "account", hero, ...extra });
const walletUrl = () => `${safedealBaseUrl()}/wallet`;
const shortHash = (h: string) => (h.length > 22 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);

/** Blockchain transaction line: monospace hash + optional explorer link. */
export const txHashBlock = (label: string, txHash: string, explorerUrl?: string | null): string => {
  const link = explorerUrl ? ` &nbsp;<a href="${esc(explorerUrl)}" style="color:#0A0A0D;font-weight:600;text-decoration:underline;">View on explorer</a>` : "";
  return p(`${esc(label)}: ${mono(esc(txHash))}${link}`);
};

// ─── Codes ───────────────────────────────────────────────────────────────────

/** What the user is about to do when a step-up code is requested (drives the email copy). */
export type StepUpAction = "cashout" | "address_add" | "address_remove" | "payout_destination" | "change_email";

const STEP_UP_COPY: Record<StepUpAction, { heading: string; what: string; subject: string }> = {
  cashout: { heading: "Confirm your cashout", what: "confirm your cashout from SafeDeal", subject: "confirm your SafeDeal cashout" },
  address_add: { heading: "Confirm your new payout address", what: "confirm adding a payout address to your SafeDeal wallet", subject: "confirm your new SafeDeal payout address" },
  address_remove: { heading: "Confirm removing a payout address", what: "confirm removing a payout address from your SafeDeal wallet", subject: "confirm removing a SafeDeal payout address" },
  payout_destination: { heading: "Confirm your payout destination", what: "confirm where this deal pays you out", subject: "confirm your SafeDeal payout destination" },
  change_email: { heading: "Confirm your email change", what: "confirm changing the email on your SafeDeal account", subject: "confirm your SafeDeal email change" },
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
    otpBlock(code) +
    p("It expires in <b>10 minutes</b>. If you didn't request it, you can safely ignore this email — nothing happens without the code.") +
    (stepUp ? p("<b>Never share this code.</b> SafeDeal staff will never ask you for it.") : "");
  await sendEmail(
    toEmail,
    toEmail,
    stepUp ? `${code} — ${stepUp.subject}` : `${code} is your SafeDeal sign-in code`,
    message,
    false,
    sdAccount("key", { heading: stepUp ? stepUp.heading : "Your sign-in code", lane: "otp", template: `safedeal.${purpose}Code` })
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

/** Alert the OLD mailbox that the account email was changed (account-takeover tripwire). */
export async function sendSafeDealEmailChangedAlertEmail(oldEmail: string, newEmail: string): Promise<void> {
  const message =
    p(`The email address on your SafeDeal account was just changed to <b>${esc(newEmail)}</b>.`) +
    p(`For your security we've <b>signed out every other session</b> and <b>paused cashouts for 24 hours</b>.`) +
    p(`<b>This wasn't you?</b> Contact us through the help centre immediately — while cashouts are paused we can lock the account and reverse the change.`);
  await sendEmail(oldEmail, oldEmail, "Your SafeDeal email address was changed", message, false, sdAccount("key", { heading: "Email address changed" }));
}

/** Ops-only AML tripwire: a customer is cashing out with no funded deals (deposit → withdraw pattern). */
export async function sendSafeDealAmlAlertEmail(
  adminEmail: string,
  info: { customerId: number; email: string | null; amountUsd: number; payoutLabel: string; address: string }
): Promise<void> {
  const message =
    p(`A SafeDeal customer is cashing out with <b>no funded deals</b> — review for possible money-laundering (deposit → withdraw).`) +
    p(`Customer: <b>#${info.customerId}</b> ${info.email ? `(${esc(info.email)})` : ""}`) +
    p(`Amount: <b>${usd(info.amountUsd)}</b> → ${esc(info.payoutLabel)} ${mono(esc(info.address))}`) +
    p(`If it also tripped a limit it has been routed to admin approval; otherwise review the customer's ledger before it settles.`);
  await sendEmail(adminEmail, adminEmail, `⚠️ SafeDeal AML review: customer #${info.customerId} cashing out with no deals`, message, false, sdAccount("wallet", { heading: "AML review needed" }));
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

/** Referral reward / milestone bonus credited (non-cashable SafeDeal fee credit). */
export async function sendSafeDealReferralRewardEmail(
  toEmail: string,
  r: { amount: number; kind: "referral" | "milestone"; friend?: string; friends?: number; balance: number }
): Promise<void> {
  if (!toEmail || /@telegram\.safedeal$/i.test(toEmail)) return;
  const why =
    r.kind === "milestone"
      ? `You reached <b>${r.friends} rewarded friends</b> — here's your milestone bonus.`
      : `<b>${esc(r.friend || "Your friend")}</b> completed their first SafeDeal. Thanks for spreading the word.`;
  const message =
    amountHero(usd(r.amount), { pill: "FEE CREDIT", pillType: "success", sublabel: `Credit balance ${usd(r.balance)}` }) +
    p(why) +
    p(`Fee credit is used automatically on the escrow fee of your next released deal where you pay the fee. It can't be cashed out.`);
  await sendEmail(
    toEmail,
    toEmail,
    r.kind === "milestone" ? `Milestone bonus: ${usd(r.amount)} SafeDeal fee credit` : `You earned ${usd(r.amount)} SafeDeal fee credit`,
    message,
    false,
    sdAccount("wallet", { heading: r.kind === "milestone" ? "Milestone reached" : "Referral reward", cta: { text: "See my rewards", link: `${safedealBaseUrl()}/rewards` } })
  );
}

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


// ─── Admin: cashout awaiting approval (internal, never seen by the customer) ──

/**
 * Internal alert to the Dynopay/SafeDeal admin that a cashout is held for manual approval.
 * The CUSTOMER is never told their cashout is under review — to them it looks like a normal
 * queued cashout — so this email is the only signal. The admin approves/rejects it from the
 * admin panel (/admin/escrow). Fired for manual + auto cashouts of the threshold or more;
 * deal settlement payouts are always automatic and never trigger this.
 */
/**
 * Internal alert to the Dynopay/SafeDeal admin that a NEW user just onboarded on
 * SafeDeal (first email sign-in or first Telegram sign-in creates the customer).
 * Informational only — the user is active immediately.
 */
export async function sendSafeDealNewUserAdminEmail(
  adminEmail: string,
  info: {
    email?: string | null;
    name?: string | null;
    customerId: number;
    method: "email" | "telegram" | "checkout" | "deal";
    brandName?: string | null;
    telegramId?: string | null;
    telegramUsername?: string | null;
    dealRef?: string | null;
  }
): Promise<void> {
  const isPlaceholderEmail = !!info.email && info.email.endsWith("@telegram.safedeal");
  const tgHandle = info.telegramUsername ? `@${String(info.telegramUsername).replace(/^@/, "")}` : null;
  const contact = info.email && !isPlaceholderEmail ? esc(info.email) : tgHandle ? esc(tgHandle) : (info.name ? esc(info.name) : `customer #${info.customerId}`);
  const methodLabel =
    info.method === "telegram"
      ? "Telegram"
      : info.method === "checkout"
        ? `Guest checkout — funded a deal${info.dealRef ? ` (${esc(info.dealRef)})` : ""} before signing in`
        : info.method === "deal"
          ? `Added as a deal party${info.dealRef ? ` (${esc(info.dealRef)})` : ""} — hasn't signed in yet`
          : "Email + one-time code";
  const when = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
  const telegramLines =
    info.method === "telegram"
      ? p(`Telegram username: <b>${tgHandle ? `<a href="https://t.me/${esc(tgHandle.slice(1))}" style="color:inherit;">${esc(tgHandle)}</a>` : "— (none set)"}</b>`) +
        p(`Telegram ID: <b>${info.telegramId ? esc(String(info.telegramId)) : "—"}</b>`)
      : "";
  const message =
    p(`A new user just onboarded on <b>SafeDeal</b>${info.brandName ? ` (${esc(info.brandName)})` : ""}.`) +
    p(`Name: <b>${info.name ? esc(info.name) : "—"}</b>`) +
    p(`Email: <b>${info.email && !isPlaceholderEmail ? esc(info.email) : "— (not added yet)"}</b>`) +
    telegramLines +
    p(`Sign-up method: <b>${methodLabel}</b>`) +
    p(`Customer ID: <b>#${info.customerId}</b>`) +
    p(`When: ${esc(when)}`) +
    p(`This is an informational notice — the account is active and no action is required.`, "color:#6b7280;font-size:13px;");
  await sendEmail(
    adminEmail,
    "Dynopay Admin",
    `New SafeDeal user: ${contact}`,
    message,
    false,
    {
      brand: "safedeal",
      audience: "admin",
      hero: "person",
      heading: "New SafeDeal user",
      cta: { text: "Open SafeDeal admin", link: safedealBaseUrl() },
    }
  );
}

export async function sendSafeDealAdminCashoutApprovalEmail(
  adminEmail: string,
  w: WithdrawalLike,
  networkLabel: string,
  customer: { customer_id: number; email?: string | null; name?: string | null },
  opts: { adminPanelUrl?: string; approvalThresholdUsd?: number; source?: string | null; dealTitle?: string | null } = {}
): Promise<void> {
  const who = customer.email ? esc(customer.email) : `customer #${customer.customer_id}`;
  const kind = opts.source === "auto" ? "auto-cashout" : "cashout";
  const threshold = opts.approvalThresholdUsd ? usd(opts.approvalThresholdUsd) : null;
  const message =
    amountHero(usd(w.amount_usd), {
      pill: "NEEDS APPROVAL",
      pillType: "pending",
      sublabel: `${kind} · customer receives ${usd(w.net_usd)} via ${esc(networkLabel)} (network fee ${usd(w.fee_usd)})`,
    }) +
    p(`A SafeDeal ${kind} of <b>${usd(w.amount_usd)}</b> is held for your approval${threshold ? ` — cashouts of ${threshold} or more are reviewed before they're sent` : ""}.`) +
    p(`Customer: <b>${who}</b> (#${customer.customer_id})`) +
    p(`Cashout: <b>#${w.withdrawal_id}</b> · to ${mono(esc(w.address))}`) +
    p(`Approve or reject it in the admin panel. The customer hasn't been told it's under review — to them it looks like a normal queued cashout.`);
  await sendEmail(
    adminEmail,
    "Dynopay Admin",
    `Action needed — SafeDeal ${kind} #${w.withdrawal_id} (${usd(w.amount_usd)}) awaiting approval`,
    message,
    false,
    {
      brand: "safedeal",
      audience: "admin",
      hero: "payout",
      heading: "Cashout awaiting approval",
      cta: { text: "Review in admin panel", link: opts.adminPanelUrl || safedealBaseUrl() },
    }
  );
}
