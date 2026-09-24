import React, { memo } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { FONT_BODY, FONT_TECH, useAurora, BRAND_ACCENT } from "../v3/theme.v3";
import { HeadlineXL, AuroraInk, Body, Eyebrow } from "../v3/styled.v3";
import { PrimaryBtn, SecondaryBtn, goStart } from "../v5/shared";

/**
 * Section 1 of 9 — HERO (answers: "What is it?").
 * Centered statement headline on the dark Bybit ground with a soft yellow glow
 * + faint grid. Two CTAs: Start free (yellow) and See how it works (ghost).
 */
const HeroV7: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  return (
    <Box
      component="section"
      id="hero"
      data-testid="hero"
      sx={{ position: "relative", overflow: "hidden", background: s.bg, pt: { xs: 12, md: 18 }, pb: { xs: 9, md: 13 } }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: "-32%",
          left: "50%",
          transform: "translateX(-50%)",
          width: { xs: 700, md: 1100 },
          height: { xs: 700, md: 1100 },
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}88 26%, transparent 68%)`,
          opacity: s.dark ? 0.16 : 0.08,
          pointerEvents: "none",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: s.dark
            ? "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)"
            : "linear-gradient(rgba(10,10,10,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.028) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 12%, black 10%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 12%, black 10%, transparent 72%)",
          pointerEvents: "none",
        }}
      />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 900, mx: "auto", px: { xs: 3, md: 5 }, textAlign: "center" }}>
        <Eyebrow component="p" sx={{ mb: 3 }}>
          Crypto payments, simplified
        </Eyebrow>
        <HeadlineXL component="h1" data-testid="hero-headline" sx={{ color: s.ink }}>
          Accept crypto payments.
          <br />
          <AuroraInk>Get paid your way.</AuroraInk>
        </HeadlineXL>
        <Body sx={{ color: s.ink2, fontSize: { xs: 17, md: 20 }, mt: 3.5, mx: "auto", maxWidth: 640, fontFamily: FONT_BODY }}>
          Take Bitcoin, Ethereum, USDT and 40+ assets — then settle automatically to the currency or wallet you choose. No
          chargebacks, no custody, live in minutes.
        </Body>
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mt: 4.5 }}>
          <PrimaryBtn data-testid="hero-primary-cta" onClick={() => goStart(router, "hero")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
            Start free
          </PrimaryBtn>
          <SecondaryBtn data-testid="hero-secondary-cta" onDark={s.dark} href="/pay/demo" startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 20 }} />}>
            See how it works
          </SecondaryBtn>
        </Box>
        <Body sx={{ fontFamily: FONT_TECH, fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: s.ink3, mt: 3 }}>
          No credit card · Your first payment is free
        </Body>
      </Box>
    </Box>
  );
};

export default memo(HeroV7);
