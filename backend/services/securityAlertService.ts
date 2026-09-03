import { userModel } from "../models";
import { getCountryFromIP } from "../utils/geolocation";
import { getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { resolveEmailLang, t } from "../utils/emailI18n";
import { apiLogger } from "../utils/loggers";

export type SuspiciousEvent = "otp_lockout" | "login_rate_limit";

interface SuspiciousActivity {
  /** Account owner's email (the alert is sent here). */
  email: string;
  event: SuspiciousEvent;
  ip: string;
  /** Which OTP flow tripped (password reset, login code, email change, ...). */
  channel?: string;
  attempts?: number;
}

const DEDUP_TTL_SECONDS = 60 * 60;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));

/**
 * Email the account owner when someone is hammering their codes or login.
 * Fire-and-forget: never throws, never blocks the request, at most one email
 * per (event, account) per hour, and silently no-ops for unknown emails so the
 * endpoint can't be used as an account-existence oracle.
 */
export const notifySuspiciousActivity = async (a: SuspiciousActivity): Promise<void> => {
  try {
    const email = String(a.email || "").trim().toLowerCase();
    if (!email) return;

    const dedupKey = `sec-alert:${a.event}:${email}`;
    const seen = await getRedisItem(dedupKey); // {} when absent
    if (seen && Object.keys(seen).length > 0) return;

    const user = await userModel.findOne({ where: { email }, attributes: ["user_id", "email", "name", "language"] });
    if (!user) return;
    await setRedisItemWithTTL(dedupKey, { at: new Date().toISOString() }, DEDUP_TTL_SECONDS);

    const geo = await getCountryFromIP(a.ip).catch(() => null);
    const location = geo ? [geo.city, geo.country_name].filter(Boolean).join(", ") : "";
    const L = await resolveEmailLang(user.dataValues.language, email);

    const alertType = t(`merchant.securityAlert.types.${a.event}`, L);
    const rows = [
      a.event === "otp_lockout"
        ? t("merchant.securityAlert.details.otpLockout", L, { channel: a.channel ? t(`merchant.securityAlert.channels.${a.channel}`, L) : "" })
        : t("merchant.securityAlert.details.loginRateLimit", L, { count: a.attempts ?? 20 }),
      `${t("merchant.labels.ipAddress", L)}: <span style="font-family: monospace;">${escapeHtml(a.ip || "unknown")}</span>`,
      location ? `${t("merchant.labels.location", L)}: ${escapeHtml(location)}` : "",
    ].filter(Boolean);

    const { sendSecurityAlertEmail } = await import("./emailService");
    await sendSecurityAlertEmail(email, user.dataValues.name || "", alertType, rows.join("<br />"), undefined, undefined, L);
    apiLogger.info(`[SecurityAlert] ${a.event} alert sent to ${email} (ip=${a.ip}, channel=${a.channel || "-"})`);
  } catch (e) {
    apiLogger.error("[SecurityAlert] failed:", e);
  }
};
