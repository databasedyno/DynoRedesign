import React, { useCallback, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import CtaBand from "@/Components/Page/Home/v5/CtaBand";

const FACTS = ["founded", "product", "pricing", "networks", "settlement", "chargebacks"] as const;

const ASSETS = [
  { key: "black", labelKey: "press.logoBlackLabel", file: "/press/dynopay-logo-black.svg", downloadKey: "press.downloadSvg", chipBg: "#f8fafc", chipBorder: "rgba(15,23,42,0.12)" },
  { key: "white", labelKey: "press.logoWhiteLabel", file: "/press/dynopay-logo-white.svg", downloadKey: "press.downloadSvg", chipBg: "#0b0b12", chipBorder: "rgba(255,255,255,0.14)" },
  { key: "icon", labelKey: "press.iconLabel", file: "/press/dynopay-icon-512.png", downloadKey: "press.downloadPng", chipBg: "#f8fafc", chipBorder: "rgba(15,23,42,0.12)" },
] as const;

const PressPage: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation("landing");
  const s = useAurora();
  const accent = s.dark ? "#818CF8" : BRAND_ACCENT;
  const [copied, setCopied] = useState(false);

  const copyBoilerplate = useCallback(async () => {
    const text = t("press.boilerplateBody");
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
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

  return (
    <>
      <Head>
        <title>{t("press.metaTitle")}</title>
        <meta name="description" content={t("press.metaDescription")} />
        <meta key="og:image" property="og:image" content="https://dynopay.com/og/press.png" />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Dynopay press &amp; media kit" />
        <meta key="twitter:image" name="twitter:image" content="https://dynopay.com/og/press.png" />
      </Head>

      <Box component="main">
        <PublicPageHero
          eyebrow={t("press.eyebrow")}
          title={t("press.heroTitle")}
          body={t("press.heroBody")}
          actions={
            <>
              <PrimaryBtn data-testid="press-contact-btn" href="mailto:support@dynopay.com" startIcon={<MailOutlineRoundedIcon sx={{ fontSize: 18 }} />}>
                support@dynopay.com
              </PrimaryBtn>
              <SecondaryBtn data-testid="press-story-btn" onClick={() => router.push("/about")} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 18 }} />}>
                {t("press.storyCta")}
              </SecondaryBtn>
            </>
          }
        />

        {/* Boilerplate */}
        <Section alt testId="press-boilerplate">
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", mb: 3 }}>
            <Typography component="h2" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 24, md: 30 }, letterSpacing: "-0.02em", color: s.ink }}>
              {t("press.boilerplateTitle")}
            </Typography>
            <SecondaryBtn data-testid="press-copy-boilerplate" small onClick={copyBoilerplate} startIcon={copied ? <CheckRoundedIcon sx={{ fontSize: 17 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 17 }} />}>
              {copied ? t("v3.tryit.copiedBtn") : t("v3.tryit.copyBtn")}
            </SecondaryBtn>
          </Box>
          <Box sx={{ p: { xs: 2.75, md: 3.5 }, borderRadius: "18px", border: `1px solid ${s.line}`, background: s.surface }}>
            <Typography data-testid="press-boilerplate-text" sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 15, md: 17 }, lineHeight: 1.7 }}>
              {t("press.boilerplateBody")}
            </Typography>
          </Box>
        </Section>

        {/* Fast facts */}
        <Section testId="press-facts">
          <SectionHead eyebrow={t("press.eyebrow")} headline={t("press.factsTitle")} />
          <Stagger step={0.05} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: { xs: 1.75, md: 2 } }}>
            {FACTS.map((key, i) => (
              <StaggerItem key={key} i={i} y={16}>
                <Box sx={{ height: "100%", borderRadius: "18px", border: `1px solid ${s.line}`, background: s.surface, p: { xs: 2.5, md: 3 }, transition: "border-color 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)", "&:hover": { borderColor: s.lineStrong, transform: "translateY(-2px)" } }}>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, mb: 1 }}>
                    {t(`press.facts.${key}.label`)}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 16, lineHeight: 1.55, color: s.ink }}>
                    {t(`press.facts.${key}.value`)}
                  </Typography>
                </Box>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        {/* Logos & assets */}
        <Section alt testId="press-logos">
          <SectionHead eyebrow={t("press.eyebrow")} headline={t("press.logosTitle")} body={t("press.logosBody")} />
          <Stagger step={0.06} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: { xs: 2, md: 2.5 } }}>
            {ASSETS.map((asset, i) => (
              <StaggerItem key={asset.key} i={i} y={16}>
                <Box sx={{ height: "100%", borderRadius: "18px", border: `1px solid ${s.line}`, background: s.surface, overflow: "hidden", transition: "border-color 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)", "&:hover": { borderColor: s.lineStrong, transform: "translateY(-2px)" } }}>
                  <Box sx={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: asset.chipBg, borderBottom: `1px solid ${asset.chipBorder}`, px: 3 }}>
                    <Box component="img" src={asset.file} alt={t(asset.labelKey)} sx={{ maxWidth: asset.key === "icon" ? 72 : "80%", maxHeight: asset.key === "icon" ? 72 : 44 }} />
                  </Box>
                  <Box sx={{ p: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 15, color: s.ink }}>{t(asset.labelKey)}</Typography>
                    <Button
                      data-testid={`press-download-${asset.key}`}
                      component="a"
                      href={asset.file}
                      download
                      size="small"
                      startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                      sx={{ textTransform: "none", fontFamily: FONT_BODY, fontWeight: 600, fontSize: 13.5, color: accent, borderRadius: "999px", px: 1.75, "&:hover": { background: s.dark ? "rgba(129,140,248,0.10)" : "rgba(79,70,229,0.06)" } }}
                    >
                      {t(asset.downloadKey)}
                    </Button>
                  </Box>
                </Box>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>

        <CtaBand
          testId="press-cta"
          title={t("press.contactTitle")}
          body={t("press.contactBody")}
          actions={
            <>
              <PrimaryBtn data-testid="press-cta-email" href="mailto:support@dynopay.com" startIcon={<MailOutlineRoundedIcon sx={{ fontSize: 18 }} />}>
                support@dynopay.com
              </PrimaryBtn>
              <SecondaryBtn onDark data-testid="press-cta-story" onClick={() => router.push("/about")}>
                {t("press.storyCta")}
              </SecondaryBtn>
            </>
          }
        />
      </Box>
    </>
  );
};

export default PressPage;
