import React, { memo } from "react";
import { Box } from "@mui/material";
import { keyframes } from "@mui/system";
import { useAurora } from "../v3/theme.v3";

/* Slow, transform-only drift (GPU-cheap; no filter:blur — iOS paint stall). */
const driftA = keyframes`0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(6%,-4%,0) scale(1.12)}`;
const driftB = keyframes`0%{transform:translate3d(0,0,0) scale(1.05)}100%{transform:translate3d(-7%,6%,0) scale(0.94)}`;
const driftC = keyframes`0%{transform:translate3d(0,0,0) scale(0.96)}100%{transform:translate3d(4%,7%,0) scale(1.1)}`;
const driftD = keyframes`0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(-5%,-6%,0) scale(1.08)}`;

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const blob = (bg: string, anim: ReturnType<typeof keyframes>, dur: number, pos: object, size: object) => ({
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
 * Signature "conversion" gradient: brand indigo → deep navy → a mint accent
 * (settled). Full-bleed, diagonally cut at the bottom (Stripe), dimmed in dark
 * mode, static under reduced motion.
 */
const AuroraField: React.FC<{ testId?: string }> = ({ testId = "aurora-field" }) => {
  const s = useAurora();
  const a = s.dark ? 0.58 : 0.6;
  return (
    <Box
      aria-hidden
      data-testid={testId}
      sx={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: s.dark
          ? "linear-gradient(180deg, #0B0D17 0%, #0F1229 60%, #0B0D17 100%)"
          : "linear-gradient(180deg, #F7F6FF 0%, #EEF0FF 55%, #F5F7FF 100%)",
        clipPath: { xs: "polygon(0 0, 100% 0, 100% 96%, 0 100%)", md: "polygon(0 0, 100% 0, 100% 72%, 0 88%)" },
      }}
    >
      <Box sx={blob(`radial-gradient(circle, rgba(79,70,229,${a}) 0%, rgba(79,70,229,${a * 0.55}) 32%, transparent 68%)`, driftA, 26, { top: "-38%", right: "-6%" }, { width: { xs: 760, md: 1200 }, height: { xs: 760, md: 1200 } })} />
      <Box sx={blob(`radial-gradient(circle, rgba(30,27,75,${s.dark ? 0.9 : 0.5}) 0%, rgba(30,27,75,${s.dark ? 0.5 : 0.24}) 34%, transparent 70%)`, driftB, 32, { top: "-10%", right: "18%" }, { width: { xs: 620, md: 980 }, height: { xs: 620, md: 980 } })} />
      <Box sx={blob(`radial-gradient(circle, rgba(124,92,255,${a * 0.85}) 0%, rgba(124,92,255,${a * 0.4}) 36%, transparent 70%)`, driftC, 30, { bottom: "-30%", left: "-14%" }, { width: { xs: 640, md: 1000 }, height: { xs: 640, md: 1000 } })} />
      <Box sx={blob(`radial-gradient(circle, rgba(52,211,153,${s.dark ? 0.4 : 0.5}) 0%, rgba(52,211,153,${s.dark ? 0.18 : 0.2}) 30%, transparent 66%)`, driftD, 24, { bottom: "-8%", right: "8%" }, { width: { xs: 420, md: 720 }, height: { xs: 420, md: 720 } })} />
      {/* faint grid + grain: texture without a raster */}
      <Box sx={{ position: "absolute", inset: 0, backgroundImage: s.dark ? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)" : "linear-gradient(rgba(10,10,10,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.035) 1px, transparent 1px)", backgroundSize: "72px 72px", maskImage: "radial-gradient(ellipse 80% 70% at 60% 20%, black 0%, transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 60% 20%, black 0%, transparent 80%)" }} />
      <Box sx={{ position: "absolute", inset: 0, opacity: s.dark ? 0.07 : 0.045, mixBlendMode: s.dark ? "screen" : "multiply", backgroundImage: NOISE }} />
    </Box>
  );
};

export default memo(AuroraField);
