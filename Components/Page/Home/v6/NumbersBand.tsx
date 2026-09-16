import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH } from "../v3/theme.v3";
import { CountUp } from "../motion/CountUp";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { LiveDot } from "../motion/accents";
import { floor5, formatInt, useLandingMetrics } from "../v5/useLandingMetrics";
import { CHAINS } from "./LiveStrip";

const BAND = "#1E1B4B";
const INK = "#F5F5FF";
const INK2 = "rgba(245,245,255,0.72)";
const INK3 = "rgba(245,245,255,0.55)";
const LINE = "rgba(255,255,255,0.12)";

const chainIcon = (label: string) => CHAINS.find((c) => c.label === label)?.icon;

/** Settled payments by chain, last 30 days — shares only (counts stay private), read from the same server-seeded metrics. */
const ChainBars: React.FC = () => {
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const rows = m?.settled_by_chain_30d ?? [];
  const total = rows.reduce((a, r) => a + r.count, 0);
  const max = rows[0]?.count || 1;
  return (
    <Box data-testid="chain-bars" data-loaded={rows.length ? "true" : "false"} sx={{ borderRadius: "24px", p: { xs: 2.5, md: 3.25 }, background: "rgba(255,255,255,0.05)", border: `1px solid ${LINE}`, backdropFilter: "blur(12px)", minHeight: 320 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, mb: 3 }}>
        <Box>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, letterSpacing: "-0.015em", color: INK }}>{t("v6.numbers.chartTitle")}</Typography>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: INK3, mt: 0.5 }}>{t("v6.numbers.chartSub")}</Typography>
        </Box>
        <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.8, fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6EE7B7", whiteSpace: "nowrap" }}><LiveDot color="#34D399" /> {t("v6.numbers.live")}</Typography>
      </Box>
      <Stagger step={0.07} sx={{ display: "grid", gap: 1.75 }}>
        {rows.map((r, i) => {
          const share = total ? Math.round((r.count / total) * 100) : 0;
          const icon = chainIcon(r.chain);
          return (
            <StaggerItem key={r.chain} i={i} y={8}>
              <Box data-testid={`chain-bar-${r.chain.toLowerCase().replace(/\s+/g, "-")}`} sx={{ display: "grid", gridTemplateColumns: "26px 1fr 48px", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" }}>{icon ? <Icon icon={icon} width={16} height={16} /> : <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: "#A5B4FC" }} />}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: INK, mb: 0.6 }}>{r.chain === "Other" ? t("v6.numbers.other") : r.chain}</Typography>
                  <Box sx={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <Box sx={{ height: "100%", width: `${Math.max(3, (r.count / max) * 100)}%`, borderRadius: 999, background: i === 0 ? "linear-gradient(90deg, #A5B4FC, #6EE7B7)" : "linear-gradient(90deg, #818CF8, #A5B4FC)" }} />
                  </Box>
                </Box>
                <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 13, fontWeight: 700, color: INK, textAlign: "right" }}>{share}%</Typography>
              </Box>
            </StaggerItem>
          );
        })}
      </Stagger>
      {!rows.length ? <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: INK3 }}>—</Typography> : null}
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: INK3, mt: 3, lineHeight: 1.5 }}>{t("v6.numbers.chartNote")}</Typography>
    </Box>
  );
};

/** §2.3-5 Numbers band — four live stats + settlements-by-chain, on the deep-navy brand band. Every number is server-rendered. */
const NumbersBand: React.FC = () => {
  const { t, i18n } = useTranslation("landing");
  const m = useLandingMetrics();
  const settleMin = m?.median_settle_minutes_fast != null ? Math.max(1, Math.round(m.median_settle_minutes_fast)) : null;
  const stats = [
    { id: "uptime", to: m ? m.uptime_90d_pct : null, render: (n: number) => `${n.toFixed(2)}%`, label: t("v5.proof.uptime"), meta: m?.uptime_checks ? t("v6.numbers.checks", { n: formatInt(m.uptime_checks, i18n.language) }) : null },
    { id: "settle", to: settleMin, render: (n: number) => t("v5.proof.minutes", { n: Math.max(1, Math.round(n)) }), label: t("v5.proof.settle"), meta: t("v6.numbers.settleMeta") },
    { id: "month", to: m ? m.payments_settled_this_month : null, render: (n: number) => formatInt(n, i18n.language), label: t("v5.proof.month"), meta: null },
    { id: "countries", to: m ? floor5(m.countries_served) : null, render: (n: number) => `${Math.round(n)}+`, label: t("v5.proof.countries"), meta: t("v6.numbers.countriesMeta") },
  ];
  return (
    <Box component="section" id="numbers" data-testid="numbers-band" sx={{ position: "relative", overflow: "hidden", background: BAND, py: { xs: 9, md: 13 } }}>
      <Box aria-hidden sx={{ position: "absolute", top: "-40%", right: "-10%", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0.18) 35%, transparent 70%)", pointerEvents: "none" }} />
      <Box aria-hidden sx={{ position: "absolute", bottom: "-50%", left: "-10%", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.22) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Box sx={{ position: "relative", maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.05fr 0.95fr" }, gap: { xs: 6, lg: 8 }, alignItems: "center" }}>
        <Box>
          <Stagger step={0.09} sx={{ maxWidth: 560, mb: { xs: 5, md: 6 } }}>
            <StaggerItem i={0} y={12}><Typography component="p" sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#A5B4FC", mb: 2 }}>{t("v6.numbers.eyebrow")}</Typography></StaggerItem>
            <StaggerItem i={1} y={16}><Typography component="h2" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.02, letterSpacing: "-0.03em", color: INK }}>{t("v6.numbers.headline")}</Typography></StaggerItem>
            <StaggerItem i={2} y={14}><Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 16, md: 17.5 }, lineHeight: 1.55, color: INK2, mt: 2.5 }}>{t("v6.numbers.body")}</Typography></StaggerItem>
          </Stagger>
          <Stagger step={0.08} base={0.1} data-testid="numbers-stats" sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: { xs: 3, md: 4 }, rowGap: { xs: 4, md: 5 } }}>
            {stats.map((st, i) => (
              <StaggerItem key={st.id} i={i} y={16}>
                <Box data-testid={`numbers-${st.id}`} sx={{ borderLeft: `2px solid ${LINE}`, pl: 2.25 }}>
                  <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 34, md: 46 }, letterSpacing: "-0.04em", lineHeight: 1, color: INK, minHeight: { xs: 34, md: 46 } }}>
                    <CountUp to={st.to} render={st.render} />
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: INK2, mt: 1.25 }}>{st.label}</Typography>
                  {st.meta ? <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.06em", color: INK3, mt: 0.5 }}>{st.meta}</Typography> : null}
                </Box>
              </StaggerItem>
            ))}
          </Stagger>
          <Box component="a" href="/system-status" data-testid="numbers-status-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: { xs: 4, md: 5 }, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: "#A5B4FC", textDecoration: "none", "&:hover": { color: INK } }}>
            {t("v5.open.statusCta")} <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
        <ChainBars />
      </Box>
    </Box>
  );
};

export default memo(NumbersBand);
