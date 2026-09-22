import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";
import { PrimaryBtn, Section, SectionHead, goStart } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import FlowVisual from "./FlowVisual";
import { NetworkEtaRow } from "./NetworkEtaRow";

/** §2.3-4 "The conversion story": buyer pays in BTC, you receive USDC, in your own wallet — with the three steps folded in. */
const ConversionStory: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#2BD4C4" : BRAND_ACCENT;
  const STEPS = [1, 2, 3].map((n) => ({ n, title: t(`v5.how.s${n}t`), desc: t(`v5.how.s${n}d`) }));
  return (
    <Section id="how-it-works" testId="how-it-works">
      <SectionHead eyebrow={t("v6.story.eyebrow")} headline={t("v6.story.headline")} body={t("v6.story.body")} maxWidth={760} />
      <Stagger step={0.1} sx={{ display: "grid" }}>
        <StaggerItem i={0} y={24}><FlowVisual /></StaggerItem>
      </Stagger>
      <Stagger step={0.1} data-testid="story-steps" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 0, md: 4 }, mt: { xs: 5, md: 7 } }}>
        {STEPS.map((st, i) => (
          <StaggerItem key={st.n} i={i} y={14}>
            <Box data-testid={`how-step-${st.n}`} sx={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 2, py: { xs: 2.5, md: 3 }, borderTop: `1px solid ${s.lineStrong}` }}>
              <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.1em", color: accent, pt: 0.4 }}>0{st.n}</Typography>
              <Box>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 17, md: 19 }, letterSpacing: "-0.015em", color: s.ink, mb: 0.75 }}>{st.title}</Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: s.ink2 }}>{st.desc}</Typography>
              </Box>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
      <Box sx={{ mt: { xs: 4, md: 5 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: { xs: 4, lg: 6 }, alignItems: "end" }}>
        <NetworkEtaRow />
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: { lg: "flex-end" } }}>
          <Box component="a" href="/how-to" data-testid="wallet-guide-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            {t("v5.how.walletCta")} <ArrowForwardIcon sx={{ fontSize: 15 }} />
          </Box>
          <PrimaryBtn data-testid="how-it-works-cta" onClick={() => goStart(router, "how_it_works")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>{t("v6.hero.primary")}</PrimaryBtn>
        </Box>
      </Box>
    </Section>
  );
};

export default memo(ConversionStory);
