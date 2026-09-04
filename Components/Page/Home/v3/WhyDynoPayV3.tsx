import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { FONT_BODY, FONT_HERO, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * WhyDynoPayV3 — value-led "why us" differentiator moment (2026-08).
 *
 * Replaces a customer-testimonials block (no real quotes available) with
 * substantiable, feature-based credibility. We deliberately do NOT lead on
 * price (competitors advertise lower headline rates) — we lead on what protects
 * the merchant's money and time. Every card maps to a shipped capability.
 */
const WhyDynoPayV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;

  const CARDS = [
    { icon: ShieldRoundedIcon, title: t("v3.why.c1t"), desc: t("v3.why.c1d") },
    { icon: SwapHorizRoundedIcon, title: t("v3.why.c2t"), desc: t("v3.why.c2d") },
    { icon: TuneRoundedIcon, title: t("v3.why.c3t"), desc: t("v3.why.c3d") },
    { icon: ReplayRoundedIcon, title: t("v3.why.c4t"), desc: t("v3.why.c4d") },
    { icon: SavingsRoundedIcon, title: t("v3.why.c5t"), desc: t("v3.why.c5d") },
    { icon: CodeRoundedIcon, title: t("v3.why.c6t"), desc: t("v3.why.c6d") },
    { icon: StorefrontRoundedIcon, title: t("v3.why.c7t"), desc: t("v3.why.c7d") },
  ];

  return (
    <Box component="section" data-testid="why-dynopay" sx={{ background: s.bgAlt, py: { xs: 8, md: 12 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 680, mb: { xs: 5, md: 8 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.why.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
            {t("v3.why.headline")}
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.why.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal
                key={i}
                delay={(i % 3) * 0.06}
                style={{ height: "100%" }}
              >
                <Box
                  sx={{
                    height: "100%",
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "20px",
                    p: { xs: 3, md: 3.5 },
                    transition: "border-color .3s ease, transform .3s ease",
                    "&:hover": { borderColor: s.lineStrong, transform: "translateY(-3px)" },
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      display: "grid",
                      placeItems: "center",
                      mb: 2.5,
                      background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)",
                    }}
                  >
                    <Icon sx={{ fontSize: 22, color: accent }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em", color: s.ink, mb: 1 }}>
                    {c.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.55, color: s.ink2 }}>
                    {c.desc}
                  </Typography>
                </Box>
              </Reveal>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(WhyDynoPayV3);
