/**
 * ============================================================================
 * Dynopay — Central Brand Tokens (backend / email single source of truth)
 * ============================================================================
 *
 * Mirrors the frontend palette in `constants/theme.ts` (gold · dark brown · black brand)
 * and `helpers/assetColor.ts` (coin brand colours) so that every server-side
 * surface — transactional emails, PDF receipts, digests — stays on-palette
 * automatically. Import from here instead of hardcoding hex values.
 *
 * Keep in sync with `constants/theme.ts` on the frontend. If the brand colour
 * ever changes, change it HERE and in `constants/theme.ts` only.
 */

export const EMAIL_TOKENS = {
  // ---- Brand — signal yellow on dark brown (2026-09 rebrand) ----
  brand: "#FFD100",        // BRAND_ACCENT — aligned with frontend constants/theme.ts (always dark-brown text on it)
  brandDeep: "#2B1D14",    // dark brown — headings / chrome
  brandLight: "#FFD100",   // gold — dark-mode accent text / links
  brandHover: "#F0C300",   // yellow hover
  aqua: "#8B5E00",         // deep gold on light surfaces (links / info) — name kept for importers
  onBrand: "#2B1D14",      // text colour on yellow

  // ---- Success / paid — green ----
  green: "#12B76A",        // primary success
  greenDeep: "#05936A",    // text / strong success
  greenLight: "#3FD98A",   // dark-mode success text
  greenSurface: "#F0FDF4", // light success background
  greenSurfaceDark: "#052E16",
  greenBorder: "#A7F3D0",
  greenTextDark: "#86EFAC", // dark-mode success body text

  // ---- Failed / error — red ----
  red: "#DC2626",
  redDeep: "#B91C1C",
  redLight: "#FF6B6B",
  redSurface: "#FEF2F2",

  // ---- Pending / warning — amber ----
  amber: "#F59E0B",
  amberDeep: "#B45309",
  amberLight: "#FBBF24",
  amberSurface: "#FFFBEB",

  // ---- Neutrals ----
  ink: "#0A0A0A",
  inkSoft: "#374151",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#FAFAFA",
  white: "#FFFFFF",
} as const;

/**
 * Canonical crypto brand colours (mirror of frontend `helpers/assetColor.ts`).
 * RLUSD uses the Dynopay dark-brown brand tone.
 */
export const EMAIL_COIN_COLOR: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  USDT: "#26A17B",
  "USDT-TRC20": "#26A17B",
  "USDT-ERC20": "#26A17B",
  "USDT-POLYGON": "#26A17B",
  USDC: "#2775CA",
  "USDC-ERC20": "#2775CA",
  LTC: "#345D9D",
  DOGE: "#C2A633",
  TRX: "#EB0029",
  BCH: "#0AC18E",
  SOL: "#14C79A",
  XRP: "#23A7DE",
  POLYGON: "#8247E5",
  POL: "#8247E5",
  RLUSD: EMAIL_TOKENS.brandDeep,
};

/** Resolve a currency/asset code to its brand colour (network-suffix tolerant). */
export const getEmailCoinColor = (coin?: string | null): string => {
  if (!coin) return EMAIL_TOKENS.muted;
  const key = String(coin).toUpperCase().replace(/_/g, "-");
  if (EMAIL_COIN_COLOR[key]) return EMAIL_COIN_COLOR[key];
  const base = key.split("-")[0];
  if (EMAIL_COIN_COLOR[base]) return EMAIL_COIN_COLOR[base];
  for (const k of Object.keys(EMAIL_COIN_COLOR)) {
    if (key.startsWith(k)) return EMAIL_COIN_COLOR[k];
  }
  return EMAIL_TOKENS.muted;
};

export default EMAIL_TOKENS;
