import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import type { RangeId } from "../ranges";

export interface OverviewAsset {
  asset: string;
  count: number;
  amount: number;
}

export interface OverviewSource {
  kind: "link" | "product";
  id: number | string;
  title: string | null;
  link_type: string;
  is_tip_jar: boolean;
  paid_count: number;
  amount: number;
}

export interface DashboardOverview {
  range: { period: string; start: string; end: string };
  currency: string;
  currency_symbol: string;
  pulse: { confirming_count: number; awaiting_count: number; last_paid_at: string | null };
  settled: {
    net: number;
    gross: number;
    fees: number;
    count: number;
    previous_net: number;
    previous_count: number;
    delta_pct: number;
    avg_ticket: number;
  };
  in_flight: { count: number; amount: number };
  forwarded: {
    count: number;
    amount: number;
    last_at: string | null;
    by_asset: OverviewAsset[];
    auto_convert: {
      enabled: boolean;
      target: string | null;
      converted_amount: number;
      converted_count: number;
    } | null;
  };
  health: {
    created: number;
    paid: number;
    completion_rate: number;
    previous_completion_rate: number;
    median_settle_minutes: number | null;
    previous_median_settle_minutes: number | null;
    underpaid_count: number;
    expired_count: number;
    exception_rate: number;
    previous_exception_rate: number;
  };
  attention: {
    underpaid_open: number;
    expired_today: { count: number; amount: number };
    confirming_stale: number;
    webhook_failures_24h: number;
    webhook_deliveries_24h: number;
    webhook_last_failed_at: string | null;
    webhook_url: string | null;
    stale_api_keys: Array<{ hint: string | null; name: string | null; age_days: number }>;
    coins_without_wallet: string[];
    paylinks_expiring_48h: number;
  };
  top_sources: OverviewSource[];
  generated_at: string;
}

export interface OverviewRange {
  range: RangeId;
  custom: { startDate: string; endDate: string } | null;
}

/** Command-centre aggregates for the selected brand + range (60 s refresh). */
export const useDashboardOverview = ({ range, custom }: OverviewRange) => {
  const { selectedCompanyId } = useCompanyStore();
  const params = new URLSearchParams();
  if (selectedCompanyId != null) params.set("company_id", String(selectedCompanyId));
  if (custom) {
    params.set("startDate", custom.startDate);
    params.set("endDate", custom.endDate);
  } else {
    params.set("period", range);
  }
  return useApiSWR<DashboardOverview | null>(
    selectedCompanyId != null ? `dashboard/overview?${params.toString()}` : null,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 15_000,
      keepPreviousData: true,
      select: (raw) => (raw?.data as DashboardOverview) ?? null,
    },
  );
};

export default useDashboardOverview;
