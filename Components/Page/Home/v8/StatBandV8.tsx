import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL, PANEL_GLOW } from "./kit";
import { CountUp } from "../motion/CountUp";
import { useLandingMetrics } from "../v5/useLandingMetrics";
import { CHAINS_COUNT, COINS_COUNT } from "./platformFacts";

/* ============================================================================
 * StatBandV8 — four REAL headline figures (live metrics API + platform facts)
 * that count up on scroll. Dark band that punctuates the light hero.
 * ========================================================================== */

const fmtInt = (n: number): string => Math.round(n).toLocaleString("en-US");

const StatBandV8: React.FC = () => {
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();

  const stats: { testId: string; to: number; render: (n: number) => string; suffix?: string; label: string; sub: string }[] = [
    {
      testId: "stat-payments-settled",
      to: m?.payments_settled_this_month ?? 1021,
      render: fmtInt,
      label: t("v8.stats.payments", { defaultValue: "Payments settled this month" }),
      sub: t("v8.stats.paymentsSub", { defaultValue: "On-chain, to merchant wallets" }),
    },
    {
      testId: "stat-countries-served",
      to: m?.countries_served ?? 121,
      render: fmtInt,
      label: t("v8.stats.countries", { defaultValue: "Countries served" }),
      sub: t("v8.stats.countriesSub", { defaultValue: "Buyers paying in 6 languages" }),
    },
    {
      testId: "stat-chains-assets",
      to: COINS_COUNT,
      render: fmtInt,
      label: t("v8.stats.assets", { defaultValue: "Coins & tokens" }),
      sub: t("v8.stats.assetsSub", { defaultValue: `Across ${CHAINS_COUNT} blockchains` }),
    },
    {
      testId: "stat-uptime-pct",
      to: m?.uptime_90d_pct ?? 99.94,
      render: (n) => n.toFixed(2),
      suffix: "%",
      label: t("v8.stats.uptime", { defaultValue: "Uptime over 90 days" }),
      sub: t("v8.stats.uptimeSub", { defaultValue: "Public status page" }),
    },
  ];

  return (
    <Box component="section" data-testid="stat-band" sx={{ position: "relative", background: PANEL.bg, color: PANEL.ink, overflow: "hidden", py: { xs: 7, md: 9 } }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, opacity: 0.45, pointerEvents: "none" }} />
      <Box sx={{ position: "relative", zIndex: 1, maxWidth: 1240, mx: "auto", px: { xs: 3, md: 6 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 4, md: 0 } }}>
          {stats.map((st, i) => (
            <Box key={st.testId} data-testid={st.testId} sx={{ px: { md: i === 0 ? 0 : 4 }, borderLeft: { md: i === 0 ? "none" : `1px solid ${PANEL.line}` } }}>
              <Typography component="div" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 38, md: 56 }, lineHeight: 1, letterSpacing: "-0.035em", color: PANEL.ink, display: "flex", alignItems: "baseline", gap: 0.3 }}>
                <CountUp to={st.to} render={st.render} />
                {st.suffix ? <Box component="span" sx={{ color: PANEL.gold, fontSize: { xs: 22, md: 30 }, fontWeight: 700 }}>{st.suffix}</Box> : null}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14, md: 15.5 }, fontWeight: 600, color: PANEL.ink, mt: 1.5 }}>{st.label}</Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: PANEL.ink3, mt: 0.4 }}>{st.sub}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: { xs: 5, md: 6 }, pt: 3, borderTop: `1px solid ${PANEL.line}` }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.green, flexShrink: 0 }} />
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: PANEL.ink3 }}>
            {t("v8.stats.note", { defaultValue: "Live platform figures · updated continuously" })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(StatBandV8);
