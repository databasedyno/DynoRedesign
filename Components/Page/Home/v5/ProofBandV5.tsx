import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { floor5, useLandingMetrics } from "./useLandingMetrics";

/** "Built in the open" — verifiable proof instead of borrowed logos. Swappable for logos/quotes later. */
const ProofBandV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const countries = m ? `${floor5(m.countries_served)}` : "30";

  const TILES = [
    { id: "status", Icon: MonitorHeartRoundedIcon, title: t("v5.open.statusT"), desc: t("v5.open.statusD"), cta: t("v5.open.statusCta"), href: "/system-status", meta: m ? `${m.uptime_90d_pct.toFixed(2)}% · 90d` : null },
    { id: "docs", Icon: MenuBookRoundedIcon, title: t("v5.open.docsT"), desc: t("v5.open.docsD"), cta: t("v5.open.docsCta"), href: "/documentation", meta: "GET /api/docs" },
    { id: "chain", Icon: LinkRoundedIcon, title: t("v5.open.chainT"), desc: t("v5.open.chainD"), cta: t("v5.open.chainCta"), href: "#onchain", meta: null },
    { id: "global", Icon: PublicRoundedIcon, title: t("v5.open.globalT"), desc: t("v5.open.globalD", { countries }), cta: t("v5.open.globalCta"), href: "#coins", meta: "EN·DE·FR·ES·PT·NL" },
  ];

  return (
    <Section id="proof" alt testId="proof-band">
      <SectionHead eyebrow={t("v5.open.eyebrow")} headline={t("v5.open.headline")} body={t("v5.open.body")} />
      <Stagger sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {TILES.map((tile, i) => (
          <StaggerItem key={tile.id} i={i}>
          <Box
            component="a"
            href={tile.href}
            data-testid={`proof-tile-${tile.id}`}
            sx={{ display: "flex", flexDirection: "column", textDecoration: "none", borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 3, md: 3.25 }, transition: "transform 200ms cubic-bezier(.16,1,.3,1), border-color 200ms ease, box-shadow 200ms ease", "&:hover": { transform: "translateY(-3px)", borderColor: `${BRAND_ACCENT}66`, boxShadow: `0 24px 48px -30px ${BRAND_ACCENT}66` }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: "12px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent }}>
                <tile.Icon sx={{ fontSize: 22 }} />
              </Box>
              {tile.meta ? <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{tile.meta}</Typography> : null}
            </Box>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17.5, letterSpacing: "-0.015em", color: s.ink, mb: 1 }}>{tile.title}</Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: s.ink2, flexGrow: 1 }}>{tile.desc}</Typography>
            <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 2.5, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: accent, "& svg": { transition: "transform 220ms cubic-bezier(0.2,0.8,0.2,1)" }, "a:hover &  svg": { transform: "translate(2px, -2px)" } }}>
              {tile.cta} <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
            </Typography>
          </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(ProofBandV5);
