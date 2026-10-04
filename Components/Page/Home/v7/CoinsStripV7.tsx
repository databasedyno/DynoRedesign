import React, { memo, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { FONT_MONO, useConsole } from "./kit";

/**
 * Quiet supported-assets band directly under the hero. The coin set is LIVE —
 * built from the public price feed (GET /api/public/tickers) so it mirrors the
 * assets the platform actually tracks; a curated static list is the fallback.
 * Two identical tracks scroll left and loop at -50%; paused on hover and for
 * users who prefer reduced motion.
 */
interface Coin {
  id: string;
  label: string;
}

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

const FALLBACK: Coin[] = (["BTC", "ETH", "USDT", "USDC", "SOL", "XRP", "TRX", "LTC", "DOGE", "BCH", "POL"]
  .map(toCoin)
  .filter(Boolean) as Coin[]);

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
  const s = useConsole();
  const { t } = useTranslation("landing");
  const [coins, setCoins] = useState<Coin[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/+$/, "");
    fetch(`${base}/api/public/tickers`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !Array.isArray(j?.data) || j.data.length === 0) return;
        const syms = j.data.map((row: { symbol?: string }) => String(row?.symbol || "")).filter(Boolean);
        const next = buildCoins(syms);
        if (next.length >= 3) setCoins(next);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const track = [...coins, ...coins];

  return (
    <Box component="section" data-testid="coins-strip" sx={{ background: s.canvas, borderTop: `1px solid ${s.line}` }}>
      <style>{`@keyframes dyno-coins-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          py: { xs: 3, md: 3.5 },
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          gap: { xs: 2, md: 4 },
        }}
      >
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: 11.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: s.ink3,
            flexShrink: 0,
            whiteSpace: { md: "nowrap" },
          }}
        >
          {t("v7.coins.label")}
        </Typography>

        <Box
          sx={{
            position: "relative",
            flex: 1,
            minWidth: 0,
            width: "100%",
            overflow: "hidden",
            maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          }}
        >
          <Box
            data-testid="coins-marquee-track"
            sx={{
              display: "inline-flex",
              width: "max-content",
              alignItems: "center",
              animation: "dyno-coins-marquee 42s linear infinite",
              "&:hover": { animationPlayState: "paused" },
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            {track.map((c, i) => (
              <Box
                key={`${c.label}-${i}`}
                aria-hidden={i >= coins.length ? true : undefined}
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, px: { xs: 2, md: 2.5 }, flexShrink: 0, opacity: 0.85 }}
              >
                <Icon icon={c.id} width={20} height={20} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", color: s.ink2, whiteSpace: "nowrap" }}>
                  {c.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(CoinsStripV7);
