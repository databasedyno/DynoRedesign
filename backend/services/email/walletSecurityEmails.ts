/**
 * Wallet security emails — payout-address CHANGE alert (with a one-tap
 * "this wasn't me" revert link) and the follow-up "account secured" notice.
 *
 * These are additive to walletEmails.ts and surfaced through the emailService
 * facade (export * in services/emailService.ts).
 */
import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { p, infoBox, dataRow, warnText, alertBox, mono } from "../../utils/emailTemplate";
import { dynoPayEmailTemplate, escapeHtml, FRONTEND_BASE_URL } from "./emailShared";
import { firstNameOnly } from "../../utils/emailI18n";

export interface WalletChangeRow {
  network: string;
  address: string; // already masked
  actionLabel: string; // "added" | "updated"
}

/**
 * Sent immediately whenever a payout wallet address is added or changed.
 * Doubles as a friendly confirmation AND a security net: the button reverts
 * the change and locks further wallet edits.
 */
export const sendWalletChangeAlertEmail = async (
  email: string,
  name: string,
  data: { companyName?: string | null; rows: WalletChangeRow[]; revertUrl: string },
  _lang?: string | null,
) => {
  try {
    const { companyName, rows, revertUrl } = data;
    const multiple = rows.length > 1;
    const brand = escapeHtml(companyName || "your brand");
    const tableRows = rows
      .map((r, i) =>
        dataRow(
          escapeHtml(r.network),
          `${mono(escapeHtml(r.address))} <span style="color:#6b7280;font-size:12px;">(${escapeHtml(r.actionLabel)})</span>`,
          i === rows.length - 1,
        ),
      )
      .join("");

    const subject = multiple
      ? "Your payout wallets were changed"
      : `Your ${escapeHtml(rows[0]?.network || "payout")} wallet was changed`;

    const content = `${p(name ? `Hey ${escapeHtml(firstNameOnly(name))},` : "Hey there,")}
    ${p(`The payout ${multiple ? "wallets" : "wallet"} for <strong>${brand}</strong> ${multiple ? "were" : "was"} just updated. Here ${multiple ? "are" : "is"} the ${multiple ? "details" : "detail"}:`)}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>`, "#f59e0b")}
    ${p("If you made this change, you're all set — no action is needed.")}
    ${alertBox("Didn't do this? Tap the button below to instantly undo it and lock further wallet changes on your account.")}`;

    const html = dynoPayEmailTemplate(
      "Payout wallet changed",
      content,
      true,
      "This wasn't me — undo & lock",
      revertUrl,
      "If this wasn't you, undo it in one tap and lock wallet changes.",
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Wallet change alert sent to ${email} (${rows.length} row(s))`);
  } catch (e) {
    apiLogger.error("Wallet change alert email error:", e);
  }
};

/**
 * Sent after a merchant clicks "this wasn't me": the change was reverted and
 * wallet management is locked pending a support unlock.
 */
export const sendWalletSecuredEmail = async (
  email: string,
  name: string,
  data: { companyName?: string | null; networks: string[] },
  _lang?: string | null,
) => {
  try {
    const brand = escapeHtml(data.companyName || "your brand");
    const nets = (data.networks || []).map(escapeHtml).join(", ");
    const subject = "We've secured your account";
    const content = `${p(name ? `Hey ${escapeHtml(firstNameOnly(name))},` : "Hey there,")}
    ${p(`As requested, we've undone the recent payout wallet change${data.networks.length > 1 ? "s" : ""} for <strong>${brand}</strong> and <strong>locked further wallet changes</strong> on your account.`)}
    ${nets ? infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dataRow("Networks restored", nets, true)}</table>`, "#12B76A") : ""}
    ${warnText("For your safety, new payout wallets can't be added or edited until you contact support and confirm it's really you.")}
    ${p("We also recommend changing your account password if you suspect it was compromised.")}`;
    const html = dynoPayEmailTemplate(
      "Account secured",
      content,
      true,
      "Contact support",
      `${FRONTEND_BASE_URL}/help-support`,
      "We've undone the wallet change and locked further edits on your account.",
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Wallet secured notice sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet secured email error:", e);
  }
};
