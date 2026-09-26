import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Section 6 of 9 — CUSTOMER PROOF (answers: "Do others trust it?") — two stories max. */
const STORIES = [
  { key: "devstore", name: "The Dev Store" },
  { key: "safedeal", name: "SafeDeal" },
];

const ProofV7: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Section id="proof" alt testId="proof">
      <SectionHead center eyebrow={t("v7.proof.eyebrow")} headline={t("v7.proof.headline")} maxWidth={720} testId="proof-head" />
      <Stagger step={0.12} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: { xs: 2.5, md: 3 }, maxWidth: 980, mx: "auto" }}>
        {STORIES.map((st, i) => (
          <StaggerItem key={st.name} i={i} y={18}>
            <Box sx={{ ...cardSx(s, { hover: false }), p: { xs: 3, md: 4 }, height: "100%", display: "flex", flexDirection: "column" }}>
              <FormatQuoteRoundedIcon sx={{ fontSize: 34, color: s.accent, mb: 1.5 }} />
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 500, fontSize: { xs: 18, md: 20 }, lineHeight: 1.45, letterSpacing: "-0.01em", color: s.ink, flexGrow: 1 }}>
                “{t(`v7.proof.${st.key}.quote`)}”
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15, color: s.ink }}>{st.name}</Typography>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, letterSpacing: "0.04em", color: s.ink3, mt: 0.25 }}>{t(`v7.proof.${st.key}.role`)}</Typography>
              </Box>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(ProofV7);
