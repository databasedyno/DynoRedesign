import React, { memo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { keyframes } from "@mui/system";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForward from "@mui/icons-material/ArrowForward";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Body, Eyebrow, HeadlineXL } from "../v3/styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { PrimaryBtn, SecondaryBtn, goStart } from "./shared";
import { GradientInk, LiveDot } from "../motion/accents";
import HeroCheckoutDemo from "./HeroCheckoutDemo";
import ProofStrip from "./ProofStrip";
import LiveSettlementFeed from "./LiveSettlementFeed";

const copyIn = keyframes`from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}`;
const cardIn = keyframes`from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}`;
const enter = (delay: number) => ({ animation: `${copyIn} 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s both`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } });

/** Checkout card drifts up a little slower than the page (Hostinger masonry-parallax) — desktop only, off under reduced motion. */
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

/** Hero — one promise, one action, live proof. */
const HeroV5: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");

  return (
    <Box component="section" data-testid="hero-v5" sx={{ position: "relative", overflow: "hidden", background: s.bg, pt: { xs: 10, md: 15 }, pb: { xs: 8, md: 10 } }}>
      {/* Accent glow as a radial gradient — NOT filter:blur(140px): a 560px blurred
          layer at @3x DPR is a known iOS Safari paint stall (blank tiles for seconds). */}
      <Box aria-hidden sx={{ position: "absolute", top: "-30%", right: "-12%", width: { xs: 700, md: 1100 }, height: { xs: 700, md: 1100 }, borderRadius: "50%", background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}99 30%, transparent 70%)`, opacity: s.dark ? 0.09 : 0.07, pointerEvents: "none" }} />
      {/* Second mesh accent (violet→sky) low-left for depth — same cheap radial technique. */}
      <Box aria-hidden sx={{ position: "absolute", bottom: "-34%", left: "-14%", width: { xs: 560, md: 920 }, height: { xs: 560, md: 920 }, borderRadius: "50%", background: "radial-gradient(circle, #7C5CFF 0%, #4FD1FF88 34%, transparent 70%)", opacity: s.dark ? 0.10 : 0.06, pointerEvents: "none" }} />
      {/* Faint grid + grain give the empty space texture without a heavy raster. */}
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: s.dark ? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)" : "linear-gradient(rgba(10,10,10,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.028) 1px, transparent 1px)", backgroundSize: "72px 72px", maskImage: "radial-gradient(ellipse 90% 80% at 50% 30%, black 10%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 30%, black 10%, transparent 75%)", pointerEvents: "none" }} />
      <Box aria-hidden sx={{ position: "absolute", inset: 0, opacity: s.dark ? 0.05 : 0.035, mixBlendMode: s.dark ? "screen" : "multiply", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", pointerEvents: "none" }} />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.08fr 0.92fr" }, alignItems: "center", gap: { xs: 4, md: 10 } }}>
          <Box>
            <Eyebrow component="p" sx={{ mb: 3, display: "inline-flex", alignItems: "center", gap: 1, ...enter(0) }}>
              <LiveDot data-testid="hero-live-dot" />
              {t("v5.hero.eyebrow")}
            </Eyebrow>
            <HeadlineXL component="h1" sx={{ color: s.ink, mb: 3, fontSize: "clamp(38px, 5.6vw, 76px)", ...enter(0.08) }}>
              {t("v5.hero.h1a")}
              <br />
              {t("v5.hero.h1b")}<GradientInk>{t("v5.hero.h1Accent")}</GradientInk>{t("v5.hero.h1c")}
            </HeadlineXL>
            <Body sx={{ color: s.ink2, maxWidth: 540, mb: 4.5, fontSize: { xs: 16, md: 18 }, ...enter(0.16) }}>{t("v5.hero.body")}</Body>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", ...enter(0.24) }}>
              <PrimaryBtn data-testid="hero-primary-cta" onClick={() => goStart(router, "hero")} endIcon={<ArrowForward sx={{ fontSize: 18 }} />}>
                {t("v5.hero.primary")}
              </PrimaryBtn>
              <SecondaryBtn data-testid="hero-secondary-cta" href="/pay/demo" startIcon={<PlayArrowRounded sx={{ fontSize: 20 }} />}>
                {t("v5.hero.secondary")}
              </SecondaryBtn>
            </Box>
            <Typography data-testid="hero-primary-helper" sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: s.ink3, mt: 2.25, ...enter(0.3) }}>
              {t("v5.hero.primaryHelper")}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: { xs: "center", md: "flex-end" }, animation: `${cardIn} 0.9s cubic-bezier(0.16,1,0.3,1) 0.12s both`, "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
            <ParallaxCard>
              <HeroCheckoutDemo />
            </ParallaxCard>
          </Box>
        </Box>
        <Typography sx={{ display: { xs: "block", md: "none" }, fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, textAlign: "center", mt: 2 }}>{t("v5.hero.demoNote")}</Typography>

        <ProofStrip />
        <LiveSettlementFeed />
      </Box>
    </Box>
  );
};

export default memo(HeroV5);
