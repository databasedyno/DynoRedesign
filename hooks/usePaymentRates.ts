import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { nextSignal, isAbortError } from "@/utils/abortRegistry";

interface CurrencyRate {
  currency: string;
  amount: number;
  [key: string]: any;
}

interface UsePaymentRatesOptions {
  // Optional: callers may pass an as-yet-unresolved source/amount (e.g. the
  // legacy /payment components read them from the wallet store where they can
  // be undefined). The SWR key below is only built once both are truthy, so an
  // undefined source/amount simply means "don't fetch yet".
  source?: string;
  amount?: number;
  currencyList: string[];
  fixedDecimal?: boolean;
  enabled?: boolean;
}

interface UsePaymentRatesReturn {
  rates: CurrencyRate[] | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Keep the previous 30s freshness window as SWR's dedupe interval so identical
// rate requests across payment components collapse into a single network call.
const RATES_TTL_MS = 30_000;

type RatesKey = ["payment-rates", string, number, string, boolean];

const ratesFetcher = async ([, source, amount, currencyCsv, fixedDecimal]: RatesKey) => {
  const currencyList = currencyCsv ? currencyCsv.split(",") : [];
  // Cancel a prior rate request when the amount/currency set changes (the SWR
  // key changes) so a stale quote never overwrites the current one.
  const signal = nextSignal("payment-rates");
  const {
    data: { data },
  } = await axiosBaseApi.post(
    "/wallet/getCurrencyRates",
    {
      source,
      amount,
      currencyList,
      fixedDecimal,
    },
    { signal }
  );
  return data as CurrencyRate[];
};

/**
 * Shared hook for fetching merchant-side currency rates (/wallet/getCurrencyRates).
 * Backed by SWR so every payment component on a screen shares ONE cached, deduped
 * rate source (the SWR key is stable across identical source/amount/currency sets).
 */
export function usePaymentRates({
  source,
  amount,
  currencyList,
  fixedDecimal = false,
  enabled = true,
}: UsePaymentRatesOptions): UsePaymentRatesReturn {
  const currencyCsv = [...currencyList].sort().join(",");

  const key: RatesKey | null =
    enabled && source && amount && currencyList.length
      ? ["payment-rates", source, amount, currencyCsv, fixedDecimal]
      : null;

  const { data, error, isLoading, mutate } = useSWR<CurrencyRate[]>(
    key,
    ratesFetcher as any,
    {
      dedupingInterval: RATES_TTL_MS,
      keepPreviousData: true,
    }
  );

  return {
    rates: data,
    loading: isLoading,
    error:
      error && !isAbortError(error)
        ? error?.response?.data?.message ??
          error?.message ??
          "Failed to fetch rates"
        : null,
    refetch: () => {
      mutate();
    },
  };
}

export default usePaymentRates;
