/**
 * uxTokens — the ONE documented entry point for DynoPay design tokens (plan 1.1).
 *
 * Nothing here changes the look of the app: it re-exports the tokens that already
 * exist (CB_TOKENS colours, MONO type, lucide Icon) and names the spacing / radius /
 * motion values that components were already using ad hoc, so new UI imports from a
 * single place instead of copying magic numbers.
 *
 *   import { CB_TOKENS, MONO, Icon, RADIUS, MOTION, transition, motionSafe } from "@/styles/uxTokens";
 *
 * Colour  — CB_TOKENS.{bg,surface,border,indigo,ink,semantic} · pick .light/.dark via theme.palette.mode
 * Type    — MONO for every number (tabular-nums), "var(--font-sans)" for everything else
 * Spacing — 8-pt scale (MUI spacing(1) = 8px); SPACE names the steps we use for section rhythm
 * Radius  — chip 999 · control 12 · card 16 · sheet 20 · phone bezel 30
 * Motion  — 150–250 ms ease-out, always transition specific properties, never `all`;
 *           wrap hover/active transforms in motionSafe() so reduced-motion users get none
 */
import type { SxProps, Theme } from "@mui/material/styles";
import { useMediaQuery } from "@mui/material";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";

export { CB_TOKENS };
export { MONO, Icon, MonoAmount } from "@/styles/uiKit";

/** Section rhythm on the 8-pt grid (px). */
export const SPACE = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 } as const;

/** Corner radii (px). */
export const RADIUS = { chip: 999, control: 12, card: 16, sheet: 20, phone: 30 } as const;

/** Type scale used by the new merchant surfaces (px). */
export const TYPE = {
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const },
  caption: 12,
  small: 12.5,
  body: 14,
  bodyLg: 15,
  title: 18,
  hero: 26,
} as const;

/** Motion durations (ms) + the easing every micro-interaction shares. */
export const MOTION = {
  fast: 150,
  base: 200,
  slow: 250,
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

/** `transition(["opacity", "transform"])` → "opacity 200ms cubic-bezier(...), transform 200ms cubic-bezier(...)" */
export const transition = (props: string[], ms: number = MOTION.base): string =>
  props.map((p) => `${p} ${ms}ms ${MOTION.easeOut}`).join(", ");

/** Apply a style block only when the user has NOT asked for reduced motion. */
export const motionSafe = (sx: Record<string, unknown>): SxProps<Theme> =>
  ({ "@media (prefers-reduced-motion: no-preference)": sx }) as SxProps<Theme>;

/** Media query key for the reduced-motion override inside sx / styled. */
export const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

/** Hook: true when the OS asks for reduced motion (skip confetti, staggered reveals, auto-scroll). */
export const usePrefersReducedMotion = (): boolean => useMediaQuery("(prefers-reduced-motion: reduce)");

/** Hairline border / muted ink / indigo accent for the current theme in one call. */
export const themeInk = (isDark: boolean) => ({
  border: isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light,
  muted: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
  ink: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
  indigo: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
  surface: isDark ? CB_TOKENS.surface.dark : CB_TOKENS.surface.light,
});
