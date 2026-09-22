import React, { memo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { keyframes } from "@mui/system";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForward from "@mui/icons-material/ArrowForward";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { PrimaryBtn, SecondaryBtn, goStart } from "../v5/shared";
import { LiveDot } from "../motion/accents";
import HeroCheckoutDemo from "../v5/HeroCheckoutDemo";
import LiveSettlementFeed from "../v5/LiveSettlementFeed";
import AuroraField from "./AuroraField";
import LiveStrip from "./LiveStrip";
import GoogleG from "./GoogleG";

const copyIn = keyframes`from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}`;
const cardIn = keyframes`from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}`;
const enter = (delay: number) => ({ animation: `${copyIn} 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s both`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } });

/** Device card drifts up a little slower than the page — desktop only, off under reduced motion. */
const ParallaxCard: React.FC<React.PropsWithChildren> = ({ children }) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (v) => (desktop && !reduced ? -Math.min(v, 700) * (44 / 700) : 0));
  return (
    <motion.div data-testid="hero-parallax" style={{ y, width: "100%", display: "flex", justifyContent: "inherit" }}>
      {children}
    </motion.div>
  );
};

/** v6 hero — statement headline over the animated conversion gradient; the real sandbox checkout as a floating device card. */
const HeroV6: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" data-testid="hero-v6" sx={{ position: "relative", overflow: "hidden", background: s.bg, pt: { xs: 9, md: 14 }, pb: { xs: 6, md: 8 } }}>
      <AuroraField />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.22fr 0.78fr" }, alignItems: "center", gap: { xs: 5, md: 8 } }}>
          <Box>
            <Typography component="p" sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.26em", textTransform: "uppercase", color: s.dark ? "#2BD4C4" : "#0F8F86", mb: 3.5, ...enter(0) }}>
              <LiveDot data-testid="hero-live-dot" /> {t("v5.hero.eyebrow")}
            </Typography>
            <Typography component="h1" data-testid="hero-headline" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: "clamp(40px, 4.9vw, 68px)", lineHeight: 0.98, letterSpacing: "-0.042em", color: s.ink, mb: 3.5, ...enter(0.08) }}>
              <Box component="span" sx={{ display: "block", background: s.dark ? "linear-gradient(92deg, #FFD100 0%, #FFB300 48%, #6EE7B7 100%)" : "linear-gradient(92deg, #FFD100 0%, #FFB300 48%, #059669 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", pb: "0.06em" }}>
                {t("v6.hero.h1a")}
              </Box>
              {t("v6.hero.h1b")}
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 17, md: 19 }, lineHeight: 1.5, color: s.ink2, maxWidth: 560, mb: 4.5, ...enter(0.16) }}>{t("v5.hero.body")}</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", ...enter(0.24) }}>
              <PrimaryBtn data-testid="hero-primary-cta" onClick={() => goStart(router, "hero")} endIcon={<ArrowForward sx={{ fontSize: 18 }} />} sx={{ background: s.ink, color: s.dark ? "#0A0A0A" : "#FFFFFF", boxShadow: "none", "&:hover": { background: s.dark ? "#E4E4E7" : "#26262B", transform: "translateY(-1px)", boxShadow: "none" } }}>
                {t("v6.hero.primary")}
              </PrimaryBtn>
              <SecondaryBtn data-testid="hero-secondary-cta" href="/pay/demo" startIcon={<PlayArrowRounded sx={{ fontSize: 20 }} />}>{t("v5.hero.secondary")}</SecondaryBtn>
              <SecondaryBtn data-testid="hero-google-cta" href="/auth/register?ref=hero_google" startIcon={<GoogleG />} sx={{ border: "none", px: 2, "&:hover": { background: s.dark ? "rgba(255,255,255,0.06)" : "rgba(10,10,10,0.05)", border: "none" } }}>{t("v6.hero.google")}</SecondaryBtn>
            </Box>
            <Typography data-testid="hero-primary-helper" sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: s.ink3, mt: 2.5, ...enter(0.3) }}>{t("v5.hero.primaryHelper")}</Typography>
          </Box>

          <Box sx={{ position: "relative", display: "flex", justifyContent: { xs: "center", md: "flex-end" }, animation: `${cardIn} 1s cubic-bezier(0.16,1,0.3,1) 0.14s both`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
            <ParallaxCard>
              <Box
                data-testid="hero-device"
                sx={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 440,
                  transform: { xs: "none", md: "perspective(1400px) rotateY(-8deg) rotateX(3deg)" },
                  transition: "transform 700ms cubic-bezier(0.16,1,0.3,1)",
                  "&:hover": { transform: "perspective(1400px) rotateY(0deg) rotateX(0deg)" },
                  "@media (prefers-reduced-motion: reduce)": { transform: "none", transition: "none" },
                  "& > .hero-demo": { filter: s.dark ? "drop-shadow(0 60px 90px rgba(0,0,0,0.65))" : "drop-shadow(0 60px 90px rgba(30,27,75,0.30))" },
                }}
              >
                <Box data-testid="hero-sandbox-tag" sx={{ position: "absolute", top: -14, left: 18, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 0.8, px: 1.4, py: 0.5, borderRadius: 999, background: s.dark ? "#0B0D17" : "#0A0A0A", color: "#fff", fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  <LiveDot color="#34D399" /> {t("v6.hero.sandboxTag")}
                </Box>
                <Box className="hero-demo"><HeroCheckoutDemo /></Box>
              </Box>
            </ParallaxCard>
          </Box>
        </Box>
        <Typography sx={{ display: { xs: "block", md: "none" }, fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, textAlign: "center", mt: 2 }}>{t("v5.hero.demoNote")}</Typography>
        <LiveStrip />
        <LiveSettlementFeed />
      </Box>
    </Box>
  );
};

export default memo(HeroV6);
