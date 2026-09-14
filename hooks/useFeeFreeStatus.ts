import useApiSWR from "@/hooks/useApiSWR";
import axiosBaseApi from "@/axiosConfig";

/**
 * Shared fee-free-status reader. Three surfaces need this figure simultaneously
 * (the dashboard FeeFreeWidget, the FeeFreeWelcomeModal, and the persistent
 * FeeFreeBanner). Routing them all through ONE SWR key means the status is
 * fetched a single time per page (deduped) instead of once per component.
 *
 * The endpoint is intentionally called without a company_id param to preserve
 * the exact pre-existing behaviour of the three call sites it replaces.
 */

export const FEE_FREE_KEY = "company/fee-free-status";

export interface FeeFreeStatus {
  is_fee_free: boolean;
  fee_free_remaining_usd: number;
  fee_free_total_usd: number;
  fee_free_used_usd: number;
  percentage_used: number;
  fee_tier?: string;
  cumulative_volume_usd?: number;
}

export const feeFreeFetcher = async (url: string): Promise<FeeFreeStatus | undefined> => {
  const res = await axiosBaseApi.get(url);
  return res?.data?.data;
};

export function useFeeFreeStatus(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const { data, error, isLoading, mutate } = useApiSWR<FeeFreeStatus | undefined>(
    enabled && hasToken ? FEE_FREE_KEY : null,
    { unwrap: true, dedupingInterval: 60_000 }
  );
  return { data, loading: isLoading, error, refetch: () => mutate() };
}

export default useFeeFreeStatus;
