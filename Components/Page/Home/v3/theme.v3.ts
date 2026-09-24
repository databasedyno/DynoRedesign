import { useTheme } from "@mui/material";
import { PUB_DARK, PUB_LIGHT, YELLOW as PUB_YELLOW, YELLOW_GRADIENT, YELLOW_HOVER as PUB_YELLOW_HOVER, YELLOW_TEXT_LIGHT, GREEN } from "@/constants/publicTheme";

// ─── Landing tokens (2026-09 Bybit-style restyle: black · grey · white · yellow) ───
// Scoped to the Dynopay marketing pages. Legacy names (INDIGO/VIOLET/SKY/MINT/
// AQUA/ESPRESSO/PAPER…) are preserved so existing imports keep working, but they
// now resolve to the neutral Bybit palette. Money markers stay green.
// SafeDeal (own gold/black) keeps its own identity and is unaffected by this file.
export const YELLOW = PUB_YELLOW; // signal yellow — CTAs (ALWAYS #121214 text on it)
export const YELLOW_HOVER = PUB_YELLOW_HOVER;
export const GOLD = YELLOW;
export const GOLD_DEEP = YELLOW_TEXT_LIGHT; // brand-tinted text legible on white
export const ESPRESSO = "#121214"; // legacy name — Bybit black
export const ESPRESSO_RAISED = PUB_DARK.container;
export const AQUA = GOLD; // legacy name
export const AQUA_DEEP = GOLD_DEEP; // legacy name
export const MINT = GOLD; // legacy name
export const EMERALD = GREEN; // money marker (semantic green)
export const BRAND_ACCENT = GOLD_DEEP; // legacy: brand-tinted text/borders on light surfaces
export const INDIGO = BRAND_ACCENT;
export const INDIGO_DEEP = "#8A6600";
export const CORAL = INDIGO;
export const CORAL_DEEP = INDIGO_DEEP;
export const VIOLET = YELLOW_HOVER; // gradient end
export const VIOLET_DEEP = "#B89600";
export const SKY = GOLD;
export const VOLT = GREEN; // money accent
export const VOLT_INK = "#00944F";
export const PAPER = PUB_LIGHT.page;
export const PAPER_ALT = PUB_LIGHT.pageAlt;
export const INK = PUB_LIGHT.t1;
export const OBSIDIAN = PUB_DARK.page;

export const FONT_HERO = "var(--font-inter)";
export const FONT_BODY = "var(--font-body)";
export const FONT_TECH = "var(--font-tech)";

export const AURORA_GRADIENT = YELLOW_GRADIENT;
export const AURORA_GRADIENT_SOFT =
  "linear-gradient(135deg, rgba(255,224,102,0.16) 0%, rgba(255,209,0,0.16) 100%)";

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
  /** Brand-tinted text / icon colour that is legible on the current surface. */
  accent: string;
  /** Soft yellow tint for icon wells / selected states. */
  accentSoft: string;
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
  const p = dark ? PUB_DARK : PUB_LIGHT;
  const accent = dark ? GOLD : GOLD_DEEP;
  return {
    dark,
    bg: p.page,
    bgAlt: p.pageAlt,
    surface: p.card,
    surfaceElev: p.container,
    ink: p.t1,
    ink2: p.t2,
    ink3: p.t3,
    line: p.line,
    lineStrong: p.border,
    accent,
    accentSoft: dark ? "rgba(255,209,0,0.12)" : "rgba(255,209,0,0.18)",
    indigo: accent,
    coral: accent, // deprecated alias
    violet: VIOLET,
    volt: VOLT,
    voltInk: dark ? VOLT : VOLT_INK,
    aurora: AURORA_GRADIENT,
    auroraSoft: AURORA_GRADIENT_SOFT,
  };
};
