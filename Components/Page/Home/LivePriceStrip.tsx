import React, { useEffect, useState, memo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { TrendingUp, TrendingDown } from "@mui/icons-material";
import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import SOL from "@/assets/Icons/coins/SOL";
import XRP from "@/assets/Icons/coins/XRP";
import USDT from "@/assets/Icons/coins/USDT";
import USDC from "@/assets/Icons/coins/USDC";
import BNB from "@/assets/Icons/coins/BNB";
import POLYGON from "@/assets/Icons/coins/POLYGON";
import RLUSD from "@/assets/Icons/coins/RLUSD";
import { toFixedStr } from "@/utils/money";

/**
 * LivePriceStrip — auto-scrolling marquee of real BTC/ETH/USDT/etc. prices.
 *
 * Pulls from GET /api/public/tickers (no auth), which is fed by the backend's
 * Binance WS / CoinGecko / Kraken price cache. Quietly hides itself if the
 * endpoint is unreachable or returns no data — never breaks the page.
 *
 * Designed to be planted directly above the hero on the landing page to signal
 * "this is a real-time crypto product".
 */

interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
}

const COIN_ICON: Record<string, React.ComponentType<any>> = {
  BTC, ETH, SOL, XRP, USDT, USDC, BNB, POL: POLYGON, POLYGON, RLUSD,
};

// Stablecoins always look like 1.00 — skip the noisy change %
const STABLE = new Set(["USDT", "USDC", "RLUSD", "DAI"]);

// Ordering preference for the strip
const PREFERRED_ORDER = ["BTC", "ETH", "USDT", "USDC", "SOL", "BNB", "XRP", "POL", "RLUSD", "TRX", "LTC", "DOGE", "BCH"];

const formatPrice = (sym: string, price: number): string => {
  if (price <= 0) return "—";
  if (STABLE.has(sym)) return `$${toFixedStr(price, 2)}`;
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
};

const LivePriceStrip: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let mounted = true;
    const apiBase = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

    const fetchPrices = async () => {
      try {
        const url = `${apiBase}/api/public/tickers`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        const data: Ticker[] = (json?.data || []).filter((t: Ticker) => t.price > 0);
        if (data.length === 0) {
          setHidden(true);
          return;
        }
        // Sort by preferred order, unknown to the end
        data.sort((a, b) => {
          const ia = PREFERRED_ORDER.indexOf(a.symbol);
          const ib = PREFERRED_ORDER.indexOf(b.symbol);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
        setTickers(data);
        setHidden(false);
      } catch {
        if (mounted) setHidden(true);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // refresh every 30s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Only bail out completely if the ticker endpoint actually failed. While the
  // prices are still loading we keep a FIXED-HEIGHT placeholder bar so the strip
  // never "pops in" and shoves the rest of the page down — that pop-in was the
  // main source of landing-page CLS. SSR renders this same reserved bar (tickers
  // start empty), so loaded → same height → zero layout shift.
  if (hidden) return null;

  // While prices load, reserve the strip's height with an INVISIBLE spacer so
  // it can't pop in and shove the page down (CLS) — without flashing an empty
  // dark bar. Once data arrives the real strip fills the same 46px slot; if the
  // feed is empty/unreachable the strip stays hidden (rare).
  if (tickers.length === 0) {
    return <Box aria-hidden sx={{ width: "100%", minHeight: 46 }} />;
  }

  // Double the list so the marquee loops seamlessly
  const loop = [...tickers, ...tickers];

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight: 46,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: isDark
          ? "linear-gradient(90deg, rgba(15,16,30,0.95) 0%, rgba(20,22,37,0.95) 100%)"
          : "linear-gradient(90deg, #0B0D17 0%, #141625 100%)",
        borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.08)"}`,
        py: 1.2,
        // Edge fade
        "&::before, &::after": {
          content: '""',
          position: "absolute",
          top: 0,
          bottom: 0,
          width: { xs: "32px", md: "64px" },
          zIndex: 2,
          pointerEvents: "none",
        },
        "&::before": {
          left: 0,
          background: isDark
            ? "linear-gradient(90deg, rgba(15,16,30,1), rgba(15,16,30,0))"
            : "linear-gradient(90deg, #0B0D17, rgba(11,13,23,0))",
        },
        "&::after": {
          right: 0,
          background: isDark
            ? "linear-gradient(-90deg, rgba(20,22,37,1), rgba(20,22,37,0))"
            : "linear-gradient(-90deg, #141625, rgba(20,22,37,0))",
        },
      }}
      aria-label="Live crypto prices"
    >
      <Box
        sx={{
          display: "flex",
          width: "max-content",
          animation: "dyno-ticker-scroll 60s linear infinite",
          willChange: "transform",
          "@keyframes dyno-ticker-scroll": {
            "0%": { transform: "translateX(0)" },
            "100%": { transform: "translateX(-50%)" },
          },
          "&:hover": { animationPlayState: "paused" },
        }}
      >
        {loop.map((t, i) => {
          const Icon = COIN_ICON[t.symbol];
          const isStable = STABLE.has(t.symbol);
          const up = t.change24h >= 0;
          const changeColor = isStable
            ? "rgba(255,255,255,0.45)"
            : up
              ? "#22C55E"
              : "#EF4444";
          return (
            <Box
              key={`${t.symbol}-${i}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                px: { xs: 2, md: 3 },
                py: 0.3,
                borderRight: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}
            >
              {Icon ? (
                <Box sx={{ width: 18, height: 18, display: "flex", alignItems: "center" }}>
                  <Icon width={18} height={18} />
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#fff", fontWeight: 700,
                  }}
                >
                  {t.symbol.charAt(0)}
                </Box>
              )}
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  color: "#fff",
                  letterSpacing: "0.5px",
                }}
              >
                {t.symbol}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 700,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatPrice(t.symbol, t.price)}
              </Typography>
              {!isStable && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    color: changeColor,
                  }}
                >
                  {up ? (
                    <TrendingUp sx={{ fontSize: 13 }} />
                  ) : (
                    <TrendingDown sx={{ fontSize: 13 }} />
                  )}
                  <Typography
                    sx={{
                      fontSize: "12px",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      color: changeColor,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {up ? "+" : ""}
                    {toFixedStr(t.change24h, 2)}%
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default memo(LivePriceStrip);
