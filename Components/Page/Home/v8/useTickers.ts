import { useEffect, useRef, useState } from "react";

/* ============================================================================
 * useTickers — the signature "this is alive" data source for the homepage.
 *
 * Reads DynoPay's existing public market-data feed (GET /api/public/tickers),
 * polls every 30s, and degrades GRACEFULLY: if a symbol is unavailable (or the
 * feed is unreachable) it keeps the last-known value, falling back to a curated
 * static snapshot so the ticker band / hero mockup never render empty.
 * ========================================================================== */

export interface Ticker {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string; // iconify id (cryptocurrency-color:*)
}

const META: Record<string, { name: string; icon: string }> = {
  BTC: { name: "Bitcoin", icon: "cryptocurrency-color:btc" },
  ETH: { name: "Ethereum", icon: "cryptocurrency-color:eth" },
  USDT: { name: "Tether", icon: "cryptocurrency-color:usdt" },
  USDC: { name: "USD Coin", icon: "cryptocurrency-color:usdc" },
  SOL: { name: "Solana", icon: "cryptocurrency-color:sol" },
  XRP: { name: "XRP", icon: "cryptocurrency-color:xrp" },
  BNB: { name: "BNB", icon: "cryptocurrency-color:bnb" },
  TRX: { name: "TRON", icon: "cryptocurrency-color:trx" },
  LTC: { name: "Litecoin", icon: "cryptocurrency-color:ltc" },
  DOGE: { name: "Dogecoin", icon: "cryptocurrency-color:doge" },
  BCH: { name: "Bitcoin Cash", icon: "cryptocurrency-color:bch" },
  POL: { name: "Polygon", icon: "cryptocurrency-color:matic" },
  MATIC: { name: "Polygon", icon: "cryptocurrency-color:matic" },
};

/* Plausible last-known snapshot so first paint (and offline) is never empty. */
const FALLBACK: Ticker[] = [
  { symbol: "BTC", name: "Bitcoin", price: 86000, change24h: 0.44, icon: META.BTC.icon },
  { symbol: "ETH", name: "Ethereum", price: 2717, change24h: 0.04, icon: META.ETH.icon },
  { symbol: "USDT", name: "Tether", price: 1.0, change24h: 0.0, icon: META.USDT.icon },
  { symbol: "USDC", name: "USD Coin", price: 1.0, change24h: 0.01, icon: META.USDC.icon },
  { symbol: "SOL", name: "Solana", price: 120.7, change24h: 0.28, icon: META.SOL.icon },
  { symbol: "XRP", name: "XRP", price: 1.52, change24h: 0.25, icon: META.XRP.icon },
  { symbol: "BNB", name: "BNB", price: 785, change24h: -0.5, icon: META.BNB.icon },
  { symbol: "LTC", name: "Litecoin", price: 70, change24h: -1.31, icon: META.LTC.icon },
  { symbol: "DOGE", name: "Dogecoin", price: 0.096, change24h: 0.05, icon: META.DOGE.icon },
  { symbol: "TRX", name: "TRON", price: 0.335, change24h: -0.16, icon: META.TRX.icon },
  { symbol: "BCH", name: "Bitcoin Cash", price: 316, change24h: 0.25, icon: META.BCH.icon },
];

const apiBase = (): string =>
  (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");

export const formatUsd = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
};

export const formatPct = (pct: number): string => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

export const useTickers = (pollMs = 30000): { tickers: Ticker[]; live: boolean } => {
  const [tickers, setTickers] = useState<Ticker[]>(FALLBACK);
  const [live, setLive] = useState(false);
  const last = useRef<Record<string, Ticker>>(
    Object.fromEntries(FALLBACK.map((t) => [t.symbol, t])),
  );

  useEffect(() => {
    let alive = true;
    const base = apiBase();

    const load = async () => {
      try {
        const r = await fetch(`${base}/api/public/tickers`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const rows: { symbol?: string; price?: number; change24h?: number }[] = Array.isArray(j?.data) ? j.data : [];
        if (!alive || rows.length === 0) return;

        const map = { ...last.current };
        for (const row of rows) {
          const sym = String(row?.symbol || "").toUpperCase();
          const meta = META[sym];
          if (!meta || !row?.price || row.price <= 0) continue;
          const key = sym === "MATIC" ? "POL" : sym;
          map[key] = {
            symbol: key,
            name: meta.name,
            price: Number(row.price),
            change24h: Number(row.change24h ?? 0),
            icon: meta.icon,
          };
        }
        last.current = map;

        // Preserve a stable, meaningful order (majors first, then the rest).
        const ORDER = ["BTC", "ETH", "USDT", "USDC", "SOL", "XRP", "BNB", "LTC", "DOGE", "TRX", "BCH", "POL"];
        const ordered = ORDER.map((k) => map[k]).filter(Boolean) as Ticker[];
        const extras = Object.values(map).filter((t) => !ORDER.includes(t.symbol));
        if (alive) {
          setTickers([...ordered, ...extras]);
          setLive(true);
        }
      } catch {
        /* keep last-known values */
      }
    };

    void load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return { tickers, live };
};
