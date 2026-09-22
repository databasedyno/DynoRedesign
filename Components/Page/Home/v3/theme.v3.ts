import { useTheme } from "@mui/material";

// ─── Landing tokens (2026-09 Dynopay rebrand: gold · dark brown · black) ───
// Scoped to the Dynopay marketing homepage. Legacy names (INDIGO/VIOLET/SKY/
// MINT/VOLT/AQUA) are preserved so existing imports keep working, but they now
// resolve to the gold/brown palette. Money markers stay green. Aqua is NOT a
// landing colour any more (logo spark + live dots only — see constants/theme).
// SafeDeal (own gold/black) keeps its own identity and is unaffected by this file.
export const YELLOW = "#FFD100"; // signal gold — CTAs (ALWAYS dark-brown text on it)
export const YELLOW_HOVER = "#F0C300";
export const GOLD = YELLOW;
export const GOLD_DEEP = "#8B5E00"; // gold legible on light surfaces (text / borders)
export const ESPRESSO = "#2B1D14"; // dark brown — hero / dark bands / text on gold
export const ESPRESSO_RAISED = "#3A2A1F";
export const AQUA = GOLD; // legacy name — now gold (glows, links on dark)
export const AQUA_DEEP = GOLD_DEEP; // legacy name — now deep gold
export const MINT = GOLD; // legacy name — decorative glow colour
export const EMERALD = "#05B875"; // money marker (semantic green — unchanged)
export const BRAND_ACCENT = GOLD_DEEP; // legacy: solid accents used as text/border on light
export const INDIGO = BRAND_ACCENT;
export const INDIGO_DEEP = "#6B4800";
export const CORAL = INDIGO;
export const CORAL_DEEP = INDIGO_DEEP;
export const VIOLET = YELLOW_HOVER; // gradient end (gold)
export const VIOLET_DEEP = "#B89600";
export const SKY = GOLD;
export const VOLT = "#05B875"; // emerald money accent
export const VOLT_INK = "#0F7A55";
export const PAPER = "#FAF6EF"; // cream
export const PAPER_ALT = "#F3EDE2";
export const INK = "#1F140D";
export const OBSIDIAN = "#0B0908";

export const FONT_HERO = "'Poppins', var(--font-hero)";
export const FONT_BODY = "var(--font-body)";
export const FONT_TECH = "var(--font-tech)";

export const AURORA_GRADIENT =
  `linear-gradient(135deg, #FFB300 0%, ${YELLOW} 100%)`;
export const AURORA_GRADIENT_SOFT =
  "linear-gradient(135deg, rgba(255,179,0,0.16) 0%, rgba(255,209,0,0.16) 100%)";

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
    bgAlt: dark ? "#14100C" : PAPER_ALT,
    surface: dark ? "#1A120D" : "#FFFDF7",
    surfaceElev: dark ? "#241911" : "#FFFDF7",
    ink: dark ? "#FAF6EF" : INK,
    ink2: dark ? "#D6CBBD" : "#4A3B30",
    ink3: dark ? "rgba(250,246,239,0.62)" : "#6F6157", // ≥4.9:1 on paper/alt surfaces
    line: dark ? "rgba(255,240,210,0.08)" : "rgba(43,29,20,0.10)",
    lineStrong: dark ? "rgba(255,240,210,0.18)" : "rgba(43,29,20,0.18)",
    indigo: dark ? GOLD : INDIGO,
    coral: dark ? GOLD : INDIGO, // deprecated alias
    violet: VIOLET,
    volt: VOLT,
    voltInk: dark ? VOLT : VOLT_INK,
    aurora: AURORA_GRADIENT,
    auroraSoft: AURORA_GRADIENT_SOFT,
  };
};
