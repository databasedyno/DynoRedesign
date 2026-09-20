import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";
import { Section, SectionHead } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { FeeCalculator, TierLadder } from "../v5/pricingParts";

/** §2.3-9 Pricing teaser — the tier ladder + savings calculator, condensed. The comparison table lives on /fees. */
const PricingTeaser: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#A5B4FC" : BRAND_ACCENT;
  return (
    <Section id="pricing" alt testId="pricing">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.1fr) minmax(0,0.9fr)" }, gap: { xs: 5, lg: 7 }, alignItems: "start" }}>
        <Box sx={{ minWidth: 0 }}>
          <SectionHead eyebrow={t("v5.pricing.eyebrow")} headline={t("v5.pricing.headline")} body={t("v5.pricing.body")} maxWidth={560} />
          <TierLadder />
          <Stagger step={0.06} base={0.1} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.5 }}>
            {[t("v5.pricing.firstFree"), t("v3.whopays.value2"), t("v3.whopays.value3"), t("v5.pricing.noChargebacks")].map((v, i) => (
              <StaggerItem key={v} i={i} y={10}>
                <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.5, py: 0.7, borderRadius: "999px", border: `1px solid ${s.line}`, background: s.surface, fontFamily: FONT_TECH, fontSize: 12, fontWeight: 600, color: s.ink }}>
                  <CheckRoundedIcon sx={{ fontSize: 14, color: accent }} /> {v}
                </Typography>
              </StaggerItem>
            ))}
          </Stagger>
          <Typography sx={{ mt: 3.5, fontFamily: FONT_BODY, fontSize: 14, color: s.ink2, lineHeight: 1.55 }}>{t("v6.pricing.teaserNote")}</Typography>
          <Box component="a" href="/fees" data-testid="pricing-fees-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 1.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            {t("v6.pricing.cta")} <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
        <Stagger step={0.12} sx={{ display: "grid", minWidth: 0 }}>
          <StaggerItem i={0} y={20}><FeeCalculator /></StaggerItem>
        </Stagger>
      </Box>
    </Section>
  );
};

export default memo(PricingTeaser);
