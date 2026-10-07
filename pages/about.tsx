import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  PrimaryBtn,
  Reveal,
  SectionV8,
  SectionHeadV8,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import AboutLegitimacyBlock from "@/Components/Page/About/LegitimacyBlock";

/* /about — rebuilt on the v8 marketing system (2026-10) to match the homepage,
   fees page and new brand. Same real copy/i18n keys + legitimacy block. */

const openSupportChat = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("dynopay:open-support-chat"));
};

const STATS = [
  { value: "0.5%", labelKey: "about.stats.baseFee" },
  { value: "9", labelKey: "about.stats.chains" },
  { value: "100%", labelKey: "about.stats.nonCustodial" },
  { value: "2024", labelKey: "about.stats.since" },
];

const VALUES = [
  { Icon: LockRoundedIcon, key: "nonCustodial" },
  { Icon: ReceiptLongRoundedIcon, key: "pricing" },
  { Icon: BoltRoundedIcon, key: "builder" },
  { Icon: PublicRoundedIcon, key: "global" },
];

const AboutPage: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const s = useConsole();

  return (
    <>
      <Head>
        <title>{t("about.metaTitle")}</title>
        <meta name="description" content={t("about.metaDescription")} />
      </Head>

      <Box component="main" data-testid="about-page">
        <PageHeroV8
          testId="about-hero"
          eyebrow={t("about.eyebrow")}
          title={t("about.heroTitle")}
          body={t("about.heroBody")}
          actions={
            <>
              <PrimaryBtn data-testid="about-start-free-btn" onClick={() => router.push("/auth/register")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.5, py: 1.5, fontSize: 16 }}>
                {t("startFree")}
              </PrimaryBtn>
              <Box component="button" onClick={openSupportChat} data-testid="about-contact-btn" sx={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 1, px: 3.5, py: 1.5, borderRadius: "999px", border: `1px solid ${s.line}`, background: "transparent", color: s.ink, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 16, transition: "border-color 160ms ease", "&:hover": { borderColor: s.ink3 } }}>
                {t("about.talkToUs")}
              </Box>
            </>
          }
        />

        {/* Stats band */}
        <SectionV8 testId="about-stats" sx={{ background: s.dark ? "#0F0F0E" : "#F2F3F1" }} innerSx={{ py: 0 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 3, md: 2 } }}>
            {STATS.map((st, i) => (
              <Reveal key={st.labelKey} delay={i * 0.06} sx={{ textAlign: { xs: "left", md: "center" } }}>
                <Typography className="tabular-nums" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 32, md: 42 }, letterSpacing: "-0.03em", color: s.accent, lineHeight: 1 }}>
                  {st.value}
                </Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3, mt: 1.25 }}>{t(st.labelKey)}</Typography>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        {/* What we build / values */}
        <SectionV8 testId="about-values">
          <SectionHeadV8 center eyebrow={t("about.eyebrow")} title={t("about.buildTitle")} lead={t("about.buildBody")} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 2, md: 2.5 } }}>
            {VALUES.map(({ Icon, key }, i) => (
              <Reveal key={key} delay={i * 0.06}>
                <Box sx={{ height: "100%", display: "flex", gap: 2, alignItems: "flex-start", p: { xs: 3, md: 3.5 }, borderRadius: "18px", border: `1px solid ${s.line}`, background: s.canvas, transition: "border-color 160ms ease", "&:hover": { borderColor: s.ink3 } }}>
                  <Box sx={{ flexShrink: 0, width: 46, height: 46, borderRadius: "13px", display: "grid", placeItems: "center", background: s.dark ? "rgba(255,209,0,0.14)" : "rgba(138,109,0,0.1)", color: s.accent }}>
                    <Icon sx={{ fontSize: 23 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: s.ink, mb: 0.75, letterSpacing: "-0.015em" }}>{t(`about.values.${key}.title`)}</Typography>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>{t(`about.values.${key}.body`)}</Typography>
                  </Box>
                </Box>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        {/* Who runs Dynopay — legal entity, contact, custody model, policies */}
        <AboutLegitimacyBlock />

        <CtaBandV8
          testId="about-cta"
          title={t("about.ctaTitle")}
          body={t("about.ctaBody")}
          primaryLabel={t("v3.hero.primaryCta")}
          primaryRef="about-cta"
          secondaryLabel={t("about.talkToUs")}
          secondaryHref="/help-support"
        />
      </Box>
    </>
  );
};

export default AboutPage;
