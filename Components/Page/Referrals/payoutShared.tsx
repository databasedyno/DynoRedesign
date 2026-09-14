import React from "react";
import { TextField, type Theme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { MONO } from "@/styles/uiKit";

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

/** Primary pill that is only enabled once the 6-digit OTP is filled and nothing is in flight. */
export const otpGatedSx = (pillBtn: PillBtn, otp: string, busy: string | null) => ({
  ...pillBtn("primary"),
  opacity: otp.length === 6 && !busy ? 1 : 0.6,
  pointerEvents: otp.length === 6 && !busy ? "auto" : "none",
});

export const OtpField: React.FC<{ value: string; onChange: (v: string) => void; testId: string }> = ({ value, onChange, testId }) => {
  const { t } = useTranslation("referrals");
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder={t("payoutOtpPlaceholder", { defaultValue: "6-digit code" })}
      size="small"
      inputProps={{ "data-testid": testId, inputMode: "numeric", style: { fontFamily: MONO, letterSpacing: "3px" } }}
      sx={{ width: 160 }}
    />
  );
};
