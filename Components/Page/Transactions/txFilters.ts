import { endOfDay, isWithinInterval, parseISO, startOfDay } from "date-fns";
import { isNeedsAction, toTxStatusBucket } from "@/helpers/txStatus";
import { ICustomerTransactions } from "@/utils/types";
import { DateRange } from "@/utils/types/dashboard";
import { TransactionSource, TransactionSourceType, TxStatusFilter } from "@/utils/types/transaction";

/** Wallet filter key → crypto code (order matches ALLCRYPTOCURRENCIES). */
export const walletMapping: Record<string, string> = {
  all: "all",
  wallet1: "BTC",
  wallet2: "ETH",
  wallet3: "LTC",
  wallet4: "DOGE",
  wallet5: "BCH",
  wallet6: "TRX",
  wallet7: "USDT-ERC20",
  wallet8: "USDT-TRC20",
  wallet9: "SOL",
  wallet10: "XRP",
  wallet11: "USDC-ERC20",
  wallet12: "POLYGON",
  wallet13: "RLUSD",
  wallet14: "USDT-POLYGON",
  wallet15: "RLUSD-ERC20",
};

export const cryptoToWalletKey: Record<string, string> = Object.fromEntries(
  Object.entries(walletMapping)
    .filter(([, code]) => code !== "all")
    .map(([key, code]) => [code.toUpperCase(), key]),
);

export type TxSourceFilter = TransactionSourceType | "all";

export interface TxFilters {
  searchTerm: string;
  dateRange: DateRange;
  selectedWallet: string;
  selectedSource: TxSourceFilter;
  selectedStatus: TxStatusFilter;
}

export const EMPTY_TX_FILTERS: TxFilters = {
  searchTerm: "",
  dateRange: { startDate: null, endDate: null },
  selectedWallet: "all",
  selectedSource: "all",
  selectedStatus: "all",
};

/** Source options shared by the desktop chip row and the phone filter sheet. */
export const SOURCE_OPTIONS: Array<{ value: TxSourceFilter; key: string; fallback: string }> = [
  { value: "all", key: "sourceAll", fallback: "All" },
  { value: "payment_link", key: "sourcePaymentLinks", fallback: "Payment links" },
  { value: "api", key: "sourceApi", fallback: "API" },
  { value: "contribution", key: "sourceContributions", fallback: "Donations" },
  { value: "tip", key: "sourceTips", fallback: "Tips" },
  { value: "product", key: "sourceProducts", fallback: "Store" },
  { value: "direct", key: "sourceDirect", fallback: "Direct" },
];

export const hasDateRange = (r: DateRange) => !!(r.startDate && r.endDate);

/** Every filter EXCEPT status — status counts are computed against this slice. */
export const matchesBaseFilters = (
  item: ICustomerTransactions,
  f: Omit<TxFilters, "selectedStatus">,
): boolean => {
  if (f.searchTerm) {
    const q = f.searchTerm.toLowerCase();
    const hit =
      item.id?.toLowerCase().includes(q) ||
      item.transaction_reference?.toLowerCase().includes(q) ||
      item.base_amount?.toString().includes(q) ||
      item.base_currency?.toLowerCase().includes(q);
    if (!hit) return false;
  }
  if (f.selectedWallet !== "all") {
    const target = walletMapping[f.selectedWallet];
    const itemCrypto = (item as any).crypto_currency || (item as any).crypto || item.base_currency;
    if (target && itemCrypto !== target) return false;
  }
  if (f.selectedSource !== "all") {
    const src = (item as any).source as TransactionSource | undefined;
    if ((src?.type || "direct") !== f.selectedSource) return false;
  }
  if (hasDateRange(f.dateRange) && item.createdAt) {
    try {
      const d = parseISO(item.createdAt);
      if (!isWithinInterval(d, { start: startOfDay(f.dateRange.startDate as Date), end: endOfDay(f.dateRange.endDate as Date) })) return false;
    } catch {
      return false;
    }
  }
  return true;
};

export const matchesStatus = (item: ICustomerTransactions, status: TxStatusFilter) => {
  if (status === "all") return true;
  const bucket = toTxStatusBucket(item.status);
  if (status === "needs_action") return isNeedsAction(bucket, item.createdAt ? new Date(item.createdAt).getTime() : 0);
  return bucket === status;
};

/** Number of non-search filters that differ from the defaults (badge on the phone "Filters" button). */
export const countActiveFilters = (f: TxFilters): number =>
  [f.selectedSource !== "all", f.selectedStatus !== "all", f.selectedWallet !== "all", hasDateRange(f.dateRange)].filter(Boolean).length;
