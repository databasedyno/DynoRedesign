import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { FONT_HERO, FONT_TECH, FONT_BODY } from "./theme.v3";

// Common section shell — max-width 1280, 3rem side padding on desktop.
export const SectionShell = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  paddingTop: theme.spacing(10),
  paddingBottom: theme.spacing(10),
  [theme.breakpoints.down("md")]: {
    paddingTop: theme.spacing(7),
    paddingBottom: theme.spacing(7),
  },
}));

// Eyebrow — small monospace tag above section headings.
export const Eyebrow = styled(Typography)<{ tone?: "coral" | "violet" | "volt" | "ink" }>(
  ({ tone = "coral" }) => ({
    fontFamily: FONT_TECH,
    fontSize: 11,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    fontWeight: 500,
    color:
      tone === "coral"
        ? "#FF5B49"
        : tone === "violet"
        ? "#7C5CFF"
        : tone === "volt"
        ? "#5A6B00"
        : "#0A0A0A",
  })
);

// Editorial huge headline — Unbounded.
export const HeadlineXL = styled(Typography)(({ theme }) => ({
  fontFamily: FONT_HERO,
  fontWeight: 700,
  fontSize: "clamp(40px, 6.5vw, 88px)",
  lineHeight: 0.98,
  letterSpacing: "-0.035em",
  color: "#0A0A0A",
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(36px, 10vw, 56px)",
  },
}));

// Section headline — 40-56px range.
export const HeadlineL = styled(Typography)(({ theme }) => ({
  fontFamily: FONT_HERO,
  fontWeight: 700,
  fontSize: "clamp(30px, 4vw, 52px)",
  lineHeight: 1.02,
  letterSpacing: "-0.03em",
  color: "#0A0A0A",
  [theme.breakpoints.down("sm")]: {
    fontSize: "clamp(28px, 8vw, 40px)",
  },
}));

// Body copy in landing.
export const Body = styled(Typography)(() => ({
  fontFamily: FONT_BODY,
  fontSize: 17,
  lineHeight: 1.55,
  color: "#3F3F46",
}));

// Aurora ink — text with the aurora gradient fill.
export const AuroraInk = styled("span")(() => ({
  background: "linear-gradient(135deg, #FF5B49 0%, #7C5CFF 55%, #4FD1FF 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
}));
