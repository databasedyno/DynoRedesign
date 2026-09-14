export const DASHBOARD_INIT: any = "DASHBOARD_INIT";
export const DASHBOARD_FETCH = "DASHBOARD_FETCH";
export const DASHBOARD_CHART_FETCH = "DASHBOARD_CHART_FETCH";
export const DASHBOARD_FEE_TIERS_FETCH = "DASHBOARD_FEE_TIERS_FETCH";
export const DASHBOARD_RECENT_TX_FETCH = "DASHBOARD_RECENT_TX_FETCH";
export const DASHBOARD_FETCH_ALL = "DASHBOARD_FETCH_ALL";
export const DASHBOARD_ERROR = "DASHBOARD_ERROR";

export const DashboardAction = (type?: string, data?: any) => {
  return { type: DASHBOARD_INIT, payload: data, crudType: type };
};

// ── Dedicated wrapper for chart fetches ──────────────────────────────────
// The main DASHBOARD_INIT channel is debounced (400ms) in RootSaga. On
// dashboard mount, DASHBOARD_CHART_FETCH and DASHBOARD_FETCH_ALL are
// dispatched within the same debounce window, so the chart fetch was
// silently swallowed → the Transaction Volume chart showed
// "There is no data to show" even for merchants with recent activity.
// Chart fetches now use their own takeLatest channel so they always run.
export const DASHBOARD_CHART_INIT: any = "DASHBOARD_CHART_INIT";

export const DashboardChartAction = (data?: any) => {
  return {
    type: DASHBOARD_CHART_INIT,
    payload: data,
    crudType: DASHBOARD_CHART_FETCH,
  };
};
