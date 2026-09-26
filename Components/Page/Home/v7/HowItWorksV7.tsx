import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Section 3 of 9 — HOW IT WORKS (answers: "How does it work?") — three steps. */
const STEPS = [
  { n: "01", key: "create" },
  { n: "02", key: "pay" },
  { n: "03", key: "settle" },
];

const HowItWorksV7: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Section id="how-it-works" testId="how-it-works">
      <SectionHead
        center
        eyebrow={t("v7.how.eyebrow")}
        headline={t("v7.how.headline")}
        body={t("v7.how.body")}
        maxWidth={720}
        testId="how-head"
      />
      <Stagger step={0.1} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
        {STEPS.map((step, i) => (
          <StaggerItem key={step.n} i={i} y={18}>
            <Box sx={{ ...cardSx(s), p: { xs: 3, md: 4 }, height: "100%" }}>
              <Box
                sx={{
                  width: 46,
                  height: 46,
                  borderRadius: "12px",
                  display: "grid",
                  placeItems: "center",
                  background: s.accentSoft,
                  color: s.accent,
                  fontFamily: FONT_TECH,
                  fontWeight: 700,
                  fontSize: 16,
                  mb: 2.5,
                }}
              >
                {step.n}
              </Box>
              <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 19, md: 21 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>
                {t(`v7.how.steps.${step.key}.title`)}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.6, color: s.ink2 }}>{t(`v7.how.steps.${step.key}.body`)}</Typography>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(HowItWorksV7);
