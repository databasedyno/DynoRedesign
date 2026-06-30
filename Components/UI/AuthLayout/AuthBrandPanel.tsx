import React from "react";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import WhiteLogo from "@/assets/Images/auth/dynopay-white-logo.png";

/* ── Floating crypto coin – pure CSS ─────────────────── */
const CryptoCoin = ({
  symbol,
  size,
  top,
  left,
  delay,
  color,
}: {
  symbol: string;
  size: number;
  top: string;
  left: string;
  delay: string;
  color: string;
}) => (
  <Box
    sx={{
      position: "absolute",
      top,
      left,
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.45,
      fontWeight: 700,
      color: "#fff",
      fontFamily: "UrbanistBold, sans-serif",
      opacity: 0.55,
      animation: `floatCoin 6s ease-in-out ${delay} infinite`,
      "@keyframes floatCoin": {
        "0%, 100%": { transform: "translateY(0px)" },
        "50%": { transform: "translateY(-10px)" },
      },
    }}
  >
    {symbol}
  </Box>
);

/* ── Trust metric pill ──────────────────────────────── */
const TrustPill = ({
  value,
  label,
}: {
  value: string;
  label: string;
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "2px",
    }}
  >
    <Typography
      sx={{
        fontFamily: "UrbanistBold, sans-serif",
        fontWeight: 800,
        fontSize: "28px",
        lineHeight: 1.1,
        color: "#fff",
      }}
    >
      {value}
    </Typography>
    <Typography
      sx={{
        fontFamily: "UrbanistMedium, sans-serif",
        fontSize: "12px",
        fontWeight: 500,
        color: "rgba(255,255,255,0.7)",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </Typography>
  </Box>
);

/* ── Main Export ─────────────────────────────────────── */
const AuthBrandPanel = () => {
  const { t } = useTranslation("auth");
  return (
  <Box
    sx={{
      flex: "0 0 46%",
      maxWidth: "46%",
      position: "relative",
      flexDirection: "column",
      justifyContent: "space-between",
      overflow: "hidden",
      background: "linear-gradient(160deg, #0004FF 0%, #1a0a6e 50%, #0e063a 100%)",
      padding: "40px 36px 32px",
      borderRadius: "16px 0 0 16px",
      minHeight: 580,
      /* hide on tablets / mobile — form takes full width */
      display: { xs: "none", lg: "flex" },
    }}
  >
    {/* Decorative gradient orbs */}
    <Box
      sx={{
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)",
        top: -60,
        right: -80,
        pointerEvents: "none",
      }}
    />
    <Box
      sx={{
        position: "absolute",
        width: 250,
        height: 250,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,4,255,0.25) 0%, transparent 70%)",
        bottom: -40,
        left: -60,
        pointerEvents: "none",
      }}
    />

    {/* Floating crypto coins */}
    <CryptoCoin symbol="₿" size={44} top="22%" left="78%" delay="0s" color="rgba(247,147,26,0.65)" />
    <CryptoCoin symbol="Ξ" size={36} top="55%" left="82%" delay="1.5s" color="rgba(98,126,234,0.65)" />
    <CryptoCoin symbol="$" size={30} top="72%" left="10%" delay="3s" color="rgba(38,161,123,0.6)" />
    <CryptoCoin symbol="◎" size={28} top="15%" left="12%" delay="2s" color="rgba(153,69,255,0.55)" />

    {/* Top: Logo */}
    <Box sx={{ position: "relative", zIndex: 1 }}>
      <Link href="/" style={{ display: "inline-block", cursor: "pointer" }}>
        <Image
          src={WhiteLogo}
          alt="DynoPay"
          width={130}
          height={44}
          draggable={false}
        />
      </Link>
    </Box>

    {/* Middle: Headline */}
    <Box sx={{ position: "relative", zIndex: 1, my: "auto", pt: 4 }}>
      <Typography
        sx={{
          fontFamily: "UrbanistBold, sans-serif",
          fontWeight: 800,
          fontSize: "32px",
          lineHeight: 1.2,
          color: "#fff",
          mb: 1.5,
        }}
      >
        {t("brandHeadlineLine1")}
        <br />
        {t("brandHeadlineLine2")}
      </Typography>
      <Typography
        sx={{
          fontFamily: "UrbanistRegular, sans-serif",
          fontSize: "15px",
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.72)",
          maxWidth: 340,
        }}
      >
        {t("brandSubtitle")}
      </Typography>
    </Box>

    {/* Bottom: Trust metrics */}
    <Box
      sx={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        pt: 3,
        borderTop: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <TrustPill value="1,000+" label={t("brandStatBusinessesLabel")} />
      <TrustPill value="15+" label={t("brandStatCoinsLabel")} />
      <TrustPill value="<1min" label={t("brandStatSettlementsLabel")} />
    </Box>
  </Box>
  );
};

export default AuthBrandPanel;
