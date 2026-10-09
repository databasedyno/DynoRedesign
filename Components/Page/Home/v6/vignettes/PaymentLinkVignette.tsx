import React, { memo } from "react";
import { Box } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useTranslation } from "react-i18next";
import { CoinDot, Label, Panel, Strong, Text, VigFrame, useVig } from "./primitives";

const COINS = ["cryptocurrency-color:btc", "cryptocurrency-color:eth", "cryptocurrency-color:sol", "cryptocurrency-color:usdt", "cryptocurrency-color:usdc"];

/** Payment links — a link card, its short URL + QR, and the settled receipt line. */
const PaymentLinkVignette: React.FC = () => {
  const v = useVig();
  const { t } = useTranslation("landing");
  return (
    <VigFrame height={300} testId="vignette-links">
      <Panel sx={{ left: 22, top: 22, width: 318, p: 2 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "12px", background: "linear-gradient(135deg, #FFD100, #FFB300 60%, #34D399)", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Strong size={14.5}>Design sprint</Strong>
            <Label sx={{ letterSpacing: "0.02em", textTransform: "none", fontSize: 11.5, mt: 0.3 }}>Studio Nord · {t("v6.vig.oneTime")}</Label>
          </Box>
          <Strong size={16}>$1,200</Strong>
        </Box>
        <Box sx={{ mt: 1.75, display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 0.8, borderRadius: 999, background: v.s.dark ? "rgba(255,255,255,0.05)" : "#F4F4F5", border: `1px solid ${v.s.line}` }}>
          <Text size={12.5} sx={{ fontFamily: "var(--font-tech)", flex: 1 }}>dynopay.com/rNtQRX</Text>
          <ContentCopyRoundedIcon sx={{ fontSize: 14, color: v.s.ink3 }} />
        </Box>
        <Box sx={{ mt: 1.5, display: "flex", gap: 0.75, alignItems: "center" }}>
          {COINS.map((ic) => <CoinDot key={ic} icon={ic} />)}
          <Label sx={{ textTransform: "none", letterSpacing: 0, ml: 0.5 }}>{t("v6.vig.more", { n: 10 })}</Label>
        </Box>
      </Panel>
      <Box sx={{ position: "absolute", right: 22, top: 30, p: 1.25, borderRadius: "14px", background: "#fff", boxShadow: "0 20px 40px -24px rgba(30,27,75,0.4)", transition: "transform 600ms cubic-bezier(0.16,1,0.3,1)", ".bento:hover &": { transform: "translateY(-10px) rotate(2deg)" } }}>
        <QRCodeSVG value="https://dynopay.com/rNtQRX" size={84} level="M" fgColor="#0A0A0A" title="Example payment QR code" />
      </Box>
      <Panel lift={false} sx={{ left: 22, right: 22, bottom: 20, display: "flex", alignItems: "center", gap: 1.25, px: 1.75, py: 1.25, borderRadius: "14px" }}>
        <Box sx={{ width: 26, height: 26, borderRadius: "50%", background: "#10B981", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}><CheckRoundedIcon sx={{ fontSize: 16 }} /></Box>
        <Text size={13.5} sx={{ color: v.s.ink, flex: 1 }}>
          {t("v6.vig.paid")} <b>0.0182 BTC</b> · {t("v6.vig.settledAs")} <b>1,194.20 USDC</b>
        </Text>
        <Label sx={{ textTransform: "none", letterSpacing: 0, whiteSpace: "nowrap" }}>4 min · {t("v6.vig.yourWallet")}</Label>
      </Panel>
    </VigFrame>
  );
};

export default memo(PaymentLinkVignette);
