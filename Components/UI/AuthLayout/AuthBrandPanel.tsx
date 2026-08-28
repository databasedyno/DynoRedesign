import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
// Near-black (light mode) / white (dark mode) wordmarks — same assets as the
// landing header. The old blue PNG (dynopay-logo.png) clashed with the
// lime/olive auth palette in light mode.
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import BlackLogo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import { BRAND_ACCENT } from "@/constants/theme";

const FONT_DISPLAY = "var(--font-hero), sans-serif";
const FONT_BODY = "var(--font-body), sans-serif";
const FONT_MONO = "var(--font-tech), monospace";

const COINS = [
  { s: "BTC", c: "#F7931A" },
  { s: "ETH", c: "#627EEA" },
  { s: "USDT", c: "#26A17B" },
  { s: "USDC", c: "#2775CA" },
  { s: "SOL", c: "#9945FF" },
  { s: "BNB", c: "#F0B90B" },
  { s: "XRP", c: "#23292F" },
  { s: "TRX", c: "#EF0027" },
];

const AuthBrandPanel = () => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  // Aurora indigo — matches Landing v3 (was: cyber-lime #CCFF00).
  const accent = dark ? "#818CF8" : BRAND_ACCENT;
  const accentSoft = dark ? "rgba(129,140,248,0.18)" : "rgba(79,70,229,0.12)";
  const accentPulse = dark ? "rgba(129,140,248,0.55)" : "rgba(79,70,229,0.5)";

  const tileBg = dark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.6)";
  const tileBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.08)";
  const tileShadow = dark
    ? "inset 0 1px 0 rgba(255,255,255,0.06)"
    : "0 20px 50px -30px rgba(31,41,55,0.4), inset 0 1px 0 rgba(255,255,255,0.9)";
  const sub = dark ? "rgba(255,255,255,0.62)" : "rgba(10,10,10,0.6)";

  const Tile: React.FC<{ children: React.ReactNode; sx?: any; delay?: number }> = ({
    children,
    sx,
    delay = 0,
  }) => (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "22px",
        background: tileBg,
        border: `1px solid ${tileBorder}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: tileShadow,
        padding: "22px 24px",
        animation: `brandTileIn 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
        "@keyframes brandTileIn": {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );

  return (
    <Box
      sx={{
        flex: "1 1 auto",
        maxWidth: 600,
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: "inline-block", width: "fit-content" }}>
        <Image src={dark ? WhiteLogo : BlackLogo} alt="Dynopay" width={140} height={47} draggable={false} />
      </Link>

      {/* Headline */}
      <Box sx={{ mt: 0.5 }}>
        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: "34px",
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: theme.palette.text.primary,
          }}
        >
          {t("brandHeadlineLine1")}{" "}
          <Box component="span" sx={{ color: accent }}>
            {t("brandHeadlineLine2")}
          </Box>
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_BODY,
            fontSize: "16px",
            lineHeight: 1.55,
            color: sub,
            maxWidth: 420,
            mt: 2,
          }}
        >
          {t("brandSubtitle")}
        </Typography>
      </Box>

      {/* Bento grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gridTemplateRows: "auto auto",
          gap: "16px",
          mt: 1,
        }}
      >
        {/* Big businesses tile */}
        <Tile delay={0.05} sx={{ gridRow: "span 2", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <Box
            sx={{
              position: "absolute",
              width: 180,
              height: 180,
              top: -70,
              right: -50,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${accentSoft} 0%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: `0 0 12px ${accent}` }} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: sub }}>
              {t("brandStatBusinessesLabel")}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "40px", lineHeight: 1, color: theme.palette.text.primary }}>
              9
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: "13px", color: sub, mt: 1 }}>
              {t("brandBusinessesCaption")}
            </Typography>
          </Box>
        </Tile>

        {/* Coins tile */}
        <Tile delay={0.12}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "22px", lineHeight: 1, color: accent }}>
            1.5% → 0.5%
          </Typography>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: sub, mt: 1 }}>
            {t("brandStatCoinsLabel")}
          </Typography>
        </Tile>

        {/* Settlements tile */}
        <Tile delay={0.19}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: accent,
                animation: "brandPulse 1.8s ease-in-out infinite",
                "@keyframes brandPulse": {
                  "0%, 100%": { boxShadow: `0 0 0 0 ${accentPulse}` },
                  "50%": { boxShadow: `0 0 0 7px rgba(79,70,229,0)` },
                },
              }}
            />
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "30px", lineHeight: 1, color: theme.palette.text.primary }}>
              24/7
            </Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: sub, mt: 1 }}>
            {t("brandStatSettlementsLabel")}
          </Typography>
        </Tile>
      </Box>

      {/* Coin marquee */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "16px",
          border: `1px solid ${tileBorder}`,
          background: tileBg,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          py: "14px",
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: "28px",
            width: "max-content",
            animation: "coinMarquee 22s linear infinite",
            "@keyframes coinMarquee": {
              "0%": { transform: "translateX(0)" },
              "100%": { transform: "translateX(-50%)" },
            },
          }}
        >
          {[...COINS, ...COINS].map((coin, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: coin.c }} />
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: "13px", fontWeight: 600, color: theme.palette.text.primary, opacity: 0.85 }}>
                {coin.s}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default AuthBrandPanel;
