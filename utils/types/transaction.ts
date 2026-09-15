import type { ReactNode } from "react";
import { menuItem } from "../types";
import { DateRange } from "./dashboard";

/** Status chips on the transactions table toolbar ("all" = no status filter,
 *  "needs_action" = saved filter: underpaid + confirming past the payment window). */
export type TxStatusFilter =
  | "all"
  | "needs_action"
  | "settled"
  | "confirmed"
  | "processing"
  | "underpaid"
  | "pending"
  | "awaiting_payment"
  | "unpaid"
  | "failed";

/** Date presets on the transactions page — 30 days is the default view. */
export type TxRangePreset = "today" | "7d" | "30d" | "90d" | "all" | "custom";

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

/** Auto-convert (Binance) payout details, mirrored from the API `auto_convert` object. */
export interface AutoConvertInfo {
  conversionId: number | string;
  status: string;
  sourceCurrency: string;
  sourceAmount: number | null;
  targetCurrency: string;
  targetAmount: number | null;
  settlementChain: string | null;
  settlementWalletAddress: string | null;
  merchantPayoutUsd: number | null;
  withdrawalFee: number | null;
  /** On-chain hash of the Binance → merchant withdrawal (null when pending / off-chain). */
  payoutTxHash: string | null;
  /** Binance settled the payout internally (merchant address is Binance-hosted) — no chain hash. */
  payoutOffchain: boolean;
  payoutRef: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export const toAutoConvertInfo = (raw: any): AutoConvertInfo | undefined => {
  if (!raw || typeof raw !== "object") return undefined;
  return {
    conversionId: raw.conversion_id,
    status: String(raw.status || ""),
    sourceCurrency: String(raw.source_currency || ""),
    sourceAmount: raw.source_amount != null ? Number(raw.source_amount) : null,
    targetCurrency: String(raw.target_currency || ""),
    targetAmount: raw.target_amount != null ? Number(raw.target_amount) : null,
    settlementChain: raw.settlement_chain || null,
    settlementWalletAddress: raw.settlement_wallet_address || null,
    merchantPayoutUsd: raw.merchant_payout_usd != null ? Number(raw.merchant_payout_usd) : null,
    withdrawalFee: raw.withdrawal_fee != null ? Number(raw.withdrawal_fee) : null,
    payoutTxHash: raw.payout_tx_hash || null,
    payoutOffchain: raw.payout_offchain === true,
    payoutRef: raw.payout_ref || raw.withdrawal_id || null,
    completedAt: raw.completed_at || null,
    errorMessage: raw.error_message || null,
  };
};

export interface ExtendedTransaction {
  id: string;
  crypto: string;
  amount: string;
  /** Numeric crypto amount (for sorting). */
  cryptoAmountRaw: number;
  usdValue: string;
  /** Raw authoritative USD value (number) so the UI can convert to the
   *  merchant's display currency (EUR/GBP/…) via useDisplayFx. */
  usdValueRaw: number;
  dateTime: string;
  /** Epoch ms of createdAt (for sorting). */
  createdAtTs: number;
  status: "pending" | "confirmed" | "settled" | "failed" | "processing" | "underpaid" | "unpaid" | "awaiting_payment";
  /** Buyer on file for this payment (from the checkout capture), if any. */
  customerName?: string | null;
  customerEmail?: string | null;
  /** Short chain label for the asset ("TRC-20", "Ethereum"…). */
  network?: string;
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
  /** Full auto-convert payout details (Binance → merchant), when the payment was converted. */
  autoConvert?: AutoConvertInfo;
  // Session 48: source metadata for the "Source" column + filter chips
  source?: TransactionSource;
  // Session 57: tax fields (persisted at settlement) for VAT column + details
  taxAmount?: number;
  taxRate?: number;
  taxLabel?: string;
  taxCountryCode?: string;
  customerVatId?: string;
  reverseCharge?: boolean;
  // Referral fee-credit (Option 1.a): USD of the platform fee covered by the
  // merchant's own referral revenue-share balance on this payment (0 if none).
  referralCreditUsd?: number;
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

/** Sortable transaction table columns. */
export type TxSortKey = "amount" | "usdValue" | "dateTime";
export type TxSortDir = "asc" | "desc";

export interface TransactionsTableProps {
  transactions: ExtendedTransaction[];
  rowsPerPage?: number;
  /** Strip rendered inside the table card, above the column headers. */
  toolbar?: ReactNode;
}
export interface TransactionsTopBarProps {
  onSearch?: (searchTerm: string) => void;
  onDateRangeChange?: (dateRange: DateRange) => void;
  onWalletChange?: (wallet: string) => void;
  onSourceChange?: (source: TransactionSourceType | "all") => void;
  initialSource?: TransactionSourceType | "all";
  /** Phone (<768px): opens the bottom-sheet filter; badge shows the active count. */
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  /** Date preset (default 30d); "custom" when an explicit window is applied. */
  range?: TxRangePreset;
  onRangeChange?: (preset: Exclude<TxRangePreset, "custom">) => void;
}

export interface RowsPerPageSelectorProps {
  value: number;
  onChange: (value: number) => void;
  menuItems?: menuItem[];
}
