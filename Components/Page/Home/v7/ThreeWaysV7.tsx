import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { ApiVignette, CheckoutVignette, LinkVignette } from "./mock/WayVignettes";

/** Section 4 of 9 — THREE WAYS TO USE (answers: "How can I use it?"). Each card opens with a small product vignette. */
const WAYS = [
  { Vignette: LinkVignette, key: "nocode", href: "/products" },
  { Vignette: CheckoutVignette, key: "checkout", href: "/pay/demo" },
  { Vignette: ApiVignette, key: "api", href: "/documentation" },
];

const ThreeWaysV7: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Section id="products" alt testId="three-ways">
      <SectionHead
        center
        eyebrow={t("v7.ways.eyebrow")}
        headline={t("v7.ways.headline")}
        body={t("v7.ways.body")}
        maxWidth={720}
        testId="ways-head"
      />
      <Stagger step={0.1} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
        {WAYS.map(({ Vignette, key, href }, i) => {
          const title = t(`v7.ways.${key}.title`);
          const body = t(`v7.ways.${key}.body`);
          const cta = t(`v7.ways.${key}.cta`);
          return (
          <StaggerItem key={key} i={i} y={18}>
            <Box
              component="a"
              href={href}
              data-testid={`way-${key}`}
              sx={{
                ...cardSx(s),
                display: "flex",
                flexDirection: "column",
                p: { xs: 3, md: 4 },
                height: "100%",
                textDecoration: "none",
                "&:hover .way-vignette": {
                  borderColor: "rgba(255,209,0,0.45)",
                  boxShadow: "0 0 0 1px rgba(255,209,0,0.12), 0 22px 44px -22px rgba(255,209,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                  transform: "translateY(-3px)",
                },
                "&:hover .mock-cta": { boxShadow: "0 0 0 3px rgba(255,209,0,0.18), 0 8px 20px -6px rgba(255,209,0,0.6)", filter: "brightness(1.06)" },
                "@media (prefers-reduced-motion: reduce)": { "&:hover .way-vignette": { transform: "none" } },
              }}
            >
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
          );
        })}
      </Stagger>
    </Section>
  );
};

export default memo(ThreeWaysV7);
