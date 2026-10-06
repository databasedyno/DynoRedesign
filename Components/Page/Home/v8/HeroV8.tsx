import React, { memo, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { motion, useScroll, useTransform } from "framer-motion";
import { Icon } from "@iconify/react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  PANEL,
  PANEL_GLOW,
  GRID_BG,
  PrimaryBtn,
  SecondaryBtn,
  goStart,
  useConsole,
} from "./kit";
import { useMotionOK } from "../motion/tokens";
import CheckoutCard from "./CheckoutCard";

/* ============================================================================
 * HeroV8 — reimagined hero. Left: confident value proposition. Right: the live
 * hosted-checkout panel on a layered dark plinth with gold glow, a grid floor,
 * subtle scroll parallax, and two floating accent cards. Light-first; the panel
 * is the dark punctuation.
 * ========================================================================== */

const TRUST = ["No credit card", "Non-custodial", "First payment free"];

const Float: React.FC<{ children: React.ReactNode; sx?: object; delay?: number; amp?: number }> = ({ children, sx, delay = 0, amp = 10 }) => {
  const ok = useMotionOK();
  if (!ok) return <Box sx={{ position: "absolute", ...sx }}>{children}</Box>;
  return (
    <Box
      component={motion.div}
      sx={{ position: "absolute", ...sx }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 + delay }}
    >
      <Box
        component={motion.div}
        animate={{ y: [0, -amp, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {children}
      </Box>
    </Box>
  );
};

const HeroV8: React.FC = () => {
  const s = useConsole();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const ok = useMotionOK();
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yMock = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const yGlow = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <Box
      ref={ref}
      component="section"
      id="hero"
      data-testid="hero"
      sx={{ position: "relative", background: s.canvas, overflow: "hidden", pt: { xs: 6, md: 9 }, pb: { xs: 8, md: 12 } }}
    >
      {/* Soft background glow (very subtle on light) */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -140,
          right: -120,
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,209,0,0.14), transparent 62%)",
          filter: "blur(12px)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1.05fr)" },
          gap: { xs: 7, lg: 8 },
          alignItems: "center",
        }}
      >
        {/* Left — copy */}
        <Box sx={{ maxWidth: 580, minWidth: 0 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              px: 1.25,
              py: 0.6,
              mb: 3,
              borderRadius: "999px",
              border: `1px solid ${s.line}`,
              background: s.surface,
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.04em", color: s.ink2 }}>
              {t("v8.hero.badge", { defaultValue: "Non-custodial · live in minutes" })}
            </Typography>
          </Box>

          <Typography
            component="h1"
            data-testid="hero-headline"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: "clamp(40px, 5.6vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              color: s.ink,
            }}
          >
            {t("v8.hero.h1", { defaultValue: "Accept crypto payments." })}
            <br />
            {t("v8.hero.h2a", { defaultValue: "Get paid" })} <GradientText>{t("v8.hero.h2b", { defaultValue: "your way." })}</GradientText>
          </Typography>

          <Typography
            sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16.5, md: 19 }, lineHeight: 1.62, mt: 3, maxWidth: 520 }}
          >
            {t("v8.hero.body", {
              defaultValue:
                "Take Bitcoin, Ethereum, USDT and 40+ assets — and keep the coin you're paid, or auto-convert to a stablecoin. Zero chargebacks, you hold the keys.",
            })}
          </Typography>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 4.5 }}>
            <PrimaryBtn
              data-testid="hero-primary-cta"
              onClick={() => goStart(router, "hero")}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{ px: 3.25, py: 1.5, fontSize: 16 }}
            >
              {t("v8.hero.primary", { defaultValue: "Start free" })}
            </PrimaryBtn>
            <SecondaryBtn
              data-testid="hero-secondary-cta"
              href="/pay/demo"
              startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 20 }} />}
              sx={{ px: 3.25, py: 1.5, fontSize: 16 }}
            >
              {t("v8.hero.secondary", { defaultValue: "See how it works" })}
            </SecondaryBtn>
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, md: 2.5 }, mt: 4 }}>
            {TRUST.map((label, i) => (
              <Box key={label} sx={{ display: "inline-flex", alignItems: "center", gap: 0.8 }}>
                <Icon icon="mdi:check-circle" width={16} height={16} color={s.accent} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.ink2 }}>
                  {t(`v8.hero.trust.${i}`, { defaultValue: label })}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right — layered live checkout panel */}
        <Box
          data-testid="hero-mock-wrap"
          sx={{ position: "relative", width: "100%", minWidth: 0, display: "flex", justifyContent: "center" }}
        >
          <Box
            component={ok ? motion.div : "div"}
            style={ok ? { y: yGlow } : undefined}
            aria-hidden
            sx={{
              position: "absolute",
              inset: "-8% -4%",
              borderRadius: "28px",
              background: PANEL_GLOW,
              pointerEvents: "none",
            }}
          />
          <Box
            component={ok ? motion.div : "div"}
            style={ok ? { y: yMock } : undefined}
            sx={{
              position: "relative",
              width: "100%",
              maxWidth: 520,
              borderRadius: "28px",
              p: { xs: 2.5, md: 4 },
              background: "linear-gradient(170deg, #171715 0%, #0B0B0A 100%)",
              border: `1px solid ${PANEL.lineStrong}`,
              boxShadow: "0 50px 120px -30px rgba(0,0,0,0.6)",
              overflow: "visible",
            }}
          >
            {/* grid floor (radial mask fades well before the rounded corners) */}
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                backgroundImage: GRID_BG,
                backgroundSize: "26px 26px",
                maskImage: "radial-gradient(70% 70% at 50% 40%, #000 20%, transparent 75%)",
                WebkitMaskImage: "radial-gradient(70% 70% at 50% 40%, #000 20%, transparent 75%)",
                opacity: 0.7,
              }}
            />
            <Box sx={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <CheckoutCard />
            </Box>

            {/* Floating accent — confirmation toast */}
            <Float sx={{ top: { xs: 8, md: 18 }, right: { xs: -4, md: -14 } }} delay={0.2} amp={9}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: "12px",
                  background: "rgba(16,16,15,0.9)",
                  border: `1px solid ${PANEL.lineStrong}`,
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 12px 30px -8px rgba(0,0,0,0.6)",
                }}
              >
                <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: PANEL.greenSoft, display: "grid", placeItems: "center" }}>
                  <Icon icon="mdi:check-bold" width={13} height={13} color={PANEL.green} />
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 700, color: PANEL.ink, lineHeight: 1.2 }}>
                    Payment confirmed
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, color: PANEL.green }}>+$79.00 settled</Typography>
                </Box>
              </Box>
            </Float>

            {/* Floating accent — auto-convert chip */}
            <Float sx={{ bottom: { xs: 10, md: 26 }, left: { xs: -4, md: -16 } }} delay={0.5} amp={7}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: "12px",
                  background: "rgba(16,16,15,0.9)",
                  border: `1px solid ${PANEL.lineStrong}`,
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 12px 30px -8px rgba(0,0,0,0.6)",
                }}
              >
                <Icon icon="cryptocurrency-color:btc" width={20} height={20} />
                <Icon icon="mdi:arrow-right-thin" width={16} height={16} color={PANEL.ink3} />
                <Icon icon="cryptocurrency-color:usdc" width={20} height={20} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: PANEL.ink2, ml: 0.3 }}>
                  Auto-convert
                </Typography>
              </Box>
            </Float>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(HeroV8);
