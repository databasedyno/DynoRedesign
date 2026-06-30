import React, { memo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import BTC from "@/assets/Icons/coins/BTC";
import ETH from "@/assets/Icons/coins/ETH";
import SOL from "@/assets/Icons/coins/SOL";
import XRP from "@/assets/Icons/coins/XRP";
import USDT from "@/assets/Icons/coins/USDT";
import USDC from "@/assets/Icons/coins/USDC";
import BNB from "@/assets/Icons/coins/BNB";
import POLYGON from "@/assets/Icons/coins/POLYGON";
import RLUSD from "@/assets/Icons/coins/RLUSD";
import Image from "next/image";
import BCHPng from "@/assets/Icons/coins/BCH.png";
import DOGEPng from "@/assets/Icons/coins/DOGE.png";
import LTCPng from "@/assets/Icons/coins/LTC.png";
import TRXPng from "@/assets/Icons/coins/TRX.png";

/**
 * SupportedChainsRail — small "Powered by" rail below the hero, displaying
 * the chain logos we actually settle on. Replaces the generic SaaS "trusted by"
 * social-proof line with chain-native imagery.
 */

interface ChainDef {
  label: string;
  Icon?: React.FC<{ width?: string | number; height?: string | number }>;
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

const SupportedChainsRail: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        width: "100%",
        textAlign: "center",
        py: { xs: 4, md: 5 },
        px: 2,
      }}
    >
      <Typography
        sx={{
          fontSize: "12px",
          fontWeight: 600,
          fontFamily: "UrbanistSemiBold",
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: theme.palette.text.secondary,
          mb: 2.5,
        }}
      >
        Settle on the chains your customers already use
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: { xs: 2, md: 3.5 },
          rowGap: 2,
          maxWidth: "1100px",
          mx: "auto",
        }}
      >
        {CHAINS.map(({ label, Icon, png }) => (
          <Box
            key={label}
            title={label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              opacity: isDark ? 0.85 : 0.7,
              filter: "grayscale(20%)",
              transition: "all 0.25s ease",
              "&:hover": {
                opacity: 1,
                filter: "grayscale(0%)",
                transform: "translateY(-2px)",
              },
            }}
          >
            <Box sx={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {Icon ? (
                <Icon width={28} height={28} />
              ) : png ? (
                <Image src={png} alt={label} width={28} height={28} />
              ) : null}
            </Box>
            <Typography
              sx={{
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "UrbanistSemiBold",
                color: theme.palette.text.primary,
                display: { xs: "none", sm: "block" },
              }}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(SupportedChainsRail);
