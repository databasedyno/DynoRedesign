/**
 * Brevo transactional-email webhook → delivery status + bounce suppression.
 *
 *   delivered                         → tbl_email_log.status = delivered (and heals an earlier bounce)
 *   hard_bounce|invalid_email|blocked|spam|unsubscribed
 *                                     → status = bounced, Redis suppression (30d), tbl_user.email_bounced_at
 *   soft_bounce|deferred|error        → recorded on the log row only
 */
import { createHmac, timingSafeEqual } from "crypto";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { raw as envRaw } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { deleteRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { markEmailLogByMessageId } from "./emailLog";
import { SUPPRESSED_KEY } from "./emailQueue";

const HARD_EVENTS = new Set(["hard_bounce", "invalid_email", "blocked", "spam", "unsubscribed"]);
const SOFT_EVENTS = new Set(["soft_bounce", "deferred", "error"]);
const SUPPRESS_TTL_SEC = 30 * 24 * 3600;

export interface BrevoEvent {
  event?: string;
  email?: string;
  "message-id"?: string;
  reason?: string;
  subject?: string;
  ts_event?: number;
  date?: string;
}

/** Shared secret in the webhook URL. Derived from BREVO_API_KEY so prod needs no new env var. */
export const brevoWebhookToken = (): string => {
  const explicit = envRaw("BREVO_WEBHOOK_SECRET");
  if (explicit) return explicit;
  const key = envRaw("BREVO_API_KEY") || "";
  return createHmac("sha256", key).update("dynopay-brevo-webhook").digest("hex").slice(0, 48);
};

export const isValidBrevoToken = (candidate: string): boolean => {
  const expected = Buffer.from(brevoWebhookToken());
  const given = Buffer.from(String(candidate || ""));
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
};

const invalidateProfileCaches = async (userIds: number[]) => {
  await Promise.all(userIds.map((id) => deleteRedisItem(`profile:${id}`).catch(() => {})));
};

export const suppressEmail = async (email: string, event: string, reason: string | undefined): Promise<void> => {
  const e = email.trim().toLowerCase();
  await setRedisItemWithTTL(SUPPRESSED_KEY(e), { event, reason: reason || null, at: new Date().toISOString() }, SUPPRESS_TTL_SEC);
  const rows = await sequelize.query<{ user_id: number }>(
    `UPDATE tbl_user SET email_bounced_at = NOW(), email_bounce_reason = :reason
      WHERE LOWER(email) = :email RETURNING user_id`,
    { replacements: { email: e, reason: `${event}${reason ? `: ${reason}` : ""}`.slice(0, 255) }, type: QueryTypes.SELECT }
  );
  await invalidateProfileCaches(rows.map((r) => Number(r.user_id)));
};

export const clearEmailSuppression = async (email: string): Promise<number> => {
  const e = email.trim().toLowerCase();
  await deleteRedisItem(SUPPRESSED_KEY(e)).catch(() => {});
  const rows = await sequelize.query<{ user_id: number }>(
    `UPDATE tbl_user SET email_bounced_at = NULL, email_bounce_reason = NULL
      WHERE LOWER(email) = :email AND email_bounced_at IS NOT NULL RETURNING user_id`,
    { replacements: { email: e }, type: QueryTypes.SELECT }
  );
  await invalidateProfileCaches(rows.map((r) => Number(r.user_id)));
  return rows.length;
};

export const handleBrevoEvent = async (ev: BrevoEvent): Promise<string> => {
  const event = String(ev.event || "").toLowerCase();
  const email = String(ev.email || "").trim().toLowerCase();
  const messageId = String(ev["message-id"] || "");
  const at = ev.ts_event ? new Date(ev.ts_event * 1000) : new Date();
  if (!event || !email) return "ignored";

  if (event === "delivered") {
    await markEmailLogByMessageId(messageId, { status: "delivered", last_event: event, last_event_at: at });
    const healed = await clearEmailSuppression(email);
    if (healed) apiLogger.info(`[Brevo] ${email} delivered again — bounce flag cleared`);
    return "delivered";
  }
  if (HARD_EVENTS.has(event)) {
    await markEmailLogByMessageId(messageId, { status: "bounced", last_event: event, last_event_at: at, last_error: ev.reason || event });
    await suppressEmail(email, event, ev.reason);
    apiLogger.warn(`[Brevo] ${event} for ${email}${ev.reason ? ` — ${ev.reason}` : ""} → suppressed`);
    return "suppressed";
  }
  if (SOFT_EVENTS.has(event)) {
    await markEmailLogByMessageId(messageId, { last_event: event, last_event_at: at, last_error: ev.reason || undefined });
    return "recorded";
  }
  await markEmailLogByMessageId(messageId, { last_event: event, last_event_at: at });
  return "recorded";
};
