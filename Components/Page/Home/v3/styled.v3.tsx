import { Box, Typography, TypographyProps } from "@mui/material";
import { styled } from "@mui/material/styles";
import { FONT_HERO, FONT_TECH, FONT_BODY } from "./theme.v3";

// Common section shell — max-width 1280, generous side padding on desktop.
export const SectionShell = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  paddingTop: theme.spacing(14),
  paddingBottom: theme.spacing(14),
  [theme.breakpoints.down("md")]: {
    paddingTop: theme.spacing(9),
    paddingBottom: theme.spacing(9),
  },
}));

// Eyebrow — small monospace tag above section headings.
// Minimal palette: decorative tone variants collapse to the indigo accent;
// only `ink` (neutral grey) is preserved for occasional muted usage.
// NOTE: `"coral"` is kept as an alias for `"indigo"` for API back-compat
// (2026-07-28 rename — see theme.v3.ts).
export const Eyebrow = styled(Typography)<{ tone?: "indigo" | "coral" | "violet" | "volt" | "ink" }>(
  ({ tone = "indigo", theme }) => ({
    fontFamily: FONT_TECH,
    fontSize: 11,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    fontWeight: 500,
    color:
      tone === "ink"
        ? theme.palette.text.secondary
        : theme.palette.mode === "dark"
          ? "#818CF8"
          : "#4F46E5",
  })
);

// Editorial huge headline — Unbounded. Theme-aware so it never disappears in dark.
// Cast to `TypographyProps` so `component="h1"` etc. keep their polymorphic
// prop type after `styled()` wrapping. Without this MUI's styled() collapses
// the polymorphic type and TS rejects `component` on the resulting component.
export const HeadlineXL = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontFamily: FONT_HERO,
  fontWeight: 700,
  fontSize: "clamp(40px, 6.5vw, 88px)",
  lineHeight: 0.98,
  letterSpacing: "-0.035em",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(36px, 10vw, 56px)",
  },
}));

// Section headline — 40-56px range. Theme-aware.
export const HeadlineL = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontFamily: FONT_HERO,
  fontWeight: 700,
  fontSize: "clamp(30px, 4vw, 52px)",
  lineHeight: 1.02,
  letterSpacing: "-0.03em",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(28px, 8vw, 40px)",
  },
}));

// Sub-section headline — 24-28px. Used for policy page section titles,
// blog post subheadings, QA category labels. Theme-aware.
export const HeadlineS = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontFamily: FONT_HERO,
  fontWeight: 700,
  fontSize: "clamp(20px, 2vw, 24px)",
  lineHeight: 1.2,
  letterSpacing: "-0.015em",
  color: theme.palette.text.primary,
}));

// Body copy in landing. Theme-aware secondary text.
export const Body = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontFamily: FONT_BODY,
  fontSize: 17,
  lineHeight: 1.55,
  color: theme.palette.text.secondary,
}));

// Emphasis ink — a single indigo statement word (single-accent doctrine).
// Brightens on dark so the accent word stays vivid.
export const AuroraInk = styled("span")(({ theme }) => ({
  color: theme.palette.mode === "dark" ? "#818CF8" : "#4F46E5",
}));
