import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import Head from "next/head";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import SavingsRoundedIcon from "@mui/icons-material/SavingsRounded";
import { AURORA_GRADIENT, FONT_BODY, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { Eyebrow, HeadlineL, HeadlineXL } from "@/Components/Page/Home/v3/styled.v3";
import FinalCTAAurora from "@/Components/Page/Home/v3/FinalCTAAurora";
import ReferralEarningsCalculator from "@/Components/Page/Referrals/ReferralEarningsCalculator";
import ShareProgramV3 from "@/Components/Page/Referrals/ShareProgramV3";
import { useApiSWR } from "@/hooks/useApiSWR";
import { API_ENDPOINTS } from "@/api/endpoints";

/* Public marketing page for the Dynopay Referral Program (/referral-program).
 * Aurora design system, mirrors /fees. Copy resolves from the "referrals"
 * namespace `public.*` keys (localized ×6); title/desc from pageTitles. */

const PageWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  paddingTop: 65,
  [theme.breakpoints.down("md")]: { paddingTop: 76 },
}));

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
}));

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
        <Box sx={{ position: "relative", overflow: "hidden", pb: 0 }}>
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: "-30%",
              right: "-20%",
              width: 800,
              height: 800,
              borderRadius: "50%",
              background: AURORA_GRADIENT,
              filter: "blur(140px)",
              opacity: s.dark ? 0.12 : 0.09,
              pointerEvents: "none",
            }}
          />
          <Container sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ pt: { xs: 9, md: 16 }, pb: { xs: 6, md: 9 }, textAlign: "center" }}>
              <Eyebrow tone="coral" sx={{ mb: 3 }}>{t("public.eyebrow")}</Eyebrow>
              <HeadlineXL sx={{ color: s.ink, maxWidth: 1000, mx: "auto", mb: 3 }}>
                {t("public.heroTitle")}
              </HeadlineXL>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 16, md: 18 }, color: s.ink2, maxWidth: 640, mx: "auto", lineHeight: 1.6, mb: 4 }}>
                {t("public.heroSubtitle")}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 2, mb: 3 }}>
                <Button
                  data-testid="referral-hero-primary-cta"
                  href="/auth/register?ref=referral_program"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    borderRadius: "999px",
                    px: 4,
                    py: 1.6,
                    fontFamily: FONT_BODY,
                    fontSize: 16,
                    fontWeight: 600,
                    textTransform: "none",
                    color: "#FFFFFF",
                    background: s.indigo,
                    boxShadow: "0 12px 32px -12px rgba(79, 70, 229,0.6)",
                    "&:hover": { background: "#4338CA" },
                  }}
                >
                  {t("public.heroCtaPrimary")}
                </Button>
                <Button
                  data-testid="referral-hero-secondary-cta"
                  href="/auth/login"
                  sx={{
                    borderRadius: "999px",
                    px: 3.5,
                    py: 1.55,
                    fontFamily: FONT_BODY,
                    fontSize: 15.5,
                    fontWeight: 500,
                    textTransform: "none",
                    color: s.ink,
                    border: `1px solid ${s.lineStrong}`,
                    "&:hover": { background: s.bgAlt, borderColor: s.ink3 },
                  }}
                >
                  {t("public.heroCtaSecondary")}
                </Button>
              </Box>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 13, letterSpacing: "0.04em", color: s.ink3, maxWidth: 560, mx: "auto" }}>
                {t("public.noCap")}
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* ===== HOW IT WORKS ===== */}
        <Box sx={{ background: s.bgAlt, py: { xs: 9, md: 14 } }}>
          <Container>
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
              <HeadlineL sx={{ color: s.ink }}>{t("public.stepsTitle")}</HeadlineL>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: { xs: 3, md: 4 },
              }}
            >
              {steps.map((step, i) => (
                <Box
                  key={i}
                  data-testid={`referral-step-${i + 1}`}
                  sx={{
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "20px",
                    p: { xs: 3.5, md: 4 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "14px",
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(79,70,229,0.12)",
                      color: s.indigo,
                      mb: 0.5,
                    }}
                  >
                    <step.Icon />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.indigo, letterSpacing: "0.1em" }}>
                    {`0${i + 1}`}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 20, fontWeight: 700, color: s.ink }}>
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink2, lineHeight: 1.6 }}>
                    {step.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* ===== EARNINGS CALCULATOR ===== */}
        <Box sx={{ py: { xs: 9, md: 14 } }}>
          <Container>
            <ReferralEarningsCalculator />
          </Container>
        </Box>

        {/* ===== TOP REFERRERS (public, count-only) ===== */}
        {leaderboard.length > 0 && (
          <Box sx={{ background: s.bgAlt, py: { xs: 9, md: 14 } }} data-testid="referral-leaderboard-section">
            <Container>
              <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
                <HeadlineL sx={{ color: s.ink }}>{t("public.leaderboardTitle")}</HeadlineL>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16 }, color: s.ink2, maxWidth: 560, mx: "auto", mt: 1.5 }}>
                  {t("public.leaderboardSubtitle")}
                </Typography>
              </Box>
              <Box sx={{ maxWidth: 640, mx: "auto", display: "flex", flexDirection: "column", gap: 1.5 }}>
                {leaderboard.map((entry, i) => (
                  <Box
                    key={entry.rank}
                    data-testid={`referral-leaderboard-row-${entry.rank}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      background: s.surface,
                      border: `1px solid ${i < 3 ? s.indigo : s.line}`,
                      borderRadius: "16px",
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
            </Container>
          </Box>
        )}

        {/* ===== FAQ ===== */}
        <Box sx={{ background: s.bgAlt, py: { xs: 9, md: 14 } }}>
          <Container>
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
              <HeadlineL sx={{ color: s.ink }}>{t("public.faqTitle")}</HeadlineL>
            </Box>
            <Box sx={{ maxWidth: 800, mx: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {faqs.map((f, i) => (
                <Box
                  key={i}
                  data-testid={`referral-faq-${i + 1}`}
                  sx={{
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "16px",
                    p: { xs: 3, md: 3.5 },
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 17, fontWeight: 700, color: s.ink, mb: 1 }}>
                    {f.q}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: s.ink2, lineHeight: 1.6 }}>
                    {f.a}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* ===== SHARE THE PROGRAM ===== */}
        <ShareProgramV3 />

        {/* ===== CLOSING CTA (shared register band) ===== */}
        <FinalCTAAurora />
      </PageWrapper>
    </>
  );
};

export default memo(ReferralProgramPage);
