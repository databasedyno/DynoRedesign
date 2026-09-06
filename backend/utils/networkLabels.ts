/**
 * Network / coin display names for receipts, emails and the public receipt page.
 *
 * Mirrors the frontend `utils/networkLabels.ts` (keep the two in sync). Wallet
 * types look like "BTC", "USDT-TRC20", "USDC-ERC20", "USDT-POLYGON", "RLUSD".
 */

/** Human-readable NETWORK a payment settled on, per wallet_type / crypto code. */
export const NETWORK_DISPLAY_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
  DOGE: "Dogecoin",
  BCH: "Bitcoin Cash",
  TRX: "Tron",
  SOL: "Solana",
  XRP: "XRP Ledger",
  POLYGON: "Polygon",
  RLUSD: "XRP Ledger",
  "USDT-ERC20": "Ethereum (ERC-20)",
  "USDC-ERC20": "Ethereum (ERC-20)",
  "RLUSD-ERC20": "Ethereum (ERC-20)",
  "USDT-TRC20": "Tron (TRC-20)",
  "USDT-POLYGON": "Polygon (PoS)",
};

/** Full coin name for the ticker (used next to the coin badge). */
export const COIN_DISPLAY_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
  DOGE: "Dogecoin",
  BCH: "Bitcoin Cash",
  TRX: "Tron",
  SOL: "Solana",
  XRP: "XRP",
  POLYGON: "Polygon",
  RLUSD: "Ripple USD",
  USDT: "Tether",
  USDC: "USD Coin",
};

/** "USDT-TRC20" -> "USDT"; "BTC" -> "BTC". */
export const getCoinSymbol = (cryptoCode?: string | null): string => {
  if (!cryptoCode) return "";
  return String(cryptoCode).toUpperCase().split("-")[0];
};

/** "USDT-TRC20" -> "Tron (TRC-20)"; unknown codes fall back to a heuristic, else "". */
export const getNetworkDisplayName = (cryptoCode?: string | null): string => {
  if (!cryptoCode) return "";
  const key = String(cryptoCode).toUpperCase();
  if (NETWORK_DISPLAY_NAMES[key]) return NETWORK_DISPLAY_NAMES[key];
  if (key.endsWith("-ERC20")) return "Ethereum (ERC-20)";
  if (key.endsWith("-TRC20")) return "Tron (TRC-20)";
  if (key.endsWith("-POLYGON")) return "Polygon (PoS)";
  return "";
};

/** "USDT-TRC20" -> "Tether"; "BTC" -> "Bitcoin". */
export const getCoinDisplayName = (cryptoCode?: string | null): string =>
  COIN_DISPLAY_NAMES[getCoinSymbol(cryptoCode)] || getCoinSymbol(cryptoCode);
