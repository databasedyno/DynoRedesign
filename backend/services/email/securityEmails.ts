import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { t, resolveEmailLang, normalizeLang } from "../../utils/emailI18n";
import { infoBox, dataRow, p, warnText, alertBox, successBox, otpBlock, statusBadge } from "../../utils/emailTemplate";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate } from "./emailShared";

/**
 * Account-security + customer payment-request emails (email action audit, 2026-09).
 * Copy lives in locales/<lang>/emails.json under `security.*` and `paymentRequest.*`.
 */

const greeting = (name: string, L: string) =>
  p(name ? t("common.greeting", L, { name: escapeHtml(name) }) : t("common.greetingDefault", L));

const whenRow = (L: string) => {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return dataRow(t("labels.date", L), `${date} at ${time}`, true);
};

const SECURITY_URL = `${FRONTEND_BASE_URL}/settings?section=profile`;

const send = async (email: string, name: string, subject: string, html: string, tag: string) => {
  await mailTransporter({ to: email, name, subject, body: html });
  apiLogger.info(`[Email] ${tag} sent to ${email}`);
};

export const send2FAEnabledEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const content = `${greeting(name, L)}
    ${p(t("security.twoFaEnabled.intro", L))}
    ${successBox(t("security.twoFaEnabled.tip", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`, "#12B76A")}
    ${warnText(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t("security.twoFaEnabled.heading", L), content, true, t("security.reviewCta", L), SECURITY_URL, t("security.twoFaEnabled.preheader", L), L, "shield-green");
    await send(email, name, t("security.twoFaEnabled.subject", L), html, "2FA enabled");
  } catch (e) {
    apiLogger.error("2FA enabled email error:", e);
  }
};

export const send2FADisabledEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const content = `${greeting(name, L)}
    ${p(t("security.twoFaDisabled.intro", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`, "#ef4444")}
    ${alertBox(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t("security.twoFaDisabled.heading", L), content, true, t("security.twoFaDisabled.cta", L), SECURITY_URL, t("security.twoFaDisabled.preheader", L), L, "shield-red");
    await send(email, name, t("security.twoFaDisabled.subject", L), html, "2FA disabled");
  } catch (e) {
    apiLogger.error("2FA disabled email error:", e);
  }
};

export const send2FABackupCodesRegeneratedEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const content = `${greeting(name, L)}
    ${p(t("security.backupCodes.intro", L))}
    ${successBox(t("security.backupCodes.tip", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`, "#4338CA")}
    ${warnText(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t("security.backupCodes.heading", L), content, true, t("security.reviewCta", L), SECURITY_URL, t("security.backupCodes.preheader", L), L, "key");
    await send(email, name, t("security.backupCodes.subject", L), html, "2FA backup codes regenerated");
  } catch (e) {
    apiLogger.error("2FA backup codes email error:", e);
  }
};

/** Mask a stored phone (digits, country code first) to e.g. "+880 •••• 5678". */
export const maskPhone = (phone?: string | null): string => {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 6) return d ? "••••" : "";
  return `+${d.slice(0, 3)} •••• ${d.slice(-4)}`;
};

export const sendPhoneChangedEmail = async (
  email: string,
  name: string,
  data: { action: "added" | "changed" | "removed"; phone?: string | null },
  lang?: string | null,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const key = data.action === "added" ? "phoneAdded" : data.action === "removed" ? "phoneRemoved" : "phoneChanged";
    const isRemoval = data.action === "removed";
    const rows = `${!isRemoval && data.phone ? dataRow(t("security.phoneLabel", L), maskPhone(data.phone)) : ""}${whenRow(L)}`;
    const content = `${greeting(name, L)}
    ${p(t(`security.${key}.intro`, L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`, isRemoval ? "#ef4444" : "#12B76A")}
    ${warnText(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t(`security.${key}.heading`, L), content, true, t("security.profileCta", L), SECURITY_URL, t(`security.${key}.preheader`, L), L, "phone");
    await send(email, name, t(`security.${key}.subject`, L), html, `Phone ${data.action}`);
  } catch (e) {
    apiLogger.error("Phone changed email error:", e);
  }
};

export const sendAccountDeletedEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = normalizeLang(lang);
    const content = `${greeting(name, L)}
    ${p(t("security.accountDeleted.intro", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`, "#ef4444")}
    ${p(t("security.accountDeleted.outro", L))}
    ${warnText(t("security.accountDeleted.notice", L))}`;
    const html = dynoPayEmailTemplate(t("security.accountDeleted.heading", L), content, true, t("security.supportCta", L), `${FRONTEND_BASE_URL}/help-support`, t("security.accountDeleted.preheader", L), L, "person-off");
    await send(email, name, t("security.accountDeleted.subject", L), html, "Account deleted");
  } catch (e) {
    apiLogger.error("Account deleted email error:", e);
  }
};

export const sendAccountStatusEmail = async (
  email: string,
  name: string,
  data: { status: "suspended" | "banned" | "active"; reason?: string | null },
  lang?: string | null,
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const key = data.status === "active" ? "accountReactivated" : data.status === "banned" ? "accountBanned" : "accountSuspended";
    const positive = data.status === "active";
    const reasonRow = !positive && data.reason ? dataRow(t("security.reasonLabel", L), escapeHtml(data.reason)) : "";
    const content = `${greeting(name, L)}
    ${p(t(`security.${key}.intro`, L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${reasonRow}${whenRow(L)}</table>`, positive ? "#12B76A" : "#ef4444")}
    ${positive ? "" : p(t(`security.${key}.outro`, L))}`;
    const html = dynoPayEmailTemplate(
      t(`security.${key}.heading`, L),
      content,
      true,
      positive ? t("security.dashboardCta", L) : t("security.supportCta", L),
      positive ? `${FRONTEND_BASE_URL}/dashboard` : `${FRONTEND_BASE_URL}/help-support`,
      t(`security.${key}.preheader`, L),
      L,
      positive ? "check" : "block",
    );
    await send(email, name, t(`security.${key}.subject`, L), html, `Account ${data.status}`);
  } catch (e) {
    apiLogger.error("Account status email error:", e);
  }
};

/** Customer-facing: a merchant created a payment link addressed to this email. */
export const sendPaymentRequestEmail = async (
  email: string,
  data: { companyName: string; amount: string; currency: string; description?: string | null; expiresAt?: string | Date | null; payUrl: string; lang?: string | null },
) => {
  try {
    const L = normalizeLang(data.lang);
    const vars = { companyName: escapeHtml(data.companyName), amount: escapeHtml(data.amount), currency: escapeHtml(data.currency) };
    const expires = data.expiresAt ? new Date(data.expiresAt) : null;
    const rows = [
      dataRow(t("labels.amount", L), `<strong>${vars.amount} ${vars.currency}</strong>`),
      data.description ? dataRow(t("labels.description", L), escapeHtml(data.description)) : "",
      expires && !isNaN(expires.getTime()) ? dataRow(t("paymentRequest.expires", L), expires.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }), true) : "",
    ].join("");
    const content = `${p(t("common.greetingDefault", L))}
    ${p(t("paymentRequest.intro", L, vars))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`, "#4338CA")}
    ${p(t("paymentRequest.outro", L))}`;
    const html = dynoPayEmailTemplate(t("paymentRequest.heading", L, vars), content, true, t("paymentRequest.cta", L), data.payUrl, t("paymentRequest.preheader", L, vars), L, "link");
    await send(email, email.split("@")[0] || "Customer", t("paymentRequest.subject", L, vars), html, "Payment request");
  } catch (e) {
    apiLogger.error("Payment request email error:", e);
  }
};

// ============================================================
// ACCOUNT DELETION (7-day recovery grace) — plain-English inline copy
// ============================================================

/** Step 1: emailed 6-digit code to confirm a full-account deletion request. */
export const sendAccountDeleteOTPEmail = async (email: string, name: string, otpCode: string) => {
  try {
    const who = name ? `Hey ${escapeHtml(name.split(" ")[0])},` : "Hey there,";
    const content = `${p(who)}
    ${p(`You asked to delete your Dynopay account. Enter this code to confirm — it verifies it's really you.`)}
    ${otpBlock(otpCode)}
    ${warnText(`This code expires shortly. If you didn't request this, ignore this email and change your password right away.`)}`;
    const html = dynoPayEmailTemplate("Confirm account deletion", content, false, "", "", "Your Dynopay account-deletion code", null, "lock-red");
    await send(email, name, "Confirm account deletion – Dynopay", html, "Account delete OTP");
  } catch (e) {
    apiLogger.error("Account delete OTP email error:", e);
  }
};

/** Account soft-deleted — the user has 7 days to get it back via support. */
export const sendAccountSoftDeletedEmail = async (email: string, name: string, purgeDateStr: string) => {
  try {
    const who = name ? `Hey ${escapeHtml(name.split(" ")[0])},` : "Hey there,";
    const content = `${p(who)}
    ${p(`Your Dynopay account was just scheduled for deletion, and you've been signed out of all devices. Nothing is gone yet — we're keeping your account and all of its data (brands, wallets, payment links and history) safe for the next <strong>7 days</strong> in case this was a mistake.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow("Status", statusBadge("Scheduled for deletion", "pending"))}
        ${dataRow("Restore before", `<strong>${escapeHtml(purgeDateStr)}</strong>`, true)}
      </table>
    `, "#f59e0b")}
    ${p(`<strong>Changed your mind?</strong> Contact our support team before <strong>${escapeHtml(purgeDateStr)}</strong> and we'll restore your account exactly as it was.`)}
    ${warnText(`After ${escapeHtml(purgeDateStr)} your account and all of its data are permanently deleted and can't be recovered.`)}
    ${p(`If you didn't request this, contact us immediately so we can secure your account.`)}`;
    const html = dynoPayEmailTemplate("Your account is scheduled for deletion", content, true, "Contact support", `${FRONTEND_BASE_URL}/help-support`, `You have until ${escapeHtml(purgeDateStr)} to restore your Dynopay account.`, null, "person-off");
    await send(email, name, "Your Dynopay account is scheduled for deletion", html, "Account soft-deleted");
  } catch (e) {
    apiLogger.error("Account soft-deleted email error:", e);
  }
};

/** Account restored by support/admin within the grace window. */
export const sendAccountRestoredEmail = async (email: string, name: string) => {
  try {
    const who = name ? `Hey ${escapeHtml(name.split(" ")[0])},` : "Hey there,";
    const content = `${p(who)}
    ${p(`Good news — your Dynopay account has been <strong>restored</strong>. Everything (brands, wallets, payment links and history) is exactly as you left it.`)}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dataRow("Status", statusBadge("Restored", "success"), true)}</table>`, "#12B76A")}
    ${p(`Sign in again to pick up right where you left off.`)}`;
    const html = dynoPayEmailTemplate("Your account is back", content, true, "Sign in", `${FRONTEND_BASE_URL}/auth/login`, "Your Dynopay account has been restored.", null, "check");
    await send(email, name, "Your Dynopay account has been restored", html, "Account restored");
  } catch (e) {
    apiLogger.error("Account restored email error:", e);
  }
};
