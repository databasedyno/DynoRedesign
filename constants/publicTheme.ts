/**
 * Public / marketing palette — Bybit design-system neutrals with Dynopay yellow
 * in place of Bybit orange (2026-09 landing restyle). Scoped to the marketing
 * shell (landing, header/footer, /fees, blog, docs…); the signed-in dashboard,
 * hosted checkout and SafeDeal keep their own tokens in constants/theme.ts.
 *
 * Neutral values are Bybit's live `--bds-*` tokens. Yellow fills ALWAYS carry
 * `ON_YELLOW` (#121214) text, never white or brown.
 */
export const YELLOW = "#FFD100";
export const YELLOW_HOVER = "#FFDC3D";
export const YELLOW_PRESSED = "#E6BC00";
export const ON_YELLOW = "#121214";
/** Brand-tinted TEXT on white surfaces (yellow itself is unreadable on white). */
export const YELLOW_TEXT_LIGHT = "#A67C00";
export const YELLOW_GRADIENT = "linear-gradient(90deg, #FFE066 0%, #FFD100 100%)";

export const GREEN = "#06C167";
export const RED = "#F63649";

export const PUB_DARK = {
  page: "#000000",
  pageAlt: "#0A0A0D",
  card: "#101014",
  surface: "#131415",
  container: "#1E1F24",
  containerAlt: "#222227",
  elevated: "#333537",
  line: "#222227",
  border: "#404347",
  t1: "#FFFFFF",
  t2: "#ADB1B8",
  t3: "#81858C",
  t4: "#595D61",
} as const;

export const PUB_LIGHT = {
  page: "#FFFFFF",
  pageAlt: "#F5F7FA",
  card: "#FFFFFF",
  surface: "#F3F5F7",
  container: "#E9ECF0",
  containerAlt: "#F3F5F7",
  elevated: "#FFFFFF",
  line: "#E1E5EA",
  border: "#D5DAE0",
  t1: "#121214",
  t2: "#6A6E73",
  t3: "#81858C",
  t4: "#D5DAE0",
} as const;

/** Bybit button geometry: 8px radius, 11px × 24px padding, semibold 16px. */
export const BTN_RADIUS = 8;
export const CARD_RADIUS = 16;

export const yellowAlpha = (a: number): string => `rgba(255,209,0,${Math.min(Math.max(a, 0), 1)})`;
