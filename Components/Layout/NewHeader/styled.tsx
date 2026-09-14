import { styled } from "@mui/material";

export const HeaderContainer = styled("div")(({ theme }) => ({
  height: "100%",
  top: 0,
  zIndex: 999,
  width: "100%",
  boxShadow: "none",
  background: "transparent",
  display: "flex",
  alignItems: "stretch",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    gap: "4px",
  },
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
  padding: "0 24px",
  overflow: "hidden",
  borderRight: `1px solid ${theme.palette.border.main}`,
  transition: "width 220ms cubic-bezier(0.16, 1, 0.3, 1)",

  [theme.breakpoints.down("lg")]: {
    display: "none",
  },

  ".logo": {
    cursor: "pointer",
    userSelect: "none",
    height: 26,
    width: "auto",
  },
  '[data-sidebar-collapsed="true"] &, &[data-rail="true"]': {
    padding: 0,
    justifyContent: "center",
    ".logo": { height: 20 },
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
  padding: "0 24px 0 16px",

  [theme.breakpoints.down("lg")]: {
    padding: "0 8px 0 4px",
  },
  [theme.breakpoints.down("sm")]: {
    padding: "0 4px 0 0",
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
