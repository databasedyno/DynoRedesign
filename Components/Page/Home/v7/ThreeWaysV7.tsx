import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_DISPLAY, Section, SectionHead, cardSx, useConsole } from "./kit";
import { ApiVignette, CheckoutVignette, LinkVignette } from "./mock/WayVignettes";

/** Section 6 — THREE WAYS TO USE ("How can I use it?"). Each card opens with a small product vignette. */
const WAYS = [
  { Vignette: LinkVignette, key: "nocode", href: "/products" },
  { Vignette: CheckoutVignette, key: "checkout", href: "/pay/demo" },
  { Vignette: ApiVignette, key: "api", href: "/documentation" },
];

const ThreeWaysV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  return (
    <Section id="products" testId="three-ways">
      <SectionHead eyebrow={t("v7.ways.eyebrow")} title={t("v7.ways.headline")} lead={t("v7.ways.body")} testId="ways-head" />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {WAYS.map(({ Vignette, key, href }) => (
          <Box
            key={key}
            component="a"
            href={href}
            data-testid={`way-${key}`}
            sx={{
              ...cardSx(s),
              display: "flex",
              flexDirection: "column",
              p: { xs: 3, md: 3.5 },
              height: "100%",
              textDecoration: "none",
              "&:hover .way-vignette": { borderColor: s.lineStrong },
            }}
          >
            <Vignette />
            <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 18, md: 20 }, letterSpacing: "-0.01em", color: s.ink, mb: 1 }}>
              {t(`v7.ways.${key}.title`)}
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2, flexGrow: 1 }}>
              {t(`v7.ways.${key}.body`)}
            </Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.accent, "& .arr": { transition: "transform 200ms cubic-bezier(0.2,0.8,0.2,1)" }, "a:hover &, &:hover": { "& .arr": { transform: "translateX(3px)" } } }}>
              {t(`v7.ways.${key}.cta`)} <ArrowForwardIcon className="arr" sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Section>
  );
};

export default memo(ThreeWaysV7);
