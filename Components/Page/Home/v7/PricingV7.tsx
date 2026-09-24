import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, PrimaryBtn, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Section 7 of 9 — PRICING (answers: "What does it cost?"). Full table lives on /fees. */
const PERKS = ["Your first payment is free", "No monthly or setup fees", "No chargebacks, ever", "Volume discounts as you grow"];

const PricingV7: React.FC = () => {
  const s = useAurora();
  return (
    <Section id="pricing" testId="pricing">
      <SectionHead
        center
        eyebrow="Pricing"
        headline="Simple pricing that scales with you"
        body="One transparent per-payment fee. No setup costs, no monthly minimums."
        maxWidth={720}
        testId="pricing-head"
      />
      <Stagger step={0.1} sx={{ maxWidth: 620, mx: "auto" }}>
        <StaggerItem i={0} y={18}>
          <Box sx={{ ...cardSx(s, { hover: false }), p: { xs: 3.5, md: 5 }, textAlign: "center" }}>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, letterSpacing: "0.14em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
              Starts at
            </Typography>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 56, md: 72 }, lineHeight: 1, letterSpacing: "-0.03em", color: s.ink }}>
              1.5<Box component="span" sx={{ fontSize: { xs: 26, md: 32 }, color: s.accent }}>%</Box>
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, color: s.ink2, mt: 1.5 }}>per settled payment · drops with volume</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, textAlign: "left", mt: 4, mb: 4 }}>
              {PERKS.map((p) => (
                <Box key={p} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CheckRoundedIcon sx={{ fontSize: 18, color: s.accent }} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink }}>{p}</Typography>
                </Box>
              ))}
            </Box>
            <PrimaryBtn href="/fees" data-testid="pricing-fees-cta" endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
              See full pricing
            </PrimaryBtn>
          </Box>
        </StaggerItem>
      </Stagger>
    </Section>
  );
};

export default memo(PricingV7);
