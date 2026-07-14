import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

/**
 * AudienceDoors — 3 "who is this for" doors that live right under the hero.
 * One product, three audiences: Merchants · Fundraisers · Creators.
 * Each door deep-links to the section further down the page that showcases
 * that surface. All copy comes from `landing.json > doors`.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

interface Door {
  key: "merchant" | "campaign" | "creator";
  href: string;
  accent: string;
  iconGlyph: string;
}

const DOORS: Door[] = [
  { key: "merchant", href: "#product-showcase-section", accent: "#3B82F6", iconGlyph: "◈" },
  { key: "campaign", href: "#crowdfunding-showcase", accent: "#CCFF00", iconGlyph: "◉" },
  { key: "creator", href: "#creator-showcase", accent: "#F472B6", iconGlyph: "◎" },
];

const AudienceDoors: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const scrollOrPush = (href: string) => {
    if (href.startsWith("#")) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(href);
    }
  };

  return (
    <Box
      component="section"
      aria-labelledby="doors-heading"
      data-testid="audience-doors"
      sx={{ px: { xs: 3, md: 6 }, py: { xs: 5, md: 8 } }}
    >
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        <Typography
          component="p"
          sx={{
            fontFamily: FONT_TECH,
            fontSize: 12,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: s.accentText,
            mb: 1.5,
          }}
        >
          [ {t("doors.eyebrow")} ]
        </Typography>
        <Typography
          id="doors-heading"
          component="h2"
          sx={{
            fontFamily: FONT_HERO,
            fontWeight: 700,
            fontSize: { xs: 30, md: 42 },
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            color: s.txt,
            mb: 1.5,
            maxWidth: 900,
          }}
        >
          {t("doors.title")}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_BODY,
            fontSize: { xs: 15, md: 16.5 },
            color: s.sub,
            maxWidth: 720,
            mb: { xs: 4, md: 5 },
            lineHeight: 1.6,
          }}
        >
          {t("doors.subtitle")}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {DOORS.map((door, idx) => (
            <motion.div
              key={door.key}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: idx * 0.08, ease: EASE }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => scrollOrPush(door.href)}
                data-testid={`audience-door-${door.key}`}
                sx={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: `1px solid ${s.line}`,
                  borderRadius: "14px",
                  p: { xs: 3, md: 3.5 },
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.25s ease, border-color 0.25s ease",
                  "&:hover": {
                    transform: "translate(-3px, -3px)",
                    borderColor: door.accent,
                    boxShadow: s.dark
                      ? `4px 4px 0 rgba(255,255,255,0.06)`
                      : `4px 4px 0 rgba(10,10,10,0.85)`,
                  },
                  "&:hover .door-arrow": { transform: "translateX(4px)" },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    fontFamily: FONT_TECH,
                    fontSize: 28,
                    color: door.accent,
                    lineHeight: 1,
                    mb: 2,
                  }}
                >
                  {door.iconGlyph}
                </Box>
                <Typography
                  sx={{
                    fontFamily: FONT_TECH,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: s.faint,
                    mb: 0.5,
                  }}
                >
                  {t(`doors.${door.key}.kicker`)}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: FONT_HERO,
                    fontSize: { xs: 22, md: 26 },
                    fontWeight: 700,
                    letterSpacing: "-0.015em",
                    color: s.txt,
                    mb: 1.25,
                    lineHeight: 1.15,
                  }}
                >
                  {t(`doors.${door.key}.title`)}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: FONT_BODY,
                    fontSize: 14.5,
                    color: s.sub,
                    lineHeight: 1.55,
                    mb: 2.5,
                    minHeight: { md: 66 },
                  }}
                >
                  {t(`doors.${door.key}.desc`)}
                </Typography>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontFamily: FONT_BODY,
                    fontSize: 14,
                    fontWeight: 600,
                    color: door.accent,
                  }}
                >
                  {t(`doors.${door.key}.cta`)}
                  <ArrowForward
                    className="door-arrow"
                    sx={{ fontSize: 16, transition: "transform 0.25s ease" }}
                  />
                </Box>
              </Box>
            </motion.div>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(AudienceDoors);
