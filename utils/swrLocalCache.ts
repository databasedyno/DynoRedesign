import type { Cache } from "swr";

/**
 * F2 — cross-visit SWR cache persisted to localStorage (stale-while-revalidate).
 *
 * Dashboard/company/wallet data lived only in memory, so every visit showed
 * skeletons while the same payload was re-fetched (the backend already Redis-
 * caches it). This provider hydrates SWR synchronously from localStorage on
 * mount so repeat visits paint instantly with the last-known values, then SWR
 * revalidates in the background (Stripe/Coinbase-style).
 *
 * Safety for a live payment app:
 *   - Namespaced PER USER (decoded from the JWT) so one merchant can never see
 *     another merchant's cached company/wallet data on a shared browser.
 *   - Other users' cache blobs are purged on init.
 *   - Hydration is skipped for blobs older than MAX_AGE_MS so we never paint
 *     very stale money figures — SWR revalidates immediately regardless.
 *   - No-ops on the server (returns a fresh Map).
 */

const VERSION = "v1";
const PREFIX = `dynopay-swr-cache-${VERSION}:`;
// Only hydrate a persisted snapshot if it's fresh enough. Beyond this we start
// empty and let SWR fetch — avoids flashing very stale balances.
const MAX_AGE_MS = 5 * 60 * 1000;

function currentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return payload?.user_id != null ? String(payload.user_id) : null;
  } catch {
    return null;
  }
}

export function localStorageProvider(): Cache {
  const map = new Map<string, any>();
  if (typeof window === "undefined") return map as unknown as Cache;

  const uid = currentUserId();
  const key = uid ? PREFIX + uid : null;

  // Purge any OTHER user's (or legacy) persisted caches to prevent cross-user
  // leakage and unbounded localStorage growth.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== key) localStorage.removeItem(k);
    }
  } catch {
    /* ignore quota / access errors */
  }

  if (!key) return map as unknown as Cache; // logged out — pure in-memory

  // Hydrate this user's fresh snapshot.
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.savedAt === "number" &&
        Date.now() - parsed.savedAt < MAX_AGE_MS &&
        Array.isArray(parsed.entries)
      ) {
        for (const [k, v] of parsed.entries) map.set(k, v);
      }
    }
  } catch {
    /* corrupt blob — ignore, start empty */
  }

  const persist = () => {
    try {
      const uidNow = currentUserId();
      if (!uidNow) return; // don't write after logout
      const keyNow = PREFIX + uidNow;
      const entries = Array.from(map.entries());
      localStorage.setItem(keyNow, JSON.stringify({ savedAt: Date.now(), entries }));
    } catch {
      /* quota exceeded / serialisation error — best-effort only */
    }
  };

  window.addEventListener("beforeunload", persist);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });

  return map as unknown as Cache;
}

export default localStorageProvider;
