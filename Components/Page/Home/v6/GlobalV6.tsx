import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { CRYPTO_INFO } from "@/Components/Page/Pay3Components/checkout/checkoutConstants";
import { FONT_BODY, FONT_HERO, FONT_TECH } from "../v3/theme.v3";
import { CountUp } from "../motion/CountUp";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { floor5, useLandingMetrics } from "../v5/useLandingMetrics";

const INK = "#F5F5F5";
const INK2 = "rgba(255,255,255,0.68)";
const INK3 = "rgba(255,255,255,0.5)";
const LINE = "rgba(255,255,255,0.10)";
const WALLETS = [
  { name: "MetaMask", icon: "logos:metamask-icon" },
  { name: "Phantom", icon: "token-branded:phantom" },
  { name: "Trust", icon: "token-branded:trust" },
  { name: "Coinbase", icon: "token-branded:coinbase" },
  { name: "Ledger", icon: "token-branded:ledger" },
  { name: "WalletConnect", icon: "simple-icons:walletconnect", color: "#3B99FC" },
];

/** §2.3-7 Global by default — world map + live country count, with the coins & chains grid and the wallets strip folded in. */
const GlobalV6: React.FC = () => {
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const countries = m ? floor5(m.countries_served) : null;
  const codes = Object.keys(CRYPTO_INFO);
  const claims = [t("v6.global.noList"), t("v6.global.noBank"), t("v6.global.anyWallet"), t("v5.global.walletLabel")];
  return (
    <Box component="section" id="coins" data-testid="global" sx={{ position: "relative", overflow: "hidden", background: "#0B0908", py: { xs: 9, md: 13 }, scrollMarginTop: "88px" }}>
      <Box aria-hidden sx={{ position: "absolute", inset: 0, backgroundImage: "url(/landing/world-map-dark.jpg)", backgroundSize: "cover", backgroundPosition: "center 30%", opacity: 0.45, maskImage: "radial-gradient(ellipse 80% 90% at 70% 30%, black 10%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 70% 30%, black 10%, transparent 75%)", pointerEvents: "none" }} />
      <Box aria-hidden sx={{ position: "absolute", top: "-20%", left: "-10%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,94,0,0.45) 0%, transparent 65%)", pointerEvents: "none" }} />
      <Box sx={{ position: "relative", maxWidth: 1280, mx: "auto", px: { xs: 3, md: 5 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: { xs: 6, lg: 8 }, alignItems: "end" }}>
          <Stagger step={0.09} sx={{ maxWidth: 560 }}>
            <StaggerItem i={0} y={12}>
              <Typography component="p" sx={{ display: "inline-flex", alignItems: "center", gap: 1, fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#FFD100", mb: 2.5 }}><PublicRoundedIcon sx={{ fontSize: 15 }} /> {t("v5.global.eyebrow")}</Typography>
            </StaggerItem>
            <StaggerItem i={1} y={16}>
              <Typography component="h2" className="tabular-nums" data-testid="global-headline" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 34, sm: 44, md: 56 }, letterSpacing: "-0.03em", lineHeight: 1.02, color: INK }}>
                <CountUp to={countries} render={(n) => t("v5.global.headline", { countries: Math.round(n) })} placeholder={t("v5.global.headline", { countries: 30 })} />
              </Typography>
            </StaggerItem>
            <StaggerItem i={2} y={14}><Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15.5, md: 17 }, lineHeight: 1.6, color: INK2, mt: 2.5, maxWidth: 500 }}>{t("v5.global.body")}</Typography></StaggerItem>
            <StaggerItem i={3} y={14}>
              <Box data-testid="global-claims" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25, mt: 4 }}>
                {claims.map((c) => (
                  <Box key={c} sx={{ display: "flex", alignItems: "center", gap: 1, color: INK }}>
                    <Box sx={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(52,211,153,0.18)", color: "#6EE7B7", display: "grid", placeItems: "center", flexShrink: 0 }}><CheckRoundedIcon sx={{ fontSize: 13 }} /></Box>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600 }}>{c}</Typography>
                  </Box>
                ))}
              </Box>
            </StaggerItem>
          </Stagger>

          <Box data-testid="coins-panel">
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, mb: 2 }}>
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, letterSpacing: "-0.015em", color: INK }}>{t("v5.coins.headline", { coins: codes.length })}</Typography>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: INK3, whiteSpace: "nowrap" }}>{t("v5.global.chainsLabel")}</Typography>
            </Box>
            <Stagger step={0.03} data-testid="coins-grid" sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" }, gap: 1 }}>
              {codes.map((code, i) => {
                const c = CRYPTO_INFO[code];
                return (
                  <StaggerItem key={code} i={i} y={10}>
                    <Box data-testid={`coin-${code}`} sx={{ display: "flex", alignItems: "center", gap: 1.1, px: 1.25, py: 1, borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, transition: "border-color 200ms ease, transform 200ms cubic-bezier(0.2,0.8,0.2,1), background-color 200ms ease", "&:hover": { borderColor: "rgba(255,255,255,0.22)", transform: "translateY(-2px)", background: "rgba(255,255,255,0.07)" } }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", flexShrink: 0 }}><Icon icon={c.icon} width={17} height={17} color={c.iconColor} /></Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 13, color: INK, lineHeight: 1.1 }}>{c.symbol}</Typography>
                        <Typography noWrap sx={{ fontFamily: FONT_TECH, fontSize: 10, color: INK3, letterSpacing: "0.04em", mt: 0.3 }}>{c.networkLabel}</Typography>
                      </Box>
                    </Box>
                  </StaggerItem>
                );
              })}
            </Stagger>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: INK3, mt: 2, lineHeight: 1.5 }}>{t("v5.coins.body")}</Typography>
          </Box>
        </Box>

        <Box data-testid="wallets-strip" sx={{ mt: { xs: 6, md: 8 }, pt: { xs: 4, md: 5 }, borderTop: `1px solid ${LINE}`, display: "grid", gridTemplateColumns: { xs: "1fr", md: "auto 1fr auto" }, gap: { xs: 2.5, md: 4 }, alignItems: "center" }}>
          <Box>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 16, color: INK, letterSpacing: "-0.015em", mb: 0.4 }}>{t("v5.wallets.title")}</Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.5, color: INK3, maxWidth: 320 }}>{t("v5.wallets.sub")}</Typography>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: { xs: "flex-start", md: "center" } }}>
            {WALLETS.map((w) => (
              <Box key={w.name} data-testid={`wallet-${w.name.toLowerCase()}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, px: 1.4, py: 0.8, borderRadius: "999px", background: "rgba(255,255,255,0.04)", border: `1px solid ${LINE}`, transition: "transform 180ms ease, border-color 180ms ease", "&:hover": { transform: "translateY(-2px)", borderColor: "rgba(255,255,255,0.24)" } }}>
                <Icon icon={w.icon} width={17} height={17} color={w.color} />
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: INK2, whiteSpace: "nowrap" }}>{w.name}</Typography>
              </Box>
            ))}
          </Box>
          <Box component="a" href="/fees" data-testid="coins-fees-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: "#FFD100", textDecoration: "none", whiteSpace: "nowrap", "&:hover": { color: INK } }}>
            {t("v5.coins.cta")} <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default memo(GlobalV6);
