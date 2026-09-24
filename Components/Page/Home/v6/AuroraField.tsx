import React, { memo } from "react";
import { Box } from "@mui/material";
import { keyframes } from "@mui/system";

/* Slow, transform-only drift (GPU-cheap; no filter:blur — iOS paint stall). */
const driftA = keyframes`0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(-4%,4%,0) scale(1.08)}`;
const driftB = keyframes`0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(3%,-3%,0) scale(1.06)}`;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const glow = (bg: string, anim: ReturnType<typeof keyframes>, dur: number, pos: object, size: object) => ({
  position: "absolute" as const,
  borderRadius: "50%",
  background: bg,
  willChange: "transform",
  animation: `${anim} ${dur}s ease-in-out infinite alternate`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
  ...pos,
  ...size,
});

/**
 * Hero ground — solid dark brown in BOTH themes (the brand anchor), one subtle
 * gold glow bleeding in from the top-right corner, and a fine grain.
 * No tiles, squares or grids; static under reduced motion.
 */
const AuroraField: React.FC<{ testId?: string }> = ({ testId = "aurora-field" }) => (
  <Box
    aria-hidden
    data-testid={testId}
    sx={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
      background: "linear-gradient(180deg, #121214 0%, #0F1013 70%, #101014 100%)",
    }}
  >
    <Box sx={glow("radial-gradient(circle, rgba(255,209,0,0.34) 0%, rgba(255,209,0,0.14) 32%, transparent 66%)", driftA, 28, { top: "-42%", right: "-14%" }, { width: { xs: 720, md: 1180 }, height: { xs: 720, md: 1180 } })} />
    <Box sx={glow("radial-gradient(circle, rgba(255,179,0,0.26) 0%, rgba(255,179,0,0.10) 34%, transparent 68%)", driftB, 34, { top: "-18%", right: "10%" }, { width: { xs: 520, md: 860 }, height: { xs: 520, md: 860 } })} />
    <Box sx={{ position: "absolute", inset: 0, opacity: 0.085, mixBlendMode: "screen", backgroundImage: NOISE }} />
  </Box>
);

export default memo(AuroraField);
