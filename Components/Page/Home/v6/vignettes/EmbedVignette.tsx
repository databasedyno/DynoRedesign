import React, { memo } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Label, Panel, Strong, Text, VigFrame, useVig } from "./primitives";

const Code: React.FC<{ lines: React.ReactNode[] }> = ({ lines }) => (
  <Box component="pre" sx={{ m: 0, fontFamily: "var(--font-tech)", fontSize: 11, lineHeight: 1.7, color: "#D4D4D8", whiteSpace: "pre", overflow: "hidden" }}>
    {lines.map((l, i) => <Box key={i} component="span" sx={{ display: "block" }}>{l}</Box>)}
  </Box>
);
const K = ({ c }: { c: string }) => <Box component="span" sx={{ color: "#2BD4C4" }}>{c}</Box>;
const S = ({ c }: { c: string }) => <Box component="span" sx={{ color: "#6EE7B7" }}>{c}</Box>;
const A = ({ c }: { c: string }) => <Box component="span" sx={{ color: "#FCD34D" }}>{c}</Box>;

/** Embeds — the one-line snippet on the left renders the buy button on the right. */
const EmbedVignette: React.FC = () => {
  const v = useVig();
  const { t } = useTranslation("landing");
  return (
    <VigFrame testId="vignette-embeds">
      <Box sx={{ position: "absolute", left: 18, top: 18, bottom: 18, width: "60%", borderRadius: "14px", background: "#0B0B0F", border: "1px solid rgba(255,255,255,0.08)", p: 1.75, boxShadow: v.shadow }}>
        <Box sx={{ display: "flex", gap: 0.6, mb: 1.25 }}>{["#FF5F56", "#FFBD2E", "#27C93F"].map((c) => <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}</Box>
        <Code lines={[
          <><K c="<script" /> <A c="src" />=<S c='"dynopay.com/embed.js"' /></>,
          <>{"  "}<A c="data-link" />=<S c='"rNtQRX"' /></>,
          <>{"  "}<A c="data-label" />=<S c={`"${t("v6.vig.buyNow")} · $29"`} /><K c=">" /></>,
          <><K c="</script>" /></>,
        ]} />
        <Label sx={{ mt: 1.5, color: "rgba(255,255,255,0.45)", textTransform: "none", letterSpacing: 0 }}>{t("v6.vig.oneLine")}</Label>
      </Box>
      <Panel sx={{ right: 18, top: "50%", width: "34%", transform: "translateY(-50%)", p: 1.75, textAlign: "center", ".bento:hover &": { transform: "translateY(calc(-50% - 6px))" } }}>
        <Box sx={{ height: 54, borderRadius: "10px", background: "linear-gradient(135deg,#FFD100,#34D399)", mb: 1.25 }} />
        <Strong size={13}>Icon pack · 240</Strong>
        <Text size={11.5} sx={{ mb: 1.25 }}>SVG + Figma</Text>
        <Box sx={{ py: 0.9, borderRadius: 999, background: "#FFD100", color: "#2B1D14", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12.5, boxShadow: "0 10px 24px -12px rgba(15,143,134,0.8)" }}>{t("v6.vig.buyNow")} · $29</Box>
      </Panel>
    </VigFrame>
  );
};

export default memo(EmbedVignette);
