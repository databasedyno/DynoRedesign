import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * TrustStrip — slim horizontal proof strip rendered below the auth card.
 *
 * Coinbase-clean pass replaced the noisy split-screen marketing panel with
 * a single centered login card. This strip keeps the essential social proof
 * (merchants, volume, settlement speed) in a single quiet row, plus a
 * subtle "supported coins" chip line — no illustrations, no gradients, no
 * animations.
 *
 * Renders inline on desktop and stacks vertically on mobile.
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

const TrustStrip: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("auth");
  const dark = theme.palette.mode === "dark";
  const sub = dark ? "rgba(255,255,255,0.55)" : "rgba(15,15,20,0.55)";
  const primary = dark ? "rgba(255,255,255,0.9)" : "rgba(15,15,20,0.9)";

  const stats: Array<{ value: string; label: string; testid: string }> = [
    {
      value: t("trustMerchantsValue", { defaultValue: "15+" }),
      label: t("trustMerchantsLabel", { defaultValue: "networks" }),
      testid: "trust-stat-merchants",
    },
    {
      // Honest, defensible signals only (2026-08 honesty pass — no unverified
      // volume/merchant-count claims). Kept in sync with constants/trustStats.ts.
      value: t("trustProcessedValue", { defaultValue: "0.5%" }),
      label: t("trustProcessedLabel", { defaultValue: "lowest fee" }),
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
        mt: { xs: 3, md: 3.5 },
        width: "100%",
        maxWidth: 440,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: { xs: 1.5, md: 2 },
      }}
    >
      {/* Stats row — three compact tokens joined by soft mid-dots */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 0.75, sm: 1.5 },
          flexWrap: "wrap",
          textAlign: "center",
        }}
      >
        {stats.map((stat, i) => (
          <React.Fragment key={stat.testid}>
            <Box
              data-testid={stat.testid}
              sx={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 0.6,
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: primary,
                  letterSpacing: "-0.01em",
                }}
              >
                {stat.value}
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: sub,
                }}
              >
                {stat.label}
              </Typography>
            </Box>
            {i < stats.length - 1 && (
              <Typography
                component="span"
                aria-hidden="true"
                sx={{
                  display: { xs: "none", sm: "inline" },
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  color: sub,
                  opacity: 0.6,
                }}
              >
                ·
              </Typography>
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* Coin chip row — quiet, mono-spaced, no card */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 1.25, sm: 1.75 },
          flexWrap: "wrap",
          maxWidth: "100%",
          px: 1,
        }}
      >
        {COINS.map((coin) => (
          <Box
            key={coin.s}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.6,
              opacity: 0.85,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: coin.c,
                flexShrink: 0,
              }}
            />
            <Typography
              sx={{
                fontFamily: "var(--font-tech, var(--font-mono, monospace))",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: sub,
              }}
            >
              {coin.s}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default TrustStrip;
