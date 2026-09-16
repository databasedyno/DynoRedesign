import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import { FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { floor5, useLandingMetrics } from "../v5/useLandingMetrics";
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

/** "Settled through Dynopay — live": payments this month · uptime · median settle · countries, plus the nine chains. Every number is real and server-rendered. */
const LiveStrip: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const settleMin = m?.median_settle_minutes_fast != null ? Math.max(1, Math.round(m.median_settle_minutes_fast)) : null;
  const stats = [
    { id: "month", to: m ? m.payments_settled_this_month : null, render: (n: number) => Math.round(n).toLocaleString(), label: t("v5.proof.month") },
    { id: "uptime", to: m ? m.uptime_90d_pct : null, render: (n: number) => `${n.toFixed(2)}%`, label: t("v5.proof.uptime") },
    { id: "settle", to: settleMin, render: (n: number) => t("v5.proof.minutes", { n: Math.max(1, Math.round(n)) }), label: t("v5.proof.settle") },
    { id: "countries", to: m ? floor5(m.countries_served) : null, render: (n: number) => `${Math.round(n)}+`, label: t("v5.proof.countries") },
  ];
  return (
    <Box data-testid="proof-strip" data-loaded={m ? "true" : "false"} sx={{ mt: { xs: 7, md: 11 }, pt: { xs: 3.5, md: 4 }, borderTop: `1px solid ${s.line}`, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "auto 1fr auto" }, gap: { xs: 3, lg: 5 }, alignItems: "center" }}>
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: s.ink3, maxWidth: { lg: 170 }, lineHeight: 1.6 }}>{t("v6.hero.liveLabel")}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, auto)" }, gap: { xs: 3, md: 6 } }}>
        {stats.map((st) => (
          <Box key={st.id} data-testid={`proof-${st.id}`}>
            <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 26, md: 32 }, letterSpacing: "-0.035em", lineHeight: 1, color: s.ink, minHeight: 32 }}>
              <CountUp to={st.to} render={st.render} />
            </Typography>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: s.ink3, mt: 1 }}>{st.label}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        {CHAINS.map((c) => (
          <Box key={c.label} component="a" href="/fees" aria-label={c.label} title={c.label} data-testid={`proof-chain-${c.label.toLowerCase().replace(/\s+/g, "-")}`} sx={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: `1px solid ${s.line}`, transition: "transform 160ms ease", "&:hover": { transform: "translateY(-2px)" } }}>
            <Icon icon={c.icon} width={16} height={16} />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default memo(LiveStrip);
