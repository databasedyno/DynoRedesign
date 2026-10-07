import React from "react";
import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useMotionOK, EASE_OUT } from "../motion/tokens";

/* ============================================================================
 * Landing v8 — "Bybit-tier" premium fintech design + motion system (2026-10).
 *
 * The public homepage is rebuilt from scratch to the visual/motion quality of a
 * top exchange site: LIGHT-FIRST, airy, high-contrast sections punctuated by
 * NEAR-BLACK data/mockup panels with a gold glow. These are the reusable
 * building blocks (tokens, Reveal, Section, GradientText, Eyebrow, SectionHead)
 * the rest of the marketing site will inherit in later phases.
 *
 * Primitives (PrimaryBtn/SecondaryBtn/ArrowLink/goStart/useConsole) and the
 * font CSS vars are reused from the shared v7 kit so chrome stays consistent.
 * ========================================================================== */

export {
  FONT_DISPLAY,
  FONT_BODY,
  FONT_MONO,
  GOLD,
  GOLD_HOVER,
  ON_GOLD,
  ArrowLink,
  goStart,
  useConsole,
} from "../v7/kit";

import { FONT_DISPLAY, FONT_BODY, FONT_MONO, useConsole, PrimaryBtn as BasePrimaryBtn, SecondaryBtn as BaseSecondaryBtn } from "../v7/kit";

/* v8 buttons: same flat gold / hairline recipes as v7, pill geometry (matches the header CTA). */
export const PrimaryBtn: typeof BasePrimaryBtn = ({ sx, ...rest }) => (
  <BasePrimaryBtn {...rest} sx={{ borderRadius: "999px", px: 3, ...sx }} />
);
export const SecondaryBtn: typeof BaseSecondaryBtn = ({ sx, ...rest }) => (
  <BaseSecondaryBtn {...rest} sx={{ borderRadius: "999px", px: 3, ...sx }} />
);

/* ── Fixed dark-panel palette (used for data/mockup panels in BOTH themes) ─── */
export const PANEL = {
  bg: "#0B0B0A",
  bg2: "#121210",
  surface: "rgba(255,255,255,0.045)",
  surfaceStrong: "rgba(255,255,255,0.07)",
  line: "rgba(255,255,255,0.09)",
  lineStrong: "rgba(255,255,255,0.18)",
  ink: "#F6F6F3",
  ink2: "#ABABA5",
  ink3: "#6F6F6B",
  gold: "#FFD100",
  goldSoft: "rgba(255,209,0,0.12)",
  green: "#34D399",
  greenSoft: "rgba(52,211,153,0.14)",
  red: "#F87171",
} as const;

/* Signature gold gradient — reserved for a single highlighted word / accent. */
export const GOLD_GRAD = "linear-gradient(118deg, #FFE55C 0%, #FFD100 46%, #F5A800 100%)";

/* Soft glow + faint grid used behind dark panels for depth. */
export const PANEL_GLOW =
  "radial-gradient(60% 70% at 72% 18%, rgba(255,209,0,0.20), transparent 62%), radial-gradient(50% 60% at 15% 90%, rgba(255,209,0,0.08), transparent 60%)";
export const GRID_BG =
  "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)";

/* ── Reveal: scroll-triggered entrance; SSR-safe + reduced-motion aware ───── */
interface RevealProps {
  children: React.ReactNode;
  y?: number;
  delay?: number;
  duration?: number;
  once?: boolean;
  sx?: object;
  id?: string;
  testId?: string;
}
export const Reveal: React.FC<RevealProps> = ({
  children,
  y = 22,
  delay = 0,
  duration = 0.6,
  once = true,
  sx,
  id,
  testId,
}) => {
  const ok = useMotionOK();
  if (!ok) {
    return (
      <Box id={id} data-testid={testId} sx={sx}>
        {children}
      </Box>
    );
  }
  return (
    <Box
      id={id}
      data-testid={testId}
      component={motion.div}
      sx={sx}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "0px 0px -10% 0px" }}
      transition={{ duration, ease: EASE_OUT, delay }}
    >
      {children}
    </Box>
  );
};

/* ── GradientText: the one gold-gradient highlight in a headline ──────────── */
export const GradientText: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box
    component="span"
    sx={{
      background: GOLD_GRAD,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      WebkitTextFillColor: "transparent",
      ...sx,
    }}
  >
    {children}
  </Box>
);

/* ── Section wrapper: light (theme canvas) or a fixed dark data panel ─────── */
interface SectionProps {
  id?: string;
  testId?: string;
  dark?: boolean;
  /** Add the glow backdrop (dark sections only). */
  glow?: boolean;
  maxWidth?: number;
  sx?: object;
  innerSx?: object;
  children: React.ReactNode;
}
export const SectionV8: React.FC<SectionProps> = ({
  id,
  testId,
  dark = false,
  glow = false,
  maxWidth = 1200,
  sx,
  innerSx,
  children,
}) => {
  const s = useConsole();
  return (
    <Box
      component="section"
      id={id}
      data-testid={testId}
      sx={{
        position: "relative",
        background: dark ? PANEL.bg : s.canvas,
        color: dark ? PANEL.ink : s.ink,
        overflow: "hidden",
        py: { xs: 8, md: 13 },
        scrollMarginTop: "80px",
        ...sx,
      }}
    >
      {dark && glow ? (
        <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, pointerEvents: "none" }} />
      ) : null}
      <Box sx={{ position: "relative", zIndex: 1, maxWidth, mx: "auto", px: { xs: 3, md: 6 }, ...innerSx }}>
        {children}
      </Box>
    </Box>
  );
};

/* ── MockPanelV8: dark glowing plinth that frames a hero product mockup ───── */
export const MockPanelV8: React.FC<{ children: React.ReactNode; maxWidth?: number; testId?: string }> = ({
  children,
  maxWidth = 480,
  testId,
}) => (
  <Box data-testid={testId} sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
    <Box aria-hidden sx={{ position: "absolute", inset: "-8% -4%", borderRadius: "28px", background: PANEL_GLOW, pointerEvents: "none" }} />
    <Box sx={{ position: "relative", width: "100%", maxWidth, borderRadius: "28px", p: { xs: 2.5, md: 4 }, background: "linear-gradient(170deg, #171715 0%, #0B0B0A 100%)", border: `1px solid ${PANEL.lineStrong}`, boxShadow: "0 50px 120px -30px rgba(0,0,0,0.6)" }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: GRID_BG, backgroundSize: "26px 26px", maskImage: "radial-gradient(70% 70% at 50% 40%, #000 20%, transparent 75%)", WebkitMaskImage: "radial-gradient(70% 70% at 50% 40%, #000 20%, transparent 75%)", opacity: 0.7 }} />
      <Box sx={{ position: "relative" }}>{children}</Box>
    </Box>
  </Box>
);

/* ── Eyebrow: small uppercase mono tag with a gold tick ───────────────────── */
export const EyebrowV8: React.FC<{ children: React.ReactNode; dark?: boolean; sx?: object }> = ({
  children,
  dark = false,
  sx,
}) => {
  const s = useConsole();
  const color = dark ? PANEL.gold : s.accent;
  return (
    <Typography
      component="p"
      sx={{
        fontFamily: FONT_MONO,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color,
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        ...sx,
      }}
    >
      <Box component="span" sx={{ width: 18, height: 2, borderRadius: 2, background: color, opacity: 0.7 }} />
      {children}
    </Typography>
  );
};

/* ── SectionHead: eyebrow → h2 → lead; centered option for hero-style bands ─ */
interface SectionHeadProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
  dark?: boolean;
  maxWidth?: number;
  testId?: string;
  sx?: object;
}
export const SectionHeadV8: React.FC<SectionHeadProps> = ({
  eyebrow,
  title,
  lead,
  center = false,
  dark = false,
  maxWidth = 720,
  testId,
  sx,
}) => {
  const s = useConsole();
  const ink = dark ? PANEL.ink : s.ink;
  const ink2 = dark ? PANEL.ink2 : s.ink2;
  return (
    <Box
      data-testid={testId}
      sx={{
        maxWidth,
        mx: center ? "auto" : 0,
        textAlign: center ? "center" : "left",
        mb: { xs: 5, md: 7 },
        ...sx,
      }}
    >
      {eyebrow ? (
        <EyebrowV8 dark={dark} sx={{ mb: 2.5, ...(center ? { justifyContent: "center" } : {}) }}>
          {eyebrow}
        </EyebrowV8>
      ) : null}
      <Typography
        component="h2"
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 600,
          fontSize: { xs: 30, md: 44 },
          lineHeight: 1.08,
          letterSpacing: "-0.028em",
          color: ink,
        }}
      >
        {title}
      </Typography>
      {lead ? (
        <Typography
          sx={{
            fontFamily: FONT_BODY,
            color: ink2,
            fontSize: { xs: 16, md: 18 },
            lineHeight: 1.65,
            mt: 2.5,
            mx: center ? "auto" : 0,
            maxWidth: center ? 620 : "none",
          }}
        >
          {lead}
        </Typography>
      ) : null}
    </Box>
  );
};
