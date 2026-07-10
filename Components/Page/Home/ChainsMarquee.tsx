import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import SOL from "@/assets/Icons/coins/SOL";
import XRP from "@/assets/Icons/coins/XRP";
import USDT from "@/assets/Icons/coins/USDT";
import USDC from "@/assets/Icons/coins/USDC";
import BNB from "@/assets/Icons/coins/BNB";
import POLYGON from "@/assets/Icons/coins/POLYGON";
import RLUSD from "@/assets/Icons/coins/RLUSD";
import BCHPng from "@/assets/Icons/coins/BCH.png";
import DOGEPng from "@/assets/Icons/coins/DOGE.png";
import LTCPng from "@/assets/Icons/coins/LTC.png";
import TRXPng from "@/assets/Icons/coins/TRX.png";
import { FONT_TECH, useSwiss } from "./swiss";

interface ChainDef {
  label: string;
  Icon?: React.FC<any>;
  png?: any;
}

const CHAINS: ChainDef[] = [
  { label: "Bitcoin", Icon: BTC },
  { label: "Ethereum", Icon: ETH },
  { label: "USDT", Icon: USDT },
  { label: "USDC", Icon: USDC },
  { label: "Solana", Icon: SOL },
  { label: "BNB Chain", Icon: BNB },
  { label: "XRP", Icon: XRP },
  { label: "Polygon", Icon: POLYGON },
  { label: "RLUSD", Icon: RLUSD },
  { label: "TRON", png: TRXPng },
  { label: "Litecoin", png: LTCPng },
  { label: "Dogecoin", png: DOGEPng },
  { label: "Bitcoin Cash", png: BCHPng },
];

const ChainItem: React.FC<{ chain: ChainDef; sub: string; txt: string }> = ({ chain, sub, txt }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 2.5, md: 4 }, whiteSpace: "nowrap", flexShrink: 0 }}>
    <Box sx={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {chain.Icon ? <chain.Icon width={22} height={22} size={22} /> : chain.png ? <Image src={chain.png} alt={chain.label} width={22} height={22} /> : null}
    </Box>
    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: txt }}>
      {chain.label}
    </Typography>
    <Typography aria-hidden sx={{ fontFamily: FONT_TECH, fontSize: 13, color: sub, pl: { xs: 2.5, md: 4 } }}>/</Typography>
  </Box>
);

const ChainsMarquee: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");

  const track = [0, 1].map((dup) => (
    <Box key={dup} aria-hidden={dup === 1} sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: { xs: 2.5, md: 4 }, whiteSpace: "nowrap", flexShrink: 0 }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: s.accentText }}>
          13 chains · one integration
        </Typography>
        <Typography aria-hidden sx={{ fontFamily: FONT_TECH, fontSize: 13, color: s.faint, pl: { xs: 2.5, md: 4 } }}>/</Typography>
      </Box>
      {CHAINS.map((c) => (
        <ChainItem key={`${dup}-${c.label}`} chain={c} sub={s.faint} txt={s.sub} />
      ))}
    </Box>
  ));

  return (
    <Box
      component="section"
      aria-label={t("chainsHeader")}
      data-testid="chains-marquee"
      sx={{
        borderTop: `1px solid ${s.line}`,
        borderBottom: `1px solid ${s.line}`,
        py: { xs: 2, md: 2.75 },
        overflow: "hidden",
        position: "relative",
        "&:hover .swiss-marquee-track": { animationPlayState: "paused" },
        // Edge fade
        maskImage: "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)",
      }}
    >
      <Box className="swiss-marquee-track" sx={{ display: "flex", width: "max-content", animation: "swiss-marquee 48s linear infinite" }}>
        {track}
      </Box>
    </Box>
  );
};

export default memo(ChainsMarquee);
