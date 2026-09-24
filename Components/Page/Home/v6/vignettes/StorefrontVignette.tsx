import React, { memo } from "react";
import { Box } from "@mui/material";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useTranslation } from "react-i18next";
import { Label, Panel, Pill, Strong, Text, VigFrame, useVig } from "./primitives";

const ITEMS = [
  { name: "Icon pack · 240", price: "$29", bg: "linear-gradient(135deg,#FFD100,#FFB300)" },
  { name: "Figma UI kit", price: "$79", bg: "linear-gradient(135deg,#0EA5E9,#34D399)" },
  { name: "1:1 review call", price: "$150", bg: "linear-gradient(135deg,#F59E0B,#EF4444)" },
];

/** Storefront — a creator page header and three product tiles with a live cart. */
const StorefrontVignette: React.FC = () => {
  const v = useVig();
  const { t } = useTranslation("landing");
  return (
    <VigFrame testId="vignette-storefront">
      <Panel sx={{ left: 18, right: 18, top: 18, bottom: -24, p: 1.75, borderRadius: "18px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#FFB300,#34D399)" }} />
          <Box sx={{ flex: 1 }}>
            <Strong size={14}>Studio Nord</Strong>
            <Label sx={{ textTransform: "none", letterSpacing: 0, fontSize: 11 }}>dynopay.com/studionord</Label>
          </Box>
          <Pill active sx={{ gap: 0.5 }}><Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} /> {t("v6.vig.live")}</Pill>
          <Box sx={{ position: "relative", width: 30, height: 30, borderRadius: "10px", display: "grid", placeItems: "center", background: v.s.dark ? "rgba(255,255,255,0.06)" : "#F4F4F5", color: v.s.ink }}>
            <ShoppingBagRoundedIcon sx={{ fontSize: 16 }} />
            <Box sx={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "#FFD100", color: "#121214", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", fontFamily: "var(--font-body)" }}>2</Box>
          </Box>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.25, mt: 1.75 }}>
          {ITEMS.map((it, i) => (
            <Box key={it.name} sx={{ borderRadius: "12px", border: `1px solid ${v.s.line}`, overflow: "hidden", transition: "transform 500ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: `translateY(${-4 - i * 3}px)` } }}>
              <Box sx={{ height: 62, background: it.bg }} />
              <Box sx={{ p: 1 }}>
                <Text size={11.5} sx={{ color: v.s.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</Text>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 0.4 }}>
                  <Strong size={12.5}>{it.price}</Strong>
                  <Box title={t("v6.vig.addToCart")} sx={{ width: 20, height: 20, borderRadius: "50%", background: "#FFD100", color: "#121214", display: "grid", placeItems: "center" }}><AddRoundedIcon sx={{ fontSize: 14 }} /></Box>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Panel>
    </VigFrame>
  );
};

export default memo(StorefrontVignette);
