import { Box, Card, styled } from "@mui/material";
import { GRAIN_URL } from "@/constants/creatorTheme";

/* ─────────────────────────────────────────────────────────────
 * Dynopay Auth Shell — "Editorial glass" (2026-09 pass)
 *
 * Shared frame for every auth + onboarding screen (login, register,
 * reset-password, accept-invite, reset-2fa, secure-account). Matches the
 * creator / storefront / donation redesign: ambient gold + aqua glow on a
 * solid canvas, fine film grain, a glassmorphic form card with a soft top
 * accent bloom, tactile 12px inputs with a gold focus ring, and a staggered
 * rise-in. Auth logic lives in the pages — this file is presentation only.
 * ───────────────────────────────────────────────────────────── */

const GOLD = "rgba(255,209,0,";
const AQUA = "rgba(43,212,196,";

const canvas = (dark: boolean) =>
  dark
    ? `radial-gradient(56% 46% at 84% 6%, ${GOLD}0.16) 0%, transparent 70%),
       radial-gradient(46% 42% at 6% 94%, ${GOLD}0.12) 0%, transparent 70%),
       radial-gradient(34% 30% at 52% 58%, ${AQUA}0.07) 0%, transparent 72%),
       #0A0A0D`
    : `radial-gradient(56% 46% at 84% 6%, ${GOLD}0.24) 0%, transparent 70%),
       radial-gradient(46% 42% at 6% 94%, ${GOLD}0.18) 0%, transparent 70%),
       radial-gradient(34% 30% at 52% 58%, ${AQUA}0.10) 0%, transparent 72%),
       #F5F7FA`;

export const AUTH_RISE_KEYFRAMES = {
  "@keyframes authRise": {
    from: { opacity: 0, transform: "translateY(14px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
};

export const authRise = (delayMs = 0) => ({
  animation: `authRise 520ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

/** Full-viewport canvas: ambient accent glow + grain, centers its content. */
export const AuthPageBackground = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    width: "100%",
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    boxSizing: "border-box",
    overflowX: "clip",
    background: canvas(dark),
    ...AUTH_RISE_KEYFRAMES,
    "&::before": {
      content: '""',
      position: "absolute",
      inset: 0,
      backgroundImage: GRAIN_URL,
      opacity: dark ? 0.07 : 0.05,
      mixBlendMode: "overlay",
      pointerEvents: "none",
    },
    [theme.breakpoints.down("sm")]: {
      alignItems: "flex-start",
      padding: "24px 14px 28px",
    },
  };
});

/** Single centered column (no side panel). */
export const SplitLayoutWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  maxWidth: 460,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
  },
}));

/** Split-screen wrapper (login + register): form left, editorial brand panel right on lg+. */
export const SplitScreenWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  maxWidth: 460,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
  [theme.breakpoints.up("lg")]: {
    maxWidth: 1180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "64px",
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
  },
}));

/** Left column: holds the form card (+ mobile trust strip) in the split view. */
export const SplitFormColumn = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 460,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flexShrink: 0,
  [theme.breakpoints.up("lg")]: {
    alignItems: "stretch",
  },
}));

const glassCard = (dark: boolean) => ({
  background: dark
    ? "linear-gradient(180deg, rgba(24,24,31,0.86) 0%, rgba(18,18,22,0.80) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 100%)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(18,18,20,0.06)"}`,
  boxShadow: dark
    ? "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
    : "0 20px 50px rgba(139,94,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
});

/** Auth-scoped input polish: 12px tactile fields + gold focus ring (leaves the global InputField untouched). */
const authInputs = (dark: boolean) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px !important",
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease",
  },
  "& .MuiOutlinedInput-root.Mui-focused": {
    boxShadow: `0 0 0 3px ${dark ? "rgba(255,209,0,0.22)" : "rgba(255,209,0,0.32)"}`,
  },
  "& .MuiOutlinedInput-root.Mui-focused fieldset": {
    borderColor: `${dark ? "#FFD100" : "#C79A00"} !important`,
  },
});

/** Glass form card — the one surface every auth screen renders into. */
export const FormPanel = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    overflow: "hidden",
    width: "100%",
    maxWidth: 460,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    padding: "40px 40px 34px",
    borderRadius: 24,
    ...glassCard(dark),
    ...authRise(0),
    ...authInputs(dark),
    // Soft accent bloom at the top edge of the card.
    "&::before": {
      content: '""',
      position: "absolute",
      top: -140,
      left: "50%",
      width: 420,
      height: 260,
      transform: "translateX(-50%)",
      background: `radial-gradient(ellipse at center, ${GOLD}${dark ? "0.20" : "0.16"}) 0%, transparent 70%)`,
      pointerEvents: "none",
      zIndex: 0,
    },
    "& > *": { position: "relative", zIndex: 1 },
    [theme.breakpoints.down("sm")]: {
      padding: "26px 20px 24px",
      borderRadius: 20,
    },
  };
});

/** Legacy brand-panel export (kept for import compatibility). */
export const BrandPanel = styled(Box)(() => ({
  display: "none",
}));

/* ── reset-password / simpler screens ───────────────────────── */
export const AuthContainer = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    width: "100%",
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "20px",
    padding: "48px 24px",
    boxSizing: "border-box",
    background: canvas(dark),
    ...AUTH_RISE_KEYFRAMES,
    [theme.breakpoints.down("sm")]: { gap: "16px", padding: "32px 16px" },
  };
});

/** Glass card used by reset-password (same treatment as FormPanel). */
export const CardWrapper = styled(Card)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    width: "100%",
    maxWidth: 460,
    height: "fit-content",
    borderRadius: 24,
    padding: "12px",
    textAlign: "center",
    ...glassCard(dark),
    ...authRise(0),
    ...authInputs(dark),
    [theme.breakpoints.down("sm")]: {
      padding: "10px",
      borderRadius: 20,
    },
  };
});

export const ImageCenter = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  cursor: "pointer",
}));

/* ── Legacy exports (kept so older imports never break) ──────── */
export const LoginWrapper = styled(Box)(({ theme }) => ({
  background: canvas(theme.palette.mode === "dark"),
  width: "100%",
  minHeight: "100dvh",
  position: "relative",
  overflow: "auto",
}));

export const ContentWrapper = styled(Box)(() => ({
  position: "relative",
  zIndex: 20,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "40px 16px",
  minHeight: "100dvh",
  boxSizing: "border-box",
}));
