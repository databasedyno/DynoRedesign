import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

// ─── Configuration ───
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;       // 15 minutes total
const WARNING_BEFORE_MS = 2 * 60 * 1000;       // Show warning 2 min before
const WARNING_AT_MS = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS; // 13 minutes
const COUNTDOWN_TICK_MS = 1000;

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

const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/blog/")) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
};

/**
 * Global idle-timeout manager.
 *
 * Mounted once in _app.tsx. Watches for user inactivity on
 * authenticated pages. After 13 min idle → shows warning with
 * countdown. After 15 min idle → hard sign-out.
 */
const IdleTimeoutManager: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_MS / 1000));

  // Refs to hold timer IDs so we can clear across renders
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true); // track if component should be active

  // ─── Sign-out logic ───
  const forceSignOut = useCallback(() => {
    // Clear all tokens
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");

    // Clean up timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Redirect to login
    window.location.href = "/auth/login";
  }, []);

  // ─── Start / Reset timers ───
  const resetTimers = useCallback(() => {
    // Don't reset if we're not active
    if (!isActiveRef.current) return;

    // Only run when a token exists (user is authenticated)
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    // Clear existing timers
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    // Hide warning if it was showing
    setShowWarning(false);
    setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000));

    // Timer 1: show warning at 13 min
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.floor(WARNING_BEFORE_MS / 1000));

      // Start countdown
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, COUNTDOWN_TICK_MS);
    }, WARNING_AT_MS);

    // Timer 2: force sign-out at 15 min
    logoutTimerRef.current = setTimeout(() => {
      forceSignOut();
    }, IDLE_TIMEOUT_MS);
  }, [forceSignOut]);

  // ─── "Stay Signed In" handler ───
  const handleStayActive = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  // ─── Determine if timer should be active ───
  useEffect(() => {
    const pathname = router.pathname;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const shouldBeActive = !!token && !isPublicPath(pathname);
    isActiveRef.current = shouldBeActive;

    if (!shouldBeActive) {
      // Clean up timers on public pages or when logged out
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowWarning(false);
      return;
    }

    // Active: set up event listeners and start timers
    const onActivity = () => {
      // If the warning modal is showing, don't reset on background activity
      // (user must explicitly click "Stay Signed In")
      if (!showWarning) {
        resetTimers();
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    resetTimers();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname, resetTimers]);

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
