import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { t, resolveEmailLang } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { baseEmailTemplate, infoBox, dataRow, p } from "../../utils/emailTemplate";
import { FRONTEND_BASE_URL, escapeHtml, dynoPayEmailTemplate } from "./emailShared";
import { lookupCountry } from "../../utils/clientContext";
import { isPlaceholderBuyerEmail } from "../../utils/transactionSource";

const ak = (key: string) => `admin.${key}`;

/**
 * Send notification to admin when a new user registers.
 * Informational only — user is active immediately.
 */
export const sendNewUserAdminNotification = async (userData: {
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  login_type: string;
  user_id?: number;
  company_name?: string | null;
  signup_ip?: string | null;
  country?: string | null;
}) => {
  // Disabled 2026-06 per owner request — a new-signup admin email on EVERY
  // registration was too noisy. Re-enable by setting ADMIN_NOTIFY_NEW_USER=true.
  if ((config.raw("ADMIN_NOTIFY_NEW_USER") || "false").toLowerCase() !== "true") return;
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping new user admin notification");
      return;
    }
    const L = await resolveEmailLang(undefined, adminEmail);

    const displayName = userData.name || t(ak("na"), L);
    const contactInfo = userData.email || userData.mobile || t(ak("na"), L);
    const registrationMethod = userData.login_type || t(ak("unknown"), L);
    const userId = userData.user_id || t(ak("na"), L);
    const companyName = userData.company_name || t(ak("newUser.notProvided"), L);
    // Resolve the signup country so the admin can see name · country · method at
    // a glance. Prefer an explicit country; otherwise geo-locate the signup IP.
    let country = userData.country || null;
    if (!country && userData.signup_ip) {
      try {
        country = await lookupCountry(userData.signup_ip);
      } catch {
        country = null;
      }
    }
    const countryLabel = country || t(ak("unknown"), L);
    const registrationTime = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";

    const subject = t(ak("newUser.subject"), L, { name: displayName, country: countryLabel, method: registrationMethod });

    const content = `${p(t(ak("newUser.intro"), L))}
    ${p(`<strong>${escapeHtml(displayName)}</strong> &nbsp;·&nbsp; ${escapeHtml(countryLabel)} &nbsp;·&nbsp; ${escapeHtml(registrationMethod)}`, `font-size: 16px; color: #111827; margin: 4px 0 16px;`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t(ak("newUser.nameLabel"), L), escapeHtml(displayName))}
        ${dataRow(t(ak("newUser.contactLabel"), L), escapeHtml(contactInfo))}
        ${dataRow(t(ak("newUser.countryLabel"), L), escapeHtml(countryLabel))}
        ${dataRow(t(ak("newUser.methodLabel"), L), escapeHtml(registrationMethod))}
        ${dataRow(t(ak("newUser.userIdLabel"), L), String(userId))}
        ${dataRow(t(ak("newUser.companyLabel"), L), escapeHtml(companyName))}
        ${dataRow(t(ak("newUser.registeredAtLabel"), L), registrationTime)}
        ${dataRow(t(ak("newUser.promoLabel"), L), t(ak("newUser.promoValue"), L), true)}
      </table>
    `)}
    ${p(t(ak("newUser.active"), L))}
    ${p(t(ak("newUser.reviewHint"), L), `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate(t(ak("newUser.heading"), L), content, { audience: "admin", lang: L });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] New user admin notification sent for ${contactInfo} (${registrationMethod}, ${countryLabel})`);
  } catch (e) {
    apiLogger.error("[Email] Admin new user notification error:", e);
  }
};

/**
 * Send notification to admin when a user appears stuck during onboarding.
 */
export const sendOnboardingStuckAdminEmail = async (userData: {
  user_id: number;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  registered_at: string;
  hours_since_registration: number;
  stuck_step: string;
  completed_steps: string[];
  pending_steps: string[];
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) return;
    const L = await resolveEmailLang(undefined, adminEmail);

    const displayName = userData.name || t(ak("na"), L);
    const contact = userData.email || userData.mobile || t(ak("na"), L);
    const hours = userData.hours_since_registration;
    const stuckLabel = userData.stuck_step;

    const urgency = hours >= 48 ? t(ak("onboardingStuck.urgencyCritical"), L) : hours >= 24 ? t(ak("onboardingStuck.urgencyWarning"), L) : t(ak("onboardingStuck.urgencyAttention"), L);
    const subject = t(ak("onboardingStuck.subject"), L, { urgency, name: displayName, step: stuckLabel, hours });

    const completedList = userData.completed_steps.length > 0
      ? userData.completed_steps.map(s => `✅ ${escapeHtml(s)}`).join('<br/>')
      : `<em>${t(ak("onboardingStuck.noneYet"), L)}</em>`;
    const pendingList = userData.pending_steps.map(s => `⬜ ${escapeHtml(s)}`).join('<br/>');

    const content = `${p(t(ak("onboardingStuck.intro"), L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t(ak("onboardingStuck.merchantLabel"), L), escapeHtml(displayName))}
        ${dataRow(t(ak("onboardingStuck.contactLabel"), L), escapeHtml(contact))}
        ${dataRow(t(ak("onboardingStuck.userIdLabel"), L), String(userData.user_id))}
        ${dataRow(t(ak("onboardingStuck.registeredLabel"), L), escapeHtml(userData.registered_at))}
        ${dataRow(t(ak("onboardingStuck.timeSinceLabel"), L), t(ak("onboardingStuck.hoursValue"), L, { hours }))}
        ${dataRow(t(ak("onboardingStuck.stuckAtLabel"), L), `<strong>${escapeHtml(stuckLabel)}</strong>`, true)}
      </table>
    `)}
    ${p(`<strong>${t(ak("onboardingStuck.completedTitle"), L)}</strong><br/>${completedList}`)}
    ${p(`<strong>${t(ak("onboardingStuck.pendingTitle"), L)}</strong><br/>${pendingList}`)}
    ${p(t(ak("onboardingStuck.outro"), L), `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate(t(ak("onboardingStuck.heading"), L), content, { audience: "admin", lang: L });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Onboarding stuck notification sent for user ${userData.user_id} (stuck at: ${stuckLabel}, ${hours}h)`);
  } catch (e) {
    apiLogger.error("[Email] Onboarding stuck notification error:", e);
  }
};

/**
 * Daily DIGEST to admin listing every merchant still stuck in onboarding.
 * Replaces the old per-user, per-tier (4h/12h/24h/48h) stuck emails which were
 * far too noisy — owner request 2026-06. One email per day, worst-first.
 */
export const sendOnboardingStuckDigestAdminEmail = async (rows: Array<{
  user_id: number;
  name?: string | null;
  contact?: string | null;
  registered_at: string;
  hours_since_registration: number;
  stuck_step: string;
  pending_steps: string[];
}>) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail || rows.length === 0) return;
    const L = await resolveEmailLang(undefined, adminEmail);

    const sorted = [...rows].sort((a, b) => b.hours_since_registration - a.hours_since_registration);

    const rowsHtml = sorted.map((r) => {
      const color = r.hours_since_registration >= 48 ? "#ef4444" : r.hours_since_registration >= 24 ? "#f59e0b" : "#f97316";
      const waited = r.hours_since_registration >= 48 ? `${Math.floor(r.hours_since_registration / 24)}d` : `${r.hours_since_registration}h`;
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:13px;color:#111827;">${escapeHtml(r.name || "—")}<br/><span style="color:#6b7280;font-size:12px;">${escapeHtml(r.contact || "—")}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:13px;color:#374151;">#${r.user_id}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:13px;"><span style="color:${color};font-weight:600;">${escapeHtml(r.stuck_step)}</span></td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:13px;color:${color};font-weight:600;text-align:right;">${waited}</td>
      </tr>`;
    }).join("");

    const th = (label: string, align = "left") =>
      `<th style="padding:8px 10px;text-align:${align};font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;border-bottom:2px solid #e5e7eb;">${label}</th>`;

    const plural = rows.length === 1 ? "" : "s";
    const subject = `Onboarding digest — ${rows.length} merchant${plural} still stuck`;

    const content = `${p(`Daily onboarding digest — <strong>${rows.length}</strong> merchant${plural} registered in the last 72h ${rows.length === 1 ? "has" : "have"} not finished setup. Sorted longest-waiting first.`)}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>${th("Merchant")}${th("User")}${th("Stuck at")}${th("Waiting", "right")}</tr>
        ${rowsHtml}
      </table>
    `)}
    ${p(`You now receive one digest per day instead of a separate alert for every user and tier.`, `color:#6b7280;font-size:13px;`)}`;

    const html = baseEmailTemplate("Onboarding — daily stuck digest", content, { audience: "admin", lang: L });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Onboarding stuck DIGEST sent — ${rows.length} merchant(s)`);
  } catch (e) {
    apiLogger.error("[Email] Onboarding stuck digest error:", e);
  }
};

/**
 * Send notification to admin when a user completes onboarding.
 */
export const sendOnboardingCompletedAdminEmail = async (userData: {
  user_id: number;
  name?: string | null;
  email?: string | null;
  company_name?: string | null;
  wallet_count: number;
  registered_at: string;
  hours_to_complete: number;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) return;
    const L = await resolveEmailLang(undefined, adminEmail);

    const displayName = userData.name || t(ak("na"), L);
    const contact = userData.email || t(ak("na"), L);
    const hoursStr = userData.hours_to_complete < 1
      ? t(ak("onboardingCompleted.lessThanHour"), L)
      : t(ak("onboardingCompleted.hoursValue"), L, { hours: Math.round(userData.hours_to_complete) });

    const subject = t(ak("onboardingCompleted.subject"), L, { name: displayName });

    const content = `${p(t(ak("onboardingCompleted.intro"), L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t(ak("onboardingCompleted.merchantLabel"), L), escapeHtml(displayName))}
        ${dataRow(t(ak("onboardingCompleted.emailLabel"), L), escapeHtml(contact))}
        ${dataRow(t(ak("onboardingCompleted.userIdLabel"), L), String(userData.user_id))}
        ${dataRow(t(ak("onboardingCompleted.companyLabel"), L), escapeHtml(userData.company_name || t(ak("na"), L)))}
        ${dataRow(t(ak("onboardingCompleted.walletsLabel"), L), String(userData.wallet_count))}
        ${dataRow(t(ak("onboardingCompleted.registeredLabel"), L), escapeHtml(userData.registered_at))}
        ${dataRow(t(ak("onboardingCompleted.timeToCompleteLabel"), L), hoursStr, true)}
      </table>
    `)}
    ${p(t(ak("onboardingCompleted.allDone"), L))}
    ${p(t(ak("onboardingCompleted.outro"), L), `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate(t(ak("onboardingCompleted.heading"), L), content, { audience: "admin", lang: L });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Onboarding complete notification sent for user ${userData.user_id}`);
  } catch (e) {
    apiLogger.error("[Email] Onboarding complete notification error:", e);
  }
};

/**
 * Send notification to admin when a merchant receives their very first payment.
 */
export const sendFirstPaymentAdminEmail = async (data: {
  user_id: number;
  merchant_name?: string | null;
  merchant_email?: string | null;
  company_name?: string | null;
  company_id?: number | null;
  amount: string;
  currency: string;
  amount_usd?: string | null;
  payment_method: string;
  customer_email?: string | null;
  transaction_id: string;
  registered_at?: string | null;
  days_since_registration?: number | null;
  country?: string | null;
  website?: string | null;
  payment_type?: string | null;
  activity?: {
    apiRequests: number;
    paymentLinks: number;
    invoices: number;
    webhookDeliveries: number;
  } | null;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) return;
    const L = await resolveEmailLang(undefined, adminEmail);

    const merchantName = data.merchant_name || t(ak("na"), L);
    const daysStr = data.days_since_registration != null
      ? t(ak("firstPayment.daysValue"), L, { days: data.days_since_registration })
      : t(ak("na"), L);

    const subject = t(ak("firstPayment.subject"), L, { name: merchantName, amount: formatCryptoAmount(data.amount, data.currency), currency: data.currency });

    const paymentTypeLabel = data.payment_type
      ? t(ak(`firstPayment.types.${data.payment_type}`), L)
      : t(ak("na"), L);
    const act = data.activity;
    const activityValue = act
      ? [
          t(ak("firstPayment.activityApi"), L, { count: act.apiRequests }),
          t(ak("firstPayment.activityLinks"), L, { count: act.paymentLinks }),
          t(ak("firstPayment.activityInvoices"), L, { count: act.invoices }),
          t(ak("firstPayment.activityWebhooks"), L, { count: act.webhookDeliveries }),
        ].join(" · ")
      : t(ak("na"), L);

    const content = `${p(t(ak("firstPayment.intro"), L))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t(ak("firstPayment.merchantLabel"), L), escapeHtml(merchantName))}
        ${dataRow(t(ak("firstPayment.emailLabel"), L), escapeHtml(data.merchant_email || t(ak("na"), L)))}
        ${dataRow(t(ak("firstPayment.companyLabel"), L), escapeHtml(data.company_name || t(ak("na"), L)))}
        ${dataRow(t(ak("firstPayment.countryLabel"), L), escapeHtml(data.country || t(ak("na"), L)))}
        ${data.website ? dataRow(t(ak("firstPayment.websiteLabel"), L), escapeHtml(data.website)) : ""}
        ${dataRow(t(ak("firstPayment.userIdLabel"), L), String(data.user_id))}
        ${dataRow(t(ak("firstPayment.amountLabel"), L), `<strong>${formatCryptoAmount(data.amount, data.currency)} ${escapeHtml(data.currency)}</strong>${data.amount_usd ? ` (~$${escapeHtml(data.amount_usd)} USD)` : ''}`)}
        ${dataRow(t(ak("firstPayment.methodLabel"), L), escapeHtml(data.payment_method))}
        ${dataRow(t(ak("firstPayment.paymentTypeLabel"), L), escapeHtml(paymentTypeLabel))}
        ${dataRow(t(ak("firstPayment.customerLabel"), L), isPlaceholderBuyerEmail(data.customer_email) ? t(ak("firstPayment.noEmail"), L) : escapeHtml(String(data.customer_email)))}
        ${dataRow(t(ak("firstPayment.txLabel"), L), escapeHtml(data.transaction_id))}
        ${dataRow(t(ak("firstPayment.activityLabel"), L), escapeHtml(activityValue))}
        ${dataRow(t(ak("firstPayment.timeToFirstLabel"), L), daysStr, true)}
      </table>
    `)}
    ${p(t(ak("firstPayment.milestone"), L))}
    ${p(t(ak("firstPayment.outro"), L), `color: #6b7280; font-size: 13px;`)}`;

    const html = baseEmailTemplate(t(ak("firstPayment.heading"), L), content, { audience: "admin", lang: L });
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] First payment notification sent for user ${data.user_id} — ${data.amount} ${data.currency}`);
  } catch (e) {
    apiLogger.error("[Email] First payment notification error:", e);
  }
};

export const sendBrandDeletedAdminEmail = async (info: {
  companyId: number | string;
  companyName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  deletedAtStr: string;
  purgeDateStr: string;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping brand-deleted admin notification");
      return;
    }
    const L = await resolveEmailLang(undefined, adminEmail);
    const brand = escapeHtml(info.companyName || `Brand #${info.companyId}`);
    const owner = escapeHtml(info.ownerName || t(ak("unknown"), L));
    const ownerEmail = escapeHtml(info.ownerEmail || "—");
    const subject = t(ak("brandDeleted.subject"), L, { brand: info.companyName, purgeDate: info.purgeDateStr });

    const content = `${p(t(ak("brandDeleted.intro"), L, { purgeDate: escapeHtml(info.purgeDateStr) }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t(ak("brandDeleted.brandLabel"), L), `<strong>${brand}</strong>`)}
        ${dataRow(t(ak("brandDeleted.brandIdLabel"), L), `#${escapeHtml(String(info.companyId))}`)}
        ${dataRow(t(ak("brandDeleted.ownerLabel"), L), owner)}
        ${dataRow(t(ak("brandDeleted.ownerEmailLabel"), L), ownerEmail)}
        ${dataRow(t(ak("brandDeleted.deletedAtLabel"), L), escapeHtml(info.deletedAtStr))}
        ${dataRow(t(ak("brandDeleted.autoPurgeLabel"), L), `<strong>${escapeHtml(info.purgeDateStr)}</strong>`, true)}
      </table>
    `)}
    ${p(t(ak("brandDeleted.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(ak("brandDeleted.heading"), L), `${p(t(ak("greeting"), L))}\n${content}`, true, t(ak("brandDeleted.cta"), L), `${FRONTEND_BASE_URL}/admin/merchants`, t(ak("brandDeleted.preheader"), L, { brand, purgeDate: escapeHtml(info.purgeDateStr) }), L, 'trash', 'admin');
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Brand-deleted admin notification sent for ${info.companyName} (#${info.companyId})`);
  } catch (e) {
    apiLogger.error("[Email] Brand-deleted admin notification error:", e);
  }
};

/**
 * Notify ops when a merchant soft-deletes their WHOLE account. Retained and
 * restorable from Admin -> Merchants -> Deleted accounts.
 */
export const sendAccountDeletedAdminEmail = async (info: {
  userId: number | string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  deletedAtStr: string;
  purgeDateStr: string;
}) => {
  try {
    const adminEmail = config.raw("ADMIN_EMAIL");
    if (!adminEmail) {
      apiLogger.warn("[Email] No ADMIN_EMAIL configured — skipping account-deleted admin notification");
      return;
    }
    const L = await resolveEmailLang(undefined, adminEmail);
    const owner = escapeHtml(info.ownerName || t(ak("unknown"), L));
    const ownerEmail = escapeHtml(info.ownerEmail || "—");
    const who = info.ownerEmail || `user #${info.userId}`;
    const subject = t(ak("accountDeleted.subject"), L, { who, purgeDate: info.purgeDateStr });

    const content = `${p(t(ak("accountDeleted.intro"), L, { purgeDate: escapeHtml(info.purgeDateStr) }))}
    ${infoBox(`
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${dataRow(t(ak("accountDeleted.accountLabel"), L), owner)}
        ${dataRow(t(ak("accountDeleted.emailLabel"), L), ownerEmail)}
        ${dataRow(t(ak("accountDeleted.userIdLabel"), L), `#${escapeHtml(String(info.userId))}`)}
        ${dataRow(t(ak("accountDeleted.deletedAtLabel"), L), escapeHtml(info.deletedAtStr))}
        ${dataRow(t(ak("accountDeleted.autoPurgeLabel"), L), `<strong>${escapeHtml(info.purgeDateStr)}</strong>`, true)}
      </table>
    `)}
    ${p(t(ak("accountDeleted.outro"), L))}`;

    const html = dynoPayEmailTemplate(t(ak("accountDeleted.heading"), L), `${p(t(ak("greeting"), L))}\n${content}`, true, t(ak("accountDeleted.cta"), L), `${FRONTEND_BASE_URL}/admin/merchants`, t(ak("accountDeleted.preheader"), L, { who: escapeHtml(who), purgeDate: escapeHtml(info.purgeDateStr) }), L, 'person-off', 'admin');
    await mailTransporter({ to: adminEmail, name: "Dynopay Admin", subject, body: html });
    apiLogger.info(`[Email] Account-deleted admin notification sent for user #${info.userId}`);
  } catch (e) {
    apiLogger.error("[Email] Account-deleted admin notification error:", e);
  }
};
