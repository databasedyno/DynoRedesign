import { FC, ReactNode } from "react";
import { Box, BoxProps, keyframes } from "@mui/material";
import { BRAND_ACCENT } from "@/constants/theme";
import { SKY, VIOLET, useAurora } from "../v3/theme.v3";
import { REDUCED_MQ } from "./tokens";

const ring = keyframes`0%{box-shadow:0 0 0 0 var(--live-ring)}100%{box-shadow:0 0 0 9px rgba(0,0,0,0)}`;
const drift = keyframes`0%{background-position:0% 50%}100%{background-position:100% 50%}`;

/** Ring-pulse "live" dot (Hostinger `agents-hero-pulse`). */
export const LiveDot: FC<{ color?: string; size?: number; sx?: BoxProps["sx"]; "data-testid"?: string }> = ({ color = BRAND_ACCENT, size = 6, sx, "data-testid": testId }) => (
  <Box
    component="span"
    aria-hidden
    data-testid={testId}
    sx={{
      display: "inline-block",
      flexShrink: 0,
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      "--live-ring": `${color}73`,
      animation: `${ring} 1.8s cubic-bezier(0.2,0.8,0.2,1) infinite`,
      [REDUCED_MQ]: { animation: "none", boxShadow: `0 0 0 4px ${color}2E` },
      ...sx,
    }}
  />
);

/** Slow-drifting aurora gradient on a statement word (Hostinger `--gradient-angle` title line). */
export const GradientInk: FC<{ children: ReactNode }> = ({ children }) => {
  const s = useAurora();
  const a = s.dark ? "#818CF8" : BRAND_ACCENT;
  return (
    <Box
      component="span"
      data-testid="hero-gradient-ink"
      sx={{
        backgroundImage: `linear-gradient(90deg, ${a}, ${VIOLET}, ${SKY}, ${VIOLET}, ${a})`,
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
        animation: `${drift} 7s ease-in-out infinite alternate`,
        [REDUCED_MQ]: { animation: "none" },
      }}
    >
      {children}
    </Box>
  );
};
