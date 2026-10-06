import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { FONT_MONO, PANEL } from "./kit";
import { useTickers, formatUsd, formatPct, type Ticker } from "./useTickers";

/* ============================================================================
 * PriceTickerV8 — the signature "this is alive" band directly under the nav.
 * A dark marquee of LIVE market prices (BTC, ETH, USDT …) with 24h change,
 * green/red. Two identical tracks loop seamlessly; paused on hover and for
 * users who prefer reduced motion. Data: GET /api/public/tickers (graceful
 * fallback to a last-known snapshot — never empty).
 * ========================================================================== */

const Chip: React.FC<{ t: Ticker; ariaHidden?: boolean }> = ({ t, ariaHidden }) => {
  const up = t.change24h >= 0;
  return (
    <Box
      aria-hidden={ariaHidden || undefined}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: { xs: 2, md: 2.5 },
        flexShrink: 0,
        borderRight: `1px solid ${PANEL.line}`,
      }}
    >
      <Icon icon={t.icon} width={18} height={18} />
      <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PANEL.ink, letterSpacing: "0.02em" }}>
        {t.symbol}
      </Typography>
      <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: 12.5, color: PANEL.ink2 }}>
        {formatUsd(t.price)}
      </Typography>
      <Typography
        component="span"
        sx={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: up ? PANEL.green : PANEL.red }}
      >
        {formatPct(t.change24h)}
      </Typography>
    </Box>
  );
};

const PriceTickerV8: React.FC = () => {
  const { tickers, live } = useTickers();
  const track = [...tickers, ...tickers];

  return (
    <Box component="section" data-testid="price-ticker" aria-label="Live crypto prices" sx={{ background: PANEL.bg2, borderBottom: `1px solid ${PANEL.line}` }}>
      <style>{`@keyframes dyno-ticker-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <Box sx={{ display: "flex", alignItems: "center", maxWidth: 1400, mx: "auto", height: 44 }}>
        {/* Live label */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            pl: { xs: 2, md: 3 },
            pr: { xs: 2, md: 2.5 },
            height: "100%",
            flexShrink: 0,
            borderRight: `1px solid ${PANEL.line}`,
            background: PANEL.bg2,
            zIndex: 2,
          }}
        >
          <Box sx={{ position: "relative", width: 7, height: 7 }}>
            <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", background: live ? PANEL.green : PANEL.ink3 }} />
            {live ? (
              <Box
                sx={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  border: `1px solid ${PANEL.green}`,
                  animation: "dyno-ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
                  "@keyframes dyno-ping": { "75%,100%": { transform: "scale(2)", opacity: 0 } },
                  "@media (prefers-reduced-motion: reduce)": { animation: "none", opacity: 0 },
                }}
              />
            ) : null}
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: PANEL.ink2, textTransform: "uppercase" }}>
            Live
          </Typography>
        </Box>

        {/* Marquee */}
        <Box
          sx={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            maskImage: "linear-gradient(90deg, transparent, #000 3%, #000 96%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 3%, #000 96%, transparent)",
          }}
        >
          <Box
            data-testid="ticker-track"
            sx={{
              display: "inline-flex",
              width: "max-content",
              alignItems: "center",
              height: 44,
              animation: "dyno-ticker-marquee 60s linear infinite",
              "&:hover": { animationPlayState: "paused" },
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            {track.map((t, i) => (
              <Chip key={`${t.symbol}-${i}`} t={t} ariaHidden={i >= tickers.length} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(PriceTickerV8);
