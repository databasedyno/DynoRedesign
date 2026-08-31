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
import { getRedisItem, setRedisItem, setRedisItemWithTTL, setRedisTTL } from "../utils/redisInstance";
import { getCurrencySymbol, getCurrencyInfo, formatAmountForDisplay, COMPANY_CURRENCY_QUERY, convertToFiat, convertToUSD, getUserDisplayCurrency } from "../utils/currencyUtils";
import { resolveTransactionSource } from "../utils/transactionSource";
import { PROCESSED_USD_EXPR, PROCESSED_STATUS_SQL } from "../utils/processedVolume";
import { deriveTxDisplayStatus, isPaymentDetected, FRESH_PENDING_SQL } from "../utils/transactionDisplayStatus";
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
    let userId = userData.user_id;
    
    // Validate company ownership if company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      // RBAC: a team member reads the OWNER's data for a granted company, so scope
      // every query below to the company owner's user_id (no-op when caller is owner).
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }
    
    // Get company's preferred currency
    let preferredCurrency = "USD";
    if (company_id) {
      preferredCurrency = await getUserDisplayCurrency(userId, company_id as string);
      if (preferredCurrency !== 'USD') {
        apiLogger.info(`[Dashboard] Using currency ${preferredCurrency} for company ${company_id}`);
      }
    }
    
    // Check Redis cache first (include currency in cache key)
    const cacheKey = `dashboard:${userId}:${company_id || 'all'}:${preferredCurrency}:v3settled`;
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
        COUNT(*) FILTER (WHERE ${PROCESSED_STATUS_SQL}) as total_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfMonth AND ${PROCESSED_STATUS_SQL}) as current_month_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfLastMonth AND ut."createdAt" <= :endOfLastMonth AND ${PROCESSED_STATUS_SQL}) as last_month_count,
        COUNT(*) FILTER (WHERE ${FRESH_PENDING_SQL}) as pending_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfToday AND ${PROCESSED_STATUS_SQL}) as today_count,
        COUNT(*) FILTER (WHERE ut."createdAt" >= :startOfYesterday AND ut."createdAt" < :startOfToday AND ${PROCESSED_STATUS_SQL}) as yesterday_count
      FROM tbl_user_transaction ut
      ${companyJoin}
      WHERE ut.user_id = :userId ${companyFilter}
    `;

    // ── 2. Volume: SETTLED transactions only, using stored usd_value with
    // fallback to base_amount for USD-like currencies. Shared with
    // walletController.getWallet so /wallet total reconciles exactly. ──
    const USD_FALLBACK_EXPR = PROCESSED_USD_EXPR;
    const volumeQuery = `
      SELECT 
        COALESCE(SUM(${USD_FALLBACK_EXPR}), 0) as total_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfMonth), 0) as current_month_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfLastMonth AND ut."createdAt" <= :endOfLastMonth), 0) as last_month_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfToday), 0) as today_usd_value,
        COALESCE(SUM(${USD_FALLBACK_EXPR}) FILTER (WHERE ut."createdAt" >= :startOfYesterday AND ut."createdAt" < :startOfToday), 0) as yesterday_usd_value,
        COALESCE(SUM(ut.tax_amount), 0) as total_tax,
        COALESCE(SUM(ut.tax_amount) FILTER (WHERE ut."createdAt" >= :startOfMonth), 0) as current_month_tax
      FROM tbl_user_transaction ut
      ${companyJoin}
      WHERE ut.user_id = :userId AND ${PROCESSED_STATUS_SQL} ${companyFilter}
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
    // Session 57: tax collected (stored in transaction currency; best-effort glance figure)
    const totalTaxCollected = Math.round(parseFloat(String(volumeRow.total_tax || '0')) * 100) / 100;
    const currentMonthTaxCollected = Math.round(parseFloat(String(volumeRow.current_month_tax || '0')) * 100) / 100;
    
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
      tax_collected: {
        amount: totalTaxCollected,
        amount_formatted: formatAmountForDisplay(totalTaxCollected, preferredCurrency).display_value,
        current_month: currentMonthTaxCollected,
        current_month_formatted: formatAmountForDisplay(currentMonthTaxCollected, preferredCurrency).display_value,
        currency: preferredCurrency,
      },
      active_wallets: {
        count: activeWallets.length,
        wallets: activeWallets.map((w: Record<string, unknown>) => w.wallet_type),
        details: activeWallets,
      },
      fee_tier: feeTier,
    };

    // Cache the result (B3: single SET EX round-trip, fire-and-forget)
    setRedisItemWithTTL(cacheKey, dashboardData, DASHBOARD_CACHE_TTL).catch(() => {});

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
    const { period = '30d', company_id, startDate: startDateParam, endDate: endDateParam } = req.query;
    let userId = userData.user_id;

    // RBAC: validate access + scope to the company OWNER so a granted team member
    // sees the owner's chart (no-op for owners); also enforces access (403 otherwise).
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    // Get company preferred currency
    let preferredCurrency = "USD";
    if (company_id) {
      preferredCurrency = await getUserDisplayCurrency(userId, company_id as string);
    }

    // ── Determine date range ──
    // Custom range: honour explicit startDate/endDate (YYYY-MM-DD) for precise
    // reporting. Otherwise derive the window from the named period.
    let groupBy = 'day';
    let startDate: Date;
    let endDate: Date = new Date();
    let effectivePeriod = String(period);

    const parsedStart = startDateParam ? new Date(String(startDateParam)) : null;
    const parsedEnd = endDateParam ? new Date(String(endDateParam)) : null;
    const isCustom =
      !!parsedStart && !!parsedEnd &&
      !isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime()) &&
      parsedStart.getTime() <= parsedEnd.getTime();

    if (isCustom) {
      effectivePeriod = 'custom';
      startDate = new Date(parsedStart as Date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(parsedEnd as Date);
      endDate.setHours(23, 59, 59, 999);
      const spanDays = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000),
      );
      groupBy = spanDays <= 31 ? 'day' : spanDays <= 180 ? 'week' : 'month';
    } else {
      let days = 30;
      switch (period) {
        case '7d': days = 7; groupBy = 'day'; break;
        case '30d': days = 30; groupBy = 'day'; break;
        case '90d': days = 90; groupBy = 'week'; break;
        case '1y': days = 365; groupBy = 'month'; break;
        default: days = 30; groupBy = 'day';
      }
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // Check cache (120s TTL). Cache key includes the resolved window so custom
    // ranges don't collide with named-period results.
    const rangeKey = isCustom
      ? `custom:${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
      : effectivePeriod;
    const cacheKey = `chart:${userId}:${company_id || 'all'}:${rangeKey}:${preferredCurrency}:v2settled`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      apiLogger.info(`[Chart] Cache hit for user ${userId}`);
      return successResponseHelper(res, 200, "Chart data retrieved successfully", cached);
    }

    const companyJoinChart = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const companyFilterChart = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';

    // ── 1. Chart data grouped by date AND currency (so we can convert volumes) ──
    let dateTrunc: string;
    if (groupBy === 'day') dateTrunc = `DATE(ut."createdAt")`;
    else if (groupBy === 'week') dateTrunc = `DATE_TRUNC('week', ut."createdAt")`;
    else dateTrunc = `DATE_TRUNC('month', ut."createdAt")`;

    // Shared processed-volume expression + SETTLED-only filter so the chart,
    // the VolumeHero "This period"/"Lifetime" numbers and the AssetsCard all
    // reconcile with getDashboard total_volume and the /wallet total.
    const USD_FALLBACK_EXPR_CHART = PROCESSED_USD_EXPR;

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
      AND ${PROCESSED_STATUS_SQL}
      AND ut."createdAt" >= :startDate
      AND ut."createdAt" <= :endDate
      ${companyFilterChart}
      GROUP BY ${dateTrunc}, ut.base_currency
      ORDER BY date ASC
    `;

    // ── 2. Currency breakdown (SETTLED only, matches wallet per-asset) ──
    const currencyBreakdownQuery = `
      SELECT 
        ut.base_currency,
        COUNT(*) as count,
        COALESCE(SUM(ut.base_amount), 0) as volume,
        COALESCE(SUM(${USD_FALLBACK_EXPR_CHART}), 0) as usd_volume
       FROM tbl_user_transaction ut
       ${companyJoinChart}
       WHERE ut.user_id = :userId 
       AND ${PROCESSED_STATUS_SQL}
       AND ut."createdAt" >= :startDate
       AND ut."createdAt" <= :endDate
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
       AND ut."createdAt" <= :endDate
       ${companyFilterChart}
       GROUP BY ut.status`;

    // ── 4. Previous-period summary (same span immediately before startDate) ──
    //    Powers the "vs previous period" delta chip on the volume hero.
    const rangeMs = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime());
    const prevStart = new Date(startDate.getTime() - rangeMs);
    const previousSummaryQuery = `
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(${USD_FALLBACK_EXPR_CHART}), 0) as usd_volume
       FROM tbl_user_transaction ut
       ${companyJoinChart}
       WHERE ut.user_id = :userId
       AND ${PROCESSED_STATUS_SQL}
       AND ut."createdAt" >= :prevStart
       AND ut."createdAt" < :prevEnd
       ${companyFilterChart}`;

    const [rawChartData, currencyBreakdownRaw, statusBreakdown, previousSummaryRaw] = await Promise.all([
      sequelize.query(chartQuery, {
        replacements: { userId, startDate, endDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(currencyBreakdownQuery, {
        replacements: { userId, startDate, endDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(statusBreakdownQuery, {
        replacements: { userId, startDate, endDate, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
      sequelize.query(previousSummaryQuery, {
        replacements: { userId, prevStart, prevEnd, companyId: company_id },
        type: QueryTypes.SELECT,
      }),
    ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>, Array<Record<string, unknown>>];

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
    const filledChartData = fillMissingDates(formattedChartData, startDate, endDate, groupBy);

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

    // ── Period summary + previous-period comparison (in preferred currency) ──
    const currentUsd = (currencyBreakdownRaw as Array<Record<string, unknown>>)
      .reduce((s, c) => s + parseFloat(String(c.usd_volume || '0')), 0);
    const currentCount = (currencyBreakdownRaw as Array<Record<string, unknown>>)
      .reduce((s, c) => s + parseInt(String(c.count || '0')), 0);
    const prevRow = (previousSummaryRaw as Array<Record<string, unknown>>)[0] || {};
    const prevUsd = parseFloat(String(prevRow.usd_volume || '0'));
    const prevCount = parseInt(String(prevRow.count || '0'));

    const currentVolPref = Math.round(currentUsd * chartUsdToPreferredRate * 100) / 100;
    const prevVolPref = Math.round(prevUsd * chartUsdToPreferredRate * 100) / 100;
    const pctChange = (cur: number, prev: number): number => {
      if (prev > 0) return Math.round(((cur - prev) / prev) * 10000) / 100;
      if (cur > 0) return 100;
      return 0;
    };

    const period_summary = {
      total_volume: currentVolPref,
      total_transactions: currentCount,
      previous_total_volume: prevVolPref,
      previous_total_transactions: prevCount,
      previous_start_date: prevStart.toISOString().split('T')[0],
      previous_end_date: prevEnd.toISOString().split('T')[0],
      volume_change_percent: pctChange(currentVolPref, prevVolPref),
      transactions_change_percent: pctChange(currentCount, prevCount),
    };

    const responseData = {
      period: effectivePeriod,
      group_by: groupBy,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      currency: preferredCurrency,
      chart_data: filledChartData,
      period_summary,
      currency_breakdown: currencyBreakdown.sort((a, b) => b.volume - a.volume),
      status_breakdown: statusBreakdown.map((s: Record<string, unknown>) => ({
        status: s.status,
        count: parseInt(String(s.count || '0')),
      })),
    };

    // Cache the result (120 second TTL — chart data changes slowly)
    // B3: single SET EX round-trip, fire-and-forget.
    setRedisItemWithTTL(cacheKey, responseData, 120).catch(() => {});

    return successResponseHelper(res, 200, "Chart data retrieved successfully", responseData);

  } catch (e) {


      return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * Helper function to fill missing dates with zero values
 */
const fillMissingDates = (data: Array<Record<string, unknown>>, startDate: Date, endDate: Date, groupBy: string) => {
  const bucketKey = (d: Date): string => d.toISOString().split('T')[0];

  // Snap a date to the START of its bucket, in UTC, to MATCH the keys produced
  // by Postgres DATE_TRUNC (week => Monday, month => 1st). Previously the grid
  // stepped +7d / +1month from an UN-aligned startDate, so its keys never
  // matched the DB's Monday/1st buckets → every real week/month bucket was
  // dropped and the 90d (week) / 1y (month) series came back all-zero.
  const snapToBucketStart = (input: Date): Date => {
    const x = new Date(input);
    x.setUTCHours(0, 0, 0, 0);
    if (groupBy === 'week') {
      const dow = x.getUTCDay(); // 0=Sun … 6=Sat
      const diffToMonday = dow === 0 ? -6 : 1 - dow;
      x.setUTCDate(x.getUTCDate() + diffToMonday);
    } else if (groupBy === 'month') {
      x.setUTCDate(1);
    }
    return x;
  };

  const dataMap = new Map(data.map(d => [new Date(String(d.date)).toISOString().split('T')[0], d]));
  const used = new Set<string>();
  const filledData: Array<Record<string, unknown>> = [];

  const current = snapToBucketStart(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateKey = bucketKey(current);
    const existingData = dataMap.get(dateKey);

    if (existingData) {
      used.add(dateKey);
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

    // Increment based on groupBy (UTC-safe so DST never skips/duplicates a bucket)
    if (groupBy === 'day') {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (groupBy === 'week') {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  // Safety net: never lose real volume. If any DB bucket wasn't hit by the grid
  // (e.g. a timezone boundary difference), append it so totals stay correct.
  for (const [key, d] of dataMap) {
    if (!used.has(key)) {
      filledData.push({
        date: key,
        volume: (d as Record<string, unknown>).volume,
        transaction_count: (d as Record<string, unknown>).transaction_count,
      });
    }
  }

  filledData.sort((a, b) => String(a.date).localeCompare(String(b.date)));
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
    let userId = userData.user_id;

    // RBAC (A2): if a company is specified, validate access and remap to the
    // company OWNER's user_id so an active team member sees the OWNER's real
    // fee tier / cumulative volume (no-op for owners; 403 if not permitted).
    // Mirrors getDashboard / getChartData above — without this a member's own
    // (empty) volume yields $0 / Starter.
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return; // 403 already sent
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    // Check Redis cache first (5 min TTL — tiers change infrequently)
    const cacheKey = `feeTiers:${userId}:${company_id || 'all'}:v2settled`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Fee tiers retrieved successfully", cached);
    }

    // Get company's preferred currency
    let preferredCurrency = 'USD';
    let conversionRate = 1;
    
    if (company_id) {
      preferredCurrency = await getUserDisplayCurrency(userId, company_id as string);
    }

    // Calculate user's ALL-TIME cumulative transaction volume (in USD)
    // Tier progression is based on total volume, not just current month
    const companyJoinFee = company_id ? 'LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id' : '';
    const companyFilterFee = company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : '';

    // Cumulative volume for tier progression — SETTLED only, shared expr, so it
    // matches getDashboard's fee tier and the /wallet total (no all-status drift).
    const feeUsdFallback = PROCESSED_USD_EXPR;

    const volumeResult = await sequelize.query(
      `SELECT COALESCE(SUM(${feeUsdFallback}), 0) as total_usd_volume
       FROM tbl_user_transaction ut
       ${companyJoinFee}
       WHERE ut.user_id = :userId 
       AND ${PROCESSED_STATUS_SQL}
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

    // Cache for 5 minutes (B3: single SET EX round-trip, fire-and-forget)
    setRedisItemWithTTL(cacheKey, feeTiersResponse, 300).catch(() => {});

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
    let userId = userData.user_id;

    // Validate company ownership if company_id is provided. Recent transactions
    // MUST be scoped to the selected company for data isolation — matching
    // getDashboard / getChartData / getFeeTiers. (Bug: previously this endpoint
    // filtered ONLY by user_id, so the Recent Transactions widget leaked
    // transactions across every company owned by the same user.)
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      // RBAC: a team member reads the OWNER's data for a granted company, so scope
      // every query below to the company owner's user_id (no-op when caller is owner).
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }

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
        ut.incoming_tx_hash,
        ut.confirmations,
        ut.usd_value,
        ut.transaction_reference,
        ut."createdAt",
        uw.wallet_type,
        c.customer_name,
        c.email as customer_email,
        -- Source metadata — resolved in JS via resolveTransactionSource() so the
        -- dashboard classifies a transaction IDENTICALLY to the /transactions
        -- page (payment_link / api / tip / product / contribution / direct)
        -- instead of the old email-pattern CASE that used a different taxonomy.
        pl.link_id           as source_link_id,
        pl.link_type         as source_link_type,
        pl.title             as source_link_title,
        pl.parent_link_id    as source_parent_link_id,
        pl.is_tip_jar        as source_is_tip_jar,
        parent_pl.title      as source_parent_title,
        parent_pl.is_tip_jar as source_parent_is_tip_jar,
        po.order_id          as source_order_id,
        po.public_ref        as source_order_ref
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_user_wallet uw ON ut.wallet_id = uw.wallet_id
       LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
       LEFT JOIN (
         SELECT DISTINCT ON (transaction_reference)
           transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar
         FROM tbl_payment_link
         WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
         ORDER BY transaction_reference, link_id DESC
       ) pl ON pl.transaction_reference = ut.transaction_reference
         AND ut.transaction_reference IS NOT NULL AND ut.transaction_reference <> ''
       LEFT JOIN tbl_payment_link parent_pl ON parent_pl.link_id = pl.parent_link_id
       LEFT JOIN tbl_product_order po ON po.payment_link_id = pl.link_id
       WHERE ut.user_id = :userId
         ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
       ORDER BY ut."createdAt" DESC
       LIMIT :limit`,
      {
        replacements: { userId, limit: parseInt(limit as string), companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );

    // Attach the canonical source object (same shape the /transactions page
    // gets) and strip the raw source_* helper columns from the payload.
    const recentTxMapped = (recentTransactions as Array<Record<string, unknown>>).map((row) => {
      const source = resolveTransactionSource({
        source_order_id: row.source_order_id as string | number | null,
        source_order_ref: row.source_order_ref as string | null,
        source_link_id: row.source_link_id as string | number | null,
        source_link_type: row.source_link_type as string | null,
        source_link_title: row.source_link_title as string | null,
        source_parent_link_id: row.source_parent_link_id as string | number | null,
        source_parent_title: row.source_parent_title as string | null,
        source_parent_is_tip_jar: row.source_parent_is_tip_jar as boolean | number | null,
        customer_email: row.customer_email as string | null,
      });
      const {
        source_link_id, source_link_type, source_link_title,
        source_parent_link_id, source_is_tip_jar, source_parent_title,
        source_parent_is_tip_jar, source_order_id, source_order_ref,
        ...clean
      } = row;
      return {
        ...clean,
        // Stale 'pending' → 'unpaid'; fresh pending with nothing on-chain yet
        // → 'awaiting_payment'; a confirming payment stays 'pending'.
        status: deriveTxDisplayStatus(clean.status, clean.createdAt, isPaymentDetected(clean as any)),
        source,
      };
    });

    const recentTxResponse = {
      transactions: recentTxMapped,
      count: recentTxMapped.length,
    };

    // Cache for 60 seconds (B3: single SET EX round-trip, fire-and-forget)
    setRedisItemWithTTL(cacheKey, recentTxResponse, 60).catch(() => {});

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
    let userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      // RBAC: a team member reads the OWNER's data for a granted company, so scope
      // every query below to the company owner's user_id (no-op when caller is owner).
      userId = Number((companyData as unknown as { user_id: number }).user_id);
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
    let userId = userData.user_id;

    // Validate company ownership when company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      // RBAC: a team member reads the OWNER's data for a granted company, so scope
      // every query below to the company owner's user_id (no-op when caller is owner).
      userId = Number((companyData as unknown as { user_id: number }).user_id);
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

// Cache TTL for the Quick-Action badge counts. Short, because these are the
// "what needs my attention right now" numbers — but long enough that a dashboard
// refresh never hammers the DB.
const ACTION_COUNTS_CACHE_TTL = 60;

// ─────────────────────────────────────────────────────────────────────────────
// DELIBERATELY ABSENT: an "unpaid invoices" count.
// In DynoPay an invoice is a RECEIPT, not a receivable: rows in tbl_invoice are
// created by autoGenerateInvoice() only AFTER a transaction reaches
// done/successful, and the UI hardcodes a settled pill
// (Components/Page/Invoices/InvoicePreviewDrawer.tsx: "every invoice in Dynopay
// is [paid]"). Every one of the 6 live rows sits at status='generated' while the
// UI correctly shows them as PAID. So an "unpaid invoice" badge would be
// permanently, confidently wrong. If real accounts-receivable invoicing is ever
// built (send a bill -> wait for payment), add the count here then.
// The genuine receivable signal in this product today is `paylinks_expired`:
// payment links that expired before anyone paid them.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live "needs attention" counts for the dashboard Quick Action tiles, plus the
 * nav reveal-on-relevance signals (`nav_reveal`) used by the sidebar/mobile nav.
 * GET /api/dashboard/action-counts?company_id=1
 *
 * STRICTLY READ-ONLY — one SELECT of scalar COUNT()/EXISTS() subqueries,
 * Redis-cached 60s.
 *
 * `transactions_pending` intentionally reuses getDashboard's EXACT expression and
 * scoping (ut.user_id = :userId AND (ut.company_id OR c.company_id), status =
 * 'pending') so the badge can never disagree with the pending figure the
 * dashboard itself renders — dashboard parity is a hard requirement in this app.
 */
const getActionCounts = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { company_id } = req.query;
    let userId = userData.user_id;

    // Validate company ownership if company_id is provided
    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      // RBAC: a team member reads the OWNER's data for a granted company, so scope
      // every query below to the company owner's user_id (no-op when caller is owner).
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    // v3: added the `nav_reveal` block (F13/N1 reveal-on-relevance signals), so
    // the key is versioned again to avoid serving v2 payloads that lack it.
    const cacheKey = `dashboard:action-counts:${userId}:${company_id || 'all'}:v3`;
    const cached = await getRedisItem(cacheKey);
    if (cached && Object.keys(cached).length > 0) {
      return successResponseHelper(res, 200, "Action counts retrieved successfully", cached);
    }

    // Scope: an explicit company, otherwise every company this user owns.
    const companyScopeSql = company_id
      ? `= :companyId`
      : `IN (SELECT company_id FROM tbl_company WHERE user_id = :userId)`;
    // Mirrors getDashboard's companyFilter exactly.
    const txCompanyFilterSql = company_id
      ? `AND (ut.company_id = :companyId OR c.company_id = :companyId)`
      : ``;

    const countsQuery = `
      SELECT
        -- Pending payments (identical to getDashboard's pending_count)
        (SELECT COUNT(*)::int
           FROM tbl_user_transaction ut
           LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
          WHERE ut.user_id = :userId
            AND ${FRESH_PENDING_SQL}
            ${txCompanyFilterSql}
        ) AS transactions_pending,

        -- Payment links awaiting payment and still valid
        (SELECT COUNT(*)::int
           FROM tbl_payment_link pl
          WHERE pl.company_id ${companyScopeSql}
            AND LOWER(COALESCE(pl.status, '')) = 'pending'
            AND (pl.expires_at IS NULL OR pl.expires_at > NOW())
        ) AS paylinks_active,

        -- Payment links that expired before anyone paid them
        (SELECT COUNT(*)::int
           FROM tbl_payment_link pl
          WHERE pl.company_id ${companyScopeSql}
            AND LOWER(COALESCE(pl.status, '')) = 'pending'
            AND pl.expires_at IS NOT NULL
            AND pl.expires_at <= NOW()
        ) AS paylinks_expired,

        -- Live products a buyer cannot actually buy.
        -- NULL stock is treated as UNTRACKED (= in stock), never as zero, and a
        -- variant product is only flagged when it HAS active variants and every
        -- one of them is explicitly 0 — so we never invent a false alarm.
        (SELECT COUNT(*)::int
           FROM tbl_product p
          WHERE p.deleted_at IS NULL
            AND p.merchant_user_id = :userId
            AND LOWER(COALESCE(p.status, '')) = 'live'
            AND (
              (COALESCE(p.has_variants, false) = false AND COALESCE(p.base_stock, -1) = 0)
              OR (
                COALESCE(p.has_variants, false) = true
                AND EXISTS (
                  SELECT 1 FROM tbl_product_variant v
                   WHERE v.product_id = p.product_id AND v.is_active = true
                )
                AND NOT EXISTS (
                  SELECT 1 FROM tbl_product_variant v
                   WHERE v.product_id = p.product_id
                     AND v.is_active = true
                     AND (v.stock_count IS NULL OR v.stock_count > 0)
                )
              )
            )
        ) AS products_out_of_stock,

        -- Referral rewards earned but not yet credited
        (SELECT COUNT(*)::int
           FROM tbl_referral_reward rr
          WHERE rr.user_id = :userId
            AND LOWER(COALESCE(rr.status, '')) = 'pending'
        ) AS referrals_pending,

        -- ── Nav reveal signals (F13/N1 · reveal-on-relevance) ───────────────
        -- Booleans, NOT counts: they decide whether a nav row exists at all, so
        -- a merchant never stares at a row that is meaningless to them yet.
        -- EXISTS stops at the first matching row, so these are cheap even for
        -- the busiest merchant, and they ride the same 60s Redis cache.

        -- Receipts & Tax: revealed after the FIRST SETTLED transaction. Uses the
        -- app-wide settled definition (PROCESSED_STATUS_SQL) and getDashboard's
        -- exact scoping, so the row can never appear/disappear out of step with
        -- the volume figures the dashboard itself renders.
        (SELECT EXISTS(
           SELECT 1
             FROM tbl_user_transaction ut
             LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
            WHERE ut.user_id = :userId
              AND ${PROCESSED_STATUS_SQL}
              ${txCompanyFilterSql}
        )) AS has_settlement,

        -- Customers: revealed as soon as one customer row exists.
        (SELECT EXISTS(
           SELECT 1 FROM tbl_customer cu WHERE cu.company_id ${companyScopeSql}
        )) AS has_customer,

        -- Developers: revealed once an API key exists (a Settings pointer is the
        -- other way in, so a non-technical merchant is never sent looking).
        (SELECT EXISTS(
           SELECT 1 FROM tbl_api a WHERE a.company_id ${companyScopeSql}
        )) AS has_api_key
    `;

    const rows = (await sequelize.query(countsQuery, {
      replacements: { userId, companyId: company_id },
      type: QueryTypes.SELECT,
    })) as Array<Record<string, unknown>>;

    const row = rows[0] || {};
    const num = (key: string): number => {
      const parsed = parseInt(String(row[key] ?? '0'), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    // pg returns SQL booleans as JS booleans, but stay tolerant of 't'/'true'/1
    // in case the row ever arrives from a different driver/cache shape.
    const bool = (key: string): boolean => {
      const v = row[key];
      return v === true || v === 1 || v === 't' || v === 'true';
    };

    const actionCounts = {
      transactions_pending: num('transactions_pending'),
      paylinks_active: num('paylinks_active'),
      paylinks_expired: num('paylinks_expired'),
      products_out_of_stock: num('products_out_of_stock'),
      referrals_pending: num('referrals_pending'),
      // Nav reveal-on-relevance flags (consumed by hooks/useNavReveal.ts, which
      // makes them sticky for the session so a row never vanishes mid-visit).
      nav_reveal: {
        receipts: bool('has_settlement'),
        customers: bool('has_customer'),
        developers: bool('has_api_key'),
      },
      generated_at: new Date().toISOString(),
    };

    // B3: single SET EX round-trip, fire-and-forget
    setRedisItemWithTTL(cacheKey, actionCounts, ACTION_COUNTS_CACHE_TTL).catch(() => {});

    return successResponseHelper(res, 200, "Action counts retrieved successfully", actionCounts);
  } catch (e) {
    return handleControllerErrorReturn(res, e, apiLogger);
  }
};

/**
 * GET /api/dashboard/pending-summary
 * Money awaiting on-chain confirmation: fresh 'pending' payments (within the
 * payment window) for the selected company, with an accurate USD total.
 * Query params: company_id (optional). Read-only.
 */
const getPendingSummary = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { company_id } = req.query;
    let userId = userData.user_id;

    if (company_id) {
      const companyData = await validateCompanyOwnership(res, company_id as string, userId);
      if (!companyData) return;
      // RBAC: a team member reads the OWNER's data for a granted company, so scope
      // every query below to the company owner's user_id (no-op when caller is owner).
      userId = Number((companyData as unknown as { user_id: number }).user_id);
    }

    const rows = await sequelize.query(
      `SELECT
        ut.transaction_id,
        ut.id,
        ut.base_amount,
        ut.base_currency,
        ut.crypto_currency,
        ut.usd_value,
        ut."createdAt",
        uw.wallet_type,
        c.customer_name,
        c.email as customer_email
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_user_wallet uw ON ut.wallet_id = uw.wallet_id
       LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
       WHERE ut.user_id = :userId
         ${company_id ? 'AND (ut.company_id = :companyId OR c.company_id = :companyId)' : ''}
         AND ${FRESH_PENDING_SQL}
       ORDER BY ut."createdAt" DESC
       LIMIT 25`,
      {
        replacements: { userId, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );

    // Resolve a USD value per row the same way the CSV export does: prefer the
    // stored usd_value, treat stablecoins as face value, otherwise convert the
    // crypto amount live (request-scoped per-currency cache).
    const STABLE = ['USD', 'USDT', 'USDC', 'USDT-ERC20', 'USDT-TRC20', 'USDC-ERC20', 'BUSD', 'DAI'];
    const perUnitUsd = new Map<string, number>();
    const usdForRow = async (tx: Record<string, unknown>): Promise<number> => {
      const stored = Number(tx.usd_value);
      if (Number.isFinite(stored) && stored > 0) return stored;
      const cur = String(tx.base_currency || '').toUpperCase();
      const amt = Number(tx.base_amount) || 0;
      if (amt <= 0) return 0;
      if (STABLE.some((s) => cur === s || cur.includes(s))) return amt;
      if (!perUnitUsd.has(cur)) {
        try {
          perUnitUsd.set(cur, Number(await convertToUSD(cur, 1)) || 0);
        } catch {
          perUnitUsd.set(cur, 0);
        }
      }
      const rate = perUnitUsd.get(cur) || 0;
      return rate > 0 ? amt * rate : 0;
    };

    let total = 0;
    const transactions: Array<Record<string, unknown>> = [];
    for (const tx of rows as Array<Record<string, unknown>>) {
      const usd = await usdForRow(tx);
      total += usd;
      transactions.push({
        transaction_id: tx.transaction_id,
        id: tx.id,
        base_amount: tx.base_amount,
        base_currency: tx.base_currency,
        crypto_currency: tx.crypto_currency,
        wallet_type: tx.wallet_type,
        customer_name: tx.customer_name,
        customer_email: tx.customer_email,
        createdAt: tx.createdAt,
        usd_value: usd > 0 ? Math.round(usd * 100) / 100 : null,
      });
    }

    successResponseHelper(res, 200, "Pending summary retrieved", {
      count: transactions.length,
      total_usd: Math.round(total * 100) / 100,
      transactions,
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
};

export default {
  getDashboard,
  getChartData,
  getFeeTiers,
  getRecentTransactions,
  getPendingSummary,
  getConversions,
  getConversionDetail,
  getActionCounts,
};
