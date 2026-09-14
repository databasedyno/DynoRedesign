import { useEffect, useState } from "react";

export interface Settlement {
  symbol: string;
  network: string;
  at: string;
}
export interface OnchainProof {
  symbol: string;
  network: string;
  txHash: string;
  explorerUrl: string;
  at: string;
}

const apiBase = () => (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

let feedMemo: Settlement[] | null = null;
let proofMemo: OnchainProof[] | null = null;

/** Anonymized live settlement feed (coin + network + time only). Refreshes every 45s. */
export const useRecentSettlements = (limit = 8): Settlement[] | null => {
  const [data, setData] = useState<Settlement[] | null>(feedMemo);
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`${apiBase()}/api/status/recent-settlements?limit=${limit}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const arr = j?.data?.settlements as Settlement[] | undefined;
          if (alive && Array.isArray(arr) && arr.length) {
            feedMemo = arr;
            setData(arr);
          }
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 45_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [limit]);
  return data;
};

/** A few real, verifiable settlements from Dynopay's own store. */
export const useOnchainProof = (limit = 4): OnchainProof[] | null => {
  const [data, setData] = useState<OnchainProof[] | null>(proofMemo);
  useEffect(() => {
    if (proofMemo) return;
    fetch(`${apiBase()}/api/status/onchain-proof?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const arr = j?.data?.proofs as OnchainProof[] | undefined;
        if (Array.isArray(arr) && arr.length) {
          proofMemo = arr;
          setData(arr);
        }
      })
      .catch(() => {});
  }, [limit]);
  return data;
};

/** Iconify icon id for a display symbol (matches the checkout catalogue palette). */
export const coinIcon = (symbol: string): { icon: string; color?: string } => {
  const map: Record<string, { icon: string; color?: string }> = {
    BTC: { icon: "cryptocurrency-color:btc" },
    ETH: { icon: "cryptocurrency-color:eth" },
    LTC: { icon: "cryptocurrency-color:ltc" },
    DOGE: { icon: "cryptocurrency-color:doge" },
    BCH: { icon: "cryptocurrency-color:bch" },
    TRX: { icon: "cryptocurrency-color:trx" },
    SOL: { icon: "cryptocurrency-color:sol" },
    XRP: { icon: "cryptocurrency-color:xrp" },
    POL: { icon: "cryptocurrency-color:matic" },
    USDT: { icon: "cryptocurrency-color:usdt" },
    USDC: { icon: "cryptocurrency-color:usdc" },
    RLUSD: { icon: "mdi:currency-usd", color: "#22c55e" },
  };
  return map[symbol] || { icon: "cryptocurrency-color:generic" };
};

/** Short relative-time label using the landing i18n keys. */
export const relTime = (iso: string, t: (k: string, o?: Record<string, unknown>) => string): string => {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return t("v5.live.now");
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("v5.live.m", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("v5.live.h", { n: hrs });
  return t("v5.live.d", { n: Math.floor(hrs / 24) });
};
