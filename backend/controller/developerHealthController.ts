import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import { successResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";

type Row = Record<string, unknown>;
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
};
const ROTATE_AFTER_DAYS = 365;

/**
 * GET /api/dashboard/developer-health?company_id= — "are my integrations healthy?"
 * Webhook delivery health (24 h success rate, last failure + retry handle), API-key
 * age with a rotation reminder (>12 months), and the configured webhook endpoint.
 */
const getDeveloperHealth = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const companyId = String(req.query.company_id || req.headers["x-company-id"] || "");
    if (!companyId) return successResponseHelper(res, 200, "Developer health", null);
    const companyData = await validateCompanyOwnership(res, companyId, userData.user_id);
    if (!companyData) return;
    const repl = { companyId };

    const [wh, lastFail, keys, company] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
                COUNT(*) FILTER (WHERE status = 'success')::int AS succeeded,
                COALESCE(AVG(response_time_ms) FILTER (WHERE status = 'success'), 0)::int AS avg_ms
           FROM tbl_webhook_delivery_log
          WHERE company_id = :companyId AND created_at > NOW() - INTERVAL '24 hours'`,
        { replacements: repl, type: QueryTypes.SELECT },
      ) as Promise<Row[]>,
      sequelize.query(
        `SELECT log_id, event_type, webhook_url, response_status, error_message, retry_count, created_at
           FROM tbl_webhook_delivery_log
          WHERE company_id = :companyId AND status = 'failed'
          ORDER BY created_at DESC LIMIT 1`,
        { replacements: repl, type: QueryTypes.SELECT },
      ) as Promise<Row[]>,
      sequelize.query(
        `SELECT api_id, api_name, key_hint, environment::text AS environment,
                COALESCE(key_rotated_at, "createdAt") AS since,
                EXTRACT(DAY FROM NOW() - COALESCE(key_rotated_at, "createdAt"))::int AS age_days
           FROM tbl_api
          WHERE company_id = :companyId AND LOWER(COALESCE(status::text, 'active')) = 'active'
          ORDER BY age_days DESC`,
        { replacements: repl, type: QueryTypes.SELECT },
      ) as Promise<Row[]>,
      sequelize.query(
        `SELECT webhook_url, webhook_disabled, webhook_disabled_reason FROM tbl_company WHERE company_id = :companyId`,
        { replacements: repl, type: QueryTypes.SELECT },
      ) as Promise<Row[]>,
    ]);

    const w = wh[0] || {};
    const total = num(w.total);
    const failed = num(w.failed);
    const lf = lastFail[0];
    const keyRows = keys.map((k) => ({
      api_id: k.api_id,
      api_name: k.api_name,
      key_hint: k.key_hint,
      environment: String(k.environment || "production"),
      since: k.since ? new Date(k.since as string).toISOString() : null,
      age_days: num(k.age_days),
      rotate_due: num(k.age_days) >= ROTATE_AFTER_DAYS && String(k.environment || "production") === "production",
    }));
    const c = company[0] || {};

    return successResponseHelper(res, 200, "Developer health", {
      webhooks: {
        configured: Boolean(c.webhook_url),
        url: (c.webhook_url as string) || null,
        disabled: Boolean(c.webhook_disabled),
        disabled_reason: (c.webhook_disabled_reason as string) || null,
        total_24h: total,
        failed_24h: failed,
        success_rate_24h: total > 0 ? Math.round(((total - failed) / total) * 1000) / 10 : null,
        avg_response_ms: num(w.avg_ms),
        last_failure: lf
          ? {
              log_id: lf.log_id,
              event_type: lf.event_type,
              webhook_url: lf.webhook_url,
              response_status: lf.response_status,
              error_message: lf.error_message,
              retry_count: num(lf.retry_count),
              at: new Date(lf.created_at as string).toISOString(),
            }
          : null,
      },
      keys: {
        active: keyRows.length,
        rotate_due: keyRows.filter((k) => k.rotate_due).length,
        rotate_after_days: ROTATE_AFTER_DAYS,
        items: keyRows,
      },
    });
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger, { user_id: userData?.user_id });
  }
};

export default { getDeveloperHealth };
