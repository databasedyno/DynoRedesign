import React from "react";
import StatusChip from "@/Components/UI/StatusChip";

/**
 * TransactionStatusBadge — back-compat alias for the canonical <StatusChip/>
 * (UX plan 1.4). Existing call sites keep working; new code should import
 * StatusChip directly.
 */
export type TxStatus =
  | "pending"
  | "processing"
  | "confirmed"
  | "settled"
  | "failed"
  | "unpaid"
  | "awaiting_payment"
  | string;

export { txStatusTone } from "@/helpers/txStatus";

interface Props {
  status: TxStatus;
  autoConverted?: boolean;
  variant?: "inline" | "pill";
  "data-testid"?: string;
}

export const TransactionStatusBadge: React.FC<Props> = (props) => <StatusChip {...props} />;

export default TransactionStatusBadge;
