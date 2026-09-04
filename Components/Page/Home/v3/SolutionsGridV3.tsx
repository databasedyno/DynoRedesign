import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import CloudRoundedIcon from "@mui/icons-material/CloudRounded";
import CloudDownloadRoundedIcon from "@mui/icons-material/CloudDownloadRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import SportsEsportsRoundedIcon from "@mui/icons-material/SportsEsportsRounded";
import { FONT_BODY, FONT_HERO, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * SolutionsGridV3 — "a solution for every model" (2026-06).
 *
 * Extends the four audience doors into a richer solutions surface. Each card
 * links to an existing /for/<vertical> SEO page. Thematically a continuation
 * of AudienceDoorsV3, so it shares the same background with a hairline divider.
 * Frontend-only, additive, aurora v3 tokens.
 */

interface Solution {
  key: string;
  icon: React.ElementType;
  href: string;
}

const SOLUTIONS: Solution[] = [
  { key: "ecommerce", icon: ShoppingCartRoundedIcon, href: "/for/ecommerce" },
  { key: "saas", icon: CloudRoundedIcon, href: "/for/saas" },
  { key: "downloads", icon: CloudDownloadRoundedIcon, href: "/for/digital-downloads" },
  { key: "freelancers", icon: WorkOutlineRoundedIcon, href: "/for/freelancers" },
  { key: "remittance", icon: PublicRoundedIcon, href: "/for/remittance" },
  { key: "gaming", icon: SportsEsportsRoundedIcon, href: "/for/gaming" },
];

const SolutionsGridV3: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");

  return (
    <Box
      component="section"
      data-testid="solutions-grid"
      sx={{ background: s.bg, borderTop: `1px solid ${s.line}`, py: { xs: 8, md: 12 } }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: { xs: 6, md: 9 } }}>
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>{t("v3.solutions.eyebrow")}</Eyebrow>
            <HeadlineL component="h2" sx={{ color: s.ink }}>
              {t("v3.solutions.headline1")}
              <br />
              {t("v3.solutions.headline2")}
            </HeadlineL>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, maxWidth: 380, fontSize: 16, lineHeight: 1.55 }}>
            {t("v3.solutions.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {SOLUTIONS.map((sol, idx) => {
            const Icon = sol.icon;
            return (
              <Reveal
                key={sol.key}
                delay={(idx % 3) * 0.06}
                style={{ height: "100%" }}
              >
                <Box
                  onClick={() => router.push(sol.href)}
                  role="button"
                  tabIndex={0}
                  data-testid={`solution-card-${sol.key}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(sol.href);
                  }}
                  sx={{
                    position: "relative",
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "18px",
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    p: { xs: 2.5, md: 3 },
                    transition: "transform .3s cubic-bezier(.16,1,.3,1), border-color .3s ease, box-shadow .3s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      borderColor: s.lineStrong,
                      boxShadow: "0 24px 48px -30px rgba(79,70,229,0.4)",
                    },
                    "&:hover .sol-arrow": { transform: "translateX(3px)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "11px",
                        background: s.dark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)",
                        border: `1px solid ${s.dark ? "rgba(129,140,248,0.3)" : "rgba(79,70,229,0.2)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: s.dark ? "#818CF8" : BRAND_ACCENT,
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ fontSize: 20 }} />
                    </Box>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, letterSpacing: "-0.015em", color: s.ink }}>
                      {t(`v3.solutions.${sol.key}.title`)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2, mb: 2, flex: 1 }}>
                    {t(`v3.solutions.${sol.key}.desc`)}
                  </Typography>
                  <ArrowForwardRoundedIcon
                    className="sol-arrow"
                    sx={{ fontSize: 18, color: s.dark ? "#818CF8" : BRAND_ACCENT, transition: "transform .3s cubic-bezier(.16,1,.3,1)" }}
                  />
                </Box>
              </Reveal>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(SolutionsGridV3);
