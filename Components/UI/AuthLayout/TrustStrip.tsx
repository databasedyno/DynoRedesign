import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * TrustStrip — social-proof strip rendered below the auth card (all
 * breakpoints on the simple screens; below lg on login/register where the
 * brand panel carries the proof on desktop).
 *
 * Editorial-glass pass: three glass stat chips (mono value + quiet label)
 * and a supported-coin tray. Only honest, defensible signals — kept in sync
 * with constants/trustStats.ts (no unverified volume / merchant claims).
 */

const COINS: Array<{ s: string; c: string }> = [
  { s: "BTC", c: "#F7931A" },
  { s: "ETH", c: "#627EEA" },
  { s: "USDT", c: "#26A17B" },
  { s: "USDC", c: "#2775CA" },
  { s: "SOL", c: "#9945FF" },
  { s: "XRP", c: "#23292F" },
  { s: "TRX", c: "#EF0027" },
  { s: "POL", c: "#8247E5" },
];

const MONO = "var(--font-tech), var(--font-mono, monospace)";

const TrustStrip: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("auth");
  const dark = theme.palette.mode === "dark";
  const sub = dark ? "rgba(255,255,255,0.58)" : "rgba(15,15,20,0.58)";
  const primary = dark ? "rgba(255,255,255,0.92)" : "rgba(15,15,20,0.9)";
  const line = dark ? "rgba(255,255,255,0.08)" : "rgba(18,18,20,0.06)";
  const glass = dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.7)";

  const stats: Array<{ value: string; label: string; testid: string }> = [
    {
      value: t("trustMerchantsValue", { defaultValue: "9" }),
      label: t("trustMerchantsLabel", { defaultValue: "blockchains" }),
      testid: "trust-stat-merchants",
    },
    {
      value: t("trustProcessedValue", { defaultValue: "1.5% → 0.5%" }),
      label: t("trustProcessedLabel", { defaultValue: "fee" }),
      testid: "trust-stat-processed",
    },
    {
      value: t("trustSettlementValue", { defaultValue: "24/7" }),
      label: t("trustSettlementLabel", { defaultValue: "settlement" }),
      testid: "trust-stat-settlement",
    },
  ];

  return (
    <Box
      data-testid="auth-trust-strip"
      sx={{
        mt: { xs: 2.5, md: 3 },
        width: "100%",
        maxWidth: 460,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: { xs: 1.25, md: 1.5 },
        animation: "authRise 520ms cubic-bezier(0.22, 1, 0.36, 1) 160ms both",
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      {/* Stat chips */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, flexWrap: "wrap" }}>
        {stats.map((stat) => (
          <Box
            key={stat.testid}
            data-testid={stat.testid}
            sx={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 0.6,
              px: 1.5,
              py: 0.75,
              borderRadius: 999,
              border: `1px solid ${line}`,
              background: glass,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
            }}
          >
            <Typography component="span" sx={{ fontFamily: MONO, fontSize: "12.5px", fontWeight: 700, color: primary, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
              {stat.value}
            </Typography>
            <Typography component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", fontWeight: 500, color: sub }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Coin tray */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: { xs: 1.25, sm: 1.75 }, flexWrap: "wrap", maxWidth: "100%", px: 1 }}>
        {COINS.map((coin) => (
          <Box key={coin.s} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, opacity: 0.85 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: coin.s === "XRP" && dark ? "#B8C1CC" : coin.c, flexShrink: 0, boxShadow: `0 0 8px ${coin.c}66` }} />
            <Typography sx={{ fontFamily: MONO, fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: sub }}>
              {coin.s}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default TrustStrip;
