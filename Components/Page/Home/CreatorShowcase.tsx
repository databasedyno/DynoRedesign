import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward, CheckCircle } from "@mui/icons-material";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";
import useLocalPrice from "@/hooks/useLocalPrice";
import { prettyCreatorDomain } from "@/helpers/creatorUrl";

/**
 * CreatorShowcase — dedicated section for the creator page product.
 * Mirrors CrowdfundingShowcase layout but swaps in a mock creator page
 * with @handle + bio + preset tip amounts + inline "Send a tip" CTA.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const CreatorShowcase: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;
  const { fmt } = useLocalPrice();

  const pink = "#F472B6";
  const cardBg = s.dark ? "#0F1013" : "#FFFFFF";

  const bullets: string[] = [
    t("creatorShowcase.feature1"),
    t("creatorShowcase.feature2"),
    t("creatorShowcase.feature3"),
    t("creatorShowcase.feature4"),
  ];

  const tipAmounts = [fmt(5), fmt(10), fmt(25)];

  return (
    <Box
      component="section"
      id="creator-showcase"
      aria-labelledby="creator-heading"
      data-testid="creator-showcase"
      sx={{ px: { xs: 3, md: 6 }, py: { xs: 6, md: 10 } }}
    >
      <Box
        sx={{
          maxWidth: 1400,
          mx: "auto",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1fr" },
          gap: { xs: 5, lg: 8 },
          alignItems: "center",
        }}
      >
        {/* ═════ LEFT — mock creator page ═════ */}
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <Box
            data-testid="creator-mock-card"
            sx={{
              maxWidth: 400,
              mx: { xs: "auto", lg: 0 },
              backgroundColor: cardBg,
              border: `1px solid ${s.line}`,
              borderRadius: "18px",
              p: { xs: 2.5, sm: 3 },
              boxShadow: s.dark
                ? "0 40px 90px -40px rgba(0,0,0,0.75)"
                : "0 40px 90px -40px rgba(31,41,55,0.35)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* avatar */}
            <Box
              sx={{
                width: 66,
                height: 66,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${pink}, #C084FC)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_HERO,
                fontWeight: 800,
                fontSize: 26,
                color: "#fff",
                mb: 2,
              }}
              aria-hidden
            >
              A
            </Box>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, color: s.txt, mb: 0.25 }}>
              Ada Ekwuazi
            </Typography>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: pink, mb: 1.5 }}>
              {prettyCreatorDomain()}/{t("creatorShowcase.mockHandle")}
            </Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.sub, lineHeight: 1.55, mb: 2.5 }}>
              {t("creatorShowcase.mockBio")}
            </Typography>

            {/* tip presets */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 1.25 }}>
              {tipAmounts.map((amt, i) => (
                <Box
                  key={amt}
                  sx={{
                    py: 1.25,
                    borderRadius: "10px",
                    border: `1px solid ${i === 1 ? pink : s.line}`,
                    backgroundColor: i === 1 ? (s.dark ? "rgba(244,114,182,0.08)" : "rgba(244,114,182,0.06)") : "transparent",
                    textAlign: "center",
                    fontFamily: FONT_HERO,
                    fontWeight: 700,
                    fontSize: 16,
                    color: s.txt,
                  }}
                >
                  {amt}
                </Box>
              ))}
            </Box>

            {/* send tip button */}
            <Box
              sx={{
                py: 1.4,
                borderRadius: "10px",
                textAlign: "center",
                backgroundColor: pink,
                color: "#fff",
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14.5,
              }}
            >
              {t("creatorShowcase.mockTipCta")} · USDT
            </Box>

            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.14em", color: s.faint, textTransform: "uppercase", mt: 1.5, textAlign: "center" }}>
              Direct to wallet · no signup
            </Typography>
          </Box>
        </motion.div>

        {/* ═════ RIGHT — narrative ═════ */}
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_TECH,
              fontSize: 12,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: pink,
              mb: 2,
            }}
          >
            [ {t("creatorShowcase.eyebrow")} ]
          </Typography>
          <Typography
            id="creator-heading"
            component="h2"
            sx={{
              fontFamily: FONT_HERO,
              fontWeight: 700,
              fontSize: { xs: 28, md: 40 },
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: s.txt,
              mb: 3,
            }}
          >
            {t("creatorShowcase.title")}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_BODY,
              fontSize: { xs: 15, md: 16.5 },
              color: s.sub,
              lineHeight: 1.6,
              mb: 3.5,
              maxWidth: 540,
            }}
          >
            {t("creatorShowcase.subtitle")}
          </Typography>

          <Box sx={{ mb: 4 }}>
            {bullets.map((b, i) => (
              <motion.div
                key={b}
                initial={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, mb: 1.5 }}>
                  <CheckCircle sx={{ fontSize: 18, color: pink, mt: "2px", flexShrink: 0 }} />
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.txt, lineHeight: 1.5 }}>
                    {b}
                  </Typography>
                </Box>
              </motion.div>
            ))}
          </Box>

          <Box
            component="button"
            type="button"
            onClick={() => router.push("/auth/register?ref=creator_showcase")}
            data-testid="creator-showcase-cta"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 3,
              py: 1.5,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: pink,
              color: "#fff",
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 15,
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translate(-2px,-2px)",
                boxShadow: "4px 4px 0 rgba(244,114,182,0.45)",
              },
            }}
          >
            {t("creatorShowcase.cta")} <ArrowForward sx={{ fontSize: 17 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(CreatorShowcase);
