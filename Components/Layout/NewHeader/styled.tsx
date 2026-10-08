import { styled } from "@mui/material";
import { DARK } from "@/constants/theme";

export const HeaderContainer = styled("div")(({ theme }) => ({
  height: "100%",
  top: 0,
  zIndex: 999,
  width: "100%",
  boxShadow: "none",
  background: "transparent",
  display: "flex",
  alignItems: "stretch",
  gap: 0,
}));

/**
 * Brand cell — exactly as wide as the sidebar (240px, or the 72px rail) so the
 * wordmark sits above the nav and the header's right part aligns with the page.
 */
export const LogoContainer = styled("div")(({ theme }) => ({
  height: "100%",
  width: "var(--dp-sidebar-w, 240px)",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "0 20px",
  overflow: "hidden",
  // The brand cell is the top of the dark-brown rail (both modes) — on-dark lockup only.
  background: DARK.raised,
  borderRight: `1px solid ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.18)"}`,
  marginBottom: -1,
  transition: "width 220ms cubic-bezier(0.16, 1, 0.3, 1)",

  // Phones have no sidebar, so no brand cell (the brand switcher leads the bar).
  "@media (max-width:599.95px)": {
    display: "none",
  },

  ".logo": {
    cursor: "pointer",
    userSelect: "none",
    height: 34,
    width: "auto",
  },
  ".logo-mark": {
    display: "none",
    cursor: "pointer",
    lineHeight: 0,
  },
  '[data-sidebar-collapsed="true"] &, &[data-rail="true"]': {
    padding: 0,
    justifyContent: "center",
    ".logo": { display: "none" },
    ".logo-mark": { display: "block" },
  },
}));

export const MainContainer = styled("div")(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  background: "transparent",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  // Mirror the content column (max-width + 32px gutters, centred) so the brand
  // switcher and the right-hand controls line up with the page edges at every
  // width, incl. ultra-wide (§8.1).
  paddingLeft: "max(32px, calc((100vw - var(--dp-sidebar-w, 240px) - var(--dp-content-max, 1440px)) / 2))",
  paddingRight: "max(32px, calc((100vw - var(--dp-sidebar-w, 240px) - var(--dp-content-max, 1440px)) / 2))",

  "@media (max-width:1023.95px)": {
    padding: "0 12px 0 16px",
  },
  "@media (max-width:599.95px)": {
    padding: "0 4px 0 8px",
    gap: "4px",
  },
}));

export const RightSection = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    gap: "2px",
  },
}));

export const RequiredKYC = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "9px 12px",
  borderRadius: "6px",
  border: "1px solid",
  cursor: "pointer",
  background: theme.palette.background.paper,
  color: theme?.palette?.border?.main,
}));

export const RequiredKYCText = styled("span")(({ theme }) => ({
  color: theme.palette.error.main,
  paddingLeft: "4px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  fontSize: "15px",
  lineHeight: "1.2",
  letterSpacing: "0",
  fontFamily: "var(--font-sans)",
}));
