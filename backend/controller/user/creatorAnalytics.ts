import { getCreatorAnalyticsData, DONATION_COMPLETED_STATUSES } from "../payment/paymentLinkController";
import express from "express";
import { successResponseHelper } from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { userModel, companyModel } from "../../models";
import sequelize from "../../utils/dbInstance";
import { QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import { userLogger } from "../../utils/loggers";
import { redis } from "../../utils/redisInstance";
import { STOREFRONT_PER_COMPANY, resolveActiveCompanyId, resolveLegacyStorefrontHolder } from "../storefrontScope";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * GET /api/user/creator/analytics/split — "Compare storefronts".
 * One row per owned company: 30-day page views, tips and paid product sales.
 * Flag OFF: the shared storefront's traffic/tips/sales are attributed to the
 * PRIMARY company (matching what migration 010 will backfill); other companies
 * report zeros until they exist per-company.
 */
export const getCreatorAnalyticsSplit = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const uid = userData.user_id;
    const companies = (await companyModel.findAll({
      where: { user_id: uid },
      attributes: STOREFRONT_PER_COMPANY
        ? ["company_id", "company_name", "handle"]
        : ["company_id", "company_name"],
      order: [["company_id", "ASC"]],
    })) as Array<{ dataValues: { company_id: number; company_name: string | null; handle?: string | null } }>;
    if (!companies.length) {
      return successResponseHelper(res, 200, "Storefront comparison", {
        window_days: 30, currency: "USD", companies: [],
      });
    }
    const primaryId = Number(companies[0].dataValues.company_id);
    const user = await userModel.findOne({
      where: { user_id: uid },
      attributes: ["handle", "support_widget_currency"],
    });
    const accountHandle = user?.dataValues?.handle || null;
    const currency = user?.dataValues?.support_widget_currency || "USD";

    // Tips (30d) per company — legacy links without a company stamp roll up to primary.
    const tipRows = (await sequelize.query(
      `SELECT COALESCE(p.company_id, :primaryId)::int AS company_id,
              COUNT(*)::int AS tips_count,
              COALESCE(SUM(c.base_amount), 0)::float AS tips_amount
         FROM tbl_payment_link c
         JOIN tbl_payment_link p ON p.link_id = c.parent_link_id
        WHERE c.link_type = 'contribution'
          AND LOWER(c.status) IN (:statuses)
          AND p.user_id = :uid
          AND p.link_type = 'donation'
          AND c."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY 1`,
      { replacements: { uid, primaryId, statuses: DONATION_COMPLETED_STATUSES }, type: QueryTypes.SELECT }
    )) as Array<{ company_id: number; tips_count: number; tips_amount: number }>;

    // Paid product sales (30d) per company. tbl_product_order.company_id only
    // exists post-migration — never reference it while the flag is OFF.
    const salesSql = STOREFRONT_PER_COMPANY
      ? `SELECT COALESCE(company_id, :primaryId)::int AS company_id,
                COUNT(*)::int AS sales_count,
                COALESCE(SUM(total_cents), 0)::bigint AS sales_cents
           FROM tbl_product_order
          WHERE merchant_user_id = :uid AND payment_status = 'paid'
            AND "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY 1`
      : `SELECT :primaryId::int AS company_id,
                COUNT(*)::int AS sales_count,
                COALESCE(SUM(total_cents), 0)::bigint AS sales_cents
           FROM tbl_product_order
          WHERE merchant_user_id = :uid AND payment_status = 'paid'
            AND "createdAt" >= NOW() - INTERVAL '30 days'`;
    const salesRows = (await sequelize.query(salesSql, {
      replacements: { uid, primaryId },
      type: QueryTypes.SELECT,
    })) as Array<{ company_id: number; sales_count: number; sales_cents: string | number }>;

    const now = Date.now();
    const results = [];
    for (const comp of companies) {
      const d = comp.dataValues;
      const cid = Number(d.company_id);
      const handle = STOREFRONT_PER_COMPANY
        ? (d.handle ? String(d.handle).toLowerCase() : null)
        : (cid === primaryId && accountHandle ? String(accountHandle).toLowerCase() : null);

      let views = 0;
      // 30-day daily bucket array (oldest first) — powers the sparkline on the
      // compare panel. Missing keys / redis errors surface as 0s so the client
      // always gets exactly 30 datapoints per company (never a jagged chart).
      const viewsDaily: number[] = new Array(30).fill(0);
      if (handle) {
        try {
          const entries = await Promise.all(
            Array.from({ length: 30 }, (_, i) => {
              // i=0 → today, i=29 → 29 days ago
              const ymd = new Date(now - i * 86400000).toISOString().slice(0, 10);
              return redis.get(`creator-visits:${handle}:day:${ymd}`);
            })
          );
          for (let i = 0; i < 30; i++) {
            const n = Number(entries[i] || 0);
            viewsDaily[29 - i] = n; // reverse to oldest-first
            views += n;
          }
        } catch { /* redis best-effort → zeros */ }
      }

      const tips = tipRows.find((r) => Number(r.company_id) === cid);
      const sales = salesRows.find((r) => Number(r.company_id) === cid);
      results.push({
        company_id: cid,
        company_name: d.company_name || null,
        handle,
        is_primary: cid === primaryId,
        views_30d: views,
        views_daily: viewsDaily,
        tips_count_30d: tips?.tips_count || 0,
        tips_amount_30d: round2(tips?.tips_amount || 0),
        sales_count_30d: sales?.sales_count || 0,
        sales_amount_30d: round2(Number(sales?.sales_cents || 0) / 100),
      });
    }

    return successResponseHelper(res, 200, "Storefront comparison", {
      window_days: 30,
      currency,
      companies: results,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/** GET /api/user/creator/stats — total + this-week visits, supporters count */
export const getCreatorStats = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    let handleRaw: string | null = null;
    if (STOREFRONT_PER_COMPANY) {
      const companyId = await resolveActiveCompanyId(req, userData.user_id);
      if (companyId) {
        const c = await companyModel.findOne({ where: { company_id: companyId, user_id: userData.user_id }, attributes: ["handle"] });
        handleRaw = (c?.dataValues as { handle?: string } | undefined)?.handle || null;
      }
    } else {
      // Legacy (flag OFF): the shared storefront's stats belong to the PRIMARY
      // company only — a newly created company shows the empty state instead.
      const holder = await resolveLegacyStorefrontHolder(req, userData.user_id);
      if (holder.isPrimary) {
        const user = await userModel.findOne({
          where: { user_id: userData.user_id },
          attributes: ["handle"],
        });
        handleRaw = user?.dataValues?.handle || null;
      }
    }
    const handle = handleRaw ? String(handleRaw).toLowerCase() : null;

    if (!handle) {
      return successResponseHelper(res, 200, "Stats retrieved", {
        total_visits: 0,
        this_week_visits: 0,
        supporters_count: 0,
        top_referrers: [],
        daily_visits: [],
        has_handle: false,
      });
    }

    // Total visits (single counter key)
    let totalVisits = 0;
    try {
      const raw = await redis.get(`creator-visits:${handle}`);
      totalVisits = Number(raw || 0);
    } catch { /* redis best-effort */ }

    // This week: sum last 7 daily buckets
    let weekVisits = 0;
    // Daily visits for last 14 days (oldest first, for sparkline)
    const dailyVisits: Array<{ date: string; count: number }> = [];
    try {
      const now = Date.now();
      const daily7 = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now - i * 86400000);
          const ymd = d.toISOString().slice(0, 10);
          return redis.get(`creator-visits:${handle}:day:${ymd}`);
        })
      );
      weekVisits = daily7.reduce((a: number, b) => a + Number(b || 0), 0);

      const daily14 = await Promise.all(
        Array.from({ length: 14 }, (_, i) => {
          // i=13 → 13 days ago, i=0 → today  (build oldest-first)
          const d = new Date(now - (13 - i) * 86400000);
          const ymd = d.toISOString().slice(0, 10);
          return redis.get(`creator-visits:${handle}:day:${ymd}`).then((v) => ({ ymd, v }));
        })
      );
      daily14.forEach(({ ymd, v }) => dailyVisits.push({ date: ymd, count: Number(v || 0) }));
    } catch { /* best-effort */ }

    // Top referrers (Session 60) — Redis hash: field=domain, value=clicks
    const topReferrers: Array<{ domain: string; clicks: number }> = [];
    try {
      const refs = await redis.hGetAll(`creator-referrers:${handle}`);
      const entries = Object.entries(refs || {}).map(([domain, v]) => ({
        domain,
        clicks: Number(v || 0),
      }));
      entries.sort((a, b) => b.clicks - a.clicks);
      topReferrers.push(...entries.slice(0, 5));
    } catch { /* best-effort */ }

    // Supporters count: distinct customers on this user's completed donation contributions
    let supportersCount = 0;
    try {
      const rows = await sequelize.query(
        `SELECT COUNT(DISTINCT ut.customer_id) AS c
         FROM tbl_user_transaction ut
         JOIN tbl_payment_link pl ON pl.link_id = ut.link_id
         JOIN tbl_payment_link parent ON parent.link_id = pl.parent_link_id
         WHERE parent.user_id = :uid
           AND parent.link_type = 'donation'
           AND LOWER(ut.status) IN ('successful','completed','confirmed','processing','converted','payout_complete')`,
        { replacements: { uid: userData.user_id }, type: QueryTypes.SELECT }
      ) as Array<{ c: string | number }>;
      supportersCount = Number(rows?.[0]?.c || 0);
    } catch { /* best-effort */ }

    return successResponseHelper(res, 200, "Stats retrieved", {
      total_visits: totalVisits,
      this_week_visits: weekVisits,
      supporters_count: supportersCount,
      top_referrers: topReferrers,
      daily_visits: dailyVisits,
      has_handle: true,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/creator/analytics
 * Merchant's own view of Creator Page Analytics — 30-day tip chart, top 5
 * supporters, and LIFETIME totals for the settings page. Unlike the public
 * endpoint, this ignores `public_analytics_enabled` (the creator always sees
 * their own private analytics regardless of whether the public toggle is on).
 * Session 2026-08-05.
 */
export const getCreatorAnalytics = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    let handle: string | null = null;
    let currency = "USD";
    let publicEnabled = true;
    if (STOREFRONT_PER_COMPANY) {
      const companyId = await resolveActiveCompanyId(req, userData.user_id);
      if (companyId) {
        const c = await companyModel.findOne({
          where: { company_id: companyId, user_id: userData.user_id },
          attributes: ["handle", "support_widget_currency", "public_analytics_enabled"],
        });
        const d = (c?.dataValues || {}) as { handle?: string; support_widget_currency?: string; public_analytics_enabled?: boolean };
        handle = d.handle || null;
        currency = d.support_widget_currency || "USD";
        publicEnabled = d.public_analytics_enabled !== false;
      }
    } else {
      // Legacy (flag OFF): analytics for the shared storefront belong to the
      // PRIMARY company only (see getCreatorStats).
      const holder = await resolveLegacyStorefrontHolder(req, userData.user_id);
      if (holder.isPrimary) {
        const user = await userModel.findOne({
          where: { user_id: userData.user_id },
          attributes: ["handle", "support_widget_currency", "public_analytics_enabled"],
        });
        handle = user?.dataValues?.handle || null;
        currency = user?.dataValues?.support_widget_currency || "USD";
        publicEnabled = user?.dataValues?.public_analytics_enabled !== false;
      }
    }

    if (!handle) {
      // No handle yet → nothing to analyze; return the empty shell so the
      // settings page can still render a "Reserve a handle first" empty state.
      return successResponseHelper(res, 200, "No handle yet", {
        enabled: false,
        public_analytics_enabled: publicEnabled,
        chart: [],
        top_supporters: [],
        totals: { amount_30d: 0, count_30d: 0, supporters_30d: 0, amount_lifetime: 0, supporters_lifetime: 0 },
        currency,
        window_days: 30,
        has_handle: false,
      });
    }

    const data = await getCreatorAnalyticsData(userData.user_id, currency, true);
    return successResponseHelper(res, 200, "Creator analytics retrieved", {
      enabled: true,
      public_analytics_enabled: publicEnabled,
      has_handle: true,
      ...data,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};
