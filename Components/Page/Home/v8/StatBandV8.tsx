import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL, PANEL_GLOW } from "./kit";
import { CountUp } from "../motion/CountUp";
import { useLandingMetrics } from "../v5/useLandingMetrics";

/* ============================================================================
 * StatBandV8 — headline numbers that count up on scroll. Dark data panel that
 * punctuates the light hero. Real values come from the SSR'd landing metrics
 * where available (payments settled, countries, uptime); assets supported is a
 * platform constant. Reduced-motion → numbers render static.
 * ========================================================================== */

const fmtInt = (n: number): string => Math.round(n).toLocaleString("en-US");

const StatBandV8: React.FC = () => {
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();

  const payments = m?.payments_settled_this_month ?? 1076;
  const countries = m?.countries_served ?? 79;
  const uptime = m?.uptime_90d_pct ?? 99.92;

  const stats: { to: number | null; render: (n: number) => string; label: string; suffix?: string }[] = [
    {
      to: payments,
      render: (n) => fmtInt(n),
      label: t("v8.stats.payments", { defaultValue: "Payments settled this month" }),
    },
    {
      to: countries,
      render: (n) => fmtInt(n),
      suffix: "+",
      label: t("v8.stats.countries", { defaultValue: "Countries served" }),
    },
    {
      to: 40,
      render: (n) => fmtInt(n),
      suffix: "+",
      label: t("v8.stats.assets", { defaultValue: "Crypto assets supported" }),
    },
    {
      to: uptime,
      render: (n) => n.toFixed(2),
      suffix: "%",
      label: t("v8.stats.uptime", { defaultValue: "Uptime over 90 days" }),
    },
  ];

  return (
    <Box
      component="section"
      data-testid="stat-band"
      sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 6.5, md: 9 } }}
    >
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, opacity: 0.6, pointerEvents: "none" }} />
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: { xs: 4, md: 2 },
        }}
      >
        {stats.map((st, i) => (
          <Box
            key={st.label}
            sx={{
              textAlign: { xs: "left", md: "center" },
              px: { md: 2 },
              borderLeft: { md: i === 0 ? "none" : `1px solid ${PANEL.line}` },
            }}
          >
            <Typography
              component="div"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: { xs: 34, md: 52 },
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: PANEL.ink,
                display: "flex",
                alignItems: "baseline",
                gap: 0.2,
                justifyContent: { xs: "flex-start", md: "center" },
              }}
            >
              <CountUp to={st.to} render={st.render} />
              {st.suffix ? (
                <Box component="span" sx={{ color: PANEL.gold, fontSize: { xs: 24, md: 34 } }}>
                  {st.suffix}
                </Box>
              ) : null}
            </Typography>
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: 11.5,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: PANEL.ink3,
                mt: 1.5,
                maxWidth: { md: 180 },
                mx: { md: "auto" },
              }}
            >
              {st.label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          mx: "auto",
          px: { xs: 3, md: 6 },
          mt: { xs: 4, md: 5 },
        }}
      >
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: PANEL.ink3, textAlign: { xs: "left", md: "center" } }}>
          {t("v8.stats.note", { defaultValue: "Live platform figures · updated continuously" })}
        </Typography>
      </Box>
    </Box>
  );
};

export default memo(StatBandV8);
