import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, Section, SectionHead, cardSx, useConsole } from "./kit";

/** Section 7 — MERCHANT STORIES ("Do others trust it?") — two real merchants. */
const STORIES = [
  { key: "devstore", name: "The Dev Store" },
  { key: "safedeal", name: "SafeDeal" },
];

const ProofV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  return (
    <Section id="proof" testId="proof">
      <SectionHead eyebrow={t("v7.proof.eyebrow")} title={t("v7.proof.headline")} testId="proof-head" />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {STORIES.map((st) => (
          <Box key={st.name} sx={{ ...cardSx(s, { hover: false }), p: { xs: 3, md: 4 }, display: "flex", flexDirection: "column" }}>
            <Box aria-hidden sx={{ fontFamily: FONT_DISPLAY, fontSize: 40, lineHeight: 0.5, color: s.accent, height: 24 }}>
              &ldquo;
            </Box>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 17, md: 19 }, lineHeight: 1.5, letterSpacing: "-0.01em", color: s.ink, flexGrow: 1 }}>
              {t(`v7.proof.${st.key}.quote`)}
            </Typography>
            <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${s.line}` }}>
              <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 15, color: s.ink }}>{st.name}</Typography>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.04em", color: s.ink3, mt: 0.5 }}>
                {t(`v7.proof.${st.key}.role`)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Section>
  );
};

export default memo(ProofV7);
