import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
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

/**
 * Expressive auth hero panel (login + register only, desktop lg+).
 * Reserved indigo→violet aurora surface with a glass social-proof badge,
 * glowing headline, bento stat tiles, a coin marquee and pill progress dots —
 * the Adoption Plan (Phase 2) "expressive on auth" surface. Hidden below lg.
 */
const AuthBrandPanel = () => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const accent = dark ? "#818CF8" : BRAND_ACCENT;
  const accentSoft = dark ? "rgba(129,140,248,0.18)" : "rgba(79,70,229,0.12)";
  const accentPulse = dark ? "rgba(129,140,248,0.55)" : "rgba(79,70,229,0.5)";
  const sub = dark ? "rgba(255,255,255,0.62)" : "rgba(10,10,10,0.6)";

  // Kept subtle in light so the dark headline / body text stays WCAG AA.
  const panelBg = dark
    ? "radial-gradient(135% 120% at 100% 0%, rgba(139,92,246,0.22) 0%, transparent 46%), radial-gradient(120% 120% at 0% 100%, rgba(99,102,241,0.24) 0%, transparent 52%), linear-gradient(158deg, #0C1022 0%, #090C16 100%)"
    : "radial-gradient(135% 120% at 100% 0%, rgba(139,92,246,0.13) 0%, transparent 46%), radial-gradient(120% 120% at 0% 100%, rgba(99,102,241,0.14) 0%, transparent 52%), linear-gradient(158deg, #FBFAFF 0%, #F0F1FE 100%)";
  const panelBorder = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(67,56,202,0.12)";
  const panelShadow = dark
    ? "0 40px 90px -50px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)"
    : "0 46px 100px -56px rgba(67,56,202,0.4), inset 0 1px 0 rgba(255,255,255,0.9)";

  const tileBg = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)";
  const tileBorder = dark ? "rgba(255,255,255,0.1)" : "rgba(10,10,10,0.06)";
  const tileShadow = dark
    ? "inset 0 1px 0 rgba(255,255,255,0.06)"
    : "0 20px 50px -34px rgba(31,41,55,0.35), inset 0 1px 0 rgba(255,255,255,0.9)";

  const Tile: React.FC<{ children: React.ReactNode; sx?: any; delay?: number }> = ({
    children,
    sx,
    delay = 0,
  }) => (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "18px",
        background: tileBg,
        border: `1px solid ${tileBorder}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: tileShadow,
        padding: "20px 22px",
        animation: `brandTileIn 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
        "@keyframes brandTileIn": {
          "0%": { opacity: 0, transform: "translateY(18px)" },
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
      data-testid="auth-brand-panel"
      sx={{
        position: "relative",
        overflow: "hidden",
        flex: "1 1 0",
        maxWidth: 560,
        display: { xs: "none", lg: "flex" },
        flexDirection: "column",
        gap: "22px",
        borderRadius: "28px",
        padding: "38px 38px 32px",
        background: panelBg,
        border: panelBorder,
        boxShadow: panelShadow,
      }}
    >
      {/* Drifting aurora blobs */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "-14%",
          right: "-10%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${dark ? "rgba(129,140,248,0.4)" : "rgba(99,102,241,0.18)"} 0%, transparent 68%)`,
          filter: "blur(14px)",
          pointerEvents: "none",
          animation: "auroraA 16s ease-in-out infinite alternate",
          "@keyframes auroraA": {
            "0%": { transform: "translate(0,0) scale(1)" },
            "100%": { transform: "translate(-30px,26px) scale(1.12)" },
          },
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: "-16%",
          left: "-12%",
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${dark ? "rgba(139,92,246,0.34)" : "rgba(139,92,246,0.16)"} 0%, transparent 68%)`,
          filter: "blur(16px)",
          pointerEvents: "none",
          animation: "auroraB 20s ease-in-out infinite alternate",
          "@keyframes auroraB": {
            "0%": { transform: "translate(0,0) scale(1.05)" },
            "100%": { transform: "translate(34px,-22px) scale(1)" },
          },
        }}
      />

      {/* Content */}
      <Box sx={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "22px" }}>
        {/* Social-proof glass badge */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "9px",
            alignSelf: "flex-start",
            px: "13px",
            py: "7px",
            borderRadius: "999px",
            background: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.72)",
            border: `1px solid ${tileBorder}`,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: dark ? "none" : "0 12px 30px -20px rgba(31,41,55,0.4)",
          }}
        >
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 10px ${accent}`,
              animation: "badgePulse 2.2s ease-in-out infinite",
              "@keyframes badgePulse": {
                "0%,100%": { boxShadow: `0 0 0 0 ${accentPulse}` },
                "50%": { boxShadow: "0 0 0 6px rgba(129,140,248,0)" },
              },
            }}
          />
          <Typography
            sx={{
              fontFamily: FONT_MONO,
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: dark ? "rgba(255,255,255,0.82)" : "rgba(10,10,10,0.72)",
            }}
          >
            {t("brandTrustBadge", { defaultValue: "Non-custodial · funds go straight to you" })}
          </Typography>
        </Box>

        {/* Headline */}
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 800,
              fontSize: "34px",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: theme.palette.text.primary,
              textShadow: dark ? "0 0 44px rgba(129,140,248,0.28)" : "none",
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
              fontSize: "15px",
              lineHeight: 1.55,
              color: sub,
              maxWidth: 440,
              mt: 1.75,
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
            gap: "14px",
          }}
        >
          <Tile delay={0.05} sx={{ gridRow: "span 2", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Box
              sx={{
                position: "absolute",
                width: 170,
                height: 170,
                top: -66,
                right: -46,
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

          <Tile delay={0.12}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: "23px", lineHeight: 1, color: accent, textShadow: dark ? "0 0 22px rgba(129,140,248,0.5)" : "none" }}>
              1.5% → 0.5%
            </Typography>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: sub, mt: 1 }}>
              {t("brandStatCoinsLabel")}
            </Typography>
          </Tile>

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
                    "50%": { boxShadow: "0 0 0 7px rgba(129,140,248,0)" },
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
            borderRadius: "14px",
            border: `1px solid ${tileBorder}`,
            background: tileBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            py: "13px",
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

        {/* Pill progress dots */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mt: "2px" }}>
          <Box sx={{ width: 24, height: 6, borderRadius: "999px", background: accent }} />
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: dark ? "rgba(255,255,255,0.22)" : "rgba(10,10,10,0.16)" }} />
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: dark ? "rgba(255,255,255,0.22)" : "rgba(10,10,10,0.16)" }} />
        </Box>
      </Box>
    </Box>
  );
};

export default AuthBrandPanel;
