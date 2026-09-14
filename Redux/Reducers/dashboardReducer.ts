import { ReducerAction } from "@/utils/types";
import {
  DASHBOARD_FETCH,
  DASHBOARD_CHART_FETCH,
  DASHBOARD_FEE_TIERS_FETCH,
  DASHBOARD_RECENT_TX_FETCH,
  DASHBOARD_ERROR,
  DASHBOARD_INIT,
  DASHBOARD_CHART_INIT,
} from "../Actions/DashboardAction";

export interface DashboardState {
  stats: {
    totalTransactions: number;
    totalVolume: number;
    totalVolumeFormatted: string;
    currency: string;
    currencySymbol: string;
    activeWallets: number;
    transactionChange: number;
    volumeChange: number;
    taxCollected?: number;
    taxCollectedFormatted?: string | null;
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
      underpaidCount: number;
      currency: string;
    };
  };
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  chartSummary: {
    total_volume: number;
    total_transactions: number;
    previous_total_volume: number;
    previous_total_transactions: number;
    previous_start_date?: string;
    previous_end_date?: string;
    volume_change_percent: number;
    transactions_change_percent: number;
  } | null;
  chartAssets: Array<{ currency: string; count: number; volume: number }>;
  feeTiers: {
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
  };
  recentTransactions: any[];
  loading: boolean;
  chartLoading: boolean;
  fetched: boolean;
  // True once real dashboard stats / chart series have been fetched at least
  // once this session. Used to gate the loading skeleton so a re-init from a
  // refocus / remount / background refresh keeps the current data on screen
  // instead of flashing — or getting permanently STUCK — on a skeleton when
  // the saga dedupes or drops the follow-up fetch. (Distinct from `fetched`,
  // which OnboardingFlow reads for the "first payment received" milestone.)
  statsLoaded: boolean;
  chartLoaded: boolean;
}

const dashboardInitialState: DashboardState = {
  stats: {
    totalTransactions: 0,
    totalVolume: 0,
    totalVolumeFormatted: "$0.00 USD",
    currency: "USD",
    currencySymbol: "$",
    activeWallets: 0,
    transactionChange: 0,
    volumeChange: 0,
  },
  chartData: [],
  chartSummary: null,
  chartAssets: [],
  feeTiers: {
    monthlyLimit: 50000,
    usedAmount: 0,
    currentTier: "Standard",
  },
  recentTransactions: [],
  loading: false,
  chartLoading: false,
  fetched: false,
  statsLoaded: false,
  chartLoaded: false,
};

const dashboardReducer = (
  state = dashboardInitialState,
  action: ReducerAction
) => {
  const { payload } = action;

  switch (action.type) {
    case DASHBOARD_INIT:
      return {
        ...state,
        // Only show the full skeleton on the genuine FIRST load (no stats yet).
        // Once real stats are on screen, a re-init (refocus / remount / extra
        // dispatcher / deduped refresh) must NOT flip back to a skeleton — a
        // plain `loading:true` here got permanently stuck whenever the saga
        // deduped the follow-up DASHBOARD_FETCH_ALL and `break`ed without a
        // terminal DASHBOARD_FETCH/ERROR. Keep the current numbers visible.
        loading: state.statsLoaded ? false : true,
      };

    case DASHBOARD_CHART_INIT:
      return {
        ...state,
        // Same guard as DASHBOARD_INIT: never flash/stick the chart skeleton
        // once a series is loaded — the balance headline's "This period" metric
        // keys off chartLoading too (showSkeleton = loading || chartLoading).
        chartLoading: state.chartLoaded ? false : true,
      };

    case DASHBOARD_FETCH:
      return {
        ...state,
        loading: false,
        statsLoaded: true,
        stats: payload.stats || state.stats,
      };

    case DASHBOARD_CHART_FETCH:
      return {
        ...state,
        chartLoading: false,
        chartLoaded: true,
        chartData: payload.chartData || state.chartData,
        chartSummary:
          payload.chartSummary !== undefined ? payload.chartSummary : state.chartSummary,
        chartAssets: payload.chartAssets || state.chartAssets,
      };

    case DASHBOARD_FEE_TIERS_FETCH:
      return {
        ...state,
        feeTiers: payload.feeTiers || state.feeTiers,
      };

    case DASHBOARD_RECENT_TX_FETCH:
      return {
        ...state,
        recentTransactions: payload.recentTransactions || state.recentTransactions,
      };

    case DASHBOARD_ERROR:
      return {
        ...state,
        loading: false,
        chartLoading: false,
      };

    default:
      return state;
  }
};

export default dashboardReducer;
