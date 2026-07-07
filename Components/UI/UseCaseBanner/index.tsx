import { Box, styled, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import Dashboard_png from "@/assets/Images/home/Dashboard.png";
import Dashboard_svg from "@/assets/Images/home/Dashboard.svg";
import Image from "next/image";
import BitcoinBg from "@/assets/Images/home/Bitcoin-bg.png";
import EthereumBg from "@/assets/Images/home/Ethereum-bg.png";
import LitecoinBg from "@/assets/Images/home/Litecoin-bg.png";
import HomeButton from "@/Components/Layout/HomeButton";
import { useDevice } from "@/hooks/useDevice";

const UseCaseBannerWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "100%",
  padding: "35px 0 23px 64px",
  background: theme.palette.mode === "dark"
    ? "linear-gradient(135deg, rgba(106,123,255,0.08) 0%, rgba(106,123,255,0) 50%, rgba(106,123,255,0.12) 100%)"
    : "linear-gradient(135deg, rgba(0, 4, 255, 0.05) 0%, rgba(0, 4, 255, 0) 50%, rgba(0, 4, 255, 0.1) 100%)",
  borderRadius: "24px",
  border: `1px solid ${theme.palette.border?.main || (theme.palette.mode === "dark" ? "#2A2D42" : "#E7E8EF")}`,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "24px",
  flexDirection: "row",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    padding: "35px 20px 60px 20px",
  },
}));

const TitleText = styled(Typography)(({ theme }) => ({
  fontSize: "36px",
  lineHeight: "40px",
  fontWeight: 500,
  fontFamily: "OutfitMedium",
  color: theme.palette.text.primary,
}));

const SubText = styled(Typography)(({ theme }) => ({
  fontSize: "18px",
  fontWeight: 400,
  fontFamily: "OutfitRegular",
  color: theme.palette.text.secondary,
  lineHeight: "28px",
  letterSpacing: "0",
}));

const HighlightText = styled("span")(() => ({
  background: "linear-gradient(90deg, #4F46E5 0%, #6A4DFF 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
  fontWeight: 500,
}));

const DashboardImageWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  height: "100%",
  minWidth: "1124px",
  minHeight: "487px",
  left: "30px",
  [theme.breakpoints.down("md")]: {
    left: "0",
    minWidth: "757px",
    minHeight: "328px",
  },
}));

const TextWrapper = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  maxWidth: "547px",
  position: "relative",
  zIndex: 1,
}));

const DecorativeImage = styled(Box)(() => ({
  position: "absolute",
  height: "40px",
  width: "40px",
  filter: "blur(1px)",
  zIndex: -1,
}));

const UseCaseBanner = () => {
  const { os } = useDevice();
  const { t } = useTranslation("landing");
  const theme = useTheme();

  return (
    <UseCaseBannerWrapper>
      <Box
        sx={{
          width: "50%",
          [theme.breakpoints.down("md")]: {
            width: "100%",
          },
        }}
      >
        <TextWrapper>
          <DecorativeImage
            sx={{
              top: { md: "-40%", lg: "-70%", sm: "-0%", xs: "-10%" },
              left: { md: "-25px", sm: "100%", xs: "85%" },
            }}
          >
            <Image
              src={BitcoinBg}
              alt="Bitcoin"
              fill
              style={{ objectFit: "cover" }}
              draggable={false}
            />
          </DecorativeImage>
          <TitleText>
            {t("useCaseBannerTitlePrefix")} <HighlightText>{t("useCaseBannerTitleHighlight")}</HighlightText>
          </TitleText>
          <SubText>
            {t("useCaseBannerSubtitle")}
          </SubText>
          {/* Start Accepting Crypto Button */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "start",
              marginTop: "16px",
            }}
          >
            <HomeButton variant="primary" label={t("startAcceptingCrypto")} />
          </Box>
          <DecorativeImage
            sx={{
              bottom: "10%",
              right: { xs: "10%", md: "0%" },
              display: { xs: "block", md: "none" },
            }}
          >
            <Image
              src={EthereumBg}
              alt="Ethereum"
              fill
              style={{ objectFit: "cover" }}
              draggable={false}
            />
          </DecorativeImage>
        </TextWrapper>
      </Box>

      <Box
        sx={{
          width: "50%",
          [theme.breakpoints.down("md")]: {
            width: "100%",
          },
        }}
      >
        <DashboardImageWrapper>
          <Image
            src={os === "ios" ? Dashboard_png : Dashboard_svg}
            alt="Dashboard"
            fill
            style={{ objectFit: "contain", scale: os === "ios" ? "1" : "1.25", marginTop: os === "ios" ? "0px" : "8px" }}
            draggable={false}
            quality={100}
            priority={true}
          />
          <DecorativeImage
            sx={{
              bottom: "5%",
              left: "-65px",
              height: "98px",
              width: "98px",
              filter: "blur(3px)",
              [theme.breakpoints.down("md")]: {
                left: "10px",
                bottom: "-15%",
              },
            }}
          >
            <Image
              src={LitecoinBg}
              alt="Litecoin"
              fill
              style={{ objectFit: "cover" }}
              draggable={false}
            />
          </DecorativeImage>

          <DecorativeImage
            sx={{
              top: "-5%",
              left: { xl: "40%", lg: "35%", md: "30%" },
              display: { xs: "none", md: "block" },
            }}
          >
            <Image
              src={EthereumBg}
              alt="Bitcoin"
              fill
              style={{ objectFit: "cover" }}
              draggable={false}
            />
          </DecorativeImage>
        </DashboardImageWrapper>
      </Box>
    </UseCaseBannerWrapper>
  );
};

export default UseCaseBanner;
