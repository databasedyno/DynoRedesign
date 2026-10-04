import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import { Display, Eyebrow, FONT_BODY, FONT_MONO, PrimaryBtn, SecondaryBtn, goStart, useConsole } from "./kit";
import CheckoutMock from "./mock/CheckoutMock";
import { MockPlinth } from "./mock/MockPlinth";
import { HOME_PAYMENTS } from "./mock/payments";

/**
 * Section 1 — HERO ("What is it?"). Mercury-style operations-console look:
 * left-aligned editorial headline block beside the REAL hosted checkout as a
 * live product panel (no stock imagery, no aurora glow, no gradient text).
 */
const HeroV7: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");

  return (
    <Box
      component="section"
      id="hero"
      data-testid="hero"
      sx={{ background: s.canvas, pt: { xs: 5, md: 8 }, pb: { xs: 7, md: 11 } }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, 1.05fr)" },
          gap: { xs: 6, lg: 7 },
          alignItems: "center",
        }}
      >
        {/* Left — editorial copy */}
        <Box sx={{ maxWidth: 560, minWidth: 0 }}>
          <Eyebrow sx={{ mb: 3 }}>{t("v7.hero.eyebrow")}</Eyebrow>
          <Display testId="hero-headline">
            {t("v7.hero.headline1")} {t("v7.hero.headline2")}
          </Display>
          <Typography
            sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16, md: 18 }, lineHeight: 1.6, mt: 3, maxWidth: 520 }}
          >
            {t("v7.hero.body")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4 }}>
            <PrimaryBtn
              data-testid="hero-primary-cta"
              onClick={() => goStart(router, "hero")}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
            >
              {t("v7.hero.primary")}
            </PrimaryBtn>
            <SecondaryBtn
              data-testid="hero-secondary-cta"
              href="/pay/demo"
              startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 20 }} />}
            >
              {t("v7.hero.secondary")}
            </SecondaryBtn>
          </Box>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mt: 3.5 }}>
            <LockRoundedIcon sx={{ fontSize: 13, color: s.ink3 }} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.04em", color: s.ink3 }}>
              {t("v7.hero.note")}
            </Typography>
          </Box>
        </Box>

        {/* Right — live product panel */}
        <Box
          data-testid="hero-mock-wrap"
          sx={{ position: "relative", width: "100%", minWidth: 0, maxWidth: { xs: 480, lg: "none" }, mx: { xs: "auto", lg: 0 } }}
        >
          <MockPlinth>
            <CheckoutMock payments={HOME_PAYMENTS} />
          </MockPlinth>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroV7);
