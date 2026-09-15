export type InvoicePeriod = "all" | "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "lastYear";

export const INVOICE_PERIODS: InvoicePeriod[] = ["all", "thisMonth", "lastMonth", "thisQuarter", "thisYear", "lastYear"];

export const PERIOD_LABEL_KEY: Record<InvoicePeriod, string> = {
  all: "invoices.allTime",
  thisMonth: "invoices.thisMonth",
  lastMonth: "invoices.lastMonth",
  thisQuarter: "invoices.thisQuarter",
  thisYear: "invoices.thisYear",
  lastYear: "invoices.lastYear",
};

export const isInvoicePeriod = (v: unknown): v is InvoicePeriod => INVOICE_PERIODS.includes(v as InvoicePeriod);

/** Local-time window for a preset; open-ended presets return `end: null` (a stable key — no `now` churn), `all` returns nulls. */
export const periodRange = (p: InvoicePeriod, now = new Date()): { start: Date | null; end: Date | null } => {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case "thisMonth":
      return { start: new Date(y, m, 1), end: null };
    case "lastMonth":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
    case "thisQuarter":
      return { start: new Date(y, Math.floor(m / 3) * 3, 1), end: null };
    case "thisYear":
      return { start: new Date(y, 0, 1), end: null };
    case "lastYear":
      return { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31, 23, 59, 59, 999) };
    default:
      return { start: null, end: null };
  }
};

/** start_date / end_date query params for the invoices, tax-report and period-summary endpoints. */
export const periodParams = (p: InvoicePeriod): Record<string, string> => {
  const { start, end } = periodRange(p);
  const out: Record<string, string> = {};
  if (start) out.start_date = start.toISOString();
  if (end) out.end_date = end.toISOString();
  return out;
};
