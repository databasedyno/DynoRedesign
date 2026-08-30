import React, { memo, useState } from "react";
import { Box, Typography, Slider } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FONT_BODY, FONT_TECH, useAurora } from "@/Components/Page/Home/v3/theme.v3";
import { AuroraInk, Eyebrow } from "@/Components/Page/Home/v3/styled.v3";

/* Interactive referral earnings estimator. Fee tiers mirror pages/fees.tsx
 * (flat rate by the tier the monthly volume falls into). Referrer earns 25%
 * of the referral's platform fees for 12 months. Illustrative only. */

const tierPct = (v: number): number =>
  v < 10000 ? 1.5 : v < 100000 ? 1.0 : v < 500000 ? 0.7 : 0.5;

const fmtUSD = (n: number): string =>
  `$${Math.round(n).toLocaleString("en-US")}`;

const REV_SHARE = 0.25;

const ReferralEarningsCalculator: React.FC = () => {
  const s = useAurora();
  const { t } = useTranslation("referrals");
  const [volume, setVolume] = useState(50000);
  const [mode, setMode] = useState<"credit" | "cashout">("credit");

  const pct = tierPct(volume);
  const monthlyFee = (volume * pct) / 100;
  const youMonthly = Math.round(monthlyFee * REV_SHARE);
  const you12mo = youMonthly * 12;

  const stat = (label: string, value: string, testid: string, accent?: boolean) => (
    <Box
      data-testid={testid}
      sx={{
        flex: 1,
        minWidth: 140,
        textAlign: "center",
        py: { xs: 2.5, md: 3 },
        px: 2,
        borderRadius: "16px",
        background: accent ? "rgba(79,70,229,0.10)" : s.bgAlt,
        border: `1px solid ${accent ? "rgba(79,70,229,0.35)" : s.line}`,
      }}
    >
      <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: s.ink3, mb: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: { xs: 26, md: 34 }, fontWeight: 700, lineHeight: 1.05 }}>
        {accent ? <AuroraInk>{value}</AuroraInk> : <Box component="span" sx={{ color: s.ink }}>{value}</Box>}
      </Typography>
    </Box>
  );

  return (
    <Box
      data-testid="referral-example"
      sx={{
        maxWidth: 820,
        mx: "auto",
        borderRadius: "24px",
        border: `1px solid ${s.line}`,
        background: s.surface,
        p: { xs: 4, md: 6 },
        textAlign: "center",
      }}
    >
      <Eyebrow tone="coral" sx={{ mb: 3 }}>{t("public.calcEyebrow")}</Eyebrow>

      {/* Payout mode toggle — same amount, different delivery */}
      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <Typography sx={{ fontFamily: FONT_TECH, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: s.ink3, mb: 1.5 }}>
          {t("public.calcModeLabel")}
        </Typography>
        <Box sx={{ display: "inline-flex", p: "4px", gap: "4px", borderRadius: "999px", background: s.bgAlt, border: `1px solid ${s.line}` }}>
          {([
            { key: "credit" as const, label: t("public.calcModeCredit") },
            { key: "cashout" as const, label: t("public.calcModeCashout") },
          ]).map((m) => {
            const active = mode === m.key;
            return (
              <Box
                key={m.key}
                component="button"
                type="button"
                data-testid={`referral-calc-mode-${m.key}`}
                aria-pressed={active}
                onClick={() => setMode(m.key)}
                sx={{
                  cursor: "pointer",
                  border: "none",
                  borderRadius: "999px",
                  px: { xs: 2.5, md: 3.5 },
                  py: 1,
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "background-color .2s ease, color .2s ease",
                  color: active ? "#FFFFFF" : s.ink2,
                  background: active ? s.indigo : "transparent",
                }}
              >
                {m.label}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Volume slider */}
      <Box sx={{ maxWidth: 620, mx: "auto", mb: { xs: 4, md: 5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.ink2 }}>
            {t("public.calcVolumeLabel")}
          </Typography>
          <Typography data-testid="referral-calc-volume" sx={{ fontFamily: FONT_BODY, fontSize: { xs: 18, md: 20 }, fontWeight: 700, color: s.ink }}>
            {fmtUSD(volume)}<Box component="span" sx={{ fontSize: 13, fontWeight: 500, color: s.ink3 }}>/mo</Box>
          </Typography>
        </Box>
        <Slider
          data-testid="referral-calc-slider"
          value={volume}
          onChange={(_, v) => setVolume(v as number)}
          min={1000}
          max={500000}
          step={1000}
          aria-label={t("public.calcVolumeLabel")}
          sx={{
            color: s.indigo,
            height: 6,
            "& .MuiSlider-thumb": { width: 22, height: 22, boxShadow: "0 4px 12px -2px rgba(79,70,229,0.5)" },
            "& .MuiSlider-rail": { opacity: 0.2 },
          }}
        />
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 1.5, md: 2 }, mb: 3 }}>
        {stat(t("public.calcTheirFee"), `${fmtUSD(monthlyFee)}`, "referral-calc-their-fee")}
        {stat(t("public.calcYouEarnMonthly"), fmtUSD(youMonthly), "referral-calc-monthly", true)}
        {stat(t("public.calcYouEarn12mo"), fmtUSD(you12mo), "referral-calc-total", true)}
      </Box>

      <Typography
        data-testid="referral-calc-mode-note"
        sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 500, color: s.ink2, mb: 2, maxWidth: 560, mx: "auto" }}
      >
        {mode === "credit" ? t("public.calcModeCreditNote") : t("public.calcModeCashoutNote")}
      </Typography>

      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: s.ink3, maxWidth: 560, mx: "auto" }}>
        {t("public.exampleNote")}
      </Typography>
    </Box>
  );
};

export default memo(ReferralEarningsCalculator);
