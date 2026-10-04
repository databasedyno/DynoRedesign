import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PrimaryBtn, Section, SectionHead, cardSx, useConsole } from "./kit";

/** Section 4 — PRICING ("What does it cost?"). The full table lives on /fees. */
const PERKS = ["free", "noMonthly", "noChargebacks", "volume"];

const PricingV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  return (
    <Section id="pricing" testId="pricing">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 4, lg: 7 }, alignItems: "center" }}>
        <Box>
          <SectionHead eyebrow={t("v7.pricing.eyebrow")} title={t("v7.pricing.headline")} lead={t("v7.pricing.body")} testId="pricing-head" sx={{ mb: 0 }} />
        </Box>

        <Box sx={{ ...cardSx(s, { hover: false }), p: { xs: 3.5, md: 4.5 } }}>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3 }}>
            {t("v7.pricing.startsAt")}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 1 }}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 52, md: 64 }, lineHeight: 1, letterSpacing: "-0.03em", color: s.ink, fontVariantNumeric: "tabular-nums" }}>
              1.5
            </Typography>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 26, md: 30 }, color: s.accent, letterSpacing: "-0.02em" }}>%</Typography>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink2, mt: 1 }}>{t("v7.pricing.perPayment")}</Typography>

          <Box sx={{ height: 1, background: s.line, my: 3 }} />

          <Box sx={{ display: "grid", gap: 1.5 }}>
            {PERKS.map((p) => (
              <Box key={p} sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <CheckRoundedIcon sx={{ fontSize: 18, color: s.accent, flexShrink: 0 }} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink }}>{t(`v7.pricing.perks.${p}`)}</Typography>
              </Box>
            ))}
          </Box>

          <PrimaryBtn href="/fees" data-testid="pricing-fees-cta" endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ mt: 4 }}>
            {t("v7.pricing.cta")}
          </PrimaryBtn>
        </Box>
      </Box>
    </Section>
  );
};

export default memo(PricingV7);
