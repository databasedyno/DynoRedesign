import React, { memo } from "react";
import { Box } from "@mui/material";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { useTranslation } from "react-i18next";
import { Label, Panel, Pill, Strong, Text, VigFrame, useVig } from "./primitives";

/** Donations & tips — a tip jar with preset amounts and a monthly goal bar. */
const DonationsVignette: React.FC = () => {
  const v = useVig();
  const { t } = useTranslation("landing");
  return (
    <VigFrame testId="vignette-donations">
      <Panel sx={{ left: 18, right: 18, top: 18, bottom: -30, p: 1.75, borderRadius: "18px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#F472B6,#FFB300)" }} />
          <Box sx={{ flex: 1 }}>
            <Strong size={14}>{t("v6.vig.support", { name: "Maya" })}</Strong>
            <Label sx={{ textTransform: "none", letterSpacing: 0, fontSize: 11 }}>{t("v6.vig.donors", { n: 128 })}</Label>
          </Box>
          <FavoriteRoundedIcon sx={{ fontSize: 20, color: "#F43F5E", transition: "transform 400ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: "scale(1.25)" } }} />
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, mt: 1.75 }}>
          {["$5", "$10", "$25", "$50"].map((a, i) => <Pill key={a} active={i === 2} sx={{ flex: 1, justifyContent: "center", py: 0.7, fontSize: 13 }}>{a}</Pill>)}
        </Box>
        <Box sx={{ mt: 1.75 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.6 }}>
            <Text size={12} sx={{ color: v.s.ink, fontWeight: 600 }}>{t("v6.vig.monthlyGoal", { pct: 68 })}</Text>
            <Label sx={{ textTransform: "none", letterSpacing: 0 }}>$340 / $500</Label>
          </Box>
          <Box sx={{ height: 8, borderRadius: 999, background: v.s.dark ? "rgba(255,255,255,0.08)" : "#EEEEF2", overflow: "hidden" }}>
            <Box sx={{ width: "68%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#F0C300,#34D399)", transition: "width 900ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { width: "74%" } }} />
          </Box>
        </Box>
        <Box sx={{ mt: 1.75, py: 1, borderRadius: 999, textAlign: "center", background: v.s.ink, color: v.s.dark ? "#0A0A0A" : "#fff", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13 }}>{t("v6.vig.tip")} $25</Box>
      </Panel>
    </VigFrame>
  );
};

export default memo(DonationsVignette);
