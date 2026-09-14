import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import CtaBand from "@/Components/Page/Home/v5/CtaBand";

const STATS = [
  { value: "1.5%", labelKey: "about.stats.baseFee" },
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
  const s = useAurora();
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;

  return (
    <>
      <Head>
        <title>{t("about.metaTitle")}</title>
        <meta name="description" content={t("about.metaDescription")} />
      </Head>

      <Box component="main">
        <PublicPageHero
          eyebrow={t("about.eyebrow")}
          title={t("about.heroTitle")}
          body={t("about.heroBody")}
          actions={
            <>
              <PrimaryBtn data-testid="about-start-free-btn" onClick={() => router.push("/auth/register")} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}>
                {t("startFree")}
              </PrimaryBtn>
              <SecondaryBtn data-testid="about-contact-btn" href="mailto:support@dynopay.com">
                {t("about.talkToUs")}
              </SecondaryBtn>
            </>
          }
        />

        {/* Stats band */}
        <Section alt testId="about-stats" sx={{ py: { xs: 6, md: 8 } }}>
          <Stagger step={0.06} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 3, md: 2 } }}>
            {STATS.map((st, i) => (
              <StaggerItem key={st.labelKey} i={i} y={14}>
                <Box sx={{ textAlign: { xs: "left", md: "center" } }}>
                  <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 30, md: 38 }, letterSpacing: "-0.03em", color: accent, lineHeight: 1 }}>
                    {st.value}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: s.ink3, mt: 1 }}>{t(st.labelKey)}</Typography>
                </Box>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        {/* What we build / values */}
        <Section testId="about-values">
          <SectionHead eyebrow={t("about.eyebrow")} headline={t("about.buildTitle")} body={t("about.buildBody")} />
          <Stagger step={0.06} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 1.75, md: 2 } }}>
            {VALUES.map(({ Icon, key }, i) => (
              <StaggerItem key={key} i={i} y={16}>
                <Box sx={{ height: "100%", display: "flex", gap: 2, alignItems: "flex-start", borderRadius: "18px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2.75, md: 3.25 }, transition: "border-color 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms ease", "&:hover": { borderColor: `${BRAND_ACCENT}55`, transform: "translateY(-3px)", boxShadow: `0 24px 48px -32px ${BRAND_ACCENT}66` } }}>
                  <Box sx={{ flexShrink: 0, width: 44, height: 44, borderRadius: "12px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: accent }}>
                    <Icon sx={{ fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, color: s.ink, mb: 0.75, letterSpacing: "-0.015em" }}>{t(`about.values.${key}.title`)}</Typography>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, lineHeight: 1.6, color: s.ink2 }}>{t(`about.values.${key}.body`)}</Typography>
                  </Box>
                </Box>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        <CtaBand
          testId="about-cta"
          title={t("about.ctaTitle")}
          body={t("about.ctaBody")}
          actions={
            <>
              <PrimaryBtn data-testid="about-cta-start" onClick={() => router.push("/auth/register")} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}>
                {t("v3.hero.primaryCta")}
              </PrimaryBtn>
              <SecondaryBtn onDark data-testid="about-cta-email" href="mailto:support@dynopay.com">
                support@dynopay.com
              </SecondaryBtn>
            </>
          }
        />
      </Box>
    </>
  );
};

export default AboutPage;
