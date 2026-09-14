import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { CRYPTO_INFO } from "@/Components/Page/Pay3Components/checkout/checkoutConstants";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Compact grid of every supported code (the checkout catalogue is the single source of truth). */
const CoinsV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const codes = Object.keys(CRYPTO_INFO);
  const wallets = [
    { name: "MetaMask", icon: "logos:metamask-icon" },
    { name: "Phantom", icon: "token-branded:phantom" },
    { name: "Trust", icon: "token-branded:trust" },
    { name: "Coinbase", icon: "token-branded:coinbase" },
    { name: "Ledger", icon: "token-branded:ledger" },
    { name: "WalletConnect", icon: "simple-icons:walletconnect", color: "#3B99FC" },
  ];
  return (
    <Section id="coins" alt testId="coins">
      <SectionHead eyebrow={t("v5.coins.eyebrow")} headline={t("v5.coins.headline", { coins: codes.length })} body={t("v5.coins.body")} />
      <Stagger step={0.03} data-testid="coins-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" }, gap: 1.25 }}>
        {codes.map((code, i) => {
          const c = CRYPTO_INFO[code];
          return (
            <StaggerItem key={code} i={i} y={12}>
            <Box data-testid={`coin-${code}`} sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25, borderRadius: "14px", background: s.surface, border: `1px solid ${s.line}`, transition: "border-color 200ms ease, transform 200ms cubic-bezier(0.2,0.8,0.2,1)", "&:hover": { borderColor: s.lineStrong, transform: "translateY(-2px)" } }}>
              <Box sx={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", border: `1px solid ${s.line}`, flexShrink: 0 }}>
                <Icon icon={c.icon} width={20} height={20} color={c.iconColor} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 14, color: s.ink, lineHeight: 1.1 }}>{c.symbol}</Typography>
                <Typography noWrap sx={{ fontFamily: FONT_TECH, fontSize: 10.5, color: s.ink3, letterSpacing: "0.04em", mt: 0.3 }}>{c.networkLabel}</Typography>
              </Box>
            </Box>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* Pay from any wallet — open wallets a buyer can send from (not customer logos). */}
      <Box data-testid="wallets-strip" sx={{ mt: { xs: 5, md: 6 }, pt: { xs: 4, md: 5 }, borderTop: `1px solid ${s.line}`, display: "grid", gridTemplateColumns: { xs: "1fr", md: "auto 1fr" }, gap: { xs: 2.5, md: 5 }, alignItems: "center" }}>
        <Box>
          <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: s.ink, letterSpacing: "-0.015em", mb: 0.5 }}>{t("v5.wallets.title")}</Typography>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.5, color: s.ink2, maxWidth: 320 }}>{t("v5.wallets.sub")}</Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, justifyContent: { xs: "flex-start", md: "flex-end" } }}>
          {wallets.map((w) => (
            <Box key={w.name} data-testid={`wallet-${w.name.toLowerCase()}`} sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.5, py: 0.9, borderRadius: "999px", background: s.surface, border: `1px solid ${s.line}`, transition: "transform 180ms ease, border-color 180ms ease", "&:hover": { transform: "translateY(-2px)", borderColor: s.lineStrong } }}>
              <Icon icon={w.icon} width={18} height={18} color={w.color} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: s.ink2, whiteSpace: "nowrap" }}>{w.name}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box component="a" href="/fees" data-testid="coins-fees-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 3, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: s.dark ? "#818CF8" : BRAND_ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
        {t("v5.coins.cta")} <ArrowForwardIcon sx={{ fontSize: 16 }} />
      </Box>
    </Section>
  );
};

export default memo(CoinsV5);
