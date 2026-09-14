/**
 * Central brand + design tokens.
 *
 * `BRAND_ACCENT` is DynoPay's canonical Aurora Indigo. It was previously
 * hardcoded as the literal "#4F46E5" across ~66 call sites; import this token
 * instead so the brand color has a single source of truth.
 */
export const BRAND_ACCENT = "#4338CA";
/** Darker indigo — hover / active / pressed states. */
export const BRAND_ACCENT_DARK = "#4338CA";
/** Lighter indigo — dark-mode text / soft variant. */
export const BRAND_ACCENT_LIGHT = "#818CF8";
/** Hover gradient start. */
export const BRAND_ACCENT_HOVER = "#6366F1";

/**
 * Theme-aware brand FOREGROUND colour — for brand-coloured TEXT / ICONS / thin
 * borders that sit on a surface. The solid brand indigo (#4F46E5) fails WCAG AA
 * on dark surfaces (~2.6:1 on #141417), so dark mode uses the lighter #818CF8
 * (~5.9:1). Use this for any brand-tinted text/icon.
 *
 * NOTE: Do NOT use this for solid button/pill BACKGROUNDS — those keep the full
 * `BRAND_ACCENT` in both modes (they pair with white `contrastText`).
 */
export const brandFg = (isDark: boolean): string =>
  isDark ? BRAND_ACCENT_LIGHT : BRAND_ACCENT;

/**
 * Returns the brand accent with an alpha channel appended as hex
 * (e.g. brandAlpha(0.1) -> "#4F46E51A"). `a` is clamped to [0, 1].
 */
export const brandAlpha = (a: number): string => {
  const clamped = Math.min(Math.max(a, 0), 1);
  const hex = Math.round(clamped * 255).toString(16).padStart(2, "0");
  return `${BRAND_ACCENT}${hex}`;
};

/**
 * Semantic status palette — single source of truth for success / error /
 * warning states across checkout, dashboards, and (mirrored server-side in
 * `backend/utils/brandTokens.ts`) transactional emails. Import these instead
 * of hardcoding green/red/amber hex values so status colors stay consistent.
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
 * Dark-mode surface system — "Aurora Dark" (2026-09 redesign).
 * A layered near-black canvas with real elevation, hairline light borders, and
 * soft accent glow instead of the previous flat navy steps. Each level is a
 * distinct depth: canvas (page) → surface (cards) → raised (nested/inputs) →
 * active (hover/selected). Shadow + glow tokens give cards/CTAs premium depth;
 * gradient tokens are reserved for hero/primary surfaces only (80/20 rule).
 * Text tokens stay WCAG AA on every surface they sit on.
 */
export const DARK = {
  canvas: "#07090F",
  surface: "#0F1320",
  raised: "#171C2C",
  active: "#212A42",
  border: "#262E45",
  borderStrong: "#3A4568",
  text: "#F8FAFC",
  textSecondary: "#C2C8D2",
  textMuted: "#9BA1AD",
  /** Solid fills (buttons, active nav) — pairs with white text. */
  accent: "#6366F1",
  accentHover: "#818CF8",
  /** Brand-tinted TEXT / icons on dark surfaces (≥ 5.9:1). */
  accentText: "#818CF8",
  accentSoft: "rgba(99,102,241,0.16)",
  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
  /** Hairline light-tint borders (premium depth vs. flat navy lines). */
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  /** Elevation shadows for layered surfaces. */
  shadowSoft: "0 2px 12px rgba(0,0,0,0.35)",
  shadow: "0 6px 28px rgba(0,0,0,0.48)",
  /** Card = layered shadow + hairline ring + faint accent bloom. */
  cardShadow: "0 8px 32px rgba(3,6,15,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
  cardShadowHover: "0 12px 40px rgba(3,6,15,0.65), 0 0 0 1px rgba(255,255,255,0.10), 0 0 48px rgba(99,102,241,0.14)",
  /** Accent glow for focused inputs / primary CTAs / active elements. */
  glowAccent: "0 0 40px rgba(99,102,241,0.14)",
  glowAccentStrong: "0 0 24px rgba(99,102,241,0.42)",
  glowSuccess: "0 0 16px rgba(74,222,128,0.32)",
  focusRing: "0 0 0 3px rgba(99,102,241,0.35)",
  /** Gradients — hero / primary surfaces only. */
  gradient: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  gradientHover: "linear-gradient(135deg, #6D70F5 0%, #9B6BFF 100%)",
  gradientWarm: "linear-gradient(135deg, #F59E0B 0%, #F43F5E 100%)",
} as const;

/** Light-mode counterparts (unchanged brand, slate hairlines). */
export const LIGHT = {
  canvas: "#F8FAFC",
  surface: "#FFFFFF",
  raised: "#F1F5F9",
  active: "#E2E8F0",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  accent: "#4338CA",
  accentHover: "#3730A3",
  accentSoft: "#EEF2FF",
  success: "#15803D",
  warning: "#B45309",
  error: "#B91C1C",
  info: "#1D4ED8",
  /** Hairline slate borders (light parity with DARK hairline tokens). */
  hairline: "rgba(15,23,42,0.06)",
  hairlineStrong: "rgba(15,23,42,0.12)",
  /** Elevation shadows — light parity with the DARK scale. */
  shadowSoft: "0 1px 2px rgba(15,23,42,0.05)",
  shadow: "0 4px 16px rgba(15,23,42,0.10)",
  cardShadow: "0 1px 2px rgba(15,23,42,0.05)",
  cardShadowHover: "0 6px 20px rgba(15,23,42,0.10)",
  focusRing: "0 0 0 3px rgba(67,56,202,0.25)",
} as const;

/**
 * Canonical radius scale — Phase 3 standardization (2026-09).
 * Single source of truth so every app/dashboard surface shares one geometry:
 *   control = buttons / inputs / menus / small toggles (8px)
 *   card    = content cards, panels, tables, modals (12px)
 *   chip    = status badges / count chips (100px = fully rounded)
 *   pill    = timeframe pills / segmented toggles (9999px)
 * NOTE: the marketing/auth themes keep their deliberate 20px/50px brand
 * geometry — this scale governs the dashboard/app "Quiet Money" system.
 */
export const RADIUS = { control: 8, card: 12, chip: 100, pill: 9999 } as const;

/**
 * Canonical elevation scale (theme-aware helper). Returns the right shadow
 * string for the current mode so cards/menus/popovers share one depth system.
 */
export const elevation = (isDark: boolean) => (isDark ? DARK : LIGHT);
