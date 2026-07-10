import { Box, Card, styled } from "@mui/material";

/* ─────────────────────────────────────────────────────────────
 * DynoPay Auth Shell — "Floating Glass Bento"
 * Void-black (dark) / frosty-silver (light) canvas with an animated
 * gradient mesh + fine grain, a floating glass form card, and a
 * bento marketing column. Colors are driven by the scoped authTheme.
 * ───────────────────────────────────────────────────────────── */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const meshBg = (dark: boolean) =>
  dark
    ? "radial-gradient(42% 44% at 14% 18%, rgba(204,255,0,0.14) 0%, transparent 62%), radial-gradient(50% 50% at 84% 88%, rgba(204,255,0,0.07) 0%, transparent 62%)"
    : "radial-gradient(42% 44% at 14% 18%, rgba(184,230,0,0.20) 0%, transparent 62%), radial-gradient(50% 50% at 84% 88%, rgba(184,230,0,0.10) 0%, transparent 62%)";

const gridBg = (dark: boolean) => {
  const line = dark ? "rgba(255,255,255,0.045)" : "rgba(10,10,10,0.045)";
  return `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`;
};

/** Full-viewport canvas: mesh + grain, centers its content. */
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
    overflow: "hidden",
    background: dark ? "#060606" : "#EEF1F6",
    backgroundImage: gridBg(dark),
    backgroundSize: "54px 54px",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "-25%",
      background: meshBg(dark),
      filter: "blur(30px)",
      animation: "authMeshDrift 24s ease-in-out infinite alternate",
      pointerEvents: "none",
      zIndex: 0,
    },
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      backgroundImage: GRAIN,
      backgroundSize: "140px 140px",
      opacity: dark ? 0.05 : 0.035,
      mixBlendMode: dark ? "overlay" : "multiply",
      pointerEvents: "none",
      zIndex: 1,
    },
    "@keyframes authMeshDrift": {
      "0%": { transform: "translate3d(0,0,0) scale(1)" },
      "100%": { transform: "translate3d(-4%, 3%, 0) scale(1.1)" },
    },
    [theme.breakpoints.down("sm")]: { padding: "24px 16px" },
  };
});

/** Centered row: bento column (left) + glass form card (right). */
export const SplitLayoutWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 1180,
  margin: "0 auto",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 64,
  [theme.breakpoints.down("lg")]: {
    flexDirection: "column",
    gap: 0,
    maxWidth: 480,
  },
}));

/** The floating glass form card. */
export const FormPanel = styled(Box)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    position: "relative",
    zIndex: 3,
    flex: "0 1 468px",
    width: "100%",
    maxWidth: 468,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    padding: "40px 40px 34px",
    borderRadius: 18,
    background: dark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.72)",
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)"}`,
    boxShadow: dark
      ? "0 40px 120px -24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)"
      : "0 40px 120px -34px rgba(31,41,55,0.38), inset 0 1px 0 rgba(255,255,255,0.9)",
    animation: "authCardIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
    "@keyframes authCardIn": {
      "0%": { opacity: 0, transform: "translateY(26px) scale(0.985)" },
      "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
    },
    [theme.breakpoints.down("lg")]: { flex: "1 1 auto", maxWidth: 480 },
    [theme.breakpoints.down("sm")]: {
      padding: "26px 20px 24px",
      borderRadius: 16,
      background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.86)",
    },
  };
});

/** Legacy brand-panel export (kept for import compatibility). */
export const BrandPanel = styled(Box)(({ theme }) => ({
  flex: "1 1 50%",
  maxWidth: "50%",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  [theme.breakpoints.down("lg")]: { display: "none" },
}));

/* ── reset-password / simpler screens ─────────────────────────
 * AuthContainer paints the same full-viewport canvas and centers a
 * column of glass CardWrappers. */
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
    overflow: "hidden",
    background: dark ? "#060606" : "#EEF1F6",
    backgroundImage: gridBg(dark),
    backgroundSize: "54px 54px",
    "&::before": {
      content: '""',
      position: "absolute",
      inset: "-25%",
      background: meshBg(dark),
      filter: "blur(30px)",
      animation: "authMeshDrift 24s ease-in-out infinite alternate",
      pointerEvents: "none",
      zIndex: 0,
    },
    "& > *": { position: "relative", zIndex: 2 },
    "@keyframes authMeshDrift": {
      "0%": { transform: "translate3d(0,0,0) scale(1)" },
      "100%": { transform: "translate3d(-4%, 3%, 0) scale(1.1)" },
    },
    [theme.breakpoints.down("sm")]: { gap: "16px", padding: "32px 16px" },
  };
});

/** Glass card used by reset-password. */
export const CardWrapper = styled(Card)(({ theme }) => {
  const dark = theme.palette.mode === "dark";
  return {
    width: "100%",
    maxWidth: 468,
    height: "fit-content",
    borderRadius: 18,
    padding: "12px",
    background: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.78)",
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
    textAlign: "center",
    border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)"}`,
    boxShadow: dark
      ? "0 40px 120px -24px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.07)"
      : "0 40px 120px -34px rgba(31,41,55,0.38), inset 0 1px 0 rgba(255,255,255,0.9)",
    animation: "authCardIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
    "@keyframes authCardIn": {
      "0%": { opacity: 0, transform: "translateY(26px) scale(0.985)" },
      "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
    },
    [theme.breakpoints.down("sm")]: { padding: "10px", borderRadius: 16 },
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
  background: theme.palette.mode === "dark" ? "#060606" : "#EEF1F6",
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
