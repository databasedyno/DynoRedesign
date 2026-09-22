/**
 * Central brand + design tokens — Dynopay 2026-09 rebrand.
 *
 * Palette: yellow (primary fills) · dark brown (dominant dark) · black (deepest
 * layers) · aqua (secondary: links, focus, status, charts) · warm cream neutrals.
 *
 * `BRAND_ACCENT` is the signal yellow used for solid fills (primary buttons,
 * active nav, selected states). Yellow ALWAYS carries dark-brown text —
 * pair it with `BRAND_ON_ACCENT`, never white. Brand-tinted TEXT / icons /
 * thin borders use aqua via `brandFg(isDark)`.
 */
export const BRAND_ACCENT = "#FFD100";
/** Pressed / hover yellow. */
export const BRAND_ACCENT_DARK = "#F0C300";
/** Brand-tinted text on dark surfaces (aqua). */
export const BRAND_ACCENT_LIGHT = "#2BD4C4";
/** Hover fill. */
export const BRAND_ACCENT_HOVER = "#F0C300";
/** Text / icon colour that sits ON a yellow fill. */
export const BRAND_ON_ACCENT = "#2B1D14";

/** Aqua — secondary accent. `AQUA` on dark grounds, `AQUA_DEEP` for readable text/links on light. */
export const AQUA = "#2BD4C4";
export const AQUA_DEEP = "#0F8F86";
/** Dark brown grounds. */
export const ESPRESSO = "#2B1D14";
export const ESPRESSO_RAISED = "#3A2A1F";
/** Deepest layer / code-QR-address blocks. */
export const BLACK = "#0B0908";
/** Warm light neutrals. */
export const CREAM = "#FAF6EF";
export const CARD = "#FFFDF7";
export const HAIRLINE = "#E8DFD2";
/** Headings / body text on light surfaces. */
export const INK = "#1F140D";

/**
 * Theme-aware brand FOREGROUND colour — for brand-coloured TEXT / ICONS / thin
 * borders that sit on a surface. Aqua: `AQUA` (dark) / `AQUA_DEEP` (light) —
 * both clear WCAG AA for text on their grounds. Never use yellow for text on
 * light surfaces.
 *
 * NOTE: Do NOT use this for solid button/pill BACKGROUNDS — those keep the full
 * `BRAND_ACCENT` yellow in both modes (they pair with `BRAND_ON_ACCENT`).
 */
export const brandFg = (isDark: boolean): string => (isDark ? AQUA : AQUA_DEEP);

/**
 * Returns the brand yellow with an alpha channel appended as hex
 * (e.g. brandAlpha(0.1) -> "#FFD1001A"). `a` is clamped to [0, 1].
 */
export const brandAlpha = (a: number): string => {
  const clamped = Math.min(Math.max(a, 0), 1);
  const hex = Math.round(clamped * 255).toString(16).padStart(2, "0");
  return `${BRAND_ACCENT}${hex}`;
};

/** Aqua with alpha — glows, focus rings, soft tints. */
export const aquaAlpha = (a: number): string => `rgba(43,212,196,${Math.min(Math.max(a, 0), 1)})`;

/**
 * Semantic status palette — single source of truth for success / error /
 * warning states across checkout, dashboards, and (mirrored server-side in
 * `backend/utils/brandTokens.ts`) transactional emails. Money semantics stay
 * conventional: green = received / up, red = failed / down. Aqua is a brand
 * accent, not a success colour.
 */
/** Paid / settled / success. */
export const SUCCESS_GREEN = "#12B76A";
export const SUCCESS_GREEN_DARK = "#05936A";
export const SUCCESS_GREEN_LIGHT = "#3FD98A";
/** Failed / declined / error. */
export const ERROR_RED = "#DC2626";
export const ERROR_RED_DARK = "#B91C1C";
export const ERROR_RED_LIGHT = "#FF6B6B";
/** Pending / warning. */
export const WARNING_AMBER = "#F59E0B";
export const WARNING_AMBER_DARK = "#B45309";
export const WARNING_AMBER_LIGHT = "#FBBF24";

/**
 * Dark-mode surface system — warm dark. Black canvas → dark-brown cards →
 * espresso raised → lighter espresso active. Yellow fills, aqua text accents.
 */
export const DARK = {
  canvas: BLACK,
  surface: "#1A120D",
  raised: ESPRESSO,
  active: ESPRESSO_RAISED,
  border: ESPRESSO_RAISED,
  borderStrong: "#4E3B2E",
  text: CREAM,
  textSecondary: "#D9CFC2",
  textMuted: "#A99A8A",
  /** Solid fills (buttons, active nav) — pairs with `BRAND_ON_ACCENT`. */
  accent: BRAND_ACCENT,
  accentHover: BRAND_ACCENT_HOVER,
  /** Brand-tinted TEXT / icons on dark surfaces (aqua). */
  accentText: AQUA,
  accentSoft: "rgba(255,209,0,0.14)",
  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  info: AQUA,
  /** Hairline light-tint borders. */
  hairline: "rgba(255,240,210,0.08)",
  hairlineStrong: "rgba(255,240,210,0.15)",
  /** Elevation shadows for layered surfaces. */
  shadowSoft: "0 2px 12px rgba(0,0,0,0.35)",
  shadow: "0 6px 28px rgba(0,0,0,0.48)",
  cardShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,240,210,0.06)",
  cardShadowHover: "0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,240,210,0.10), 0 0 48px rgba(43,212,196,0.10)",
  /** Accent glow for focused inputs / primary CTAs / active elements. */
  glowAccent: "0 0 40px rgba(255,209,0,0.14)",
  glowAccentStrong: "0 0 24px rgba(255,209,0,0.36)",
  glowSuccess: "0 0 16px rgba(74,222,128,0.32)",
  focusRing: "0 0 0 3px rgba(43,212,196,0.40)",
  /** Gradients — hero / primary surfaces only. */
  gradient: "linear-gradient(135deg, #FFD100 0%, #FFB300 100%)",
  gradientHover: "linear-gradient(135deg, #FFDA33 0%, #FFBE2E 100%)",
  gradientWarm: "linear-gradient(135deg, #F59E0B 0%, #F43F5E 100%)",
} as const;

/** Light-mode counterparts — cream grounds, dark-brown text, warm hairlines. */
export const LIGHT = {
  canvas: CREAM,
  surface: CARD,
  raised: "#F3EDE2",
  active: "#EAE1D3",
  border: HAIRLINE,
  borderStrong: "#D6C9B6",
  text: INK,
  textSecondary: "#5C4B3E",
  textMuted: "#7A6A5C",
  accent: BRAND_ACCENT,
  accentHover: BRAND_ACCENT_HOVER,
  accentSoft: "#FFF6CC",
  success: "#15803D",
  warning: "#B45309",
  error: "#B91C1C",
  info: AQUA_DEEP,
  /** Hairline warm borders. */
  hairline: "rgba(43,29,20,0.08)",
  hairlineStrong: "rgba(43,29,20,0.14)",
  /** Elevation shadows — light parity with the DARK scale. */
  shadowSoft: "0 1px 2px rgba(43,29,20,0.06)",
  shadow: "0 4px 16px rgba(43,29,20,0.10)",
  cardShadow: "0 1px 2px rgba(43,29,20,0.06)",
  cardShadowHover: "0 6px 20px rgba(43,29,20,0.10)",
  focusRing: "0 0 0 3px rgba(15,143,134,0.30)",
} as const;

/**
 * Canonical radius scale — Phase 3 standardization (2026-09).
 *   control = buttons / inputs / menus / small toggles (8px)
 *   card    = content cards, panels, tables, modals (12px)
 *   chip    = status badges / count chips (100px = fully rounded)
 *   pill    = timeframe pills / segmented toggles (9999px)
 */
export const RADIUS = { control: 8, card: 12, chip: 100, pill: 9999 } as const;

/** Canonical elevation scale (theme-aware helper). */
export const elevation = (isDark: boolean) => (isDark ? DARK : LIGHT);
