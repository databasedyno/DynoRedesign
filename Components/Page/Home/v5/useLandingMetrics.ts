import { createContext, useContext, useEffect, useState } from "react";

export interface LandingMetrics {
  uptime_90d_pct: number;
  uptime_checks?: number;
  median_settle_minutes_fast: number | null;
  payments_settled_this_month: number;
  countries_served: number;
  languages: number;
  /** Settled payments by chain, last 30 days (counts, descending) — rendered as shares only. */
  settled_by_chain_30d?: { chain: string; count: number }[];
}

let memo: LandingMetrics | null = null;

/** Server-fetched metrics (pages/index.tsx getServerSideProps) so the real numbers are in the HTML on first paint. */
export const LandingMetricsContext = createContext<LandingMetrics | null>(null);

const isMetrics = (d: unknown): d is LandingMetrics =>
  !!d && typeof (d as LandingMetrics).uptime_90d_pct === "number" && typeof (d as LandingMetrics).countries_served === "number";

/** Public reliability numbers for the proof strip (SSR seed → GET /api/status/landing-metrics fallback, cached per page load). */
export const useLandingMetrics = (): LandingMetrics | null => {
  const seeded = useContext(LandingMetricsContext);
  const [data, setData] = useState<LandingMetrics | null>(seeded ?? memo);
  useEffect(() => {
    if (seeded) {
      memo = seeded;
      return;
    }
    if (memo) return;
    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    fetch(`${apiBase}/api/status/landing-metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j?.data;
        if (isMetrics(d)) {
          memo = d;
          setData(d);
        }
      })
      .catch(() => {});
  }, [seeded]);
  return data;
};

/** "30+" style rounding so the number stays honest and stable between visits. */
export const floor5 = (n: number): number => Math.max(5, Math.floor(n / 5) * 5);

/* ---------- server side ---------- */
const SSR_TTL_MS = 60_000;
let ssrCache: { at: number; data: LandingMetrics | null } | null = null;

/** Fetches the metrics for SSR with a short timeout + 60s process cache; never throws (null = render placeholders). */
export const fetchLandingMetricsServer = async (): Promise<LandingMetrics | null> => {
  if (ssrCache && Date.now() - ssrCache.at < SSR_TTL_MS) return ssrCache.data;
  const base = (process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
  let data: LandingMetrics | null = null;
  if (base) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`${base}/api/status/landing-metrics`, { signal: ctrl.signal });
      const j = r.ok ? await r.json() : null;
      if (isMetrics(j?.data)) data = j.data;
    } catch {
      data = null;
    } finally {
      clearTimeout(timer);
    }
  }
  // Keep the last good numbers through a transient backend hiccup.
  if (!data && ssrCache?.data) data = ssrCache.data;
  ssrCache = { at: Date.now(), data };
  return data;
};
