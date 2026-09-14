import { preload } from "swr";
import { COMPANIES_KEY, companyFetcher } from "@/contexts/CompanyDataContext";
import { ONBOARDING_KEY, onboardingFetcher } from "@/hooks/useOnboardingStatus";
import { FEE_FREE_KEY, feeFreeFetcher } from "@/hooks/useFeeFreeStatus";

/**
 * Warm the SWR cache for the dashboard the instant login resolves, BEFORE the
 * route transition to /dashboard completes. The company list is the critical
 * one: `useDashboardData` only dispatches DASHBOARD_FETCH_ALL once the company
 * list has resolved, so prefetching it here unblocks the whole dashboard-stats
 * chain the moment the dashboard paints. Onboarding-status + fee-free-status are
 * warmed too so the header nudges + widgets show instantly.
 *
 * All are read-only GETs and reuse the exact same fetchers/keys the components
 * subscribe to, so `useSWR(sameKey)` on mount reuses the in-flight request.
 */
export function prefetchDashboardData(): void {
  if (typeof window === "undefined") return;
  try {
    if (!localStorage.getItem("token")) return;
  } catch {
    return;
  }
  try {
    preload(COMPANIES_KEY, companyFetcher);
    preload(ONBOARDING_KEY, onboardingFetcher);
    preload(FEE_FREE_KEY, feeFreeFetcher);
  } catch {
    /* prefetch is best-effort — never block navigation */
  }
}

export default prefetchDashboardData;
