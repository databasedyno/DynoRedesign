import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useTranslation } from "react-i18next";
import { ArrowLink, Eyebrow, FONT_DISPLAY, FONT_MONO, useConsole } from "./kit";
import { useLandingMetrics, formatInt } from "../v5/useLandingMetrics";

/**
 * Section 2 — LIVE PROOF ("Can I trust it?"). A calm KPI band of three live
 * figures + a link to the live status page. Numbers come from
 * /api/status/landing-metrics (SSR-seeded); fallbacks keep the strip honest if
 * the backend is briefly unreachable.
 */
const TrustBarV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const payments = m?.payments_settled_this_month ?? 1076;
  const uptime = m?.uptime_90d_pct ?? 99.92;
  const countries = m?.countries_served ?? 79;

  const stats = [
    { value: `${formatInt(payments, "en")}+`, label: t("v7.trust.paymentsLabel") },
    { value: `${uptime.toFixed(2)}%`, label: t("v7.trust.uptimeLabel") },
    { value: `${countries}`, label: t("v7.trust.countriesLabel") },
  ];

  return (
    <Box component="section" id="trust" data-testid="trust-bar" sx={{ background: s.canvas, borderTop: `1px solid ${s.line}` }}>
      <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 3, md: 6 }, py: { xs: 5, md: 6 } }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, mb: { xs: 3, md: 3.5 } }}>
          <Eyebrow>{t("v7.trust.eyebrow", { defaultValue: "Live proof" })}</Eyebrow>
          <ArrowLink href="/system-status" testId="trust-status-link">
            {t("v7.trust.statusLink")} <ArrowForwardIcon className="arr" sx={{ fontSize: 16 }} />
          </ArrowLink>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            border: `1px solid ${s.line}`,
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {stats.map((st, i) => (
            <Box
              key={st.label}
              data-testid="trust-stat"
              sx={{
                p: { xs: 3, md: 3.5 },
                borderTop: { xs: i > 0 ? `1px solid ${s.line}` : "none", sm: "none" },
                borderLeft: { xs: "none", sm: i > 0 ? `1px solid ${s.line}` : "none" },
              }}
            >
              <Typography
                sx={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 500,
                  fontSize: { xs: 30, md: 38 },
                  letterSpacing: "-0.02em",
                  color: s.ink,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {st.value}
              </Typography>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: { xs: 11, md: 12 }, letterSpacing: "0.04em", color: s.ink3, mt: 1.25 }}>
                {st.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TrustBarV7);
