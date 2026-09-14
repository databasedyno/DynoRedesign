import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import useSWR from "swr";

import axios from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { nextSignal } from "@/utils/abortRegistry";

// Stable empty array so consumers' memo/effect deps don't churn while data is undefined.
const EMPTY_LIST: any[] = [];

/**
 * WalletDataContext — SWR-backed replacement for the old Redux `walletReducer`
 * + `WalletSaga` read path. The wallet list is scoped to the currently selected
 * company (from CompanyDataContext); when the company changes, the SWR key
 * changes and the wallet list re-fetches automatically (replacing the old
 * "re-fetch wallets on company switch" saga dispatch + 8s cooldown).
 *
 * The exposed `useWalletStore()` mirrors the OLD reducer shape so consumers swap
 * `useSelector(s => s.walletReducer)` for a one-liner. The `addressError*`
 * fields are kept (inert) because AddWalletModal still reads them; the actual
 * wallet add/validate/delete flows use `axios` directly in their modals.
 */

export const WALLET_KEY = "wallet/getWallet";

// API returns company-grouped data: [{ company_id, company_name, wallets:[...] }].
// Flatten to a single wallet list (same normalization the old saga did).
function normalizeWallets(apiData: any): any[] {
  let flat: any[] = [];
  if (Array.isArray(apiData)) {
    for (const group of apiData) {
      if (Array.isArray(group.wallets)) {
        flat = flat.concat(
          group.wallets.map((w: any) => ({
            ...w,
            company_name: group.company_name,
            id: w.wallet_id,
          }))
        );
      }
    }
  }
  return flat;
}

const walletFetcher = async (key: string | [string, number]) => {
  const companyId = Array.isArray(key) ? key[1] : undefined;
  const params: Record<string, unknown> = {};
  if (companyId) params.company_id = companyId;
  // Cancel any in-flight wallet fetch for a previous company when the selected
  // company changes (the SWR key changes) — prevents a stale company's wallet
  // list from resolving after the user has already switched.
  const signal = nextSignal("wallet");
  const res = await axios.get(WALLET_KEY, { params, signal });
  return normalizeWallets(res?.data?.data);
};

/**
 * Non-aborting fetcher used ONLY for hover-prefetch (Instant Company Switch).
 * It deliberately does NOT go through the "wallet" abort family so warming a
 * hovered company's wallets never cancels the currently-active company's
 * in-flight request. Shares the same key + normalization as `walletFetcher`,
 * so `useSWR([WALLET_KEY, id])` reuses the warmed cache on the actual switch.
 */
export const walletPrefetchFetcher = async (key: string | [string, number]) => {
  const companyId = Array.isArray(key) ? key[1] : undefined;
  const params: Record<string, unknown> = {};
  if (companyId) params.company_id = companyId;
  const res = await axios.get(WALLET_KEY, { params });
  return normalizeWallets(res?.data?.data);
};

export interface WalletStore {
  walletList: any[];
  loading: boolean;
  fetched: boolean;
  otpVerified: boolean;
  addressError: string | null;
  addressErrorField: string | null;
  addressErrorNonce: number;
  /**
   * Legacy payment-context fields read by the fiat `/payment` flow
   * (Components/Page/Payment/* + paymentAuth HOC). They were part of the old
   * Redux `walletReducer`; the current flow decodes amount/currency from the
   * encrypted `d` query token, so these stay OPTIONAL (undefined) on the store.
   * Declared here so those legacy components type-check — runtime is unchanged
   * (they read `undefined`, exactly as before this annotation).
   */
  amount?: number;
  currency?: string;
  refetchWallets: () => Promise<any>;
  updateWallet: (payload: any) => Promise<any>;
  deleteWallet: (payload: any) => Promise<any>;
}

const WalletContext = createContext<WalletStore | null>(null);

export function WalletDataProvider({ children }: { children: React.ReactNode }) {
  const { selectedCompanyId } = useCompanyStore();

  const swrKey: [string, number] | null = selectedCompanyId
    ? [WALLET_KEY, selectedCompanyId]
    : null;

  const { data, isLoading, mutate } = useSWR(swrKey, walletFetcher);

  const walletList: any[] = useMemo(() => (Array.isArray(data) ? data : EMPTY_LIST), [data]);
  const fetched = data !== undefined;

  const refetchWallets = useCallback(() => mutate(), [mutate]);

  const updateWallet = useCallback(
    async (payload: any) => {
      const { id, otp, ...updateData } = payload || {};
      const response = await axios.put(`wallet/address/${id}`, {
        ...updateData,
        otp,
      });
      await mutate();
      return response?.data;
    },
    [mutate]
  );

  const deleteWallet = useCallback(
    async (payload: any) => {
      const { id, otp } = payload || {};
      const response = await axios.post(`wallet/wallet/delete/verify`, {
        wallet_id: id,
        otp,
      });
      await mutate();
      return response?.data;
    },
    [mutate]
  );

  const value = useMemo<WalletStore>(
    () => ({
      walletList,
      loading: isLoading,
      fetched,
      otpVerified: false,
      addressError: null,
      addressErrorField: null,
      addressErrorNonce: 0,
      refetchWallets,
      updateWallet,
      deleteWallet,
    }),
    [walletList, isLoading, fetched, refetchWallets, updateWallet, deleteWallet]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWalletStore(): WalletStore {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWalletStore must be used within WalletDataProvider");
  }
  return ctx;
}
