import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { Icon, MONO } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import { KycInsights, stageColor, useKycTones, useUsd } from "./kycInsights";

const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Progress meter: this brand's successful volume toward the verification threshold. */
const KycVolumeMeter: React.FC<{ k: KycInsights }> = ({ k }) => {
  const { t } = useTranslation("dashboardLayout");
  const tones = useKycTones();
  const usd = useUsd();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const crossed = k.volume >= k.threshold;
  const fill = k.stage === "below" ? tones.accent : stageColor(k.stage, k.urgency, tones);
  const threshold = usd(k.threshold);
  const date = k.thresholdDate ? formatDateI18n(k.thresholdDate, DATE) : "";

  const note: { icon: string; color: string; bg: string; text: string } = (() => {
    switch (k.stage) {
      case "verified":
        return { icon: "badge-check", color: tones.positive, bg: tones.positiveGlow, text: t("kycInsights.meter.verifiedNote", { defaultValue: "You're verified, so your volume has no limit — on this brand or any other." }) };
      case "exempt":
        return { icon: "badge-check", color: tones.positive, bg: tones.positiveGlow, text: t("kycInsights.meter.exemptNote", { defaultValue: "This account is exempt from verification limits." }) };
      case "paused":
        return {
          icon: "circle-pause",
          color: tones.negative,
          bg: tones.negativeGlow,
          text: date
            ? t("kycInsights.meter.pausedNote", { threshold, date, defaultValue: "You crossed {{threshold}} on {{date}} and the grace period has ended. Verifying lifts the pause straight away." })
            : t("kycInsights.meter.pausedNoteNoDate", { threshold, defaultValue: "You've crossed {{threshold}} and the grace period has ended. Verifying lifts the pause straight away." }),
        };
      case "grace":
        return {
          icon: "hourglass",
          color: tones.warning,
          bg: tones.warningGlow,
          text: date
            ? t("kycInsights.meter.graceNote", { threshold, date, defaultValue: "You crossed {{threshold}} on {{date}}. Your grace period is running and everything keeps working." })
            : t("kycInsights.meter.graceNoteNoDate", { threshold, defaultValue: "You've crossed {{threshold}}. Your grace period is running and everything keeps working." }),
        };
      default:
        return {
          icon: "circle-check",
          color: tones.positive,
          bg: tones.positiveGlow,
          text: t("kycInsights.meter.belowNote", { remaining: usd(k.remaining), defaultValue: "{{remaining}} to go before verification is needed. Until then nothing changes — no checks, no limits, settlements as usual." }),
        };
    }
  })();

  const ticks = [25, 50, 75];

  return (
    <PanelCard
      title={t("kycInsights.meter.title", { defaultValue: "Payment volume" })}
      subTitle={t("kycInsights.meter.subtitle", { threshold, defaultValue: "Successful payments for this brand, all time. Verification is only needed from {{threshold}}." })}
      showHeaderBorder={false}
      sx={{ height: "100%" }}
      bodySx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 2, md: 2.5 } }}
    >
      <Box data-testid="kyc-volume-meter" data-stage={k.stage}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
            <Box data-testid="kyc-meter-volume" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: { xs: 26, md: 30 }, fontWeight: 700, letterSpacing: "-0.02em", color: tones.ink, lineHeight: 1.1 }}>
              {usd(k.volume)}
            </Box>
            <Box component="span" sx={{ fontFamily: "var(--font-sans)", fontSize: 14, color: tones.muted }}>
              {t("kycInsights.meter.of", { threshold, defaultValue: "of {{threshold}}" })}
            </Box>
          </Box>
          <Box
            data-testid="kyc-meter-chip"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.25, py: 0.4, borderRadius: 999, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 700, color: fill, backgroundColor: `${fill}1A`, border: `1px solid ${fill}40` }}
          >
            {crossed ? t("kycInsights.meter.aboveBy", { amount: usd(k.overBy), defaultValue: "+{{amount}} above" }) : `${Math.floor(k.pct)}%`}
          </Box>
        </Box>

        {/* Bar with a finish flag at the threshold */}
        <Box sx={{ position: "relative", mt: 1.5, pt: 3.25 }}>
          <Box sx={{ position: "absolute", top: 0, right: 0, display: "inline-flex", alignItems: "center", gap: 0.5, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: crossed ? fill : tones.muted }}>
            <Icon name="flag" size={13} />
            {t("kycInsights.meter.flag", { threshold, defaultValue: "Verification from {{threshold}}" })}
          </Box>
          <Box
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={k.threshold}
            aria-valuenow={Math.round(Math.min(k.volume, k.threshold))}
            aria-label={t("kycInsights.meter.aria", { volume: usd(k.volume), threshold, defaultValue: "{{volume}} of {{threshold}} toward verification" })}
            sx={{ position: "relative", height: 14, borderRadius: 999, backgroundColor: tones.track, overflow: "hidden" }}
          >
            <Box
              data-testid="kyc-meter-fill"
              sx={{
                height: "100%",
                width: `${shown ? k.pct : 0}%`,
                minWidth: k.pct > 0 ? 8 : 0,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${fill}8C, ${fill})`,
                transition: "width 900ms cubic-bezier(0.4, 0, 0.2, 1)",
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
              }}
            />
            {ticks.map((p) => (
              <Box key={p} aria-hidden sx={{ position: "absolute", top: 3, bottom: 3, left: `${p}%`, width: "2px", borderRadius: 1, backgroundColor: tones.isDark ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.75)" }} />
            ))}
          </Box>
          <Box sx={{ position: "relative", height: 18, mt: 0.75, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12, color: tones.muted }}>
            <Box component="span" sx={{ position: "absolute", left: 0 }}>{usd(0)}</Box>
            <Box component="span" sx={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: { xs: "none", sm: "inline" } }}>{usd(k.threshold / 2)}</Box>
            <Box component="span" sx={{ position: "absolute", right: 0, fontWeight: 700, color: tones.ink }}>{threshold}</Box>
          </Box>
        </Box>

        <Box data-testid="kyc-meter-note" sx={{ mt: 2, display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.5, borderRadius: "12px", backgroundColor: note.bg, border: `1px solid ${note.color}33` }}>
          <Box sx={{ color: note.color, display: "flex", mt: "1px", flexShrink: 0 }}>
            <Icon name={note.icon} size={18} />
          </Box>
          <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.5, color: tones.ink }}>{note.text}</Typography>
        </Box>
      </Box>
    </PanelCard>
  );
};

export default KycVolumeMeter;
