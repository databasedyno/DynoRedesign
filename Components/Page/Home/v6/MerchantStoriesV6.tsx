import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora, type AuroraTokens } from "../v3/theme.v3";
import { BRAND_ACCENT } from "../v3/theme.v3";
import { Section, SectionHead, cardSx } from "../v5/shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/* Brand lockups — each merchant keeps its own colours (third-party marks are never re-tinted). */
const DevStoreLogo: React.FC<{ s: AuroraTokens }> = ({ s }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.1 }}>
    <Box
      component="img"
      src="/landing/logos/devstore-mark.png"
      alt="The Dev Store"
      width={30}
      height={30}
      sx={{ width: 30, height: 30, display: "block", filter: s.dark ? "invert(1)" : "none" }}
    />
    <Typography component="span" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em", color: s.ink }}>
      The Dev Store
    </Typography>
  </Box>
);

const SafeDealLogo: React.FC<{ s: AuroraTokens }> = ({ s }) => (
  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
    <Box component="img" src="/safedeal/favicon-192.png" alt="SafeDeal" width={30} height={30} sx={{ width: 30, height: 30, display: "block", borderRadius: "8px" }} />
    <Typography component="span" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em", color: s.ink }}>
      Safe<Box component="span" sx={{ color: s.dark ? "#FFC61A" : "#B77E00" }}>Deal</Box>
    </Typography>
  </Box>
);

const NamewordLogo: React.FC<{ s: AuroraTokens }> = ({ s }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }} aria-label="Nameword" role="img">
    <svg width="30" height="30" viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="116" fill="#4F46E5" />
      <g fill="#FFFFFF">
        <rect x="150" y="150" width="58" height="212" rx="10" />
        <rect x="304" y="150" width="58" height="212" rx="10" />
        <path d="M155 150 H208 L357 362 H304 Z" />
      </g>
      <g fill="#4F46E5">
        <circle cx="238" cy="230" r="21" />
        <path d="M242 249 L261 249 L305 307 L281 307 Z" />
      </g>
    </svg>
    <Typography component="span" sx={{ fontFamily: "Outfit, 'Plus Jakarta Sans', var(--font-hero), sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em", color: s.ink }}>
      nameword
    </Typography>
  </Box>
);

const STORIES = [
  { id: "devstore", Logo: DevStoreLogo, href: "/devhub", external: false },
  { id: "safedeal", Logo: SafeDealLogo, href: "https://safedeal.sh", external: true },
  { id: "nameword", Logo: NamewordLogo, href: "https://nameword.com", external: true },
] as const;

/** Merchant stories — three brands live on Dynopay today, in their own words. */
const MerchantStoriesV6: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const accent = s.dark ? "#FFD100" : "#8B5E00";
  return (
    <Section id="stories" testId="merchant-stories">
      <SectionHead eyebrow={t("v6.stories.eyebrow")} headline={t("v6.stories.headline")} body={t("v6.stories.body")} />
      <Stagger step={0.08} data-testid="merchant-stories-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 1.75, md: 2 } }}>
        {STORIES.map((st, i) => (
          <StaggerItem key={st.id} i={i} y={18}>
            <Box
              component="figure"
              data-testid={`story-${st.id}`}
              sx={{ ...cardSx(s, { radius: 20 }), m: 0, p: { xs: 2.75, md: 3.25 }, height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
            >
              <FormatQuoteRoundedIcon aria-hidden sx={{ position: "absolute", top: 14, right: 18, fontSize: 56, color: s.dark ? "rgba(255,209,0,0.14)" : "rgba(139,94,0,0.10)", transform: "scaleX(-1)" }} />
              <Box sx={{ mb: 2.5 }}><st.Logo s={s} /></Box>
              <Typography component="blockquote" sx={{ m: 0, fontFamily: FONT_BODY, fontSize: { xs: 15.5, md: 16 }, lineHeight: 1.6, color: s.ink, letterSpacing: "-0.005em", flex: 1 }}>
                “{t(`v6.stories.${st.id}.quote`)}”
              </Typography>
              <Box component="figcaption" sx={{ mt: 3, pt: 2.25, borderTop: `1px solid ${s.line}`, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 14, color: s.ink, letterSpacing: "-0.01em" }}>{t(`v6.stories.${st.id}.who`)}</Typography>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: s.ink3, mt: 0.4 }}>{t(`v6.stories.${st.id}.what`)}</Typography>
                </Box>
                <Box
                  component="a"
                  href={st.href}
                  target={st.external ? "_blank" : undefined}
                  rel={st.external ? "noopener noreferrer" : undefined}
                  data-testid={`story-link-${st.id}`}
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: accent, textDecoration: "none", whiteSpace: "nowrap", "&:hover": { textDecoration: "underline" }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3, borderRadius: 4 } }}
                >
                  {t("v6.stories.visit")} <ArrowOutwardRoundedIcon sx={{ fontSize: 15 }} />
                </Box>
              </Box>
              <Box sx={{ mt: 1.5, display: "inline-flex", alignItems: "center", gap: 0.5, color: s.ink3 }}>
                <VerifiedRoundedIcon sx={{ fontSize: 14, color: "#10B981" }} />
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{t("v6.stories.live")}</Typography>
              </Box>
            </Box>
          </StaggerItem>
        ))}
      </Stagger>
    </Section>
  );
};

export default memo(MerchantStoriesV6);
