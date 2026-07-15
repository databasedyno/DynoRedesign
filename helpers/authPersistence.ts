/**
 * Login persistence — "Remember me" / "Keep me signed in".
 *
 * The backend always issues a 7-day token. This helper controls how long the token
 * survives on THIS browser:
 *
 *  - remember = true  → persistent. Token stays in localStorage and survives browser
 *    restarts for the full 7-day lifetime.
 *  - remember = false → session-only. The token still lives in localStorage (so the
 *    app's many `localStorage.getItem("token")` readers keep working unchanged), but a
 *    sessionStorage "alive" sentinel is written. sessionStorage is wiped when the
 *    browser/tab session ends, so on the next cold boot the sentinel is gone and we
 *    clear the token → the user must sign in again.
 *
 * Note: session-only is scoped to the browser session. Opening the app in a brand-new
 * window after fully closing the browser requires a fresh login (by design).
 */
const PERSIST_KEY = "auth_persistent"; // localStorage: "1" = remember, "0" = session-only
const ALIVE_KEY = "auth_alive"; // sessionStorage sentinel (present = session is alive)

/** Record the user's Remember-me choice at login time. */
export const applyPersistence = (remember: boolean) => {
  if (typeof window === "undefined") return;
  try {
    if (remember) {
      localStorage.setItem(PERSIST_KEY, "1");
      sessionStorage.removeItem(ALIVE_KEY);
    } else {
      localStorage.setItem(PERSIST_KEY, "0");
      sessionStorage.setItem(ALIVE_KEY, "1");
    }
  } catch {
    /* storage unavailable (private mode etc.) — fail open */
  }
};

/** Clear persistence bookkeeping (call alongside logout). */
export const clearPersistence = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PERSIST_KEY);
    sessionStorage.removeItem(ALIVE_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Enforce session-only expiry on app boot. Returns false (and clears the token) when a
 * session-only login is being resumed after the browser was closed. Idempotent — safe
 * to call on every client render.
 */
export const enforceSessionPersistence = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const token = localStorage.getItem("token");
    if (!token) return true; // nothing to enforce

    const persistent = localStorage.getItem(PERSIST_KEY);
    // Remember mode, or legacy/OAuth logins with no flag → always keep.
    if (persistent !== "0") return true;

    // Session-only: keep while the sentinel is alive; otherwise expire.
    if (sessionStorage.getItem(ALIVE_KEY) === "1") return true;

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem(PERSIST_KEY);
    return false;
  } catch {
    return true;
  }
};
