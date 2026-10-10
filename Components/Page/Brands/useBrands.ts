import useApiSWR from "@/hooks/useApiSWR";

export type BrandsRange = "today" | "7d" | "30d" | "90d" | "1y" | "all";

export interface BrandAttentionBreakdown {
  stuck_forwards: number;
  coins_without_wallet: number;
  webhook_failures: number;
}

export interface BrandRow {
  company_id: number;
  company_name: string | null;
  photo: string | null;
  native_currency: string;
  account_type: string | null;
  is_member: boolean;
  member_role: string;
  is_new: boolean;
  settled_amount: number;
  payments_count: number;
  pending_amount: number;
  pending_count: number;
  last_paid_at: string | null;
  attention_count: number;
  attention: BrandAttentionBreakdown;
}

export interface BrandsSummaryTotals {
  brand_count: number;
  settled_amount: number;
  payments_count: number;
  pending_amount: number;
  attention_count: number;
}

export interface BrandsData {
  range: { period: string; start: string; end: string };
  currency: string;
  currency_symbol: string;
  fx?: import("@/Components/UI/FxAsOfLabel").FxInfo;
  summary: BrandsSummaryTotals;
  brands: BrandRow[];
  generated_at: string;
}

/**
 * Account-wide portfolio overview across every brand the user can access
 * (owned + active team memberships). All amounts are pre-converted to the
 * account display currency by the backend so the brands are comparable.
 */
export const useBrands = (period: BrandsRange) => {
  const params = new URLSearchParams();
  params.set("period", period);
  return useApiSWR<BrandsData | null>(`dashboard/brands?${params.toString()}`, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
    keepPreviousData: true,
    select: (raw) => (raw?.data as BrandsData) ?? null,
  });
};

export default useBrands;
