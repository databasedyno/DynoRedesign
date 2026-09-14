import { type Theme } from "@mui/material";

export type PayoutWallet = {
  wallet_id: number;
  wallet_name: string | null;
  wallet_type: string;
  company_name: string | null;
  address: string;
  address_masked: string;
  label: string;
};

export type PayoutOverview = {
  mode: "credit" | "cash";
  trc20_address: string | null;
  trc20_address_masked: string | null;
  address_verified_at: string | null;
  min_payout_usd: number;
  unpaid_balance_usd: number;
  credited_balance_usd: number;
  available_credit_usd: number;
  has_verified_address: boolean;
  auto: boolean;
  auto_min_usd: number;
  can_withdraw: boolean;
  pending_payout: { payout_id: number; amount_usd: number; status: string; requested_at: string } | null;
  wallets: PayoutWallet[];
};

export type PayoutHistoryItem = {
  payout_id: number;
  amount_usd: number;
  status: string;
  trc20_address_masked: string;
  tx_hash: string | null;
  tx_url: string | null;
  withdrawal_fee_usdt: number | null;
  requested_at: string | null;
  completed_at: string | null;
  error_message: string | null;
};

export type PillBtn = (variant: "primary" | "ghost") => Record<string, unknown>;

/** Pill button sx shared by every action in the payout card (busy dims + disables all of them). */
export const makePillBtn = (theme: Theme, busy: string | null): PillBtn => (variant) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 1, font: "inherit", lineHeight: 1.4,
  px: 2.25, py: 1, borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap" as const,
  fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600,
  border: variant === "ghost" ? `1px solid ${theme.palette.border.main}` : "none",
  bgcolor: variant === "primary" ? theme.palette.primary.main : theme.palette.background.paper,
  color: variant === "primary" ? ((theme.palette.primary as any).contrastText || "#fff") : theme.palette.text.primary,
  "&:hover": { opacity: 0.9, bgcolor: variant === "ghost" ? theme.palette.secondary.main : undefined },
  transition: "opacity .15s ease, background-color .15s ease",
  opacity: busy ? 0.7 : 1, pointerEvents: busy ? ("none" as const) : ("auto" as const),
});


