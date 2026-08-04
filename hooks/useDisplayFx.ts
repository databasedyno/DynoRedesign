import { useEffect, useState, useCallback } from "react";
import axiosBaseApi from "@/axiosConfig";

/**
 * useDisplayFx — resolves the merchant's chosen DISPLAY currency
 * (Settings → Payments: USD/EUR/GBP/NGN/CAD/AUD) plus the authoritative
 * USD→currency FX rate, so fiat estimates can be shown next to crypto
 * amounts in the merchant's own currency ("≈ €12.34") anywhere in the app.
 *
 * The rate comes from the backend (`GET /api/user/display-currency`), which
 * reads a Redis-cached rate — no client-side FX guessing. Fails safe: if the
 * call fails we fall back to USD @ rate 1 so amounts still render.
 */

interface DisplayFxState {
  currency: string;
  symbol: string;
  rate: number;
  ready: boolean;
}

const DEFAULT: DisplayFxState = {
  currency: "USD",
  symbol: "$",
  rate: 1,
  ready: false,
};

// module-level cache so multiple mounted components share one network call
let cached: DisplayFxState | null = null;
let inflight: Promise<DisplayFxState> | null = null;

const fetchFx = (): Promise<DisplayFxState> => {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = axiosBaseApi
    .get("user/display-currency")
    .then((res) => {
      const d = res?.data?.data;
      const next: DisplayFxState = {
        currency: d?.display_currency || "USD",
        symbol: d?.currency_info?.symbol || "$",
        rate: Number(d?.rate) > 0 ? Number(d.rate) : 1,
        ready: true,
      };
      cached = next;
      return next;
    })
    .catch(() => {
      const next = { ...DEFAULT, ready: true };
      cached = next;
      return next;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

export function useDisplayFx() {
  const [state, setState] = useState<DisplayFxState>(cached || DEFAULT);

  useEffect(() => {
    let alive = true;
    fetchFx().then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Convert a USD amount into the display currency and format it with the
   * currency symbol. Returns null for non-finite input so callers can hide
   * the estimate. Small values keep extra precision so sub-cent amounts
   * don't collapse to "0.00".
   */
  const formatFromUsd = useCallback(
    (usd: number | string): string | null => {
      const n = Number(usd);
      if (!Number.isFinite(n)) return null;
      const val = n * state.rate;
      const sym = state.symbol || "";
      const abs = Math.abs(val);
      if (abs === 0) return `${sym}0.00`;
      if (abs >= 1) {
        return `${sym}${val.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }
      if (abs >= 0.01) {
        return `${sym}${val.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
      }
      return `${sym}${val.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
    },
    [state.rate, state.symbol],
  );

  return { ...state, formatFromUsd };
}

export default useDisplayFx;
