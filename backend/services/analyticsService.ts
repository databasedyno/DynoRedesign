/**
 * Analytics Service
 * 
 * Revenue analytics, cohort analysis, funnel visualization,
 * and event tracking for admin dashboard.
 */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";
import { apiLogger } from "../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import { processedStatusSql } from "../utils/processedVolume";
import { toNumber } from "../utils/money";

const CACHE_TTL = 300; // 5 minutes

/**
 * Revenue Analytics — approximated MRR, transaction volume, growth
 */
export const getRevenueAnalytics = async (period: "7d" | "30d" | "90d" | "1y" = "30d"): Promise<Record<string, unknown>> => {
  const cacheKey = `analytics:revenue:${period}`;
  const cached = await getRedisItem(cacheKey);
  if (cached && typeof cached === "object" && Object.keys(cached).length > 0) return cached as Record<string, unknown>;

  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;

  // Total transaction volume in period
  const [volumeData] = await sequelize.query<{ total_volume: string; total_transactions: string; total_fees: string }>(
    `SELECT 
       COALESCE(SUM(base_amount), 0) as total_volume,
       COUNT(*) as total_transactions,
       COALESCE(SUM(fee_amount), 0) as total_fees
     FROM tbl_user_transaction
     WHERE "createdAt" >= NOW() - INTERVAL '${days} days'
       AND ${processedStatusSql("")}`,
    { type: QueryTypes.SELECT }
  );

  // Previous period for comparison
  const [prevVolumeData] = await sequelize.query<{ total_volume: string; total_transactions: string }>(
    `SELECT 
       COALESCE(SUM(base_amount), 0) as total_volume,
       COUNT(*) as total_transactions
     FROM tbl_user_transaction
     WHERE "createdAt" >= NOW() - INTERVAL '${days * 2} days'
       AND "createdAt" < NOW() - INTERVAL '${days} days'
       AND ${processedStatusSql("")}`,
    { type: QueryTypes.SELECT }
  );

  // Daily revenue trend
  const dailyRevenue = await sequelize.query<{ date: string; volume: string; transactions: string; fees: string }>(
    `SELECT 
       DATE("createdAt") as date,
       COALESCE(SUM(base_amount), 0) as volume,
       COUNT(*) as transactions,
       COALESCE(SUM(fee_amount), 0) as fees
     FROM tbl_user_transaction
     WHERE "createdAt" >= NOW() - INTERVAL '${days} days'
       AND ${processedStatusSql("")}
     GROUP BY DATE("createdAt")
     ORDER BY date ASC`,
    { type: QueryTypes.SELECT }
  );

  // Active merchants (unique users with transactions)
  const [activeMerchants] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(DISTINCT user_id) as count
     FROM tbl_user_transaction
     WHERE "createdAt" >= NOW() - INTERVAL '${days} days'`,
    { type: QueryTypes.SELECT }
  );

  const currentVolume = parseFloat(volumeData?.total_volume || "0");
  const previousVolume = parseFloat(prevVolumeData?.total_volume || "0");
  const volumeGrowth = previousVolume > 0 ? ((currentVolume - previousVolume) / previousVolume) * 100 : 0;

  const result = {
    period,
    total_volume: currentVolume,
    total_transactions: parseInt(volumeData?.total_transactions || "0"),
    total_fees_collected: parseFloat(volumeData?.total_fees || "0"),
    volume_growth_pct: toNumber(volumeGrowth, 2),
    active_merchants: parseInt(activeMerchants?.count || "0"),
    daily_trend: dailyRevenue,
    avg_transaction_value: parseInt(volumeData?.total_transactions || "0") > 0
      ? toNumber((currentVolume / parseInt(volumeData.total_transactions)), 2)
      : 0,
  };

  await setRedisItem(cacheKey, result);
  await setRedisTTL(cacheKey, CACHE_TTL);
  return result;
};

/**
 * User Growth Analytics
 */
export const getUserGrowthAnalytics = async (): Promise<Record<string, unknown>> => {
  const cacheKey = "analytics:user_growth";
  const cached = await getRedisItem(cacheKey);
  if (cached && typeof cached === "object" && Object.keys(cached).length > 0) return cached as Record<string, unknown>;

  // Total users
  const [totalUsers] = await sequelize.query<{ total: string; active: string }>(
    `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM tbl_user`,
    { type: QueryTypes.SELECT }
  );

  // New users per week (last 12 weeks)
  const weeklyGrowth = await sequelize.query<{ week: string; new_users: string }>(
    `SELECT DATE_TRUNC('week', "createdAt") as week, COUNT(*) as new_users
     FROM tbl_user
     WHERE "createdAt" >= NOW() - INTERVAL '12 weeks'
     GROUP BY week ORDER BY week ASC`,
    { type: QueryTypes.SELECT }
  );

  // New users today, this week, this month
  const [recentCounts] = await sequelize.query<{ today: string; this_week: string; this_month: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE) as today,
       COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('week', CURRENT_DATE)) as this_week,
       COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE)) as this_month
     FROM tbl_user`,
    { type: QueryTypes.SELECT }
  );

  const result = {
    total_users: parseInt(totalUsers?.total || "0"),
    active_users: parseInt(totalUsers?.active || "0"),
    new_users_today: parseInt(recentCounts?.today || "0"),
    new_users_this_week: parseInt(recentCounts?.this_week || "0"),
    new_users_this_month: parseInt(recentCounts?.this_month || "0"),
    weekly_growth: weeklyGrowth,
  };

  await setRedisItem(cacheKey, result);
  await setRedisTTL(cacheKey, CACHE_TTL);
  return result;
};

/**
 * Cohort Retention Analysis
 * Groups users by signup week, tracks % who transacted in subsequent weeks
 */
export const getCohortAnalysis = async (weeks: number = 8): Promise<Record<string, unknown>> => {
  const cacheKey = `analytics:cohort:${weeks}`;
  const cached = await getRedisItem(cacheKey);
  if (cached && typeof cached === "object" && Object.keys(cached).length > 0) return cached as Record<string, unknown>;

  const cohortData = await sequelize.query<Record<string, string>>(
    `WITH cohorts AS (
       SELECT user_id, DATE_TRUNC('week', "createdAt") as cohort_week
       FROM tbl_user
       WHERE "createdAt" >= NOW() - INTERVAL '${weeks} weeks'
     ),
     activity AS (
       SELECT DISTINCT user_id, DATE_TRUNC('week', "createdAt") as activity_week
       FROM tbl_user_transaction
       WHERE "createdAt" >= NOW() - INTERVAL '${weeks} weeks'
     )
     SELECT
       c.cohort_week,
       COUNT(DISTINCT c.user_id) as cohort_size,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.activity_week = c.cohort_week) as week_0,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.activity_week = c.cohort_week + INTERVAL '1 week') as week_1,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.activity_week = c.cohort_week + INTERVAL '2 weeks') as week_2,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.activity_week = c.cohort_week + INTERVAL '3 weeks') as week_3,
       COUNT(DISTINCT a.user_id) FILTER (WHERE a.activity_week = c.cohort_week + INTERVAL '4 weeks') as week_4
     FROM cohorts c
     LEFT JOIN activity a ON c.user_id = a.user_id
     GROUP BY c.cohort_week
     ORDER BY c.cohort_week ASC`,
    { type: QueryTypes.SELECT }
  );

  // Convert to retention percentages
  const cohorts = cohortData.map((row) => {
    const size = parseInt(row.cohort_size || "0");
    return {
      cohort_week: row.cohort_week,
      cohort_size: size,
      retention: {
        week_0: size > 0 ? Math.round((parseInt(row.week_0 || "0") / size) * 100) : 0,
        week_1: size > 0 ? Math.round((parseInt(row.week_1 || "0") / size) * 100) : 0,
        week_2: size > 0 ? Math.round((parseInt(row.week_2 || "0") / size) * 100) : 0,
        week_3: size > 0 ? Math.round((parseInt(row.week_3 || "0") / size) * 100) : 0,
        week_4: size > 0 ? Math.round((parseInt(row.week_4 || "0") / size) * 100) : 0,
      },
    };
  });

  const result = { period_weeks: weeks, cohorts };
  await setRedisItem(cacheKey, result);
  await setRedisTTL(cacheKey, CACHE_TTL);
  return result;
};

/**
 * Payment Funnel Analysis
 * Tracks: Link Created → Payment Initiated → Payment Pending → Payment Confirmed → Payout Complete
 */
export const getPaymentFunnel = async (days: number = 30): Promise<Record<string, unknown>> => {
  const cacheKey = `analytics:funnel:${days}`;
  const cached = await getRedisItem(cacheKey);
  if (cached && typeof cached === "object" && Object.keys(cached).length > 0) return cached as Record<string, unknown>;

  // Payment links created
  const [linksCreated] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM tbl_payment_link WHERE "createdAt" >= NOW() - INTERVAL '${days} days'`,
    { type: QueryTypes.SELECT }
  );

  // Payments initiated (transactions created)
  const [paymentsInitiated] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM tbl_user_transaction WHERE "createdAt" >= NOW() - INTERVAL '${days} days'`,
    { type: QueryTypes.SELECT }
  );

  // Payments by status
  const statusCounts = await sequelize.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) as count
     FROM tbl_user_transaction
     WHERE "createdAt" >= NOW() - INTERVAL '${days} days'
     GROUP BY status`,
    { type: QueryTypes.SELECT }
  );

  const statusMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusMap[row.status] = parseInt(row.count);
  }

  const total = parseInt(paymentsInitiated?.count || "0");
  const successful = statusMap["successful"] || 0;
  const pending = statusMap["pending"] || 0;
  const failed = statusMap["failed"] || 0;

  const funnel = {
    period_days: days,
    stages: [
      { name: "Links Created", count: parseInt(linksCreated?.count || "0"), pct: 100 },
      { name: "Payments Initiated", count: total, pct: parseInt(linksCreated?.count || "0") > 0 ? Math.round((total / parseInt(linksCreated.count)) * 100) : 0 },
      { name: "Pending", count: pending + successful, pct: total > 0 ? Math.round(((pending + successful) / total) * 100) : 0 },
      { name: "Successful", count: successful, pct: total > 0 ? Math.round((successful / total) * 100) : 0 },
    ],
    conversion_rate: total > 0 ? Math.round((successful / total) * 10000) / 100 : 0,
    failure_rate: total > 0 ? Math.round((failed / total) * 10000) / 100 : 0,
    status_breakdown: statusMap,
  };

  await setRedisItem(cacheKey, funnel);
  await setRedisTTL(cacheKey, CACHE_TTL);
  return funnel;
};

export default {
  getRevenueAnalytics,
  getUserGrowthAnalytics,
  getCohortAnalysis,
  getPaymentFunnel,
};
