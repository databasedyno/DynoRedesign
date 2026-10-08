import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { emailDateParts, formatEmailDate, formatEmailDateTime, t, resolveEmailLang, normalizeLang } from "../../utils/emailI18n";
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
  const { date, time } = emailDateParts(now);
  return dataRow(t("labels.date", L), `${date} · ${time}`, true);
};

const SECURITY_URL = `${FRONTEND_BASE_URL}/settings?section=profile`;

const send = async (email: string, name: string, subject: string, html: string, tag: string, lane: "otp" | "default" = "default") => {
  await mailTransporter({ to: email, name, subject, body: html, lane, template: tag });
  apiLogger.info(`[Email] ${tag} sent to ${email}`);
};

export const send2FAEnabledEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const content = `${greeting(name, L)}
    ${p(t("security.twoFaEnabled.intro", L))}
    ${successBox(t("security.twoFaEnabled.tip", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`)}
    ${warnText(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t("security.twoFaEnabled.heading", L), content, true, t("security.reviewCta", L), SECURITY_URL, t("security.twoFaEnabled.preheader", L), L, "shield-green");
    await send(email, name, t("security.twoFaEnabled.subject", L), html, "2FA enabled");
  } catch (e) {
    apiLogger.error("2FA enabled email error:", e);
  }
};

/**
 * Email-code method enrolled (onboarding step 1 "email codes"). Deliberately
 * NOT the authenticator-app "2FA is on" email: it names the method, keeps it
 * short, and nudges toward an authenticator app for stronger protection.
 */
export const sendEmailCodesEnabledEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const K = "security.emailCodesEnabled";
    const content = `${greeting(name, L)}
    ${p(t(`${K}.intro`, L))}
    ${infoBox(`<p style="margin: 0; font-size: 14px; color: #374151; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">${t(`${K}.upgrade`, L)}</p>`)}
    ${p(t(`${K}.tip`, L))}
    ${warnText(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t(`${K}.heading`, L), content, true, t(`${K}.cta`, L), SECURITY_URL, t(`${K}.preheader`, L), L, "shield-green");
    await send(email, name, t(`${K}.subject`, L), html, "Email codes enabled");
  } catch (e) {
    apiLogger.error("Email codes enabled email error:", e);
  }
};

export const send2FADisabledEmail = async (email: string, name: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const content = `${greeting(name, L)}
    ${p(t("security.twoFaDisabled.intro", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`)}
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
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`)}
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
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`)}
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
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`)}
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
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${reasonRow}${whenRow(L)}</table>`)}
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
      expires && !isNaN(expires.getTime()) ? dataRow(t("paymentRequest.expires", L), formatEmailDate(expires, L), true) : "",
    ].join("");
    const content = `${p(t("common.greetingDefault", L))}
    ${p(t("paymentRequest.intro", L, vars))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`)}
    ${p(t("paymentRequest.outro", L))}`;
    const html = dynoPayEmailTemplate(t("paymentRequest.heading", L, vars), content, true, t("paymentRequest.cta", L), data.payUrl, t("paymentRequest.preheader", L, vars), L, "link", "buyer");
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
    await send(email, name, "Confirm account deletion – Dynopay", html, "Account delete OTP", "otp");
  } catch (e) {
    apiLogger.error("Account delete OTP email error:", e);
  }
};

/** Account soft-deleted — the account is deactivated + locked immediately; some
 *  records are retained securely for AML/KYC compliance. Restore is via support. */
export const sendAccountSoftDeletedEmail = async (email: string, name: string, _purgeDateStr: string) => {
  try {
    const who = name ? `Hey ${escapeHtml(name.split(" ")[0])},` : "Hey there,";
    const content = `${p(who)}
    ${p(`Your Dynopay account has just been <strong>deactivated</strong> at your request, and you've been signed out of every device. You won't be able to sign in or process payments with it anymore.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow("Status", statusBadge("Account deactivated", "pending"))}
      </table>
    `)}
    ${p(`As a regulated payments platform, we're required to keep certain financial and identity records (for anti-money-laundering / KYC purposes) securely for a retention period. Those records are locked and are no longer accessible from your account.`)}
    ${p(`<strong>Changed your mind?</strong> Contact our support team and, where permitted, we can reactivate your account.`)}
    ${p(`If you didn't request this, contact us immediately so we can secure your account.`)}`;
    const html = dynoPayEmailTemplate("Your account has been deactivated", content, true, "Contact support", `${FRONTEND_BASE_URL}/help-support`, `Your Dynopay account has been deactivated.`, null, "person-off");
    await send(email, name, "Your Dynopay account has been deactivated", html, "Account soft-deleted");
  } catch (e) {
    apiLogger.error("Account soft-deleted email error:", e);
  }
};

/** Account restored by support/admin within the grace window. */
export const sendAccountRestoredEmail = async (email: string, name: string) => {
  try {
    const who = name ? `Hey ${escapeHtml(name.split(" ")[0])},` : "Hey there,";
    const content = `${p(who)}
    ${p(`Good news — your Dynopay account has been <strong>restored</strong>. Everything (brands, payout addresses, payment links and history) is exactly as you left it.`)}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${dataRow("Status", statusBadge("Restored", "success"), true)}</table>`)}
    ${p(`Sign in again to pick up right where you left off.`)}`;
    const html = dynoPayEmailTemplate("Your account is back", content, true, "Sign in", `${FRONTEND_BASE_URL}/auth/login`, "Your Dynopay account has been restored.", null, "check");
    await send(email, name, "Your Dynopay account has been restored", html, "Account restored");
  } catch (e) {
    apiLogger.error("Account restored email error:", e);
  }
};

/** Step-up (sudo mode) verification code — one email for every sensitive-action scope. */
export const sendStepUpCodeEmail = async (email: string, name: string, code: string, scope: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const action = t(`security.stepUpActions.${scope}`, L);
    const content = `${greeting(name, L)}
    ${p(t("security.stepUp.intro", L, { action: `<strong>${escapeHtml(action)}</strong>` }))}
    ${otpBlock(code)}
    ${p(t("security.stepUp.expiry", L), "font-size: 14px; color: #6b7280; text-align: center; margin: 0;")}
    ${warnText(t("security.stepUp.ignore", L))}`;
    const html = dynoPayEmailTemplate(t("security.stepUp.heading", L), content, false, "", "", t("security.stepUp.preheader", L), L, "key");
    await send(email, name, t("security.stepUp.subject", L), html, `Step-up code (${scope})`, "otp");
  } catch (e) {
    apiLogger.error("Step-up code email error:", e);
  }
};

/** 2FA reset — signed link (30 min) that drops the authenticator and falls back to email codes. */
export const send2FAResetLinkEmail = async (email: string, name: string, link: string, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const content = `${greeting(name, L)}
    ${p(t("security.twoFaReset.intro", L))}
    ${alertBox(t("security.twoFaReset.consequences", L))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`)}
    ${warnText(t("security.twoFaReset.ignore", L))}`;
    const html = dynoPayEmailTemplate(t("security.twoFaReset.heading", L), content, true, t("security.twoFaReset.cta", L), link, t("security.twoFaReset.preheader", L), L, "shield-red");
    await send(email, name, t("security.twoFaReset.subject", L), html, "2FA reset link", "otp");
  } catch (e) {
    apiLogger.error("2FA reset link email error:", e);
  }
};

/** 2FA reset — completed notice (sessions revoked, payout address changes frozen 24h). */
export const send2FAResetDoneEmail = async (email: string, name: string, freezeUntil: Date, lang?: string | null) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const until = formatEmailDateTime(freezeUntil, L);
    const content = `${greeting(name, L)}
    ${p(t("security.twoFaResetDone.intro", L))}
    ${alertBox(t("security.twoFaResetDone.freeze", L, { until }))}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${whenRow(L)}</table>`)}
    ${warnText(t("security.didntDoThis", L))}`;
    const html = dynoPayEmailTemplate(t("security.twoFaResetDone.heading", L), content, true, t("security.reviewCta", L), SECURITY_URL, t("security.twoFaResetDone.preheader", L), L, "shield-red");
    await send(email, name, t("security.twoFaResetDone.subject", L), html, "2FA reset done");
  } catch (e) {
    apiLogger.error("2FA reset done email error:", e);
  }
};


/**
 * Security alert: a customer wallet was manually credited/debited from the admin path.
 * Sent to the platform ADMIN_EMAIL so no manual balance adjustment can happen silently
 * (added after an unattributed credit was found in a security review, 2026-09-27).
 */
export const sendAdminWalletAdjustmentAlertEmail = async (
  toEmail: string,
  data: {
    action: "credit" | "debit";
    amount: string;
    currency: string;
    customerEmail?: string | null;
    customerId: number | string;
    companyName?: string | null;
    companyId?: number | string | null;
    newBalance?: string | null;
    description?: string | null;
    actor: string;
    authType: string;
    ip?: string | null;
  },
) => {
  try {
    const isCredit = data.action === "credit";
    const rows = [
      dataRow("Action", statusBadge(isCredit ? "Wallet credited" : "Wallet debited", isCredit ? "success" : "pending"), true),
      dataRow("Amount", `<strong>${escapeHtml(data.amount)} ${escapeHtml(data.currency)}</strong>`),
      dataRow("Customer", `${escapeHtml(data.customerEmail || "—")} (#${escapeHtml(String(data.customerId))})`),
      data.companyName ? dataRow("Brand", `${escapeHtml(data.companyName)}${data.companyId ? ` (#${escapeHtml(String(data.companyId))})` : ""}`) : "",
      data.newBalance != null ? dataRow("New balance", `${escapeHtml(data.newBalance)} ${escapeHtml(data.currency)}`) : "",
      data.description ? dataRow("Note", escapeHtml(data.description)) : "",
      dataRow("Performed by", `${escapeHtml(data.actor)} (${escapeHtml(data.authType)})`),
      data.ip ? dataRow("IP address", escapeHtml(data.ip)) : "",
      whenRow("en"),
    ].join("");
    const content = `${p("Hey there,")}
    ${p(`A customer wallet was <strong>${isCredit ? "credited" : "debited"}</strong> on your platform. Review the details below — if this wasn't you or an authorised team member, secure your admin account immediately.`)}
    ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`)}
    ${warnText("If you didn't authorise this, change your admin password and revoke your API keys right away, then contact support.")}`;
    const html = dynoPayEmailTemplate(
      `Customer wallet ${isCredit ? "credited" : "debited"}`,
      content,
      false,
      "",
      "",
      `A customer wallet was ${isCredit ? "credited" : "debited"} (${data.amount} ${data.currency}) by ${data.actor}.`,
      null,
      "lock-red",
    );
    await send(toEmail, "Dynopay Admin", `Security alert — customer wallet ${isCredit ? "credited" : "debited"} (${data.amount} ${data.currency})`, html, `Wallet ${data.action} alert`);
  } catch (e) {
    apiLogger.error("Admin wallet adjustment alert email error:", e);
  }
};
