import React, { memo, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "./theme.v3";
import { Eyebrow, HeadlineL } from "./styled.v3";

/**
 * ProductShowcaseV3 — real product visuals as a looping checkout story (2026-08).
 *
 * Genuine screenshots of the live hosted checkout (/pay/demo) and the
 * payment-success state (/pay/success-demo), captured into
 * public/assets/landing. A single phone auto-cycles the real journey:
 * awaiting payment → confirming on-chain → confirmed (checkout.png → success.png),
 * with a floating live-status chip and a "settled in seconds" timer badge that
 * counts up while pending and freezes on confirmation (conversion proof).
 * Hover pauses the loop so visitors can read each step. Honours
 * prefers-reduced-motion (shows the confirmed state, frozen timer).
 */

// Steps: 0 = awaiting, 1 = confirming (both on checkout.png), 2 = confirmed (success.png).
const STEP_DURATION = [2200, 2000, 3200];
const PHONE_ASPECT = 960 / 1880; // checkout.png intrinsic ratio → stable phone screen box

const fmt = (s: number) => `0:${String(Math.min(s, 59)).padStart(2, "0")}`;

const ProductShowcaseV3: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [secs, setSecs] = useState(0);

  // Step advancer — frozen while hovered (paused) or reduced-motion.
  useEffect(() => {
    if (reduced) {
      setStep(2);
      return;
    }
    if (paused) return;
    const id = setTimeout(() => setStep((p) => (p + 1) % 3), STEP_DURATION[step]);
    return () => clearTimeout(id);
  }, [step, paused, reduced]);

  // Elapsed timer — resets at cycle start, counts while pending, freezes on confirm/hover.
  useEffect(() => {
    if (reduced) {
      setSecs(38);
      return;
    }
    if (step === 0) setSecs(0);
    if (paused || step === 2) return;
    const id = setInterval(() => setSecs((v) => (v >= 59 ? 59 : v + 1)), 1000);
    return () => clearInterval(id);
  }, [step, paused, reduced]);

  const showSuccess = step === 2;

  const chip = [
    { dot: "#F59E0B", label: t("v3.showcase.step0"), pulse: false, check: false },
    { dot: "#4F46E5", label: t("v3.showcase.step1"), pulse: true, check: false },
    { dot: "#16A34A", label: t("v3.showcase.step2"), pulse: false, check: true },
  ][step];

  return (
    <Box component="section" data-testid="product-showcase" sx={{ background: s.bg, py: { xs: 10, md: 18 } }}>
      <Box sx={{ maxWidth: 900, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ textAlign: "center", maxWidth: 680, mx: "auto", mb: { xs: 6, md: 9 } }}>
          <Eyebrow sx={{ mb: 2 }}>{t("v3.showcase.eyebrow")}</Eyebrow>
          <HeadlineL component="h2" sx={{ color: s.ink, mb: 2.5 }}>
            {t("v3.showcase.headline")}
          </HeadlineL>
          <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: 16, lineHeight: 1.6 }}>
            {t("v3.showcase.body")}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: "100%", maxWidth: 320 }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* Phone frame */}
            <Box
              data-testid="showcase-phone"
              sx={{
                p: "10px",
                borderRadius: "44px",
                background: s.dark
                  ? "linear-gradient(180deg,#1c1c22,#0b0b0f)"
                  : "linear-gradient(180deg,#2b2b33,#111114)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 48px 96px -34px rgba(0,0,0,0.55)",
                cursor: "default",
              }}
            >
              <Box
                data-testid="showcase-screen"
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: `${PHONE_ASPECT}`,
                  borderRadius: "34px",
                  overflow: "hidden",
                  background: "#000",
                }}
              >
                <Box
                  component="img"
                  src="/assets/landing/checkout.png"
                  alt={t("v3.showcase.cap1")}
                  loading="lazy"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    opacity: showSuccess ? 0 : 1,
                    transition: "opacity 0.6s ease",
                  }}
                />
                <Box
                  component="img"
                  src="/assets/landing/success.png"
                  alt={t("v3.showcase.cap2")}
                  loading="lazy"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    opacity: showSuccess ? 1 : 0,
                    transition: "opacity 0.6s ease",
                  }}
                />

                {/* Timer badge (conversion proof) — top-center */}
                <Box
                  data-testid="showcase-timer"
                  sx={{
                    position: "absolute",
                    left: "50%",
                    top: 16,
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 1.4,
                    py: 0.55,
                    borderRadius: "999px",
                    background: "rgba(12,12,16,0.7)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: `1px solid ${showSuccess ? "rgba(22,163,74,0.55)" : "rgba(255,255,255,0.14)"}`,
                    boxShadow: "0 8px 24px -12px rgba(0,0,0,0.55)",
                    whiteSpace: "nowrap",
                    transition: "border-color 0.4s ease",
                  }}
                >
                  <AccessTimeRoundedIcon sx={{ fontSize: 13, color: showSuccess ? "#4ADE80" : "rgba(255,255,255,0.7)" }} />
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em", color: "#F5F5F5" }}>
                    {showSuccess ? `${t("v3.showcase.settled", { defaultValue: "Settled" })} ${fmt(secs)}` : fmt(secs)}
                  </Typography>
                </Box>

                {/* Floating live-status chip — bottom-center */}
                <Box
                  data-testid="showcase-status"
                  sx={{
                    position: "absolute",
                    left: "50%",
                    bottom: 18,
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1.75,
                    py: 0.85,
                    borderRadius: "999px",
                    background: "rgba(12,12,16,0.72)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 10px 30px -12px rgba(0,0,0,0.6)",
                    whiteSpace: "nowrap",
                    maxWidth: "88%",
                  }}
                >
                  {chip.check ? (
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: chip.dot,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <CheckRoundedIcon sx={{ fontSize: 11, color: "#fff" }} />
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: chip.dot,
                        flexShrink: 0,
                        ...(chip.pulse && {
                          "@keyframes showcasePulse": {
                            "0%": { boxShadow: `0 0 0 0 ${chip.dot}66` },
                            "70%": { boxShadow: `0 0 0 7px ${chip.dot}00` },
                            "100%": { boxShadow: `0 0 0 0 ${chip.dot}00` },
                          },
                          animation: "showcasePulse 1.4s ease-out infinite",
                        }),
                      }}
                    />
                  )}
                  <Typography
                    sx={{
                      fontFamily: FONT_TECH,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      color: "#F5F5F5",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {chip.label}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Progress dots */}
            <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 3 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: i === step ? 22 : 7,
                    height: 7,
                    borderRadius: "999px",
                    background: i === step ? (s.dark ? "#818CF8" : "#4F46E5") : s.lineStrong,
                    transition: "width 0.3s ease, background 0.3s ease",
                  }}
                />
              ))}
            </Box>

            {/* Caption */}
            <Box sx={{ textAlign: "center", mt: 2.5 }}>
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, color: s.ink, mb: 0.5 }}>
                {t("v3.showcase.caption")}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.5, color: s.ink2, maxWidth: 360, mx: "auto" }}>
                {t("v3.showcase.captionSub")}
              </Typography>
            </Box>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ProductShowcaseV3);
