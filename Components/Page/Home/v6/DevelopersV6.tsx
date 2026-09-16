import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import DashboardCustomizeRoundedIcon from "@mui/icons-material/DashboardCustomizeRounded";
import WidgetsRoundedIcon from "@mui/icons-material/WidgetsRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import WebhookRoundedIcon from "@mui/icons-material/WebhookRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import CodeOffRoundedIcon from "@mui/icons-material/CodeOffRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { PrimaryBtn, SecondaryBtn, Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import CodePanel from "./CodePanel";

const PATHS = [
  { id: "nocode", Icon: DashboardCustomizeRoundedIcon, href: "/auth/register?ref=dev_nocode" },
  { id: "prebuilt", Icon: WidgetsRoundedIcon, href: "/documentation#buy-button" },
  { id: "api", Icon: TerminalRoundedIcon, href: "/documentation" },
] as const;

/** §2.3-8 Developers — Stripe's three-path pattern (No-code · Pre-built · Build your own) + the live request/response block. */
const DevelopersV6: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#A5B4FC" : BRAND_ACCENT;
  const BULLETS = [
    { Icon: WebhookRoundedIcon, text: t("v5.dev.b1") },
    { Icon: ScienceRoundedIcon, text: t("v5.dev.b2") },
    { Icon: CodeOffRoundedIcon, text: t("v5.dev.b3") },
  ];
  return (
    <Section id="developers" testId="developers">
      <SectionHead eyebrow={t("v5.dev.eyebrow")} headline={t("v6.dev.headline")} body={t("v6.dev.body")} />
      <Stagger step={0.09} data-testid="dev-paths" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 1.75, md: 2 }, mb: { xs: 6, md: 8 } }}>
        {PATHS.map((p, i) => (
          <StaggerItem key={p.id} i={i} y={18}>
            <Box component="a" href={p.href} data-testid={`dev-path-${p.id}`} sx={{ ...cardSx(s, { radius: 22 }), display: "flex", flexDirection: "column", height: "100%", textDecoration: "none", p: { xs: 2.75, md: 3.25 }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: "13px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent }}><p.Icon sx={{ fontSize: 22 }} /></Box>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: s.ink3 }}>{t(`v6.dev.${p.id}.eyebrow`)}</Typography>
              </Box>
              <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 20, md: 22 }, letterSpacing: "-0.02em", lineHeight: 1.15, color: s.ink, mb: 1 }}>{t(`v6.dev.${p.id}.t`)}</Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: s.ink2, flexGrow: 1 }}>{t(`v6.dev.${p.id}.d`)}</Typography>
              <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: accent, "& svg": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }, "a:hover & svg": { transform: "translate(2px,-2px)" } }}>
                {t(`v6.dev.${p.id}.cta`)} <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
              </Typography>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "minmax(0,0.8fr) minmax(0,1.2fr)" }, gap: { xs: 4, md: 7 }, alignItems: "start" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 24, md: 28 }, letterSpacing: "-0.025em", lineHeight: 1.1, color: s.ink, mb: 1.5 }}>{t("v5.dev.headline")}</Typography>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15.5, lineHeight: 1.55, color: s.ink2, mb: 3.5 }}>{t("v5.dev.body")}</Typography>
          <Stagger step={0.08} sx={{ display: "grid", gap: 1.5, mb: 3.5 }}>
            {BULLETS.map((b, i) => (
              <StaggerItem key={i} i={i} y={12}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: "9px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent, flexShrink: 0 }}><b.Icon sx={{ fontSize: 17 }} /></Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink }}>{b.text}</Typography>
                </Box>
              </StaggerItem>
            ))}
          </Stagger>
          <Typography data-testid="works-with" sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.55, color: s.ink3, mb: 3.5 }}>{t("v5.dev.worksWith")}</Typography>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <PrimaryBtn small href="/documentation" data-testid="dev-docs-cta">{t("v5.dev.ctaDocs")}</PrimaryBtn>
            <SecondaryBtn small href="/pay/demo" data-testid="dev-demo-cta">{t("v5.hero.secondary")}</SecondaryBtn>
          </Box>
        </Box>
        <CodePanel />
      </Box>
    </Section>
  );
};

export default memo(DevelopersV6);
