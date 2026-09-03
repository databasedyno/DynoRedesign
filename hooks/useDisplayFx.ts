import { useCallback } from "react";
import useApiSWR from "@/hooks/useApiSWR";
import { toFixedStr } from "@/utils/money";

/**
 * useDisplayFx — resolves the merchant's chosen DISPLAY currency
 * (Settings → Payments: USD/EUR/GBP/NGN/CAD/AUD) plus the authoritative
 * USD→currency FX rate, so fiat estimates can be shown next to crypto
 * amounts in the merchant's own currency ("≈ €12.34") anywhere in the app.
 *
 * The rate comes from the backend (`GET /api/user/display-currency`), which
 * reads a Redis-cached rate — no client-side FX guessing. Fails safe: if the
 * call fails we fall back to USD @ rate 1 so amounts still render.
 *
 * Data fetching standardized on the shared `useApiSWR` hook (refactor item 5).
 * SWR globally de-dupes the request across every mounted consumer (replacing
 * the old hand-rolled module-level cache). Revalidation is pinned off so the
 * behaviour matches the previous "fetch once and keep" semantics.
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

type Resolved = { currency: string; symbol: string; rate: number };

export function useDisplayFx() {
  const { data, error } = useApiSWR<Resolved>("user/display-currency", {
    select: (raw) => {
      const d = raw?.data;
      return {
        currency: d?.display_currency || "USD",
        symbol: d?.currency_info?.symbol || "$",
        rate: Number(d?.rate) > 0 ? Number(d.rate) : 1,
      };
    },
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });

  // Ready once we have data OR the call failed (fail-safe → USD @ 1).
  const state: DisplayFxState = data
    ? { ...data, ready: true }
    : error
      ? { ...DEFAULT, ready: true }
      : DEFAULT;

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
        return `${sym}${toFixedStr(val, 4).replace(/0+$/, "").replace(/\.$/, ".00")}`;
      }
      return `${sym}${toFixedStr(val, 6).replace(/0+$/, "").replace(/\.$/, ".00")}`;
    },
    [state.rate, state.symbol],
  );

  return { ...state, formatFromUsd };
}

export default useDisplayFx;
