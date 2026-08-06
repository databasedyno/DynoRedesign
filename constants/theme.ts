/**
 * Central brand + design tokens.
 *
 * `BRAND_ACCENT` is DynoPay's canonical Aurora Indigo. It was previously
 * hardcoded as the literal "#4F46E5" across ~66 call sites; import this token
 * instead so the brand color has a single source of truth.
 */
export const BRAND_ACCENT = "#4F46E5";
/** Darker indigo — hover / active / pressed states. */
export const BRAND_ACCENT_DARK = "#4338CA";
/** Lighter indigo — dark-mode text / soft variant. */
export const BRAND_ACCENT_LIGHT = "#818CF8";
/** Hover gradient start. */
export const BRAND_ACCENT_HOVER = "#6366F1";

/**
 * Returns the brand accent with an alpha channel appended as hex
 * (e.g. brandAlpha(0.1) -> "#4F46E51A"). `a` is clamped to [0, 1].
 */
export const brandAlpha = (a: number): string => {
  const clamped = Math.min(Math.max(a, 0), 1);
  const hex = Math.round(clamped * 255).toString(16).padStart(2, "0");
  return `${BRAND_ACCENT}${hex}`;
};
