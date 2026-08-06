import { call, put, all } from "redux-saga/effects";
import axiosBaseApi from "@/axiosConfig";
import {
  DASHBOARD_FETCH,
  DASHBOARD_CHART_FETCH,
  DASHBOARD_FEE_TIERS_FETCH,
  DASHBOARD_RECENT_TX_FETCH,
  DASHBOARD_FETCH_ALL,
  DASHBOARD_ERROR,
} from "../Actions/DashboardAction";

interface DashboardSagaAction {
  type: string;
  payload?: any;
  crudType?: string;
}

/* ── Individual fetch helpers (used by both single and combined fetch) ── */

function* fetchDashboardStats(payload: any): Generator<any, void, any> {
  const params: any = {};
  if (payload?.company_id) params.company_id = payload.company_id;

  const response: any = yield call(axiosBaseApi.get, "/dashboard", { params });
  const apiData = response?.data?.data;

  if (apiData) {
    const totalTx = apiData.total_transactions?.count ?? 0;
    const totalVol = apiData.total_volume?.amount ?? 0;
    const totalVolFormatted = apiData.total_volume?.amount_formatted ?? "$0.00 USD";

    yield put({
      type: DASHBOARD_FETCH,
      payload: {
        stats: {
          totalTransactions: totalTx,
          totalVolume: totalVol,
          totalVolumeFormatted: totalVolFormatted,
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
          todaySummary: apiData.today_summary ? {
            volumeToday: apiData.today_summary.volume_today ?? 0,
            volumeTodayFormatted: apiData.today_summary.volume_today_formatted ?? "$0.00",
            volumeYesterday: apiData.today_summary.volume_yesterday ?? 0,
            volumeYesterdayFormatted: apiData.today_summary.volume_yesterday_formatted ?? "$0.00",
            volumeChangePercent: apiData.today_summary.volume_change_percent ?? 0,
            transactionsToday: apiData.today_summary.transactions_today ?? 0,
            transactionsYesterday: apiData.today_summary.transactions_yesterday ?? 0,
            transactionsChangePercent: apiData.today_summary.transactions_change_percent ?? 0,
            pendingCount: apiData.today_summary.pending_count ?? 0,
            currency: apiData.today_summary.currency ?? "USD",
          } : undefined,
        },
      },
    });
  } else {
    yield put({ type: DASHBOARD_ERROR });
  }
}

function* fetchFeeTiers(payload: any): Generator<any, void, any> {
  const feeTierParams: any = {};
  if (payload?.company_id) feeTierParams.company_id = payload.company_id;
  const response: any = yield call(axiosBaseApi.get, "/dashboard/fee-tiers", { params: feeTierParams });
  const apiData = response?.data?.data;
  if (apiData) {
    const userTier = apiData.user_tier || {};
    yield put({
      type: DASHBOARD_FEE_TIERS_FETCH,
      payload: {
        feeTiers: {
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
        },
      },
    });
  }
}

function* fetchRecentTransactions(payload: any): Generator<any, void, any> {
  const recentTxParams: any = {};
  if (payload?.company_id) recentTxParams.company_id = payload.company_id;
  const response: any = yield call(axiosBaseApi.get, "/dashboard/recent-transactions", { params: recentTxParams });
  const apiData = response?.data?.data;
  if (apiData) {
    yield put({
      type: DASHBOARD_RECENT_TX_FETCH,
      payload: {
        recentTransactions: apiData.transactions || [],
      },
    });
  }
}

/* ── Chart series fetch (shared by DashboardSaga + DashboardChartSaga) ── */

function* fetchChartSeries(payload: any): Generator<any, void, any> {
  const period = payload?.period || "7d";
  const params: any = { period };
  if (payload?.company_id) params.company_id = payload.company_id;
  if (payload?.startDate) params.startDate = payload.startDate;
  if (payload?.endDate) params.endDate = payload.endDate;

  const response: any = yield call(axiosBaseApi.get, "/dashboard/chart", { params });
  const apiData = response?.data?.data;
  if (apiData) {
    yield put({
      type: DASHBOARD_CHART_FETCH,
      payload: {
        chartData: (apiData.chart_data || []).map((item: any) => ({
          date: item.date,
          value: item.volume ?? 0,
          transactionCount: item.transaction_count ?? 0,
        })),
      },
    });
  } else {
    yield put({ type: DASHBOARD_ERROR });
  }
}

/* ── Dedicated chart saga ──
   Watched via takeLatest(DASHBOARD_CHART_INIT) in RootSaga. The main
   DASHBOARD_INIT channel is debounced (400ms); chart fetches dispatched in
   the same window as DASHBOARD_FETCH_ALL were dropped, leaving the
   Transaction Volume chart permanently empty. This channel guarantees the
   chart request always executes. */

export function* DashboardChartSaga(action: DashboardSagaAction): Generator<any, void, any> {
  try {
    yield call(fetchChartSeries, action.payload);
  } catch (error) {
    console.error("DashboardChartSaga error:", error);
    yield put({ type: DASHBOARD_ERROR });
  }
}

/* ── Main Saga ── */

// Central dedupe for DASHBOARD_FETCH_ALL. Multiple dashboard components +
// hooks dispatch this on mount (useDashboardData ×N, OnboardingFlow, currency
// selectors), which previously caused the dashboard/fee-tiers/recent-tx
// endpoints to be hit 2–3× on load. This collapses bursts for the same company
// into a single fetch; a different company (switch) or a fetch after the window
// (manual refresh) is always allowed through.
let _lastDashboardAllKey = "";
let _lastDashboardAllAt = 0;
const DASHBOARD_ALL_DEDUPE_MS = 4000;

export function* DashboardSaga(action: DashboardSagaAction): Generator<any, void, any> {
  const { crudType, payload } = action;

  try {
    switch (crudType) {
      // Combined fetch — dispatched once, fetches stats + fee-tiers + recent-tx in parallel
      case DASHBOARD_FETCH_ALL: {
        const key = String((payload && (payload as any).company_id) ?? "all");
        const now = Date.now();
        if (key === _lastDashboardAllKey && now - _lastDashboardAllAt < DASHBOARD_ALL_DEDUPE_MS) {
          break; // duplicate burst for the same company — skip
        }
        _lastDashboardAllKey = key;
        _lastDashboardAllAt = now;
        yield all([
          call(fetchDashboardStats, payload),
          call(fetchFeeTiers, payload),
          call(fetchRecentTransactions, payload),
        ]);
        break;
      }

      case DASHBOARD_FETCH: {
        yield call(fetchDashboardStats, payload);
        break;
      }

      case DASHBOARD_CHART_FETCH: {
        yield call(fetchChartSeries, payload);
        break;
      }

      case DASHBOARD_FEE_TIERS_FETCH: {
        yield call(fetchFeeTiers, payload);
        break;
      }

      case DASHBOARD_RECENT_TX_FETCH: {
        yield call(fetchRecentTransactions, payload);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("DashboardSaga error:", error);
    yield put({ type: DASHBOARD_ERROR });
  }
}
