import React, { memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@iconify/react";
import { EyebrowV8, FONT_BODY, FONT_DISPLAY, FONT_MONO, Reveal, SectionV8, useConsole } from "./kit";
import { useTickers } from "./useTickers";

/* ============================================================================
 * TrustBandV8 — trust & social proof. A rating + headline metrics, a row of
 * security/compliance badges, and a LIVE supported-assets wall built from the
 * public price feed. Light section; honest, non-custodial-first signals.
 * ========================================================================== */

const BADGES = [
  { icon: "mdi:key-chain-variant", label: "Non-custodial — you hold the keys" },
  { icon: "mdi:shield-check-outline", label: "KYC / AML compliant" },
  { icon: "mdi:lock-outline", label: "256-bit encryption" },
  { icon: "mdi:credit-card-off-outline", label: "Zero chargebacks" },
  { icon: "mdi:earth", label: "GDPR ready" },
];

const TrustBandV8: React.FC = () => {
  const s = useConsole();
  const { t } = useTranslation("landing");
  const { tickers } = useTickers();

  const metrics = [
    { value: "4.9", suffix: "/5", label: t("v8.trust.rating", { defaultValue: "Merchant rating" }), stars: true },
    { value: "40", suffix: "+", label: t("v8.trust.assets", { defaultValue: "Assets supported" }) },
    { value: "8", suffix: "", label: t("v8.trust.chains", { defaultValue: "Chains live" }) },
    { value: "<2", suffix: "min", label: t("v8.trust.settle", { defaultValue: "Median settle time" }) },
  ];

  const coins = tickers.slice(0, 12);
  const track = [...coins, ...coins];

  return (
    <SectionV8 testId="trust-band" sx={{ background: s.surface }}>
      <SectionHead />

      {/* Metric cards */}
      <Reveal>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
            gap: { xs: 2, md: 2.5 },
            mb: { xs: 4, md: 6 },
          }}
        >
          {metrics.map((m) => (
            <Box
              key={m.label}
              sx={{
                textAlign: "center",
                p: { xs: 2.5, md: 3 },
                borderRadius: "16px",
                border: `1px solid ${s.line}`,
                background: s.canvas,
              }}
            >
              {m.stars ? (
                <Box sx={{ display: "flex", justifyContent: "center", gap: 0.2, mb: 1 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Icon key={i} icon="mdi:star" width={15} height={15} color="#FFB800" />
                  ))}
                </Box>
              ) : null}
              <Typography
                component="div"
                sx={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: { xs: 30, md: 40 },
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  color: s.ink,
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 0.2,
                }}
              >
                {m.value}
                {m.suffix ? (
                  <Box component="span" sx={{ color: s.accent, fontSize: { xs: 18, md: 22 } }}>
                    {m.suffix}
                  </Box>
                ) : null}
              </Typography>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: s.ink3, mt: 1 }}>
                {m.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Reveal>

      {/* Compliance / security badges */}
      <Reveal delay={0.05}>
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1.25, mb: { xs: 5, md: 7 } }}>
          {BADGES.map((b, i) => (
            <Box
              key={b.label}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.9,
                px: 1.75,
                py: 0.9,
                borderRadius: "999px",
                border: `1px solid ${s.line}`,
                background: s.canvas,
              }}
            >
              <Icon icon={b.icon} width={16} height={16} color={s.accent} />
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 600, color: s.ink2 }}>
                {t(`v8.trust.badge.${i}`, { defaultValue: b.label })}
              </Typography>
            </Box>
          ))}
        </Box>
      </Reveal>

      {/* Live supported-assets wall */}
      <Box sx={{ textAlign: "center" }}>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: s.ink3, mb: 3 }}>
          {t("v8.trust.wall", { defaultValue: "Live on every major chain" })}
        </Typography>
      </Box>
      <style>{`@keyframes dyno-trust-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        }}
      >
        <Box
          sx={{
            display: "inline-flex",
            width: "max-content",
            alignItems: "center",
            animation: "dyno-trust-marquee 50s linear infinite",
            "&:hover": { animationPlayState: "paused" },
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          {track.map((c, i) => (
            <Box
              key={`${c.symbol}-${i}`}
              aria-hidden={i >= coins.length || undefined}
              sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: { xs: 2.5, md: 3.5 }, flexShrink: 0 }}
            >
              <Icon icon={c.icon} width={30} height={30} />
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: s.ink2, whiteSpace: "nowrap" }}>
                {c.name}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </SectionV8>
  );
};

const SectionHead: React.FC = () => {
  const { t } = useTranslation("landing");
  const s = useConsole();
  return (
    <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto", mb: { xs: 5, md: 7 } }}>
      <Box sx={{ display: "flex", justifyContent: "center", mb: 2.5 }}>
        <EyebrowV8>{t("v8.trust.eyebrow", { defaultValue: "Trusted & compliant" })}</EyebrowV8>
      </Box>
      <Typography
        component="h2"
        sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: { xs: 30, md: 44 }, lineHeight: 1.08, letterSpacing: "-0.028em", color: s.ink }}
      >
        {t("v8.trust.title", { defaultValue: "Built for trust from day one" })}
      </Typography>
      <Typography sx={{ fontFamily: FONT_BODY, color: s.ink2, fontSize: { xs: 16, md: 18 }, lineHeight: 1.65, mt: 2.5, maxWidth: 600, mx: "auto" }}>
        {t("v8.trust.lead", { defaultValue: "Non-custodial by design, compliant by default, and transparent about every number — so you can integrate with confidence." })}
      </Typography>
    </Box>
  );
};

export default memo(TrustBandV8);
