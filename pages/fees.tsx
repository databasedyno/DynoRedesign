import React, { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button, Slider, TextField, MenuItem } from "@mui/material";
import { useRouter } from "next/router";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BoltIcon from "@mui/icons-material/Bolt";
import { Icon } from "@iconify/react";
import Head from "next/head";
import {
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  GradientText,
  PANEL,
  PANEL_GLOW,
  PrimaryBtn,
  SecondaryBtn,
  Reveal,
  SectionV8,
  SectionHeadV8,
  useConsole,
} from "@/Components/Page/Home/v8/kit";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import { toFixedStr } from "@/utils/money";
import { formatLocaleInt, formatWithSymbol } from "@/utils/locale";

/* ── /fees rebuilt on the v8 marketing system (2026-10). Same real tier model,
 *    live network-fee calculator (GET /api/pay/network-fees), comparison, FAQ
 *    and JSON-LD as before — premium light-first shell with dark data panels. ── */

const GOLD = "#FFD100";

const TIERS = [
  { name: "Starter", min: 0, max: 10000, pct: 1.5 },
  { name: "Growth", min: 10000, max: 100000, pct: 1.0 },
  { name: "Scale", min: 100000, max: 500000, pct: 0.7 },
  { name: "Enterprise", min: 500000, max: null as number | null, pct: 0.5 },
];

const getTier = (v: number) => {
  if (v < 10000) return TIERS[0];
  if (v < 100000) return TIERS[1];
  if (v < 500000) return TIERS[2];
  return TIERS[3];
};

const formatUSD = (n: number) =>
  n >= 1000 ? formatWithSymbol(n / 1000, "$", Number.isInteger(n / 1000) ? 0 : 1, "k") : formatWithSymbol(n, "$", 0);

const fmtMoney = (n: number) => formatWithSymbol(n, "$", 2);

const SETTLE_CURRENCIES = [
  { code: "USDT-TRC20", label: "USDT · Tron (TRC-20)", asset: "usdt", netFee: 1.0, apiKey: "USDT_TRC20" },
  { code: "USDC-SOL", label: "USDC · Solana", asset: "usdc", netFee: 0.01, apiKey: "SOL" },
  { code: "USDC-POLYGON", label: "USDC · Polygon", asset: "usdc", netFee: 0.03, apiKey: "POLYGON" },
  { code: "USDC-ERC20", label: "USDC · Ethereum (ERC-20)", asset: "usdc", netFee: 3.5, apiKey: "USDC_ERC20" },
  { code: "USDT-ERC20", label: "USDT · Ethereum (ERC-20)", asset: "usdt", netFee: 3.5, apiKey: "USDT_ERC20" },
  { code: "ETH", label: "ETH · Ethereum", asset: "eth", netFee: 3.5, apiKey: "ETH" },
  { code: "BTC", label: "BTC · Bitcoin", asset: "btc", netFee: 2.5, apiKey: "BTC" },
];

// Brand coin glyph (matches the v8 homepage CheckoutCard icon set).
const CoinGlyph = ({ asset, size = 20 }: { asset: string; size?: number }) => (
  <Box component="span" sx={{ display: "inline-flex", flexShrink: 0, lineHeight: 0 }}>
    <Icon icon={`cryptocurrency-color:${asset}`} width={size} height={size} />
  </Box>
);

const fmtFee = (n: number) => (n > 0 && n < 0.01 ? "< $0.01" : fmtMoney(n));

const FeesPage = () => {
  const { t } = useTranslation("fees");
  const { t: tTitle } = useTranslation("pageTitles");
  const { t: tLanding } = useTranslation("landing");
  const s = useConsole();
  const router = useRouter();

  const [volume, setVolume] = useState(5000);
  const [payments, setPayments] = useState(50);
  const tier = getTier(volume);
  const pctFee = (volume * tier.pct) / 100;
  const fixedTotal = payments * 1;
  const allIn = pctFee + fixedTotal;
  const effectiveRate = volume > 0 ? (allIn / volume) * 100 : 0;

  const [payAmount, setPayAmount] = useState(100);
  const [currency, setCurrency] = useState("USDT-TRC20");
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
  const liveFee = liveFees ? liveFees[currency] : undefined;
  const blockchainFee = liveFee != null ? liveFee : selCur.netFee;
  const netToMerchant = Math.max(0, payAmount - blockchainFee);
  const feeFor = (c: (typeof SETTLE_CURRENCIES)[number]) =>
    liveFees && liveFees[c.code] != null ? (liveFees[c.code] as number) : c.netFee;
  const cheapest = SETTLE_CURRENCIES.reduce((a, c) => (feeFor(c) < feeFor(a) ? c : a), SETTLE_CURRENCIES[0]);
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

  const faqItems = t("v3.faqItems", { returnObjects: true, defaultValue: [] }) as Array<{ q: string; a: string }> | string;
  const faqs: Array<{ q: string; a: string }> = Array.isArray(faqItems) ? faqItems : [];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
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

  // Shared dark MUI control styling for the calculator panel.
  const darkSlider = {
    color: GOLD,
    height: 6,
    "& .MuiSlider-thumb": { width: 22, height: 22, background: "#fff", border: `3px solid ${GOLD}`, boxShadow: `0 4px 14px ${GOLD}55` },
    "& .MuiSlider-track": { border: "none" },
    "& .MuiSlider-rail": { background: PANEL.lineStrong, opacity: 1 },
  };
  const darkField = {
    "& .MuiOutlinedInput-root": { color: PANEL.ink, borderRadius: "10px", background: PANEL.surface },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: PANEL.lineStrong },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: PANEL.ink3 },
    "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: GOLD },
    "& .MuiInputLabel-root": { color: PANEL.ink2 },
    "& .MuiInputLabel-root.Mui-focused": { color: GOLD },
    "& .MuiSvgIcon-root": { color: PANEL.ink2 },
  };

  return (
    <>
      <Head>
        <title>{tTitle("fees_title")}</title>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }} />
      </Head>

      <Box sx={{ width: "100%", background: s.canvas }}>
        {/* ===== HERO ===== */}
        <PageHeroV8
          testId="fees-hero"
          eyebrow={t("v3.heroEyebrow")}
          title={
            <>
              {t("v3.heroTitleLead")}
              <br />
              <GradientText>1.5% → 0.5%</GradientText> {t("v3.heroTitleTail")}
            </>
          }
          body={t("v3.heroSubtitle")}
          actions={
            <>
              <PrimaryBtn data-testid="fees-hero-cta" onClick={scrollToCalc} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
                {t("v3.heroCta")}
              </PrimaryBtn>
              <SecondaryBtn data-testid="fees-hero-start" onClick={() => router.push("/auth/register?ref=fees_hero")} sx={{ px: 3.25, py: 1.5, fontSize: 16 }}>
                {tLanding("startFree")}
              </SecondaryBtn>
            </>
          }
        />

        {/* ===== TIER CARDS ===== */}
        <SectionV8 testId="fees-tiers" sx={{ background: s.surface }}>
          <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.tiersEyebrow")} title={t("v3.tiersTitle")} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: 2 }}>
            {TIERS.map((tr, ti) => {
              const isCurrent = tr.name === tier.name;
              return (
                <Reveal key={tr.name} delay={ti * 0.06}>
                  <Box
                    data-testid={`fees-tier-${tr.name.toLowerCase()}`}
                    sx={{
                      position: "relative",
                      height: "100%",
                      borderRadius: "18px",
                      background: isCurrent ? GOLD : s.canvas,
                      color: isCurrent ? "#121214" : s.ink,
                      border: `1px solid ${isCurrent ? GOLD : s.line}`,
                      p: { xs: 3, md: 3.5 },
                      minHeight: 260,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: isCurrent ? `0 24px 48px -20px ${GOLD}88` : "none",
                      overflow: "hidden",
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.2em", textTransform: "uppercase", color: isCurrent ? "rgba(18,18,20,0.75)" : s.accent, fontWeight: 600, mb: 1.5 }}>
                        {tr.name}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 52, letterSpacing: "-0.035em", lineHeight: 1, mb: 1 }}>
                        {tr.pct}%
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: isCurrent ? "rgba(18,18,20,0.85)" : s.ink3 }}>
                        {t("v3.perPayment")}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 3, pt: 2, borderTop: `1px dashed ${isCurrent ? "rgba(18,18,20,0.3)" : s.line}` }}>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.08em", color: isCurrent ? "rgba(18,18,20,0.8)" : s.ink3, textTransform: "uppercase" }}>
                        {t("v3.vol30d")}
                      </Typography>
                      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, mt: 0.5 }}>
                        {formatUSD(tr.min)}{tr.max ? ` – ${formatUSD(tr.max)}` : "+"}
                      </Typography>
                    </Box>
                    {isCurrent && (
                      <Box sx={{ position: "absolute", top: 12, right: 12, background: "rgba(18,18,20,0.12)", border: "1px solid rgba(18,18,20,0.35)", color: "#121214", fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: "999px", px: 1.25, py: 0.3 }}>
                        {t("v3.yourTier")}
                      </Box>
                    )}
                  </Box>
                </Reveal>
              );
            })}
          </Box>
        </SectionV8>

        {/* ===== FEE CALCULATOR (dark data panel) ===== */}
        <Box component="section" id="fee-calculator" data-testid="fees-calculator" sx={{ position: "relative", background: s.canvas, py: { xs: 8, md: 13 } }}>
          <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 3, md: 6 } }}>
            <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.calcEyebrow")} title={t("v3.calcTitle")} />
            <Reveal>
              <Box
                sx={{
                  position: "relative",
                  borderRadius: "24px",
                  p: { xs: 3, md: 5 },
                  maxWidth: 860,
                  mx: "auto",
                  background: "linear-gradient(175deg, #17171500 0%, #0B0B0A 100%), #0E0E0D",
                  border: `1px solid ${PANEL.lineStrong}`,
                  boxShadow: "0 50px 120px -40px rgba(0,0,0,0.6)",
                  overflow: "hidden",
                }}
              >
                <Box aria-hidden sx={{ position: "absolute", inset: 0, background: PANEL_GLOW, opacity: 0.8, pointerEvents: "none" }} />
                <Box sx={{ position: "relative", zIndex: 1 }}>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: PANEL.ink3, mb: 1 }}>
                    {t("v3.monthlyVolume")}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 40, md: 56 }, letterSpacing: "-0.03em", color: PANEL.ink, lineHeight: 1 }}>
                    {formatUSD(volume)}
                  </Typography>
                  <Slider value={volume} aria-label={t("v3.volumeSliderLabel", { defaultValue: "Monthly volume" })} min={500} max={1000000} step={500} onChange={(_, v) => setVolume(v as number)} sx={{ mt: 3, ...darkSlider }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>$500</Typography>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>$1M</Typography>
                  </Box>

                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: PANEL.ink3, mt: 4, mb: 1 }}>
                    {t("v3.paymentsLabel")}
                  </Typography>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 28, md: 34 }, letterSpacing: "-0.02em", color: PANEL.ink, lineHeight: 1 }}>
                    {formatLocaleInt(payments)}
                  </Typography>
                  <Slider value={payments} min={1} max={5000} step={1} onChange={(_, v) => setPayments(v as number)} aria-label={t("v3.paymentsLabel")} sx={{ mt: 2, ...darkSlider }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>1</Typography>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>5,000</Typography>
                  </Box>

                  {/* Result */}
                  <Box sx={{ mt: 4, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, border: `1px solid ${PANEL.line}`, borderRadius: "16px", overflow: "hidden" }}>
                    <Box sx={{ p: 2.5, borderRight: { xs: "none", sm: `1px solid ${PANEL.line}` }, borderBottom: { xs: `1px solid ${PANEL.line}`, sm: "none" } }}>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3, letterSpacing: "0.14em", textTransform: "uppercase", mb: 1 }}>{t("v3.colTier")}</Typography>
                      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: GOLD }}>{tier.name}</Typography>
                    </Box>
                    <Box sx={{ p: 2.5, borderRight: { xs: "none", sm: `1px solid ${PANEL.line}` }, borderBottom: { xs: `1px solid ${PANEL.line}`, sm: "none" } }}>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3, letterSpacing: "0.14em", textTransform: "uppercase", mb: 1 }}>{t("v3.colRate")}</Typography>
                      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: PANEL.ink }}>{tier.pct}%</Typography>
                    </Box>
                    <Box sx={{ p: 2.5, background: PANEL.goldSoft }}>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3, letterSpacing: "0.14em", textTransform: "uppercase", mb: 1 }}>{t("v3.youdPay")}</Typography>
                      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: PANEL.ink }}>{formatWithSymbol(allIn, "$", 2)}</Typography>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: GOLD, mt: 0.25 }}>≈ {toFixedStr(effectiveRate, 2)}% {t("v3.effectiveRate")}</Typography>
                    </Box>
                  </Box>

                  {/* Per-payment breakdown */}
                  <Box sx={{ mt: 4 }} data-testid="fee-breakdown">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: PANEL.ink3 }}>
                        {t("v3.breakdownTitle", { defaultValue: "Per-payment breakdown" })}
                      </Typography>
                      {liveFees && (
                        <Box data-testid="fee-live-badge" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.25, borderRadius: 999, background: PANEL.greenSoft }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.green }} />
                          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: PANEL.green }}>
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
                        InputProps={{ startAdornment: <Typography sx={{ color: PANEL.ink3, mr: 0.5 }}>$</Typography> }}
                        sx={darkField}
                      />
                      <TextField
                        select
                        size="small"
                        label={t("v3.settleCurrency", { defaultValue: "Settlement currency" })}
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        SelectProps={{
                          SelectDisplayProps: { "data-testid": "fee-calc-currency-select" } as React.HTMLAttributes<HTMLDivElement>,
                          renderValue: (val) => {
                            const c = SETTLE_CURRENCIES.find((x) => x.code === (val as string)) || selCur;
                            return (
                              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                                <CoinGlyph asset={c.asset} />
                                <span>{c.label}</span>
                              </Box>
                            );
                          },
                        }}
                        sx={darkField}
                      >
                        {SETTLE_CURRENCIES.map((c) => (
                          <MenuItem key={c.code} value={c.code} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                              <CoinGlyph asset={c.asset} />
                              <span>{c.label}</span>
                            </Box>
                            {c.code === cheapest.code && (
                              <Box component="span" sx={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8A6D00", background: "rgba(255,209,0,0.18)", px: 0.75, py: 0.25, borderRadius: 999 }}>
                                {t("v3.lowestFee", { defaultValue: "Lowest fee" })}
                              </Box>
                            )}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Box>
                    {/* Cheapest-chain hint */}
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
                        border: `1px solid ${onCheapest ? "rgba(52,211,153,0.4)" : PANEL.line}`,
                        background: onCheapest ? PANEL.greenSoft : PANEL.goldSoft,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <BoltIcon sx={{ fontSize: 18, color: onCheapest ? PANEL.green : GOLD }} />
                        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, color: PANEL.ink2 }}>
                          {onCheapest
                            ? t("v3.cheapestOn", { defaultValue: "You're on the cheapest payout route" })
                            : `${t("v3.cheapestHint", { defaultValue: "Cheapest payout route" })}: ${cheapest.label} — ${fmtFee(feeFor(cheapest))} ${t("v3.networkFeeWord", { defaultValue: "network fee" })}`}
                        </Typography>
                      </Box>
                      {!onCheapest && (
                        <Button size="small" onClick={() => setCurrency(cheapest.code)} data-testid="fee-use-cheapest" sx={{ textTransform: "none", fontFamily: FONT_BODY, fontWeight: 700, color: GOLD, borderRadius: 999, px: 1.5 }}>
                          {t("v3.useCheapest", { defaultValue: "Use it" })}
                        </Button>
                      )}
                    </Box>
                    <Box sx={{ border: `1px solid ${PANEL.line}`, borderRadius: "16px", overflow: "hidden" }}>
                      {[
                        { label: t("v3.bdPaymentAmount", { defaultValue: "Payment amount" }), value: fmtMoney(payAmount), sub: null as string | null, glyph: null as string | null },
                        { label: t("v3.bdBlockchainFee", { defaultValue: "Blockchain / network fee" }), value: fmtFee(blockchainFee), sub: liveFee != null ? `${selCur.label} · live rate` : selCur.label, glyph: selCur.asset },
                      ].map((row, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.75, borderBottom: `1px solid ${PANEL.line}` }}>
                          <Box>
                            <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: PANEL.ink2 }}>{row.label}</Typography>
                            {row.sub && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                                {row.glyph && <CoinGlyph asset={row.glyph} size={14} />}
                                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, color: PANEL.ink3 }}>{row.sub}</Typography>
                              </Box>
                            )}
                          </Box>
                          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: PANEL.ink }} data-testid={`fee-row-value-${i}`}>{row.value}</Typography>
                        </Box>
                      ))}
                      <Box data-testid="fee-breakdown-net" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2, background: PANEL.goldSoft }}>
                        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, fontWeight: 600, color: PANEL.ink }}>{t("v3.bdNetToMerchant", { defaultValue: "Net to merchant" })}</Typography>
                        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: GOLD }}>{fmtMoney(netToMerchant)}</Typography>
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
            </Reveal>
          </Box>
        </Box>

        {/* ===== COMPARISON ===== */}
        <SectionV8 testId="fees-compare" sx={{ background: s.surface }}>
          <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.compareEyebrow")} title={t("v3.compareTitle")} />
          <Reveal>
            <Box sx={{ maxWidth: 900, mx: "auto", borderRadius: "18px", border: `1px solid ${s.line}`, background: s.canvas, overflow: "hidden" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 1fr 1fr", sm: "2fr 1fr 1fr" }, px: { xs: 2, sm: 3 }, py: 2, borderBottom: `1px solid ${s.lineStrong}`, background: s.surface }}>
                {[t("v3.colFeature"), "Dynopay", t("v3.colOthers")].map((h, i) => (
                  <Typography key={h} sx={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: s.ink, textAlign: i === 0 ? "left" : "center" }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {comparisonRows.map((row, idx) => (
                <Box key={idx} sx={{ display: "grid", gridTemplateColumns: { xs: "1.5fr 1fr 1fr", sm: "2fr 1fr 1fr" }, alignItems: "center", px: { xs: 2, sm: 3 }, py: 2, "&:not(:last-child)": { borderBottom: `1px solid ${s.line}` } }}>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2 }}>{row.feature}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {row.dynopay ? <CheckIcon sx={{ fontSize: 16, color: s.accent }} /> : <CloseIcon sx={{ fontSize: 16, color: s.accent }} />}
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, color: s.accent }}>{row.dynoText}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                    {row.others ? <CheckIcon sx={{ fontSize: 16, color: "#EF4444" }} /> : <CloseIcon sx={{ fontSize: 16, color: "#EF4444" }} />}
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12.5, color: "#EF4444" }}>{row.othersText}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Reveal>
        </SectionV8>

        {/* ===== WHO PAYS THE FEE? ===== */}
        <SectionV8 testId="fees-who-pays">
          <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.whoPaysEyebrow")} title={t("v3.whoPaysTitle")} lead={t("v3.whoPaysBody")} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, maxWidth: 900, mx: "auto" }}>
            {[
              { title: t("v3.wpMerchantTitle"), desc: t("v3.wpMerchantDesc"), highlight: false },
              { title: t("v3.wpCustomerTitle"), desc: t("v3.wpCustomerDesc"), highlight: true },
            ].map((c, ci) => (
              <Reveal key={c.title} delay={ci * 0.08}>
                <Box
                  sx={{
                    height: "100%",
                    borderRadius: "18px",
                    background: c.highlight ? PANEL.bg : s.surface,
                    color: c.highlight ? PANEL.ink : s.ink,
                    border: `1px solid ${c.highlight ? PANEL.bg : s.line}`,
                    p: { xs: 3, md: 4 },
                  }}
                >
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21, letterSpacing: "-0.02em", mb: 1.5 }}>{c.title}</Typography>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, lineHeight: 1.65, color: c.highlight ? PANEL.ink2 : s.ink2 }}>{c.desc}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
          <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: s.ink3, mt: 3, maxWidth: 900, mx: "auto", lineHeight: 1.5, textAlign: "center" }}>
            {t("v3.wpFootnote")}
          </Typography>
        </SectionV8>

        {/* ===== EVERYTHING INCLUDED FREE ===== */}
        <SectionV8 testId="fees-included" sx={{ background: s.surface }}>
          <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.includedEyebrow")} title={t("v3.includedTitle")} lead={t("v3.includedBody")} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" }, gap: 1.5 }}>
            {["inc1", "inc2", "inc3", "inc4", "inc5", "inc6", "inc7", "inc8", "inc9"].map((k, ki) => (
              <Reveal key={k} delay={(ki % 3) * 0.06}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, height: "100%", px: 2.5, py: 2, borderRadius: "14px", border: `1px solid ${s.line}`, background: s.canvas }}>
                  <Box sx={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: s.accentSoft, display: "grid", placeItems: "center" }}>
                    <CheckIcon sx={{ fontSize: 16, color: s.accent }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink, lineHeight: 1.4 }}>{t(`v3.${k}`)}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        {/* ===== SECURITY ===== */}
        <SectionV8 testId="fees-security">
          <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.secEyebrow")} title={t("v3.secTitle")} />
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: { xs: 1.25, md: 2 }, maxWidth: 860, mx: "auto" }}>
            {[t("v3.sec1Title"), t("v3.sec2Title"), t("v3.sec3Title")].map((title, ii) => (
              <Reveal key={title} delay={ii * 0.06}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, px: { xs: 2, md: 2.5 }, py: 1.25, borderRadius: "999px", border: `1px solid ${s.line}`, background: s.surface }}>
                  <Box sx={{ width: 30, height: 30, borderRadius: "9px", display: "grid", placeItems: "center", background: s.accentSoft, color: s.accent, flexShrink: 0 }}>
                    <ShieldOutlinedIcon sx={{ fontSize: 17 }} />
                  </Box>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14.5, color: s.ink, letterSpacing: "-0.01em" }}>{title}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        {/* ===== FAQ ===== */}
        <SectionV8 testId="fees-faq-section" sx={{ background: s.surface }}>
          <SectionHeadV8 center maxWidth={720} eyebrow={t("v3.faqEyebrow")} title={t("v3.faqTitle")} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, maxWidth: 820, mx: "auto" }}>
            {faqs.map((f, i) => (
              <Reveal key={i} delay={Math.min(i, 4) * 0.04}>
                <Box component="article" data-testid={`fees-faq-${i}`} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: "16px", border: `1px solid ${s.line}`, background: s.canvas, display: "flex", flexDirection: "column", gap: 1.25 }}>
                  <Typography component="h2" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: { xs: 16, md: 18 }, color: s.ink, letterSpacing: "-0.01em" }}>{f.q}</Typography>
                  <Typography component="p" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 14, md: 15 }, color: s.ink2, lineHeight: 1.65 }}>{f.a}</Typography>
                </Box>
              </Reveal>
            ))}
          </Box>
        </SectionV8>

        <CtaBandV8
          testId="fees-final-cta"
          badge="No monthly fees · your first payment is free"
          title="Transparent pricing,"
          highlight="no surprises."
          body="Only pay when you get paid — a clear percentage plus the on-chain fee, shown up front. Start free and see it on your first payment."
          primaryLabel={tLanding("startFree", { defaultValue: "Start free" })}
          primaryRef="fees_final"
          secondaryLabel="See the products"
          secondaryHref="/products"
        />
      </Box>
    </>
  );
};

export default memo(FeesPage);
