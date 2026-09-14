import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

// ─── Configuration ───
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;       // 15 minutes total
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // Show warning 2 min before
const WARNING_AT_MS = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS; // 13 minutes
const COUNTDOWN_TICK_MS = 1000;
const ACTIVITY_PERSIST_THROTTLE_MS = 5000;     // write localStorage at most every 5s
const LAST_ACTIVITY_KEY = "last_activity_ts";
const PERSIST_KEY = "auth_persistent"; // must match helpers/authPersistence.ts

// Events that count as "user activity"
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "mousemove",
  "click",
];

// Pages where the idle timer should NOT run (public / unauthenticated)
const PUBLIC_PATH_PREFIXES = [
  "/auth",
  "/reset-password",
  "/pay/",
  "/pay",
  "/payment",
  "/admin/login",
];
const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/fees",
  "/terms-conditions",
  "/privacy-policy",
  "/aml-policy",
  "/system-status",
  "/documentation",
  "/blog",
]);

export const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/blog/")) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
};

/**
 * Global idle-timeout manager.
 *
 * Mounted once in _app.tsx. Watches for user inactivity on authenticated
 * pages. After 13 min idle → warning with countdown ("Stay signed in?").
 * After 15 min idle → hard sign-out.
 *
 * IMPLEMENTATION NOTES (rewritten session 10):
 * - TIMESTAMP-BASED, not timer-only: browsers throttle/suspend timers in
 *   background tabs, so wall-clock elapsed time is checked against a
 *   persisted `last_activity_ts` (localStorage) on focus/visibility/mount.
 *   This means: user leaves the app and returns <15 min later → warning
 *   modal with the REMAINING countdown; returns ≥15 min later (even after a
 *   tab close/reopen or laptop sleep) → signed out immediately.
 * - Fixes the old stale-closure bug where any mousemove instantly dismissed
 *   the warning before the user could see it (activity is ignored while the
 *   warning is visible — the user must click "Stay signed in").
 */
const IdleTimeoutManager: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_MS / 1000));

  // Refs to hold timer IDs / state so handlers never see stale values
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);
  const showWarningRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const lastPersistRef = useRef<number>(0);

  const clearTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  };

  const setWarningVisible = (visible: boolean) => {
    showWarningRef.current = visible;
    setShowWarning(visible);
  };

  const persistActivity = (ts: number, force = false) => {
    if (!force && ts - lastPersistRef.current < ACTIVITY_PERSIST_THROTTLE_MS) return;
    lastPersistRef.current = ts;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(ts));
    } catch {
      /* storage unavailable — in-memory tracking still works */
    }
  };

  const readPersistedActivity = (): number | null => {
    try {
      const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
      const n = raw ? parseInt(raw, 10) : NaN;
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  // ─── Sign-out logic ───
  const forceSignOut = useCallback(() => {
    // Clear all tokens
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    try {
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    } catch {}

    clearTimers();

    // Redirect to login
    window.location.href = "/auth/login";
  }, []);

  // ─── Show the warning modal with the true remaining time ───
  const openWarning = useCallback((msUntilLogout: number) => {
    clearTimers();
    setWarningVisible(true);
    setSecondsLeft(Math.max(1, Math.ceil(msUntilLogout / 1000)));

    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, COUNTDOWN_TICK_MS);

    logoutTimerRef.current = setTimeout(() => {
      forceSignOut();
    }, msUntilLogout);
  }, [forceSignOut]);

  // ─── Arm timers based on wall-clock elapsed idle time ───
  const armTimers = useCallback(() => {
    if (!isActiveRef.current) return;
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const elapsed = Date.now() - lastActivityRef.current;

    // Already past the hard limit (e.g. suspended tab, reopened page) → out.
    if (elapsed >= IDLE_TIMEOUT_MS) {
      forceSignOut();
      return;
    }

    // Inside the warning window → show the modal with remaining time.
    if (elapsed >= WARNING_AT_MS) {
      openWarning(IDLE_TIMEOUT_MS - elapsed);
      return;
    }

    // Normal case: schedule warning + logout for the REMAINING time.
    clearTimers();
    setWarningVisible(false);
    setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000));

    warningTimerRef.current = setTimeout(() => {
      openWarning(IDLE_TIMEOUT_MS - (Date.now() - lastActivityRef.current));
    }, WARNING_AT_MS - elapsed);

    logoutTimerRef.current = setTimeout(() => {
      // Re-check wall clock in case timers drifted
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) forceSignOut();
      else armTimers();
    }, IDLE_TIMEOUT_MS - elapsed);
  }, [forceSignOut, openWarning]);

  // ─── "Stay Signed In" handler ───
  const handleStayActive = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    persistActivity(now, true);
    setWarningVisible(false);
    armTimers();
  }, [armTimers]);

  // ─── Determine if timer should be active ───
  useEffect(() => {
    const pathname = router.pathname;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    // Session 56 fix: honour the "Keep me signed in for 7 days" preference.
    // The backend issues a 7-day JWT (see sessionService.ts) and the login
    // form's Remember-me checkbox defaults to CHECKED. When the user opts
    // for a persistent session, forcing a hard sign-out after 15 min of
    // idle activity contradicts the promise on the login screen — users
    // report they "get signed out after leaving the tab open overnight"
    // even though they asked to stay signed in for a week.
    //
    // Behaviour:
    //   * remember-me ON  (auth_persistent === "1" or missing): idle
    //     timeout is DISABLED. Session lives for the full 7-day JWT window.
    //     `enforceSessionPersistence()` (helpers/authPersistence.ts) still
    //     clears the token if the actual JWT expires, and the 401 flow in
    //     axiosConfig.ts handles genuine backend revocation.
    //   * remember-me OFF (auth_persistent === "0"): idle timeout stays
    //     ON as before — matches the "session-only" contract.
    let rememberMe = true;
    try {
      rememberMe = localStorage.getItem(PERSIST_KEY) !== "0";
    } catch {
      /* private mode — assume remember-me on */
    }
    const shouldBeActive = !!token && !isPublicPath(pathname) && !rememberMe;
    isActiveRef.current = shouldBeActive;

    if (!shouldBeActive) {
      clearTimers();
      setWarningVisible(false);
      return;
    }

    // Seed from the persisted timestamp (fresh page load / tab reopen):
    // if the user has been away ≥15 min the token is expired for UX purposes.
    const persisted = readPersistedActivity();
    const now = Date.now();
    if (persisted && persisted <= now) {
      lastActivityRef.current = persisted;
    } else {
      lastActivityRef.current = now;
      persistActivity(now, true);
    }

    const onActivity = () => {
      // While the warning modal is showing, background activity must NOT
      // dismiss it — the user has to explicitly click "Stay signed in".
      if (showWarningRef.current) return;
      const ts = Date.now();
      lastActivityRef.current = ts;
      persistActivity(ts);
    };

    // On return to the tab, evaluate real elapsed time (timers may have been
    // throttled or suspended while hidden).
    const onReturn = () => {
      if (document.visibilityState === "hidden") return;
      if (showWarningRef.current) {
        // Warning already visible — re-sync remaining time from wall clock.
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) forceSignOut();
        return;
      }
      armTimers();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    armTimers();

    // Re-arm periodically from activity (cheap: timers are only rescheduled
    // when the warning fires or on return; activity itself just updates the
    // timestamp — the warning callback recomputes remaining time from it).
    const rearmInterval = setInterval(() => {
      if (!showWarningRef.current) armTimers();
    }, 60_000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      clearInterval(rearmInterval);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, armTimers, forceSignOut]);

  // ─── Format seconds into mm:ss ───
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // ─── Don't render anything if warning is not shown ───
  if (!showWarning) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        backdropFilter: "blur(2px)",
      }}
    >
      <Box
        data-testid="idle-timeout-warning"
        sx={{
          bgcolor: "background.paper",
          borderRadius: "16px",
          p: 4,
          maxWidth: 420,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Warning Icon */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            bgcolor: "warning.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 2,
          }}
        >
          <Typography sx={{ fontSize: "28px" }}>&#9200;</Typography>
        </Box>

        <Typography
          sx={{
            fontSize: "18px",
            fontWeight: 700,
            fontFamily: "var(--font-sans), sans-serif",
            mb: 1,
            color: "text.primary",
          }}
        >
          {t("idleTimeoutTitle")}
        </Typography>

        <Typography
          sx={{
            fontSize: "14px",
            fontFamily: "var(--font-sans), sans-serif",
            mb: 1,
            color: "text.secondary",
            lineHeight: 1.6,
          }}
        >
          {t("idleTimeoutMessage")}
        </Typography>

        {/* Countdown */}
        <Typography
          sx={{
            fontSize: "32px",
            fontWeight: 700,
            fontFamily: "var(--font-sans), monospace",
            color: secondsLeft <= 30 ? "error.main" : "warning.main",
            mb: 3,
            letterSpacing: 2,
          }}
        >
          {formatTime(secondsLeft)}
        </Typography>

        {/* Action buttons */}
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
          <Box
            component="button"
            onClick={forceSignOut}
            sx={{
              bgcolor: "transparent",
              color: "text.secondary",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "10px",
              p: "10px 24px",
              fontSize: "14px",
              fontFamily: "var(--font-sans), sans-serif",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {t("signOutNow")}
          </Box>

          <Box
            component="button"
            onClick={handleStayActive}
            data-testid="stay-signed-in-btn"
            sx={{
              bgcolor: "primary.main",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              p: "10px 24px",
              fontSize: "14px",
              fontFamily: "var(--font-sans), sans-serif",
              cursor: "pointer",
              transition: "all 0.2s",
              "&:hover": { opacity: 0.9 },
            }}
          >
            {t("staySignedIn")}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default IdleTimeoutManager;
