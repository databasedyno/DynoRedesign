/**
 * Shell breakpoint tokens (UX audit 2026-10-08 §8.10). One set of cut-offs for
 * the whole app frame, driven by width AND pointer type, instead of the
 * hard-coded 768 / 900 / 1024 values that used to switch parts of the frame
 * piecemeal.
 *
 *   phone   < 600         bottom tab bar + "More" sheet
 *   tablet  600 – 1023    navigation rail (labelled on touch, icon-only on mouse)
 *           + touch screens up to 1279 (iPad landscape): labelled rail, card lists
 *   laptop  1024 – 1439   sidebar 240
 *   desktop 1440 – 1999   sidebar 240
 *   wide    ≥ 2000        sidebar 240, wider content column
 */
export const SHELL_BP = { tablet: 600, laptop: 1024, desktop: 1440, wide: 2000, ultra: 2400 } as const;

/** Raw media queries (for useMediaQuery / matchMedia). */
export const SHELL_Q = {
  phone: "(max-width:599.95px)",
  tabletUp: "(min-width:600px)",
  tablet: "(min-width:600px) and (max-width:1023.95px), (min-width:600px) and (max-width:1279.95px) and (pointer: coarse)",
  /** Lists render as cards: phones, small windows and every touch tablet. */
  cardList: "(max-width:1023.95px), (max-width:1279.95px) and (pointer: coarse)",
  belowLaptop: "(max-width:1023.95px)",
  laptopUp: "(min-width:1024px)",
  wide: "(min-width:2000px)",
  ultra: "(min-width:2400px)",
  coarse: "(pointer: coarse)",
  fine: "(pointer: fine)",
  short: "(max-height:860px)",
} as const;

/** The same queries as sx / styled keys. */
export const SHELL_MQ = Object.fromEntries(
  Object.entries(SHELL_Q).map(([k, v]) => [k, `@media ${v}`]),
) as { [K in keyof typeof SHELL_Q]: string };

/** Frame dimensions (px). */
export const SHELL_SIZE = {
  sidebar: 240,
  rail: 72,
  labelledRail: 88,
  topbarPhone: 56,
  topbar: 64,
  tabBar: 56,
  contentMax: 1440,
  contentMaxWide: 1720,
  // Blueprint §8.1: content stays ≤ 1720 even at ≥ 2400 (was 2040 — tables stretched to 2040px
  // at 2560 and line lengths got unreadable). Kept as its own token for a future right panel.
  contentMaxUltra: 1720,
} as const;

/** Type scale (px) — 7 steps, nothing under 12. */
export const TYPE_SCALE = { xs: 12, sm: 13, base: 14, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
