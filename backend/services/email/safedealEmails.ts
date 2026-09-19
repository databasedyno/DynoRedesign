/**
 * SafeDeal transactional emails (sign-in code, payout-address alerts, withdrawals).
 * Thin wrappers over the shared sendEmail() — no-ops when DISABLE_OUTBOUND_EMAIL=true.
 */
import { sendEmail } from "./emailShared";

const brand = "SafeDeal";

export async function sendSafeDealCodeEmail(toEmail: string, code: string, purpose: "signin" | "stepup"): Promise<void> {
  const what = purpose === "signin" ? "sign in to SafeDeal" : "confirm this sensitive action on SafeDeal";
  const message =
    `<p>Use this one-time code to ${what}:</p>` +
    `<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0">${code}</p>` +
    `<p>It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>` +
    `<p style="color:#6b7280;font-size:12px">${brand} is powered by Dynopay.</p>`;
  await sendEmail(toEmail, toEmail, purpose === "signin" ? `${code} is your SafeDeal sign-in code` : `${code} — confirm your SafeDeal action`, message);
}

export async function sendSafeDealAddressAlertEmail(
  toEmail: string,
  action: "added" | "removed",
  label: string,
  address: string
): Promise<void> {
  const message =
    `<p>A payout address was <b>${action}</b> on your SafeDeal wallet:</p>` +
    `<p><b>${label}</b><br/><code>${address}</code></p>` +
    `<p><b>This wasn't me?</b> Reply to this email immediately or contact support@dynopay.com — we'll freeze withdrawals on your wallet while we check.</p>` +
    `<p style="color:#6b7280;font-size:12px">${brand} is powered by Dynopay.</p>`;
  await sendEmail(toEmail, toEmail, `Payout address ${action} on your SafeDeal wallet`, message);
}

export async function sendSafeDealWithdrawalEmail(
  toEmail: string,
  w: { withdrawal_id: number; amount_usd: string | number; fee_usd: string | number; net_usd: string | number; address: string; status: string; requires_approval: boolean },
  networkLabel: string
): Promise<void> {
  const status =
    w.status === "sent"
      ? "has been sent"
      : w.status === "pending_approval"
      ? "is awaiting a quick review by our operations team (withdrawals above the review threshold are checked manually)"
      : "is queued";
  const message =
    `<p>Your withdrawal <b>#${w.withdrawal_id}</b> of <b>${Number(w.amount_usd).toFixed(2)} USD</b> ${status}.</p>` +
    `<p>Network fee: ${Number(w.fee_usd).toFixed(2)} USD · You receive: <b>${Number(w.net_usd).toFixed(2)}</b> via ${networkLabel}<br/>` +
    `To: <code>${w.address}</code></p>` +
    `<p style="color:#6b7280;font-size:12px">${brand} is powered by Dynopay.</p>`;
  await sendEmail(toEmail, toEmail, `SafeDeal withdrawal #${w.withdrawal_id} — ${w.status.replace("_", " ")}`, message);
}
