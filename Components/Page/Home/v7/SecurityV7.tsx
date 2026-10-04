import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { ArrowLink, FONT_BODY, FONT_DISPLAY, Section, SectionHead, cardSx, useConsole } from "./kit";

/**
 * Section 5 — SECURITY & COMPLIANCE ("Can I trust it with money?").
 * Four verifiable trust pillars (non-custodial settlement, KYC/AML above
 * threshold, hardened encrypted key infrastructure, public uptime).
 */
const PILLARS = [
  { Icon: ShieldRoundedIcon, key: "noncustodial", title: "Non-custodial by design", body: "Settled funds go straight to the wallet you control. Dynopay never holds your balance in between." },
  { Icon: VerifiedUserRoundedIcon, key: "compliance", title: "KYC & AML built in", body: "Identity and anti-money-laundering checks run on merchants above regulatory thresholds, keeping your account in good standing." },
  { Icon: KeyRoundedIcon, key: "keys", title: "Hardened key infrastructure", body: "Wallet keys are encrypted and isolated. Signing happens in a protected environment — never in the browser." },
  { Icon: MonitorHeartRoundedIcon, key: "uptime", title: "Verifiable uptime", body: "A public status page and continuous monitoring mean you can always see that payments and settlement are healthy." },
];

const SecurityV7: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  return (
    <Section id="security" testId="security" alt>
      <SectionHead
        eyebrow={t("v7.security.eyebrow", { defaultValue: "Security & compliance" })}
        title={t("v7.security.headline", { defaultValue: "Built to be trusted with money" })}
        lead={t("v7.security.body", { defaultValue: "Funds move on rails you can verify — not held on a balance you can't see." })}
        testId="security-head"
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
        {PILLARS.map(({ Icon, key, title, body }) => (
          <Box key={key} data-testid={`security-${key}`} sx={{ ...cardSx(s, { hover: false }), background: s.canvas, display: "flex", gap: 2.5, p: { xs: 3, md: 3.5 } }}>
            <Box sx={{ width: 42, height: 42, minWidth: 42, borderRadius: "10px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent }}>
              <Icon sx={{ fontSize: 21 }} />
            </Box>
            <Box>
              <Typography component="h3" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: { xs: 17, md: 18.5 }, letterSpacing: "-0.01em", color: s.ink, mb: 1 }}>
                {t(`v7.security.${key}.title`, { defaultValue: title })}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>
                {t(`v7.security.${key}.body`, { defaultValue: body })}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 2, md: 4 }, mt: { xs: 3, md: 4 } }}>
        <ArrowLink href="/system-status" testId="security-status-link">
          {t("v7.trust.statusLink")} <ArrowForwardIcon className="arr" sx={{ fontSize: 16 }} />
        </ArrowLink>
        <ArrowLink href="/wallet-security" testId="security-wallet-link">
          {t("v7.security.walletLink", { defaultValue: "Wallet security model" })} <ArrowForwardIcon className="arr" sx={{ fontSize: 16 }} />
        </ArrowLink>
      </Box>
    </Section>
  );
};

export default memo(SecurityV7);
