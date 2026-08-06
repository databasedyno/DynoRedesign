import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PointOfSaleRoundedIcon from "@mui/icons-material/PointOfSaleRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * ProductFeatureCards — Coinbase-inspired "one idea per card" capability band.
 *
 * Each card follows the pattern the Coinbase landing page repeats over and
 * over: a small product visual, an eyebrow tag, a short verb-led headline, a
 * single benefit sentence, and exactly one link. Scannable, no clutter.
 *
 * Frontend-only, additive. Uses the aurora v3 tokens so it matches the rest
 * of the landing stack (single coral accent, Unbounded headings).
 */

interface Feature {
  key: string;
  tag: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  icon: React.ElementType;
  chips: string[];
}

const ProductFeatureCards: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");

  const FEATURES: Feature[] = [
    {
      key: "checkout",
      tag: t("v3.features.checkout.tag"),
      title: t("v3.features.checkout.title"),
      desc: t("v3.features.checkout.desc"),
      href: "/for/merchants",
      cta: t("v3.features.checkout.cta"),
      icon: PointOfSaleRoundedIcon,
      chips: ["BTC", "ETH", "USDT", "USDC", "SOL"],
    },
    {
      key: "convert",
      tag: t("v3.features.convert.tag"),
      title: t("v3.features.convert.title"),
      desc: t("v3.features.convert.desc"),
      href: "/fees",
      cta: t("v3.features.convert.cta"),
      icon: SwapHorizRoundedIcon,
      chips: ["ETH", "→", "USDC"],
    },
    {
      key: "api",
      tag: t("v3.features.api.tag"),
      title: t("v3.features.api.title"),
      desc: t("v3.features.api.desc"),
      href: "/documentation",
      cta: t("v3.features.api.cta"),
      icon: TerminalRoundedIcon,
      chips: ["POST", "/v1/charges", "201"],
    },
  ];

  return (
    <Box component="section" sx={{ background: s.bgAlt, py: { xs: 14, md: 24 } }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: { xs: 7, md: 11 },
          }}
        >
          <Box sx={{ maxWidth: 620 }}>
            <Eyebrow sx={{ mb: 2 }}>{t("v3.features.eyebrow")}</Eyebrow>
            <HeadlineL sx={{ color: s.ink }}>
              {t("v3.features.headline1")}
              <br />
              {t("v3.features.headline2")}
            </HeadlineL>
          </Box>
          <Typography
            sx={{
              fontFamily: FONT_BODY,
              color: s.ink2,
              maxWidth: 380,
              fontSize: 16,
              lineHeight: 1.55,
            }}
          >
            {t("v3.features.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: idx * 0.07 }}
                style={{ height: "100%" }}
              >
                <Box
                  onClick={() => router.push(f.href)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(f.href);
                  }}
                  sx={{
                    position: "relative",
                    cursor: "pointer",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "22px",
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    p: { xs: 2.5, md: 3 },
                    overflow: "hidden",
                    transition: "transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease, border-color .35s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 30px 60px -34px rgba(79, 70, 229,0.4)",
                      borderColor: s.lineStrong,
                    },
                    "&:hover .feat-cta-arrow": { transform: "translateX(4px)" },
                  }}
                >
                  {/* mini product visual */}
                  <Box
                    sx={{
                      position: "relative",
                      height: 132,
                      borderRadius: "14px",
                      background: "#0F0F13",
                      border: "1px solid rgba(255,255,255,0.08)",
                      overflow: "hidden",
                      mb: 2.5,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      p: 2,
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        position: "absolute",
                        top: -40,
                        right: -40,
                        width: 160,
                        height: 160,
                        borderRadius: "50%",
                        background: BRAND_ACCENT,
                        filter: "blur(48px)",
                        opacity: 0.15,
                      }}
                    />
                    <Box
                      sx={{
                        position: "relative",
                        zIndex: 1,
                        width: 40,
                        height: 40,
                        borderRadius: "11px",
                        background: "rgba(79, 70, 229,0.14)",
                        border: "1px solid rgba(79, 70, 229,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6366F1",
                      }}
                    >
                      <Icon sx={{ fontSize: 22 }} />
                    </Box>
                    <Box sx={{ position: "relative", zIndex: 1, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {f.chips.map((c, i) => (
                        <Box
                          key={`${f.key}-chip-${i}`}
                          sx={{
                            px: 1,
                            py: 0.4,
                            borderRadius: "7px",
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.04)",
                            color: "rgba(255,255,255,0.82)",
                            fontFamily: FONT_TECH,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {c}
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Typography
                    sx={{
                      fontFamily: FONT_TECH,
                      fontSize: 11.5,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                      color: s.dark ? "#818CF8" : "#4338CA",
                      fontWeight: 500,
                      mb: 1.25,
                    }}
                  >
                    {f.tag}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: FONT_HERO,
                      fontWeight: 700,
                      fontSize: { xs: 21, md: 23 },
                      lineHeight: 1.12,
                      letterSpacing: "-0.02em",
                      color: s.ink,
                      mb: 1.5,
                    }}
                  >
                    {f.title}
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
                    {f.desc}
                  </Typography>
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                    <Typography
                      sx={{
                        fontFamily: FONT_BODY,
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: s.dark ? "#818CF8" : BRAND_ACCENT,
                      }}
                    >
                      {f.cta}
                    </Typography>
                    <ArrowForwardRoundedIcon
                      className="feat-cta-arrow"
                      sx={{ fontSize: 17, color: s.dark ? "#818CF8" : BRAND_ACCENT, transition: "transform .35s cubic-bezier(.16,1,.3,1)" }}
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

export default memo(ProductFeatureCards);
