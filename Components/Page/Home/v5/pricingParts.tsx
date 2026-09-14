import React, { memo, useMemo, useState } from "react";
import { Box, Slider, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { FONT_BODY, FONT_HERO, FONT_TECH, useAurora } from "../v3/theme.v3";
import { BRAND_ACCENT } from "@/constants/theme";
import { Stagger, StaggerItem } from "../motion/Stagger";

/** Mirrors backend/utils/volumeTierUtils.ts DEFAULT_TIERS (lifetime settled USD). */
export const TIERS = [
  { id: "starter", min: 0, max: 10_000, pct: 1.5 },
  { id: "growth", min: 10_000, max: 100_000, pct: 1.0 },
  { id: "scale", min: 100_000, max: 500_000, pct: 0.7 },
  { id: "enterprise", min: 500_000, max: null, pct: 0.5 },
] as const;
export const FIXED_FEE_USD = 1;
const CARD_PCT = 2.9;
const CARD_FIXED = 0.3;

export const usd = (n: number, digits = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const tierFor = (volume: number) => TIERS.find((t) => volume >= t.min && (t.max === null || volume < t.max)) ?? TIERS[TIERS.length - 1];

export const TierLadder: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  return (
    <Stagger step={0.08} data-testid="pricing-ladder" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: { xs: 1.5, md: 2 } }}>
      {TIERS.map((tier, i) => (
        <StaggerItem key={tier.id} i={i} y={20}>
        <Box data-testid={`tier-${tier.id}`} sx={{ borderRadius: "18px", p: { xs: 2.25, md: 2.75 }, background: i === 0 ? (s.dark ? "rgba(129,140,248,0.12)" : "rgba(79,70,229,0.07)") : s.surface, border: `1px solid ${i === 0 ? `${BRAND_ACCENT}55` : s.line}`, transition: "transform 240ms cubic-bezier(0.16,1,0.3,1), border-color 240ms ease", "&:hover": { transform: "translateY(-3px)", borderColor: `${BRAND_ACCENT}88` } }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3 }}>{t(`v5.pricing.tier.${tier.id}`)}</Typography>
          <Typography className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: { xs: 30, md: 38 }, letterSpacing: "-0.03em", lineHeight: 1, color: s.ink, mt: 1 }}>{tier.pct}%</Typography>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: s.ink3, mt: 1.25 }}>
            {tier.max === null ? t("v5.pricing.from", { amount: usd(tier.min) }) : t("v5.pricing.upTo", { amount: usd(tier.max) })}
          </Typography>
        </Box>
        </StaggerItem>
      ))}
    </Stagger>
  );
};

export const WhoPaysToggle: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [mode, setMode] = useState<"merchant" | "customer">("merchant");
  const merchant = mode === "merchant";
  return (
    <Box data-testid="who-pays" sx={{ borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2.5, md: 3 } }}>
      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, letterSpacing: "-0.015em", color: s.ink, mb: 0.75 }}>{t("v3.whopays.headline")}</Typography>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.ink2, lineHeight: 1.5, mb: 2 }}>{t("v3.whopays.body")}</Typography>
      <Box role="tablist" sx={{ display: "inline-flex", p: 0.5, borderRadius: "999px", border: `1px solid ${s.line}`, mb: 2.5 }}>
        {(["merchant", "customer"] as const).map((k) => (
          <Box key={k} component="button" type="button" role="tab" aria-selected={mode === k} data-testid={`whopays-tab-${k}`} onClick={() => setMode(k)} sx={{ all: "unset", cursor: "pointer", px: 2, py: 0.9, borderRadius: "999px", fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 600, color: mode === k ? "#fff" : s.ink2, background: mode === k ? BRAND_ACCENT : "transparent", transition: "background-color 180ms ease, color 180ms ease" }}>
            {k === "merchant" ? t("v3.whopays.tabMerchant") : t("v3.whopays.tabCustomer")}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: `1px solid ${s.line}`, borderRadius: "14px", overflow: "hidden" }}>
        <Box sx={{ p: 2, borderRight: `1px solid ${s.line}` }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3 }}>{t("v3.whopays.customerPaysLabel")}</Typography>
          <Typography data-testid="whopays-customer-pays" className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 26, letterSpacing: "-0.03em", color: s.ink, mt: 0.5 }}>{merchant ? "$100.00" : "$102.50"}</Typography>
        </Box>
        <Box sx={{ p: 2, background: s.dark ? "rgba(129,140,248,0.08)" : "rgba(79,70,229,0.06)" }}>
          <Typography sx={{ fontFamily: FONT_TECH, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3 }}>{t("v3.whopays.youReceiveLabel")}</Typography>
          <Typography data-testid="whopays-you-receive" className="tabular-nums" sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 26, letterSpacing: "-0.03em", color: s.dark ? "#818CF8" : BRAND_ACCENT, mt: 0.5 }}>{merchant ? "$97.50" : "$100.00"}</Typography>
        </Box>
      </Box>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: s.ink2, mt: 1.5, lineHeight: 1.5 }}>{merchant ? t("v3.whopays.merchantNote") : t("v3.whopays.customerNote")}</Typography>
    </Box>
  );
};

export const FeeCalculator: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("landing");
  const [volume, setVolume] = useState(10_000);
  const [avg, setAvg] = useState(80);
  const r = useMemo(() => {
    const payments = Math.max(1, Math.round(volume / avg));
    const tier = tierFor(volume);
    const dyno = volume * (tier.pct / 100) + payments * FIXED_FEE_USD;
    const cards = volume * (CARD_PCT / 100) + payments * CARD_FIXED;
    return { payments, tier, dyno, cards, diff: cards - dyno };
  }, [volume, avg]);
  const row = (label: string, value: string, strong?: boolean, testId?: string) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", py: 1.1, borderBottom: `1px solid ${s.line}` }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.ink2 }}>{label}</Typography>
      <Typography data-testid={testId} className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: strong ? 18 : 15, fontWeight: strong ? 700 : 600, color: strong ? (s.dark ? "#818CF8" : BRAND_ACCENT) : s.ink }}>{value}</Typography>
    </Box>
  );
  const sliderSx = { color: BRAND_ACCENT, "& .MuiSlider-thumb": { width: 18, height: 18 } };
  return (
    <Box data-testid="fee-calculator" sx={{ borderRadius: "20px", background: s.surface, border: `1px solid ${s.line}`, p: { xs: 2.5, md: 3 } }}>
      <Typography sx={{ fontFamily: FONT_HERO, fontWeight: 700, fontSize: 18, letterSpacing: "-0.015em", color: s.ink, mb: 2 }}>{t("v5.calc.title")}</Typography>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3 }}>{t("v5.calc.volume")}</Typography>
        <Typography data-testid="calc-volume" className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 13, fontWeight: 700, color: s.ink }}>{usd(volume)}</Typography>
      </Box>
      <Slider aria-label={t("v5.calc.volume")} data-testid="calc-volume-slider" value={volume} min={500} max={250_000} step={500} onChange={(_, v) => setVolume(v as number)} sx={sliderSx} />
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, mt: 1 }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: s.ink3 }}>{t("v5.calc.avg")}</Typography>
        <Typography data-testid="calc-avg" className="tabular-nums" sx={{ fontFamily: FONT_TECH, fontSize: 13, fontWeight: 700, color: s.ink }}>{usd(avg)}</Typography>
      </Box>
      <Slider aria-label={t("v5.calc.avg")} data-testid="calc-avg-slider" value={avg} min={10} max={1000} step={10} onChange={(_, v) => setAvg(v as number)} sx={sliderSx} />
      <Box sx={{ mt: 1.5 }}>
        {row(t("v5.calc.dyno", { pct: r.tier.pct }), usd(r.dyno, 2), true, "calc-dyno")}
        {row(t("v5.calc.cards"), usd(r.cards, 2), false, "calc-cards")}
      </Box>
      <Box data-testid="calc-result" sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2, p: 1.5, borderRadius: "12px", background: r.diff >= 0 ? (s.dark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.09)") : s.bgAlt }}>
        <CheckCircleRoundedIcon sx={{ fontSize: 18, color: r.diff >= 0 ? "#10B981" : s.ink3 }} />
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600, color: s.ink }}>
          {r.diff >= 0 ? t("v5.calc.save", { amount: usd(r.diff, 0) }) : t("v5.calc.cardsCheaper", { amount: usd(-r.diff, 0) })}
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12, color: s.ink3, mt: 1.5, lineHeight: 1.5 }}>{t("v5.calc.note")}</Typography>
    </Box>
  );
};

export default memo(TierLadder);
