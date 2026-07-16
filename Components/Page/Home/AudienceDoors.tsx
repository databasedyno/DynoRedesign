import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import NextLink from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";

/**
 * AudienceDoors — 4 "who is this for" doors that live right under the hero.
 * One product, four audiences: Merchants · Fundraisers · Creators · Developers.
 *
 * Session 56: each door is now a real anchor tag that deep-links to the
 * dedicated SEO landing page at `/for/{audience}` (crawlable + shareable +
 * paid-campaign target). A small secondary "See it on this page" link on
 * each card still scrolls the user to the corresponding showcase section
 * further down the landing page (in-page discovery is preserved).
 *
 * All copy comes from `landing.json > doors`.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

interface Door {
  key: "merchant" | "campaign" | "creator" | "developer";
  /** Crawlable SEO landing page for this audience. */
  page: string;
  /** In-page section anchor for the "preview" secondary link. */
  anchor: string;
  /**
   * Brand-accent color kept for the hover BORDER (still vibrant on both themes).
   * WCAG note: this color is NOT used for the icon on light theme any more —
   * `iconLight`/`iconDark` are used for the icon glyph itself so light-theme
   * contrast passes AA-UI (≥3:1) for every door.
   */
  accent: string;
  iconLight: string;
  iconDark: string;
  /**
   * Session 49 fix: iPhone/light-mode readability. `accent` is a vibrant brand
   * color used for icons/borders/hover — but 3 of 4 accents fail WCAG AA
   * contrast on white text backgrounds (lime `#CCFF00` = 1.36:1, pink
   * `#F472B6` = 3.13:1, light blue `#7CB1FF` = 2.72:1 — all below the 4.5:1
   * threshold for normal text). This split lets us keep the vibrant accent
   * for decoration while forcing the CTA link text to a color that's readable
   * in BOTH light and dark modes.
   */
  ctaLight: string;
  ctaDark: string;
  iconGlyph: string;
}

const DOORS: Door[] = [
  // Session 56 WCAG icon-contrast fix: `iconLight` (light theme) uses deeper
  // hues that clear the 3:1 AA-UI threshold on white cards. `iconDark` keeps
  // the vibrant brand accents against the dark #111 canvas.
  { key: "merchant",  page: "/for/merchants",   anchor: "#product-showcase-section", accent: "#3B82F6", iconLight: "#3B82F6", iconDark: "#3B82F6", ctaLight: "#2563EB", ctaDark: "#93C5FD", iconGlyph: "◈" },
  { key: "campaign",  page: "/for/fundraisers", anchor: "#crowdfunding-showcase",    accent: "#CCFF00", iconLight: "#6B7D00", iconDark: "#CCFF00", ctaLight: "#5A6B00", ctaDark: "#CCFF00", iconGlyph: "◉" },
  { key: "creator",   page: "/for/creators",    anchor: "#creator-showcase",         accent: "#F472B6", iconLight: "#C24070", iconDark: "#F472B6", ctaLight: "#B03A76", ctaDark: "#F9A8D4", iconGlyph: "◎" },
  { key: "developer", page: "/for/developers",  anchor: "#developer-showcase",       accent: "#7CB1FF", iconLight: "#0284C7", iconDark: "#7CB1FF", ctaLight: "#2563EB", ctaDark: "#93C5FD", iconGlyph: "◭" },
];

const AudienceDoors: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;

  const scrollToAnchor = (anchor: string) => {
    // anchor is expected to start with "#"
    const id = anchor.startsWith("#") ? anchor.slice(1) : anchor;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
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
                component={NextLink as any}
                href={door.page}
                data-testid={`audience-door-${door.key}`}
                aria-label={`${t(`doors.${door.key}.kicker`)} — ${t(`doors.${door.key}.title`)}`}
                sx={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  textDecoration: "none",
                  color: "inherit",
                  background: "none",
                  border: `1px solid ${s.line}`,
                  borderRadius: "14px",
                  p: { xs: 3, md: 3.5 },
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
                  "&:hover, &:focus-visible": {
                    transform: "translate(-3px, -3px)",
                    borderColor: door.accent,
                    boxShadow: s.dark
                      ? `4px 4px 0 rgba(255,255,255,0.06)`
                      : `4px 4px 0 rgba(10,10,10,0.85)`,
                    outline: "none",
                  },
                  "&:focus-visible": {
                    boxShadow: s.dark
                      ? `0 0 0 3px rgba(204,255,0,0.35)`
                      : `0 0 0 3px rgba(37,99,235,0.35)`,
                  },
                  "&:hover .door-arrow": { transform: "translateX(4px)" },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    fontFamily: FONT_TECH,
                    fontSize: 28,
                    // Session 56 WCAG fix: swap in a light-theme-safe icon color
                    // so lime/pink/light-blue accents clear ≥3:1 UI contrast on
                    // white cards. Vibrant brand accent kept for dark theme.
                    color: s.dark ? door.iconDark : door.iconLight,
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
                    mb: 2,
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
                    // Session 49 fix: theme-aware CTA color for WCAG AA contrast
                    // (see interface Door doc above for original contrast failures).
                    color: s.dark ? door.ctaDark : door.ctaLight,
                  }}
                >
                  {t(`doors.${door.key}.cta`)}
                  <ArrowForward
                    className="door-arrow"
                    sx={{ fontSize: 16, transition: "transform 0.25s ease" }}
                  />
                </Box>
                {/* Secondary preview link — scrolls to the on-page showcase
                    section without leaving the landing page. stopPropagation +
                    preventDefault keep the parent card link from firing. */}
                <Box
                  component="span"
                  role="button"
                  tabIndex={0}
                  data-testid={`audience-door-preview-${door.key}`}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollToAnchor(door.anchor);
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      scrollToAnchor(door.anchor);
                    }
                  }}
                  sx={{
                    display: "inline-block",
                    mt: 1,
                    ml: 2,
                    fontFamily: FONT_BODY,
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: s.faint,
                    textDecoration: "underline",
                    textDecorationColor: s.line,
                    textUnderlineOffset: "3px",
                    cursor: "pointer",
                    transition: "color 0.2s ease, text-decoration-color 0.2s ease",
                    "&:hover, &:focus-visible": {
                      color: s.txt,
                      textDecorationColor: s.dark ? door.ctaDark : door.ctaLight,
                      outline: "none",
                    },
                  }}
                >
                  {t("doors.previewHere", "Preview on this page ↓")}
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
