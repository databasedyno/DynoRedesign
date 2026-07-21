import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

/**
 * LearnDocsCards — Coinbase-style "Explore more / Learn the basics" education
 * band. Reduces newbie anxiety and spreads internal links (docs, blog, fees).
 *
 * Frontend-only, additive. Each card is image-free (icon-led) so it stays
 * fast and on-brand with the rest of the aurora v3 stack.
 */

interface LearnCard {
  key: string;
  tag: string;
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
}

const CARDS: LearnCard[] = [
  {
    key: "docs",
    tag: "Developers",
    title: "Read the docs",
    desc: "REST API, webhooks and SDKs with copy-paste snippets. Go from zero to your first live charge in minutes.",
    href: "/documentation",
    icon: MenuBookRoundedIcon,
  },
  {
    key: "learn",
    tag: "Guides",
    title: "Learn the basics",
    desc: "Plain-English guides on accepting crypto, auto-converting to stablecoins, and staying non-custodial.",
    href: "/blog",
    icon: SchoolRoundedIcon,
  },
  {
    key: "fees",
    tag: "Pricing",
    title: "See the fees",
    desc: "From 1.5% down to 0.5% as you grow. No monthly fee, no setup fee, no chargebacks — ever.",
    href: "/fees",
    icon: PaymentsRoundedIcon,
  },
];

const LearnDocsCards: React.FC = () => {
  const s = useAurora();
  const router = useRouter();

  return (
    <Box component="section" sx={{ background: s.bg, py: { xs: 8, md: 12 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 620, mb: { xs: 5, md: 7 } }}>
          <Eyebrow sx={{ mb: 2 }}>[ Get up to speed ]</Eyebrow>
          <HeadlineL sx={{ color: s.ink }}>Start with the basics.</HeadlineL>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {CARDS.map((c, idx) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.07 }}
                style={{ height: "100%" }}
              >
                <Box
                  onClick={() => router.push(c.href)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(c.href);
                  }}
                  sx={{
                    position: "relative",
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "20px",
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    p: { xs: 3, md: 3.25 },
                    transition: "transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease, border-color .35s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 26px 54px -34px rgba(10,10,10,0.4)",
                      borderColor: s.lineStrong,
                    },
                    "&:hover .learn-arrow": { transform: "translateX(4px)" },
                  }}
                >
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: "13px",
                      background: s.dark ? "rgba(255,91,73,0.14)" : "rgba(255,91,73,0.09)",
                      border: "1px solid rgba(255,91,73,0.32)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FF5B49",
                      mb: 2.5,
                    }}
                  >
                    <Icon sx={{ fontSize: 24 }} />
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: FONT_TECH,
                      fontSize: 11,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: s.ink3,
                      fontWeight: 500,
                      mb: 1,
                    }}
                  >
                    {c.tag}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: FONT_HERO,
                      fontWeight: 700,
                      fontSize: { xs: 21, md: 23 },
                      lineHeight: 1.12,
                      letterSpacing: "-0.02em",
                      color: s.ink,
                      mb: 1.25,
                    }}
                  >
                    {c.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: FONT_BODY,
                      fontSize: 14.5,
                      lineHeight: 1.55,
                      color: s.ink2,
                      mb: 2.5,
                      flex: 1,
                    }}
                  >
                    {c.desc}
                  </Typography>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: s.ink }}>
                      Explore
                    </Typography>
                    <ArrowForwardRoundedIcon
                      className="learn-arrow"
                      sx={{ fontSize: 17, color: s.ink, transition: "transform .35s cubic-bezier(.16,1,.3,1)" }}
                    />
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(LearnDocsCards);
