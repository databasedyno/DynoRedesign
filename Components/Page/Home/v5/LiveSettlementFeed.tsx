import React, { memo } from "react";
import { Box, Typography, keyframes } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { LiveDot } from "../motion/accents";
import { REDUCED_MQ } from "../motion/tokens";
import { coinIcon, relTime, useRecentSettlements } from "./useLandingProof";

const marquee = keyframes`from{transform:translateX(0)}to{transform:translateX(-50%)}`;

const Chip: React.FC<{ symbol: string; network: string; at: string }> = ({ symbol, network, at }) => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const ci = coinIcon(symbol);
  return (
    <Box
      sx={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        px: 1.75,
        py: 0.9,
        borderRadius: "999px",
        border: `1px solid ${s.line}`,
        background: s.surface,
      }}
    >
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: `1px solid ${s.line}`, flexShrink: 0 }}>
        <Icon icon={ci.icon} width={14} height={14} color={ci.color} />
      </Box>
      <Typography component="span" sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: s.ink, whiteSpace: "nowrap" }}>
        {t("v5.onchain.settledOn", { symbol, network })}
      </Typography>
      <Box component="span" sx={{ width: 3, height: 3, borderRadius: "50%", background: s.ink3, mx: 0.25 }} />
      <Typography component="span" className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, whiteSpace: "nowrap" }}>
        {relTime(at, t)}
      </Typography>
    </Box>
  );
};

/** Subtle, auto-scrolling strip of real recent settlements (anonymized). "This is being used right now." */
const LiveSettlementFeed: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const feed = useRecentSettlements(8);
  const items = feed && feed.length ? [...feed, ...feed] : [];
  // Keep the scroll speed constant regardless of how busy the feed is (≈5s per chip).
  const marqueeSecs = Math.max(30, (feed?.length || 8) * 5);

  return (
    <Box
      data-testid="live-settlement-feed"
      data-loaded={feed ? "true" : "false"}
      sx={{ mt: { xs: 4, md: 5 }, display: "flex", alignItems: "center", gap: { xs: 1.5, md: 2.5 } }}
    >
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <LiveDot />
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: s.ink3, whiteSpace: "nowrap" }}>
          {t("v5.live.title")}
        </Typography>
      </Box>
      <Box
        sx={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)",
        }}
      >
        {items.length ? (
          <Box
            className="marquee-track"
            sx={{
              display: "inline-flex",
              gap: 1.25,
              width: "max-content",
              animation: `${marquee} ${marqueeSecs}s linear infinite`,
              "&:hover": { animationPlayState: "paused" },
              [REDUCED_MQ]: { animation: "none" },
            }}
          >
            {items.map((it, i) => (
              <Chip key={`${it.symbol}-${it.at}-${i}`} symbol={it.symbol} network={it.network} at={it.at} />
            ))}
          </Box>
        ) : (
          <Box sx={{ height: 40 }} />
        )}
      </Box>
    </Box>
  );
};

export default memo(LiveSettlementFeed);
