import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Section 3 of 9 — HOW IT WORKS (answers: "How does it work?") — three steps. */
const STEPS = [
  { n: "01", title: "Create a payment", body: "Spin up a payment link, hosted checkout, or API charge in seconds." },
  { n: "02", title: "Customer pays in any coin", body: "They pay with Bitcoin, Ethereum, USDT and 40+ assets from any wallet." },
  { n: "03", title: "You get settled your way", body: "We auto-convert and settle to the currency or wallet you choose." },
];

const HowItWorksV7: React.FC = () => {
  const s = useAurora();
  return (
    <Section id="how-it-works" testId="how-it-works">
      <SectionHead
        center
        eyebrow="How it works"
        headline="Get paid in three steps"
        body="From zero to your first crypto payment — without touching a blockchain."
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
                {step.title}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.6, color: s.ink2 }}>{step.body}</Typography>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(HowItWorksV7);
