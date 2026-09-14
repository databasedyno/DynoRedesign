import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { FeeCalculator, TierLadder, WhoPaysToggle } from "./pricingParts";

const ROWS = ["custody", "volatility", "chargebacks", "payout", "fees", "monthly"] as const;

const CompareTable: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const cols = { xs: "1fr", md: "1.1fr 1.3fr 1fr 1fr" } as const;
  const cell = (text: string, kind: "dyno" | "other", colLabel: string) => (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", px: { xs: 1.5, md: 1.75 }, py: { xs: 1.1, md: 1.2 }, borderRadius: "12px", background: kind === "dyno" ? (s.dark ? "rgba(129,140,248,0.10)" : "rgba(79,70,229,0.055)") : "transparent" }}>
      {kind === "dyno" ? <CheckRoundedIcon sx={{ fontSize: 17, color: accent, mt: "2px", flexShrink: 0 }} /> : <RemoveRoundedIcon sx={{ fontSize: 17, color: s.ink3, mt: "2px", flexShrink: 0 }} />}
      <Box>
        <Typography component="span" sx={{ display: { xs: "block", md: "none" }, fontFamily: FONT_TECH, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: kind === "dyno" ? accent : s.ink3, mb: 0.25 }}>{colLabel}</Typography>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: kind === "dyno" ? 600 : 400, lineHeight: 1.45, color: kind === "dyno" ? s.ink : s.ink2 }}>{text}</Typography>
      </Box>
    </Box>
  );
  return (
    <Box data-testid="compare-table" sx={{ mt: { xs: 5, md: 7 } }}>
      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 20, md: 24 }, letterSpacing: "-0.02em", color: s.ink, mb: 2.5 }}>{t("v5.compare.headline")}</Typography>
      <Stagger step={0.06} sx={{ background: s.surface, border: `1px solid ${s.line}`, borderRadius: "20px", overflow: "hidden" }}>
        <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: cols, px: 3, py: 1.75, borderBottom: `1px solid ${s.line}` }}>
          <Box />
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: 14.5, color: s.ink, px: 1.75 }}>{t("v5.compare.colDyno")}</Typography>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 14.5, color: s.ink3, px: 1.75 }}>{t("v5.compare.colCards")}</Typography>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 14.5, color: s.ink3, px: 1.75 }}>{t("v5.compare.colCustodial")}</Typography>
        </Box>
        {ROWS.map((r, i) => (
          <StaggerItem key={r} i={i} y={8}>
          <Box data-testid={`compare-row-${r}`} sx={{ display: "grid", gridTemplateColumns: cols, alignItems: { md: "center" }, columnGap: 1.5, rowGap: 0.75, px: { xs: 2, md: 3 }, py: { xs: 2, md: 1.75 }, borderTop: i === 0 ? "none" : `1px solid ${s.line}` }}>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 14.5, color: s.ink }}>{t(`v5.compare.${r}.f`)}</Typography>
            {cell(t(`v5.compare.${r}.dyno`), "dyno", t("v5.compare.colDyno"))}
            {cell(t(`v5.compare.${r}.cards`), "other", t("v5.compare.colCards"))}
            {cell(t(`v5.compare.${r}.custodial`), "other", t("v5.compare.colCustodial"))}
          </Box>
          </StaggerItem>
        ))}
      </Stagger>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 1.5 }}>{t("v5.compare.note")}</Typography>
    </Box>
  );
};

const PricingV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Section id="pricing" alt testId="pricing">
      <SectionHead eyebrow={t("v5.pricing.eyebrow")} headline={t("v5.pricing.headline")} body={t("v5.pricing.body")} />
      <TierLadder />
      <Stagger step={0.06} base={0.1} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.5 }}>
        {[t("v5.pricing.firstFree"), t("v3.whopays.value2"), t("v3.whopays.value3"), t("v5.pricing.noChargebacks")].map((v, i) => (
          <StaggerItem key={v} i={i} y={10}>
          <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.5, py: 0.7, borderRadius: "999px", border: `1px solid ${s.line}`, background: s.surface, fontFamily: FONT_TECH, fontSize: 12, fontWeight: 600, color: s.ink }}>
            <CheckRoundedIcon sx={{ fontSize: 14, color: s.dark ? "#818CF8" : BRAND_ACCENT }} /> {v}
          </Typography>
          </StaggerItem>
        ))}
      </Stagger>
      <Stagger step={0.12} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2.5, md: 3 }, mt: { xs: 4, md: 5 } }}>
        <StaggerItem i={0}><FeeCalculator /></StaggerItem>
        <StaggerItem i={1}><WhoPaysToggle /></StaggerItem>
      </Stagger>
      <CompareTable />
      <Typography sx={{ mt: 2.5, fontFamily: FONT_BODY, fontSize: 14, color: s.ink2 }}>
        <Box component="a" href="/fees" data-testid="pricing-fees-link" sx={{ color: s.dark ? "#818CF8" : BRAND_ACCENT, fontWeight: 600, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>{t("v5.pricing.fullFees")}</Box>
      </Typography>
    </Section>
  );
};

export default memo(PricingV5);
