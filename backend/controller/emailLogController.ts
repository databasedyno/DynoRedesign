/**
 * POST /api/webhooks/brevo?token=<secret> — Brevo transactional events (delivered, bounces, spam…).
 * Admin: GET /admin/email-log, GET /admin/email-log/stats, GET /admin/email-log/dlq,
 *        POST /admin/email-log/dlq/:jobId/retry, POST /admin/email-log/bounces/clear {email}
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { adminLogger, apiLogger } from "../utils/loggers";
import { BrevoEvent, clearEmailSuppression, handleBrevoEvent, isValidBrevoToken } from "../services/email/brevoEvents";
import { emailLogStats, listEmailLogs } from "../services/email/emailLog";
import { getEmailQueueHealth, listDlq, retryDlq } from "../services/email/emailQueue";

export const brevoWebhook = async (req: express.Request, res: express.Response) => {
  const token = String(req.query.token || req.headers["x-brevo-token"] || "");
  if (!isValidBrevoToken(token)) {
    apiLogger.warn(`[Brevo] webhook rejected — bad token from ${req.ip}`);
    return res.status(401).json({ error: "unauthorized" });
  }
  const events: BrevoEvent[] = Array.isArray(req.body) ? req.body : req.body && typeof req.body === "object" ? [req.body] : [];
  const outcomes: string[] = [];
  for (const ev of events) {
    try {
      outcomes.push(await handleBrevoEvent(ev));
    } catch (e) {
      apiLogger.error(`[Brevo] event handling failed: ${(e as Error).message}`);
      outcomes.push("error");
    }
  }
  return res.status(200).json({ ok: true, processed: outcomes });
};

const list = async (req: express.Request, res: express.Response) => {
  try {
    const rows = await listEmailLogs({
      email: req.query.email ? String(req.query.email) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      limit: parseInt(String(req.query.limit || "50"), 10) || 50,
    });
    successResponseHelper(res, 200, "Email log", { rows, total: rows.length });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const stats = async (_req: express.Request, res: express.Response) => {
  try {
    const [log, queue] = await Promise.all([
      emailLogStats(),
      getEmailQueueHealth().catch((e: Error) => ({ error: e.message })),
    ]);
    successResponseHelper(res, 200, "Email stats", { ...log, queue });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const dlq = async (_req: express.Request, res: express.Response) => {
  try {
    successResponseHelper(res, 200, "Email DLQ", { items: await listDlq(50) });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const retry = async (req: express.Request, res: express.Response) => {
  try {
    const ok = await retryDlq(String(req.params.jobId));
    if (!ok) return errorResponseHelper(res, 404, "DLQ item not found");
    adminLogger.info(`[EmailLog] DLQ ${req.params.jobId} re-queued by admin`);
    successResponseHelper(res, 200, "Email re-queued", { job_id: req.params.jobId });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const clearBounce = async (req: express.Request, res: express.Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return errorResponseHelper(res, 400, "email is required");
    const users = await clearEmailSuppression(email);
    adminLogger.info(`[EmailLog] bounce flag cleared for ${email} (${users} user row(s))`);
    successResponseHelper(res, 200, "Bounce flag cleared", { email, users_updated: users });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

export default { brevoWebhook, list, stats, dlq, retry, clearBounce };
