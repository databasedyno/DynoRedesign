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

/**
 * Lightweight client-side per-chain address format check (instant feedback).
 * The backend re-validates authoritatively. Mirrors refundChains.ts patterns.
 */
const ADDR_PATTERNS: Record<string, RegExp> = {
  btc: /^(bc1[a-z0-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  ltc: /^(ltc1[a-z0-9]{11,87}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  doge: /^D[1-9A-HJ-NP-Za-km-z]{25,39}$/,
  bch: /^((bitcoincash:)?[qp][a-z0-9]{38,}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/i,
  evm: /^0x[0-9a-fA-F]{40}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  xrp: /^r[1-9A-HJ-NP-Za-km-z]{23,34}$/,
};

const familyForChain = (chain: string): string => {
  const c = String(chain || "").toUpperCase();
  if (c === "ETH" || c === "POLYGON" || c.includes("ERC20") || c.includes("POLYGON")) return "evm";
  if (c === "TRX" || c.includes("TRC20")) return "tron";
  if (c === "BTC") return "btc";
  if (c === "LTC") return "ltc";
  if (c === "DOGE") return "doge";
  if (c === "BCH") return "bch";
  if (c === "SOL") return "sol";
  if (c === "XRP" || c === "RLUSD") return "xrp";
  return "unknown";
};

export const isValidAddressFor = (chain: string, addr: string): boolean => {
  const a = String(addr || "").trim();
  if (!a) return false;
  const re = ADDR_PATTERNS[familyForChain(chain)];
  return re ? re.test(a) : a.length >= 12 && a.length <= 255;
};

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
