import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { Reveal } from "./Reveal";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";


const AudienceDoorsV3: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");

  const DOORS = [
    { key: "merchant", featured: true, dark: true, icon: StorefrontRoundedIcon, tag: t("v3.audience.merchants.tag"), title: t("v3.audience.merchants.title"), desc: t("v3.audience.merchants.desc"), href: "/for/merchants", bg: "linear-gradient(160deg, #4F46E5 0%, #4338CA 100%)", accent: "#FFFFFF", accentDeep: "#C7D2FE", ink: "#FFFFFF", stat: "1.5→  0.5%", statLabel: t("v3.audience.merchants.statLabel") },
    { key: "fundraiser", featured: false, dark: false, icon: VolunteerActivismRoundedIcon, tag: t("v3.audience.fundraisers.tag"), title: t("v3.audience.fundraisers.title"), desc: t("v3.audience.fundraisers.desc"), href: "/for/fundraisers", bg: "#FFFFFF", accent: BRAND_ACCENT, accentDeep: "#4338CA", ink: "#0A0A0A", stat: t("v3.audience.fundraisers.stat"), statLabel: t("v3.audience.fundraisers.statLabel") },
    { key: "creator", featured: false, dark: false, icon: FavoriteBorderRoundedIcon, tag: t("v3.audience.creators.tag"), title: t("v3.audience.creators.title"), desc: t("v3.audience.creators.desc"), href: "/for/creators", bg: "#FFFFFF", accent: BRAND_ACCENT, accentDeep: "#4338CA", ink: "#0A0A0A", stat: "~4s", statLabel: t("v3.audience.creators.statLabel") },
    { key: "developer", featured: false, dark: true, icon: TerminalRoundedIcon, tag: t("v3.audience.developers.tag"), title: t("v3.audience.developers.title"), desc: t("v3.audience.developers.desc"), href: "/documentation", bg: "#0A0A0A", accent: BRAND_ACCENT, accentDeep: "#6366F1", ink: "#F5F5F5", stat: "~10 min", statLabel: t("v3.audience.developers.statLabel") },
  ];

  return (
    <Box component="section" sx={{ background: s.bg, py: { xs: 14, md: 24 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: { xs: 7, md: 11 } }}>
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>{t("v3.audience.eyebrow")}</Eyebrow>
            <HeadlineL component="h2" sx={{ color: s.ink }}>
              {t("v3.audience.headline1")}
              <br />
              {t("v3.audience.headline2")}
            </HeadlineL>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, maxWidth: 380, fontSize: 16, lineHeight: 1.55 }}>
            {t("v3.audience.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          {DOORS.map((d, idx) => {
            const Icon = d.icon;
            return (
              <Reveal
                key={d.key}
                delay={idx * 0.06}
              >
                <Box
                  onClick={() => router.push(d.href)}
                  role="button"
                  tabIndex={0}
                  data-testid={`audience-door-${d.key}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(d.href);
                  }}
                  sx={{
                    position: "relative",
                    cursor: "pointer",
                    height: "100%",
                    minHeight: 320,
                    borderRadius: "22px",
                    background: d.bg,
                    p: { xs: 3, md: 3.5 },
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    overflow: "hidden",
                    border: `1px solid ${d.dark ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.06)"}`,
                    boxShadow: d.featured ? `0 26px 60px -30px ${d.accent === "#FFFFFF" ? "rgba(79,70,229,0.85)" : d.accent}` : "none",
                    transition: "transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: `0 30px 60px -30px ${d.featured ? "rgba(79,70,229,0.9)" : `${d.accent}66`}`,
                    },
                    "&:hover .go-arrow": {
                      transform: "translate(4px,-4px)",
                    },
                  }}
                >
                  {/* accent orb */}
                  <Box
                    aria-hidden
                    sx={{
                      position: "absolute",
                      bottom: -80,
                      right: -60,
                      width: 240,
                      height: 240,
                      borderRadius: "50%",
                      background: d.accent,
                      opacity: d.featured ? 0.14 : 0.07,
                      filter: "blur(30px)",
                    }}
                  />
                  {/* Featured ribbon — pulls the "I want to get paid" visitor in first */}
                  {d.featured && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        px: 1.25,
                        py: 0.4,
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.16)",
                        border: "1px solid rgba(255,255,255,0.35)",
                        zIndex: 2,
                      }}
                    >
                      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                        {t("v3.audience.merchants.startHere")}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3.5 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: "12px",
                          background: d.dark ? "rgba(255,255,255,0.12)" : "#fff",
                          border: `1px solid ${d.dark ? "rgba(255,255,255,0.28)" : "rgba(10,10,10,0.08)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: d.dark ? "#FFFFFF" : d.accent,
                        }}
                      >
                        <Icon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box
                        className="go-arrow"
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: d.dark ? "#FFFFFF" : "#0A0A0A",
                          color: d.dark ? "#0A0A0A" : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "transform .35s cubic-bezier(.16,1,.3,1)",
                        }}
                      >
                        <ArrowOutwardIcon sx={{ fontSize: 18 }} />
                      </Box>
                    </Box>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.22em", textTransform: "uppercase", color: d.accentDeep, fontWeight: 500, mb: 2 }}>
                      {d.tag}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 22, md: 24 }, lineHeight: 1.1, letterSpacing: "-0.02em", color: d.ink, mb: 1.5 }}>
                      {d.title}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: d.dark ? "rgba(255,255,255,0.75)" : "#3F3F46" }}>
                      {d.desc}
                    </Typography>
                  </Box>

                  <Box sx={{ position: "relative", zIndex: 1, mt: 3, pt: 2, borderTop: `1px dashed ${d.dark ? "rgba(255,255,255,0.18)" : "rgba(10,10,10,0.10)"}` }}>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: d.accent, lineHeight: 1 }}>
                      {d.stat}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: d.dark ? "rgba(255,255,255,0.6)" : "#71717A", mt: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {d.statLabel}
                    </Typography>
                  </Box>
                </Box>
              </Reveal>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(AudienceDoorsV3);
