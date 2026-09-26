import React, { memo } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, useAurora, BRAND_ACCENT } from "../v3/theme.v3";
import { HeadlineL, Body, Eyebrow } from "../v3/styled.v3";
import { PrimaryBtn, SecondaryBtn, goStart } from "../v5/shared";
import { PaidStack } from "./mock/PaidStack";

/** Section 9 of 9 — FINAL CTA (answers: "How do I get started?"). Merchant "paid → settled" cards float beside the headline on wide screens. */
const FinalCTAV7: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  return (
    <Box component="section" id="get-started" data-testid="final-cta" sx={{ position: "relative", overflow: "hidden", background: s.bg, py: { xs: 10, md: 15 } }}>
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          bottom: "-40%",
          left: "50%",
          transform: "translateX(-50%)",
          width: { xs: 640, md: 1000 },
          height: { xs: 640, md: 1000 },
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT}88 28%, transparent 68%)`,
          opacity: s.dark ? 0.14 : 0.07,
          pointerEvents: "none",
        }}
      />
      <Box sx={{ position: "absolute", top: "50%", left: "calc(50% + 340px)", transform: "translateY(-50%)", display: { xs: "none", lg: "block" }, zIndex: 1 }}>
        <PaidStack />
      </Box>
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 760, mx: "auto", px: { xs: 3, md: 5 }, textAlign: "center" }}>
        <Eyebrow component="p" sx={{ mb: 2.5 }}>
          {t("v7.finalCta.eyebrow")}
        </Eyebrow>
        <HeadlineL component="h2" sx={{ color: s.ink }}>
          {t("v7.finalCta.headline")}
        </HeadlineL>
        <Body sx={{ color: s.ink2, fontSize: { xs: 16, md: 18.5 }, mt: 2.5, mx: "auto", maxWidth: 560, fontFamily: FONT_BODY }}>
          {t("v7.finalCta.body")}
        </Body>
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.5, mt: 4 }}>
          <PrimaryBtn data-testid="final-primary-cta" onClick={() => goStart(router, "final")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
            {t("v7.finalCta.primary")}
          </PrimaryBtn>
          <SecondaryBtn data-testid="final-secondary-cta" onDark={s.dark} href="/documentation">
            {t("v7.finalCta.secondary")}
          </SecondaryBtn>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FinalCTAV7);
