import { CRYPTO_INFO, NETWORK_ETA } from "@/Components/Page/Pay3Components/checkout/checkoutConstants";

export interface DemoCoin {
  code: keyof typeof CRYPTO_INFO;
  ticker: string;
  address: string;
  scheme: string;
  fallbackUsd: number;
  decimals: number;
}

/** Demo-only coins. Addresses are format-correct placeholders — nothing is ever sent to them. */
export const DEMO_COINS: DemoCoin[] = [
  { code: "USDT-TRC20", ticker: "USDT", address: "TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR", scheme: "tron", fallbackUsd: 1, decimals: 2 },
  { code: "BTC", ticker: "BTC", address: "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7", scheme: "bitcoin", fallbackUsd: 77000, decimals: 8 },
  { code: "ETH", ticker: "ETH", address: "0x9a7221b5e32D5f99e8DA95585835442E29AfB38F", scheme: "ethereum", fallbackUsd: 2450, decimals: 6 },
  { code: "SOL", ticker: "SOL", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", scheme: "solana", fallbackUsd: 140, decimals: 4 },
  { code: "LTC", ticker: "LTC", address: "LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm", scheme: "litecoin", fallbackUsd: 53, decimals: 5 },
  { code: "XRP", ticker: "XRP", address: "rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT", scheme: "xrp", fallbackUsd: 0.6, decimals: 2 },
];

export const DEMO_ORDER_USD = 49;
export const DEMO_STORE = "Acme Store";
export const DEMO_SETTLE = "USDC";

export const demoNetworkLabel = (code: DemoCoin["code"]) => CRYPTO_INFO[code].networkLabel;
export const demoNetworkEta = (code: DemoCoin["code"]) => NETWORK_ETA[CRYPTO_INFO[code].network] || "";

export const cryptoAmount = (usd: number, price: number, decimals: number): string => {
  const n = usd / (price || 1);
  const fixed = n.toFixed(decimals);
  return decimals > 2 ? fixed.replace(/0+$/, "").replace(/\.$/, ".0") : fixed;
};

/** Live USD prices from the public ticker feed; falls back to bundled figures. */
export const fetchDemoPrices = async (): Promise<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (const c of DEMO_COINS) out[c.ticker] = c.fallbackUsd;
  try {
    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    const res = await fetch(`${apiBase}/api/public/tickers`);
    if (!res.ok) return out;
    const j = await res.json();
    for (const row of j?.data || []) {
      const sym = String(row.symbol || "").toUpperCase();
      const p = Number(row.price);
      if (sym in out && Number.isFinite(p) && p > 0) out[sym] = p;
    }
  } catch {
    /* keep fallbacks */
  }
  return out;
};
