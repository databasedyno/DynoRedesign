import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import Head from "next/head";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn, cardSx } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";
import ReferralEarningsCalculator from "@/Components/Page/Referrals/ReferralEarningsCalculator";
import ShareProgramV3 from "@/Components/Page/Referrals/ShareProgramV3";
import { useApiSWR } from "@/hooks/useApiSWR";
import { API_ENDPOINTS } from "@/api/endpoints";

/* Public marketing page for the Dynopay Referral Program (/referral-program).
 * Aurora design system, mirrors /fees. Copy resolves from the "referrals"
 * namespace `public.*` keys (localized ×6); title/desc from pageTitles. */

const PageWrapper = styled(Box)({ width: "100%" });

const ReferralProgramPage = () => {
  const { t } = useTranslation("referrals");
  const { t: tTitle } = useTranslation("pageTitles");
  const s = useAurora();

  const steps = [
    { Icon: ShareRoundedIcon, title: t("public.step1Title"), desc: t("public.step1Desc") },
    { Icon: HowToRegRoundedIcon, title: t("public.step2Title"), desc: t("public.step2Desc") },
    { Icon: SavingsRoundedIcon, title: t("public.step3Title"), desc: t("public.step3Desc") },
  ];

  const rawFaqs = t("public.faq", { returnObjects: true });
  const faqs: Array<{ q: string; a: string }> = Array.isArray(rawFaqs) ? rawFaqs : [];

  // Public top-referrers leaderboard — privacy-safe (rank + referral COUNT only, no
  // names or earnings). Hidden until there is at least one ranked referrer.
  const { data: lbData } = useApiSWR<{ leaderboard?: Array<{ rank: number; referral_count: number }> }>(
    API_ENDPOINTS.referral.leaderboardPublic,
    { unwrap: true }
  );
  const leaderboard = (lbData?.leaderboard || []).filter((e) => Number(e.referral_count) > 0).slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <>
      <Head>
        <title>{tTitle("referralProgram_title")}</title>
        <meta name="description" content={tTitle("referralProgram_desc")} />
      </Head>

      <PageWrapper sx={{ background: s.bg }} data-testid="referral-program-page">
        {/* ===== HERO ===== */}
        <PublicPageHero
          testId="referral-hero"
          eyebrow={t("public.eyebrow")}
          title={t("public.heroTitle")}
          body={t("public.heroSubtitle")}
          note={t("public.noCap")}
          actions={
            <>
              <PrimaryBtn data-testid="referral-hero-primary-cta" href="/auth/register?ref=referral_program" endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
                {t("public.heroCtaPrimary")}
              </PrimaryBtn>
              <SecondaryBtn data-testid="referral-hero-secondary-cta" href="/auth/login">
                {t("public.heroCtaSecondary")}
              </SecondaryBtn>
            </>
          }
        />

        {/* ===== HOW IT WORKS ===== */}
        <Section alt testId="referral-steps">
          <SectionHead headline={t("public.stepsTitle")} />
          <Stagger step={0.08} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {steps.map((step, i) => (
                <StaggerItem key={i} i={i} y={16}>
                <Box
                  data-testid={`referral-step-${i + 1}`}
                  sx={{
                    ...cardSx(s),
                    height: "100%",
                    p: { xs: 3, md: 3.5 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      display: "grid",
                      placeItems: "center",
                      background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)",
                      color: s.dark ? "#818CF8" : s.indigo,
                      mb: 0.5,
                    }}
                  >
                    <step.Icon />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.dark ? "#818CF8" : s.indigo, letterSpacing: "0.14em" }}>
                    {`0${i + 1}`}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_HERO, fontSize: 19, fontWeight: 700, color: s.ink, letterSpacing: "-0.015em" }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2, lineHeight: 1.6 }}>
                    {step.desc}
                  </Typography>
                </Box>
                </StaggerItem>
              ))}
          </Stagger>
        </Section>

        {/* ===== EARNINGS CALCULATOR ===== */}
        <Section testId="referral-calculator">
          <ReferralEarningsCalculator />
        </Section>

        {/* ===== TOP REFERRERS (public, count-only) ===== */}
        {leaderboard.length > 0 && (
          <Section alt testId="referral-leaderboard-section">
              <SectionHead headline={t("public.leaderboardTitle")} body={t("public.leaderboardSubtitle")} />
              <Box sx={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {leaderboard.map((entry, i) => (
                  <Box
                    key={entry.rank}
                    data-testid={`referral-leaderboard-row-${entry.rank}`}
                    sx={{
                      ...cardSx(s, { hover: false, radius: 16 }),
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      border: `1px solid ${i < 3 ? s.indigo : s.line}`,
                      px: { xs: 2.5, md: 3.5 },
                      py: { xs: 2, md: 2.25 },
                    }}
                  >
                    <Box
                      sx={{
                        minWidth: 44,
                        height: 44,
                        borderRadius: "12px",
                        display: "grid",
                        placeItems: "center",
                        fontSize: i < 3 ? 22 : 15,
                        fontFamily: FONT_TECH,
                        fontWeight: 700,
                        color: i < 3 ? s.indigo : s.ink2,
                        background: i < 3 ? "rgba(79,70,229,0.12)" : s.bgAlt,
                      }}
                    >
                      {i < 3 ? medals[i] : `#${entry.rank}`}
                    </Box>
                    <Typography sx={{ flex: 1, fontFamily: FONT_BODY, fontSize: { xs: 15, md: 17 }, fontWeight: 600, color: s.ink }}>
                      {`#${entry.rank}`}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: { xs: 14, md: 15 }, fontWeight: 700, color: s.indigo }}>
                      {t("public.leaderboardCount", { count: Number(entry.referral_count) })}
                    </Typography>
                  </Box>
                ))}
              </Box>
          </Section>
        )}

        {/* ===== FAQ ===== */}
        <Section alt testId="referral-faq">
          <SectionHead headline={t("public.faqTitle")} />
          <Stagger step={0.05} sx={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 1.5 }}>
              {faqs.map((f, i) => (
                <StaggerItem key={i} i={i} y={12}>
                <Box
                  data-testid={`referral-faq-${i + 1}`}
                  sx={{
                    ...cardSx(s, { hover: false }),
                    p: { xs: 2.5, md: 3 },
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_HERO, fontSize: { xs: 16, md: 18 }, fontWeight: 700, color: s.ink, mb: 1, letterSpacing: "-0.01em" }}>
                    {f.q}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14, md: 15 }, color: s.ink2, lineHeight: 1.65 }}>
                    {f.a}
                  </Typography>
                </Box>
                </StaggerItem>
              ))}
          </Stagger>
        </Section>

        {/* ===== SHARE THE PROGRAM ===== */}
        <ShareProgramV3 />

        {/* ===== CLOSING CTA (shared register band) ===== */}
        <PublicFinalCta attributionRef="referral_program_final" />
      </PageWrapper>
    </>
  );
};

export default memo(ReferralProgramPage);
