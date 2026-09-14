import axiosBaseApi from "@/axiosConfig";

/**
 * Shared SWR fetcher (refactor item 5 — standardize data fetching).
 *
 * ONE place that turns an SWR key into a GET through the app's AUTHENTICATED
 * axios instance (`axiosBaseApi`, which attaches the bearer token and handles
 * 401→refresh). This replaces the dozens of per-hook / per-component
 * `const fetcher = (url) => axiosBaseApi.get(url)...` copies scattered across
 * the app, and gives the ~67 manual `axios`-in-`useEffect` screens a single,
 * consistent path to migrate onto (loading + error + caching for free).
 *
 * Supported SWR key shapes:
 *   useSWR("orders?status=paid", swrFetcher)      → GET orders?status=paid → res.data
 *   useSWR(["orders", companyId], swrFetcher)     → GET the FIRST string ("orders")
 *
 * The URL is passed straight to `axiosBaseApi`, whose baseURL already includes
 * the `/api/` prefix, so keys are relative (no leading slash needed).
 */

export type SwrKey =
  | string
  | readonly [string, ...unknown[]]
  | null
  | undefined
  | false;

/** Resolve the request URL from an SWR key (string, or tuple whose head is the URL). */
export const urlFromSwrKey = (key: SwrKey): string => {
  if (typeof key === "string") return key;
  if (Array.isArray(key) && typeof key[0] === "string") return key[0];
  throw new Error(`[swrFetcher] unsupported SWR key shape: ${JSON.stringify(key)}`);
};

/**
 * Default fetcher: GET the URL and return the raw response body (`res.data`).
 * Most DynoPay endpoints wrap payloads as `{ data: ... }`; callers unwrap as
 * needed (or use `swrDataFetcher` below to auto-unwrap `.data.data`).
 */
export const swrFetcher = async <T = unknown>(key: SwrKey): Promise<T> => {
  const { data } = await axiosBaseApi.get(urlFromSwrKey(key));
  return data as T;
};

/**
 * Convenience fetcher for the common `{ data: { ... } }` envelope — returns
 * `res.data.data` (falls back to `res.data` when there's no nested `data`).
 */
export const swrDataFetcher = async <T = unknown>(key: SwrKey): Promise<T> => {
  const { data } = await axiosBaseApi.get(urlFromSwrKey(key));
  return (data?.data ?? data) as T;
};

export default swrFetcher;
