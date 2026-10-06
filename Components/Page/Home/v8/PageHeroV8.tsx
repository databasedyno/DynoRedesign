import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { EyebrowV8, FONT_BODY, FONT_DISPLAY, GRID_BG, Reveal, useConsole } from "./kit";

/* ============================================================================
 * PageHeroV8 — reusable centered hero for inner marketing pages (fees, products,
 * product detail). Light-first with a soft gold glow + faint grid floor, so
 * every page reads as one premium system. (The homepage uses its own HeroV8.)
 * ========================================================================== */

interface Props {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  note?: React.ReactNode;
  testId?: string;
  maxWidth?: number;
}

const PageHeroV8: React.FC<Props> = ({ eyebrow, title, body, actions, note, testId, maxWidth = 820 }) => {
  const s = useConsole();
  return (
    <Box
      component="section"
      data-testid={testId}
      sx={{ position: "relative", background: s.canvas, color: s.ink, overflow: "hidden", pt: { xs: 7, md: 11 }, pb: { xs: 7, md: 11 } }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -160,
          left: "50%",
          transform: "translateX(-50%)",
          width: 760,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,209,0,0.16), transparent 62%)",
          pointerEvents: "none",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: GRID_BG,
          backgroundSize: "44px 44px",
          opacity: s.dark ? 0.5 : 0.35,
          maskImage: "radial-gradient(80% 70% at 50% 0%, #000, transparent 72%)",
          WebkitMaskImage: "radial-gradient(80% 70% at 50% 0%, #000, transparent 72%)",
          filter: s.dark ? "none" : "invert(1)",
          pointerEvents: "none",
        }}
      />
      <Reveal sx={{ position: "relative", zIndex: 1, maxWidth, mx: "auto", px: { xs: 3, md: 6 }, textAlign: "center" }}>
        {eyebrow ? (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5 }}>
            <EyebrowV8>{eyebrow}</EyebrowV8>
          </Box>
        ) : null}
        <Typography
          component="h1"
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: "clamp(34px, 5vw, 60px)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: s.ink,
          }}
        >
          {title}
        </Typography>
        {body ? (
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.62, mt: 3, maxWidth: 640, mx: "auto" }}>
            {body}
          </Typography>
        ) : null}
        {actions ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mt: 4.5 }}>{actions}</Box>
        ) : null}
        {note ? (
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink3, fontSize: 13.5, mt: 3 }}>{note}</Typography>
        ) : null}
      </Reveal>
    </Box>
  );
};

export default memo(PageHeroV8);
