import { Theme, alpha } from "@mui/material";

/**
 * homeBento — shared style tokens for the "Floating Glass Bento" landing theme.
 * Import `getBento(theme)` inside a component (after `useTheme()`) to get
 * consistent frosted-glass surfaces, neon-lime accents and the display font.
 *
 * Everything is derived from the active `homeTheme`/`homeThemeDark` so the same
 * component looks right in both light (frost) and dark (void) modes.
 */

export const HOME_LIME = "#CCFF00";

/** Display font for big headings (loaded in _document.tsx). */
export const DISPLAY_FONT = "'Unbounded', 'OutfitMedium', system-ui, sans-serif";

export interface BentoTokens {
  isDark: boolean;
  /** Accent = lime in dark, near-black in light. */
  accent: string;
  /** A lime that is always visible (used for small accents even in light mode). */
  lime: string;
  glassBg: string;
  glassBorder: string;
  glassBorderHover: string;
  /** backdrop-filter value for frosted glass. */
  blur: string;
  /** Soft accent glow for hover states. */
  glow: string;
  /** Full glass-card sx spread. */
  card: Record<string, unknown>;
  displayFont: string;
}

export const getBento = (theme: Theme): BentoTokens => {
  const isDark = theme.palette.mode === "dark";
  const accent = theme.palette.primary.main;

  const glassBg = isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.72)";
  const glassBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)";
  const glassBorderHover = isDark ? alpha(HOME_LIME, 0.5) : "rgba(10,10,10,0.30)";
  const blur = "blur(16px)";
  const glow = isDark
    ? `0 20px 60px rgba(0,0,0,0.45), 0 0 42px ${alpha(HOME_LIME, 0.16)}`
    : "0 20px 60px rgba(10,10,10,0.08)";

  return {
    isDark,
    accent,
    lime: HOME_LIME,
    glassBg,
    glassBorder,
    glassBorderHover,
    blur,
    glow,
    displayFont: DISPLAY_FONT,
    card: {
      position: "relative",
      borderRadius: "20px",
      backgroundColor: glassBg,
      backdropFilter: blur,
      WebkitBackdropFilter: blur,
      border: `1px solid ${glassBorder}`,
      overflow: "hidden",
    },
  };
};
