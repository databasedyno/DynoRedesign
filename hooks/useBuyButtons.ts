import useApiSWR from "@/hooks/useApiSWR";

/**
 * Shared buy-buttons reader (GET /api/buy-buttons?company_id=…). Backed by SWR
 * so the Buy Buttons list is cached + deduped across mounts and keyed by the
 * active company. Every mutation (create/edit/archive) refetches via `mutate`.
 *
 * Gate with `{ enabled }` to preserve the "empty when no company" behaviour of
 * the original call site (pass `enabled: !!effectiveCompanyId`).
 */

export function useBuyButtons<T = any>(
  companyId?: number | string | null,
  opts?: { enabled?: boolean }
) {
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const enabled = (opts?.enabled ?? true) && hasToken && !!companyId;
  const key = enabled ? `buy-buttons?company_id=${companyId}` : null;

  const { data, error, isLoading, mutate } = useApiSWR<T[]>(key, {
    select: (raw) => (raw?.data?.buttons || []) as T[],
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return {
    buttons: (data as T[]) ?? [],
    loading: isLoading,
    error,
    refetch: () => mutate(),
    mutate,
  };
}

export default useBuyButtons;
