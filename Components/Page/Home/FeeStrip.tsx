import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { useRouter } from "next/router";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_HERO, FONT_TECH, useSwiss } from "./swiss";
import useLocalPrice from "@/hooks/useLocalPrice";

/**
 * FeeStrip — compact 3-column fee band that replaces the FeeCalculator +
 * ComparisonTable. Communicates the same core message in 1/8th the space:
 * "$0 to start · fees from 0.5% · vs Stripe 2.9%+30¢ / PayPal 3.49%+49¢".
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const FeeStrip: React.FC = () => {
  const s = useSwiss();
  const { t } = useTranslation("landing");
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const reduced = !!prefersReduced;
  const { fmt } = useLocalPrice();

  // Flat per-transaction fees — Stripe $0.30, PayPal $0.49 — swapped to the
  // visitor's local currency so the comparison feels native.
  const stripeFlat = fmt(0.30);
  const paypalFlat = fmt(0.49);

  const cols: Array<{
    labelKey: string;
    valueKey: string;
    valueVars?: Record<string, string>;
    noteKey: string;
    highlight: boolean;
    testId: string;
  }> = [
    { labelKey: "feeStrip.col1Label", valueKey: "feeStrip.col1Value", noteKey: "feeStrip.col1Note", highlight: true, testId: "fee-strip-dynopay" },
    { labelKey: "feeStrip.col2Label", valueKey: "feeStrip.col2Value", valueVars: { flat: stripeFlat }, noteKey: "feeStrip.col2Note", highlight: false, testId: "fee-strip-stripe" },
    { labelKey: "feeStrip.col3Label", valueKey: "feeStrip.col3Value", valueVars: { flat: paypalFlat }, noteKey: "feeStrip.col3Note", highlight: false, testId: "fee-strip-paypal" },
  ];

  return (
    <Box
      component="section"
      id="fee-calculator"
      aria-labelledby="fee-strip-heading"
      data-testid="fee-strip"
      sx={{ px: { xs: 3, md: 6 }, py: { xs: 6, md: 9 } }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", textAlign: "center" }}>
        <Typography
          sx={{
            fontFamily: FONT_TECH,
            fontSize: 12,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: s.accentText,
            mb: 1.5,
          }}
        >
          [ {t("feeStrip.eyebrow")} ]
        </Typography>
        <Typography
          id="fee-strip-heading"
          component="h2"
          sx={{
            fontFamily: FONT_HERO,
            fontWeight: 700,
            fontSize: { xs: 30, md: 46 },
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: s.txt,
            mb: 1.5,
          }}
        >
          {t("feeStrip.headline")}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_BODY,
            fontSize: { xs: 14.5, md: 16 },
            color: s.sub,
            lineHeight: 1.55,
            mb: { xs: 4, md: 5 },
            maxWidth: 620,
            mx: "auto",
          }}
        >
          {t("feeStrip.sub")}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: { xs: 2, md: 0 },
            border: `1px solid ${s.line}`,
            borderRadius: "16px",
            overflow: "hidden",
            mb: 3.5,
            backgroundColor: s.dark ? "#0F1013" : "#FFFFFF",
          }}
        >
          {cols.map((c, i) => (
            <motion.div
              key={c.testId}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            >
              <Box
                data-testid={c.testId}
                sx={{
                  py: { xs: 3, md: 4 },
                  px: 2.5,
                  borderRight: {
                    xs: "none",
                    md: i < cols.length - 1 ? `1px solid ${s.line}` : "none",
                  },
                  borderBottom: {
                    xs: i < cols.length - 1 ? `1px solid ${s.line}` : "none",
                    md: "none",
                  },
                  backgroundColor: c.highlight
                    ? s.dark
                      ? "rgba(204,255,0,0.04)"
                      : "rgba(204,255,0,0.06)"
                    : "transparent",
                  position: "relative",
                }}
              >
                {c.highlight && (
                  <Typography
                    sx={{
                      position: "absolute",
                      top: 10,
                      right: 12,
                      fontFamily: FONT_TECH,
                      fontSize: 9.5,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: s.accentText,
                      px: 1,
                      py: 0.25,
                      border: `1px solid ${s.accent}`,
                      borderRadius: "999px",
                    }}
                  >
                    You
                  </Typography>
                )}
                <Typography
                  sx={{
                    fontFamily: FONT_TECH,
                    fontSize: 11,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: s.faint,
                    mb: 1.25,
                  }}
                >
                  {t(c.labelKey)}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: FONT_HERO,
                    fontWeight: 700,
                    fontSize: { xs: 26, md: 32 },
                    letterSpacing: "-0.02em",
                    color: c.highlight ? s.accentText : s.txt,
                    lineHeight: 1.1,
                    mb: 1,
                  }}
                >
                  {t(c.valueKey, c.valueVars)}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    color: s.sub,
                    lineHeight: 1.45,
                  }}
                >
                  {t(c.noteKey)}
                </Typography>
              </Box>
            </motion.div>
          ))}
        </Box>

        <Box
          component="button"
          type="button"
          onClick={() => router.push("/fees")}
          data-testid="fee-strip-cta"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 3,
            py: 1.4,
            borderRadius: "999px",
            border: `1px solid ${s.line}`,
            backgroundColor: "transparent",
            color: s.txt,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
            "&:hover": {
              borderColor: s.accent,
              backgroundColor: s.dark ? "rgba(204,255,0,0.04)" : "rgba(204,255,0,0.06)",
            },
          }}
        >
          {t("feeStrip.cta")} <ArrowForward sx={{ fontSize: 15 }} />
        </Box>
      </Box>
    </Box>
  );
};

export default memo(FeeStrip);
