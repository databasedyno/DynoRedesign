import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ArrowLink, FONT_BODY, FONT_DISPLAY, FONT_MONO, Reveal, SectionHeadV8, SectionV8, useConsole } from "./kit";
import { useMotionOK } from "../motion/tokens";

/* ============================================================================
 * HowItWorksV8 — a clean, animated 3-step explanation of getting paid in
 * crypto. A gold connector line draws across the steps on scroll (desktop).
 * ========================================================================== */

const HowItWorksV8: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const ok = useMotionOK();

  const steps = [
    {
      icon: "mdi:link-variant-plus",
      title: t("v8.how.s1.title", { defaultValue: "Create a link or connect" }),
      desc: t("v8.how.s1.desc", { defaultValue: "Spin up a hosted checkout, payment link, or API key in minutes — no code required." }),
    },
    {
      icon: "mdi:qrcode-scan",
      title: t("v8.how.s2.title", { defaultValue: "Your customer pays" }),
      desc: t("v8.how.s2.desc", { defaultValue: "They scan and send from any wallet. You watch it confirm on-chain in real time." }),
    },
    {
      icon: "mdi:bank-transfer-in",
      title: t("v8.how.s3.title", { defaultValue: "You get paid your way" }),
      desc: t("v8.how.s3.desc", { defaultValue: "Keep the coin or auto-convert to a stablecoin, then withdraw to your wallet anytime." }),
    },
  ];

  return (
    <SectionV8 id="how-it-works" testId="how-it-works">
      <SectionHeadV8
        center
        eyebrow={t("v8.how.eyebrow", { defaultValue: "How it works" })}
        title={t("v8.how.title", { defaultValue: "Get paid in crypto in three steps" })}
        lead={t("v8.how.lead", { defaultValue: "From zero to your first crypto payment in minutes — the flow is the same whether you sell online, invoice clients, or take donations." })}
        maxWidth={720}
      />

      <Box sx={{ position: "relative" }}>
        {/* connector line (desktop) */}
        <Box
          aria-hidden
          sx={{
            display: { xs: "none", md: "block" },
            position: "absolute",
            top: 38,
            left: "16%",
            right: "16%",
            height: 2,
            background: s.line,
            overflow: "hidden",
          }}
        >
          <Box
            component={ok ? motion.div : "div"}
            sx={{ height: "100%", background: "linear-gradient(90deg, #FFD100, #F5A800)", transformOrigin: "left" }}
            {...(ok
              ? {
                  initial: { scaleX: 0 },
                  whileInView: { scaleX: 1 },
                  viewport: { once: true },
                  transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
                }
              : { style: { transform: "scaleX(1)" } })}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: { xs: 4, md: 5 },
          }}
        >
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.12} sx={{ textAlign: { xs: "left", md: "center" } }}>
              <Box sx={{ display: "flex", flexDirection: { xs: "row", md: "column" }, alignItems: "center", gap: { xs: 2.5, md: 0 } }}>
                <Box
                  sx={{
                    position: "relative",
                    width: 78,
                    height: 78,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: s.canvas,
                    border: `1px solid ${s.lineStrong}`,
                    flexShrink: 0,
                    mx: { md: "auto" },
                    boxShadow: s.dark ? "none" : "0 12px 30px -16px rgba(0,0,0,0.25)",
                  }}
                >
                  <Icon icon={step.icon} width={30} height={30} color={s.accent} />
                  <Box
                    sx={{
                      position: "absolute",
                      top: -6,
                      right: { xs: "auto", md: -6 },
                      left: { xs: -6, md: "auto" },
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "#FFD100",
                      color: "#0B0B0A",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: FONT_MONO,
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    {i + 1}
                  </Box>
                </Box>
                <Box sx={{ mt: { md: 3 } }}>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: { xs: 19, md: 21 }, fontWeight: 700, color: s.ink }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.6, color: s.ink2, mt: 1, maxWidth: { md: 300 }, mx: { md: "auto" } }}>
                    {step.desc}
                  </Typography>
                </Box>
              </Box>
            </Reveal>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", mt: { xs: 5, md: 7 } }}>
        <ArrowLink href="/documentation" testId="how-docs-link">
          {t("v8.how.cta", { defaultValue: "Read the integration docs" })}
          <ArrowForwardIcon className="arr" sx={{ fontSize: 16 }} />
        </ArrowLink>
      </Box>
    </SectionV8>
  );
};

export default memo(HowItWorksV8);
