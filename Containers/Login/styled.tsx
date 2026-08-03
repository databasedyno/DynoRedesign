import { Box, Card, styled } from "@mui/material";

/* ─────────────────────────────────────────────────────────────
 * Dynopay Auth Shell — "Coinbase-clean" (2025-07 pass)
 *
 * User feedback: the old "Aurora Glass" split-screen felt busy —
 * bento marketing panel on the left + glass card on the right +
 * mesh drift + noise grain + subtle grid. Merchants coming in to
 * sign in don't need a marketing pitch, they need a fast path
 * to their dashboard.
 *
 * This file now emits a Coinbase-style single centered card on
 * a plain background: no mesh, no grain, no grid, no slide-in
 * animation. AuthBrandPanel is still exported but no longer
 * rendered by login.tsx / register.tsx.
 * ───────────────────────────────────────────────────────────── */

/** Full-viewport canvas: plain background, centers its content. */
export const AuthPageBackground = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    width: "100%",
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    boxSizing: "border-box",
    background: dark ? "#0B0B0F" : "#FFFFFF",
    [theme.breakpoints.down("sm")]: { padding: "24px 16px" },
  };
});

/** Single centered column (no side panel). */
export const SplitLayoutWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  maxWidth: 440,
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

/** Clean form card — subtle border in light, subtle raised in dark. */
export const FormPanel = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    width: "100%",
    maxWidth: 440,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    padding: "40px 40px 32px",
    borderRadius: 16,
    background: dark ? "#141419" : "#FFFFFF",
    border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,15,20,0.08)"}`,
    boxShadow: dark
      ? "0 1px 2px rgba(0,0,0,0.4)"
      : "0 1px 2px rgba(15,15,20,0.04)",
    [theme.breakpoints.down("sm")]: {
      padding: "28px 22px 24px",
      borderRadius: 14,
      border: "none",
      boxShadow: "none",
      background: "transparent",
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
    background: dark ? "#0B0B0F" : "#FFFFFF",
    [theme.breakpoints.down("sm")]: { gap: "16px", padding: "32px 16px" },
  };
});

/** Glass card used by reset-password (kept same clean look). */
export const CardWrapper = styled(Card)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    width: "100%",
    maxWidth: 440,
    height: "fit-content",
    borderRadius: 16,
    padding: "12px",
    background: dark ? "#141419" : "#FFFFFF",
    textAlign: "center",
    border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,15,20,0.08)"}`,
    boxShadow: dark
      ? "0 1px 2px rgba(0,0,0,0.4)"
      : "0 1px 2px rgba(15,15,20,0.04)",
    [theme.breakpoints.down("sm")]: {
      padding: "10px",
      borderRadius: 14,
      border: "none",
      boxShadow: "none",
      background: "transparent",
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
  background: theme.palette.mode === "dark" ? "#0B0B0F" : "#FFFFFF",
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
