import { Box, styled } from "@mui/material";
import { DARK } from "@/constants/theme";

/** Solid phone tab bar (§8.1): 56px + safe area, hairline on top, hides on scroll-down / input focus. */
export const TabBar = styled("nav", {
  shouldForwardProp: (prop) => prop !== "hidden$",
})<{ hidden$?: boolean }>(({ theme, hidden$ }) => ({
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1100,
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  alignItems: "stretch",
  height: "calc(56px + env(safe-area-inset-bottom, 0px))",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  paddingLeft: "env(safe-area-inset-left, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
  backgroundColor: theme.palette.mode === "dark" ? DARK.surface : theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.10)"}`,
  transform: hidden$ ? "translateY(110%)" : "translateY(0)",
  transition: "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

export const TabButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(({ theme, active }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    all: "unset",
    boxSizing: "border-box",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    minWidth: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    lineHeight: 1.2,
    fontWeight: active ? 700 : 500,
    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
    "& .tab-pill": {
      width: 52,
      height: 28,
      borderRadius: 999,
      display: "grid",
      placeItems: "center",
      backgroundColor: active ? (isDark ? "rgba(255,209,0,0.18)" : "rgba(255,209,0,0.32)") : "transparent",
      transition: "background-color 160ms ease",
    },
    "&:focus-visible .tab-pill": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 1 },
  };
});

export const TabDot = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: 4,
  right: "calc(50% - 20px)",
  minWidth: 8,
  height: 8,
  borderRadius: 999,
  backgroundColor: "#E11D48",
  border: `2px solid ${theme.palette.mode === "dark" ? DARK.surface : theme.palette.background.paper}`,
}));

export const SheetGroupLabel = styled("div")(({ theme }) => ({
  padding: "16px 16px 6px",
  fontFamily: "var(--font-sans)",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));

export const SheetRow = styled("button", {
  shouldForwardProp: (prop) => prop !== "active" && prop !== "tone",
})<{ active?: boolean; tone?: "danger" }>(({ theme, active, tone }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    all: "unset",
    boxSizing: "border-box",
    width: "100%",
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "8px 16px",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    fontSize: "15px",
    fontWeight: active ? 700 : 500,
    color: tone === "danger" ? theme.palette.error.main : theme.palette.text.primary,
    backgroundColor: active ? (isDark ? "rgba(255,209,0,0.10)" : "rgba(255,209,0,0.16)") : "transparent",
    WebkitTapHighlightColor: "transparent",
    transition: "background-color 140ms ease",
    "&:active": { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.05)" },
    "&:focus-visible": { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: "-2px" },
    "& .row-label": { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  };
});
