import useSWR, { SWRConfiguration, KeyedMutator } from "swr";
import { swrFetcher, SwrKey } from "@/utils/swrFetcher";

/**
 * Reusable typed data-fetching hook (refactor item 5).
 *
 * A thin, consistent wrapper over `useSWR` + the shared `swrFetcher` so screens
 * stop hand-rolling `useEffect(() => { axios.get(...).then(setState) }, [])`.
 * Benefits over manual axios-in-useEffect: automatic loading/error state,
 * request de-duplication + caching, revalidation, and a `mutate` for optimistic
 * updates / refetch — all governed by the global <SWRConfig> in _app.tsx.
 *
 * Pass `key = null` (or `enabled:false`) to defer fetching (e.g. until a
 * company is selected or the user is authenticated) — SWR simply won't fetch.
 *
 * Usage:
 *   const { data, isLoading, error, mutate } = useApiSWR<Order[]>("orders");
 *   const { data } = useApiSWR<Profile>(userId ? `users/${userId}` : null);
 *   // auto-unwrap `{ data: {...} }` envelopes:
 *   const { data } = useApiSWR<Kpis>("dashboard/kpis", { unwrap: true });
 */
export interface UseApiSWROptions<T> extends SWRConfiguration<T> {
  /** When false, fetching is deferred (key treated as null). Default true. */
  enabled?: boolean;
  /** Use the `{ data: {...} }`-unwrapping fetcher (returns res.data.data). */
  unwrap?: boolean;
  /** Optional transform on the raw response body (res.data) before caching.
   *  Takes precedence over `unwrap`. Lets a screen keep its exact cached shape
   *  (e.g. `(raw) => raw?.data?.items ?? []`) so render + mutate stay unchanged. */
  select?: (raw: any) => T;
}

export interface UseApiSWRResult<T> {
  data: T | undefined;
  error: unknown;
  /** True only on the FIRST load (no cached data yet) — good for spinners. */
  isLoading: boolean;
  /** True whenever a (re)validation is in flight, incl. background refresh. */
  isValidating: boolean;
  mutate: KeyedMutator<T>;
}

export function useApiSWR<T = unknown>(
  key: SwrKey,
  options: UseApiSWROptions<T> = {},
): UseApiSWRResult<T> {
  const { enabled = true, unwrap = false, select, ...swrOptions } = options;
  const effectiveKey = enabled ? key : null;
  const fetcher = async (k: SwrKey): Promise<T> => {
    const raw = await swrFetcher<any>(k);
    if (select) return select(raw);
    if (unwrap) return (raw?.data ?? raw) as T;
    return raw as T;
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    effectiveKey === false || effectiveKey == null ? null : effectiveKey,
    fetcher,
    swrOptions,
  );

  return {
    data,
    error,
    isLoading: isLoading && data === undefined,
    isValidating,
    mutate,
  };
}

export default useApiSWR;
