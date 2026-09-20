import React from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";

export const COIN_ICON: Record<string, string> = {
  USDT: "cryptocurrency-color:usdt",
  USDC: "cryptocurrency-color:usdc",
  BTC: "cryptocurrency-color:btc",
  ETH: "cryptocurrency-color:eth",
  TRX: "cryptocurrency-color:trx",
  SOL: "cryptocurrency-color:sol",
};

/** Network badge — keyed by chain code (config.chain) and by display name (address.network). */
export const NETWORK_ICON: Record<string, string> = {
  TRC20: "cryptocurrency-color:trx",
  TRON: "cryptocurrency-color:trx",
  ERC20: "cryptocurrency-color:eth",
  ETHEREUM: "cryptocurrency-color:eth",
  POLYGON: "cryptocurrency-color:matic",
  MATIC: "cryptocurrency-color:matic",
};

const networkIcon = (n?: string) => (n ? NETWORK_ICON[n.toUpperCase().replace(/[^A-Z0-9]/g, "")] : undefined);

/** Coin icon with a small network badge in the corner. */
export function CoinBadge({ coin, network, size = 22 }: { coin: string; network?: string; size?: number }) {
  const net = networkIcon(network);
  const badge = Math.round(size * 0.55);
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }} data-testid={`sd-coin-badge-${coin}`}>
      <Icon icon={COIN_ICON[coin] || "mdi:circle-multiple-outline"} width={size} height={size} />
      {net && (
        <Box sx={{ position: "absolute", right: -3, bottom: -3, width: badge, height: badge, borderRadius: "50%", backgroundColor: "#fff", display: "grid", placeItems: "center", boxShadow: "0 0 0 1.5px #fff" }}>
          <Icon icon={net} width={badge - 2} height={badge - 2} />
        </Box>
      )}
    </Box>
  );
}

/** Row used inside the "Coin & network" selects: icon + human label. */
export function PayoutOptionLabel({ option, size = 22, sub }: { option: { coin: string; chain?: string; network?: string; label: string }; size?: number; sub?: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.2} sx={{ minWidth: 0 }}>
      <CoinBadge coin={option.coin} network={option.chain || option.network} size={size} />
      <Typography component="span" sx={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
        {option.label}
        {sub && <Typography component="span" sx={{ fontSize: 12.5, color: "#6B7280", fontWeight: 500, fontFamily: "ui-monospace, Menlo, monospace", ml: 0.8 }}>{sub}</Typography>}
      </Typography>
    </Stack>
  );
}
