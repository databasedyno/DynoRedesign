import { useEffect, useState } from "react";
import axios from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

/**
 * useNavReveal — reveal-on-relevance signals for the nav (audit F13 / N1).
 *
 * The IA audit's law 5 is "nothing ships marked *soon*"; the replacement is a nav
 * that GROWS with the merchant instead of showing rows that are meaningless to
 * them yet. Three rows are gated:
 *
 *   • Receipts & Tax → after the first SETTLED transaction
 *   • Customers      → when a customer row exists
 *   • Developers     → when an API key exists (Settings also links to it, so a
 *                      non-technical merchant is never sent hunting)
 *
 * Design constraints this hook exists to satisfy:
 *
 * 1. ONE request per session per account, no matter how many components ask.
 *    The sidebar, the mobile nav and the header all consume this through
 *    useAccountProfile, so a naive fetch-per-consumer would multiply requests on
 *    EVERY page. A module-level cache + in-flight promise de-dupe fixes that;
 *    the backend also Redis-caches the payload for 60s.
 * 2. STICKY: "a row never disappears once revealed in a session" (N1 acceptance).
 *    Flags are OR-merged into sessionStorage, so a row that appeared cannot flap
 *    back out mid-visit — e.g. after switching accounts and back, or if a cached
 *    response arrives with an older view of the data.
 * 3. NEVER blocking and never noisy: any failure resolves to "reveal nothing
 *    extra". The five always-on rows (Dashboard, Payment links, Storefront,
 *    Transactions, Payout wallets, Settings) do not depend on this hook, so a
 *    hiccup can never leave a merchant without navigation.
 */
export interface NavRevealFlags {
  receipts: boolean;
  customers: boolean;
  developers: boolean;
}

export interface NavRevealState extends NavRevealFlags {
  /** True once a response (or a cached session value) has been applied. */
  ready: boolean;
}

const EMPTY: NavRevealFlags = { receipts: false, customers: false, developers: false };

const storageKey = (companyKey: string) => `dyno_nav_reveal:${companyKey}`;

/** Session-sticky cache, shared by every consumer in the tab. */
const memoryCache = new Map<string, NavRevealFlags>();
const inFlight = new Map<string, Promise<NavRevealFlags>>();
/**
 * When each key was last resolved. Two problems, one solution:
 *  • a consumer that mounts LATER (the mobile nav lives at a different
 *    breakpoint, the header remounts on some routes) used to fire its own
 *    request because the in-flight map was already cleared — that is exactly how
 *    this hook ended up making 4 calls per load;
 *  • but caching forever would freeze the nav: the whole point of
 *    reveal-on-relevance is that the nav GROWS when the first payment settles,
 *    so a merchant navigating around after that should see the row appear.
 * A 60s freshness window fixes both, and it mirrors the backend's own 60s Redis
 * cache — so a refetch inside the window would have been served from Redis anyway.
 */
const resolvedAt = new Map<string, number>();
const FRESH_MS = 60_000;
const isFresh = (key: string) => Date.now() - (resolvedAt.get(key) ?? 0) < FRESH_MS;
/** Listeners so all mounted consumers re-render together when flags land. */
const listeners = new Set<(key: string, flags: NavRevealFlags) => void>();

const readSession = (companyKey: string): NavRevealFlags | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(companyKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      receipts: !!parsed?.receipts,
      customers: !!parsed?.customers,
      developers: !!parsed?.developers,
    };
  } catch {
    return null;
  }
};

const writeSession = (companyKey: string, flags: NavRevealFlags) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(companyKey), JSON.stringify(flags));
  } catch {
    /* private mode / quota — the in-memory cache still holds for this page */
  }
};

/** OR-merge: once true, always true for the session (constraint 2). */
const merge = (a: NavRevealFlags, b: NavRevealFlags): NavRevealFlags => ({
  receipts: a.receipts || b.receipts,
  customers: a.customers || b.customers,
  developers: a.developers || b.developers,
});

const fetchFlags = (companyKey: string, companyId: string | number | null): Promise<NavRevealFlags> => {
  const existing = inFlight.get(companyKey);
  if (existing) return existing;
  // Already fetched for this key recently — the cache is the answer.
  if (isFresh(companyKey)) {
    return Promise.resolve(memoryCache.get(companyKey) ?? readSession(companyKey) ?? EMPTY);
  }

  const request = (async (): Promise<NavRevealFlags> => {
    try {
      const res = await axios.get("dashboard/action-counts", {
        params: companyId ? { company_id: companyId } : {},
      });
      const payload = res?.data?.data ?? res?.data;
      const raw = payload?.nav_reveal;
      const next: NavRevealFlags = {
        receipts: !!raw?.receipts,
        customers: !!raw?.customers,
        developers: !!raw?.developers,
      };
      const merged = merge(memoryCache.get(companyKey) ?? readSession(companyKey) ?? EMPTY, next);
      memoryCache.set(companyKey, merged);
      resolvedAt.set(companyKey, Date.now());
      writeSession(companyKey, merged);
      listeners.forEach((fn) => fn(companyKey, merged));
      return merged;
    } catch {
      // Reveal nothing extra — the core rows are never gated on this call.
      // `resolvedAt` is deliberately NOT stamped: a transient failure should be
      // retryable on the next navigation rather than hiding rows for 60s.
      const fallback = memoryCache.get(companyKey) ?? readSession(companyKey) ?? EMPTY;
      memoryCache.set(companyKey, fallback);
      listeners.forEach((fn) => fn(companyKey, fallback));
      return fallback;
    } finally {
      inFlight.delete(companyKey);
    }
  })();

  inFlight.set(companyKey, request);
  return request;
};

const useNavReveal = (): NavRevealState => {
  const { companyList, selectedCompanyId, fetched } = useCompanyStore();
  const companyKey = String(selectedCompanyId ?? "all");
  const hasCompanies = Array.isArray(companyList) && companyList.length > 0;

  const [flags, setFlags] = useState<NavRevealFlags>(
    () => memoryCache.get(companyKey) ?? readSession(companyKey) ?? EMPTY,
  );
  const [ready, setReady] = useState<boolean>(
    () => memoryCache.has(companyKey) || readSession(companyKey) !== null,
  );

  useEffect(() => {
    let cancelled = false;

    // Re-render this consumer when ANY consumer's fetch resolves for our key.
    const listener = (key: string, next: NavRevealFlags) => {
      if (cancelled || key !== companyKey) return;
      setFlags(next);
      setReady(true);
    };
    listeners.add(listener);

    // Paint immediately from the session/memory cache (no flash of a short nav
    // for a merchant who already revealed rows earlier in this session).
    const cached = memoryCache.get(companyKey) ?? readSession(companyKey);
    if (cached) {
      setFlags(cached);
      setReady(true);
      memoryCache.set(companyKey, cached);
    }

    // Wait for the account selection to SETTLE before spending a request.
    // CompanyDataContext flips `fetched` as soon as the list arrives and resolves
    // `selectedCompanyId` in a follow-up effect, so firing on `fetched` alone
    // produced an unscoped call immediately followed by a scoped one.
    if (fetched && selectedCompanyId != null) {
      fetchFlags(companyKey, selectedCompanyId).then((next) => {
        if (cancelled) return;
        setFlags(next);
        setReady(true);
      });
    } else if (fetched && !hasCompanies) {
      // No account yet => nothing can be revealed. Skip the request entirely.
      setReady(true);
    }

    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, [companyKey, selectedCompanyId, fetched, hasCompanies]);

  return { ...flags, ready };
};

export default useNavReveal;
export { useNavReveal };
