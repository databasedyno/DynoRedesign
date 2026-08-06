/**
 * useUnreadNotificationsCount — helper that keeps the sidebar badge and
 * mobile-nav badge reasonably fresh WITHOUT hammering the API.
 *
 * Chattiness controls (session 10 UX audit):
 *  - Cache with a 45s TTL, persisted in sessionStorage so it survives BOTH
 *    SPA navigations (module scope) and full page reloads.
 *  - In-flight request dedupe: concurrent consumers (sidebar + mobile nav)
 *    share one HTTP request.
 *  - The first fetch after mount is deferred ~400ms: on a fresh page load the
 *    Redux company id hydrates a moment after mount, and without the deferral
 *    the hook would fire once WITHOUT company_id and again WITH it. The
 *    deferral lets effect cleanup cancel the stale pre-hydration fetch.
 *  - 60s polling + focus refresh are kept, but both go through the TTL gate.
 *
 * The count is company-scoped. If the user has no company selected, we return 0
 * (nothing to badge against).
 */
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axiosBaseApi from "@/axiosConfig";

const POLL_INTERVAL_MS = 60_000;
const CACHE_TTL_MS = 45_000;
const INITIAL_FETCH_DELAY_MS = 400;
const STORAGE_KEY = "unread_count_cache_v1";

type CacheEntry = { count: number; ts: number };

// Module-level (shared across all hook consumers and SPA navigations)
const countCache = new Map<string, CacheEntry>();

// Hydrate from sessionStorage once per page load so hard reloads also reuse
// recent counts instead of refetching.
if (typeof window !== "undefined") {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
      Object.entries(parsed).forEach(([k, v]) => {
        if (
          v &&
          typeof v.count === "number" &&
          typeof v.ts === "number" &&
          Date.now() - v.ts < CACHE_TTL_MS
        ) {
          countCache.set(k, v);
        }
      });
    }
  } catch {
    /* corrupt cache — ignore */
  }
}

function persistCache() {
  try {
    const obj: Record<string, CacheEntry> = {};
    countCache.forEach((v, k) => {
      obj[k] = v;
    });
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* storage full/unavailable — cache still works in-memory */
  }
}

const inflight = new Map<string, Promise<number>>();

// ── Pub/sub so cache mutations (mark read / mark all read) refresh EVERY
// mounted badge (sidebar + mobile nav) immediately, instead of waiting for the
// next 60s poll. Without this the red badge lingered after "mark as read".
const listeners = new Set<() => void>();
function emitUnreadChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a bad listener must not break the others */
    }
  });
}

// Mirrors Redux companyReducer's persisted selection so the very first fetch
// after a full page load is already company-scoped (Redux hydrates a moment
// later; without this we'd fire an un-scoped duplicate request first).
export function readLastCompanyId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem("last_company_id");
    const n = val ? parseInt(val, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function cacheKey(companyId: unknown): string {
  return companyId ? String(companyId) : "all";
}

function getFreshCached(companyId: unknown): number | null {
  const entry = countCache.get(cacheKey(companyId));
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.count;
  return null;
}

function fetchUnreadCount(companyId: unknown): Promise<number> {  const key = cacheKey(companyId);

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
      persistCache();
      return count;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

export { fetchUnreadCount };

/**
 * Write-through update of the shared cached count (e.g. after "mark all as
 * read" we know the count is 0) so the sidebar/mobile badges reflect the
 * change immediately without another request.
 */
export function setCachedUnreadCount(companyId: unknown, count: number) {
  countCache.set(cacheKey(companyId), { count, ts: Date.now() });
  persistCache();
  emitUnreadChange();
}

/**
 * Optimistically decrement the shared count by `by` (default 1) — used when a
 * single notification is marked read so the badge drops instantly without a
 * refetch — then notify all mounted badges.
 */
export function decrementUnreadCount(companyId: unknown, by = 1) {
  const key = cacheKey(companyId);
  const current = countCache.get(key)?.count ?? 0;
  const next = Math.max(0, current - by);
  countCache.set(key, { count: next, ts: Date.now() });
  persistCache();
  emitUnreadChange();
}

/**
 * Drop the cached count (e.g. after marking a single notification read) so
 * the next badge poll refetches a fresh value.
 */
export function invalidateUnreadCountCache(companyId: unknown) {
  countCache.delete(cacheKey(companyId));
  persistCache();
  emitUnreadChange();
}

export function useUnreadNotificationsCount(): number {
  const selectedCompanyId = useCompanyStore().selectedCompanyId;
  // Before Redux hydrates, fall back to the persisted last_company_id so the
  // first request is already scoped to the right company (single cache key).
  const effectiveCompanyId = selectedCompanyId ?? readLastCompanyId();
  // Seed from cache so remounts render the badge instantly with no flicker.
  const [count, setCount] = useState<number>(
    () => getFreshCached(effectiveCompanyId) ?? 0,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    // Count is company-scoped: with no company (neither hydrated nor
    // persisted) there is nothing to badge against — skip the network
    // entirely. Effect re-runs once a company gets selected.
    if (!effectiveCompanyId) {
      setCount(0);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let initialTimer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      fetchUnreadCount(effectiveCompanyId)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          /* silent — badge just won't refresh */
        });
    };

    // If we already have a fresh cached value, surface it immediately.
    const cached = getFreshCached(effectiveCompanyId);
    if (cached !== null) setCount(cached);

    // Defer the first network attempt slightly so a company-id hydration
    // right after mount replaces this effect BEFORE the un-scoped request
    // fires (avoids the double no-id/with-id fetch on every page load).
    initialTimer = setTimeout(refresh, INITIAL_FETCH_DELAY_MS);
    timer = setInterval(refresh, POLL_INTERVAL_MS);

    // Refresh when the tab regains focus (users often check notifications on
    // return from other tabs). Goes through the TTL gate, so rapid tab
    // switching doesn't spam the API.
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    // Subscribe so mark-read / mark-all-read update THIS badge immediately.
    listeners.add(refresh);

    return () => {
      cancelled = true;
      if (initialTimer) clearTimeout(initialTimer);
      if (timer) clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      listeners.delete(refresh);
    };
  }, [effectiveCompanyId]);

  return count;
}
