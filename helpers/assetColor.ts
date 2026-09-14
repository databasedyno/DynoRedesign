import { BRAND_ACCENT } from "@/constants/theme";

/**
 * Centralized crypto brand-color palette + resolver — the single source of
 * truth for "asset colour" across the app (dashboard assets, charts, feeds,
 * auth trust strip, etc). Previously this map was duplicated in
 * LivePaymentFeed / QuickActionsPanel / TrustStrip / AuthBrandPanel; keep those
 * in sync by importing from here going forward.
 *
 * Colours are each coin's canonical brand colour so a merchant instantly
 * recognises BTC (orange), ETH (periwinkle), USDT (teal-green), etc.
 */
export const COIN_COLOR: Record<string, string> = {
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
  RLUSD: BRAND_ACCENT,
};

/** Neutral grey used when a coin has no brand colour mapping. */
export const ASSET_COLOR_FALLBACK = "#6B7280";

/**
 * Resolve a currency/asset code (e.g. "USDT_TRC20", "usdt-trc20", "BTC") to
 * its brand colour. Tolerant of separators, case, and network suffixes.
 */
export function getAssetColor(coin?: string | null): string {
  if (!coin) return ASSET_COLOR_FALLBACK;
  const key = String(coin).toUpperCase().replace(/_/g, "-");
  if (COIN_COLOR[key]) return COIN_COLOR[key];
  const base = key.split("-")[0];
  if (COIN_COLOR[base]) return COIN_COLOR[base];
  for (const k of Object.keys(COIN_COLOR)) {
    if (key.startsWith(k)) return COIN_COLOR[k];
  }
  return ASSET_COLOR_FALLBACK;
}
