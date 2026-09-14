/**
 * NETWORK_LABELS — human-readable network hint for each wallet_type.
 *
 * Goal: prevent the #1 crypto UX risk (sending on the wrong chain). We show a
 * subtle chip next to every wallet ticker so BTC vs BCH, USDT-ERC20 vs USDT-TRC20,
 * and native-vs-token confusion becomes visually obvious.
 *
 * Keep values TERSE — they render inside a tiny pill.
 */
export const NETWORK_LABELS: Record<string, string> = {
  // Native L1s
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
  DOGE: "Dogecoin",
  BCH: "Bitcoin Cash",
  TRX: "Tron",
  SOL: "Solana",
  XRP: "XRP Ledger",
  POLYGON: "Polygon",

  // ERC-20 tokens (Ethereum)
  "USDT-ERC20": "ERC-20",
  "USDC-ERC20": "ERC-20",
  "RLUSD-ERC20": "ERC-20",

  // TRC-20 tokens (Tron)
  "USDT-TRC20": "TRC-20",

  // Polygon PoS
  "USDT-POLYGON": "Polygon PoS",

  // XRP Ledger token
  RLUSD: "XRP Ledger",
};

/**
 * Return a short network label for a given wallet_type / crypto label.
 * Falls back to a heuristic split on '-' (e.g. "FOO-BAR" → "BAR").
 */
export const getNetworkLabel = (walletType?: string | null): string => {
  if (!walletType) return "";
  const key = walletType.toUpperCase();
  if (NETWORK_LABELS[key]) return NETWORK_LABELS[key];
  // Heuristic: X-ERC20 → ERC-20, X-TRC20 → TRC-20, X-POLYGON → Polygon PoS
  if (key.endsWith("-ERC20")) return "ERC-20";
  if (key.endsWith("-TRC20")) return "TRC-20";
  if (key.endsWith("-POLYGON")) return "Polygon PoS";
  return "";
};

/**
 * True if this wallet_type is a TOKEN on another chain (as opposed to a native
 * L1 coin). Tokens have the highest cross-chain send-to-wrong-network risk,
 * so we style their chip more prominently.
 */
export const isTokenOnOtherChain = (walletType?: string | null): boolean => {
  if (!walletType) return false;
  const key = walletType.toUpperCase();
  return key.includes("-ERC20") || key.includes("-TRC20") || key.includes("-POLYGON");
};
