import React, { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Box, Grid, Typography } from "@mui/material";
import { styled, alpha, useTheme } from "@mui/material/styles";
import useIsMobile from "@/hooks/useIsMobile";
import HomeSectionTitle from "@/Components/UI/SectionTitle";
import HomeButton from "@/Components/Layout/HomeButton";
import FeeCalculator from "@/Components/UI/FeeCalculator";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import Head from "next/head";

/* ================= STYLED COMPONENTS ================= */

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
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

const FullWidthSection = styled(Box)(({ theme }) => ({
  width: "100%",
  margin: "0 auto",
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  backgroundColor: alpha(theme.palette.background.default, 0.3),
}));

const StepCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "20px",
    background: isDark ? "rgba(255,255,255,0.045)" : "#FFFFFF",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
    borderRadius: "16px",
    height: "100%",
  };
});

const StepIcon = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "12px",
    background: isDark ? "rgba(204,255,0,0.1)" : "#0A0A0A1A",
    color: isDark ? "#CCFF00" : "#0A0A0A",
    "& svg": { fontSize: "20px" },
  };
});

const StepText = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  lineHeight: "22px",
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
}));

const ComparisonTable = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    width: "100%",
    borderRadius: "16px",
    overflow: "hidden",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
    background: isDark ? "rgba(255,255,255,0.045)" : "#FFFFFF",
  };
});

const TableRow = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    alignItems: "center",
    padding: "14px 24px",
    "&:not(:last-child)": {
      borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
    },
    [theme.breakpoints.down("sm")]: {
      padding: "12px 16px",
      gridTemplateColumns: "1.5fr 1fr 1fr",
    },
  };
});

const TableHeader = styled(TableRow)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    background: isDark ? "rgba(204,255,0,0.05)" : "#F8F9FC",
  };
});

const TableCell = styled(Typography)(({ theme }) => ({
  fontSize: "14px",
  fontWeight: 400,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.secondary,
}));

const TableHeaderCell = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
}));

const SecurityCard = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    background: isDark ? "rgba(255,255,255,0.045)" : "#FFFFFF",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
    borderRadius: "12px",
  };
});

const CTASection = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    textAlign: "center",
    padding: "64px 24px",
    borderRadius: "24px",
    background: isDark
      ? `linear-gradient(135deg, rgba(204,255,0,0.08) 0%, rgba(14,15,18,1) 100%)`
      : `linear-gradient(135deg, rgba(10,10,10,0.04) 0%, rgba(255,255,255,1) 100%)`,
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
  };
});

const HowToStepRow = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 20px",
    background: isDark ? "rgba(255,255,255,0.045)" : "#FFFFFF",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
    borderRadius: "12px",
  };
});

const StepNumber = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    minWidth: "32px",
    borderRadius: "10px",
    background: isDark ? "rgba(204,255,0,0.15)" : "#0A0A0A1A",
    color: isDark ? "#CCFF00" : "#0A0A0A",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "OutfitSemiBold",
  };
});

/* ================= PAGE COMPONENT ================= */

const FeesPage = () => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("fees");
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

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

  return (
    <>
      <Head>
      </Head>

      <PageWrapper>
        {/* ===== HERO ===== */}
        <Container>
          <section style={{ padding: isMobile ? "48px 0 40px" : "80px 0 60px" }}>
            <HomeSectionTitle
              type="large"
              badgeText={t("pageTitle")}
              title={`${t("heroTitle")} ${t("heroHighlight")}`}
              highlightText={t("heroHighlight")}
              subtitle={t("heroSubtitle")}
            />
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Typography
                sx={{
                  fontSize: "16px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                  maxWidth: 500,
                  mx: "auto",
                  lineHeight: "24px",
                }}
              >
                {t("heroDescription")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <HomeButton
                variant="primary"
                label={t("tryCTA")}
                onClick={scrollToCalc}
              />
            </Box>
          </section>
        </Container>

        {/* ===== HOW FEES WORK ===== */}
        <FullWidthSection>
          <Box sx={{ maxWidth: 1280, mx: "auto", py: isMobile ? "60px" : "96px" }}>
            <HomeSectionTitle
              type="small"
              badgeText={t("howFeesBadge")}
              title={`${t("howFeesTitle")} ${t("howFeesHighlight")}`}
              highlightText={t("howFeesHighlight")}
              subtitle={t("howFeesSubtitle")}
              sx={{ maxWidth: "100%" }}
            />
            <Box sx={{ pt: isMobile ? 4 : 6 }}>
              <Grid container spacing={2}>
                {steps.map((step, idx) => (
                  <Grid key={idx} item xs={12} sm={6}>
                    <StepCard>
                      <StepIcon>
                        <CheckCircleOutlineIcon />
                      </StepIcon>
                      <StepText>{step}</StepText>
                    </StepCard>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Box>
        </FullWidthSection>

        {/* ===== FEE CALCULATOR ===== */}
        <Container>
          <section
            id="fee-calculator"
            style={{ padding: isMobile ? "60px 0" : "96px 0" }}
          >
            <HomeSectionTitle
              type="small"
              badgeText={t("calculatorBadge")}
              title={`${t("calculatorTitle")} — ${t("calculatorHighlight")}`}
              highlightText={t("calculatorHighlight")}
              subtitle={t("calculatorSubtitle")}
              sx={{ maxWidth: "100%", mb: isMobile ? 4 : 6 }}
            />
            <Box sx={{ maxWidth: 720, mx: "auto" }}>
              <FeeCalculator />
            </Box>
          </section>
        </Container>

        {/* ===== COMPARISON TABLE ===== */}
        <FullWidthSection>
          <Box sx={{ maxWidth: 1280, mx: "auto", py: isMobile ? "60px" : "96px" }}>
            <HomeSectionTitle
              type="small"
              badgeText={t("comparisonBadge")}
              title={`${t("comparisonTitle")} — ${t("comparisonHighlight")}`}
              highlightText={t("comparisonHighlight")}
              subtitle={t("comparisonSubtitle")}
              sx={{ maxWidth: "100%", mb: isMobile ? 4 : 6 }}
            />
            <Box sx={{ maxWidth: 800, mx: "auto" }}>
              <ComparisonTable>
                <TableHeader>
                  <TableHeaderCell>{t("featureCol")}</TableHeaderCell>
                  <TableHeaderCell sx={{ textAlign: "center" }}>{t("dynopayCol")}</TableHeaderCell>
                  <TableHeaderCell sx={{ textAlign: "center" }}>{t("othersCol")}</TableHeaderCell>
                </TableHeader>
                {comparisonRows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.feature}</TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                      {row.dynopay ? (
                        <CheckIcon sx={{ fontSize: 18, color: "#22C55E" }} />
                      ) : (
                        <CloseIcon sx={{ fontSize: 18, color: "#22C55E" }} />
                      )}
                      <TableCell sx={{ color: "#22C55E", fontFamily: "var(--font-sans)" }}>
                        {row.dynoText}
                      </TableCell>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                      {row.others ? (
                        <CheckIcon sx={{ fontSize: 18, color: isDark ? "#EF4444" : "#DC2626" }} />
                      ) : (
                        <CloseIcon sx={{ fontSize: 18, color: isDark ? "#EF4444" : "#DC2626" }} />
                      )}
                      <TableCell sx={{ color: isDark ? "#EF4444" : "#DC2626" }}>
                        {row.othersText}
                      </TableCell>
                    </Box>
                  </TableRow>
                ))}
              </ComparisonTable>
            </Box>
          </Box>
        </FullWidthSection>

        {/* ===== HOW TO USE ===== */}
        <Container>
          <section style={{ padding: isMobile ? "60px 0" : "96px 0" }}>
            <HomeSectionTitle
              type="small"
              badgeText={t("howToUseBadge")}
              title={`${t("howToUseTitle")}`}
              highlightText={t("howToUseHighlight")}
              subtitle={t("howToUseSubtitle")}
              sx={{ maxWidth: "100%", mb: isMobile ? 4 : 6 }}
            />
            <Box sx={{ maxWidth: 600, mx: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {howToSteps.map((step, idx) => (
                <HowToStepRow key={idx}>
                  <StepNumber>{idx + 1}</StepNumber>
                  <Typography
                    sx={{
                      fontSize: "15px",
                      fontFamily: "var(--font-sans)",
                      color: "text.primary",
                      lineHeight: "22px",
                    }}
                  >
                    {step}
                  </Typography>
                </HowToStepRow>
              ))}
            </Box>
          </section>
        </Container>

        {/* ===== SECURITY ===== */}
        <FullWidthSection>
          <Box sx={{ maxWidth: 1280, mx: "auto", py: isMobile ? "60px" : "96px" }}>
            <HomeSectionTitle
              type="small"
              badgeText={t("securityBadge")}
              title={`${t("securityTitle")} — ${t("securityHighlight")}`}
              highlightText={t("securityHighlight")}
              subtitle={t("securitySubtitle")}
              sx={{ maxWidth: "100%", mb: isMobile ? 4 : 6 }}
            />
            <Grid container spacing={2} sx={{ maxWidth: 900, mx: "auto" }}>
              {securityItems.map((item, idx) => (
                <Grid key={idx} item xs={12} md={4}>
                  <SecurityCard>
                    <ShieldOutlinedIcon
                      sx={{
                        color: isDark ? "#CCFF00" : "#0A0A0A",
                        fontSize: 24,
                        minWidth: 24,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontFamily: "var(--font-sans)",
                        color: "text.secondary",
                        lineHeight: "20px",
                      }}
                    >
                      {item}
                    </Typography>
                  </SecurityCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        </FullWidthSection>

        {/* ===== CTA ===== */}
        <Container>
          <section style={{ padding: isMobile ? "40px 0 60px" : "64px 0 96px" }}>
            <CTASection>
              <Typography
                sx={{
                  fontSize: isMobile ? "28px" : "36px",
                  fontWeight: 500,
                  fontFamily: "var(--font-sans)",
                  color: "text.primary",
                  lineHeight: isMobile ? "36px" : "44px",
                  mb: 2,
                }}
              >
                {t("ctaTitle")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "16px",
                  fontFamily: "var(--font-sans)",
                  color: "text.secondary",
                  mb: 4,
                }}
              >
                {t("ctaSubtitle")}
              </Typography>
              <HomeButton
                variant="primary"
                label={t("ctaButton")}
                onClick={scrollToCalc}
              />
            </CTASection>
          </section>
        </Container>
      </PageWrapper>
    </>
  );
};

export default memo(FeesPage);
