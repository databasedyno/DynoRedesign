/**
 * Analytics Controller
 * 
 * Admin-only endpoints for revenue analytics, cohort analysis, and funnels.
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { apiLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import {
  getRevenueAnalytics,
  getUserGrowthAnalytics,
  getCohortAnalysis,
  getPaymentFunnel,
} from "../services/analyticsService";

/**
 * GET /api/admin/analytics/revenue?period=30d
 */
const revenue = async (req: express.Request, res: express.Response) => {
  try {
    const period = (req.query.period as string) || "30d";
    const validPeriods = ["7d", "30d", "90d", "1y"];
    if (!validPeriods.includes(period)) {
      return errorResponseHelper(res, 400, `Invalid period. Must be one of: ${validPeriods.join(", ")}`);
    }

    const data = await getRevenueAnalytics(period as "7d" | "30d" | "90d" | "1y");
    successResponseHelper(res, 200, "Revenue analytics retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/users
 */
const userGrowth = async (_req: express.Request, res: express.Response) => {
  try {
    const data = await getUserGrowthAnalytics();
    successResponseHelper(res, 200, "User growth analytics retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/cohorts?weeks=8
 */
const cohorts = async (req: express.Request, res: express.Response) => {
  try {
    const weeks = parseInt(req.query.weeks as string) || 8;
    const data = await getCohortAnalysis(Math.min(weeks, 52));
    successResponseHelper(res, 200, "Cohort analysis retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/funnel?days=30
 */
const funnel = async (req: express.Request, res: express.Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await getPaymentFunnel(Math.min(days, 365));
    successResponseHelper(res, 200, "Payment funnel analysis retrieved", data);
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/onboarding?days=30
 * Onboarding-checklist drop-off funnel built from tbl_onboarding_event.
 */
const onboardingFunnel = async (req: express.Request, res: express.Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);

    const rows = await sequelize.query<{
      event_type: string;
      step_key: string | null;
      events: string;
      users: string;
    }>(
      `SELECT event_type, step_key,
              COUNT(*)::int AS events,
              COUNT(DISTINCT user_id)::int AS users
       FROM tbl_onboarding_event
       WHERE created_at >= NOW() - (:days || ' days')::interval
       GROUP BY event_type, step_key`,
      { replacements: { days: String(days) }, type: QueryTypes.SELECT }
    );

    const usersByKey: Record<string, number> = {};
    const eventsByKey: Record<string, number> = {};
    for (const r of rows) {
      const key = r.step_key ? `${r.event_type}:${r.step_key}` : r.event_type;
      usersByKey[key] = Number(r.users) || 0;
      eventsByKey[key] = Number(r.events) || 0;
    }

    // Distinct-user funnel (engagement → intent → completion)
    const funnel = {
      saw_checklist: usersByKey["checklist_shown"] || 0,
      clicked_company: usersByKey["step_clicked:company"] || 0,
      clicked_wallet: usersByKey["step_clicked:wallet"] || 0,
      clicked_link: usersByKey["step_clicked:link"] || 0,
      completed_company: usersByKey["step_completed:company"] || 0,
      completed_wallet: usersByKey["step_completed:wallet"] || 0,
      dismissed: usersByKey["dismissed"] || 0,
      collapsed: usersByKey["collapsed"] || 0,
      expanded: usersByKey["expanded"] || 0,
    };

    successResponseHelper(res, 200, "Onboarding funnel retrieved", {
      period_days: days,
      funnel,
      raw_event_counts: eventsByKey,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

/**
 * GET /api/admin/analytics/attribution?days=90
 * Signup source → conversion funnel from tbl_signup_attribution: for each
 * derived channel (chatgpt/google/telegram/direct/…), how many signed up, went
 * on to create a payment link, and actually transacted. Plus top UTM campaigns.
 */
const attribution = async (req: express.Request, res: express.Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 90, 365);

    const bySource = await sequelize.query<{
      source: string;
      signups: number;
      created_link: number;
      transacted: number;
    }>(
      `SELECT COALESCE(NULLIF(a.source, ''), 'unknown') AS source,
              COUNT(*)::int AS signups,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM tbl_payment_link pl WHERE pl.user_id = a.user_id
              ))::int AS created_link,
              COUNT(*) FILTER (WHERE COALESCE(u.cumulative_volume_usd, 0) > 0)::int AS transacted
       FROM tbl_signup_attribution a
       JOIN tbl_user u ON u.user_id = a.user_id
       WHERE a.created_at >= NOW() - (:days || ' days')::interval
       GROUP BY 1
       ORDER BY signups DESC`,
      { replacements: { days: String(days) }, type: QueryTypes.SELECT }
    );

    const topCampaigns = await sequelize.query(
      `SELECT COALESCE(NULLIF(a.utm_campaign, ''), '(none)') AS campaign,
              COALESCE(NULLIF(a.utm_source, ''), '(none)') AS utm_source,
              COUNT(*)::int AS signups
       FROM tbl_signup_attribution a
       WHERE a.created_at >= NOW() - (:days || ' days')::interval
         AND (a.utm_campaign IS NOT NULL OR a.utm_source IS NOT NULL)
       GROUP BY 1, 2
       ORDER BY signups DESC
       LIMIT 20`,
      { replacements: { days: String(days) }, type: QueryTypes.SELECT }
    );

    const by_source = bySource.map((r) => ({
      source: r.source,
      signups: Number(r.signups) || 0,
      created_link: Number(r.created_link) || 0,
      transacted: Number(r.transacted) || 0,
    }));
    const totals = by_source.reduce(
      (acc, r) => ({
        signups: acc.signups + r.signups,
        created_link: acc.created_link + r.created_link,
        transacted: acc.transacted + r.transacted,
      }),
      { signups: 0, created_link: 0, transacted: 0 }
    );

    successResponseHelper(res, 200, "Attribution funnel retrieved", {
      period_days: days,
      totals,
      by_source,
      top_campaigns: topCampaigns,
    });
  } catch (e) {
    handleControllerError(res, e, apiLogger);
  }
};

export default {
  revenue,
  userGrowth,
  cohorts,
  funnel,
  onboardingFunnel,
  attribution,
};
