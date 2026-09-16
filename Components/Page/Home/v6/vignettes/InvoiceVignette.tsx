import React, { memo } from "react";
import { Box } from "@mui/material";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import { useTranslation } from "react-i18next";
import { Label, Panel, Pill, Strong, Text, VigFrame, useVig } from "./primitives";

const LINES = [["Brand identity", "$2,400.00"], ["Landing page", "$1,800.00"], ["VAT 23%", "$966.00"]];

/** Invoices — a document with line items, the tax line, and the paid stamp + receipt. */
const InvoiceVignette: React.FC = () => {
  const v = useVig();
  const { t } = useTranslation("landing");
  return (
    <VigFrame testId="vignette-invoices">
      <Panel sx={{ left: 18, right: 18, top: 18, bottom: -40, p: 1.75, borderRadius: "14px 14px 0 0" }}>
        <Box sx={{ pr: 10 }}>
          <Label>{t("v6.vig.invoice")} · INV-0042</Label>
          <Strong size={14} sx={{ mt: 0.4 }}>Studio Nord → Lumen GmbH</Strong>
          <Label sx={{ mt: 0.4 }}>{t("v6.vig.due")} · 30 Jun</Label>
        </Box>
        <Box sx={{ mt: 1.25 }}>
          {LINES.map(([k, val]) => (
            <Box key={k} sx={{ display: "flex", justifyContent: "space-between", py: 0.55, borderTop: `1px solid ${v.s.line}` }}>
              <Text size={12}>{k}</Text>
              <Text size={12} sx={{ fontFamily: "var(--font-tech)" }}>{val}</Text>
            </Box>
          ))}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 0.8, borderTop: `1px solid ${v.s.lineStrong}` }}>
            <Text size={12} sx={{ fontWeight: 600, color: v.s.ink }}>{t("v6.vig.total")} · {t("v6.vig.taxIncl")}</Text>
            <Strong size={15}>$5,166.00</Strong>
          </Box>
        </Box>
      </Panel>
      {/* paid stamp — top-right corner of the document, clear of the totals */}
      <Box sx={{ position: "absolute", right: 26, top: 24, px: 1.25, py: 0.5, borderRadius: 8, border: "2px solid #10B981", color: "#10B981", fontFamily: "var(--font-tech)", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", transform: "rotate(6deg)", background: v.panel, boxShadow: v.shadow, transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: "rotate(4deg) scale(1.08)" } }}>
        {t("v6.vig.paidIn", { coin: "ETH" })}
      </Box>
      <Pill active sx={{ position: "absolute", left: 30, bottom: 18, gap: 0.75, background: v.panel, boxShadow: v.shadow }}>
        <PictureAsPdfRoundedIcon sx={{ fontSize: 15 }} /> {t("v6.vig.receipt")}
      </Pill>
    </VigFrame>
  );
};

export default memo(InvoiceVignette);
