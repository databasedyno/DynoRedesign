import React, { memo } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { FONT_TECH, useAurora } from "./theme.v3";

/**
 * TrustLogosV3 — "built on" chain strip directly under the hero (2026-08).
 *
 * A compact, honest row of the nine blockchains DynoPay settles on. Reuses the
 * canonical @iconify cryptocurrency-color glyphs (same source as CoinShowcase).
 * Purely additive, frontend-only; wraps to two rows on narrow phones.
 */
const CHAINS: { icon: string; label: string }[] = [
  { icon: "cryptocurrency-color:btc", label: "Bitcoin" },
  { icon: "cryptocurrency-color:eth", label: "Ethereum" },
  { icon: "cryptocurrency-color:sol", label: "Solana" },
  { icon: "cryptocurrency-color:xrp", label: "XRP Ledger" },
  { icon: "cryptocurrency-color:trx", label: "Tron" },
  { icon: "cryptocurrency-color:ltc", label: "Litecoin" },
  { icon: "cryptocurrency-color:doge", label: "Dogecoin" },
  { icon: "cryptocurrency-color:bch", label: "Bitcoin Cash" },
  { icon: "cryptocurrency-color:matic", label: "Polygon" },
];

const TrustLogosV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");

  return (
    <Box
      component="section"
      data-testid="trust-logos"
      sx={{ background: s.bg, borderBottom: `1px solid ${s.line}`, py: { xs: 4, md: 5 } }}
    >
      <Box
        sx={{
          maxWidth: 1080,
          mx: "auto",
          px: { xs: 3, md: 5 },
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2.5, md: 4 },
        }}
      >
        <Typography
          sx={{
            fontFamily: FONT_TECH,
            fontSize: 11.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: s.ink3,
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {t("v3.trust.label")}
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: { xs: 1.5, md: 2 },
          }}
        >
          {CHAINS.map((c) => (
            <Tooltip
              key={c.label}
              title={`${c.label} · ${t("v3.trust.chainTooltip", { defaultValue: "See fees & supported networks" })}`}
              arrow
              enterDelay={200}
            >
              <Box
                component="a"
                href="/fees"
                data-testid={`trust-chain-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
                aria-label={`${c.label} — see fees and supported networks`}
                sx={{
                  width: { xs: 34, md: 38 },
                  height: { xs: 34, md: 38 },
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#FFFFFF",
                  border: `1px solid ${s.line}`,
                  cursor: "pointer",
                  boxShadow: s.dark ? "0 2px 10px -4px rgba(0,0,0,0.6)" : "0 2px 8px -4px rgba(10,10,10,0.18)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: s.dark ? "0 8px 20px -8px rgba(0,0,0,0.7)" : "0 8px 18px -8px rgba(10,10,10,0.25)",
                  },
                }}
              >
                <Icon icon={c.icon} width={22} height={22} />
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TrustLogosV3);
