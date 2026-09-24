import React, { memo } from "react";
import { Box } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useTranslation } from "react-i18next";
import { CoinDot, Label, Panel, Pill, Strong, Text, VigFrame, useVig } from "./primitives";

/** Hosted checkout — the phone-sized pay sheet plus the 3-step status timeline. */
const CheckoutVignette: React.FC = () => {
  const v = useVig();
  const { t } = useTranslation("landing");
  const steps = [t("v6.vig.detected"), t("v6.vig.confirming"), t("v6.vig.paidStep")];
  return (
    <VigFrame height={300} testId="vignette-checkout">
      <Panel sx={{ left: 18, top: 18, bottom: -30, width: 212, p: 1.75, borderRadius: "22px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>Acme Store</Label>
          <Label sx={{ color: "#10B981" }}>{t("v6.vig.settlesIn")}</Label>
        </Box>
        <Strong size={28} sx={{ mt: 1 }}>$49.00</Strong>
        <Label sx={{ mt: 1.75 }}>{t("v6.vig.chooseCoin")}</Label>
        <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", mt: 0.9 }}>
          <Pill active sx={{ px: 0.9, fontSize: 11.5 }}><CoinDot icon="cryptocurrency-color:usdt" size={15} /> USDT</Pill>
          <Pill sx={{ px: 0.9, fontSize: 11.5 }}><CoinDot icon="cryptocurrency-color:btc" size={15} /> BTC</Pill>
          <Pill sx={{ px: 0.9, fontSize: 11.5 }}><CoinDot icon="cryptocurrency-color:eth" size={15} /> ETH</Pill>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, mt: 1.75, alignItems: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Label>{t("v6.vig.sendExactly")}</Label>
            <Strong size={14.5} sx={{ mt: 0.4, fontFamily: "var(--font-tech)" }}>49.00 USDT</Strong>
          </Box>
          <Box sx={{ p: 0.5, borderRadius: "10px", background: "#fff", lineHeight: 0 }}><QRCodeSVG value="https://dynopay.com/pay/demo" size={46} level="L" fgColor="#0A0A0A" /></Box>
        </Box>
        <Box sx={{ mt: 1.75, py: 1.1, borderRadius: 999, textAlign: "center", background: "#FFD100", color: "#121214", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13.5 }}>{t("v6.vig.pay")} $49.00</Box>
      </Panel>
      {/* status timeline */}
      <Panel lift={false} sx={{ left: 248, right: 18, top: 34, p: 1.5, transition: "transform 600ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: "translateY(-8px)" } }}>
        {steps.map((st, i) => (
          <Box key={st} sx={{ display: "flex", alignItems: "center", gap: 1.1, py: 0.6 }}>
            <Box sx={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", background: i < 2 ? "#10B981" : v.s.dark ? "rgba(255,255,255,0.1)" : "#E4E4E7", color: "#121214", border: i === 2 ? "2px solid #FFD100" : "none", boxSizing: "border-box" }}>
              {i < 2 ? <CheckRoundedIcon sx={{ fontSize: 12 }} /> : null}
            </Box>
            <Text size={12.5} sx={{ color: i === 2 ? v.s.ink : v.s.ink2, fontWeight: i === 2 ? 600 : 400 }}>{st}</Text>
          </Box>
        ))}
        <Label sx={{ mt: 0.75, textTransform: "none", letterSpacing: 0 }}>2/3 · ~1 min</Label>
      </Panel>
      <Box sx={{ position: "absolute", left: 248, right: 18, bottom: 22, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {["EN", "DE", "ES", "FR", "PT", "NL"].map((l) => <Pill key={l} sx={{ px: 0.8, py: 0.2, fontSize: 10.5 }}>{l}</Pill>)}
      </Box>
    </VigFrame>
  );
};

export default memo(CheckoutVignette);
