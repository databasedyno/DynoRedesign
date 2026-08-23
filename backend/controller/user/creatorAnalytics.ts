import { getCreatorAnalyticsData } from "../payment/paymentLinkController";
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
