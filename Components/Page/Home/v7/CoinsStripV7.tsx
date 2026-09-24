import React, { memo, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { FONT_TECH, useAurora } from "../v3/theme.v3";

/**
 * Subtle supported-coins marquee shown directly under the hero. Two identical
 * tracks scroll left and loop seamlessly at -50%; motion is disabled for users
 * who prefer reduced motion and pauses on hover. Icons come from the same
 * Iconify "cryptocurrency-color" set the checkout uses.
 *
 * The coin set is now LIVE: it is built from the public price feed
 * (GET /api/public/tickers) so the strip always mirrors the assets the platform
 * currently tracks. Stablecoins (USDT/USDC) are always surfaced for a payments
 * brand, and a curated static list is the fallback before data arrives or if the
 * feed is empty/unavailable.
 */
interface Coin {
  id: string;
  label: string;
}

// Ticker symbol (from /api/public/tickers) -> Iconify "cryptocurrency-color" glyph.
const SYMBOL_ICON: Record<string, string> = {
  BTC: "btc",
  ETH: "eth",
  USDT: "usdt",
  USDC: "usdc",
  SOL: "sol",
  XRP: "xrp",
  TRX: "trx",
  LTC: "ltc",
  DOGE: "doge",
  BCH: "bch",
  BNB: "bnb",
  POL: "matic",
  MATIC: "matic",
};

const toCoin = (sym: string): Coin | null => {
  const key = String(sym || "").toUpperCase();
  const icon = SYMBOL_ICON[key];
  if (!icon) return null;
  return { id: `cryptocurrency-color:${icon}`, label: key === "MATIC" ? "POL" : key };
};

// Curated fallback shown before live data arrives (or if the feed is empty).
const FALLBACK: Coin[] = (["BTC", "ETH", "USDT", "USDC", "SOL", "XRP", "TRX", "LTC", "DOGE", "BCH", "POL"]
  .map(toCoin)
  .filter(Boolean) as Coin[]);

// Stablecoins a payments brand should always show even though the majors-only
// price feed doesn't return them.
const ALWAYS = ["USDT", "USDC"];

const buildCoins = (symbols: string[]): Coin[] => {
  const seen = new Set<string>();
  const out: Coin[] = [];
  for (const s of [...ALWAYS, ...symbols]) {
    const c = toCoin(s);
    if (c && !seen.has(c.label)) {
      seen.add(c.label);
      out.push(c);
    }
  }
  return out;
};

const CoinsStripV7: React.FC = () => {
  const s = useAurora();
  const [coins, setCoins] = useState<Coin[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    const base = (
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      ""
    ).replace(/\/+$/, "");
    fetch(`${base}/api/public/tickers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !Array.isArray(j?.data) || j.data.length === 0) return;
        const syms = j.data.map((row: { symbol?: string }) => String(row?.symbol || "")).filter(Boolean);
        const next = buildCoins(syms);
        // Only swap in the live set when it's rich enough to look intentional.
        if (next.length >= 3) setCoins(next);
      })
      .catch(() => {
        /* keep the curated fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  const track = [...coins, ...coins];

  return (
    <Box component="section" data-testid="coins-strip" sx={{ background: s.bg, pb: { xs: 6, md: 8 } }}>
      <style>{`@keyframes dyno-coins-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>

      <Typography
        sx={{
          fontFamily: FONT_TECH,
          fontSize: 11.5,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: s.ink3,
          textAlign: "center",
          mb: { xs: 2.5, md: 3 },
        }}
      >
        Accept 40+ coins across every major chain
      </Typography>

      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          maskImage: "linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)",
        }}
      >
        <Box
          data-testid="coins-marquee-track"
          sx={{
            display: "inline-flex",
            width: "max-content",
            alignItems: "center",
            animation: "dyno-coins-marquee 36s linear infinite",
            "&:hover": { animationPlayState: "paused" },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          {track.map((c, i) => (
            <Box
              key={`${c.label}-${i}`}
              aria-hidden={i >= coins.length ? true : undefined}
              sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: { xs: 2.25, md: 3 }, flexShrink: 0 }}
            >
              <Icon icon={c.id} width={22} height={22} />
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13.5, fontWeight: 600, letterSpacing: "0.04em", color: s.ink2, whiteSpace: "nowrap" }}>
                {c.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(CoinsStripV7);
