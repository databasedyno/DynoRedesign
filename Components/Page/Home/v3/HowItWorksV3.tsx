import React, { memo } from "react";
import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";
import { BRAND_ACCENT } from "@/constants/theme";

/**
 * HowItWorksV3 — three-step path from "who are you?" to "you got paid".
 * Answers "how do I start?" right on the page and is the primary sign-up driver
 * beneath the hero (it replaced the crypto price ticker, 2026-08).
 */
const HowItWorksV3: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");

  const STEPS = [
    { icon: PersonAddAlt1RoundedIcon, n: "01", title: t("v3.howitworks.step1title"), desc: t("v3.howitworks.step1desc") },
    { icon: LinkRoundedIcon, n: "02", title: t("v3.howitworks.step2title"), desc: t("v3.howitworks.step2desc") },
    { icon: AccountBalanceWalletRoundedIcon, n: "03", title: t("v3.howitworks.step3title"), desc: t("v3.howitworks.step3desc") },
  ];

  return (
    <Box
      component="section"
      id="how-it-works"
      data-testid="how-it-works"
      sx={{ background: s.bg, py: { xs: 11, md: 18 }, scrollMarginTop: "88px" }}
    >
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ maxWidth: 640, mb: { xs: 6, md: 9 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.howitworks.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink }}>{t("v3.howitworks.headline")}</HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16, md: 17 }, lineHeight: 1.55, mt: 2.5 }}>
            {t("v3.howitworks.body")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: { xs: 2.5, md: 3 },
          }}
        >
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <Box
                  sx={{
                    position: "relative",
                    height: "100%",
                    borderRadius: "22px",
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    p: { xs: 3, md: 3.5 },
                    overflow: "hidden",
                    transition: "transform .35s cubic-bezier(.16,1,.3,1), box-shadow .35s ease, border-color .35s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: `${BRAND_ACCENT}55`,
                      boxShadow: `0 30px 60px -34px ${BRAND_ACCENT}66`,
                    },
                  }}
                >
                  <Typography
                    aria-hidden
                    sx={{
                      position: "absolute",
                      top: 12,
                      right: 20,
                      fontFamily: FONT_HERO,
                      fontWeight: 700,
                      fontSize: 72,
                      lineHeight: 1,
                      color: s.dark ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.035)",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {step.n}
                  </Typography>
                  <Box
                    sx={{
                      width: 46,
                      height: 46,
                      borderRadius: "12px",
                      background: s.dark ? "rgba(79, 70, 229,0.14)" : "rgba(79, 70, 229,0.09)",
                      border: "1px solid rgba(79, 70, 229,0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: BRAND_ACCENT,
                      mb: 3,
                    }}
                  >
                    <Icon sx={{ fontSize: 23 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
                    {t("v3.howitworks.stepLabel")} {step.n}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 20, md: 22 }, lineHeight: 1.15, letterSpacing: "-0.02em", color: s.ink, mb: 1.5 }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: s.ink2 }}>
                    {step.desc}
                  </Typography>
                </Box>
              </motion.div>
            );
          })}
        </Box>

        <Box sx={{ mt: { xs: 5, md: 7 }, display: "flex", justifyContent: "flex-start" }}>
          <Button
            data-testid="how-it-works-cta"
            onClick={() => router.push("/auth/register?ref=how_it_works")}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
            sx={{
              borderRadius: "999px",
              px: 3.5,
              py: 1.5,
              textTransform: "none",
              fontFamily: FONT_BODY,
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              background: `linear-gradient(135deg, ${BRAND_ACCENT} 0%, #4338CA 100%)`,
              boxShadow: "0 12px 30px -10px rgba(79, 70, 229,0.6)",
              "&:hover": {
                background: "linear-gradient(135deg, #6366F1 0%, #4338CA 100%)",
                boxShadow: "0 14px 34px -10px rgba(79, 70, 229,0.72)",
              },
            }}
          >
            {t("v3.howitworks.cta")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HowItWorksV3);
