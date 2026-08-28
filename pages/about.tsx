import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Button, Container, Stack, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { brandFg, BRAND_ACCENT } from "@/constants/theme";

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
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const isDark = theme.palette.mode === "dark";
  const accent = brandFg(isDark);

  return (
    <>
      <Head>
        <title>{t("about.metaTitle")}</title>
        <meta name="description" content={t("about.metaDescription")} />
      </Head>

      <Box component="main" sx={{ bgcolor: "background.default", color: "text.primary" }}>
        {/* ── Hero ── */}
        <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 9 } }}>
          <Stack spacing={3} sx={{ maxWidth: 760 }}>
            <Typography
              sx={{
                color: accent,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {t("about.eyebrow")}
            </Typography>
            <Typography
              component="h1"
              sx={{
                fontWeight: 800,
                lineHeight: 1.05,
                fontSize: { xs: 34, sm: 44, md: 56 },
                letterSpacing: "-0.02em",
              }}
            >
              {t("about.heroTitle")}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: { xs: 16, md: 19 }, lineHeight: 1.6 }}>
              {t("about.heroBody")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
              <Button
                data-testid="about-start-free-btn"
                onClick={() => router.push("/auth/register")}
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  bgcolor: BRAND_ACCENT,
                  color: "#fff",
                  fontWeight: 700,
                  px: 3,
                  py: 1.25,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: 15,
                  "&:hover": { bgcolor: "#4338CA" },
                }}
              >
                {t("startFree")}
              </Button>
              <Button
                data-testid="about-contact-btn"
                href="mailto:support@dynopay.com"
                variant="outlined"
                sx={{
                  color: accent,
                  borderColor: isDark ? "rgba(129,140,248,0.5)" : "rgba(79,70,229,0.4)",
                  fontWeight: 700,
                  px: 3,
                  py: 1.25,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: 15,
                  "&:hover": { borderColor: accent, bgcolor: isDark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)" },
                }}
              >
                {t("about.talkToUs")}
              </Button>
            </Stack>
          </Stack>
        </Container>

        {/* ── Stats band ── */}
        <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                gap: { xs: 3, md: 2 },
              }}
            >
              {STATS.map((s) => (
                <Box key={s.labelKey} sx={{ textAlign: { xs: "left", md: "center" } }}>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: 28, md: 34 }, color: accent, lineHeight: 1 }}>
                    {s.value}
                  </Typography>
                  <Typography sx={{ color: "text.secondary", fontSize: 14, mt: 0.75 }}>{t(s.labelKey)}</Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* ── What we build / values ── */}
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
          <Stack spacing={1.5} sx={{ mb: { xs: 4, md: 6 }, maxWidth: 680 }}>
            <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 }, letterSpacing: "-0.01em" }}>
              {t("about.buildTitle")}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 }, lineHeight: 1.6 }}>
              {t("about.buildBody")}
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: { xs: 2, md: 3 },
            }}
          >
            {VALUES.map(({ Icon, key }) => (
              <Box
                key={key}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  height: "100%",
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: isDark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.08)",
                    color: accent,
                    mb: 2,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.75 }}>{t(`about.values.${key}.title`)}</Typography>
                <Typography sx={{ color: "text.secondary", fontSize: 15, lineHeight: 1.6 }}>{t(`about.values.${key}.body`)}</Typography>
              </Box>
            ))}
          </Box>
        </Container>

        {/* ── Careers / contact CTA ── */}
        <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
          <Box
            sx={{
              borderRadius: 4,
              p: { xs: 4, md: 6 },
              textAlign: "center",
              background: isDark
                ? "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(79,70,229,0.10) 100%)"
                : "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(79,70,229,0.05) 100%)",
              border: 1,
              borderColor: isDark ? "rgba(129,140,248,0.25)" : "rgba(79,70,229,0.15)",
            }}
          >
            <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 32 }, mb: 1.25 }}>
              {t("about.ctaTitle")}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 }, mb: 3, maxWidth: 560, mx: "auto" }}>
              {t("about.ctaBody")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
              <Button
                data-testid="about-cta-start"
                onClick={() => router.push("/auth/register")}
                sx={{
                  bgcolor: BRAND_ACCENT,
                  color: "#fff",
                  fontWeight: 700,
                  px: 3.5,
                  py: 1.35,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: 15,
                  "&:hover": { bgcolor: "#4338CA" },
                }}
              >
                {t("v3.hero.primaryCta")}
              </Button>
              <Button
                data-testid="about-cta-email"
                href="mailto:support@dynopay.com"
                variant="outlined"
                sx={{
                  color: accent,
                  borderColor: isDark ? "rgba(129,140,248,0.5)" : "rgba(79,70,229,0.4)",
                  fontWeight: 700,
                  px: 3.5,
                  py: 1.35,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: 15,
                  "&:hover": { borderColor: accent, bgcolor: isDark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)" },
                }}
              >
                support@dynopay.com
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </>
  );
};

export default AboutPage;
