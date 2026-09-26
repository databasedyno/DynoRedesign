import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CurrencyExchangeRoundedIcon from "@mui/icons-material/CurrencyExchangeRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import { FONT_BODY, FONT_HERO, useAurora } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Section 5 of 9 — WHY DYNOPAY (answers: "Why use it?") — four points. */
const POINTS = [
  { Icon: CurrencyExchangeRoundedIcon, key: "convert" },
  { Icon: LockRoundedIcon, key: "custody" },
  { Icon: PaymentsRoundedIcon, key: "fees" },
  { Icon: PublicRoundedIcon, key: "global" },
];

const WhyDynopayV7: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Section id="why" testId="why-dynopay">
      <SectionHead
        center
        eyebrow={t("v7.why.eyebrow")}
        headline={t("v7.why.headline")}
        maxWidth={720}
        testId="why-head"
      />
      <Stagger step={0.09} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" }, gap: { xs: 2.5, md: 3 } }}>
        {POINTS.map(({ Icon, key }, i) => {
          const title = t(`v7.why.${key}.title`);
          const body = t(`v7.why.${key}.body`);
          return (
          <StaggerItem key={key} i={i} y={16}>
            <Box sx={{ ...cardSx(s), display: "flex", gap: 2.5, p: { xs: 3, md: 3.5 }, height: "100%" }}>
              <Box sx={{ width: 46, height: 46, minWidth: 46, borderRadius: "12px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent }}>
                <Icon sx={{ fontSize: 23 }} />
              </Box>
              <Box>
                <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 18, md: 19.5 }, letterSpacing: "-0.01em", color: s.ink, mb: 1 }}>
                  {title}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.6, color: s.ink2 }}>{body}</Typography>
              </Box>
            </Box>
          </StaggerItem>
          );
        })}
      </Stagger>
    </Section>
  );
};

export default memo(WhyDynopayV7);
