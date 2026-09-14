import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { CRYPTO_INFO, NETWORK_ETA } from "@/Components/Page/Pay3Components/checkout/checkoutConstants";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { PrimaryBtn, Section, SectionHead, goStart } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** One chip per network, text straight from the checkout's NETWORK_ETA so the two never disagree. */
const ETA_ORDER = ["SOL", "XRP", "USDT-TRC20", "POLYGON", "ETH", "LTC", "DOGE", "BCH", "BTC"] as const;

export const NetworkEtaRow: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Box data-testid="network-eta-row">
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3, mb: 1.5 }}>{t("v5.how.etaLabel")}</Typography>
      <Stagger step={0.04} sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {ETA_ORDER.map((code, i) => {
          const info = CRYPTO_INFO[code];
          return (
            <StaggerItem key={code} i={i} y={10}>
            <Box data-testid={`eta-${info.network}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, px: 1.4, py: 0.7, borderRadius: "999px", border: `1px solid ${s.line}`, background: s.surface, transition: "border-color 200ms ease, transform 200ms cubic-bezier(0.2,0.8,0.2,1)", "&:hover": { borderColor: s.lineStrong, transform: "translateY(-2px)" } }}>
              <Icon icon={info.icon} width={16} height={16} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: s.ink }}>{info.networkLabel}</Typography>
              <Typography className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink3 }}>{t(`v5.eta.${info.network}`, { defaultValue: NETWORK_ETA[info.network] })}</Typography>
            </Box>
            </StaggerItem>
          );
        })}
      </Stagger>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: s.ink3, mt: 1.5 }}>{t("v5.how.etaNote")}</Typography>
    </Box>
  );
};

const HowItWorksV5: React.FC = () => {
  const s = useAurora();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const STEPS = [
    { Icon: QrCode2RoundedIcon, title: t("v5.how.s1t"), desc: t("v5.how.s1d") },
    { Icon: SwapHorizRoundedIcon, title: t("v5.how.s2t"), desc: t("v5.how.s2d") },
    { Icon: AccountBalanceWalletRoundedIcon, title: t("v5.how.s3t"), desc: t("v5.how.s3d") },
  ];
  return (
    <Section id="how-it-works" testId="how-it-works">
      <SectionHead eyebrow={t("v5.how.eyebrow")} headline={t("v5.how.headline")} body={t("v5.how.body")} />
      <Stagger step={0.1} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {STEPS.map((st, i) => (
          <StaggerItem key={i} i={i} y={22}>
          <Box data-testid={`how-step-${i + 1}`} sx={{ position: "relative", borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 3, md: 3.5 }, transition: "transform 240ms cubic-bezier(0.16,1,0.3,1), border-color 240ms ease, box-shadow 240ms ease", "&:hover": { transform: "translateY(-3px)", borderColor: `${BRAND_ACCENT}55`, boxShadow: `0 24px 48px -32px ${BRAND_ACCENT}66` } }}>
            <Typography aria-hidden sx={{ position: "absolute", top: 14, right: 20, fontFamily: FONT_HERO, fontWeight: 700, fontSize: 64, lineHeight: 1, color: s.dark ? "rgba(255,255,255,0.04)" : "rgba(10,10,10,0.04)", letterSpacing: "-0.04em" }}>0{i + 1}</Typography>
            <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: s.dark ? "#818CF8" : BRAND_ACCENT, mb: 2.5 }}>
              <st.Icon sx={{ fontSize: 22 }} />
            </Box>
            <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 19, md: 21 }, letterSpacing: "-0.02em", color: s.ink, mb: 1.25 }}>{st.title}</Typography>
            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.55, color: s.ink2 }}>{st.desc}</Typography>
          </Box>
          </StaggerItem>
        ))}
      </Stagger>

      <Box sx={{ mt: { xs: 5, md: 6 }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: { xs: 4, lg: 6 }, alignItems: "start" }}>
        <NetworkEtaRow />
        <Box data-testid="wallet-line" sx={{ borderRadius: "16px", border: `1px dashed ${s.lineStrong}`, p: 2.5 }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink, fontWeight: 600 }}>{t("v5.how.walletLine")}</Typography>
          <Box component="a" href="/how-to" data-testid="wallet-guide-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 1, fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.dark ? "#818CF8" : BRAND_ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            {t("v5.how.walletCta")} <ArrowForwardIcon sx={{ fontSize: 15 }} />
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 5, md: 6 } }}>
        <PrimaryBtn data-testid="how-it-works-cta" onClick={() => goStart(router, "how_it_works")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>{t("v5.hero.primary")}</PrimaryBtn>
      </Box>
    </Section>
  );
};

export default memo(HowItWorksV5);
