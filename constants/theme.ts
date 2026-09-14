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
 * Dark-mode surface system (design_guidelines.json, 2026-06 rework).
 * SOLID deep-navy steps — canvas → surface → raised → active — with hairline
 * borders instead of shadows or gradients. All text tokens are WCAG AA on the
 * surface they sit on (textMuted ≥ 4.6:1 even on `raised`).
 */
export const DARK = {
  canvas: "#0B0F19",
  surface: "#111827",
  raised: "#1F293D",
  active: "#2D3A54",
  border: "#1F2D47",
  borderStrong: "#334155",
  text: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#8592A6",
  /** Solid fills (buttons, active nav) — pairs with white text. */
  accent: "#6366F1",
  accentHover: "#818CF8",
  /** Brand-tinted TEXT / icons on dark surfaces (≥ 5.9:1). */
  accentText: "#818CF8",
  accentSoft: "rgba(99,102,241,0.15)",
  success: "#4ADE80",
  warning: "#FBBF24",
  error: "#F87171",
  info: "#60A5FA",
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
} as const;
