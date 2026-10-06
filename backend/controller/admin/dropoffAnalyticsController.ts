/**
 * Admin — Activation & Drop-off analytics.
 *   GET /api/admin/analytics/activation-funnel  (merchant signup→first-payment)
 *   GET /api/admin/analytics/stuck-merchants     (drill-down: who stalled + where)
 *   GET /api/admin/analytics/checkout-funnel      (buyer payment-link + checkout-view funnel)
 *
 * All read-only raw SQL over existing tables + tbl_checkout_session. No money-path
 * code is touched. "Success" status vocab confirmed from prod data:
 *   user/customer transaction → 'successful' | 'completed' (+ settled/confirmed as safety)
 *   payment link paid         → status IN ('successful','completed') OR times_used > 0
 */
import express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { successResponseHelper } from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { adminLogger } from "../../utils/loggers";

const PAID = `('successful','completed','settled','confirmed')`;

/** days: positive int (capped 3650) = look-back window; 0 / missing-as-0 = all time. */
const clampDays = (v: unknown, def: number): number => {
  const n = parseInt(String(v ?? ""), 10);
  if (Number.isNaN(n)) return def;
  if (n <= 0) return 0;
  return Math.min(n, 3650);
};

const getActivationFunnel = async (req: express.Request, res: express.Response) => {
  try {
    const days = clampDays(req.query.days, 90);
    const rows = (await sequelize.query(
      `WITH cohort AS (
         SELECT u.user_id, u.email_verified, u."createdAt" AS signed_up_at
           FROM "tbl_user" u
          WHERE u.deleted_at IS NULL
            AND (:days = 0 OR u."createdAt" > NOW() - (:days::text || ' days')::interval)
       ),
       link AS (
         SELECT user_id, MIN("createdAt") AS first_at
           FROM "tbl_payment_link"
          WHERE is_tip_jar = false AND (link_type IS NULL OR link_type <> 'contribution')
          GROUP BY user_id
       ),
       apikey AS (
         SELECT user_id, MIN("createdAt") AS first_at FROM "tbl_api" GROUP BY user_id
       ),
       paid AS (
         SELECT user_id, MIN("createdAt") AS first_at
           FROM "tbl_user_transaction"
          WHERE status IN ${PAID} AND (environment IS NULL OR environment <> 'development')
          GROUP BY user_id
       ),
       j AS (
         SELECT c.email_verified, c.signed_up_at,
                LEAST(l.first_at, a.first_at) AS method_at,
                p.first_at AS paid_at,
                (l.user_id IS NOT NULL) AS has_link,
                (a.user_id IS NOT NULL) AS has_api
           FROM cohort c
           LEFT JOIN link l   ON l.user_id = c.user_id
           LEFT JOIN apikey a ON a.user_id = c.user_id
           LEFT JOIN paid p   ON p.user_id = c.user_id
       )
       SELECT
         COUNT(*)::int AS signed_up,
         COUNT(*) FILTER (WHERE email_verified)::int AS verified,
         COUNT(*) FILTER (WHERE method_at IS NOT NULL)::int AS created_method,
         COUNT(*) FILTER (WHERE has_link)::int AS created_link,
         COUNT(*) FILTER (WHERE has_api)::int AS created_apikey,
         COUNT(*) FILTER (WHERE paid_at IS NOT NULL)::int AS first_payment,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (method_at - signed_up_at)))
           FILTER (WHERE method_at IS NOT NULL AND method_at >= signed_up_at) AS median_signup_to_method_secs,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (paid_at - method_at)))
           FILTER (WHERE paid_at IS NOT NULL AND method_at IS NOT NULL AND paid_at >= method_at) AS median_method_to_payment_secs
       FROM j`,
      { type: QueryTypes.SELECT, replacements: { days } }
    )) as Array<Record<string, number | null>>;

    successResponseHelper(res, 200, "Activation funnel", { days, funnel: rows[0] || {} });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const getStuckMerchants = async (req: express.Request, res: express.Response) => {
  try {
    const days = clampDays(req.query.days, 0);
    const stage = ["signed_up", "verified", "has_method"].includes(String(req.query.stage))
      ? String(req.query.stage)
      : "all";
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset || "0"), 10) || 0, 0);

    const CTE = `
      WITH base AS (
        SELECT u.user_id, u.name, u.email, u.email_verified, u."createdAt" AS signed_up_at,
          (SELECT COUNT(*) FROM "tbl_payment_link" pl
             WHERE pl.user_id = u.user_id AND pl.is_tip_jar = false
               AND (pl.link_type IS NULL OR pl.link_type <> 'contribution'))::int AS links,
          (SELECT COUNT(*) FROM "tbl_api" ak WHERE ak.user_id = u.user_id)::int AS apikeys,
          (SELECT COUNT(*) FROM "tbl_user_transaction" t WHERE t.user_id = u.user_id)::int AS tx_any,
          (SELECT COUNT(*) FROM "tbl_user_transaction" t
             WHERE t.user_id = u.user_id AND t.status IN ${PAID}
               AND (t.environment IS NULL OR t.environment <> 'development'))::int AS tx_paid,
          (SELECT sa.source FROM "tbl_signup_attribution" sa WHERE sa.user_id = u.user_id LIMIT 1) AS source
        FROM "tbl_user" u
        WHERE u.deleted_at IS NULL
          AND (:days = 0 OR u."createdAt" > NOW() - (:days::text || ' days')::interval)
      ),
      staged AS (
        SELECT *,
          CASE WHEN tx_paid > 0 THEN 'paid'
               WHEN links > 0 OR apikeys > 0 THEN 'has_method'
               WHEN email_verified THEN 'verified'
               ELSE 'signed_up' END AS stage,
          EXTRACT(DAY FROM (NOW() - signed_up_at))::int AS days_since_signup
        FROM base
      )`;

    const rows = await sequelize.query(
      `${CTE}
       SELECT user_id, name, email, email_verified, signed_up_at, days_since_signup,
              links, apikeys, tx_any, source, stage
         FROM staged
        WHERE stage <> 'paid' AND (:stage = 'all' OR stage = :stage)
        ORDER BY signed_up_at DESC
        LIMIT :limit OFFSET :offset`,
      { type: QueryTypes.SELECT, replacements: { days, stage, limit, offset } }
    );

    const counts = (await sequelize.query(
      `${CTE}
       SELECT
         COUNT(*) FILTER (WHERE stage = 'signed_up')::int  AS signed_up,
         COUNT(*) FILTER (WHERE stage = 'verified')::int    AS verified,
         COUNT(*) FILTER (WHERE stage = 'has_method')::int  AS has_method,
         COUNT(*) FILTER (WHERE stage <> 'paid')::int       AS total_stuck
       FROM staged`,
      { type: QueryTypes.SELECT, replacements: { days } }
    )) as Array<Record<string, number>>;

    successResponseHelper(res, 200, "Stuck merchants", {
      days,
      stage,
      limit,
      offset,
      counts: counts[0] || { signed_up: 0, verified: 0, has_method: 0, total_stuck: 0 },
      rows,
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

const getCheckoutFunnel = async (req: express.Request, res: express.Response) => {
  try {
    const days = clampDays(req.query.days, 30);

    const links = (await sequelize.query(
      `SELECT
         COUNT(*)::int AS created,
         COUNT(*) FILTER (WHERE status IN ('successful','completed') OR times_used > 0)::int AS paid,
         COUNT(*) FILTER (WHERE status NOT IN ('successful','completed') AND times_used = 0
                           AND expires_at IS NOT NULL AND expires_at < NOW())::int AS expired_unpaid,
         COUNT(*) FILTER (WHERE status NOT IN ('successful','completed') AND times_used = 0
                           AND (expires_at IS NULL OR expires_at >= NOW()))::int AS pending
       FROM "tbl_payment_link"
       WHERE is_tip_jar = false AND (link_type IS NULL OR link_type <> 'contribution')
         AND (:days = 0 OR "createdAt" > NOW() - (:days::text || ' days')::interval)`,
      { type: QueryTypes.SELECT, replacements: { days } }
    )) as Array<Record<string, number>>;

    const sessions = (await sequelize.query(
      `SELECT
         COUNT(*)::int AS views,
         COUNT(*) FILTER (WHERE address_shown_at IS NOT NULL)::int AS address_shown,
         COALESCE(SUM(view_count), 0)::int AS total_views
       FROM "tbl_checkout_session"
       WHERE (:days = 0 OR viewed_at > NOW() - (:days::text || ' days')::interval)`,
      { type: QueryTypes.SELECT, replacements: { days } }
    )) as Array<Record<string, number>>;

    const payments = (await sequelize.query(
      `SELECT COUNT(*)::int AS confirmed
       FROM "tbl_customer_transaction"
       WHERE status IN ${PAID}
         AND (:days = 0 OR "createdAt" > NOW() - (:days::text || ' days')::interval)`,
      { type: QueryTypes.SELECT, replacements: { days } }
    )) as Array<Record<string, number>>;

    successResponseHelper(res, 200, "Checkout funnel", {
      days,
      links: links[0] || { created: 0, paid: 0, expired_unpaid: 0, pending: 0 },
      sessions: sessions[0] || { views: 0, address_shown: 0, total_views: 0 },
      payments: payments[0] || { confirmed: 0 },
    });
  } catch (e) {
    handleControllerError(res, e, adminLogger);
  }
};

export default { getActivationFunnel, getStuckMerchants, getCheckoutFunnel };
