import { Box, styled, Typography } from "@mui/material";

export const FixedBottomWrapper = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  right: 0,
  padding: theme.spacing(1.5),
  background: "transparent",
  zIndex: 999,
}));

export const PageHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  // Narrow screens: actions wrap under the title at a consistent 12px gap
  // (was a fixed 64px offset that floated them arbitrarily).
  [theme.breakpoints.down("md")]: {
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
  },
}));

// Not pinned (§8.3): the large title scrolls away and a compact title bar
// (CompactTitleBar) slides in, so phones keep ≥ 75% of the screen for content.
export const MainPageHeader = styled(Box)(({ theme }) => ({
  position: "relative",
  backgroundColor: theme.palette.secondary.main,
  display: "flex",
  flexDirection: "column",
}));

export const PageHeaderTitle = styled(Typography)(({ theme }) => ({
  fontSize: "28px",
  fontWeight: 700,
  color: theme.palette.text.primary,
  fontFamily: "var(--font-hero), var(--font-sans)",
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
  [theme.breakpoints.down("md")]: {
    fontSize: "24px",
  },
}));

export const PageHeaderDescription = styled(Typography)(({ theme }) => ({
  fontSize: "15px",
  fontWeight: 400,
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
  fontFamily: "var(--font-sans)",
  paddingLeft: 0,
  maxWidth: "72ch",
  [theme.breakpoints.down("md")]: {
    fontSize: "14px",
  },
}));
