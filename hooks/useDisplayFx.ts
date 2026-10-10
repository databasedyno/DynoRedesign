import { useCallback } from "react";
import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { toFixedStr, trimZeros } from "@/utils/money";
import { formatWithSymbol } from "@/utils/locale";

/**
 * useDisplayFx — the brand currency + authoritative USD→currency rate from
 * `GET /api/user/display-currency?company_id=` so fiat estimates show in the
 * brand's own currency ("≈ €12.34").
 *
 * Audit 2026-06: `currency`/`symbol` are the EFFECTIVE currency the rate converts
 * into. When the backend has no live or last-known rate it answers USD @ 1, so
 * symbol and numbers always agree. The rate re-checks every 60s and on focus;
 * SWR keeps the last good value on error, and `isStale`/`asOf` drive the
 * "rate as of hh:mm" label.
 */

export interface FxProvenance {
  asOf: string | null;
  isStale: boolean;
  /** Brand currency wanted but unavailable → amounts are shown in USD. */
  fallback: boolean;
  requestedCurrency: string;
}

interface Resolved extends FxProvenance {
  currency: string;
  symbol: string;
  rate: number;
  explicit: boolean;
}

const DEFAULT: Resolved = {
  currency: "USD",
  symbol: "$",
  rate: 1,
  explicit: false,
  asOf: null,
  isStale: false,
  fallback: false,
  requestedCurrency: "USD",
};

/** A rate older than this is labelled even if the backend still calls it fresh. */
const CLIENT_STALE_MS = 15 * 60 * 1000;

const resolve = (d: any): Resolved => {
  const requested = d?.display_currency || "USD";
  const rate = Number(d?.rate);
  const effective = d?.effective_currency || requested;
  // Never pair a non-USD symbol with an unusable rate.
  if (!(rate > 0) || (effective !== "USD" && rate === 1 && !d?.rate_as_of)) {
    return { ...DEFAULT, explicit: d?.brand_currency_set === true, fallback: requested !== "USD", requestedCurrency: requested };
  }
  return {
    currency: effective,
    symbol: (d?.effective_currency_info || d?.currency_info)?.symbol || "$",
    rate,
    explicit: d?.brand_currency_set === true,
    asOf: d?.rate_as_of || null,
    isStale: d?.rate_is_stale === true,
    fallback: d?.rate_fallback === true,
    requestedCurrency: requested,
  };
};

export function useDisplayFx() {
  const { selectedCompanyId } = useCompanyStore();
  const key = selectedCompanyId != null ? `user/display-currency?company_id=${selectedCompanyId}` : "user/display-currency";
  const { data, error } = useApiSWR<Resolved>(key, {
    select: (raw) => resolve(raw?.data),
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 20_000,
    keepPreviousData: true,
  });

  const base = data ?? DEFAULT;
  const ageStale = !!base.asOf && Date.now() - new Date(base.asOf).getTime() > CLIENT_STALE_MS;
  const state = {
    ...base,
    // Showing a cached rate while the refresh fails → label it.
    isStale: base.currency !== "USD" && (base.isStale || ageStale || (!!error && !!data)),
    ready: !!data || !!error,
  };

  /**
   * USD amount → display currency, formatted with its symbol. null for
   * non-finite input. Sub-unit values keep extra precision.
   */
  const formatFromUsd = useCallback(
    (usd: number | string): string | null => {
      const n = Number(usd);
      if (!Number.isFinite(n)) return null;
      const val = n * state.rate;
      const sym = state.symbol || "";
      const abs = Math.abs(val);
      if (abs === 0) return formatWithSymbol(0, sym, 2);
      if (abs >= 1) return formatWithSymbol(val, sym, 2);
      const trimmed = trimZeros(toFixedStr(val, abs >= 0.01 ? 4 : 6));
      const frac = (trimmed.split(".")[1] || "").length;
      return formatWithSymbol(trimmed, sym, Math.max(2, frac));
    },
    [state.rate, state.symbol],
  );

  return { ...state, formatFromUsd };
}

export default useDisplayFx;
