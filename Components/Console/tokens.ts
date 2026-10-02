/**
 * Console design tokens — the one hook every in-app "operations console" surface
 * reads from. Resolves the warm-graphite palette (constants/theme.ts DARK/LIGHT)
 * for the active MUI theme mode, plus the shared number style + status palette.
 */
import { useTheme } from "@mui/material/styles";
import { DARK, LIGHT, STATUS_PALETTE, statusTone, type StatusTone } from "@/constants/theme";

export interface ConsoleTokens {
  isDark: boolean;
  canvas: string;
  surface: string;
  raised: string;
  active: string;
  border: string;
  borderStrong: string;
  hairline: string;
  ink: string;
  inkSecondary: string;
  inkMuted: string;
  accent: string;
  onAccent: string;
  shadowSoft: string;
  shadowMedium: string;
  slideOverShadow: string;
}

export const consoleTokens = (isDark: boolean): ConsoleTokens => {
  const T = isDark ? DARK : LIGHT;
  return {
    isDark,
    canvas: T.canvas,
    surface: T.surface,
    raised: T.raised,
    active: T.active,
    border: T.border,
    borderStrong: T.borderStrong,
    hairline: T.hairline,
    ink: T.text,
    inkSecondary: T.textSecondary,
    inkMuted: T.textMuted,
    accent: "#FFD100",
    onAccent: "#1A1A19",
    shadowSoft: T.shadowSoft,
    shadowMedium: T.shadow,
    slideOverShadow: isDark ? "-8px 0 32px rgba(0,0,0,0.45)" : "-8px 0 32px rgba(0,0,0,0.12)",
  };
};

/** Resolve console tokens for the current theme mode. */
export const useConsole = (): ConsoleTokens => {
  const theme = useTheme();
  return consoleTokens(theme.palette.mode === "dark");
};

/** Tabular, right-aligned number styling for financial figures. */
export const NUM_SX = {
  fontVariantNumeric: "tabular-nums",
  fontFeatureSettings: '"tnum"',
} as const;

/** IBM Plex Mono — IDs, hashes and wallet addresses ONLY. */
export const MONO_SX = {
  fontFamily: "var(--font-mono), 'IBM Plex Mono', monospace",
  fontVariantNumeric: "tabular-nums",
} as const;

export { STATUS_PALETTE, statusTone };
export type { StatusTone };
