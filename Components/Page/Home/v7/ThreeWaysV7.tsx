import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { ApiVignette, CheckoutVignette, LinkVignette } from "./mock/WayVignettes";

/** Section 4 of 9 — THREE WAYS TO USE (answers: "How can I use it?"). Each card opens with a small product vignette. */
const WAYS = [
  { Vignette: LinkVignette, title: "No code", body: "Create a payment link or creator page and share it anywhere. Nothing to build.", cta: "Explore no-code", href: "/products" },
  { Vignette: CheckoutVignette, title: "Hosted checkout", body: "A drop-in checkout that handles coins, live rates and confirmations for you.", cta: "See the demo", href: "/pay/demo" },
  { Vignette: ApiVignette, title: "Developer API", body: "One REST API to create payments and receive webhooks. Ship in an afternoon.", cta: "Read the docs", href: "/documentation" },
];

const ThreeWaysV7: React.FC = () => {
  const s = useAurora();
  return (
    <Section id="products" alt testId="three-ways">
      <SectionHead
        center
        eyebrow="Three ways to use"
        headline="Whether you code or not"
        body="Start with a link today, add a hosted checkout tomorrow, or build directly on the API."
        maxWidth={720}
        testId="ways-head"
      />
      <Stagger step={0.1} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
        {WAYS.map(({ Vignette, title, body, cta, href }, i) => (
          <StaggerItem key={title} i={i} y={18}>
            <Box component="a" href={href} data-testid={`way-${title.toLowerCase().replace(/\s+/g, "-")}`} sx={{ ...cardSx(s), display: "flex", flexDirection: "column", p: { xs: 3, md: 4 }, height: "100%", textDecoration: "none" }}>
              <Vignette />
              <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 19, md: 21 }, letterSpacing: "-0.01em", color: s.ink, mb: 1.25 }}>
                {title}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.6, color: s.ink2, flexGrow: 1 }}>{body}</Typography>
              <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: s.accent }}>
                {cta} <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </Typography>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(ThreeWaysV7);
