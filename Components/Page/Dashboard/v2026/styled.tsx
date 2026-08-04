import { Box, IconButton, styled } from "@mui/material";
import { CB_TOKENS } from "../coinbase/styled";

/**
 * v2026 dashboard primitives — built on top of the shared CB_TOKENS design
 * system (the same indigo-accented, theme-aware token set the rest of the
 * dashboard uses) so the new command-center stays visually consistent.
 */
export { CB_TOKENS };

/** StatCard — compact KPI tile used across the KPI strip. */
export const StatCard = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  borderRadius: 18,
  padding: theme.spacing(2.25),
  minWidth: 0,
  overflow: "hidden",
  backgroundColor:
    theme.palette.mode === "dark"
      ? CB_TOKENS.surface.dark
      : CB_TOKENS.surface.light,
  border: `1px solid ${
    theme.palette.mode === "dark" ? CB_TOKENS.border.dark : CB_TOKENS.border.light
  }`,
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 1px 0 rgba(255,255,255,0.02) inset"
      : "0 1px 3px rgba(10,10,15,0.04)",
  transition: "border-color 200ms ease, transform 200ms ease",
  "&:hover": {
    borderColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.16)"
        : "rgba(10,10,15,0.16)",
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.75),
    borderRadius: 16,
  },
}));

/** GhostIconButton — hairline-bordered icon button for command-bar controls. */
export const GhostIconButton = styled(IconButton)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: 12,
  color:
    theme.palette.mode === "dark"
      ? CB_TOKENS.ink.secondaryDark
      : CB_TOKENS.ink.secondaryLight,
  border: `1px solid ${
    theme.palette.mode === "dark" ? CB_TOKENS.border.dark : CB_TOKENS.border.light
  }`,
  backgroundColor:
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.02)"
      : "rgba(10,10,15,0.02)",
  "&:hover": {
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.06)"
        : "rgba(10,10,15,0.05)",
    color:
      theme.palette.mode === "dark"
        ? CB_TOKENS.ink.primaryDark
        : CB_TOKENS.ink.primaryLight,
  },
}));

/** SectionTitle — section / card heading. */
export const SectionTitle = styled(Box)(({ theme }) => ({
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: -0.2,
  color:
    theme.palette.mode === "dark"
      ? CB_TOKENS.ink.primaryDark
      : CB_TOKENS.ink.primaryLight,
}));
