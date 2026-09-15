import React, { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button, Slider, TextField, MenuItem } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useRouter } from "next/router";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BoltIcon from "@mui/icons-material/Bolt";
import Head from "next/head";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { AuroraInk } from "@/Components/Page/Home/v3/styled.v3";
import PublicPageHero from "@/Components/Page/Home/v5/PublicPageHero";
import PublicFinalCta from "@/Components/Page/Home/v5/PublicFinalCta";
import { Section, SectionHead, PrimaryBtn, SecondaryBtn, cardSx } from "@/Components/Page/Home/v5/shared";
import { Stagger, StaggerItem } from "@/Components/Page/Home/motion/Stagger";
import { BRAND_ACCENT } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";
import FeesWorkedExample from "@/Components/Page/Fees/WorkedExample";

/* ── Aurora restyle of the public /fees page (2026-07-18) ── */

const PageWrapper = styled(Box)({ width: "100%" });

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

// Exact 2dp currency for the per-payment breakdown (QA #47).
const fmtMoney = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Representative settlement assets + their typical flat on-chain (network) fee
// in USD terms. Used by the per-payment breakdown so merchants see the real
// net after the platform fee AND the blockchain fee for the chain they settle on.
const SETTLE_CURRENCIES = [
  { code: "USDT-TRC20", label: "USDT · Tron (TRC-20)", netFee: 1.0, apiKey: "USDT_TRC20" },
  { code: "USDC-SOL", label: "USDC · Solana", netFee: 0.01, apiKey: "SOL" },
  { code: "USDC-POLYGON", label: "USDC · Polygon", netFee: 0.03, apiKey: "POLYGON" },
  { code: "USDC-ERC20", label: "USDC · Ethereum (ERC-20)", netFee: 3.5, apiKey: "USDC_ERC20" },
  { code: "USDT-ERC20", label: "USDT · Ethereum (ERC-20)", netFee: 3.5, apiKey: "USDT_ERC20" },
  { code: "ETH", label: "ETH · Ethereum", netFee: 3.5, apiKey: "ETH" },
  { code: "BTC", label: "BTC · Bitcoin", netFee: 2.5, apiKey: "BTC" },
];

// Small network fees (e.g. Solana/Polygon) round to $0.00 at 2dp — show a friendlier hint.
const fmtFee = (n: number) => (n > 0 && n < 0.01 ? "< $0.01" : fmtMoney(n));

const FeesPage = () => {
  const { t } = useTranslation("fees");
  const { t: tTitle } = useTranslation("pageTitles");
  const { t: tLanding } = useTranslation("landing");
  const s = useAurora();
  const router = useRouter();
  const [volume, setVolume] = useState(5000);
  const [payments, setPayments] = useState(50);
  const tier = getTier(volume);
  const pctFee = (volume * tier.pct) / 100;      // percentage component
  const fixedTotal = payments * 1;               // $1 fixed per payment
  const allIn = pctFee + fixedTotal;             // true all-in cost
  const effectiveRate = volume > 0 ? (allIn / volume) * 100 : 0;

  // Per-payment breakdown state (QA #47): amount + settlement currency drive a
  // clear Platform fee / Blockchain fee / Total fee / Net-to-merchant summary.
  const [payAmount, setPayAmount] = useState(100);
  const [currency, setCurrency] = useState("USDT-TRC20");
  // Live per-chain network fees (USD) from the same public endpoint the checkout uses.
  const [liveFees, setLiveFees] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/pay/network-fees")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        const map: Record<string, number> = {};
        for (const c of SETTLE_CURRENCIES) {
          const f = j.data[c.apiKey];
          if (f && typeof f.feeInUSD === "number") map[c.code] = f.feeInUSD;
        }
        setLiveFees(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const selCur = SETTLE_CURRENCIES.find((c) => c.code === currency) || SETTLE_CURRENCIES[0];
  // Public calculator only surfaces the on-chain network fee; the platform fee
  // (tier % + fixed) is intentionally omitted here and shown on the invoice instead.
  const liveFee = liveFees ? liveFees[currency] : undefined;
  const blockchainFee = liveFee != null ? liveFee : selCur.netFee;
  const netToMerchant = Math.max(0, payAmount - blockchainFee);
  // Cheapest payout route across all settlement options (live fee when available).
  const feeFor = (c: (typeof SETTLE_CURRENCIES)[number]) =>
    liveFees && liveFees[c.code] != null ? (liveFees[c.code] as number) : c.netFee;
  const cheapest = SETTLE_CURRENCIES.reduce(
    (a, c) => (feeFor(c) < feeFor(a) ? c : a),
    SETTLE_CURRENCIES[0]
  );
  const onCheapest = currency === cheapest.code;

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

  const faqItems = t("v3.faqItems", { returnObjects: true, defaultValue: [] }) as
    | Array<{ q: string; a: string }>
    | string;
  const faqs: Array<{ q: string; a: string }> = Array.isArray(faqItems) ? faqItems : [];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Crypto payment gateway",
    name: "Dynopay",
    url: "https://dynopay.com/fees",
    provider: { "@type": "Organization", name: "Dynopay", url: "https://dynopay.com" },
    areaServed: "Worldwide",
    description:
      "Accept crypto payments with transparent fees from 1.5% down to 0.5% by volume. Non-custodial, no chargebacks, no monthly fees. First payment free.",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Dynopay pricing tiers",
      itemListElement: TIERS.map((tr) => ({
        "@type": "Offer",
        name: tr.name,
        description:
          tr.max === null
            ? `${tr.pct}% per transaction for monthly volume above ${formatUSD(tr.min)}`
            : `${tr.pct}% per transaction for monthly volume ${formatUSD(tr.min)}–${formatUSD(tr.max)}`,
      })),
    },
  };

  return (
    <>
      <Head>
        <title>{tTitle("fees_title")}</title>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      </Head>

      <PageWrapper sx={{ background: s.bg }}>
        {/* ===== HERO ===== */}
        <PublicPageHero
          testId="fees-hero"
          eyebrow={t("v3.heroEyebrow")}
          title={
            <>
              {t("v3.heroTitleLead")}
              <br />
              <AuroraInk>1.5% → 0.5%</AuroraInk> {t("v3.heroTitleTail")}
            </>
          }
          body={t("v3.heroSubtitle")}
          actions={
            <>
              <PrimaryBtn data-testid="fees-hero-cta" onClick={scrollToCalc} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
                {t("v3.heroCta")}
              </PrimaryBtn>
              <SecondaryBtn data-testid="fees-hero-start" onClick={() => router.push("/auth/register?ref=fees_hero")}>
                {tLanding("startFree")}
              </SecondaryBtn>
            </>
          }
        />

        {/* ===== TIER CARDS ===== */}
        <Section alt testId="fees-tiers">
          <SectionHead eyebrow={t("v3.tiersEyebrow")} headline={t("v3.tiersTitle")} />
          <Stagger step={0.07} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
              {TIERS.map((tr, ti) => {
                const isCurrent = tr.name === tier.name;
                return (
                  <StaggerItem key={tr.name} i={ti} y={16}>
                  <Box
                    data-testid={`fees-tier-${tr.name.toLowerCase()}`}
                    sx={{
                      ...cardSx(s),
                      position: "relative",
                      height: "100%",
                      background: isCurrent ? tr.accent : s.surface,
                      color: isCurrent ? "#fff" : s.ink,
                      border: `1px solid ${isCurrent ? tr.accent : s.line}`,
                      p: { xs: 3, md: 3.5 },
                      minHeight: 260,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: isCurrent ? `0 24px 48px -20px ${tr.accent}88` : "none",
                      overflow: "hidden",
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
                  </StaggerItem>
                );
              })}
          </Stagger>
        </Section>

        {/* ===== WORKED EXAMPLE — "$100 sale → you receive $X" (Wave 7) ===== */}
        <Section testId="fees-worked" sx={{ pb: { xs: 0, md: 0 } }}>
          <FeesWorkedExample
            tiers={TIERS}
            currentTierName={tier.name}
            currencies={SETTLE_CURRENCIES}
            feeFor={(c) => feeFor(c as (typeof SETTLE_CURRENCIES)[number])}
            live={!!liveFees}
          />
        </Section>

        {/* ===== FEE CALCULATOR ===== */}
        <Section id="fee-calculator" testId="fees-calculator">
          <SectionHead eyebrow={t("v3.calcEyebrow")} headline={t("v3.calcTitle")} />
          <Stagger step={0.1} sx={{ display: "grid" }}>
          <StaggerItem i={0} y={20}>
            <Box
              sx={{
                ...cardSx(s, { hover: false, radius: 24 }),
                border: `1px solid ${s.lineStrong}`,
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
                  aria-label={t("v3.volumeSliderLabel", { defaultValue: "Monthly volume" })}
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
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: tier.accent, mt: 0.25 }}>
                      ≈ {toFixedStr(effectiveRate, 2)}% {t("v3.effectiveRate")}
                    </Typography>
                  </Box>
                </Box>

                {/* Per-payment breakdown + settlement currency (QA #47) */}
                <Box sx={{ mt: 4 }} data-testid="fee-breakdown">
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                    <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink3 }}>
                      {t("v3.breakdownTitle", { defaultValue: "Per-payment breakdown" })}
                    </Typography>
                    {liveFees && (
                      <Box data-testid="fee-live-badge" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: 999, background: tier.accentSoft }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: tier.accent }}>
                          {t("v3.liveFees", { defaultValue: "Live network fees" })}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}>
                    <TextField
                      type="number"
                      size="small"
                      label={t("v3.paymentAmount", { defaultValue: "Payment amount (USD)" })}
                      value={payAmount}
                      onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value) || 0))}
                      inputProps={{ min: 0, "data-testid": "fee-calc-amount-input" }}
                      InputProps={{ startAdornment: <Typography sx={{ color: s.ink3, mr: 0.5 }}>$</Typography> }}
                    />
                    <TextField
                      select
                      size="small"
                      label={t("v3.settleCurrency", { defaultValue: "Settlement currency" })}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      SelectProps={{ SelectDisplayProps: { "data-testid": "fee-calc-currency-select" } as React.HTMLAttributes<HTMLDivElement> }}
                    >
                      {SETTLE_CURRENCIES.map((c) => (
                        <MenuItem key={c.code} value={c.code} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                          <span>{c.label}</span>
                          {c.code === cheapest.code && (
                            <Box component="span" sx={{ fontFamily: FONT_TECH, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: tier.accent, background: tier.accentSoft, px: 0.75, py: 0.25, borderRadius: 999 }}>
                              {t("v3.lowestFee", { defaultValue: "Lowest fee" })}
                            </Box>
                          )}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  {/* Cheapest-chain hint — best payout route (QA follow-up) */}
                  <Box
                    data-testid="fee-cheapest-hint"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1.5,
                      flexWrap: "wrap",
                      mb: 3,
                      px: 2,
                      py: 1.25,
                      borderRadius: "12px",
                      border: `1px solid ${onCheapest ? "rgba(34,197,94,0.35)" : s.line}`,
                      background: onCheapest ? "rgba(34,197,94,0.08)" : tier.accentSoft,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BoltIcon sx={{ fontSize: 18, color: onCheapest ? "#16A34A" : tier.accent }} />
                      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: s.ink2 }}>
                        {onCheapest
                          ? t("v3.cheapestOn", { defaultValue: "You're on the cheapest payout route" })
                          : `${t("v3.cheapestHint", { defaultValue: "Cheapest payout route" })}: ${cheapest.label} — ${fmtFee(feeFor(cheapest))} ${t("v3.networkFeeWord", { defaultValue: "network fee" })}`}
                      </Typography>
                    </Box>
                    {!onCheapest && (
                      <Button
                        size="small"
                        onClick={() => setCurrency(cheapest.code)}
                        data-testid="fee-use-cheapest"
                        sx={{ textTransform: "none", fontFamily: FONT_BODY, fontWeight: 700, color: tier.accent, borderRadius: 999, px: 1.5 }}
                      >
                        {t("v3.useCheapest", { defaultValue: "Use it" })}
                      </Button>
                    )}
                  </Box>
                  <Box sx={{ border: `1px solid ${s.line}`, borderRadius: "16px", overflow: "hidden" }}>
                    {[
                      { label: t("v3.bdPaymentAmount", { defaultValue: "Payment amount" }), value: fmtMoney(payAmount), sub: null as string | null },
                      { label: t("v3.bdBlockchainFee", { defaultValue: "Blockchain / network fee" }), value: fmtFee(blockchainFee), sub: liveFee != null ? `${selCur.label} · live rate` : selCur.label },
                    ].map((row, i) => (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.75, borderBottom: `1px solid ${s.line}` }}>
                        <Box>
                          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2 }}>{row.label}</Typography>
                          {row.sub && <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, color: s.ink3, mt: 0.25 }}>{row.sub}</Typography>}
                        </Box>
                        <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 16, color: s.ink }} data-testid={`fee-row-value-${i}`}>{row.value}</Typography>
                      </Box>
                    ))}
                    <Box data-testid="fee-breakdown-net" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2, background: tier.accentSoft }}>
                      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, fontWeight: 600, color: s.ink }}>
                        {t("v3.bdNetToMerchant", { defaultValue: "Net to merchant" })}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 20, color: tier.accent }}>{fmtMoney(netToMerchant)}</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
                  <PrimaryBtn data-testid="fees-calc-cta" onClick={() => router.push("/auth/register?ref=fees_calculator")} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}>
                    {t("v3.calcCta")}
                  </PrimaryBtn>
                </Box>
              </Box>
            </Box>
          </StaggerItem>
          </Stagger>
        </Section>

        {/* ===== COMPARISON ===== */}
        <Section alt testId="fees-compare">
          <SectionHead eyebrow={t("v3.compareEyebrow")} headline={t("v3.compareTitle")} />
          <Stagger step={0.1} sx={{ display: "grid" }}>
          <StaggerItem i={0} y={20}>
            <Box sx={{ ...cardSx(s, { hover: false }), maxWidth: 900, mx: "auto", overflow: "hidden" }}>
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
          </StaggerItem>
          </Stagger>
        </Section>

        {/* ===== WHO PAYS THE FEE? ===== */}
        <Section testId="fees-who-pays">
          <SectionHead eyebrow={t("v3.whoPaysEyebrow")} headline={t("v3.whoPaysTitle")} body={t("v3.whoPaysBody")} />
          <Stagger step={0.08} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, maxWidth: 900 }}>
              {[
                { title: t("v3.wpMerchantTitle"), desc: t("v3.wpMerchantDesc"), highlight: false },
                { title: t("v3.wpCustomerTitle"), desc: t("v3.wpCustomerDesc"), highlight: true },
              ].map((c, ci) => (
                <StaggerItem key={c.title} i={ci} y={16}>
                <Box
                  sx={{
                    ...cardSx(s),
                    height: "100%",
                    background: c.highlight ? BRAND_ACCENT : s.surface,
                    color: c.highlight ? "#fff" : s.ink,
                    border: `1px solid ${c.highlight ? BRAND_ACCENT : s.line}`,
                    p: { xs: 3, md: 4 },
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 21, letterSpacing: "-0.02em", mb: 1.5 }}>
                    {c.title}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.65, color: c.highlight ? "rgba(255,255,255,0.9)" : s.ink2 }}>
                    {c.desc}
                  </Typography>
                </Box>
                </StaggerItem>
              ))}
          </Stagger>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 12, color: s.ink3, mt: 3, maxWidth: 900, lineHeight: 1.5 }}>
            {t("v3.wpFootnote")}
          </Typography>
        </Section>

        {/* ===== EVERYTHING INCLUDED FREE ===== */}
        <Section alt testId="fees-included">
          <SectionHead eyebrow={t("v3.includedEyebrow")} headline={t("v3.includedTitle")} body={t("v3.includedBody")} />
          <Stagger step={0.05} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }, gap: 1.5 }}>
              {["inc1", "inc2", "inc3", "inc4", "inc5", "inc6", "inc7", "inc8", "inc9"].map((k, ki) => (
                <StaggerItem key={k} i={ki} y={12}>
                <Box
                  sx={{
                    ...cardSx(s, { hover: false, radius: 14 }),
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    height: "100%",
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
                </StaggerItem>
              ))}
          </Stagger>
        </Section>

        {/* ===== SECURITY ===== */}
        <Section testId="fees-security">
          <SectionHead eyebrow={t("v3.secEyebrow")} headline={t("v3.secTitle")} />
          <Stagger step={0.08} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
              {[
                { title: t("v3.sec1Title"), body: t("v3.sec1Body") },
                { title: t("v3.sec2Title"), body: t("v3.sec2Body") },
                { title: t("v3.sec3Title"), body: t("v3.sec3Body") },
              ].map((item, ii) => (
                <StaggerItem key={item.title} i={ii} y={16}>
                <Box
                  sx={{
                    ...cardSx(s),
                    height: "100%",
                    p: 3,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ width: 44, height: 44, borderRadius: "12px", display: "grid", placeItems: "center", background: s.dark ? "rgba(129,140,248,0.14)" : "rgba(79,70,229,0.09)", color: s.dark ? "#818CF8" : BRAND_ACCENT }}>
                    <ShieldOutlinedIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, color: s.ink, letterSpacing: "-0.01em" }}>{item.title}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2, lineHeight: 1.6 }}>{item.body}</Typography>
                </Box>
                </StaggerItem>
              ))}
          </Stagger>
        </Section>

        {/* ===== FAQ ===== */}
        <Section alt testId="fees-faq-section">
          <SectionHead eyebrow={t("v3.faqEyebrow")} headline={t("v3.faqTitle")} />
          <Stagger step={0.05} sx={{ display: "flex", flexDirection: "column", gap: 1.5, maxWidth: 900 }}>
              {faqs.map((f, i) => (
                <StaggerItem key={i} i={i} y={12}>
                <Box
                  component="article"
                  data-testid={`fees-faq-${i}`}
                  sx={{
                    ...cardSx(s, { hover: false }),
                    p: { xs: 2.5, md: 3 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                  }}
                >
                  <Typography component="h2" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 16, md: 18 }, color: s.ink, letterSpacing: "-0.01em" }}>
                    {f.q}
                  </Typography>
                  <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14, md: 15 }, color: s.ink2, lineHeight: 1.65 }}>
                    {f.a}
                  </Typography>
                </Box>
                </StaggerItem>
              ))}
          </Stagger>
        </Section>

        <PublicFinalCta attributionRef="fees_final" />
      </PageWrapper>
    </>
  );
};

export default memo(FeesPage);
