/**
 * Bounce → owner re-route. When a company-scoped email bounces (Brevo webhook)
 * and the job carried a fallback recipient (the account owner), the identical
 * email is queued again to that owner. Idempotent per original log row.
 */
import { raw as envRaw } from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { acquireLock } from "../../utils/redisInstance";
import { createEmailLog, findEmailLogByMessageId, markEmailLog } from "./emailLog";
import { enqueueEmail, getEmailQueue } from "./emailQueue";

export type RerouteOutcome = "rerouted" | "no_fallback" | "already_rerouted" | "outbound_disabled" | "job_gone" | "error";

export const rerouteBouncedEmail = async (messageId: string, event: string): Promise<RerouteOutcome> => {
  try {
    const row = await findEmailLogByMessageId(messageId);
    if (!row?.fallback_to || row.fallback_to.toLowerCase() === row.to_email.toLowerCase()) return "no_fallback";
    if (row.fallback_log_id) return "already_rerouted";
    if (!(await acquireLock(`email:fallback-claim:${row.log_id}`, 7 * 24 * 3600, 1, 0, false, true))) return "already_rerouted";
    if (envRaw("DISABLE_OUTBOUND_EMAIL") === "true") {
      apiLogger.info(`[Brevo] ${event} for ${row.to_email} — would re-route "${row.subject}" to ${row.fallback_to} (outbound disabled on this pod)`);
      return "outbound_disabled";
    }
    const job = row.job_id && row.job_id !== "inline" ? await getEmailQueue().getJob(row.job_id) : null;
    if (!job?.data) {
      apiLogger.warn(`[Brevo] ${event} for ${row.to_email} — cannot re-route "${row.subject}" to ${row.fallback_to}: original job ${row.job_id} no longer available`);
      return "job_gone";
    }
    const d = job.data;
    const logId = await createEmailLog({
      to: row.fallback_to,
      name: d.fallbackName || row.fallback_to,
      subject: d.subject,
      template: d.template,
      lane: d.lane,
      senderEmail: d.sender?.email,
      companyId: d.companyId ?? null,
    });
    const newJobId = await enqueueEmail({
      ...d,
      to: row.fallback_to,
      name: d.fallbackName || row.fallback_to,
      fallbackTo: null,
      fallbackName: null,
      logId,
      expiresAt: undefined,
    });
    await markEmailLog(logId, { job_id: newJobId });
    await markEmailLog(row.log_id, { fallback_log_id: logId });
    apiLogger.warn(`[Brevo] ${event} for ${row.to_email} — re-routed "${row.subject}" to owner ${row.fallback_to} (job ${newJobId})`);
    return "rerouted";
  } catch (e) {
    apiLogger.error(`[Brevo] re-route failed for message ${messageId}: ${(e as Error).message}`);
    return "error";
  }
};
