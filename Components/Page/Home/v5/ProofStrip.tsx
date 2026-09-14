import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { FONT_TECH, FONT_HERO, useAurora } from "../v3/theme.v3";
import { floor5, useLandingMetrics } from "./useLandingMetrics";
import { CountUp } from "../motion/CountUp";

export const CHAINS: { icon: string; label: string }[] = [
  { icon: "cryptocurrency-color:btc", label: "Bitcoin" },
  { icon: "cryptocurrency-color:eth", label: "Ethereum" },
  { icon: "cryptocurrency-color:sol", label: "Solana" },
  { icon: "cryptocurrency-color:xrp", label: "XRP Ledger" },
  { icon: "cryptocurrency-color:trx", label: "Tron" },
  { icon: "cryptocurrency-color:ltc", label: "Litecoin" },
  { icon: "cryptocurrency-color:doge", label: "Dogecoin" },
  { icon: "cryptocurrency-color:bch", label: "Bitcoin Cash" },
  { icon: "cryptocurrency-color:matic", label: "Polygon" },
];

/** Live reliability numbers under the hero: uptime · median settle · settled this month · countries, plus the nine chains. Numbers count up on first view. */
const ProofStrip: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const settleMin = m?.median_settle_minutes_fast != null ? Math.max(1, Math.round(m.median_settle_minutes_fast)) : null;
  const stats = [
    { id: "uptime", to: m ? m.uptime_90d_pct : null, render: (n: number) => `${n.toFixed(2)}%`, label: t("v5.proof.uptime") },
    { id: "settle", to: settleMin, render: (n: number) => t("v5.proof.minutes", { n: Math.max(1, Math.round(n)) }), label: t("v5.proof.settle") },
    { id: "month", to: m ? m.payments_settled_this_month : null, render: (n: number) => Math.round(n).toLocaleString(), label: t("v5.proof.month") },
    { id: "countries", to: m ? floor5(m.countries_served) : null, render: (n: number) => `${Math.round(n)}+`, label: t("v5.proof.countries") },
  ];

  return (
    <Box data-testid="proof-strip" data-loaded={m ? "true" : "false"} sx={{ mt: { xs: 7, md: 10 }, pt: { xs: 4, md: 5 }, borderTop: `1px solid ${s.line}`, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr auto" }, gap: { xs: 4, lg: 6 }, alignItems: "center" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, auto)" }, gap: { xs: 3, md: 5 } }}>
        {stats.map((st) => (
          <Box key={st.id} data-testid={`proof-${st.id}`}>
            <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 24, md: 28 }, letterSpacing: "-0.03em", lineHeight: 1, color: s.ink, minHeight: 28 }}>
              <CountUp to={st.to} render={st.render} />
            </Typography>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3, mt: 0.9 }}>{st.label}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3, mr: 0.5 }}>{t("v5.proof.chains")}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {CHAINS.map((c) => (
            <Box key={c.label} component="a" href="/fees" aria-label={c.label} title={c.label} data-testid={`proof-chain-${c.label.toLowerCase().replace(/\s+/g, "-")}`} sx={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: `1px solid ${s.line}`, transition: "transform 160ms ease", "&:hover": { transform: "translateY(-2px)" } }}>
              <Icon icon={c.icon} width={18} height={18} />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ProofStrip);
