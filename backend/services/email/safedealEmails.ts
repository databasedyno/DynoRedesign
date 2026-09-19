/**
 * SafeDeal transactional emails (sign-in code, payout-address alerts, withdrawals).
 * Rendered in the SafeDeal chrome; no-ops when DISABLE_OUTBOUND_EMAIL=true.
 */
import { sendEmail, SendEmailOptions } from "./emailShared";
import { amountHero, mono, otpBlock, p, safedealBaseUrl, type EmailHero } from "../../utils/emailTemplate";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const usd = (n: number | string) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sd = (hero: EmailHero, extra: Partial<SendEmailOptions> = {}): SendEmailOptions => ({ brand: "safedeal", audience: "buyer", hero, ...extra });
const walletUrl = () => `${safedealBaseUrl()}/wallet`;

export async function sendSafeDealCodeEmail(toEmail: string, code: string, purpose: "signin" | "stepup"): Promise<void> {
  const what = purpose === "signin" ? "sign in to SafeDeal" : "confirm this wallet action on SafeDeal";
  const message =
    p(`Use this one-time code to ${what}:`) +
    otpBlock(code) +
    p("It expires in <b>10 minutes</b>. If you didn't request it, you can safely ignore this email — nothing happens without the code.");
  await sendEmail(
    toEmail,
    toEmail,
    purpose === "signin" ? `${code} is your SafeDeal sign-in code` : `${code} — confirm your SafeDeal wallet action`,
    message,
    false,
    sd("key", { heading: purpose === "signin" ? "Your sign-in code" : "Confirm your wallet action" })
  );
}

export async function sendSafeDealAddressAlertEmail(toEmail: string, action: "added" | "removed", label: string, address: string): Promise<void> {
  const message =
    p(`A payout address was <b>${action}</b> on your SafeDeal wallet:`) +
    p(`<b>${esc(label)}</b><br/>${mono(esc(address))}`) +
    p(`<b>This wasn't you?</b> Sign in and remove the address straight away, then contact us through the help centre — we'll freeze withdrawals on your wallet while we check.`);
  await sendEmail(toEmail, toEmail, `Payout address ${action} on your SafeDeal wallet`, message, false, sd(action === "added" ? "wallet" : "trash", { cta: { text: "Review my wallet", link: walletUrl() } }));
}

interface WithdrawalLike {
  withdrawal_id: number;
  amount_usd: string | number;
  fee_usd: string | number;
  net_usd: string | number;
  address: string;
  status: string;
  requires_approval: boolean;
  rejected_reason?: string | null;
}

export async function sendSafeDealWithdrawalEmail(toEmail: string, w: WithdrawalLike, networkLabel: string): Promise<void> {
  const sent = w.status === "sent";
  const pending = w.status === "pending_approval";
  const pill = sent ? "SENT" : pending ? "UNDER REVIEW" : "QUEUED";
  const intro = sent
    ? `Your withdrawal <b>#${w.withdrawal_id}</b> is on its way.`
    : pending
    ? `Your withdrawal <b>#${w.withdrawal_id}</b> is being reviewed by our team — withdrawals above the review threshold are checked manually. You'll get another email once it's sent.`
    : `Your withdrawal <b>#${w.withdrawal_id}</b> is queued and will be sent shortly.`;
  const message =
    amountHero(usd(w.amount_usd), { pill, pillType: sent ? "success" : "pending", sublabel: `You receive ${usd(w.net_usd)} via ${esc(networkLabel)} (network fee ${usd(w.fee_usd)})` }) +
    p(intro) +
    p(`To: ${mono(esc(w.address))}`);
  await sendEmail(toEmail, toEmail, `SafeDeal withdrawal #${w.withdrawal_id} — ${w.status.replace("_", " ")}`, message, false, sd("payout", { heading: sent ? "Withdrawal sent" : pending ? "Withdrawal under review" : "Withdrawal queued", cta: { text: "Open my wallet", link: walletUrl() } }));
}

export async function sendSafeDealWithdrawalRejectedEmail(toEmail: string, w: WithdrawalLike, networkLabel: string): Promise<void> {
  const message =
    amountHero(usd(w.amount_usd), { pill: "RETURNED", pillType: "error", sublabel: `Withdrawal #${w.withdrawal_id} via ${esc(networkLabel)}` }) +
    p(`We couldn't send this withdrawal, so the <b>full ${usd(w.amount_usd)}</b> is back in your available balance.`) +
    (w.rejected_reason ? p(`Reason: ${esc(w.rejected_reason)}`) : "") +
    p(`To: ${mono(esc(w.address))}`) +
    p("You can request a new withdrawal any time — double-check the address and network first.");
  await sendEmail(toEmail, toEmail, `SafeDeal withdrawal #${w.withdrawal_id} — returned to your balance`, message, false, sd("wallet-red", { heading: "Withdrawal returned", cta: { text: "Open my wallet", link: walletUrl() } }));
}
