import express from "express";
import { apiLogger } from "../utils/loggers";
import { handleControllerErrorReturn } from "../helper/controllerErrorHandler";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import { IUserType } from "../utils/types";
import { userTransactionModel, userWalletModel, companyModel } from "../models";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import sequelize from "../utils/dbInstance";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import { getCurrencySymbol, getCurrencyInfo, formatAmountForDisplay, COMPANY_CURRENCY_QUERY, convertToFiat, getCompanyDisplayCurrency } from "../utils/currencyUtils";
import { getVolumeTiers } from "../utils/volumeTierUtils";

/**
 * Convert per-currency volume rows to a single target fiat amount.
 * Each row must have { base_currency: string, volume: string|number }.
 * Returns the sum in targetCurrency.
 */
async function convertVolumesToFiat(
  rows: Array<Record<string, unknown>>,
  volumeField: string,
  targetCurrency: string,
): Promise<number> {
  let total = 0;
  for (const row of rows) {
    const currency = String(row.base_currency || "USD");
    const rawVolume = parseFloat(String(row[volumeField] || "0"));
    if (rawVolume === 0) continue;
    try {
      const { amount } = await convertToFiat(currency, targetCurrency, rawVolume);
      total += amount;
    } catch {
      // If conversion fails for a currency, skip it (e.g. delisted coins)
      apiLogger.warn(`[Dashboard] convertToFiat failed for ${currency} -> ${targetCurrency}, skipping ${rawVolume}`);
    }
  }
  return Math.round(total * 100) / 100;
}

// Cache TTL for dashboard data (30 seconds)
const DASHBOARD_CACHE_TTL = 120;  // 2 minutes — stats don't change rapidly

// Fee Tiers Configuration — reads from volumeTierUtils (single source of truth).
// Legacy `max=Infinity` semantics preserved by mapping `null` (unbounded top tier)
// to Number.POSITIVE_INFINITY, and legacy tier NAMES (Standard/Pro/Business) are
// replaced by the current 4-tier system (Starter/Growth/Scale/Enterprise) with
// real fee percentages.
const buildFeeTiers = (): Array<{ name: string; displayName: string; min: number; max: number; percent: number; description: string }> => {
  const tiers = getVolumeTiers();
  return tiers.map((t) => ({
    name: t.name,                        // canonical lowercase name ('starter' etc)
    displayName: t.displayName,          // human-readable ('Starter' etc)
    min: t.min,
    max: t.max === null ? Number.POSITIVE_INFINITY : t.max,
    percent: t.percent,
    description: t.description,
  }));
};

// Convenience accessor — always reads fresh from env so hot-reload / tier config
// changes take effect without a restart.
const getFeeTiersArray = () => buildFeeTiers();

/**
 * Get current fee tier based on all-time transaction volume (in USD).
 * Also exposes the merchant's platform-fee percentage for the dashboard widget.
 */
const getFeeTier = (monthlyVolumeUSD: number, displayCurrency: string = 'USD', conversionRate: number = 1) => {
  const tiers = buildFeeTiers();
  const tier = tiers.find(t => monthlyVolumeUSD >= t.min && monthlyVolumeUSD < t.max) || tiers[tiers.length - 1];
  const nextTier = tiers.find(t => t.min > monthlyVolumeUSD);
  
  // Convert thresholds to display currency
  const displayVolume = Math.round(monthlyVolumeUSD * conversionRate * 100) / 100;
  const displayThreshold = tier.max === Number.POSITIVE_INFINITY ? null : Math.round(tier.max * conversionRate);
  const displayAmountToNext = nextTier ? Math.round((nextTier.min - monthlyVolumeUSD) * conversionRate * 100) / 100 : 0;
  const currencySymbol = getCurrencySymbol(displayCurrency);
  
  return {
    current_tier: tier.displayName,      // Frontend shows the human-readable name
    current_tier_key: tier.name,         // Machine key for the frontend to match icons/colors
    tier_description: tier.description,
    tier_percent: tier.percent,          // NEW: platform fee % for this merchant
    monthly_volume: displayVolume,
    monthly_volume_usd: monthlyVolumeUSD, // Always include USD for reference
    tier_threshold: displayThreshold,
    tier_threshold_formatted: displayThreshold ? `${currencySymbol}${displayThreshold.toLocaleString()} ${displayCurrency}` : 'Unlimited',
    percent_complete: tier.max === Number.POSITIVE_INFINITY ? 100 : Math.round((monthlyVolumeUSD / tier.max) * 100 * 10) / 10,
    amount_to_next_tier: displayAmountToNext,
    amount_to_next_tier_formatted: nextTier ? `${currencySymbol}${displayAmountToNext.toLocaleString()} ${displayCurrency}` : null,
    next_tier: nextTier?.displayName || null,
    next_tier_key: nextTier?.name || null,
    next_tier_percent: nextTier?.percent ?? null,   // NEW: fee % at the next tier
    currency: displayCurrency,
  };
};

/**
 * Calculate percentage change between two values
 */
const calculateChange = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
};

/**
 * Get all dashboard statistics
 * GET /api/dashboard
 * OPTIMIZED: Combined single query + Redis caching (30s TTL)
 */
const getDashboard = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { company_id } = req.query;
    const userId = userData.user_id;
    
    // Validate company ownership if company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }
    
    // Get company's preferred currency
    let preferredCurrency = "USD";
    if (company_id) {
      preferredCurrency = await getCompanyDisplayCurrency(company_id as string);
      if (preferredCurrency !== 'USD') {
        apiLogger.info(`[Dashboard] Using currency ${preferredCurrency} for company ${company_id}`);
      }
    }
    
    // Check Redis cache first (include currency in cache key)
    const cacheKey = `dashboard:${userId}:${company_id || 'all'}:${preferredCurrency}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      apiLogger.info(`[Dashboard] Cache hit for user ${userId}, currency ${preferredCurrency}`);
      return successResponseHelper(res, 200, "Dashboard data retrieved successfully", cached);
    }

    // Date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    // ── 1. Transaction COUNTS (no status filter — matches getUserAnalytics) ──
    const companyJoin = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const companyFilter = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';
    
    const countQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfMonth) as current_month_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfLastMonth AND ut."createdAt" <= :endOfLastMonth) as last_month_count,
        COUNT(*) FILTER (WHERE ut.status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfToday AND ut.status IN ('successful', 'done', 'completed')) as today_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfYesterday AND ut."createdAt" < :startOfToday AND ut.status IN ('successful', 'done', 'completed')) as yesterday_count
      FROM tbl_user_transaction ut
      ${companyJoin}
      WHERE ut.user_id = :userId ${companyFilter}
    `;

    // ── 2. Volume: Use stored usd_value with fallback to base_amount for USD-like currencies ──
    const USD_FALLBACK_EXPR = `COALESCE(NULLIF(ut.usd_value, 0), CASE WHEN UPPER(ut.base_currency) IN ('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON') THEN ut.base_amount ELSE 0 END)`;
    const volumeQuery = `
      SELECT 
        COALESCE(SUM(${USD_FALLBACK_EXPR}), 0) as total_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfMonth), 0) as current_month_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfLastMonth AND ut."createdAt" <= :endOfLastMonth), 0) as last_month_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfToday AND ut.status IN ('successful', 'done', 'completed')), 0) as today_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfYesterday AND ut."createdAt" < :startOfToday AND ut.status IN ('successful', 'done', 'completed')), 0) as yesterday_usd_value
      FROM tbl_user_transaction ut
      ${companyJoin}
      WHERE ut.user_id = :userId ${companyFilter}
    `;

    // ── 3. Self-transactions count ──
    const selfCountQuery = `
      SELECT COUNT(*) as self_count
      FROM tbl_user_self_transaction st
      WHERE st.user_id = :userId
    `;

    // Run all queries + active wallets in parallel
    const [countResult, volumeResult, selfCountResult, activeWallets] = await Promise.all([
      sequelize.query(countQuery, {
        replacements: { userId, startOfMonth, startOfLastMonth, endOfLastMonth, startOfToday, startOfYesterday, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(volumeQuery, {
        replacements: { userId, startOfMonth, startOfLastMonth, endOfLastMonth, startOfToday, startOfYesterday, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(selfCountQuery, {
        replacements: { userId },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(
        `SELECT DISTINCT wallet_type, wallet_name, company_id
         FROM tbl_user_wallet 
         WHERE user_id = :userId 
         AND currency_type = 'CRYPTO'
         AND wallet_address IS NOT NULL
         ${company_id ? 'AND company_id = :companyId' : ''}`,
        {
          replacements: { userId, companyId: company_id },
          type: QueryTypes.SELECT,
        }
      )
    ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>];

    // ── Parse counts ──
    const stats = countResult[0] || {} as Record<string, string>;
    const incomingTotal = parseInt(String(stats.total_count || '0'));
    const currentCount = parseInt(String(stats.current_month_count || '0'));
    const lastCount = parseInt(String(stats.last_month_count || '0'));
    const pendingCount = parseInt(String(stats.pending_count || '0'));
    const todayCount = parseInt(String(stats.today_count || '0'));
    const yesterdayCount = parseInt(String(stats.yesterday_count || '0'));
    const selfCount = parseInt(String((selfCountResult[0] as Record<string, unknown>)?.self_count || '0'));
    const totalCount = incomingTotal + selfCount;

    // ── Parse volumes (using historical USD values) ──
    const volumeRow = volumeResult[0] || {} as Record<string, unknown>;
    let totalVolumeUSD = parseFloat(String(volumeRow.total_usd_value || '0'));
    let currentVolumeUSD = parseFloat(String(volumeRow.current_month_usd_value || '0'));
    let lastVolumeUSD = parseFloat(String(volumeRow.last_month_usd_value || '0'));
    let todayVolumeUSD = parseFloat(String(volumeRow.today_usd_value || '0'));
    let yesterdayVolumeUSD = parseFloat(String(volumeRow.yesterday_usd_value || '0'));
    
    totalVolumeUSD = Math.round(totalVolumeUSD * 100) / 100;
    currentVolumeUSD = Math.round(currentVolumeUSD * 100) / 100;
    lastVolumeUSD = Math.round(lastVolumeUSD * 100) / 100;
    todayVolumeUSD = Math.round(todayVolumeUSD * 100) / 100;
    yesterdayVolumeUSD = Math.round(yesterdayVolumeUSD * 100) / 100;
    
    // Convert from USD to preferred currency if needed
    let totalVolume = totalVolumeUSD;
    let currentVolume = currentVolumeUSD;
    let lastVolume = lastVolumeUSD;
    let todayVolume = todayVolumeUSD;
    let yesterdayVolume = yesterdayVolumeUSD;
    
    if (preferredCurrency !== 'USD' && totalVolumeUSD > 0) {
      const { rate } = await convertToFiat('USD', preferredCurrency, 1);
      totalVolume = Math.round(totalVolumeUSD * rate * 100) / 100;
      currentVolume = Math.round(currentVolumeUSD * rate * 100) / 100;
      lastVolume = Math.round(lastVolumeUSD * rate * 100) / 100;
      todayVolume = Math.round(todayVolumeUSD * rate * 100) / 100;
      yesterdayVolume = Math.round(yesterdayVolumeUSD * rate * 100) / 100;
    }

    // Fee tier needs USD volume — use stored usd_value total (already in USD)
    let allTimeVolumeUSD = totalVolumeUSD;

    // Calculate fee tier (based on cumulative USD volume, display in preferred currency)
    const conversionRate = preferredCurrency !== 'USD' && allTimeVolumeUSD > 0
      ? totalVolume / allTimeVolumeUSD
      : 1;
    const feeTier = getFeeTier(allTimeVolumeUSD, preferredCurrency, conversionRate);

    // Build response
    const dashboardData = {
      today_summary: {
        volume_today: todayVolume,
        volume_today_formatted: formatAmountForDisplay(todayVolume, preferredCurrency).display_value,
        volume_yesterday: yesterdayVolume,
        volume_yesterday_formatted: formatAmountForDisplay(yesterdayVolume, preferredCurrency).display_value,
        volume_change_percent: calculateChange(todayVolume, yesterdayVolume),
        transactions_today: todayCount,
        transactions_yesterday: yesterdayCount,
        transactions_change_percent: calculateChange(todayCount, yesterdayCount),
        pending_count: pendingCount,
        currency: preferredCurrency,
      },
      total_transactions: {
        count: totalCount,
        current_month: currentCount,
        change_percent: calculateChange(currentCount, lastCount),
        comparison_period: "last_month",
      },
      total_volume: {
        amount: totalVolume,
        amount_formatted: formatAmountForDisplay(totalVolume, preferredCurrency).display_value,
        current_month: currentVolume,
        current_month_formatted: formatAmountForDisplay(currentVolume, preferredCurrency).display_value,
        currency: preferredCurrency,
        currency_info: getCurrencyInfo(preferredCurrency),
        change_percent: calculateChange(currentVolume, lastVolume),
        comparison_period: "last_month",
      },
      pending_transactions: {
        count: pendingCount,
      },
      active_wallets: {
        count: activeWallets.length,
        wallets: activeWallets.map((w: Record<string, unknown>) => w.wallet_type),
        details: activeWallets,
      },
      fee_tier: feeTier,
    };

    // Cache the result
    await setRedisItem(cacheKey, dashboardData);
    await setRedisTTL(cacheKey, DASHBOARD_CACHE_TTL);

    return successResponseHelper(res, 200, "Dashboard data retrieved successfully", dashboardData);

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get volume chart data
 * GET /api/dashboard/chart
 */
const getChartData = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { period = '30d', company_id } = req.query;
    const userId = userData.user_id;

    // Get company preferred currency
    let preferredCurrency = "USD";
    if (company_id) {
      preferredCurrency = await getCompanyDisplayCurrency(company_id as string);
    }

    // Check cache first (120 second TTL for chart data)
    const cacheKey = `chart:${userId}:${company_id || 'all'}:${period}:${preferredCurrency}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      apiLogger.info(`[Chart] Cache hit for user ${userId}`);
      return successResponseHelper(res, 200, "Chart data retrieved successfully", cached);
    }

    // Determine date range based on period
    let days = 30;
    let groupBy = 'day';
    
    switch (period) {
      case '7d':
        days = 7;
        groupBy = 'day';
        break;
      case '30d':
        days = 30;
        groupBy = 'day';
        break;
      case '90d':
        days = 90;
        groupBy = 'week';
        break;
      case '1y':
        days = 365;
        groupBy = 'month';
        break;
      default:
        days = 30;
        groupBy = 'day';
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const companyJoinChart = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const companyFilterChart = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';

    // ── 1. Chart data grouped by date AND currency (so we can convert volumes) ──
    let dateTrunc: string;
    if (groupBy === 'day') dateTrunc = `DATE(ut."createdAt")`;
    else if (groupBy === 'week') dateTrunc = `DATE_TRUNC('week', ut."createdAt")`;
    else dateTrunc = `DATE_TRUNC('month', ut."createdAt")`;

    // Reuse the same USD fallback expression for chart queries
    const USD_FALLBACK_EXPR_CHART = `COALESCE(NULLIF(ut.usd_value, 0), CASE WHEN UPPER(ut.base_currency) IN ('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON') THEN ut.base_amount ELSE 0 END)`;

    const chartQuery = `
      SELECT 
        ${dateTrunc} as date,
        ut.base_currency,
        COUNT(*) as transaction_count,
        COALESCE(SUM(ut.base_amount), 0) as volume,
        COALESCE(SUM(${USD_FALLBACK_EXPR_CHART}), 0) as usd_volume
      FROM tbl_user_transaction ut
      ${companyJoinChart}
      WHERE ut.user_id = :userId 
      AND ut."createdAt" >= :startDate
      ${companyFilterChart}
      GROUP BY ${dateTrunc}, ut.base_currency
      ORDER BY date ASC
    `;

    // ── 2. Currency breakdown (no status filter) ──
    const currencyBreakdownQuery = `
      SELECT 
        ut.base_currency,
        COUNT(*) as count,
        COALESCE(SUM(ut.base_amount), 0) as volume,
        COALESCE(SUM(${USD_FALLBACK_EXPR_CHART}), 0) as usd_volume
       FROM tbl_user_transaction ut
       ${companyJoinChart}
       WHERE ut.user_id = :userId 
       AND ut."createdAt" >= :startDate
       ${companyFilterChart}
       GROUP BY ut.base_currency
       ORDER BY volume DESC`;

    // ── 3. Status breakdown ──
    const statusBreakdownQuery = `
      SELECT 
        ut.status,
        COUNT(*) as count
       FROM tbl_user_transaction ut
       ${companyJoinChart}
       WHERE ut.user_id = :userId 
       AND ut."createdAt" >= :startDate
       ${companyFilterChart}
       GROUP BY ut.status`;

    const [rawChartData, currencyBreakdownRaw, statusBreakdown] = await Promise.all([
      sequelize.query(chartQuery, {
        replacements: { userId, startDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(currencyBreakdownQuery, {
        replacements: { userId, startDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(statusBreakdownQuery, {
        replacements: { userId, startDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
    ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>];

    // ── Aggregate chart rows using stored usd_value ──
    let chartUsdToPreferredRate = 1;
    if (preferredCurrency !== 'USD') {
      try {
        const { rate } = await convertToFiat('USD', preferredCurrency, 1);
        chartUsdToPreferredRate = rate || 1;
      } catch {
        chartUsdToPreferredRate = 1;
      }
    }
    
    const dateAgg: Record<string, { volume: number; transaction_count: number }> = {};
    for (const row of rawChartData) {
      const dateKey = new Date(String(row.date)).toISOString().split('T')[0];
      const usdVol = parseFloat(String(row.usd_volume || '0'));
      const count = parseInt(String(row.transaction_count || '0'));
      
      const convertedVol = usdVol * chartUsdToPreferredRate;
      if (!dateAgg[dateKey]) dateAgg[dateKey] = { volume: 0, transaction_count: 0 };
      dateAgg[dateKey].volume += convertedVol;
      dateAgg[dateKey].transaction_count += count;
    }

    const formattedChartData = Object.entries(dateAgg).map(([date, d]) => ({
      date,
      volume: Math.round(d.volume * 100) / 100,
      transaction_count: d.transaction_count,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Fill in missing dates with zero values
    const filledChartData = fillMissingDates(formattedChartData, startDate, new Date(), groupBy);

    // ── Convert currency breakdown using stored usd_value ──
    const currencyBreakdown = (currencyBreakdownRaw as Array<Record<string, unknown>>).map((c) => {
      const cur = String(c.base_currency || 'USD');
      const usdVol = parseFloat(String(c.usd_volume || '0'));
      const convertedVol = usdVol * chartUsdToPreferredRate;
      
      return {
        currency: cur,
        count: parseInt(String(c.count || '0')),
        volume: Math.round(convertedVol * 100) / 100,
      };
    });

    const responseData = {
      period,
      group_by: groupBy,
      start_date: startDate.toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      currency: preferredCurrency,
      chart_data: filledChartData,
      currency_breakdown: currencyBreakdown.sort((a, b) => b.volume - a.volume),
      status_breakdown: statusBreakdown.map((s: Record<string, unknown>) => ({
        status: s.status,
        count: parseInt(String(s.count || '0')),
      })),
    };

    // Cache the result (120 second TTL — chart data changes slowly)
    await setRedisItem(cacheKey, responseData);
    await setRedisTTL(cacheKey, 120);

    return successResponseHelper(res, 200, "Chart data retrieved successfully", responseData);

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Helper function to fill missing dates with zero values
 */
const fillMissingDates = (data: Array<Record<string, unknown>>, startDate: Date, endDate: Date, groupBy: string) => {
  const filledData: Array<Record<string, unknown>> = [];
  const dataMap = new Map(data.map(d => [new Date(String(d.date)).toISOString().split('T')[0], d]));
  
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    const existingData = dataMap.get(dateKey);
    
    if (existingData) {
      filledData.push({
        date: dateKey,
        volume: existingData.volume,
        transaction_count: existingData.transaction_count,
      });
    } else {
      filledData.push({
        date: dateKey,
        volume: 0,
        transaction_count: 0,
      });
    }
    
    // Increment based on groupBy
    if (groupBy === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (groupBy === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return filledData;
};

/**
 * GET /api/dashboard/fee-tiers
 * Returns fee tiers with user's current tier based on transaction volume
 */
const getFeeTiers = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Check Redis cache first (5 min TTL — tiers change infrequently)
    const cacheKey = `feeTiers:${userId}:${company_id || 'all'}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Fee tiers retrieved successfully", cached);
    }

    // Get company's preferred currency
    let preferredCurrency = 'USD';
    let conversionRate = 1;
    
    if (company_id) {
      preferredCurrency = await getCompanyDisplayCurrency(company_id as string);
    }

    // Calculate user's ALL-TIME cumulative transaction volume (in USD)
    // Tier progression is based on total volume, not just current month
    const companyJoinFee = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const companyFilterFee = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';

    const feeUsdFallback = `COALESCE(NULLIF(ut.usd_value, 0), CASE WHEN UPPER(ut.base_currency) IN ('USD','USDT','USDC','USDT-TRC20','USDT-ERC20','USDC-ERC20','BUSD','DAI','USDT_TRC20','USDT_ERC20','USDC_ERC20','USDT-POLYGON') THEN ut.base_amount ELSE 0 END)`;

    const volumeResult = await sequelize.query(
      `SELECT COALESCE(SUM(${feeUsdFallback}), 0) as total_usd_volume
       FROM tbl_user_transaction ut
       ${companyJoinFee}
       WHERE ut.user_id = :userId 
       ${companyFilterFee}`,
      {
        replacements: { userId, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    const allTimeVolumeUSD = Math.round(parseFloat(String(volumeResult[0]?.total_usd_volume || '0')) * 100) / 100;
    
    // Get conversion rate if not USD
    if (preferredCurrency !== 'USD') {
      try {
        const result = await convertToFiat('USD', preferredCurrency, 1);
        if (result.amount) {
          conversionRate = result.amount;
        }
      } catch (e) {
        apiLogger.warn(`[getFeeTiers] Currency conversion failed, using USD`);
        preferredCurrency = 'USD';
      }
    }
    
    const userTierInfo = getFeeTier(allTimeVolumeUSD, preferredCurrency, conversionRate);
    const currencySymbol = getCurrencySymbol(preferredCurrency);

    // Build tiers with indicator for current tier (show thresholds in preferred currency)
    const tiersWithStatus = getFeeTiersArray().map(tier => ({
      name: tier.name,                                         // canonical lowercase key ('starter' etc)
      display_name: tier.displayName,                          // human-readable name
      percent: tier.percent,                                   // platform fee % for this tier
      min_volume: Math.round(tier.min * conversionRate),
      max_volume: tier.max === Number.POSITIVE_INFINITY ? null : Math.round(tier.max * conversionRate),
      min_volume_formatted: `${currencySymbol}${Math.round(tier.min * conversionRate).toLocaleString()}`,
      max_volume_formatted: tier.max === Number.POSITIVE_INFINITY ? 'Unlimited' : `${currencySymbol}${Math.round(tier.max * conversionRate).toLocaleString()}`,
      description: tier.description,
      is_current: tier.name === userTierInfo.current_tier_key,
    }));

    const feeTiersResponse = {
      tiers: tiersWithStatus,
      currency: preferredCurrency,
      user_tier: {
        current_tier: userTierInfo.current_tier,                  // 'Starter' etc
        current_tier_key: userTierInfo.current_tier_key,          // 'starter' etc
        current_tier_percent: userTierInfo.tier_percent,          // e.g. 1.5
        tier_description: userTierInfo.tier_description,
        total_volume: userTierInfo.monthly_volume,
        total_volume_formatted: `${currencySymbol}${userTierInfo.monthly_volume.toLocaleString()} ${preferredCurrency}`,
        percent_to_next_tier: userTierInfo.percent_complete,
        amount_to_next_tier: userTierInfo.amount_to_next_tier,
        amount_to_next_tier_formatted: userTierInfo.amount_to_next_tier_formatted,
        next_tier: userTierInfo.next_tier,                        // e.g. 'Growth'
        next_tier_key: userTierInfo.next_tier_key,                // e.g. 'growth'
        next_tier_percent: userTierInfo.next_tier_percent,        // e.g. 1.0
      },
    };

    // Cache for 5 minutes
    await setRedisItem(cacheKey, feeTiersResponse);
    await setRedisTTL(cacheKey, 300);

    return successResponseHelper(res, 200, "Fee tiers retrieved successfully", feeTiersResponse);
  } catch (e) {

      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get recent transactions for dashboard
 * GET /api/dashboard/recent-transactions
 */
const getRecentTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { limit = 10, company_id } = req.query;
    const userId = userData.user_id;

    // Check Redis cache first (60s TTL — prevent duplicate calls on page load)
    const cacheKey = `recentTx:${userId}:${company_id || 'all'}:${limit}`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Recent transactions retrieved successfully", cached);
    }

    const recentTransactions = await sequelize.query(
      `SELECT 
        ut.transaction_id,
        ut.id,
        ut.base_amount,
        ut.base_currency,
        ut.crypto_currency,
        ut.status,
        ut.transaction_type,
        ut.transaction_reference,
        ut."createdAt",
        uw.wallet_type,
        c.customer_name,
        c.email as customer_email,
        -- Payment source detection so the frontend can show a meaningful
        -- label instead of an internal placeholder email:
        --   * 'payment_link' — a matching row exists in tbl_payment_link
        --   * 'legacy_api'   — customer email matches the synthetic
        --                      "legacy-api-…@dynopay.internal" pattern
        --                      minted by legacyApiAuthMiddleware
        --   * 'checkout'     — non-legacy pattern with @dynopay.internal
        --                      (recovered-… placeholders from merchantApi)
        --   * null           — direct crypto receive / real customer
        CASE
          WHEN pl.link_id IS NOT NULL THEN 'payment_link'
          WHEN c.email LIKE 'legacy-api-%@dynopay.internal' THEN 'legacy_api'
          WHEN c.email LIKE '%@dynopay.internal' THEN 'checkout'
          ELSE NULL
        END AS source
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_user_wallet uw ON ut.wallet_id = uw.wallet_id
       LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
       LEFT JOIN tbl_payment_link pl
         ON pl.transaction_reference = ut.transaction_reference
         AND pl.user_id = ut.user_id
       WHERE ut.user_id = :userId
       ORDER BY ut."createdAt" DESC
       LIMIT :limit`,
      {
        replacements: { userId, limit: parseInt(limit as string) },
        type: QueryTypes.SELECT,
      }
    );

    const recentTxResponse = {
      transactions: recentTransactions,
      count: recentTransactions.length,
    };

    // Cache for 60 seconds
    await setRedisItem(cacheKey, recentTxResponse);
    await setRedisTTL(cacheKey, 60);

    return successResponseHelper(res, 200, "Recent transactions retrieved successfully", recentTxResponse);

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get all conversion records for the merchant (with optional status filter)
 * GET /api/dashboard/conversions
 * Query params: status (optional), company_id (required for scoping), limit (default 20)
 */
const getConversions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { status, company_id, limit = 20 } = req.query;
    const userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    let whereClause = `sc.user_id = :userId`;
    const replacements: Record<string, unknown> = { userId, limit: parseInt(limit as string) };

    if (company_id) {
      whereClause += ` AND sc.company_id = :companyId`;
      replacements.companyId = company_id;
    }
    if (status) {
      whereClause += ` AND sc.status = :status`;
      replacements.status = status;
    }

    const conversions = await sequelize.query(
      `SELECT 
        sc.conversion_id,
        sc.transaction_id,
        sc.company_id,
        co.company_name,
        sc.source_currency,
        sc.source_amount,
        sc.source_amount_usd,
        sc.target_currency,
        sc.target_amount,
        sc.settlement_wallet_address,
        sc.settlement_chain,
        sc.deposit_tx_hash,
        sc.binance_order_id,
        sc.conversion_rate,
        sc.conversion_fee,
        sc.sweep_fee_usd,
        sc.trade_fee_usd,
        sc.withdrawal_fee,
        sc.withdrawal_tx_hash,
        sc.withdrawal_id,
        sc.merchant_payout_usd,
        sc.locked_merchant_usd,
        sc.actual_sale_usd,
        sc.platform_surplus,
        sc.price_movement_pct,
        sc.sell_method,
        sc.status,
        sc.error_message,
        sc.retry_count,
        sc."createdAt",
        sc.deposit_confirmed_at,
        sc.converted_at,
        sc.withdrawn_at,
        sc.completed_at
       FROM tbl_stablecoin_conversion sc
       LEFT JOIN tbl_company co ON sc.company_id = co.company_id
       WHERE ${whereClause}
       ORDER BY sc."createdAt" DESC
       LIMIT :limit`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    // Count by status for summary
    const statusCounts = await sequelize.query(
      `SELECT sc.status, COUNT(*)::int as count
       FROM tbl_stablecoin_conversion sc
       WHERE sc.user_id = :userId ${company_id ? 'AND sc.company_id = :companyId' : ''}
       GROUP BY sc.status`,
      {
        replacements: { userId, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: Record<string, unknown>) => {
      statusMap[s.status as string] = s.count as number;
    });

    // Map each conversion to include its pipeline stage
    const DB_STATUS_TO_PIPELINE: Record<string, string> = {
      PENDING_DEPOSIT: "SWEEPING",
      DEPOSIT_CREDITED: "DEPOSITING",
      CONVERTING: "CONVERTING",
      CONVERTED: "CONVERTING",
      WITHDRAWING: "WITHDRAWING",
      COMPLETED: "COMPLETE",
      FAILED: "FAILED",
    };

    const enrichedConversions = conversions.map((c: Record<string, unknown>) => ({
      ...c,
      pipeline_stage: DB_STATUS_TO_PIPELINE[c.status as string] || c.status,
    }));

    return successResponseHelper(res, 200, "Conversions retrieved successfully", {
      conversions: enrichedConversions,
      count: enrichedConversions.length,
      status_summary: statusMap,
      pipeline_stages: ["DETECTED", "SWEEPING", "DEPOSITING", "CONVERTING", "WITHDRAWING", "COMPLETE"],
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Get single conversion with detailed timeline
 * GET /api/dashboard/conversions/:id
 * Query params: company_id (optional, for ownership validation)
 */
const getConversionDetail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  
  try {
    const { id } = req.params;
    const { company_id } = req.query;
    const userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
    }

    let detailWhere = `sc.conversion_id = :id AND sc.user_id = :userId`;
    const detailReplacements: Record<string, unknown> = { id, userId };
    if (company_id) {
      detailWhere += ` AND sc.company_id = :companyId`;
      detailReplacements.companyId = company_id;
    }

    const conversions = await sequelize.query(
      `SELECT sc.*, co.company_name
       FROM tbl_stablecoin_conversion sc
       LEFT JOIN tbl_company co ON sc.company_id = co.company_id
       WHERE ${detailWhere}`,
      {
        replacements: detailReplacements,
        type: QueryTypes.SELECT,
      }
    ) as Array<Record<string, unknown>>;

    if (conversions.length === 0) {
      return errorResponseHelper(res, 404, "Conversion not found");
    }

    const conversion = conversions[0];

    // Build timeline: Detected → Sweeping → Depositing → Converting → Withdrawing → Complete
    // Maps DB statuses to user-facing pipeline stages
    const STAGES = [
      { key: "DETECTED",    label: "Detected",    dbStatus: "PENDING_DEPOSIT",  field: "createdAt" },
      { key: "SWEEPING",    label: "Sweeping",    dbStatus: "PENDING_DEPOSIT",  field: "createdAt" },
      { key: "DEPOSITING",  label: "Depositing",  dbStatus: "DEPOSIT_CREDITED", field: "deposit_confirmed_at" },
      { key: "CONVERTING",  label: "Converting",  dbStatus: "CONVERTED",        field: "converted_at" },
      { key: "WITHDRAWING", label: "Withdrawing", dbStatus: "WITHDRAWING",      field: "withdrawn_at" },
      { key: "COMPLETE",    label: "Complete",     dbStatus: "COMPLETED",        field: "completed_at" },
    ];

    // Map DB status to pipeline index
    const DB_STATUS_TO_STAGE: Record<string, number> = {
      PENDING_DEPOSIT:  1, // Sweeping (detected + sweep already happened to create record)
      DEPOSIT_CREDITED: 2, // Depositing confirmed, ready for conversion
      CONVERTING:       3, // Converting on exchange
      CONVERTED:        3, // Conversion done, same stage
      WITHDRAWING:      4, // Withdrawing to merchant
      COMPLETED:        5, // Complete
    };
    const currentIdx = DB_STATUS_TO_STAGE[conversion.status as string] ?? -1;

    const timeline = STAGES.map((stage, idx) => ({
      stage: stage.key,
      label: stage.label,
      timestamp: conversion[stage.field] || null,
      completed: idx <= currentIdx && conversion.status !== "FAILED",
      active: idx === currentIdx && conversion.status !== "FAILED",
    }));

    // Fee breakdown
    const feeBreakdown = {
      platform_fee_usd: parseFloat(String(conversion.conversion_fee || "0")),
      sweep_gas_fee_usd: parseFloat(String(conversion.sweep_fee_usd || "0")),
      trade_fee_usd: parseFloat(String(conversion.trade_fee_usd || "0")),
      withdrawal_fee_usd: parseFloat(String(conversion.withdrawal_fee || "0")),
      gross_sale_usd: parseFloat(String(conversion.actual_sale_usd || "0")),
      net_payout_usd: parseFloat(String(conversion.merchant_payout_usd || "0")),
    };

    return successResponseHelper(res, 200, "Conversion detail retrieved", {
      conversion,
      timeline,
      fee_breakdown: feeBreakdown,
      is_failed: conversion.status === "FAILED",
      is_complete: conversion.status === "COMPLETED",
    });

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

export default {
  getDashboard,
  getChartData,
  getFeeTiers,
  getRecentTransactions,
  getConversions,
  getConversionDetail,
};
