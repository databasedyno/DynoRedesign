import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { TxRangePreset } from "@/utils/types/transaction";

export interface PayoutWallet {
  wallet_id: number;
  wallet_type: string;
  wallet_name: string | null;
  address: string;
  address_masked: string;
  forwarded_count: number;
  forwarded_amount: number;
  last_forward_at: string | null;
  last_tx_hash: string | null;
}

export interface PayoutForward {
  id: string;
  transaction_id: number;
  asset: string;
  crypto_amount: number;
  amount: number;
  forwarded_at: string | null;
  tx_hash: string | null;
  wallet_type: string;
  wallet_address_masked: string;
  converted: boolean;
  target_amount: number | null;
  target_currency: string | null;
}

export interface FailedConversion {
  conversion_id: number;
  transaction_id: number;
  payment_id: string | null;
  source_currency: string;
  source_amount: number;
  amount: number;
  target_currency: string;
  settlement_chain: string | null;
  error_message: string | null;
  retry_count: number;
  updated_at: string;
}

export interface PayoutsData {
  range: { period: string; start: string; end: string };
  currency: string;
  currency_symbol: string;
  totals: {
    forwarded_count: number;
    forwarded_amount: number;
    last_forward_at: string | null;
    awaiting_count: number;
    awaiting_amount: number;
  };
  by_asset: Array<{ asset: string; count: number; amount: number; crypto_amount: number }>;
  wallets: PayoutWallet[];
  coverage: { missing_coins: string[] };
  recent: PayoutForward[];
  attention: {
    failed_conversions: FailedConversion[];
    in_progress_conversions: Array<Omit<FailedConversion, "error_message" | "retry_count" | "settlement_chain"> & { status: string }>;
    stuck_forwards: Array<{ id: string; transaction_id: number; asset: string; crypto_amount: number; amount: number; settled_at: string }>;
  };
  generated_at: string;
}

export interface PayoutsRange {
  range: TxRangePreset;
  custom: { startDate: string; endDate: string } | null;
}

/** Forwarding aggregates for the selected brand + range (30 s refresh). */
export const useDashboardPayouts = ({ range, custom }: PayoutsRange) => {
  const { selectedCompanyId } = useCompanyStore();
  const params = new URLSearchParams();
  if (selectedCompanyId != null) params.set("company_id", String(selectedCompanyId));
  if (range === "custom" && custom) {
    params.set("startDate", custom.startDate);
    params.set("endDate", custom.endDate);
  } else {
    params.set("period", range === "custom" ? "30d" : range);
  }
  return useApiSWR<PayoutsData | null>(
    selectedCompanyId != null ? `dashboard/payouts?${params.toString()}` : null,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
      keepPreviousData: true,
      select: (raw) => (raw?.data as PayoutsData) ?? null,
    },
  );
};

export default useDashboardPayouts;
