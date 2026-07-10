import { Box, styled, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import BitcoinBg from "@/assets/Images/home/Bitcoin-bg.png";
import EthereumBg from "@/assets/Images/home/Ethereum-bg.png";
import LitecoinBg from "@/assets/Images/home/Litecoin-bg.png";
import HomeButton from "@/Components/Layout/HomeButton";

/**
 * UseCaseBanner — mid-page CTA card (updated 2026-07-10, session 19).
 *
 * The previous 2-column layout paired a title + CTA on the left with a
 * large mock dashboard screenshot on the right (Dashboard.png/.svg).
 * User feedback (2026-07-10): the mock dashboard "does not look good or
 * fit" on the landing. Removed the entire right image column and reflowed
 * the text/CTA into a centered, full-width compact card. Decorative crypto-
 * coin blobs are kept for a subtle accent (Bitcoin top-right, Ethereum
 * bottom-left, Litecoin bottom-right) — all `pointer-events: none`, purely
 * ambient. Dashboard.png/.svg no longer imported.
 */

const UseCaseBannerWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  padding: "56px 32px",
  background:
    theme.palette.mode === "dark"
      ? "linear-gradient(135deg, rgba(106,123,255,0.08) 0%, rgba(106,123,255,0) 50%, rgba(106,123,255,0.12) 100%)"
      : "linear-gradient(135deg, rgba(0, 4, 255, 0.05) 0%, rgba(0, 4, 255, 0) 50%, rgba(0, 4, 255, 0.1) 100%)",
  borderRadius: "24px",
  border: `1px solid ${theme.palette.border?.main || (theme.palette.mode === "dark" ? "#2A2D42" : "#E7E8EF")}`,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    padding: "44px 20px",
  },
}));

const TitleText = styled(Typography)(({ theme }) => ({
  fontSize: "36px",
  lineHeight: "44px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  maxWidth: "760px",
  [theme.breakpoints.down("md")]: {
    fontSize: "28px",
    lineHeight: "36px",
  },
}));

const SubText = styled(Typography)(({ theme }) => ({
  fontSize: "18px",
  fontWeight: 400,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
  lineHeight: "28px",
  letterSpacing: "0",
  maxWidth: "620px",
}));

const HighlightText = styled("span")(() => ({
  background: "linear-gradient(90deg, #4F46E5 0%, #6A4DFF 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
  fontWeight: 500,
}));

const DecorativeImage = styled(Box)(() => ({
  position: "absolute",
  filter: "blur(1px)",
  zIndex: 0,
  pointerEvents: "none",
}));

const TextWrapper = styled(Box)(() => ({
  position: "relative",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  width: "100%",
}));

const UseCaseBanner = () => {
  const { t } = useTranslation("landing");
  const theme = useTheme();

  return (
    <UseCaseBannerWrapper>
      {/* Ambient decorative crypto blobs — no dashboard image */}
      <DecorativeImage
        sx={{
          top: { xs: "12px", md: "18px" },
          right: { xs: "12px", md: "40px" },
          height: { xs: 36, md: 52 },
          width: { xs: 36, md: 52 },
        }}
      >
        <Image src={BitcoinBg} alt="" fill style={{ objectFit: "contain" }} draggable={false} />
      </DecorativeImage>

      <DecorativeImage
        sx={{
          bottom: { xs: "10px", md: "18px" },
          left: { xs: "12px", md: "40px" },
          height: { xs: 34, md: 48 },
          width: { xs: 34, md: 48 },
          filter: "blur(2px)",
          [theme.breakpoints.down("md")]: {
            display: "none",
          },
        }}
      >
        <Image src={EthereumBg} alt="" fill style={{ objectFit: "contain" }} draggable={false} />
      </DecorativeImage>

      <DecorativeImage
        sx={{
          bottom: { xs: "12px", md: "24px" },
          right: { xs: "12px", md: "72px" },
          height: { xs: 30, md: 44 },
          width: { xs: 30, md: 44 },
          filter: "blur(2.5px)",
          [theme.breakpoints.down("md")]: {
            display: "none",
          },
        }}
      >
        <Image src={LitecoinBg} alt="" fill style={{ objectFit: "contain" }} draggable={false} />
      </DecorativeImage>

      <TextWrapper>
        <TitleText>
          {t("useCaseBannerTitlePrefix")}{" "}
          <HighlightText>{t("useCaseBannerTitleHighlight")}</HighlightText>
        </TitleText>
        <SubText>{t("useCaseBannerSubtitle")}</SubText>
        <Box sx={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
          <HomeButton variant="primary" label={t("startAcceptingCrypto")} />
        </Box>
      </TextWrapper>
    </UseCaseBannerWrapper>
  );
};

export default UseCaseBanner;
