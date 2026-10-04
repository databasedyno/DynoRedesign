import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, Section, SectionHead, useConsole } from "./kit";

/** Section 3 — HOW IT WORKS ("How does it work?") — three steps, flat and left-aligned. */
const STEPS = [
  { n: "01", key: "create" },
  { n: "02", key: "pay" },
  { n: "03", key: "settle" },
];

const HowItWorksV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  return (
    <Section id="how-it-works" testId="how-it-works">
      <SectionHead eyebrow={t("v7.how.eyebrow")} title={t("v7.how.headline")} lead={t("v7.how.body")} testId="how-head" />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          border: `1px solid ${s.line}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {STEPS.map((step, i) => (
          <Box
            key={step.n}
            sx={{
              p: { xs: 3, md: 4 },
              borderTop: { xs: i > 0 ? `1px solid ${s.line}` : "none", md: "none" },
              borderLeft: { xs: "none", md: i > 0 ? `1px solid ${s.line}` : "none" },
            }}
          >
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: s.accent }}>
              {step.n}
            </Typography>
            <Typography
              component="h3"
              sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 18, md: 20 }, letterSpacing: "-0.01em", color: s.ink, mt: 2, mb: 1.25 }}
            >
              {t(`v7.how.steps.${step.key}.title`)}
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2 }}>
              {t(`v7.how.steps.${step.key}.body`)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Section>
  );
};

export default memo(HowItWorksV7);
