import { useTheme } from "@mui/material";

// ─── Landing tokens (2026-06 Tatum-inspired mint/teal reskin) ──────────────
// Mint/teal-green LEADS; scoped to the Dynopay marketing homepage. Legacy names
// (INDIGO/VIOLET/SKY/VOLT) are preserved so existing imports keep working, but
// they now resolve to greens. SafeDeal (gold/black) and the dashboard/app keep
// their own global BRAND_ACCENT and are unaffected by this file.
export const MINT = "#00D084"; // bright mint — gradients, glows, live dots (decorative)
export const EMERALD = "#05B875"; // money marker
export const BRAND_ACCENT = "#0F766E"; // deep teal — solid CTAs/accents (white-text safe)
export const INDIGO = BRAND_ACCENT; // legacy name → deep teal (legible where used as text/border)
export const INDIGO_DEEP = "#0D5C56";
export const CORAL = INDIGO;
export const CORAL_DEEP = INDIGO_DEEP;
export const VIOLET = "#0D9488"; // gradient mid (teal)
export const VIOLET_DEEP = "#0D5C56";
export const SKY = "#2DD4BF"; // teal-cyan accent
export const VOLT = "#05B875"; // emerald money accent
export const VOLT_INK = "#0F766E";
export const PAPER = "#FFFFFF";
export const PAPER_ALT = "#F8FAFC";
export const INK = "#0A0F1D";
export const OBSIDIAN = "#0B0B0F";

export const FONT_HERO = "'Poppins', var(--font-hero)";
export const FONT_BODY = "var(--font-body)";
export const FONT_TECH = "var(--font-tech)";

export const AURORA_GRADIENT =
  `linear-gradient(135deg, ${EMERALD} 0%, ${MINT} 50%, ${VIOLET} 100%)`;
export const AURORA_GRADIENT_SOFT =
  "linear-gradient(135deg, rgba(0,208,132,0.14) 0%, rgba(13,148,136,0.14) 55%, rgba(45,212,191,0.14) 100%)";

export interface AuroraTokens {
  dark: boolean;
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceElev: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  indigo: string;
  /** @deprecated Alias for `indigo`. Kept for API back-compat. */
  coral: string;
  violet: string;
  volt: string;
  voltInk: string;
  aurora: string;
  auroraSoft: string;
}

export const useAurora = (): AuroraTokens => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return {
    dark,
    bg: dark ? OBSIDIAN : PAPER,
    bgAlt: dark ? "#131318" : PAPER_ALT,
    surface: dark ? "#15151B" : "#FFFFFF",
    surfaceElev: dark ? "#1D1D24" : "#FFFFFF",
    ink: dark ? "#F5F5F5" : INK,
    ink2: dark ? "#C9C9D1" : "#3F3F46",
    ink3: dark ? "rgba(255,255,255,0.6)" : "#66666F", // ≥4.9:1 on paper/alt surfaces
    line: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.08)",
    lineStrong: dark ? "rgba(255,255,255,0.18)" : "rgba(10,10,10,0.16)",
    indigo: INDIGO,
    coral: INDIGO, // deprecated alias
    violet: VIOLET,
    volt: VOLT,
    voltInk: dark ? VOLT : VOLT_INK,
    aurora: AURORA_GRADIENT,
    auroraSoft: AURORA_GRADIENT_SOFT,
  };
};
