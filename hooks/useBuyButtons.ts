import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";

/**
 * Shared buy-buttons reader (GET /api/buy-buttons?company_id=…). Backed by SWR
 * so the Buy Buttons list is cached + deduped across mounts and keyed by the
 * active company. Every mutation (create/edit/archive) refetches via `mutate`.
 *
 * Gate with `{ enabled }` to preserve the "empty when no company" behaviour of
 * the original call site (pass `enabled: !!effectiveCompanyId`).
 */

type BtnKey = readonly ["buy-buttons", string | number];

const fetcher = async ([, cid]: BtnKey): Promise<any[]> => {
  const { data } = await axiosBaseApi.get(`buy-buttons?company_id=${cid}`);
  return data?.data?.buttons || [];
};

export function useBuyButtons<T = any>(
  companyId?: number | string | null,
  opts?: { enabled?: boolean }
) {
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const enabled = (opts?.enabled ?? true) && hasToken && !!companyId;
  const key: BtnKey | null = enabled ? ["buy-buttons", companyId as string | number] : null;

  const { data, error, isLoading, mutate } = useSWR<any[]>(
    key,
    fetcher as any,
    { dedupingInterval: 30_000, keepPreviousData: true }
  );

  return {
    buttons: (data as T[]) ?? [],
    loading: isLoading && data === undefined,
    error,
    refetch: () => mutate(),
    mutate,
  };
}

export default useBuyButtons;
