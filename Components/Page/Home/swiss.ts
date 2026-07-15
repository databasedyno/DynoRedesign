import { useTheme } from "@mui/material";

// Swiss & High-Contrast design tokens (2026-07 landing redesign).
export const FONT_HERO = "var(--font-hero)";
export const FONT_BODY = "var(--font-body)";
export const FONT_TECH = "var(--font-tech)";
export const OBSIDIAN = "#050505";
export const VOLT = "#CCFF00";

export interface SwissTokens {
  dark: boolean;
  surface: string;
  txt: string;
  sub: string;
  faint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentText: string;
  accentSoft: string;
}

export const useSwiss = (): SwissTokens => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return {
    dark,
    surface: dark ? "#111113" : "#FFFFFF",
    txt: dark ? "#F5F5F5" : "#0A0A0A",
    sub: dark ? "#C9C9D1" : "#3F3F46",
    faint: dark ? "rgba(255,255,255,0.68)" : "rgba(10,10,10,0.74)",
    line: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)",
    lineStrong: dark ? "rgba(255,255,255,0.18)" : "rgba(10,10,10,0.18)",
    accent: VOLT,
    accentText: dark ? VOLT : "#5A6B00",
    accentSoft: dark ? "rgba(204,255,0,0.08)" : "rgba(184,230,0,0.16)",
  };
};
