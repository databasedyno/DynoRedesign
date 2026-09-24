import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { FONT_TECH, useAurora } from "../v3/theme.v3";

/**
 * Subtle supported-coins marquee shown directly under the hero. Two identical
 * tracks scroll left and loop seamlessly at -50%; motion is disabled for users
 * who prefer reduced motion and pauses on hover. Icons come from the same
 * Iconify "cryptocurrency-color" set the checkout uses.
 */
const COINS: Array<{ id: string; label: string }> = [
  { id: "cryptocurrency-color:btc", label: "BTC" },
  { id: "cryptocurrency-color:eth", label: "ETH" },
  { id: "cryptocurrency-color:usdt", label: "USDT" },
  { id: "cryptocurrency-color:usdc", label: "USDC" },
  { id: "cryptocurrency-color:sol", label: "SOL" },
  { id: "cryptocurrency-color:xrp", label: "XRP" },
  { id: "cryptocurrency-color:trx", label: "TRX" },
  { id: "cryptocurrency-color:ltc", label: "LTC" },
  { id: "cryptocurrency-color:doge", label: "DOGE" },
  { id: "cryptocurrency-color:bch", label: "BCH" },
  { id: "cryptocurrency-color:matic", label: "POL" },
];

const CoinsStripV7: React.FC = () => {
  const s = useAurora();
  const track = [...COINS, ...COINS];

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
              aria-hidden={i >= COINS.length ? true : undefined}
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
