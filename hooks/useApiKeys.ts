import { useCallback } from "react";
import useSWR from "swr";
import { useDispatch } from "react-redux";

import axios from "@/axiosConfig";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { useSelectedCompanyId } from "@/contexts/CompanyDataContext";
import { IApi } from "@/utils/types";

/**
 * useApiKeys — SWR-backed replacement for the old Redux `apiReducer` + `ApiSaga`
 * (data-layer consolidation, REFACTOR Part D / Phase 2, Wave 2).
 *
 * The list is keyed on the selected company (`[API_KEYS_KEY, id]`, same as
 * WalletDataContext / useTransactions), so switching company changes the SWR key
 * and the keys auto-refetch — no more manual `dispatch(API_FETCH)` on company
 * switch (CompanySelector) or page mount. Mutations mirror `CompanyDataContext`:
 * call the endpoint, toast, then `mutate()` (server is source of truth).
 *
 * Not carried over (were dead code in the app):
 *   - API_INSERT / addApi  → the "Create key" modal is a stub; keys are
 *     auto-provisioned server-side.
 *   - API_UPDATE saga path → the only update (settlement currency) already runs
 *     as a direct axios PUT in ApiKeyCard, then calls `refetch()`.
 */

export const API_KEYS_KEY = "userApi/getApi";

export const apiKeysFetcher = async (
  key: string | readonly [string, number | null],
): Promise<IApi[]> => {
  const companyId = Array.isArray(key) ? (key[1] as number | null) : undefined;
  const params: Record<string, string> = {};
  if (companyId) params.company_id = String(companyId);
  const res = await axios.get(API_KEYS_KEY, { params });
  const data = res?.data?.data;
  return (data?.all || data || []) as IApi[];
};

export interface UseApiKeysResult {
  apiList: IApi[];
  /** True only on the FIRST load for the current company (no cached keys yet). */
  loading: boolean;
  isValidating: boolean;
  error: unknown;
  refetch: () => Promise<any>;
  deleteApiKey: (id: number | string) => Promise<void>;
  regenerateApiKey: (id: number | string) => Promise<any>;
  toggleApiStatus: (id: number | string, status: string) => Promise<void>;
}

export function useApiKeys(): UseApiKeysResult {
  const dispatch = useDispatch();
  const selectedCompanyId = useSelectedCompanyId();

  const swrKey: [string, number] | null = selectedCompanyId
    ? [API_KEYS_KEY, selectedCompanyId]
    : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    apiKeysFetcher,
  );

  const apiList: IApi[] = Array.isArray(data) ? data : [];

  const refetch = useCallback(() => mutate(), [mutate]);

  const deleteApiKey = useCallback(
    async (id: number | string) => {
      try {
        const {
          data: { message },
        } = await axios.delete("userApi/deleteApi/" + id);
        dispatch({ type: TOAST_SHOW, payload: { message } });
        await mutate();
      } catch (e: any) {
        const message =
          e?.response?.data?.message ?? e?.message ?? "Failed to delete API key";
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        throw e;
      }
    },
    [dispatch, mutate],
  );

  const regenerateApiKey = useCallback(
    async (id: number | string) => {
      try {
        const response = await axios.post(`userApi/regenerateKey/${id}`);
        const rd = response?.data;
        if (rd?.success === false) {
          throw new Error(rd.message || "Failed to regenerate API key");
        }
        dispatch({
          type: TOAST_SHOW,
          payload: { message: rd?.message || "API key regenerated successfully" },
        });
        await mutate();
        return rd?.data || rd;
      } catch (e: any) {
        const message =
          e?.response?.data?.message ??
          e?.message ??
          "Failed to regenerate API key";
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        throw e;
      }
    },
    [dispatch, mutate],
  );

  const toggleApiStatus = useCallback(
    async (id: number | string, status: string) => {
      try {
        const response = await axios.put(`userApi/toggleStatus/${id}`, { status });
        const rd = response?.data;
        if (rd?.success === false) {
          throw new Error(rd.message || "Failed to toggle API status");
        }
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: rd?.message || "API status updated successfully",
          },
        });
        await mutate();
      } catch (e: any) {
        const message =
          e?.response?.data?.message ??
          e?.message ??
          "Failed to toggle API status";
        dispatch({ type: TOAST_SHOW, payload: { message, severity: "error" } });
        throw e;
      }
    },
    [dispatch, mutate],
  );

  return {
    apiList,
    loading: isLoading && data === undefined,
    isValidating,
    error,
    refetch,
    deleteApiKey,
    regenerateApiKey,
    toggleApiStatus,
  };
}

export default useApiKeys;
