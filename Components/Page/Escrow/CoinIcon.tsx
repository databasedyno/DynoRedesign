import React from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

/**
 * Crypto coin icon + optional network chip for the escrow surfaces.
 * Reuses the exact `cryptocurrency-color:*` icon set the hosted checkout uses,
 * so the escrow UI shows the same real coin marks (no generic glyphs).
 */
export interface CoinMeta {
  symbol: string;
  icon: string;
  iconColor?: string;
  networkLabel?: string;
}

const MAP: Record<string, CoinMeta> = {
  BTC: { symbol: "BTC", icon: "cryptocurrency-color:btc", networkLabel: "Bitcoin" },
  ETH: { symbol: "ETH", icon: "cryptocurrency-color:eth", networkLabel: "Ethereum" },
  LTC: { symbol: "LTC", icon: "cryptocurrency-color:ltc", networkLabel: "Litecoin" },
  DOGE: { symbol: "DOGE", icon: "cryptocurrency-color:doge", networkLabel: "Dogecoin" },
  BCH: { symbol: "BCH", icon: "cryptocurrency-color:bch", networkLabel: "Bitcoin Cash" },
  SOL: { symbol: "SOL", icon: "cryptocurrency-color:sol", networkLabel: "Solana" },
  XRP: { symbol: "XRP", icon: "cryptocurrency-color:xrp", networkLabel: "XRP Ledger" },
  TRX: { symbol: "TRX", icon: "cryptocurrency-color:trx", networkLabel: "Tron" },
  POLYGON: { symbol: "POL", icon: "cryptocurrency-color:matic", networkLabel: "Polygon" },
  POL: { symbol: "POL", icon: "cryptocurrency-color:matic", networkLabel: "Polygon" },
  USDC: { symbol: "USDC", icon: "cryptocurrency-color:usdc", networkLabel: "USD Coin" },
  USDT: { symbol: "USDT", icon: "cryptocurrency-color:usdt", networkLabel: "Tether" },
  "USDT-TRON": { symbol: "USDT", icon: "cryptocurrency-color:usdt", networkLabel: "Tron (TRC-20)" },
  "USDT-TRC20": { symbol: "USDT", icon: "cryptocurrency-color:usdt", networkLabel: "Tron (TRC-20)" },
  "USDT-ERC20": { symbol: "USDT", icon: "cryptocurrency-color:usdt", networkLabel: "Ethereum (ERC-20)" },
  "USDT-POLYGON": { symbol: "USDT", icon: "cryptocurrency-color:usdt", networkLabel: "Polygon" },
  "USDC-ERC20": { symbol: "USDC", icon: "cryptocurrency-color:usdc", networkLabel: "Ethereum (ERC-20)" },
  "USDC-POLYGON": { symbol: "USDC", icon: "cryptocurrency-color:usdc", networkLabel: "Polygon" },
};

const FALLBACK: CoinMeta = { symbol: "?", icon: "cryptocurrency-color:generic", iconColor: "#4338CA" };

/** Resolve display metadata for any escrow coin code (funding or payout). */
export function coinInfo(code?: string | null): CoinMeta {
  if (!code) return FALLBACK;
  const key = String(code).toUpperCase();
  if (MAP[key]) return MAP[key];
  const base = key.split("-")[0];
  if (MAP[base]) return { ...MAP[base] };
  return { symbol: base || "?", icon: "mdi:currency-usd", iconColor: "#4338CA" };
}

/** Bare coin mark. */
export const CoinIcon: React.FC<{ code?: string | null; size?: number }> = ({ code, size = 20 }) => {
  const info = coinInfo(code);
  return <Icon icon={info.icon} width={size} height={size} color={info.iconColor} />;
};

/**
 * Coin mark + symbol (+ optional network chip) as one glanceable unit.
 * e.g.  ◎ USDT · Tron (TRC-20)
 */
export const CoinChip: React.FC<{
  code?: string | null;
  size?: number;
  showNetwork?: boolean;
  bold?: boolean;
  testId?: string;
}> = ({ code, size = 20, showNetwork = true, bold = true, testId }) => {
  const info = coinInfo(code);
  return (
    <Box component="span" data-testid={testId} sx={{ display: "inline-flex", alignItems: "center", gap: 0.7, minWidth: 0 }}>
      <CoinIcon code={code} size={size} />
      <Typography component="span" sx={{ fontWeight: bold ? 700 : 500, fontSize: size <= 18 ? 12.5 : 13.5, lineHeight: 1.2, whiteSpace: "nowrap" }}>
        {info.symbol}
      </Typography>
      {showNetwork && info.networkLabel && (
        <Typography
          component="span"
          sx={{ fontSize: size <= 18 ? 11 : 12, color: "text.secondary", whiteSpace: "nowrap" }}
        >
          · {info.networkLabel}
        </Typography>
      )}
    </Box>
  );
};

export default CoinIcon;
