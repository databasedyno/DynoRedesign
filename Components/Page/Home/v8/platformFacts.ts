/* Real, verifiable platform facts for marketing copy (mirrors the press
 * boilerplate + GET /api/pay/network-fees: 15 coins & tokens over 9 chains). */

export const COINS_COUNT = 15;
export const CHAINS_COUNT = 9;
export const FEE_FROM = "1.5%";

export interface AssetFact {
  symbol: string;
  name: string;
  /** iconify id; RLUSD has no iconify glyph → rendered from assets/cryptocurrency. */
  icon: string | null;
  networks: string;
}

export const ASSETS: AssetFact[] = [
  { symbol: "BTC", name: "Bitcoin", icon: "cryptocurrency-color:btc", networks: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum", icon: "cryptocurrency-color:eth", networks: "Ethereum" },
  { symbol: "USDT", name: "Tether", icon: "cryptocurrency-color:usdt", networks: "ERC-20 · TRC-20 · Polygon" },
  { symbol: "USDC", name: "USD Coin", icon: "cryptocurrency-color:usdc", networks: "ERC-20" },
  { symbol: "SOL", name: "Solana", icon: "cryptocurrency-color:sol", networks: "Solana" },
  { symbol: "XRP", name: "XRP", icon: "cryptocurrency-color:xrp", networks: "XRP Ledger" },
  { symbol: "RLUSD", name: "Ripple USD", icon: null, networks: "XRPL · ERC-20" },
  { symbol: "TRX", name: "TRON", icon: "cryptocurrency-color:trx", networks: "Tron" },
  { symbol: "LTC", name: "Litecoin", icon: "cryptocurrency-color:ltc", networks: "Litecoin" },
  { symbol: "DOGE", name: "Dogecoin", icon: "cryptocurrency-color:doge", networks: "Dogecoin" },
  { symbol: "BCH", name: "Bitcoin Cash", icon: "cryptocurrency-color:bch", networks: "Bitcoin Cash" },
  { symbol: "POL", name: "Polygon", icon: "cryptocurrency-color:matic", networks: "Polygon" },
];
