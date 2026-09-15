import React from "react";
import { Stack, Typography } from "@mui/material";

export type RefundSourceType = "product_order" | "payment_link";

export interface Preview {
  chain: string;
  asset: string;
  asset_kind: "native" | "token";
  original_crypto_amount: number;
  max_refundable: number;
  customer_refund_address: string;
  gas_buffer_native: number;
  gas_buffer_symbol: string;
  gas_coverage: "in_asset" | "fee_wallet";
  deposit_asset: string;
  full_refund_deposit_total: number;
  dry_run: boolean;
  needs_address?: boolean;
  address_invalid?: boolean;
}

export interface RefundRow {
  refund_id: string;
  status: string;
  asset: string;
  chain: string;
  refund_amount: string | number;
  merchant_deposit_total: string | number;
  deposit_asset: string;
  dyno_deposit_address: string;
  customer_refund_address: string;
  gas_buffer_native: string | number;
  gas_buffer_symbol: string;
  is_dry_run: boolean;
  expires_at?: string;
}

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  awaiting_deposit: { bg: "#FEF3C7", fg: "#92400E" },
  deposit_detected: { bg: "#DBEAFE", fg: "#1E40AF" },
  forwarding: { bg: "#DBEAFE", fg: "#1E40AF" },
  completed: { bg: "#DCFCE7", fg: "#166534" },
  cancelled: { bg: "#E5E7EB", fg: "#4B5563" },
  failed: { bg: "#FEE2E2", fg: "#991B1B" },
  expired: { bg: "#E5E7EB", fg: "#4B5563" },
};

export { isValidAddressFor } from "@/helpers/addressFormat";

export const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <Stack direction="row" justifyContent="space-between" spacing={2}>
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography
      variant="caption"
      sx={{ fontWeight: 600, textAlign: "right", wordBreak: "break-all", fontFamily: mono ? "var(--font-mono)" : undefined }}
    >
      {value}
    </Typography>
  </Stack>
);
