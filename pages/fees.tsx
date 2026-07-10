import React, { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Box, Grid, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import useIsMobile from "@/hooks/useIsMobile";
import HomeButton from "@/Components/Layout/HomeButton";
import FeeCalculator from "@/Components/UI/FeeCalculator";
import SwissSectionHead from "@/Components/Page/Home/SwissSectionHead";
import { FONT_BODY, FONT_HERO, FONT_TECH, OBSIDIAN, useSwiss } from "@/Components/Page/Home/swiss";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import Head from "next/head";

/* ── Swiss & High-Contrast restyle of the public /fees page (2026-07) ── */

const PageWrapper = styled(Box)(({ theme }) => ({
  width: "100%",
  paddingTop: 65,
  [theme.breakpoints.down("md")]: {
    paddingTop: 76,
  },
}));

const Container = styled(Box)(({ theme }) => ({
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
}));

const FeesPage = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("fees");
  const s = useSwiss();

  const scrollToCalc = useCallback(() => {
    const el = document.getElementById("fee-calculator");
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const comparisonRows = [
    { feature: t("compMultipleFees"), dynopay: false, dynoText: t("compNo"), others: true, othersText: t("compOften") },
    { feature: t("compInstantForward"), dynopay: true, dynoText: t("compYes"), others: false, othersText: t("compSometimes") },
    { feature: t("compClearBreakdown"), dynopay: true, dynoText: t("compYes"), others: false, othersText: t("compLimited") },
    { feature: t("compPlatformFee"), dynopay: true, dynoText: t("compLowTransparent"), others: false, othersText: t("compBundled") },
    { feature: t("compRealTimeCalc"), dynopay: true, dynoText: t("compYes"), others: false, othersText: t("compNo") },
  ];

  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];
  const howToSteps = [t("howToStep1"), t("howToStep2"), t("howToStep3"), t("howToStep4")];
  const securityItems = [t("security1"), t("security2"), t("security3")];

  const cardSx = {
    background: s.surface,
    border: `1px solid ${s.line}`,
    borderRadius: "16px",
    transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease",
    "&:hover": { transform: "translateY(-2px)", borderColor: s.dark ? "rgba(204,255,0,0.3)" : "rgba(10,10,10,0.22)" },
  };

  const gridLine = s.dark ? "rgba(255,255,255,0.05)" : "rgba(10,10,10,0.05)";

  return (
    <>
      <Head>
      </Head>

      <PageWrapper>
        {/* ===== HERO ===== */}
        <Box sx={{ position: "relative", overflow: "hidden" }}>
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
              backgroundSize: "54px 54px",
              maskImage: "radial-gradient(ellipse 95% 85% at 50% 0%, black 25%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(ellipse 95% 85% at 50% 0%, black 25%, transparent 78%)",
            }}
          />
          <Container sx={{ position: "relative", zIndex: 1 }}>
            <Box component="section" sx={{ pt: { xs: 7, md: 11 }, pb: { xs: 6, md: 8 }, textAlign: "center" }}>
              <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.24em", textTransform: "uppercase", color: s.accentText, mb: 3 }}>
                [ {t("pageTitle")} ]
              </Typography>
              <Typography component="h1" sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 30, sm: 40, md: 48 }, lineHeight: 1.12, letterSpacing: "-0.03em", color: s.txt, maxWidth: 900, mx: "auto" }}>
                {t("heroTitle")}{" "}
                <Box component="span" sx={{ color: s.accentText }}>{t("heroHighlight")}</Box>
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 17 }, lineHeight: 1.65, color: s.sub, maxWidth: 620, mx: "auto", mt: 3 }}>
                {t("heroSubtitle")}
              </Typography>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14, md: 15.5 }, lineHeight: 1.6, color: s.sub, maxWidth: 500, mx: "auto", mt: 1.5 }}>
                {t("heroDescription")}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", mt: 4.5 }}>
                <HomeButton variant="primary" label={t("tryCTA")} onClick={scrollToCalc} />
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ===== HOW FEES WORK ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 7, md: 12 } }}>
            <SwissSectionHead
              num="01"
              eyebrow={t("howFeesBadge")}
              title={`${t("howFeesTitle")} ${t("howFeesHighlight")}`}
              highlight={t("howFeesHighlight")}
              sub={t("howFeesSubtitle")}
            />
            <Grid container spacing={2}>
              {steps.map((step, idx) => (
                <Grid key={idx} item xs={12} sm={6}>
                  <Box data-testid={`fees-step-card-${idx}`} sx={{ ...cardSx, display: "flex", alignItems: "flex-start", gap: 2, p: 2.75, height: "100%" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, minWidth: 40, borderRadius: "10px", border: `1px solid ${s.lineStrong}`, color: s.accentText }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, lineHeight: 1.6, color: s.sub }}>{step}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>

        {/* ===== FEE CALCULATOR ===== */}
        <Container>
          <Box component="section" id="fee-calculator" sx={{ py: { xs: 7, md: 12 } }}>
            <SwissSectionHead
              num="02"
              eyebrow={t("calculatorBadge")}
              title={`${t("calculatorTitle")} — ${t("calculatorHighlight")}`}
              highlight={t("calculatorHighlight")}
              sub={t("calculatorSubtitle")}
            />
            <Box sx={{ maxWidth: 720, mx: "auto" }}>
              <FeeCalculator />
            </Box>
          </Box>
        </Container>

        {/* ===== COMPARISON TABLE ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 7, md: 12 } }}>
            <SwissSectionHead
              num="03"
              eyebrow={t("comparisonBadge")}
              title={`${t("comparisonTitle")} — ${t("comparisonHighlight")}`}
              highlight={t("comparisonHighlight")}
              sub={t("comparisonSubtitle")}
            />
            <Box data-testid="fees-comparison-table" sx={{ maxWidth: 820, mx: "auto", borderRadius: "16px", overflow: "hidden", border: `1px solid ${s.line}`, background: s.surface }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 1fr 1fr", sm: "2fr 1fr 1fr" }, alignItems: "center", px: { xs: 2, sm: 3 }, py: 1.75, borderBottom: `1px solid ${s.lineStrong}`, background: s.dark ? "rgba(204,255,0,0.04)" : "rgba(10,10,10,0.03)" }}>
                {[t("featureCol"), t("dynopayCol"), t("othersCol")].map((h, i) => (
                  <Typography key={h} sx={{ fontFamily: FONT_TECH, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: s.txt, textAlign: i === 0 ? "left" : "center" }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {comparisonRows.map((row, idx) => (
                <Box key={idx} sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 1fr 1fr", sm: "2fr 1fr 1fr" }, alignItems: "center", px: { xs: 2, sm: 3 }, py: 1.75, "&:not(:last-child)": { borderBottom: `1px solid ${s.line}` } }}>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.sub, pr: 1 }}>{row.feature}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {row.dynopay ? (
                      <CheckIcon sx={{ fontSize: 16, color: s.accentText }} />
                    ) : (
                      <CloseIcon sx={{ fontSize: 16, color: s.accentText }} />
                    )}
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, fontWeight: 500, color: s.accentText, textAlign: "center" }}>
                      {row.dynoText}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {row.others ? (
                      <CheckIcon sx={{ fontSize: 16, color: "#EF4444" }} />
                    ) : (
                      <CloseIcon sx={{ fontSize: 16, color: "#EF4444" }} />
                    )}
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: "#EF4444", textAlign: "center" }}>
                      {row.othersText}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>

        {/* ===== HOW TO USE ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 7, md: 12 } }}>
            <SwissSectionHead
              num="04"
              eyebrow={t("howToUseBadge")}
              title={t("howToUseTitle")}
              highlight={t("howToUseHighlight")}
              sub={t("howToUseSubtitle")}
            />
            <Box sx={{ maxWidth: 620, mx: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {howToSteps.map((step, idx) => (
                <Box key={idx} data-testid={`fees-howto-step-${idx}`} sx={{ ...cardSx, display: "flex", alignItems: "center", gap: 2, px: 2.5, py: 2, borderRadius: "12px" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, minWidth: 32, borderRadius: "8px", backgroundColor: s.accentSoft, color: s.accentText, fontSize: 13, fontWeight: 600, fontFamily: FONT_TECH }}>
                    {String(idx + 1).padStart(2, "0")}
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.txt, lineHeight: 1.55 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>

        {/* ===== SECURITY ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 7, md: 12 } }}>
            <SwissSectionHead
              num="05"
              eyebrow={t("securityBadge")}
              title={`${t("securityTitle")} — ${t("securityHighlight")}`}
              highlight={t("securityHighlight")}
              sub={t("securitySubtitle")}
            />
            <Grid container spacing={2} sx={{ maxWidth: 920, mx: "auto" }}>
              {securityItems.map((item, idx) => (
                <Grid key={idx} item xs={12} md={4}>
                  <Box sx={{ ...cardSx, display: "flex", alignItems: "center", gap: 1.5, p: 2, borderRadius: "12px", height: "100%" }}>
                    <ShieldOutlinedIcon sx={{ color: s.accentText, fontSize: 22, minWidth: 22 }} />
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.sub, lineHeight: 1.55 }}>
                      {item}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>

        {/* ===== CTA — obsidian band ===== */}
        <Container>
          <Box component="section" sx={{ pt: { xs: 4, md: 6 }, pb: { xs: 8, md: 12 } }}>
            <Box
              data-testid="fees-cta-section"
              sx={{
                position: "relative",
                overflow: "hidden",
                textAlign: "center",
                px: 3,
                py: { xs: 7, md: 9 },
                borderRadius: "20px",
                backgroundColor: OBSIDIAN,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
                  backgroundSize: "54px 54px",
                  maskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)",
                  WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 50% 50%, black 20%, transparent 85%)",
                }}
              />
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 800, fontSize: { xs: 24, md: 36 }, letterSpacing: "-0.02em", lineHeight: 1.2, color: "#F5F5F5", mb: 2 }}>
                  {t("ctaTitle")}
                </Typography>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14.5, md: 16 }, color: "rgba(255,255,255,0.6)", mb: 4, maxWidth: 520, mx: "auto" }}>
                  {t("ctaSubtitle")}
                </Typography>
                <HomeButton variant="primary" label={t("ctaButton")} onClick={scrollToCalc} />
              </Box>
            </Box>
          </Box>
        </Container>
      </PageWrapper>
    </>
  );
};

export default memo(FeesPage);
