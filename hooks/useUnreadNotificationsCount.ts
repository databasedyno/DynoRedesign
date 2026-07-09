/**
 * useUnreadNotificationsCount — helper that keeps the sidebar badge and
 * mobile-nav badge reasonably fresh WITHOUT hammering the API.
 *
 * Chattiness controls (added session 10 UX audit):
 *  - Module-level cache with a 45s TTL: remounts on page navigation and
 *    multiple simultaneous consumers (sidebar + mobile nav) reuse the cached
 *    value instead of re-fetching.
 *  - In-flight request dedupe: concurrent consumers share one HTTP request.
 *  - 60s polling + focus refresh are kept, but both go through the TTL gate.
 *
 * The count is company-scoped. If the user has no company selected, we return 0
 * (nothing to badge against).
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";

const POLL_INTERVAL_MS = 60_000;
const CACHE_TTL_MS = 45_000;

type CacheEntry = { count: number; ts: number };

// Module-level (shared across all hook consumers and page navigations)
const countCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<number>>();

function cacheKey(companyId: unknown): string {
  return companyId ? String(companyId) : "all";
}

function getFreshCached(companyId: unknown): number | null {
  const entry = countCache.get(cacheKey(companyId));
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.count;
  return null;
}

function fetchUnreadCount(companyId: unknown): Promise<number> {
  const key = cacheKey(companyId);

  // Fresh cache → no network.
  const cached = getFreshCached(companyId);
  if (cached !== null) return Promise.resolve(cached);

  // Someone else is already fetching this key → share the request.
  const existing = inflight.get(key);
  if (existing) return existing;

  const params: Record<string, any> = {};
  if (companyId) params.company_id = companyId;

  const request = axiosBaseApi
    .get("/notifications/unread-count", { params })
    .then((res) => {
      const n = Number(res?.data?.data?.unread_count || 0);
      const count = Number.isFinite(n) && n >= 0 ? n : 0;
      countCache.set(key, { count, ts: Date.now() });
      return count;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export function useUnreadNotificationsCount(): number {
  const selectedCompanyId = useSelector(
    (state: any) => state?.companyReducer?.selectedCompanyId,
  );
  // Seed from cache so remounts render the badge instantly with no flicker.
  const [count, setCount] = useState<number>(
    () => getFreshCached(selectedCompanyId) ?? 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      fetchUnreadCount(selectedCompanyId)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          /* silent — badge just won't refresh */
        });
    };

    refresh();
    timer = setInterval(refresh, POLL_INTERVAL_MS);

    // Refresh when the tab regains focus (users often check notifications on
    // return from other tabs). Goes through the TTL gate, so rapid tab
    // switching doesn't spam the API.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedCompanyId]);

  return count;
}
