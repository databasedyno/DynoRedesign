// Small utility to carry a one-time notice across a redirect to /auth/login,
// so we can tell returning users WHY they're back on the login screen
// (e.g. their session timed out, or a password-reset link was invalid).
// Uses sessionStorage so it survives a full page reload (same tab) and is
// consumed exactly once.

export const AUTH_NOTICE_KEY = "dp_auth_notice";

export type AuthNotice = "session_expired" | "reset_invalid";

export const setAuthNotice = (notice: AuthNotice): void => {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
    }
  } catch {
    /* sessionStorage may be unavailable (private mode / SSR) — safe to ignore */
  }
};

// Reads and clears the notice (one-time consume).
export const takeAuthNotice = (): AuthNotice | null => {
  try {
    if (typeof window === "undefined") return null;
    const value = window.sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (value) window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return (value as AuthNotice) || null;
  } catch {
    return null;
  }
};
