import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { DashboardAction, DashboardChartAction } from "@/Redux/Actions";
import {
  DASHBOARD_FETCH,
  DASHBOARD_CHART_FETCH,
  DASHBOARD_FETCH_ALL,
} from "@/Redux/Actions/DashboardAction";
// (DASHBOARD_CHART_FETCH kept for type parity; chart dispatches now go
// through DashboardChartAction / DASHBOARD_CHART_INIT — see fetchChartData)
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";

// Module-level dedupe guards. `useDashboardData` is consumed by ~9 dashboard
// components simultaneously; without this, each mounted instance fires its own
// DASHBOARD_FETCH_ALL / USER_PROFILE_FETCH before redux updates, producing the
// duplicate dashboard/profile/recent-transactions/fee-tiers calls seen on load.
// These guards collapse the mount-time storm into a single request per company.
let _lastDashboardAll: { key: string; at: number } = { key: "", at: 0 };
let _profileInFlight = false;
const DASHBOARD_DEDUPE_MS = 4000;

export const useDashboardData = () => {
  const dispatch = useDispatch();

  const dashboardState = useSelector(
    (state: rootReducer) => state.dashboardReducer
  );

  const selectedCompanyId = useCompanyStore().selectedCompanyId;

  const companyList = useCompanyStore().companyList;

  const companiesFetched = useCompanyStore().fetched ?? false;

  // Track whether the user profile has already been fetched to avoid
  // re-dispatching on every render. Profile contains fee_free_remaining_usd
  // and cumulative_volume_usd — needed by GrowPanel to decide which
  // "Grow with Dynopay" offer to show (fee-free trial vs. trial complete
  // vs. premium vs. referral).
  const profileFetched = useSelector(
    (state: any) => Boolean(state.userReducer?.profile)
  );

  // F1: fire the dashboard fetch the moment we have a company id. That id is now
  // seeded synchronously from localStorage (CompanyDataContext) BEFORE
  // /company/getCompany resolves, so the stats/fee-tiers/recent-tx wave no
  // longer waits on the company list — it runs in parallel, collapsing the
  // 3-wave waterfall. If the seeded id is stale, CompanyDataContext reconciles
  // it once the real list arrives and this effect re-fires with the valid id.
  // With no companies, fall back to the aggregate fetch once the list resolves.
  const hasCompanies = companyList && companyList.length > 0;
  const shouldFetch = selectedCompanyId != null || (companiesFetched && !hasCompanies);

  useEffect(() => {
    if (!shouldFetch) return;
    const key = String(selectedCompanyId ?? "all");
    const now = Date.now();
    // Dedupe: skip if the same company was just fetched by another mounted
    // instance (or a very recent remount) within the window.
    if (key === _lastDashboardAll.key && now - _lastDashboardAll.at < DASHBOARD_DEDUPE_MS) {
      return;
    }
    _lastDashboardAll = { key, at: now };
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    // Single dispatch fetches stats + fee-tiers + recent-tx in parallel
    // (avoids debounce dropping individual fetches)
    dispatch(DashboardAction(DASHBOARD_FETCH_ALL, payload));
  }, [dispatch, selectedCompanyId, shouldFetch]);

  // Fetch user profile once — needed to know fee_free_remaining_usd so the
  // dashboard's GrowPanel doesn't wrongly promote fee-free credit to
  // merchants who've already exhausted it.
  useEffect(() => {
    if (profileFetched || _profileInFlight) return;
    _profileInFlight = true;
    dispatch(UserAction(USER_PROFILE_FETCH));
    // Release the guard after a window so a failed fetch can be retried.
    const t = setTimeout(() => {
      _profileInFlight = false;
    }, DASHBOARD_DEDUPE_MS);
    return () => clearTimeout(t);
  }, [dispatch, profileFetched]);

  const fetchChartData = useCallback(
    (period: string, startDate?: string, endDate?: string) => {
      // F1: allow the chart to fetch as soon as a company id is known (seeded
      // from localStorage), not only after the company list resolves.
      if (!companiesFetched && selectedCompanyId == null) return;
      // Dispatched on its own DASHBOARD_CHART_INIT channel (takeLatest).
      // The shared DASHBOARD_INIT channel is debounced 400ms — chart fetches
      // dispatched alongside DASHBOARD_FETCH_ALL on mount were dropped,
      // leaving the Transaction Volume chart empty for active merchants.
      dispatch(
        DashboardChartAction({ period, startDate, endDate, company_id: selectedCompanyId })
      );
    },
    [dispatch, selectedCompanyId, companiesFetched]
  );

  const refreshDashboard = useCallback(() => {
    if (!shouldFetch) return;
    const key = String(selectedCompanyId ?? "all");
    // Explicit refresh bypasses the dedupe window but updates it so the
    // auto-effects don't immediately re-fire.
    _lastDashboardAll = { key, at: Date.now() };
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(DashboardAction(DASHBOARD_FETCH_ALL, payload));
  }, [dispatch, selectedCompanyId, shouldFetch]);

  return {
    stats: dashboardState.stats,
    chartData: dashboardState.chartData,
    chartSummary: dashboardState.chartSummary,
    chartAssets: dashboardState.chartAssets,
    feeTiers: dashboardState.feeTiers,
    recentTransactions: dashboardState.recentTransactions,
    loading: dashboardState.loading || !companiesFetched,
    chartLoading: dashboardState.chartLoading,
    fetchChartData,
    refreshDashboard,
  };
};
