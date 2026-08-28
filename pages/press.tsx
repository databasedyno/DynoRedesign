import React, { useCallback, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Button, Container, Stack, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { brandFg, BRAND_ACCENT } from "@/constants/theme";

const FACTS = ["founded", "product", "pricing", "networks", "settlement", "chargebacks"] as const;

const ASSETS = [
  {
    key: "black",
    labelKey: "press.logoBlackLabel",
    file: "/press/dynopay-logo-black.svg",
    downloadKey: "press.downloadSvg",
    chipBg: "#f8fafc",
    chipBorder: "rgba(15,23,42,0.12)",
  },
  {
    key: "white",
    labelKey: "press.logoWhiteLabel",
    file: "/press/dynopay-logo-white.svg",
    downloadKey: "press.downloadSvg",
    chipBg: "#0b0b12",
    chipBorder: "rgba(255,255,255,0.14)",
  },
  {
    key: "icon",
    labelKey: "press.iconLabel",
    file: "/press/dynopay-icon-512.png",
    downloadKey: "press.downloadPng",
    chipBg: "#f8fafc",
    chipBorder: "rgba(15,23,42,0.12)",
  },
] as const;

const PressPage: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("landing");
  const isDark = theme.palette.mode === "dark";
  const accent = brandFg(isDark);
  const [copied, setCopied] = useState(false);

  const copyBoilerplate = useCallback(async () => {
    const text = t("press.boilerplateBody");
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Clipboard API unavailable/denied — fall back to a hidden textarea.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [t]);

  const outlinedBtnSx = {
    color: accent,
    borderColor: isDark ? "rgba(129,140,248,0.5)" : "rgba(79,70,229,0.4)",
    fontWeight: 700,
    px: 3,
    py: 1.25,
    borderRadius: 2,
    textTransform: "none",
    fontSize: 15,
    "&:hover": {
      borderColor: accent,
      bgcolor: isDark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)",
    },
  } as const;

  return (
    <>
      <Head>
        <title>{t("press.metaTitle")}</title>
        <meta name="description" content={t("press.metaDescription")} />
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
              {t("press.eyebrow")}
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
              {t("press.heroTitle")}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: { xs: 16, md: 19 }, lineHeight: 1.6 }}>
              {t("press.heroBody")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
              <Button
                data-testid="press-contact-btn"
                href="mailto:support@dynopay.com"
                startIcon={<MailOutlineRoundedIcon />}
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
                support@dynopay.com
              </Button>
              <Button
                data-testid="press-story-btn"
                onClick={() => router.push("/about")}
                variant="outlined"
                endIcon={<ArrowForwardRoundedIcon />}
                sx={outlinedBtnSx}
              >
                {t("press.storyCta")}
              </Button>
            </Stack>
          </Stack>
        </Container>

        {/* ── Boilerplate ── */}
        <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
              sx={{ mb: 2.5 }}
            >
              <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 }, letterSpacing: "-0.01em" }}>
                {t("press.boilerplateTitle")}
              </Typography>
              <Button
                data-testid="press-copy-boilerplate"
                onClick={copyBoilerplate}
                variant="outlined"
                startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
                sx={outlinedBtnSx}
              >
                {copied ? t("v3.tryit.copiedBtn") : t("v3.tryit.copyBtn")}
              </Button>
            </Stack>
            <Box
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderRadius: 3,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            >
              <Typography data-testid="press-boilerplate-text" sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 }, lineHeight: 1.7 }}>
                {t("press.boilerplateBody")}
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* ── Fast facts ── */}
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
          <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 }, letterSpacing: "-0.01em", mb: { xs: 3, md: 4 } }}>
            {t("press.factsTitle")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: { xs: 2, md: 3 },
            }}
          >
            {FACTS.map((key) => (
              <Box
                key={key}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: 3,
                  border: 1,
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Typography
                  sx={{
                    color: accent,
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    mb: 0.75,
                  }}
                >
                  {t(`press.facts.${key}.label`)}
                </Typography>
                <Typography sx={{ fontWeight: 600, fontSize: 16, lineHeight: 1.55 }}>
                  {t(`press.facts.${key}.value`)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>

        {/* ── Logos & assets ── */}
        <Box sx={{ borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 7, md: 10 } }}>
            <Stack spacing={1.5} sx={{ mb: { xs: 4, md: 5 }, maxWidth: 680 }}>
              <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 34 }, letterSpacing: "-0.01em" }}>
                {t("press.logosTitle")}
              </Typography>
              <Typography sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 }, lineHeight: 1.6 }}>
                {t("press.logosBody")}
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: { xs: 2, md: 3 },
              }}
            >
              {ASSETS.map((asset) => (
                <Box
                  key={asset.key}
                  sx={{
                    borderRadius: 3,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: "background.default",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: 140,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: asset.chipBg,
                      borderBottom: `1px solid ${asset.chipBorder}`,
                      px: 3,
                    }}
                  >
                    <Box
                      component="img"
                      src={asset.file}
                      alt={t(asset.labelKey)}
                      sx={{
                        maxWidth: asset.key === "icon" ? 72 : "80%",
                        maxHeight: asset.key === "icon" ? 72 : 44,
                      }}
                    />
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>{t(asset.labelKey)}</Typography>
                    <Button
                      data-testid={`press-download-${asset.key}`}
                      component="a"
                      href={asset.file}
                      download
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadRoundedIcon />}
                      sx={{ ...outlinedBtnSx, px: 2, py: 0.75, fontSize: 13.5 }}
                    >
                      {t(asset.downloadKey)}
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* ── Media contact CTA ── */}
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
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
              {t("press.contactTitle")}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 }, mb: 3, maxWidth: 560, mx: "auto" }}>
              {t("press.contactBody")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
              <Button
                data-testid="press-cta-email"
                href="mailto:support@dynopay.com"
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
                support@dynopay.com
              </Button>
              <Button
                data-testid="press-cta-story"
                onClick={() => router.push("/about")}
                variant="outlined"
                sx={{ ...outlinedBtnSx, px: 3.5, py: 1.35 }}
              >
                {t("press.storyCta")}
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>
    </>
  );
};

export default PressPage;
