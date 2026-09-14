import { useEffect, useState } from "react";

export interface LandingMetrics {
  uptime_90d_pct: number;
  median_settle_minutes_fast: number | null;
  payments_settled_this_month: number;
  countries_served: number;
  languages: number;
}

let memo: LandingMetrics | null = null;

/** Public reliability numbers for the proof strip (GET /api/status/landing-metrics, cached per page load). */
export const useLandingMetrics = (): LandingMetrics | null => {
  const [data, setData] = useState<LandingMetrics | null>(memo);
  useEffect(() => {
    if (memo) return;
    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    fetch(`${apiBase}/api/status/landing-metrics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const d = j?.data as LandingMetrics | undefined;
        if (d && typeof d.uptime_90d_pct === "number") {
          memo = d;
          setData(d);
        }
      })
      .catch(() => {});
  }, []);
  return data;
};

/** "30+" style rounding so the number stays honest and stable between visits. */
export const floor5 = (n: number): number => Math.max(5, Math.floor(n / 5) * 5);
