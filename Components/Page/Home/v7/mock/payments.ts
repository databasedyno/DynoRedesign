import { useEffect, useState } from "react";

export type Coin = "USDT" | "USDC" | "BTC" | "ETH" | "SOL" | "LTC";
export type Network = "Tron" | "Ethereum" | "Polygon" | "Bitcoin" | "Solana" | "Litecoin";
export type MockPayment = { merchant: string; usd: number; coin: Coin; network: Network; ref: string };

export const COIN_META: Record<Coin, { tint: string; decimals: number }> = {
  USDT: { tint: "#26A17B", decimals: 2 },
  USDC: { tint: "#2775CA", decimals: 2 },
  BTC: { tint: "#F7931A", decimals: 6 },
  ETH: { tint: "#627EEA", decimals: 4 },
  SOL: { tint: "#9945FF", decimals: 3 },
  LTC: { tint: "#345D9D", decimals: 4 },
};

export const NETWORK_META: Record<Network, { tint: string; label: string; addr: string }> = {
  Tron: { tint: "#E5343A", label: "Tron (TRC-20)", addr: "TCq3…9vXk" },
  Ethereum: { tint: "#627EEA", label: "Ethereum (ERC-20)", addr: "0x4f2a…c91e" },
  Polygon: { tint: "#8247E5", label: "Polygon", addr: "0x8b1d…07af" },
  Bitcoin: { tint: "#F7931A", label: "Bitcoin", addr: "bc1q…x7d2" },
  Solana: { tint: "#14F195", label: "Solana", addr: "7Gz4…kQ9p" },
  Litecoin: { tint: "#345D9D", label: "Litecoin", addr: "ltc1…m4r8" },
};

/* Fallback spot prices (USD) — replaced by GET /api/public/tickers when reachable. */
const FALLBACK_PRICES: Record<Coin, number> = { USDT: 1, USDC: 1, BTC: 84500, ETH: 2680, SOL: 117, LTC: 73.7 };

export const HOME_PAYMENTS: MockPayment[] = [
  { merchant: "Northwind Studio", usd: 148, coin: "USDT", network: "Tron", ref: "INV-2026-0412" },
  { merchant: "Voidrunner Games", usd: 59.99, coin: "BTC", network: "Bitcoin", ref: "ORD-88213" },
  { merchant: "Metricly", usd: 79, coin: "USDC", network: "Polygon", ref: "SUB-2026-07" },
  { merchant: "Mia Draws", usd: 25, coin: "SOL", network: "Solana", ref: "TIP-4471" },
  { merchant: "Cloudpeak Hosting", usd: 289, coin: "ETH", network: "Ethereum", ref: "INV-2026-1187" },
  { merchant: "Learnly Academy", usd: 249, coin: "USDT", network: "Ethereum", ref: "CRS-3092" },
  { merchant: "Corner Coffee Co.", usd: 12.5, coin: "LTC", network: "Litecoin", ref: "POS-5521" },
  { merchant: "Aurora DAO", usd: 1200, coin: "USDC", network: "Ethereum", ref: "GRANT-017" },
];

export const VERTICAL_PAYMENTS: Record<string, MockPayment> = {
  "affiliate-marketing": { merchant: "Peak Affiliates", usd: 320, coin: "USDT", network: "Tron", ref: "PAYOUT-2291" },
  agencies: { merchant: "Northstar Agency", usd: 2400, coin: "USDC", network: "Ethereum", ref: "INV-2026-0098" },
  consultants: { merchant: "Ortiz Consulting", usd: 950, coin: "USDT", network: "Tron", ref: "INV-2026-0311" },
  creators: { merchant: "Mia Draws", usd: 25, coin: "SOL", network: "Solana", ref: "TIP-4471" },
  developers: { merchant: "Bitloom Labs", usd: 199, coin: "ETH", network: "Ethereum", ref: "LIC-77120" },
  "digital-downloads": { merchant: "Pixelkit Store", usd: 39, coin: "USDT", network: "Polygon", ref: "ORD-30518" },
  dropshipping: { merchant: "Nova Gadgets", usd: 64.9, coin: "USDT", network: "Tron", ref: "ORD-91427" },
  ecommerce: { merchant: "Northwind Studio", usd: 148, coin: "USDT", network: "Tron", ref: "INV-2026-0412" },
  "forex-trading": { merchant: "Apex FX Signals", usd: 499, coin: "USDT", network: "Tron", ref: "SUB-2026-19" },
  freelancers: { merchant: "Weber Design", usd: 1200, coin: "USDC", network: "Polygon", ref: "INV-2026-0207" },
  fundraisers: { merchant: "Clean Rivers Fund", usd: 50, coin: "BTC", network: "Bitcoin", ref: "GIFT-8804" },
  gaming: { merchant: "Voidrunner Games", usd: 19.99, coin: "LTC", network: "Litecoin", ref: "ORD-88213" },
  hosting: { merchant: "Cloudpeak Hosting", usd: 89, coin: "USDT", network: "Tron", ref: "INV-2026-1187" },
  marketplaces: { merchant: "Artisan Market", usd: 76, coin: "USDC", network: "Ethereum", ref: "ORD-45092" },
  merchants: { merchant: "Corner Coffee Co.", usd: 12.5, coin: "USDT", network: "Tron", ref: "POS-5521" },
  nonprofits: { merchant: "Bright Futures", usd: 100, coin: "ETH", network: "Ethereum", ref: "GIFT-1200" },
  "online-courses": { merchant: "Learnly Academy", usd: 249, coin: "USDT", network: "Tron", ref: "CRS-3092" },
  remittance: { merchant: "SendHome", usd: 300, coin: "USDT", network: "Tron", ref: "TRF-66018" },
  saas: { merchant: "Metricly", usd: 79, coin: "USDC", network: "Polygon", ref: "SUB-2026-07" },
  vpn: { merchant: "GhostLine VPN", usd: 59.88, coin: "BTC", network: "Bitcoin", ref: "SUB-2026-44" },
  "web3-daos": { merchant: "Aurora DAO", usd: 5000, coin: "ETH", network: "Ethereum", ref: "GRANT-017" },
};

export const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtCoin = (p: MockPayment, prices: Partial<Record<Coin, number>>) => {
  const price = prices[p.coin] || FALLBACK_PRICES[p.coin];
  const amt = p.usd / price;
  const { decimals } = COIN_META[p.coin];
  return `${amt.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${p.coin}`;
};

let cached: Partial<Record<Coin, number>> | null = null;
let inflight: Promise<Partial<Record<Coin, number>>> | null = null;

const loadPrices = () => {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
    inflight = fetch(`${base}/api/public/tickers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const out: Partial<Record<Coin, number>> = {};
        for (const row of Array.isArray(j?.data) ? j.data : []) {
          const sym = String(row?.symbol || "") as Coin;
          if (sym in FALLBACK_PRICES && Number(row?.price) > 0) out[sym] = Number(row.price);
        }
        cached = out;
        return out;
      })
      .catch(() => ({}));
  }
  return inflight;
};

/** Live spot prices (shared, fetched once per page). Empty until loaded → fmtCoin falls back. */
export const usePrices = () => {
  const [prices, setPrices] = useState<Partial<Record<Coin, number>>>(cached || {});
  useEffect(() => {
    let alive = true;
    loadPrices().then((p) => alive && setPrices(p));
    return () => {
      alive = false;
    };
  }, []);
  return prices;
};
