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
