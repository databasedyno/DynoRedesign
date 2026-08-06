import useSWR from "swr";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { nextSignal, isAbortError } from "@/utils/abortRegistry";

/**
 * Shared reusable-wallets reader (GET /api/wallet/reusable-wallets). Backed by
 * SWR so the "reuse wallets from an existing company" data is cached + deduped
 * across mounts, and keyed by the target company so switching which company the
 * wallets are copied INTO refetches the correct exclusion list.
 *
 * The fetcher carries an AbortController signal (family "reusable-wallets") so a
 * target-company change cancels the previous in-flight request.
 */

export interface ReusableWallet {
  currency: string;
  label: string | null;
  wallet_name: string | null;
  wallet_address_preview: string;
}

export interface ReusableCompany {
  company_id: number;
  company_name: string;
  wallet_count: number;
  wallets: ReusableWallet[];
}

type ReusableKey = ["reusable-wallets", string | number];

const reusableFetcher = async ([, exclude]: ReusableKey): Promise<ReusableCompany[]> => {
  const params = exclude ? { exclude_company_id: exclude } : {};
  const signal = nextSignal("reusable-wallets");
  const { data } = await axiosBaseApi.get(API_ENDPOINTS.wallet.reusableWallets, {
    params,
    signal,
  });
  return (data?.data as ReusableCompany[]) || [];
};

export function useReusableWallets(targetCompanyId?: string | number) {
  const hasToken =
    typeof window !== "undefined" && !!localStorage.getItem("token");
  const key: ReusableKey | null = hasToken
    ? ["reusable-wallets", targetCompanyId ?? ""]
    : null;

  const { data, error, isLoading } = useSWR<ReusableCompany[]>(
    key,
    reusableFetcher as any,
    { dedupingInterval: 60_000, keepPreviousData: true }
  );

  return {
    companies: data ?? [],
    loading: isLoading && data === undefined,
    error: error && !isAbortError(error) ? error : null,
  };
}

export default useReusableWallets;
