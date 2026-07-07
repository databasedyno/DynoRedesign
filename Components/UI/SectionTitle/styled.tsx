import { Box, Typography, styled } from "@mui/material";

/**
 * SectionTitle — cleaned up 2026-07-05 to reduce visual noise across landing +
 * SEO pages. Two changes:
 *   1. `Badge`  → no more pill/background. Now a small uppercase eyebrow label
 *                 (Stripe / Linear / Vercel pattern).
 *   2. `HighlightText` → no more blue→purple gradient with transparent fill.
 *                 Now a solid primary-color span so headings stay legible and
 *                 the page doesn't feel like it's trying to sell you a brochure.
 * All the widths / sizes / breakpoints below are unchanged, so no page layout
 * shifts. Only the *treatment* of the badge + highlight change.
 */

export const Wrapper = styled(Box)(() => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  "&[data-align='start']": {
    alignItems: "flex-start",
    textAlign: "left",
  },
}));

export const Badge = styled(Box)(({ theme }) => ({
  textAlign: "center",
  width: "fit-content",
  fontSize: 12,
  lineHeight: "16px",
  letterSpacing: "1.6px",
  textTransform: "uppercase",
  fontWeight: 600,
  fontFamily: "OutfitMedium",
  color: theme.palette.text.secondary,
  backgroundColor: "transparent",
  padding: 0,
  borderRadius: 0,
  alignSelf: "center",
  marginBottom: 4,
  "&[data-align='start']": {
    alignSelf: "flex-start",
    textAlign: "left",
  },
}));

export const Heading = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontFamily: "'Unbounded', 'OutfitMedium', system-ui, sans-serif",
  color: theme.palette.text.primary,
  padding: "0 15px",
  textAlign: "center",
  letterSpacing: "-0.02em",
  "&[data-align='start']": {
    textAlign: "left",
  },

  "&[data-type='large']": {
    fontSize: "48px",
    lineHeight: "56px",
    maxWidth: 720,
    marginTop: "16px",
    marginBottom: "12px",
  },

  "&[data-type='small']": {
    fontSize: "32px",
    lineHeight: "40px",
    maxWidth: "auto",
    marginTop: "12px",
    marginBottom: "12px",
  },

  [theme.breakpoints.down("md")]: {
    "&[data-type='large']": {
      fontSize: "36px",
      lineHeight: "42px",
    },
    "&[data-type='small']": {
      fontSize: "28px",
      lineHeight: "34px",
    },
  },
}));

export const SubText = styled(Typography)(({ theme }) => ({
  padding: 0,
  fontWeight: 400,
  letterSpacing: "0px !important",
  fontFamily: "OutfitRegular",
  color: theme.palette.text.secondary,
  textAlign: "center",
  display: "block",
  "&[data-align='start']": {
    textAlign: "left",
  },

  "&[data-type='large']": {
    fontSize: "18px",
    lineHeight: "28px",
    maxWidth: 560,
  },

  "&[data-type='small']": {
    fontSize: "16px",
    lineHeight: "24px",
    maxWidth: 576,
  },

  [theme.breakpoints.down("md")]: {
    "&[data-type='large']": {
      fontSize: "17px",
      lineHeight: "26px",
    },
    "&[data-type='small']": {
      fontSize: "16px",
      lineHeight: "24px",
    },
  },
}));

/**
 * HighlightText — used inside `title` to emphasize a phrase. Was a
 * background-clip gradient (0004FF → 6A4DFF). Replaced with a solid
 * primary color to reduce the "brochure gradient text" look that made
 * every section title read as marketing noise.
 */
export const HighlightText = styled("span")(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 500,
  // Keep the following overrides so any lingering global background-clip
  // rules from the old gradient don't leak through:
  background: "none",
  WebkitBackgroundClip: "initial",
  WebkitTextFillColor: "currentcolor",
  backgroundClip: "initial",
}));
