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

export const FONT_HERO = "var(--font-hero)";
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
  // 2026-10 Trust & Clarity — public pages adopt the signed-in app's warm
  // "operations-console" palette (see /app/design_guidelines.json) so the whole
  // product reads as one surface. Field names are unchanged for back-compat.
  if (dark) {
    return {
      dark: true,
      bg: "#131312",
      bgAlt: "#1A1A19",
      surface: "#1A1A19",
      surfaceElev: "#222221",
      ink: "#F2F2F0",
      ink2: "#A3A3A0",
      ink3: "#70706E",
      line: "rgba(255,255,255,0.07)",
      lineStrong: "rgba(255,255,255,0.15)",
      accent: GOLD,
      accentSoft: "rgba(255,209,0,0.10)",
      indigo: GOLD,
      coral: GOLD,
      violet: VIOLET,
      volt: VOLT,
      voltInk: VOLT,
      aurora: AURORA_GRADIENT,
      auroraSoft: AURORA_GRADIENT_SOFT,
    };
  }
  return {
    dark: false,
    bg: "#F9F9F8",
    bgAlt: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceElev: "#FFFFFF",
    ink: "#1A1A19",
    ink2: "#666664",
    ink3: "#999996",
    line: "rgba(0,0,0,0.08)",
    lineStrong: "rgba(0,0,0,0.14)",
    accent: GOLD_DEEP,
    accentSoft: "rgba(255,209,0,0.16)",
    indigo: GOLD_DEEP,
    coral: GOLD_DEEP,
    violet: VIOLET,
    volt: VOLT,
    voltInk: VOLT_INK,
    aurora: AURORA_GRADIENT,
    auroraSoft: AURORA_GRADIENT_SOFT,
  };
};
