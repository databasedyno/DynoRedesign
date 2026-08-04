import { useEffect, useState, useCallback } from "react";

/**
 * useUsdRates — lightweight USD price feed for showing an approximate fiat
 * value next to crypto amounts.
 *
 * Pulls the same public ticker feed the landing LivePriceStrip uses
 * (GET /api/public/tickers → [{ symbol, price }] in USD, fed by the backend
 * Binance/CoinGecko/Kraken cache). No auth required. Fails silently: if the
 * feed is unavailable, `toUsd()` just returns null and callers hide the
 * estimate rather than showing a wrong number.
 */

// Stablecoins are ~$1 and are NOT returned by the ticker feed.
const STABLE = new Set([
  "USDT",
  "USDC",
  "DAI",
  "RLUSD",
  "USD",
  "BUSD",
  "TUSD",
]);

/**
 * Normalise a wallet/base currency (e.g. "USDT-TRC20", "USDC-ERC20",
 * "USDT-POLYGON", "POLYGON", "MATIC") to the base ticker symbol used by
 * /api/public/tickers (e.g. "USDT", "USDC", "POL").
 */
export function normalizeSymbol(currency?: string | null): string {
  if (!currency) return "";
  let s = String(currency).toUpperCase().trim();
  if (s.includes("-")) s = s.split("-")[0]; // USDT-TRC20 -> USDT
  if (s === "MATIC" || s === "POLYGON") s = "POL";
  if (s === "WETH") s = "ETH";
  if (s === "WBTC") s = "BTC";
  return s;
}

export function useUsdRates() {
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    fetch(`${base}/api/public/tickers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!alive || !json) return;
        const list = json?.data || json || [];
        const map: Record<string, number> = {};
        (Array.isArray(list) ? list : []).forEach((t: { symbol?: string; price?: number }) => {
          if (t?.symbol && typeof t.price === "number" && t.price > 0) {
            map[String(t.symbol).toUpperCase()] = t.price;
          }
        });
        if (Object.keys(map).length) setRates(map);
      })
      .catch(() => {
        /* silent — estimate simply won't render */
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Convert a crypto amount to an approximate USD value.
   * Returns null when we can't price it (unknown symbol / feed unavailable),
   * so callers can hide the estimate instead of showing a wrong value.
   */
  const toUsd = useCallback(
    (amount: number | string, currency?: string | null): number | null => {
      const n = Number(amount);
      if (!Number.isFinite(n)) return null;
      const raw = String(currency || "").toUpperCase();
      const sym = normalizeSymbol(currency);
      if (!sym) return null;
      if (STABLE.has(raw) || STABLE.has(sym)) return n; // ~$1 each
      const price = rates[sym];
      if (!price || price <= 0) return null;
      return n * price;
    },
    [rates]
  );

  return { rates, toUsd };
}

export default useUsdRates;
