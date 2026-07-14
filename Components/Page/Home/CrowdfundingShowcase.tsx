import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";
import useLocalPrice from "@/hooks/useLocalPrice";

/**
 * CrowdfundingShowcase — dedicated section that shows off the GoFundMe-lite
 * campaign product: story, gallery, countdown, tiers, updates, donor wall.
 *
 * Two-column layout on desktop:
 *   Left  : eyebrow + headline + 4 feature bullets + CTA
 *   Right : mock campaign card (goal bar + supporter count + reward tiers +
 *           latest update pill)
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const CrowdfundingShowcase: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;
  const { fmt } = useLocalPrice();

  const green = "#10B981";
  const cardBg = s.dark ? "#0F1013" : "#FFFFFF";

  const features: Array<{ title: string; desc: string; testId: string }> = [
    { title: t("crowdfundingShowcase.feature1Title"), desc: t("crowdfundingShowcase.feature1Desc"), testId: "cf-feature-story" },
    { title: t("crowdfundingShowcase.feature2Title"), desc: t("crowdfundingShowcase.feature2Desc"), testId: "cf-feature-tiers" },
    { title: t("crowdfundingShowcase.feature3Title"), desc: t("crowdfundingShowcase.feature3Desc"), testId: "cf-feature-updates" },
    { title: t("crowdfundingShowcase.feature4Title"), desc: t("crowdfundingShowcase.feature4Desc"), testId: "cf-feature-wall" },
  ];

  const tiers = [
    { title: t("crowdfundingShowcase.mockTierCoffee"),  amount: fmt(5) },
    { title: t("crowdfundingShowcase.mockTierBacker"),  amount: fmt(25) },
    { title: t("crowdfundingShowcase.mockTierSponsor"), amount: fmt(100) },
  ];

  const raised = fmt(2000);
  const goal = fmt(10000);

  return (
    <Box
      component="section"
      id="crowdfunding-showcase"
      aria-labelledby="cf-heading"
      data-testid="crowdfunding-showcase"
      sx={{ px: { xs: 3, md: 6 }, py: { xs: 6, md: 10 } }}
    >
      <Box
        sx={{
          maxWidth: 1400,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 0.95fr" },
          gap: { xs: 5, lg: 8 },
          alignItems: "center",
        }}
      >
        {/* ═════ LEFT — narrative ═════ */}
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_TECH,
              fontSize: 12,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: green,
              mb: 2,
            }}
          >
            [ {t("crowdfundingShowcase.eyebrow")} ]
          </Typography>
          <Typography
            id="cf-heading"
            component="h2"
            sx={{
              fontFamily: FONT_HERO,
              fontWeight: 700,
              fontSize: { xs: 30, md: 44 },
              letterSpacing: "-0.02em",
              lineHeight: 1.08,
              color: s.txt,
              mb: 1,
            }}
          >
            {t("crowdfundingShowcase.title")}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_HERO,
              fontWeight: 300,
              fontSize: { xs: 24, md: 34 },
              letterSpacing: "-0.02em",
              color: green,
              mb: 3,
              lineHeight: 1.15,
            }}
          >
            {t("crowdfundingShowcase.titleHighlight")}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_BODY,
              fontSize: { xs: 15, md: 16.5 },
              color: s.sub,
              lineHeight: 1.6,
              mb: 4,
              maxWidth: 560,
            }}
          >
            {t("crowdfundingShowcase.subtitle")}
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mb: 4 }}>
            {features.map((f, i) => (
              <motion.div
                key={f.testId}
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              >
                <Box data-testid={f.testId}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: green,
                      }}
                    />
                    <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15, color: s.txt }}>
                      {f.title}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.sub, lineHeight: 1.55, pl: 1.75 }}>
                    {f.desc}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>

          <Box
            component="button"
            type="button"
            onClick={() => router.push("/auth/register?ref=crowdfunding_showcase")}
            data-testid="cf-showcase-cta"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 3,
              py: 1.5,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: green,
              color: "#fff",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 15,
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translate(-2px,-2px)",
                boxShadow: "4px 4px 0 rgba(16,185,129,0.45)",
              },
            }}
          >
            {t("crowdfundingShowcase.cta")} <ArrowForward sx={{ fontSize: 17 }} />
          </Box>
        </Box>

        {/* ═════ RIGHT — mock campaign card ═════ */}
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <Box
            data-testid="cf-mock-card"
            sx={{
              maxWidth: 460,
              mx: { xs: "auto", lg: 0 },
              backgroundColor: cardBg,
              border: `1px solid ${s.line}`,
              borderRadius: "18px",
              p: { xs: 2.5, sm: 3 },
              boxShadow: s.dark
                ? "0 40px 90px -40px rgba(0,0,0,0.75)"
                : "0 40px 90px -40px rgba(31,41,55,0.35)",
            }}
          >
            {/* header */}
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.faint, letterSpacing: "0.14em", textTransform: "uppercase", mb: 0.75 }}>
              dynopay/@hostbay
            </Typography>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 20, sm: 22 }, letterSpacing: "-0.01em", color: s.txt, mb: 2 }}>
              Support Dynopay open-source
            </Typography>

            {/* goal bar */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, color: s.txt }}>
                {raised}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.faint }}>
                20% · 41 {t("crowdfundingShowcase.mockSupporters")}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.sub, mb: 1 }}>
              {t("crowdfundingShowcase.mockGoal", { goal })}
            </Typography>
            <Box sx={{ position: "relative", height: 6, borderRadius: 999, bgcolor: s.dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.06)", mb: 2.5, overflow: "hidden" }}>
              <motion.div
                initial={reduced ? { width: "20%" } : { width: 0 }}
                whileInView={{ width: "20%" }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
                style={{ height: "100%", background: green, borderRadius: 999 }}
              />
            </Box>

            {/* tiers */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 2 }}>
              {tiers.map((tier) => (
                <Box
                  key={tier.title}
                  sx={{
                    border: `1px solid ${s.line}`,
                    borderRadius: "10px",
                    p: 1.25,
                    textAlign: "center",
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.1em", color: s.faint, textTransform: "uppercase", mb: 0.25 }}>
                    {tier.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 16, color: s.txt }}>
                    {tier.amount}+
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* update pill */}
            <Box
              sx={{
                p: 1.5,
                borderRadius: "10px",
                bgcolor: s.dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)",
                border: `1px solid ${s.dark ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.2)"}`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: green }} />
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.14em", color: green, textTransform: "uppercase" }}>
                  Update · emailed to 41 supporters
                </Typography>
              </Box>
              <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, color: s.txt, mb: 0.25 }}>
                {t("crowdfundingShowcase.mockUpdateTitle", { raised })}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: s.sub, lineHeight: 1.5 }}>
                {t("crowdfundingShowcase.mockUpdateBody")}
              </Typography>
            </Box>
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
};

export default memo(CrowdfundingShowcase);
