import express from "express";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { successResponseHelper } from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { companyModel } from "../../models";
import { IUserType } from "../../utils/types";
import { userLogger } from "../../utils/loggers";
import { redis } from "../../utils/redisInstance";
import { STOREFRONT_PER_COMPANY, resolveActiveCompanyId, resolveLegacyStorefrontHolder } from "../storefrontScope";
import { DONATION_COMPLETED_STATUSES } from "../payment/paymentLinkController";
import { toNumber } from "../../utils/money";

const PERIOD_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

interface Scope { handle: string | null; companyId: number | null; published: boolean }

const resolveScope = async (req: express.Request, uid: number): Promise<Scope> => {
  if (STOREFRONT_PER_COMPANY) {
    const companyId = await resolveActiveCompanyId(req, uid);
    if (!companyId) return { handle: null, companyId: null, published: false };
    const c = await companyModel.findOne({ where: { company_id: companyId, user_id: uid }, attributes: ["handle", "creator_page_enabled"] });
    const d = (c?.dataValues || {}) as { handle?: string | null; creator_page_enabled?: boolean };
    return { handle: d.handle ? String(d.handle).toLowerCase() : null, companyId, published: Boolean(d.creator_page_enabled) };
  }
  const holder = await resolveLegacyStorefrontHolder(req, uid);
  if (!holder.isPrimary) return { handle: null, companyId: null, published: false };
  const rows = (await sequelize.query(`SELECT handle, creator_page_enabled FROM tbl_user WHERE user_id = :uid`, {
    replacements: { uid }, type: QueryTypes.SELECT,
  })) as Array<{ handle: string | null; creator_page_enabled: boolean | null }>;
  const u = rows[0];
  return { handle: u?.handle ? String(u.handle).toLowerCase() : null, companyId: null, published: Boolean(u?.creator_page_enabled) };
};

const viewsForDays = async (handle: string, days: number): Promise<number> => {
  const now = Date.now();
  try {
    const entries = await Promise.all(
      Array.from({ length: days }, (_, i) => redis.get(`creator-visits:${handle}:day:${new Date(now - i * 86400000).toISOString().slice(0, 10)}`)),
    );
    return entries.reduce((a: number, b) => a + Number(b || 0), 0);
  } catch {
    return 0;
  }
};

/**
 * GET /api/user/creator/funnel?period=7d|30d|90d — "Your page" funnel for the range:
 * views (Redis daily buckets) → checkouts started (tips + product orders created)
 * → paid (completed tips + paid orders), with the paid USD total.
 */
export const getCreatorFunnel = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const period = PERIOD_DAYS[String(req.query.period || "30d")] ? String(req.query.period || "30d") : "30d";
    const days = PERIOD_DAYS[period];
    const uid = userData.user_id;
    const scope = await resolveScope(req, uid);
    const empty = { period, days, has_handle: false, published: false, views: 0, checkouts: 0, paid: 0, paid_usd: 0,
      tips: { started: 0, paid: 0 }, orders: { started: 0, paid: 0 } };
    if (!scope.handle) return successResponseHelper(res, 200, "Funnel", empty);

    const companyScope = STOREFRONT_PER_COMPANY && scope.companyId
      ? `AND COALESCE(p.company_id, (SELECT MIN(company_id) FROM tbl_company WHERE user_id = :uid)) = :cid`
      : "";
    const orderScope = STOREFRONT_PER_COMPANY && scope.companyId
      ? `AND COALESCE(o.company_id, (SELECT MIN(company_id) FROM tbl_company WHERE user_id = :uid)) = :cid`
      : "";
    const repl = { uid, cid: scope.companyId, days, statuses: DONATION_COMPLETED_STATUSES };

    const [tipRows, orderRows, views] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(*)::int AS started,
                COUNT(*) FILTER (WHERE LOWER(c.status) IN (:statuses))::int AS paid,
                COALESCE(SUM(CASE WHEN LOWER(c.status) IN (:statuses)
                  THEN CASE WHEN UPPER(c.base_currency) = 'USD' THEN c.base_amount ELSE COALESCE(ut.usd_value, 0) END END), 0)::float AS paid_usd
           FROM tbl_payment_link c
           JOIN tbl_payment_link p ON p.link_id = c.parent_link_id
           LEFT JOIN tbl_user_transaction ut ON ut.transaction_reference = c.transaction_reference
          WHERE c.link_type = 'contribution' AND p.link_type = 'donation' AND p.user_id = :uid
            AND c."createdAt" >= NOW() - (:days || ' days')::interval ${companyScope}`,
        { replacements: repl, type: QueryTypes.SELECT },
      ) as Promise<Array<{ started: number; paid: number; paid_usd: number }>>,
      sequelize.query(
        `SELECT COUNT(*)::int AS started,
                COUNT(*) FILTER (WHERE o.payment_status = 'paid')::int AS paid,
                COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_cents END), 0)::bigint AS paid_cents
           FROM tbl_product_order o
          WHERE o.merchant_user_id = :uid
            AND o."createdAt" >= NOW() - (:days || ' days')::interval ${orderScope}`,
        { replacements: repl, type: QueryTypes.SELECT },
      ) as Promise<Array<{ started: number; paid: number; paid_cents: string | number }>>,
      viewsForDays(scope.handle, days),
    ]);
    const tips = tipRows[0] || { started: 0, paid: 0, paid_usd: 0 };
    const orders = orderRows[0] || { started: 0, paid: 0, paid_cents: 0 };
    const paidUsd = toNumber(Number(tips.paid_usd || 0) + Number(orders.paid_cents || 0) / 100, 2);

    return successResponseHelper(res, 200, "Funnel", {
      period, days, has_handle: true, published: scope.published, handle: scope.handle,
      views,
      checkouts: Number(tips.started || 0) + Number(orders.started || 0),
      paid: Number(tips.paid || 0) + Number(orders.paid || 0),
      paid_usd: paidUsd,
      tips: { started: Number(tips.started || 0), paid: Number(tips.paid || 0) },
      orders: { started: Number(orders.started || 0), paid: Number(orders.paid || 0) },
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default getCreatorFunnel;
