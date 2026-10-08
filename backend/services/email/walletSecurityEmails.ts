/**
 * Payout address security emails — payout-address CHANGE alert (with a one-tap
 * "this wasn't me" revert link) and the follow-up "account secured" notice.
 * Fully localized (6 languages) via the walletSecurity.* catalog.
 *
 * These are additive to walletEmails.ts and surfaced through the emailService
 * facade (export * in services/emailService.ts).
 */
import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { p, infoBox, dataRow, warnText, alertBox, mono } from "../../utils/emailTemplate";
import { dynoPayEmailTemplate, escapeHtml, greetingLine, FRONTEND_BASE_URL } from "./emailShared";
import { t, resolveEmailLang } from "../../utils/emailI18n";

export interface WalletChangeRow {
  network: string;
  address: string; // already masked
  actionLabel: string; // "added" | "updated"
}

const wk = (key: string) => `walletSecurity.${key}`;

/** Localize the raw action label ("added"/"updated") passed by the caller. */
const localizeAction = (L: string, actionLabel: string): string => {
  const a = String(actionLabel || "").trim().toLowerCase();
  if (a === "added") return t(wk("actionAdded"), L);
  if (a === "updated") return t(wk("actionUpdated"), L);
  return escapeHtml(actionLabel);
};

/**
 * Sent immediately whenever a payout address is added or changed.
 * Doubles as a friendly confirmation AND a security net: the button reverts
 * the change and locks further wallet edits.
 */
export const sendWalletChangeAlertEmail = async (
  email: string,
  name: string,
  data: { companyName?: string | null; rows: WalletChangeRow[]; revertUrl: string },
  lang?: string | null,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const { companyName, rows, revertUrl } = data;
    const multiple = rows.length > 1;
    const brand = escapeHtml(companyName || t(wk("brandFallback"), L));
    const tableRows = rows
      .map((r, i) =>
        dataRow(
          escapeHtml(r.network),
          `${mono(escapeHtml(r.address))} <span style="color:#6b7280;font-size:12px;">(${localizeAction(L, r.actionLabel)})</span>`,
          i === rows.length - 1,
        ),
      )
      .join("");

    const subject = multiple
      ? t(wk("changeAlert.subjectMulti"), L)
      : t(wk("changeAlert.subjectSingle"), L, { network: escapeHtml(rows[0]?.network || "") });

    const content = `${greetingLine(L, name)}
    ${p(t(wk(multiple ? "changeAlert.introMulti" : "changeAlert.introSingle"), L, { brand }))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>`)}
    ${p(t(wk("changeAlert.noAction"), L))}
    ${alertBox(t(wk("changeAlert.alert"), L))}`;

    const html = dynoPayEmailTemplate(
      t(wk("changeAlert.heading"), L),
      content,
      true,
      t(wk("changeAlert.cta"), L),
      revertUrl,
      t(wk("changeAlert.preheader"), L),
      L,
      "shield-alert",
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Payout address change alert sent to ${email} (${rows.length} row(s))`);
  } catch (e) {
    apiLogger.error("Payout address change alert email error:", e);
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
  lang?: string | null,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const brand = escapeHtml(data.companyName || t(wk("brandFallback"), L));
    const nets = (data.networks || []).map(escapeHtml).join(", ");
    const multiple = (data.networks || []).length > 1;
    const subject = t(wk("secured.subject"), L);
    const content = `${greetingLine(L, name)}
    ${p(t(wk(multiple ? "secured.introMulti" : "secured.introSingle"), L, { brand }))}
    ${nets ? infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dataRow(t(wk("secured.networksRestoredLabel"), L), nets, true)}</table>`) : ""}
    ${warnText(t(wk("secured.warn"), L))}
    ${p(t(wk("secured.passwordRec"), L))}`;
    const html = dynoPayEmailTemplate(
      t(wk("secured.heading"), L),
      content,
      true,
      t(wk("secured.cta"), L),
      `${FRONTEND_BASE_URL}/help-support`,
      t(wk("secured.preheader"), L),
      L,
      "shield-green",
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[Email] Wallet secured notice sent to ${email}`);
  } catch (e) {
    apiLogger.error("Wallet secured email error:", e);
  }
};
