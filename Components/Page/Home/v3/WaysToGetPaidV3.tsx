import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import SmartButtonRoundedIcon from "@mui/icons-material/SmartButtonRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import VolunteerActivismRoundedIcon from "@mui/icons-material/VolunteerActivismRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * WaysToGetPaidV3 — "the full product surface" band (2026-06).
 *
 * The landing previously named only 2-3 ways to accept a payment; the product
 * actually ships nine. This scannable 3×3 grid surfaces every integration
 * method (icon + one-liner + link) so a first-time merchant can see the whole
 * toolkit at a glance. Frontend-only, additive, aurora v3 tokens.
 */

interface Method {
  key: string;
  icon: React.ElementType;
  href: string;
}

const WaysToGetPaidV3: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");

  const METHODS: Method[] = [
    { key: "links", icon: LinkRoundedIcon, href: "/for/merchants" },
    { key: "checkout", icon: PointOfSaleRoundedIcon, href: "/for/ecommerce" },
    { key: "api", icon: TerminalRoundedIcon, href: "/documentation" },
    { key: "buttons", icon: SmartButtonRoundedIcon, href: "/documentation" },
    { key: "elements", icon: CodeRoundedIcon, href: "/documentation" },
    { key: "storefront", icon: StorefrontRoundedIcon, href: "/for/digital-downloads" },
    { key: "tips", icon: FavoriteBorderRoundedIcon, href: "/for/creators" },
    { key: "donations", icon: VolunteerActivismRoundedIcon, href: "/for/fundraisers" },
    { key: "invoices", icon: ReceiptLongRoundedIcon, href: "/for/freelancers" },
  ];

  return (
    <Box component="section" data-testid="ways-to-get-paid" sx={{ background: s.bg, py: { xs: 12, md: 20 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: { xs: 6, md: 9 },
          }}
        >
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>{t("v3.ways.eyebrow")}</Eyebrow>
            <HeadlineL sx={{ color: s.ink }}>
              {t("v3.ways.headline1")}
              <br />
              {t("v3.ways.headline2")}
            </HeadlineL>
          </Box>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, maxWidth: 380, fontSize: 16, lineHeight: 1.55 }}>
            {t("v3.ways.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
            gap: { xs: 2, md: 2.5 },
          }}
        >
          {METHODS.map((m, idx) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: (idx % 3) * 0.06 }}
                style={{ height: "100%" }}
              >
                <Box
                  onClick={() => router.push(m.href)}
                  role="button"
                  tabIndex={0}
                  data-testid={`way-card-${m.key}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(m.href);
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
                    "&:hover .way-arrow": { transform: "translateX(3px)" },
                  }}
                >
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: "11px",
                      background: s.dark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.08)",
                      border: `1px solid ${s.dark ? "rgba(129,140,248,0.3)" : "rgba(79,70,229,0.2)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: s.dark ? "#818CF8" : BRAND_ACCENT,
                      mb: 2,
                    }}
                  >
                    <Icon sx={{ fontSize: 21 }} />
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: FONT_HERO,
                      fontWeight: 700,
                      fontSize: 18,
                      letterSpacing: "-0.015em",
                      color: s.ink,
                      mb: 1,
                    }}
                  >
                    {t(`v3.ways.${m.key}.title`)}
                  </Typography>
                  <Typography
                    sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.55, color: s.ink2, mb: 2, flex: 1 }}
                  >
                    {t(`v3.ways.${m.key}.desc`)}
                  </Typography>
                  <ArrowForwardRoundedIcon
                    className="way-arrow"
                    sx={{
                      fontSize: 18,
                      color: s.dark ? "#818CF8" : BRAND_ACCENT,
                      transition: "transform .3s cubic-bezier(.16,1,.3,1)",
                    }}
                  />
                </Box>
              </motion.div>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(WaysToGetPaidV3);
