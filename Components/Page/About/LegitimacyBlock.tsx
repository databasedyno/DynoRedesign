import React from "react";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowOutwardRoundedIcon from "@mui/icons-material/ArrowOutwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead } from "@/Components/Page/Home/v5/shared";

const LEGAL_NAME = "Dynopay Payments Ltd.";
const CONTACT_EMAIL = "support@dynopay.com";
const SINCE = "2024";

const DOCS = [
  { key: "terms", href: "/terms-conditions" },
  { key: "privacy", href: "/privacy-policy" },
  { key: "aml", href: "/aml-policy" },
  { key: "status", href: "/system-status" },
];

/** "Who runs Dynopay" — the verifiable facts a buyer or partner looks for before trusting a checkout. */
const AboutLegitimacyBlock = () => {
  const { t } = useTranslation("landing");
  const s = useAurora();
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;

  const facts = [
    { Icon: BusinessRoundedIcon, label: t("about.legit.entity", { defaultValue: "Legal entity" }), value: LEGAL_NAME, testId: "about-legit-entity" },
    { Icon: VerifiedUserRoundedIcon, label: t("about.legit.since", { defaultValue: "Operating since" }), value: SINCE, testId: "about-legit-since" },
    { Icon: MailOutlineRoundedIcon, label: t("about.legit.contact", { defaultValue: "Contact" }), value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, testId: "about-legit-contact" },
    { Icon: AccountBalanceWalletRoundedIcon, label: t("about.legit.custody", { defaultValue: "Custody" }), value: t("about.legit.custodyValue", { defaultValue: "Non-custodial — funds go straight to the merchant" }), testId: "about-legit-custody" },
  ];

  return (
    <Section id="about-legitimacy" alt testId="about-legitimacy" sx={{ py: { xs: 7, md: 10 } }}>
      <SectionHead
        eyebrow={t("about.legit.eyebrow", { defaultValue: "Who runs Dynopay" })}
        headline={t("about.legit.title", { defaultValue: "Verifiable, on the record." })}
        body={t("about.legit.body", { defaultValue: "The facts a buyer or partner should be able to check before trusting a checkout page." })}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" }, gap: { xs: 2, md: 3 } }}>
        <Box sx={{ borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2.5, md: 3.5 } }} data-testid="about-legit-facts">
          {facts.map(({ Icon, label, value, href, testId }, i) => (
            <Box key={testId} data-testid={testId} sx={{ display: "flex", gap: 2, alignItems: "flex-start", py: 1.75, borderTop: i ? `1px dashed ${s.line}` : "none" }}>
              <Box sx={{ flexShrink: 0, width: 38, height: 38, borderRadius: "11px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent }}>
                <Icon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: s.ink3 }}>{label}</Typography>
                {href ? (
                  <Typography component="a" href={href} sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: accent, textDecoration: "none", "&:hover": { textDecoration: "underline" }, overflowWrap: "anywhere" }}>{value}</Typography>
                ) : (
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 17, color: s.ink, letterSpacing: "-0.01em" }}>{value}</Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
        <Box sx={{ borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2.5, md: 3.5 } }} data-testid="about-legit-docs">
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
            {t("about.legit.docsTitle", { defaultValue: "Policies & status" })}
          </Typography>
          {DOCS.map((d) => (
            <Link key={d.key} href={d.href} passHref legacyBehavior>
              <Box component="a" data-testid={`about-legit-doc-${d.key}`} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, py: 1.4, borderBottom: `1px dashed ${s.line}`, color: s.ink, textDecoration: "none", fontFamily: FONT_BODY, fontSize: 15, fontWeight: 600, "&:last-of-type": { borderBottom: "none" }, "&:hover": { color: accent } }}>
                {t(`about.legit.docs.${d.key}`, { defaultValue: { terms: "Terms & conditions", privacy: "Privacy policy", aml: "AML / KYC policy", status: "System status" }[d.key] })}
                <ArrowOutwardRoundedIcon sx={{ fontSize: 17, color: s.ink3 }} />
              </Box>
            </Link>
          ))}
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, mt: 2, lineHeight: 1.55 }} data-testid="about-legit-note">
            {t("about.legit.note", { defaultValue: "Dynopay never holds customer or merchant funds: every payment is forwarded on-chain to the merchant's own payout address." })}
          </Typography>
        </Box>
      </Box>
    </Section>
  );
};

export default AboutLegitimacyBlock;
