import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import ArrowOutwardIcon from "@mui/icons-material/ArrowOutward";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { motion } from "framer-motion";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

const DOORS = [
  {
    key: "merchant",
    icon: StorefrontRoundedIcon,
    tag: "01 · Merchants",
    title: "Sell products in crypto.",
    desc: "Hosted checkout, product catalog, invoices. Auto-convert or keep the original coin.",
    href: "/for/merchants",
    bg: "#FFF3F0",
    accent: "#FF5B49",
    accentDeep: "#E33F2E",
    ink: "#0A0A0A",
    stat: "1.5→  0.5%",
    statLabel: "fees as you grow",
  },
  {
    key: "fundraiser",
    icon: VolunteerActivismRoundedIcon,
    tag: "02 · Fundraisers",
    title: "Run campaigns that fund.",
    desc: "Goal bar, tiers, donor wall, updates. Every donation lands on-chain in your wallet.",
    href: "/for/fundraisers",
    bg: "#F1EDFF",
    accent: "#7C5CFF",
    accentDeep: "#5A3EFF",
    ink: "#0A0A0A",
    stat: "On-chain",
    statLabel: "transparent by default",
  },
  {
    key: "creator",
    icon: FavoriteBorderRoundedIcon,
    tag: "03 · Creators",
    title: "Get tipped by your fans.",
    desc: "Your own dynopay.me/@handle page, inline tip amounts, no chargebacks, instant payouts.",
    href: "/for/creators",
    bg: "#F5FFD1",
    accent: "#5A6B00",
    accentDeep: "#3F4A00",
    ink: "#0A0A0A",
    stat: "~4s",
    statLabel: "payout to wallet",
  },
  {
    key: "developer",
    icon: TerminalRoundedIcon,
    tag: "04 · Developers",
    title: "Ship crypto in an evening.",
    desc: "REST API + webhooks, sandbox keys, first 201 in under 10 minutes.",
    href: "/documentation",
    bg: "#0A0A0A",
    accent: "#CCFF00",
    accentDeep: "#B8E600",
    ink: "#F5F5F5",
    stat: "~10 min",
    statLabel: "to your first 201",
  },
];

const AudienceDoorsV3: React.FC = () => {
  const s = useAurora();
  const router = useRouter();

  return (
    <Box component="section" sx={{ background: s.bg, py: { xs: 8, md: 12 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: { xs: 5, md: 7 } }}>
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>[ Who is this for? ]</Eyebrow>
            <HeadlineL sx={{ color: s.ink }}>
              One wallet.
              <br />
              Every audience.
            </HeadlineL>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, maxWidth: 380, fontSize: 16, lineHeight: 1.55 }}>
            Pick your door — merchants, campaigns, creators, developers. All
            share the same crypto rails, the same wallet, the same fees.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {DOORS.map((d, idx) => {
            const Icon = d.icon;
            return (
              <motion.div
                key={d.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.06 }}
              >
                <Box
                  onClick={() => router.push(d.href)}
                  role="button"
                  tabIndex={0}
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
                    border: `1px solid ${d.bg === "#0A0A0A" ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.06)"}`,
                    transition: "transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: `0 30px 60px -30px ${d.accent}66`,
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
                      opacity: 0.14,
                      filter: "blur(30px)",
                    }}
                  />
                  <Box sx={{ position: "relative", zIndex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3.5 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: "12px",
                          background: d.bg === "#0A0A0A" ? "rgba(204,255,0,0.12)" : "#fff",
                          border: `1px solid ${d.bg === "#0A0A0A" ? "rgba(204,255,0,0.35)" : "rgba(10,10,10,0.08)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: d.accent,
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
                          background: d.bg === "#0A0A0A" ? "#CCFF00" : "#0A0A0A",
                          color: d.bg === "#0A0A0A" ? "#0A0A0A" : "#fff",
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
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: d.bg === "#0A0A0A" ? "rgba(255,255,255,0.7)" : "#3F3F46" }}>
                      {d.desc}
                    </Typography>
                  </Box>

                  <Box sx={{ position: "relative", zIndex: 1, mt: 3, pt: 2, borderTop: `1px dashed ${d.bg === "#0A0A0A" ? "rgba(255,255,255,0.14)" : "rgba(10,10,10,0.10)"}` }}>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: d.accent, lineHeight: 1 }}>
                      {d.stat}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: d.bg === "#0A0A0A" ? "rgba(255,255,255,0.5)" : "#71717A", mt: 0.5, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {d.statLabel}
                    </Typography>
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

export default memo(AudienceDoorsV3);
