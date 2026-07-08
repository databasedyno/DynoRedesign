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

export const useDashboardData = () => {
  const dispatch = useDispatch();

  const dashboardState = useSelector(
    (state: rootReducer) => state.dashboardReducer
  );

  const selectedCompanyId = useSelector(
    (state: any) => state.companyReducer?.selectedCompanyId
  );

  const companyList = useSelector(
    (state: any) => state.companyReducer?.companyList
  );

  const companiesFetched = useSelector(
    (state: any) => state.companyReducer?.fetched ?? false
  );

  // Track whether the user profile has already been fetched to avoid
  // re-dispatching on every render. Profile contains fee_free_remaining_usd
  // and cumulative_volume_usd — needed by GrowPanel to decide which
  // "Grow with DynoPay" offer to show (fee-free trial vs. trial complete
  // vs. premium vs. referral).
  const profileFetched = useSelector(
    (state: any) => Boolean(state.userReducer?.profile)
  );

  // Only fetch dashboard data once companies have been fetched AND a company is selected
  // (or if user truly has no companies after fetch completes).
  // This prevents the flash where aggregate data shows briefly before company-specific data.
  const hasCompanies = companyList && companyList.length > 0;
  const shouldFetch = companiesFetched && (!hasCompanies || selectedCompanyId != null);

  useEffect(() => {
    if (!shouldFetch) return;
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    // Single dispatch fetches stats + fee-tiers + recent-tx in parallel
    // (avoids debounce dropping individual fetches)
    dispatch(DashboardAction(DASHBOARD_FETCH_ALL, payload));
  }, [dispatch, selectedCompanyId, shouldFetch]);

  // Fetch user profile once — needed to know fee_free_remaining_usd so the
  // dashboard's GrowPanel doesn't wrongly promote fee-free credit to
  // merchants who've already exhausted it.
  useEffect(() => {
    if (profileFetched) return;
    dispatch(UserAction(USER_PROFILE_FETCH));
  }, [dispatch, profileFetched]);

  const fetchChartData = useCallback(
    (period: string, startDate?: string, endDate?: string) => {
      if (!companiesFetched) return;
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
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    dispatch(DashboardAction(DASHBOARD_FETCH_ALL, payload));
  }, [dispatch, selectedCompanyId, shouldFetch]);

  return {
    stats: dashboardState.stats,
    chartData: dashboardState.chartData,
    feeTiers: dashboardState.feeTiers,
    recentTransactions: dashboardState.recentTransactions,
    loading: dashboardState.loading || !companiesFetched,
    chartLoading: dashboardState.chartLoading,
    fetchChartData,
    refreshDashboard,
  };
};
