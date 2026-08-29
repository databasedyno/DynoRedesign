import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { COIN_COLOR } from "@/helpers/assetColor";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * CoinShowcaseV3 — "15 coins & tokens, nine chains" marquee (2026-06).
 *
 * A scrolling coin strip built from the canonical COIN_COLOR palette, plus a
 * "keep it or auto-convert" explainer. Surfaces the multi-chain / stablecoin
 * breadth the landing only hinted at ("9 chains"). Frontend-only, additive.
 * The marquee pauses on hover and respects prefers-reduced-motion.
 */

interface Coin {
  ticker: string;
  name: string;
  icon?: string; // iconify cryptocurrency-color name; undefined → brand-color text badge
}

const COINS: Coin[] = [
  { ticker: "BTC", name: "Bitcoin", icon: "cryptocurrency-color:btc" },
  { ticker: "ETH", name: "Ethereum", icon: "cryptocurrency-color:eth" },
  { ticker: "SOL", name: "Solana", icon: "cryptocurrency-color:sol" },
  { ticker: "XRP", name: "XRP", icon: "cryptocurrency-color:xrp" },
  { ticker: "TRX", name: "Tron", icon: "cryptocurrency-color:trx" },
  { ticker: "LTC", name: "Litecoin", icon: "cryptocurrency-color:ltc" },
  { ticker: "DOGE", name: "Dogecoin", icon: "cryptocurrency-color:doge" },
  { ticker: "BCH", name: "Bitcoin Cash", icon: "cryptocurrency-color:bch" },
  { ticker: "POL", name: "Polygon", icon: "cryptocurrency-color:matic" },
  { ticker: "USDT", name: "Tether", icon: "cryptocurrency-color:usdt" },
  { ticker: "USDC", name: "USD Coin", icon: "cryptocurrency-color:usdc" },
  { ticker: "RLUSD", name: "Ripple USD" },
];

const CoinPill: React.FC<{ coin: Coin; dark: boolean; surface: string; line: string; ink: string; ink3: string }> = ({
  coin,
  surface,
  line,
  ink,
  ink3,
}) => {
  const color = COIN_COLOR[coin.ticker] || BRAND_ACCENT;
  return (
    <Box
      sx={{
        flex: "0 0 auto",
        display: "inline-flex",
        alignItems: "center",
        gap: 1.25,
        px: 2,
        py: 1.25,
        mx: 1,
        borderRadius: "999px",
        border: `1px solid ${line}`,
        background: surface,
      }}
    >
      {coin.icon ? (
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
            border: `1px solid ${line}`,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <Icon icon={coin.icon} width={24} height={24} />
        </Box>
      ) : (
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: color,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_TECH,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            flexShrink: 0,
          }}
        >
          {coin.ticker.slice(0, coin.ticker.length > 4 ? 4 : 3)}
        </Box>
      )}
      <Box>
        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 14, color: ink, lineHeight: 1.1 }}>
          {coin.ticker}
        </Typography>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: ink3, letterSpacing: "0.04em", lineHeight: 1.1 }}>
          {coin.name}
        </Typography>
      </Box>
    </Box>
  );
};

const CoinShowcaseV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const loop = [...COINS, ...COINS];

  return (
    <Box component="section" data-testid="coin-showcase" sx={{ background: s.bg, py: { xs: 12, md: 20 }, overflow: "hidden" }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 5, md: 7 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.coins.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
            {t("v3.coins.headline")} <span style={{ color: s.dark ? "#818CF8" : BRAND_ACCENT }}>{t("v3.coins.headline2")}</span>
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.coins.body")}
          </Typography>
        </Box>
      </Box>

      {/* Marquee */}
      <Box
        aria-hidden
        sx={{
          position: "relative",
          maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          "&:hover .coin-track": { animationPlayState: "paused" },
          "@keyframes coinMarquee": {
            "0%": { transform: "translateX(0)" },
            "100%": { transform: "translateX(-50%)" },
          },
        }}
      >
        <Box
          className="coin-track"
          sx={{
            display: "flex",
            width: "max-content",
            animation: "coinMarquee 42s linear infinite",
            "@media (prefers-reduced-motion: reduce)": { animation: "none", flexWrap: "wrap", justifyContent: "center", width: "100%" },
          }}
        >
          {loop.map((c, i) => (
            <CoinPill key={`${c.ticker}-${i}`} coin={c} dark={s.dark} surface={s.surface} line={s.line} ink={s.ink} ink3={s.ink3} />
          ))}
        </Box>
      </Box>

      {/* Keep-or-convert explainer */}
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 }, mt: { xs: 6, md: 8 } }}>
        <Box
          sx={{
            maxWidth: 720,
            mx: "auto",
            display: "flex",
            alignItems: "flex-start",
            gap: 2.5,
            background: s.surface,
            border: `1px solid ${s.line}`,
            borderRadius: "20px",
            p: { xs: 3, md: 3.5 },
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              width: 46,
              height: 46,
              borderRadius: "13px",
              background: s.dark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)",
              border: `1px solid ${s.dark ? "rgba(129,140,248,0.3)" : "rgba(79,70,229,0.2)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: s.dark ? "#818CF8" : BRAND_ACCENT,
            }}
          >
            <SwapHorizRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 19, letterSpacing: "-0.015em", color: s.ink, mb: 1 }}>
              {t("v3.coins.convertTitle")}
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2 }}>
              {t("v3.coins.convertDesc")}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(CoinShowcaseV3);
