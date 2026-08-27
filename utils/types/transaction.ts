import { menuItem } from "../types";
import { DateRange } from "./dashboard";

export type TransactionSourceType =
  | "payment_link"
  | "api"
  | "contribution"
  | "tip"
  | "product"
  | "direct";

export interface TransactionSource {
  type: TransactionSourceType;
  title: string | null;
  ref: string | number | null;
  link_id: number | null;
  link_type: string | null;
  parent_link_id: number | null;
  order_id: number | null;
  order_ref: string | null;
}

export interface ExtendedTransaction {
  id: string;
  crypto: string;
  amount: string;
  usdValue: string;
  /** Raw authoritative USD value (number) so the UI can convert to the
   *  merchant's display currency (EUR/GBP/…) via useDisplayFx. */
  usdValueRaw: number;
  dateTime: string;
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "unpaid" | "awaiting_payment";
  fees?: number | string;
  feesBreakdown?: {
    platform: number;
    blockchain: number;
    fixed: number;
  };
  confirmations?: string;
  incomingTransactionId?: string;
  outgoingTransactionId?: string;
  callbackUrl?: string;
  settlementAddress?: string;
  webhookResponse?: {
    status: string;
    txid: string;
    amount: number;
    confirmations: number;
  };
  autoConverted?: boolean;
  autoConvertTarget?: string;
  autoConvertDisplayStatus?: string;
  // Session 48: source metadata for the "Source" column + filter chips
  source?: TransactionSource;
  // Session 57: tax fields (persisted at settlement) for VAT column + details
  taxAmount?: number;
  taxRate?: number;
  taxLabel?: string;
  taxCountryCode?: string;
  customerVatId?: string;
  reverseCharge?: boolean;
}

export interface ICustomerTransactions {
  user_id: number;
  payment_mode: string;
  base_amount: number;
  base_currency: string;
  transaction_reference: string;
  transaction_type: string;
  status: string;
  customer_id: number;
  createdAt: string;
  updatedAt: string;
  transaction_details: string;
  id: string;
  customer_name: string;
  email: string;
  company_name: string;
  company_id: number;
  source?: TransactionSource;
}

export interface TransactionDetailsModalProps {
  open: boolean;
  onClose: () => void;
  transaction: ExtendedTransaction | null;
}

export interface TransactionsTableProps {
  transactions: ExtendedTransaction[];
  rowsPerPage?: number;
}
export interface TransactionsTopBarProps {
  onSearch?: (searchTerm: string) => void;
  onDateRangeChange?: (dateRange: DateRange) => void;
  onWalletChange?: (wallet: string) => void;
  onSourceChange?: (source: TransactionSourceType | "all") => void;
  onExport?: () => void;
  settledOnly?: boolean;
  onSettledOnlyChange?: (value: boolean) => void;
  initialSource?: TransactionSourceType | "all";
}

export interface RowsPerPageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  menuItems?: menuItem[];
}
