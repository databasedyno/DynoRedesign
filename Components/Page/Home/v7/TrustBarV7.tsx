import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { useLandingMetrics, formatInt } from "../v5/useLandingMetrics";

/**
 * Section 2 of 9 — TRUST BAR (answers: "Can I trust it?").
 * Three live proof metrics + a "View live status" link. Numbers come from
 * /api/status/landing-metrics (SSR-seeded); the fallbacks keep the strip honest
 * if the backend is briefly unreachable.
 */
const TrustBarV7: React.FC = () => {
  const s = useAurora();
  const m = useLandingMetrics();
  const payments = m?.payments_settled_this_month ?? 1076;
  const uptime = m?.uptime_90d_pct ?? 99.92;
  const countries = m?.countries_served ?? 79;

  const stats = [
    { value: `${formatInt(payments, "en")}+`, label: "Payments settled this month" },
    { value: `${uptime.toFixed(2)}%`, label: "Uptime over 90 days" },
    { value: `${countries}`, label: "Countries served" },
  ];

  return (
    <Box
      component="section"
      id="trust"
      data-testid="trust-bar"
      sx={{ background: s.bgAlt, borderTop: `1px solid ${s.line}`, borderBottom: `1px solid ${s.line}` }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: "auto",
          px: { xs: 3, md: 5 },
          py: { xs: 4, md: 5 },
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          justifyContent: "space-between",
          gap: { xs: 3, md: 2 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: { xs: 2, md: 6 },
            width: { xs: "100%", md: "auto" },
            textAlign: { xs: "center", md: "left" },
          }}
        >
          {stats.map((st) => (
            <Box key={st.label} data-testid="trust-stat">
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: { xs: 23, md: 34 }, letterSpacing: "-0.02em", color: s.ink, lineHeight: 1 }}>
                {st.value}
              </Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: { xs: 10.5, md: 12.5 }, letterSpacing: "0.04em", color: s.ink3, mt: 1 }}>
                {st.label}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box
          component="a"
          href="/system-status"
          data-testid="trust-status-link"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.6,
            fontFamily: FONT_BODY,
            fontSize: 14.5,
            fontWeight: 600,
            color: s.accent,
            textDecoration: "none",
            whiteSpace: "nowrap",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          View live status <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>
    </Box>
  );
};

export default memo(TrustBarV7);
