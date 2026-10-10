import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { useSWRConfig } from "swr";
import { DashboardAction, TransactionAction } from "@/Redux/Actions";
import { DASHBOARD_FETCH_ALL } from "@/Redux/Actions/DashboardAction";
import { TRANSACTION_FETCH } from "@/Redux/Actions/TransactionAction";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { FIAT_REFRESH_EVENT, isAmountBearingKey, requestFiatRefresh } from "@/utils/fiatRefresh";
import useMoneyEventStream from "@/hooks/useMoneyEventStream";
import useRefetchOnVisible from "@/hooks/useRefetchOnVisible";

const INTERVAL_MS = 60_000;

/**
 * Mounted once in the merchant shell. Keeps every fiat figure fresh:
 * every 60s (tab visible), on tab focus, and immediately after a payment
 * (SSE money event) or a brand-currency change (FIAT_REFRESH_EVENT).
 * SWR keys are revalidated in place (no blanking); redux-backed dashboard
 * stats / transactions are refetched only on the pages that show them.
 */
export function useFiatAutoRefresh() {
  const { mutate } = useSWRConfig();
  const dispatch = useDispatch();
  const router = useRouter();
  const { selectedCompanyId, merchantDataEnabled } = useCompanyStore();
  const pathRef = useRef(router.pathname);
  pathRef.current = router.pathname;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAll = useCallback(() => {
    void mutate(isAmountBearingKey);
    const payload = selectedCompanyId ? { company_id: selectedCompanyId } : undefined;
    const path = pathRef.current;
    if (path === "/dashboard") dispatch(DashboardAction(DASHBOARD_FETCH_ALL, payload));
    if (path === "/transactions") dispatch(TransactionAction(TRANSACTION_FETCH, payload));
  }, [mutate, dispatch, selectedCompanyId]);

  useEffect(() => {
    if (!merchantDataEnabled) return;
    const onRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refreshAll, 400);
    };
    window.addEventListener(FIAT_REFRESH_EVENT, onRefresh);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refreshAll();
    }, INTERVAL_MS);
    return () => {
      window.removeEventListener(FIAT_REFRESH_EVENT, onRefresh);
      clearInterval(timer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [merchantDataEnabled, refreshAll]);

  useRefetchOnVisible(refreshAll, { enabled: merchantDataEnabled, throttleMs: 15_000 });
  useMoneyEventStream(() => requestFiatRefresh("payment"), merchantDataEnabled);
}

export default useFiatAutoRefresh;
