import useApiSWR from "@/hooks/useApiSWR";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { InvoicePeriod, periodParams } from "./invoicePeriods";

export interface PeriodSummary {
  range: { start: string; end: string };
  currency: string;
  currency_symbol: string;
  collected: number;
  net: number;
  fees: number;
  payments_count: number;
  tax_collected: number;
  taxed_orders: number;
  receipts_count: number;
  receipts_vat: number;
  generated_at: string;
}

/** Receipts & Tax header totals (collected · tax · fees) for the selected period. */
export const usePeriodSummary = (period: InvoicePeriod) => {
  const { selectedCompanyId } = useCompanyStore();
  const params = new URLSearchParams(periodParams(period));
  if (selectedCompanyId != null) params.set("company_id", String(selectedCompanyId));
  const qs = params.toString();
  return useApiSWR<PeriodSummary | null>(
    `invoices/period-summary${qs ? `?${qs}` : ""}`,
    { keepPreviousData: true, dedupingInterval: 15_000, revalidateOnFocus: false, select: (raw) => (raw?.data as PeriodSummary) ?? null },
  );
};

export default usePeriodSummary;
