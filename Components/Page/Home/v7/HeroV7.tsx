import React, { memo } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { FONT_BODY, FONT_TECH, useAurora, BRAND_ACCENT } from "../v3/theme.v3";
import { HeadlineXL, AuroraInk, Body, Eyebrow } from "../v3/styled.v3";
import { PrimaryBtn, SecondaryBtn, goStart } from "../v5/shared";
import CheckoutMock from "./mock/CheckoutMock";

/**
 * Section 1 of 9 — HERO (answers: "What is it?").
 * Centered statement headline on the dark Bybit ground with a soft yellow glow,
 * two CTAs (Start free / See how it works) and, below them, the real hosted
 * checkout as a glossy product mockup cycling through a payment being received.
 */
const HeroV7: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  return (
    <Box
      component="section"
      id="hero"
      data-testid="hero"
      sx={{ position: "relative", overflow: "hidden", background: s.bg, pt: { xs: 12, md: 18 }, pb: { xs: 8, md: 11 } }}
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
        <Box data-testid="hero-mock-wrap" sx={{ position: "relative", mt: { xs: 7, md: 9 }, mx: "auto", maxWidth: 760, textAlign: "left" }}>
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              left: "8%",
              right: "8%",
              bottom: "-18%",
              height: "55%",
              borderRadius: "50%",
              background: `radial-gradient(ellipse at center, ${BRAND_ACCENT}66 0%, transparent 70%)`,
              filter: "blur(36px)",
              opacity: s.dark ? 0.55 : 0.35,
              pointerEvents: "none",
            }}
          />
          <Box sx={{ position: "relative", transform: { md: "perspective(1800px) rotateX(3deg)" }, transformOrigin: "top center" }}>
            <CheckoutMock />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroV7);
