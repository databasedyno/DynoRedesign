/**
 * Login persistence — "Remember me" / "Keep me signed in".
 *
 * The backend always issues a 7-day token. This helper controls how long the token
 * survives on THIS browser:
 *
 *  - remember = true  → persistent. Token stays in localStorage and survives browser
 *    restarts for the full 7-day lifetime.
 *  - remember = false → session-only. The token still lives in localStorage (so the
 *    app's many `localStorage.getItem("token")` readers keep working unchanged), but
 *    it is only kept while the BROWSER is open. "Browser open" is tracked with a
 *    heartbeat timestamp in localStorage (shared across tabs) that every open tab
 *    refreshes on a short interval. On a cold boot with a stale heartbeat the token
 *    is cleared → the user signs in again.
 *
 * Why a localStorage heartbeat instead of a sessionStorage sentinel: sessionStorage
 * is PER-TAB, so a brand-new tab has an empty sentinel and used to force a re-login
 * even while the user was clearly still logged in in another tab (bug #11). A shared
 * heartbeat is visible to every tab in the same browser session, so new tabs stay
 * signed in, while a fully-closed browser lets the heartbeat go stale and expire.
 */
const PERSIST_KEY = "auth_persistent"; // localStorage: "1" = remember, "0" = session-only
const HEARTBEAT_KEY = "auth_heartbeat"; // localStorage timestamp (ms), refreshed by open tabs
const LEGACY_ALIVE_KEY = "auth_alive"; // old per-tab sessionStorage sentinel (cleaned up)

// A tab refreshes the heartbeat every HEARTBEAT_INTERVAL_MS. On boot we treat the
// session as still alive if the last heartbeat is within GRACE_MS — comfortably
// larger than the interval (and than background-tab timer throttling) so a new tab
// or a quick reload never trips a false logout.
const HEARTBEAT_INTERVAL_MS = 20 * 1000;
const GRACE_MS = 90 * 1000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const isSessionOnly = (): boolean => {
  try {
    return localStorage.getItem(PERSIST_KEY) === "0";
  } catch {
    return false;
  }
};

const touchHeartbeat = () => {
  try {
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — ignore */
  }
};

/** Record the user's Remember-me choice at login time. */
export const applyPersistence = (remember: boolean) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LEGACY_ALIVE_KEY);
    if (remember) {
      localStorage.setItem(PERSIST_KEY, "1");
      localStorage.removeItem(HEARTBEAT_KEY);
      stopSessionHeartbeat();
    } else {
      localStorage.setItem(PERSIST_KEY, "0");
      touchHeartbeat();
      startSessionHeartbeat();
    }
  } catch {
    /* storage unavailable (private mode etc.) — fail open */
  }
};

/** Clear persistence bookkeeping (call alongside logout). */
export const clearPersistence = () => {
  if (typeof window === "undefined") return;
  stopSessionHeartbeat();
  try {
    localStorage.removeItem(PERSIST_KEY);
    localStorage.removeItem(HEARTBEAT_KEY);
    sessionStorage.removeItem(LEGACY_ALIVE_KEY);
  } catch {
    /* ignore */
  }
};

/** Stop the heartbeat interval + listeners. */
export const stopSessionHeartbeat = () => {
  if (typeof window === "undefined") return;
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  window.removeEventListener("focus", touchHeartbeat);
};

/**
 * Keep the shared "browser is open" heartbeat fresh while a session-only login is
 * active. Idempotent — safe to call on every boot/route change. No-op for
 * persistent ("remember me") or legacy/OAuth logins.
 */
export const startSessionHeartbeat = () => {
  if (typeof window === "undefined") return;
  if (!isSessionOnly()) return;
  touchHeartbeat();
  window.addEventListener("focus", touchHeartbeat);
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    try {
      if (localStorage.getItem("token") && isSessionOnly()) {
        touchHeartbeat();
      } else {
        stopSessionHeartbeat();
      }
    } catch {
      /* ignore */
    }
  }, HEARTBEAT_INTERVAL_MS);
};

/**
 * Enforce session-only expiry on app boot. Returns false (and clears the token) when a
 * session-only login is being resumed after the browser was closed (stale heartbeat).
 * Idempotent — safe to call on every client render / new tab.
 */
export const enforceSessionPersistence = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const token = localStorage.getItem("token");
    if (!token) return true; // nothing to enforce

    // Remember mode, or legacy/OAuth logins with no flag → always keep.
    if (!isSessionOnly()) return true;

    // Session-only: alive if any tab refreshed the heartbeat recently.
    const raw = localStorage.getItem(HEARTBEAT_KEY);
    const last = raw ? parseInt(raw, 10) : 0;
    if (last && Date.now() - last <= GRACE_MS) {
      // Still within the same browser session (this or another tab) → keep it
      // going so subsequent tabs also stay signed in.
      touchHeartbeat();
      startSessionHeartbeat();
      return true;
    }

    // No / stale heartbeat → the browser was closed → expire the session-only login.
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem(PERSIST_KEY);
    localStorage.removeItem(HEARTBEAT_KEY);
    return false;
  } catch {
    return true;
  }
};
