/**
 * RouteTransitionLoader — Emergent-style full-screen loading overlay that
 * shows a pulsing Dynopay logo while the Next.js router is transitioning
 * between pages.
 *
 * Behaviour:
 *  - Hooks into router events (routeChangeStart/Complete/Error).
 *  - SKIPS shallow route changes and query-only changes on the same path
 *    (e.g. table filters/pagination) — those keep the thin NProgress bar only.
 *  - Anti-flicker: the overlay only appears if the transition takes longer
 *    than SHOW_DELAY_MS, and once visible it stays for at least
 *    MIN_VISIBLE_MS so it never strobes for a single frame.
 *  - Theme-aware: near-black Dynopay logo on a light glass backdrop, white
 *    logo on a dark glass backdrop (matches HomeHeader logo logic).
 *  - SSR-safe: renders null until a client-side router event fires.
 */
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Box from "@mui/material/Box";
import { keyframes } from "@emotion/react";

import DynopayBlackLogo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import DynopayWhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import { useThemeMode } from "@/contexts/ThemeContext";

const SHOW_DELAY_MS = 250; // don't show for near-instant transitions
const MIN_VISIBLE_MS = 350; // once shown, keep visible at least this long
const FADE_OUT_MS = 240; // graceful fade-out so the hand-off "flows" into the page

const overlayFadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const logoBreath = keyframes`
  0%   { opacity: 0.35; transform: scale(0.96); }
  50%  { opacity: 1;    transform: scale(1.03); }
  100% { opacity: 0.35; transform: scale(0.96); }
`;

const stripPath = (url: string): string => (url || "").split(/[?#]/)[0];

const RouteTransitionLoader: React.FC = () => {
  const router = useRouter();
  const { isDark } = useThemeMode();
  const [visible, setVisible] = useState(false);
  // "leaving" keeps the overlay mounted while it fades out, so the loader
  // hands off smoothly to the freshly rendered page instead of hard-cutting.
  const [leaving, setLeaving] = useState(false);

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAtRef = useRef<number>(0);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };

    const handleStart = (url: string, opts?: { shallow?: boolean }) => {
      if (opts?.shallow) return; // filters/pagination via shallow routing
      // Query-only change on the same page (e.g. ?page=2) — keep it subtle,
      // the NProgress bar already covers it.
      if (stripPath(url) === stripPath(router.asPath)) return;

      clearTimers();
      setLeaving(false);
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
    };

    // Fade the overlay out, then unmount it.
    const beginFadeOut = () => {
      setLeaving(true);
      fadeTimerRef.current = setTimeout(() => {
        fadeTimerRef.current = null;
        setVisible(false);
        setLeaving(false);
      }, FADE_OUT_MS);
    };

    const handleDone = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      setVisible((current) => {
        if (!current) return false;
        const elapsed = Date.now() - shownAtRef.current;
        if (elapsed >= MIN_VISIBLE_MS) {
          beginFadeOut();
        } else if (!hideTimerRef.current) {
          hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            beginFadeOut();
          }, MIN_VISIBLE_MS - elapsed);
        }
        return true;
      });
    };

    const handleError = () => {
      clearTimers();
      setVisible(false);
      setLeaving(false);
    };

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleError);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleError);
      clearTimers();
    };
    // router.asPath is read inside handleStart via closure; re-subscribe when
    // it changes so the query-only comparison always uses the current path.
  }, [router.events, router.asPath]);

  if (!visible) return null;

  const logoSrc = isDark ? DynopayWhiteLogo : DynopayBlackLogo;

  return (
    <Box
      data-testid="route-transition-loader"
      role="status"
      aria-label="Loading"
      aria-live="polite"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark
          ? "rgba(8, 8, 10, 0.88)"
          : "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: `${overlayFadeIn} 180ms ease-out`,
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        pointerEvents: leaving ? "none" : "all",
      }}
    >
      <Box
        component="img"
        src={(logoSrc as { src?: string })?.src || (logoSrc as unknown as string)}
        alt="Dynopay"
        sx={{
          width: { xs: 130, sm: 150 },
          height: "auto",
          animation: `${logoBreath} 1.4s ease-in-out infinite`,
          willChange: "opacity, transform",
          userSelect: "none",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            opacity: 0.9,
          },
        }}
        draggable={false}
      />
    </Box>
  );
};

export default RouteTransitionLoader;
