import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";

/**
 * Shared publishable-keys reader (GET /api/publishable-keys[?company_id=…]).
 *
 * Three surfaces read this list — the Publishable Keys section, the Buy Buttons
 * section (needs an active pk for its snippet), and the API embed snippet card.
 * Routing them through ONE SWR key (per company) means the list is fetched a
 * single time and cached across tab switches / re-mounts instead of once per
 * component, and every mutation refetches via the shared `mutate`.
 *
 * Behaviour is byte-identical to the call sites it replaces:
 *  - a truthy `companyId` → `?company_id=<id>`
 *  - a null/undefined `companyId` → no param (fetch all keys) — used by the
 *    embed card which nudges the merchant to create a key.
 * Gate fetching with `{ enabled }` to preserve the "empty when no company"
 * behaviour of the list sections (they pass `enabled: !!effectiveCompanyId`).
 */

type PkKey = readonly ["publishable-keys", string | number];

const fetcher = async ([, cid]: PkKey): Promise<any[]> => {
  const params = cid && cid !== "all" ? `?company_id=${cid}` : "";
  const { data } = await axiosBaseApi.get(`publishable-keys${params}`);
  return data?.data?.keys || [];
};

export function usePublishableKeys<T = any>(
  companyId?: number | string | null,
  opts?: { enabled?: boolean }
) {
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const enabled = (opts?.enabled ?? true) && hasToken;
  const key: PkKey | null = enabled
    ? ["publishable-keys", companyId ?? "all"]
    : null;

  const { data, error, isLoading, mutate } = useSWR<any[]>(
    key,
    fetcher as any,
    { dedupingInterval: 30_000, keepPreviousData: true }
  );

  return {
    keys: (data as T[]) ?? [],
    loading: isLoading && data === undefined,
    error,
    refetch: () => mutate(),
    mutate,
  };
}

export default usePublishableKeys;
