import useApiSWR from "@/hooks/useApiSWR";

/**
 * Shared publishable-keys reader (GET /api/publishable-keys[?company_id=…]).
 *
 * Three surfaces read this list — the Publishable Keys section, the Buy Buttons
 * section (needs an active pk for its snippet), and the API embed snippet card.
 * Routing them through ONE SWR key (per company) means the list is fetched a
 * single time and cached across tab switches / re-mounts instead of once per
 * component, and every mutation refetches via the shared `mutate`.
 *
 * `company_id` is REQUIRED by the endpoint (it 400s without one), so the hook
 * simply does not fetch until a company is selected — callers get `keys: []`
 * in the meantime, which is what every surface already renders for "no keys
 * yet". Gate further with `{ enabled }` if a section needs to hold off.
 */

export function usePublishableKeys<T = any>(
  companyId?: number | string | null,
  opts?: { enabled?: boolean }
) {
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const enabled = (opts?.enabled ?? true) && hasToken && !!companyId;
  const key = enabled ? `publishable-keys?company_id=${companyId}` : null;

  const { data, error, isLoading, mutate } = useApiSWR<T[]>(key, {
    select: (raw) => (raw?.data?.keys || []) as T[],
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return {
    keys: (data as T[]) ?? [],
    loading: isLoading,
    error,
    refetch: () => mutate(),
    mutate,
  };
}

export default usePublishableKeys;
