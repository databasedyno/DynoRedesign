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
      currency: string;
    };
  };
  chartData: Array<{ date: string; value: number }>;
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
  feeTiers: {
    monthlyLimit: 50000,
    usedAmount: 0,
    currentTier: "Standard",
  },
  recentTransactions: [],
  loading: false,
  chartLoading: false,
  fetched: false,
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
        loading: true,
      };

    case DASHBOARD_CHART_INIT:
      return {
        ...state,
        chartLoading: true,
      };

    case DASHBOARD_FETCH:
      return {
        ...state,
        loading: false,
        stats: payload.stats || state.stats,
      };

    case DASHBOARD_CHART_FETCH:
      return {
        ...state,
        chartLoading: false,
        chartData: payload.chartData || state.chartData,
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
