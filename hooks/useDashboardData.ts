import { useCallback, useSyncExternalStore } from "react";
import useSWR, { mutate as globalMutate } from "swr";

import axiosBaseApi from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import useProfile from "@/hooks/useProfile";

/**
 * useDashboardData — SWR-backed replacement for the old Redux `dashboardReducer`
 * + `DashboardSaga` (data-layer consolidation, REFACTOR Part D / Phase 2, Wave 3).
 *
 * Dashboard is a pure-read domain (stats / fee-tiers / recent-tx / chart). Each
 * is its own SWR resource keyed on the selected company, so:
 *   - switching company changes every key → auto-refetch (no CompanySelector
 *     dispatch needed);
 *   - the ~9 dashboard components that call this hook share one request per
 *     resource via SWR's built-in dedupe (replaces the old module-level
 *     _lastDashboardAll guard).
 * The chart is parametrised (period / custom range); those params live in a
 * tiny module-level store so every mounted instance agrees on ONE chart key
 * (preserving the old "global chartData" semantics). `fetchChartData` just sets
 * those params; `revalidateDashboardData()` re-runs everything after an action
 * that changes the numbers (currency switch, onboarding milestone).
 *
 * The user PROFILE fetch stays on redux for now — it belongs to the User domain
 * (Wave 5), not the dashboard.
 */

/* ── SWR keys (prefixed so revalidateDashboardData can match them all) ── */
export const DASHBOARD_STATS_KEY = "dashboard:stats";
export const DASHBOARD_FEE_TIERS_KEY = "dashboard:fee-tiers";
export const DASHBOARD_RECENT_TX_KEY = "dashboard:recent-tx";
export const DASHBOARD_CHART_KEY = "dashboard:chart";

/* ── Public data shapes (moved off the deleted reducer) ── */
export interface DashboardStats {
  totalTransactions: number;
  totalVolume: number;
  totalVolumeFormatted: string;
  currency: string;
  currencySymbol: string;
  activeWallets: number;
  transactionChange: number;
  volumeChange: number;
  pendingTransactions?: number;
  taxCollected?: number;
  taxCollectedFormatted?: string | null;
  activeWalletsList?: any[];
  feeTier?: any;
  todaySummary?: {
    volumeToday: number;
    volumeTodayFormatted: string;
    volumeYesterday: number;
    volumeYesterdayFormatted: string;
    volumeChangePercent: number;
    transactionsToday: number;
    transactionsYesterday: number;
    transactionsChangePercent: number;
    pendingCount: number;
    currency: string;
  };
}

export interface DashboardFeeTiers {
  monthlyLimit: number;
  usedAmount: number;
  currentTier: string;
  currentTierKey?: string;
  currentTierPercent?: number;
  tiers?: any[];
  percentToNextTier?: number;
  amountToNextTier?: number;
  nextTier?: string;
  nextTierKey?: string;
  nextTierPercent?: number | null;
}

export interface DashboardChartResult {
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  chartSummary:
    | {
        total_volume: number;
        total_transactions: number;
        previous_total_volume: number;
        previous_total_transactions: number;
        previous_start_date?: string;
        previous_end_date?: string;
        volume_change_percent: number;
        transactions_change_percent: number;
      }
    | null;
  chartAssets: Array<{ currency: string; count: number; volume: number }>;
}

/* ── Defaults (mirror the old reducer initial state so consumers that read
   stats.* / feeTiers.* never hit undefined during the first load) ── */
const DEFAULT_STATS: DashboardStats = {
  totalTransactions: 0,
  totalVolume: 0,
  totalVolumeFormatted: "$0.00 USD",
  currency: "USD",
  currencySymbol: "$",
  activeWallets: 0,
  transactionChange: 0,
  volumeChange: 0,
};

const DEFAULT_FEE_TIERS: DashboardFeeTiers = {
  monthlyLimit: 50000,
  usedAmount: 0,
  currentTier: "Standard",
};

/* ── Fetchers (ported verbatim from DashboardSaga) ── */
const companyIdFromKey = (key: any): number | undefined =>
  Array.isArray(key) ? (key[1] as number | undefined) : undefined;

async function statsFetcher(key: any): Promise<DashboardStats> {
  const companyId = companyIdFromKey(key);
  const params: any = {};
  if (companyId) params.company_id = companyId;
  const res = await axiosBaseApi.get("/dashboard", { params });
  const apiData = res?.data?.data;
  if (!apiData) return DEFAULT_STATS;
  return {
    totalTransactions: apiData.total_transactions?.count ?? 0,
    totalVolume: apiData.total_volume?.amount ?? 0,
    totalVolumeFormatted: apiData.total_volume?.amount_formatted ?? "$0.00 USD",
    currency: apiData.total_volume?.currency || "USD",
    currencySymbol: apiData.total_volume?.currency_info?.symbol || "$",
    activeWallets: apiData.active_wallets?.count ?? 0,
    transactionChange: apiData.total_transactions?.change_percent ?? 0,
    volumeChange: apiData.total_volume?.change_percent ?? 0,
    pendingTransactions: apiData.pending_transactions?.count ?? 0,
    taxCollected: apiData.tax_collected?.amount ?? 0,
    taxCollectedFormatted: apiData.tax_collected?.amount_formatted ?? null,
    activeWalletsList: apiData.active_wallets?.wallets ?? [],
    feeTier: apiData.fee_tier ?? null,
    todaySummary: apiData.today_summary
      ? {
          volumeToday: apiData.today_summary.volume_today ?? 0,
          volumeTodayFormatted:
            apiData.today_summary.volume_today_formatted ?? "$0.00",
          volumeYesterday: apiData.today_summary.volume_yesterday ?? 0,
          volumeYesterdayFormatted:
            apiData.today_summary.volume_yesterday_formatted ?? "$0.00",
          volumeChangePercent: apiData.today_summary.volume_change_percent ?? 0,
          transactionsToday: apiData.today_summary.transactions_today ?? 0,
          transactionsYesterday:
            apiData.today_summary.transactions_yesterday ?? 0,
          transactionsChangePercent:
            apiData.today_summary.transactions_change_percent ?? 0,
          pendingCount: apiData.today_summary.pending_count ?? 0,
          currency: apiData.today_summary.currency ?? "USD",
        }
      : undefined,
  };
}

async function feeTiersFetcher(key: any): Promise<DashboardFeeTiers> {
  const companyId = companyIdFromKey(key);
  const params: any = {};
  if (companyId) params.company_id = companyId;
  const res = await axiosBaseApi.get("/dashboard/fee-tiers", { params });
  const apiData = res?.data?.data;
  if (!apiData) return DEFAULT_FEE_TIERS;
  const userTier = apiData.user_tier || {};
  return {
    monthlyLimit: userTier.amount_to_next_tier
      ? userTier.total_volume + userTier.amount_to_next_tier
      : 50000,
    usedAmount: userTier.total_volume ?? 0,
    currentTier: userTier.current_tier ?? "Starter",
    currentTierKey: userTier.current_tier_key ?? "starter",
    currentTierPercent: userTier.current_tier_percent ?? 1.5,
    tiers: apiData.tiers || [],
    percentToNextTier: userTier.percent_to_next_tier ?? 0,
    amountToNextTier: userTier.amount_to_next_tier ?? 0,
    nextTier: userTier.next_tier ?? "",
    nextTierKey: userTier.next_tier_key ?? "",
    nextTierPercent: userTier.next_tier_percent ?? null,
  };
}

async function recentTxFetcher(key: any): Promise<any[]> {
  const companyId = companyIdFromKey(key);
  const params: any = {};
  if (companyId) params.company_id = companyId;
  const res = await axiosBaseApi.get("/dashboard/recent-transactions", {
    params,
  });
  return res?.data?.data?.transactions || [];
}

async function chartFetcher(key: any): Promise<DashboardChartResult> {
  // key = [DASHBOARD_CHART_KEY, companyId, period, startDate, endDate]
  const [, companyId, period, startDate, endDate] = key as any[];
  const params: any = { period: period || "7d" };
  if (companyId) params.company_id = companyId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const res = await axiosBaseApi.get("/dashboard/chart", { params });
  const apiData = res?.data?.data;
  if (!apiData) return { chartData: [], chartSummary: null, chartAssets: [] };
  return {
    chartData: (apiData.chart_data || []).map((item: any) => ({
      date: item.date,
      value: item.volume ?? 0,
      transactionCount: item.transaction_count ?? 0,
    })),
    chartSummary: apiData.period_summary || null,
    chartAssets: (apiData.currency_breakdown || []).map((c: any) => ({
      currency: c.currency,
      count: c.count ?? 0,
      volume: c.volume ?? 0,
    })),
  };
}

/* ── Shared chart params (global, mirrors the old redux chart scope so all
   mounted instances render the SAME chart key → SWR dedupes to one fetch) ── */
interface ChartParams {
  period: string;
  startDate?: string;
  endDate?: string;
}
let _chartParams: ChartParams = { period: "7d" };
const _chartListeners = new Set<() => void>();

function setChartParams(p: ChartParams) {
  if (
    p.period === _chartParams.period &&
    p.startDate === _chartParams.startDate &&
    p.endDate === _chartParams.endDate
  ) {
    return;
  }
  _chartParams = p;
  _chartListeners.forEach((l) => l());
}

function subscribeChartParams(cb: () => void) {
  _chartListeners.add(cb);
  return () => {
    _chartListeners.delete(cb);
  };
}

/**
 * Revalidate all dashboard SWR resources — used by the display-currency
 * selectors + onboarding after an action that changes the numbers. No-op if
 * nothing is currently subscribed (e.g. off the dashboard).
 */
export function revalidateDashboardData(): void {
  globalMutate(
    (key: any) =>
      Array.isArray(key) &&
      typeof key[0] === "string" &&
      key[0].startsWith("dashboard:"),
    undefined,
    { revalidate: true },
  );
}

export const useDashboardData = () => {
  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  const companyList = useCompanyStore().companyList;
  const companiesFetched = useCompanyStore().fetched ?? false;

  // User profile is fetched via SWR (useProfile) — calling it here ensures the
  // profile loads for the ~9 dashboard components that read it (was the old
  // USER_PROFILE_FETCH dispatch with a manual in-flight dedupe).
  useProfile();

  // Only fetch once companies have resolved AND a company is selected (or the
  // user genuinely has none). Prevents the aggregate → company-specific flash.
  const hasCompanies = companyList && companyList.length > 0;
  const shouldFetch =
    companiesFetched && (!hasCompanies || selectedCompanyId != null);

  const chartParams = useSyncExternalStore(
    subscribeChartParams,
    () => _chartParams,
    () => _chartParams,
  );

  const companyKey = selectedCompanyId ?? null;

  const statsSwr = useSWR(
    shouldFetch ? [DASHBOARD_STATS_KEY, companyKey] : null,
    statsFetcher,
  );
  const feeTiersSwr = useSWR(
    shouldFetch ? [DASHBOARD_FEE_TIERS_KEY, companyKey] : null,
    feeTiersFetcher,
  );
  const recentTxSwr = useSWR(
    shouldFetch ? [DASHBOARD_RECENT_TX_KEY, companyKey] : null,
    recentTxFetcher,
  );
  const chartSwr = useSWR(
    shouldFetch
      ? [
          DASHBOARD_CHART_KEY,
          companyKey,
          chartParams.period,
          chartParams.startDate ?? null,
          chartParams.endDate ?? null,
        ]
      : null,
    chartFetcher,
  );

  const fetchChartData = useCallback(
    (period: string, startDate?: string, endDate?: string) => {
      if (!companiesFetched) return;
      setChartParams({ period, startDate, endDate });
    },
    [companiesFetched],
  );

  const refreshDashboard = useCallback(() => {
    if (!shouldFetch) return;
    statsSwr.mutate();
    feeTiersSwr.mutate();
    recentTxSwr.mutate();
    chartSwr.mutate();
  }, [shouldFetch, statsSwr, feeTiersSwr, recentTxSwr, chartSwr]);

  return {
    stats: statsSwr.data ?? DEFAULT_STATS,
    chartData: chartSwr.data?.chartData ?? [],
    chartSummary: chartSwr.data?.chartSummary ?? null,
    chartAssets: chartSwr.data?.chartAssets ?? [],
    feeTiers: feeTiersSwr.data ?? DEFAULT_FEE_TIERS,
    recentTransactions: recentTxSwr.data ?? [],
    loading:
      (statsSwr.isLoading && statsSwr.data === undefined) || !companiesFetched,
    chartLoading: chartSwr.isLoading && chartSwr.data === undefined,
    fetchChartData,
    refreshDashboard,
  };
};

export default useDashboardData;
