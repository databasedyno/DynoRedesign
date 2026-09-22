import React from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../../v3/theme.v3";

/** Shared look for every bento vignette: tinted frame, floating panels, mono labels. */
export const useVig = () => {
  const s = useAurora();
  return {
    s,
    panel: s.dark ? "#15151B" : "#FFFFFF",
    shadow: s.dark ? "0 30px 60px -30px rgba(0,0,0,0.8)" : "0 30px 60px -34px rgba(30,27,75,0.35)",
    frame: s.dark ? "linear-gradient(160deg, rgba(139,94,0,0.18), rgba(52,211,153,0.06))" : "linear-gradient(160deg, rgba(139,94,0,0.09), rgba(52,211,153,0.10))",
    lift: { transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: "translateY(-6px)" } },
  };
};

export const VigFrame: React.FC<React.PropsWithChildren<{ height?: number; testId: string }>> = ({ height = 240, children, testId }) => {
  const v = useVig();
  return (
    <Box data-testid={testId} aria-hidden sx={{ position: "relative", height, overflow: "hidden", borderRadius: "18px", background: v.frame, border: `1px solid ${v.s.line}` }}>
      {children}
    </Box>
  );
};

export const Panel: React.FC<React.PropsWithChildren<{ sx?: object; lift?: boolean }>> = ({ children, sx, lift = true }) => {
  const v = useVig();
  return <Box sx={{ position: "absolute", borderRadius: "16px", background: v.panel, border: `1px solid ${v.s.line}`, boxShadow: v.shadow, ...(lift ? v.lift : {}), ...sx }}>{children}</Box>;
};

export const Label: React.FC<React.PropsWithChildren<{ sx?: object }>> = ({ children, sx }) => {
  const v = useVig();
  return <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: v.s.ink3, ...sx }}>{children}</Typography>;
};

export const Strong: React.FC<React.PropsWithChildren<{ size?: number; sx?: object }>> = ({ children, size = 15, sx }) => {
  const v = useVig();
  return <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: size, letterSpacing: "-0.02em", color: v.s.ink, lineHeight: 1.1, ...sx }}>{children}</Typography>;
};

export const Text: React.FC<React.PropsWithChildren<{ size?: number; sx?: object }>> = ({ children, size = 13, sx }) => {
  const v = useVig();
  return <Typography sx={{ fontFamily: FONT_BODY, fontSize: size, color: v.s.ink2, lineHeight: 1.4, ...sx }}>{children}</Typography>;
};

export const CoinDot: React.FC<{ icon: string; size?: number }> = ({ icon, size = 22 }) => {
  const v = useVig();
  return (
    <Box sx={{ width: size, height: size, borderRadius: "50%", background: "#fff", border: `1px solid ${v.s.line}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon icon={icon} width={Math.round(size * 0.62)} />
    </Box>
  );
};

export const Pill: React.FC<React.PropsWithChildren<{ active?: boolean; sx?: object }>> = ({ children, active, sx }) => {
  const v = useVig();
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.1, py: 0.45, borderRadius: 999, fontFamily: FONT_BODY, fontSize: 12, fontWeight: 600, color: active ? (v.s.dark ? "#FFD100" : "#FFD100") : v.s.ink2, background: active ? (v.s.dark ? "rgba(255,209,0,0.22)" : "rgba(139,94,0,0.10)") : v.s.dark ? "rgba(255,255,255,0.05)" : "#F4F4F5", border: `1px solid ${active ? "rgba(139,94,0,0.45)" : v.s.line}`, ...sx }}>
      {children}
    </Box>
  );
};
