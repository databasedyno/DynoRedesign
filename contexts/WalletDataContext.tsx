import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import useSWR from "swr";

import axios from "@/axiosConfig";
import { useCompanyStore } from "@/contexts/CompanyDataContext";

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

const WALLET_KEY = "wallet/getWallet";

const walletFetcher = async (key: string | [string, number]) => {
  const companyId = Array.isArray(key) ? key[1] : undefined;
  const params: Record<string, unknown> = {};
  if (companyId) params.company_id = companyId;
  const res = await axios.get(WALLET_KEY, { params });
  const apiData = res?.data?.data;

  // API returns company-grouped data: [{ company_id, company_name, wallets:[...] }].
  // Flatten to a single wallet list (same normalization the old saga did).
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
};

export interface WalletStore {
  walletList: any[];
  loading: boolean;
  fetched: boolean;
  otpVerified: boolean;
  addressError: string | null;
  addressErrorField: string | null;
  addressErrorNonce: number;
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

  const walletList: any[] = Array.isArray(data) ? data : [];
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
