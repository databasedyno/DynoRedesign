import { useTheme } from "@mui/material";
import { BRAND_ACCENT } from "@/constants/theme";

// ─── Aurora theme tokens (2026-07 landing v3) ──────────────────────────────
// Creator-first palette. Indigo leads, violet supports, volt marks money.
// NOTE: Historic `CORAL` name here always resolved to indigo (#4F46E5). Renamed
// to `INDIGO` (2026-07-28) to stop colliding with Dashboard's semantic-negative
// `CORAL = "#FF5B49"` (Components/Page/Dashboard/aurora/styled.tsx).
export const INDIGO = BRAND_ACCENT;
export const INDIGO_DEEP = "#4338CA";
// Back-compat aliases — kept so stragglers don't break during migration. Point
// at INDIGO so semantics are correct even under the old name.
export const CORAL = INDIGO;
export const CORAL_DEEP = INDIGO_DEEP;
export const VIOLET = "#7C5CFF";
export const VIOLET_DEEP = "#5A3EFF";
export const SKY = "#4FD1FF";
export const VOLT = "#818CF8";
export const VOLT_INK = "#5A6B00";
export const PAPER = "#FAFAF7";
export const PAPER_ALT = "#F3EFEA";
export const INK = "#0A0A0A";
export const OBSIDIAN = "#0B0B0F";

export const FONT_HERO = "var(--font-hero)";
export const FONT_BODY = "var(--font-body)";
export const FONT_TECH = "var(--font-tech)";

export const AURORA_GRADIENT =
  `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #7C5CFF 55%, #4FD1FF 100%)`;
export const AURORA_GRADIENT_SOFT =
  "linear-gradient(135deg, rgba(79, 70, 229,0.14) 0%, rgba(124,92,255,0.14) 55%, rgba(79,209,255,0.14) 100%)";

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
