import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { keyframes } from "@mui/material/styles";
import { COIN_COLOR } from "@/helpers/assetColor";
import { BG0, BG1, BLUE, FONT_MONO, INK0, INK3, LINE } from "./theme.v4";

const scroll = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
`;

interface Coin { ticker: string; name: string; icon?: string }

const COINS: Coin[] = [
  { ticker: "BTC", name: "Bitcoin", icon: "cryptocurrency-color:btc" },
  { ticker: "ETH", name: "Ethereum", icon: "cryptocurrency-color:eth" },
  { ticker: "USDT", name: "Tether", icon: "cryptocurrency-color:usdt" },
  { ticker: "USDC", name: "USD Coin", icon: "cryptocurrency-color:usdc" },
  { ticker: "SOL", name: "Solana", icon: "cryptocurrency-color:sol" },
  { ticker: "XRP", name: "XRP", icon: "cryptocurrency-color:xrp" },
  { ticker: "TRX", name: "Tron", icon: "cryptocurrency-color:trx" },
  { ticker: "LTC", name: "Litecoin", icon: "cryptocurrency-color:ltc" },
  { ticker: "DOGE", name: "Dogecoin", icon: "cryptocurrency-color:doge" },
  { ticker: "BCH", name: "Bitcoin Cash", icon: "cryptocurrency-color:bch" },
  { ticker: "POL", name: "Polygon", icon: "cryptocurrency-color:matic" },
  { ticker: "RLUSD", name: "Ripple USD" },
];

const Pill: React.FC<{ coin: Coin }> = ({ coin }) => (
  <Box sx={{
    flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 1.25,
    px: 2, py: 1.1, mx: 1, borderRadius: 999, border: `1px solid ${LINE}`, background: BG1,
  }}>
    {coin.icon ? (
      <Icon icon={coin.icon} width={22} height={22} aria-hidden />
    ) : (
      <Box aria-hidden sx={{
        width: 22, height: 22, borderRadius: "50%", background: COIN_COLOR[coin.ticker] || BLUE,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: FONT_MONO, fontSize: 7.5, fontWeight: 700,
      }}>
        {coin.ticker.slice(0, 3)}
      </Box>
    )}
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 500, color: INK0 }}>
      {coin.ticker}
    </Typography>
    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: INK3 }}>
      {coin.name}
    </Typography>
  </Box>
);

const AssetMarqueeV4: React.FC = () => {
  const { t } = useTranslation("landing");
  return (
    <Box component="section" data-testid="asset-marquee" sx={{ background: BG0, py: { xs: 6, md: 8 } }}>
      <Typography sx={{
        textAlign: "center", fontFamily: FONT_MONO, fontSize: 11.5, color: INK3,
        letterSpacing: "0.2em", textTransform: "uppercase", mb: 4, px: 3,
      }}>
        {t("v4.marquee.title")}
      </Typography>
      <Box sx={{
        position: "relative", overflow: "hidden",
        maskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 12%, black 88%, transparent)",
      }}>
        <Box sx={{
          display: "flex", width: "max-content",
          animation: `${scroll} 42s linear infinite`,
          "&:hover": { animationPlayState: "paused" },
          "@media (prefers-reduced-motion: reduce)": { animation: "none", flexWrap: "wrap", width: "100%", justifyContent: "center", rowGap: 1.5 },
        }}>
          {[...COINS, ...COINS].map((c, i) => (
            <Pill key={`${c.ticker}-${i}`} coin={c} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(AssetMarqueeV4);
