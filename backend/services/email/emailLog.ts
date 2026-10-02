/**
 * tbl_email_log — the send log behind Admin › Email log and support lookups
 * ("did we email X?"). Every helper here is best-effort: logging must never
 * break or delay the email itself.
 */
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { apiLogger } from "../../utils/loggers";

export type EmailLogStatus = "queued" | "sent" | "delivered" | "bounced" | "failed" | "suppressed" | "expired";

export interface EmailLogCreate {
  to: string;
  name?: string | null;
  subject: string;
  template?: string | null;
  lane: string;
  senderEmail?: string | null;
}

export interface EmailLogPatch {
  status?: EmailLogStatus;
  attempts?: number;
  job_id?: string | null;
  brevo_message_id?: string | null;
  last_error?: string | null;
  last_event?: string | null;
  last_event_at?: Date | null;
  sent_at?: Date | null;
}

const trim = (v: string | null | undefined, max: number) => (v == null ? null : String(v).slice(0, max));

export const createEmailLog = async (row: EmailLogCreate): Promise<number | null> => {
  try {
    const rows = await sequelize.query<{ log_id: string }>(
      `INSERT INTO tbl_email_log (to_email, to_name, subject, template, lane, sender_email, status)
       VALUES (:to, :name, :subject, :template, :lane, :sender, 'queued')
       RETURNING log_id`,
      {
        replacements: {
          to: trim(row.to.trim().toLowerCase(), 320),
          name: trim(row.name, 255),
          subject: trim(row.subject, 500),
          template: trim(row.template, 120),
          lane: trim(row.lane, 16),
          sender: trim(row.senderEmail, 320),
        },
        type: QueryTypes.SELECT,
      }
    );
    return rows[0] ? Number(rows[0].log_id) : null;
  } catch (e) {
    apiLogger.warn(`[EmailLog] insert failed: ${(e as Error).message}`);
    return null;
  }
};

const buildPatch = (patch: EmailLogPatch) => {
  const sets: string[] = ["updated_at = NOW()"];
  const repl: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    sets.push(`${k} = :${k}`);
    repl[k] = k === "last_error" ? trim(v as string, 2000) : v;
  }
  return { sets: sets.join(", "), repl };
};

export const markEmailLog = async (logId: number | null | undefined, patch: EmailLogPatch): Promise<void> => {
  if (!logId) return;
  try {
    const { sets, repl } = buildPatch(patch);
    await sequelize.query(`UPDATE tbl_email_log SET ${sets} WHERE log_id = :logId`, {
      replacements: { ...repl, logId },
      type: QueryTypes.UPDATE,
    });
  } catch (e) {
    apiLogger.warn(`[EmailLog] update #${logId} failed: ${(e as Error).message}`);
  }
};

/** Brevo webhook correlation: events carry the SMTP message-id we stored at send time. */
export const markEmailLogByMessageId = async (messageId: string, patch: EmailLogPatch): Promise<number> => {
  if (!messageId) return 0;
  try {
    const { sets, repl } = buildPatch(patch);
    const [, meta] = await sequelize.query(`UPDATE tbl_email_log SET ${sets} WHERE brevo_message_id = :messageId`, {
      replacements: { ...repl, messageId },
    });
    return Number((meta as { rowCount?: number } | undefined)?.rowCount ?? meta ?? 0);
  } catch (e) {
    apiLogger.warn(`[EmailLog] update by message-id failed: ${(e as Error).message}`);
    return 0;
  }
};

export interface EmailLogRow {
  log_id: number;
  to_email: string;
  to_name: string | null;
  subject: string;
  template: string | null;
  lane: string;
  sender_email: string | null;
  status: EmailLogStatus;
  attempts: number;
  job_id: string | null;
  brevo_message_id: string | null;
  last_error: string | null;
  last_event: string | null;
  last_event_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export const listEmailLogs = async (q: { email?: string; status?: string; limit?: number }): Promise<EmailLogRow[]> => {
  const where: string[] = [];
  const repl: Record<string, unknown> = { limit: Math.min(200, Math.max(1, q.limit || 50)) };
  if (q.email) {
    where.push(`to_email ILIKE :email`);
    repl.email = `%${q.email.trim().toLowerCase()}%`;
  }
  if (q.status) {
    where.push(`status = :status`);
    repl.status = q.status;
  }
  const rows = await sequelize.query<EmailLogRow>(
    `SELECT log_id, to_email, to_name, subject, template, lane, sender_email, status, attempts, job_id,
            brevo_message_id, last_error, last_event, last_event_at, sent_at, created_at
       FROM tbl_email_log
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT :limit`,
    { replacements: repl, type: QueryTypes.SELECT }
  );
  return rows.map((r) => ({ ...r, log_id: Number(r.log_id), attempts: Number(r.attempts) }));
};

export const emailLogStats = async (): Promise<{ last24h: Record<string, number>; bounced_users: number }> => {
  const [counts, bounced] = await Promise.all([
    sequelize.query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::int AS n FROM tbl_email_log WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status`,
      { type: QueryTypes.SELECT }
    ),
    sequelize.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM tbl_user WHERE email_bounced_at IS NOT NULL`, { type: QueryTypes.SELECT }),
  ]);
  const last24h: Record<string, number> = {};
  for (const c of counts) last24h[c.status] = Number(c.n);
  return { last24h, bounced_users: Number(bounced[0]?.n ?? 0) };
};

/** Retention: keep 90 days of send history. */
export const purgeOldEmailLogs = async (): Promise<number> => {
  const [, meta] = await sequelize.query(`DELETE FROM tbl_email_log WHERE created_at < NOW() - INTERVAL '90 days'`);
  return Number((meta as { rowCount?: number } | undefined)?.rowCount ?? 0);
};
