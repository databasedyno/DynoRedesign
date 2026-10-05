import { useCallback } from "react";
import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { toFixedStr, trimZeros } from "@/utils/money";
import { formatWithSymbol } from "@/utils/locale";

/**
 * useDisplayFx — resolves the selected brand's currency (Settings → Brand
 * currency: USD/EUR/GBP/NGN/CAD/AUD) plus the authoritative USD→currency FX
 * rate, so fiat estimates can be shown next to crypto amounts in the brand's
 * own currency ("≈ €12.34") anywhere in the app.
 *
 * The rate comes from the backend (`GET /api/user/display-currency?company_id=`),
 * which reads a Redis-cached rate — no client-side FX guessing. Fails safe: if
 * the call fails we fall back to USD @ rate 1 so amounts still render.
 *
 * Standard SWR revalidation is ON so a brand-currency change (which mutates
 * this key) or a stale localStorage-hydrated value refreshes promptly.
 */

interface DisplayFxState {
  currency: string;
  symbol: string;
  rate: number;
  /** True when the brand explicitly chose its currency (vs. the USD default). */
  explicit: boolean;
  ready: boolean;
}

const DEFAULT: DisplayFxState = {
  currency: "USD",
  symbol: "$",
  rate: 1,
  explicit: false,
  ready: false,
};

type Resolved = { currency: string; symbol: string; rate: number; explicit: boolean };

export function useDisplayFx() {
  const { selectedCompanyId } = useCompanyStore();
  const key = selectedCompanyId != null ? `user/display-currency?company_id=${selectedCompanyId}` : "user/display-currency";
  const { data, error } = useApiSWR<Resolved>(key, {
    select: (raw) => {
      const d = raw?.data;
      return {
        currency: d?.display_currency || "USD",
        symbol: d?.currency_info?.symbol || "$",
        rate: Number(d?.rate) > 0 ? Number(d.rate) : 1,
        explicit: d?.brand_currency_set === true,
      };
    },
    revalidateOnFocus: false,
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
      if (abs === 0) return formatWithSymbol(0, sym, 2);
      if (abs >= 1) return formatWithSymbol(val, sym, 2);
      // Sub-unit values keep extra precision (trimmed) so they don't collapse to 0.00.
      const trimmed = trimZeros(toFixedStr(val, abs >= 0.01 ? 4 : 6));
      const frac = (trimmed.split(".")[1] || "").length;
      return formatWithSymbol(trimmed, sym, Math.max(2, frac));
    },
    [state.rate, state.symbol],
  );

  return { ...state, formatFromUsd };
}

export default useDisplayFx;
