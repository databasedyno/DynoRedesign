import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import PhonelinkLockRoundedIcon from "@mui/icons-material/PhonelinkLockRounded";
import LockPersonRoundedIcon from "@mui/icons-material/LockPersonRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import WebhookRoundedIcon from "@mui/icons-material/WebhookRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import { FONT_BODY, FONT_HERO, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "./shared";
import { Stagger, StaggerItem } from "../motion/Stagger";
import { useLandingMetrics } from "./useLandingMetrics";

const ITEMS = [
  { id: "nonCustodial", Icon: AccountBalanceWalletRoundedIcon, href: "/wallet-security" },
  { id: "convert", Icon: SwapHorizRoundedIcon, href: "/fees" },
  { id: "refunds", Icon: ReplayRoundedIcon, href: "/help-support" },
  { id: "twofa", Icon: PhonelinkLockRoundedIcon, href: "/wallet-security" },
  { id: "walletLock", Icon: LockPersonRoundedIcon, href: "/wallet-security" },
  { id: "sessions", Icon: DevicesRoundedIcon, href: "/wallet-security" },
  { id: "webhooks", Icon: WebhookRoundedIcon, href: "/documentation" },
  { id: "kyc", Icon: VerifiedUserRoundedIcon, href: "/aml-policy" },
  { id: "status", Icon: MonitorHeartRoundedIcon, href: "/system-status" },
] as const;

/** The real controls (all shipped), replacing Why-Dynopay + refunds tab + badge row. */
const TrustSecurityV5: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const m = useLandingMetrics();
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  return (
    <Section id="security" testId="security">
      <SectionHead eyebrow={t("v5.security.eyebrow")} headline={t("v5.security.headline")} body={t("v5.security.body")} />
      <Stagger step={0.05} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: { xs: 1.5, md: 2 } }}>
        {ITEMS.map((it, i) => (
          <StaggerItem key={it.id} i={i} y={16}>
          <Box component="a" href={it.href} data-testid={`security-${it.id}`} sx={{ position: "relative", display: "flex", gap: 1.75, alignItems: "flex-start", textDecoration: "none", borderRadius: "18px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2.25, md: 2.75 }, transition: "border-color 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms ease", "&:hover": { borderColor: `${BRAND_ACCENT}55`, transform: "translateY(-2px)", boxShadow: `0 22px 44px -32px ${BRAND_ACCENT}66` }, "&:hover .sec-arrow": { opacity: 1, transform: "translate(0,0)" }, "&:focus-visible": { outline: `2px solid ${BRAND_ACCENT}`, outlineOffset: 3 } }}>
            <ArrowOutwardRoundedIcon className="sec-arrow" sx={{ position: "absolute", top: 14, right: 14, fontSize: 15, color: accent, opacity: 0, transform: "translate(-2px,2px)", transition: "opacity 200ms ease, transform 200ms ease" }} />
            <Box sx={{ flexShrink: 0, width: 38, height: 38, borderRadius: "11px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent }}>
              <it.Icon sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 15.5, color: s.ink, mb: 0.5, letterSpacing: "-0.01em" }}>
                {t(`v5.security.${it.id}.t`)}
                {it.id === "status" && m ? <Box component="span" className="tabular-nums" sx={{ ml: 1, fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, color: "#10B981" }}>{m.uptime_90d_pct.toFixed(2)}%</Box> : null}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, lineHeight: 1.5, color: s.ink2 }}>{t(`v5.security.${it.id}.d`)}</Typography>
            </Box>
          </Box>
          </StaggerItem>
        ))}
      </Stagger>
      <Box component="a" href="/system-status" data-testid="security-status-link" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 3.5, fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: 600, color: accent, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
        {t("v5.security.cta")} <ArrowOutwardRoundedIcon sx={{ fontSize: 16 }} />
      </Box>
    </Section>
  );
};

export default memo(TrustSecurityV5);
