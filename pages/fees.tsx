import React, { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button, Slider } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/router";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Head from "next/head";
import { AURORA_GRADIENT, FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { AuroraInk, Eyebrow, HeadlineL, HeadlineXL } from "@/Components/Page/Home/v3/styled.v3";
import FinalCTAAurora from "@/Components/Page/Home/v3/FinalCTAAurora";
import { BRAND_ACCENT } from "@/constants/theme";

/* ── Aurora restyle of the public /fees page (2026-07-18) ── */

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

const TIERS = [
  { name: "Starter", min: 0, max: 10000, pct: 1.5, accent: "#6366F1", accentSoft: "rgba(99,102,241,0.10)" },
  { name: "Growth", min: 10000, max: 100000, pct: 1.0, accent: BRAND_ACCENT, accentSoft: "rgba(79,70,229,0.10)" },
  { name: "Scale", min: 100000, max: 500000, pct: 0.7, accent: "#4338CA", accentSoft: "rgba(67,56,202,0.12)" },
  { name: "Enterprise", min: 500000, max: null, pct: 0.5, accent: "#3730A3", accentSoft: "rgba(55,48,163,0.14)" },
];

const getTier = (v: number) => {
  if (v < 10000) return TIERS[0];
  if (v < 100000) return TIERS[1];
  if (v < 500000) return TIERS[2];
  return TIERS[3];
};

const formatUSD = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
    : `$${n.toLocaleString("en-US")}`;

const FeesPage = () => {
  const { t } = useTranslation("fees");
  const { t: tTitle } = useTranslation("pageTitles");
  const s = useAurora();
  const router = useRouter();
  const [volume, setVolume] = useState(5000);
  const [payments, setPayments] = useState(50);
  const tier = getTier(volume);
  const pctFee = (volume * tier.pct) / 100;      // percentage component
  const fixedTotal = payments * 1;               // $1 fixed per payment
  const allIn = pctFee + fixedTotal;             // true all-in cost
  const effectiveRate = volume > 0 ? (allIn / volume) * 100 : 0;

  const scrollToCalc = useCallback(() => {
    const el = document.getElementById("fee-calculator");
    if (el) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  const comparisonRows = [
    { feature: t("v3.cmpStackedFees"), dynopay: false, dynoText: t("v3.valNo"), others: true, othersText: t("v3.valOften") },
    { feature: t("v3.cmpInstantForward"), dynopay: true, dynoText: t("v3.valYes"), others: false, othersText: t("v3.valBatched") },
    { feature: t("v3.cmpClearBreakdown"), dynopay: true, dynoText: t("v3.valYes"), others: false, othersText: t("v3.valBundled") },
    { feature: t("v3.cmpNonCustodial"), dynopay: true, dynoText: t("v3.valYes"), others: false, othersText: t("v3.valRarely") },
    { feature: t("v3.cmpRealtimeCalc"), dynopay: true, dynoText: t("v3.valYes"), others: false, othersText: t("v3.valNo") },
    { feature: t("v3.cmpChargebacks"), dynopay: false, dynoText: t("v3.valNone"), others: true, othersText: t("v3.valCommon") },
  ];

  return (
    <>
      <Head>
        <title>{tTitle("fees_title")}</title>
      </Head>

      <PageWrapper sx={{ background: s.bg }}>
        {/* ===== HERO ===== */}
        <Box sx={{ position: "relative", overflow: "hidden", pb: { xs: 8, md: 12 } }}>
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
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              backgroundImage: `linear-gradient(${s.line} 1px, transparent 1px), linear-gradient(90deg, ${s.line} 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
              display: "none",
              maskImage: "radial-gradient(ellipse 90% 70% at 50% 10%, black 25%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 10%, black 25%, transparent 80%)",
            }}
          />
          <Container sx={{ position: "relative", zIndex: 1 }}>
            <Box sx={{ pt: { xs: 9, md: 16 }, pb: { xs: 6, md: 9 }, textAlign: "center" }}>
              <Eyebrow tone="coral" sx={{ mb: 3 }}>{t("v3.heroEyebrow")}</Eyebrow>
              <HeadlineXL component="h1" sx={{ color: s.ink, maxWidth: 1000, mx: "auto", mb: 3 }}>
                {t("v3.heroTitleLead")}
                <br />
                <AuroraInk>1.5% → 0.5%</AuroraInk> {t("v3.heroTitleTail")}
              </HeadlineXL>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 16, md: 18 }, color: s.ink2, maxWidth: 640, mx: "auto", lineHeight: 1.6, mb: 4 }}>
                {t("v3.heroSubtitle")}
              </Typography>
              <Button
                onClick={scrollToCalc}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                sx={{
                  borderRadius: "999px",
                  px: 4,
                  py: 1.6,
                  fontFamily: FONT_BODY,
                  fontSize: 15.5,
                  fontWeight: 600,
                  textTransform: "none",
                  color: "#fff",
                  background: BRAND_ACCENT,
                  boxShadow: "none",
                  transition: "background-color 200ms ease, transform 150ms cubic-bezier(0.16,1,0.3,1)",
                  "&:hover": { background: "#4338CA", boxShadow: "none" },
                  "&:active": { transform: "scale(0.98)" },
                }}
              >
                {t("v3.heroCta")}
              </Button>
            </Box>
          </Container>
        </Box>

        {/* ===== TIER CARDS ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
            <Box sx={{ mb: { xs: 5, md: 7 }, maxWidth: 620 }}>
              <Eyebrow tone="violet" sx={{ mb: 2 }}>{t("v3.tiersEyebrow")}</Eyebrow>
              <HeadlineL sx={{ color: s.ink }}>{t("v3.tiersTitle")}</HeadlineL>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2.5 }}>
              {TIERS.map((tr) => {
                const isCurrent = tr.name === tier.name;
                return (
                  <Box
                    key={tr.name}
                    sx={{
                      position: "relative",
                      background: isCurrent ? tr.accent : s.surface,
                      color: isCurrent ? "#fff" : s.ink,
                      border: `1px solid ${isCurrent ? tr.accent : s.line}`,
                      borderRadius: "22px",
                      p: { xs: 3, md: 3.5 },
                      minHeight: 260,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "transform .3s ease, box-shadow .3s ease",
                      boxShadow: isCurrent ? `0 24px 48px -20px ${tr.accent}88` : "none",
                      overflow: "hidden",
                      "&:hover": { transform: "translateY(-2px)" },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.22em", textTransform: "uppercase", color: isCurrent ? "rgba(255,255,255,0.85)" : tr.accent, fontWeight: 600, mb: 1.5 }}>
                        {tr.name}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 52, letterSpacing: "-0.035em", lineHeight: 1, mb: 1 }}>
                        {tr.pct}%
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: isCurrent ? "rgba(255,255,255,0.9)" : s.ink3 }}>
                        {t("v3.perPayment")}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 3, pt: 2, borderTop: `1px dashed ${isCurrent ? "rgba(255,255,255,0.35)" : s.line}` }}>
                      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, letterSpacing: "0.08em", color: isCurrent ? "rgba(255,255,255,0.9)" : s.ink3, textTransform: "uppercase" }}>
                        {t("v3.vol30d")}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 600, fontSize: 15, mt: 0.5, color: isCurrent ? "#fff" : s.ink }}>
                        {formatUSD(tr.min)}{tr.max ? ` – ${formatUSD(tr.max)}` : "+"}
                      </Typography>
                    </Box>
                    {isCurrent && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 12,
                          right: 12,
                          background: "rgba(255,255,255,0.18)",
                          border: "1px solid rgba(255,255,255,0.4)",
                          color: "#fff",
                          fontFamily: FONT_TECH,
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          borderRadius: "999px",
                          px: 1.25,
                          py: 0.3,
                        }}
                      >
                        {t("v3.yourTier")}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Container>

        {/* ===== FEE CALCULATOR ===== */}
        <Container>
          <Box component="section" id="fee-calculator" sx={{ py: { xs: 8, md: 14 } }}>
            <Box sx={{ mb: { xs: 5, md: 7 }, maxWidth: 620 }}>
              <Eyebrow tone="coral" sx={{ mb: 2 }}>{t("v3.calcEyebrow")}</Eyebrow>
              <HeadlineL sx={{ color: s.ink }}>{t("v3.calcTitle")}</HeadlineL>
            </Box>
            <Box
              sx={{
                background: s.surface,
                border: `1px solid ${s.lineStrong}`,
                borderRadius: "24px",
                p: { xs: 3, md: 5 },
                maxWidth: 860,
                mx: "auto",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  top: -60,
                  right: -60,
                  width: 220,
                  height: 220,
                  borderRadius: "50%",
                  background: tier.accent,
                  opacity: 0.10,
                  filter: "blur(30px)",
                  transition: "background .35s ease",
                }}
              />
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
                  {t("v3.monthlyVolume")}
                </Typography>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 40, md: 56 }, letterSpacing: "-0.03em", color: s.ink, lineHeight: 1 }}>
                  {formatUSD(volume)}
                </Typography>
                <Slider
                  value={volume}
                  min={500}
                  max={1000000}
                  step={500}
                  onChange={(_, v) => setVolume(v as number)}
                  sx={{
                    mt: 3,
                    color: tier.accent,
                    height: 6,
                    "& .MuiSlider-thumb": {
                      width: 22,
                      height: 22,
                      background: "#fff",
                      border: `3px solid ${tier.accent}`,
                      boxShadow: `0 4px 14px ${tier.accent}55`,
                    },
                    "& .MuiSlider-track": { border: "none" },
                    "& .MuiSlider-rail": { background: s.line, opacity: 1 },
                  }}
                />
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3 }}>$500</Typography>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3 }}>$1M</Typography>
                </Box>

                {/* Number of payments — drives the $1 fixed-fee component */}
                <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink3, mt: 4, mb: 1 }}>
                  {t("v3.paymentsLabel")}
                </Typography>
                <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 28, md: 34 }, letterSpacing: "-0.02em", color: s.ink, lineHeight: 1 }}>
                  {payments.toLocaleString("en-US")}
                </Typography>
                <Slider
                  value={payments}
                  min={1}
                  max={5000}
                  step={1}
                  onChange={(_, v) => setPayments(v as number)}
                  aria-label={t("v3.paymentsLabel")}
                  sx={{
                    mt: 2,
                    color: tier.accent,
                    height: 6,
                    "& .MuiSlider-thumb": {
                      width: 22,
                      height: 22,
                      background: "#fff",
                      border: `3px solid ${tier.accent}`,
                      boxShadow: `0 4px 14px ${tier.accent}55`,
                    },
                    "& .MuiSlider-track": { border: "none" },
                    "& .MuiSlider-rail": { background: s.line, opacity: 1 },
                  }}
                />
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3 }}>1</Typography>
                  <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3 }}>5,000</Typography>
                </Box>

                {/* Result */}
                <Box sx={{ mt: 4, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 0, border: `1px solid ${s.line}`, borderRadius: "16px", overflow: "hidden" }}>
                  <Box sx={{ p: 2.5, borderRight: { xs: "none", sm: `1px solid ${s.line}` }, borderBottom: { xs: `1px solid ${s.line}`, sm: "none" } }}>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, letterSpacing: "0.14em", textTransform: "uppercase", mb: 1 }}>
                      {t("v3.colTier")}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, color: tier.accent }}>
                      {tier.name}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5, borderRight: { xs: "none", sm: `1px solid ${s.line}` }, borderBottom: { xs: `1px solid ${s.line}`, sm: "none" } }}>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, letterSpacing: "0.14em", textTransform: "uppercase", mb: 1 }}>
                      {t("v3.colRate")}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, color: s.ink }}>
                      {tier.pct}%
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5, background: tier.accentSoft }}>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, letterSpacing: "0.14em", textTransform: "uppercase", mb: 1 }}>
                      {t("v3.youdPay")}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 22, color: s.ink }}>
                      ${allIn.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11.5, color: s.ink3, mt: 0.5 }}>
                      {tier.pct}% (${pctFee.toLocaleString("en-US", { maximumFractionDigits: 2 })}) + $1 × {payments.toLocaleString("en-US")}
                    </Typography>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: tier.accent, mt: 0.25 }}>
                      ≈ {effectiveRate.toFixed(2)}% {t("v3.effectiveRate")}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                  <Button
                    onClick={() => router.push("/auth/register")}
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      borderRadius: "999px",
                      px: 4,
                      py: 1.4,
                      fontFamily: FONT_BODY,
                      fontSize: 15,
                      fontWeight: 600,
                      textTransform: "none",
                      color: "#fff",
                      background: BRAND_ACCENT,
                      "&:hover": { background: "#4338CA" },
                    }}
                  >
                    {t("v3.calcCta")}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Container>

        {/* ===== COMPARISON ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
            <Box sx={{ mb: { xs: 5, md: 7 }, maxWidth: 620 }}>
              <Eyebrow tone="violet" sx={{ mb: 2 }}>{t("v3.compareEyebrow")}</Eyebrow>
              <HeadlineL sx={{ color: s.ink }}>{t("v3.compareTitle")}</HeadlineL>
            </Box>
            <Box sx={{ maxWidth: 900, mx: "auto", borderRadius: "20px", overflow: "hidden", border: `1px solid ${s.line}`, background: s.surface }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 1fr 1fr", sm: "2fr 1fr 1fr" }, px: { xs: 2, sm: 3 }, py: 2, borderBottom: `1px solid ${s.lineStrong}`, background: s.bgAlt }}>
                {[t("v3.colFeature"), "Dynopay", t("v3.colOthers")].map((h, i) => (
                  <Typography key={h} sx={{ fontFamily: FONT_TECH, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink, textAlign: i === 0 ? "left" : "center" }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {comparisonRows.map((row, idx) => (
                <Box key={idx} sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 1fr 1fr", sm: "2fr 1fr 1fr" }, alignItems: "center", px: { xs: 2, sm: 3 }, py: 2, "&:not(:last-child)": { borderBottom: `1px solid ${s.line}` } }}>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2 }}>{row.feature}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {row.dynopay ? <CheckIcon sx={{ fontSize: 16, color: s.dark ? "#818CF8" : BRAND_ACCENT }} /> : <CloseIcon sx={{ fontSize: 16, color: s.dark ? "#818CF8" : BRAND_ACCENT }} />}
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, fontWeight: 600, color: s.dark ? "#818CF8" : BRAND_ACCENT }}>
                      {row.dynoText}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {row.others ? <CheckIcon sx={{ fontSize: 16, color: "#EF4444" }} /> : <CloseIcon sx={{ fontSize: 16, color: "#EF4444" }} />}
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12.5, color: "#EF4444" }}>
                      {row.othersText}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>

        {/* ===== WHO PAYS THE FEE? ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
            <Box sx={{ mb: { xs: 5, md: 7 }, maxWidth: 640 }}>
              <Eyebrow tone="violet" sx={{ mb: 2 }}>{t("v3.whoPaysEyebrow")}</Eyebrow>
              <HeadlineL sx={{ color: s.ink }}>{t("v3.whoPaysTitle")}</HeadlineL>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16.5 }, color: s.ink2, mt: 2.5, lineHeight: 1.6 }}>
                {t("v3.whoPaysBody")}
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, maxWidth: 900 }}>
              {[
                { title: t("v3.wpMerchantTitle"), desc: t("v3.wpMerchantDesc"), highlight: false },
                { title: t("v3.wpCustomerTitle"), desc: t("v3.wpCustomerDesc"), highlight: true },
              ].map((c) => (
                <Box
                  key={c.title}
                  sx={{
                    background: c.highlight ? BRAND_ACCENT : s.surface,
                    color: c.highlight ? "#fff" : s.ink,
                    border: `1px solid ${c.highlight ? BRAND_ACCENT : s.line}`,
                    borderRadius: "22px",
                    p: { xs: 3, md: 4 },
                    transition: "transform .3s ease",
                    "&:hover": { transform: "translateY(-2px)" },
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 21, letterSpacing: "-0.02em", mb: 1.5 }}>
                    {c.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.65, color: c.highlight ? "rgba(255,255,255,0.9)" : s.ink2 }}>
                    {c.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink3, mt: 3, maxWidth: 900, lineHeight: 1.5 }}>
              {t("v3.wpFootnote")}
            </Typography>
          </Box>
        </Container>

        {/* ===== EVERYTHING INCLUDED FREE ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
            <Box sx={{ mb: { xs: 5, md: 7 }, maxWidth: 640 }}>
              <Eyebrow tone="coral" sx={{ mb: 2 }}>{t("v3.includedEyebrow")}</Eyebrow>
              <HeadlineL sx={{ color: s.ink }}>{t("v3.includedTitle")}</HeadlineL>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 15, md: 16.5 }, color: s.ink2, mt: 2.5, lineHeight: 1.6 }}>
                {t("v3.includedBody")}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
                gap: 1.5,
              }}
            >
              {["inc1", "inc2", "inc3", "inc4", "inc5", "inc6", "inc7", "inc8", "inc9"].map((k) => (
                <Box
                  key={k}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "14px",
                    px: 2.5,
                    py: 2,
                  }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: s.dark ? "rgba(129,140,248,0.16)" : "rgba(79,70,229,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckIcon sx={{ fontSize: 16, color: s.dark ? "#818CF8" : BRAND_ACCENT }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink, lineHeight: 1.4 }}>
                    {t(`v3.${k}`)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>

        {/* ===== SECURITY ===== */}
        <Container>
          <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
            <Box sx={{ mb: { xs: 5, md: 6 }, maxWidth: 620 }}>
              <Eyebrow tone="coral" sx={{ mb: 2 }}>{t("v3.secEyebrow")}</Eyebrow>
              <HeadlineL sx={{ color: s.ink }}>{t("v3.secTitle")}</HeadlineL>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2.5 }}>
              {[
                { title: t("v3.sec1Title"), body: t("v3.sec1Body") },
                { title: t("v3.sec2Title"), body: t("v3.sec2Body") },
                { title: t("v3.sec3Title"), body: t("v3.sec3Body") },
              ].map((item) => (
                <Box
                  key={item.title}
                  sx={{
                    background: s.surface,
                    border: `1px solid ${s.line}`,
                    borderRadius: "18px",
                    p: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                    transition: "transform .3s ease, border-color .3s ease",
                    "&:hover": { transform: "translateY(-2px)", borderColor: BRAND_ACCENT },
                  }}
                >
                  <ShieldOutlinedIcon sx={{ color: BRAND_ACCENT, fontSize: 22 }} />
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, color: s.ink, letterSpacing: "-0.01em" }}>{item.title}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2, lineHeight: 1.6 }}>{item.body}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>

        <FinalCTAAurora />
      </PageWrapper>
    </>
  );
};

export default memo(FeesPage);
