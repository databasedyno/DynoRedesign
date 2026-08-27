import useSWR from "swr";

import axios from "@/axiosConfig";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";

/**
 * useTransactions — SWR-backed replacement for the old Redux `transactionReducer`
 * + `TransactionSaga` (data-layer consolidation, REFACTOR Part D / Phase 2).
 *
 * The list is keyed on the currently selected company (`[TRANSACTIONS_KEY, id]`),
 * exactly like `WalletDataContext`, so switching company changes the SWR key and
 * the list auto-refetches — no more manual `dispatch(TRANSACTION_FETCH)` on every
 * company switch (CompanySelector) or nav hover (NewSidebar, which now `preload()`s
 * the same key). Stale-while-revalidate + per-company caching come for free from
 * the global <SWRConfig> in _app.tsx.
 *
 * The old `TRANSACTION_DETAIL_FETCH` path was dead code — the details modal renders
 * entirely from the row it was opened with — so it is intentionally not carried over.
 * `TRANSACTION_EXPORT` becomes the imperative `exportTransactions()` below.
 */

export const TRANSACTIONS_KEY = "wallet/getAllTransactions";

export interface TransactionsData {
  customers_transactions: any[];
  self_transactions: any[];
  pagination: any;
}

/** Shared fetcher — POST getAllTransactions with the company scope from the key. */
export const transactionsFetcher = async (
  key: string | readonly [string, number | null],
): Promise<TransactionsData> => {
  const companyId = Array.isArray(key) ? (key[1] as number | null) : undefined;
  const body: Record<string, unknown> = {};
  if (companyId) body.company_id = companyId;
  const res = await axios.post(TRANSACTIONS_KEY, body);
  const d = res?.data?.data ?? {};
  return {
    customers_transactions: d.customers_transactions || [],
    self_transactions: d.self_transactions || [],
    pagination: d.pagination || null,
  };
};

export interface UseTransactionsResult {
  customersTransactions: any[];
  selfTransactions: any[];
  pagination: any;
  /** True only on the FIRST load for the current company (no cached rows yet). */
  loading: boolean;
  /** True whenever a (re)validation is in flight, incl. background refresh. */
  isValidating: boolean;
  error: unknown;
  /** Re-run the fetch (SWR mutate) for the current company. */
  refetch: () => Promise<any>;
}

export function useTransactions(): UseTransactionsResult {
  const selectedCompanyId = useSelectedCompanyId();

  // Fetch once a company is resolved; switching company changes the key so SWR
  // refetches and keeps a separate cache entry per company (mirrors wallets).
  const swrKey: [string, number] | null = selectedCompanyId
    ? [TRANSACTIONS_KEY, selectedCompanyId]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    transactionsFetcher,
  );

  return {
    customersTransactions: data?.customers_transactions ?? [],
    selfTransactions: data?.self_transactions ?? [],
    pagination: data?.pagination ?? null,
    loading: isLoading && data === undefined,
    isValidating,
    error,
    refetch: mutate,
  };
}

export interface ExportTransactionsParams {
  wallet?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  company_id?: number | null;
  settled_only?: boolean;
}

/**
 * Imperative CSV export (was the `TRANSACTION_EXPORT` saga). Downloads the blob
 * returned by the backend. Throws on failure so the caller can toast the error.
 */
export async function exportTransactions(
  params: ExportTransactionsParams,
): Promise<void> {
  const response = await axios.post("wallet/transactions/export", params || {}, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: (response.headers?.["content-type"] as string) || "text/csv",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `transactions_export_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default useTransactions;
