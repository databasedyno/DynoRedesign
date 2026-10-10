import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import { Icon, MONO } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import KycRing from "./KycRing";
import { KycInsights, stageColor, useKycTones, useUsd } from "./kycInsights";

const DATE: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** 90-day grace countdown ring with start/end dates — or a "not started" preview. */
const KycGraceRing: React.FC<{ k: KycInsights }> = ({ k }) => {
  const { t } = useTranslation("dashboardLayout");
  const tones = useKycTones();
  const usd = useUsd();
  const color = stageColor(k.stage, k.urgency, tones);
  const threshold = usd(k.threshold);
  const days = k.graceDays;
  const counting = k.stage === "grace" || k.stage === "paused";
  const left = k.daysRemaining ?? days;

  // "below" = no clock running: show ONLY the dashed track (value 0), never a filled ring.
  const ringValue = k.stage === "grace" ? left / days : k.stage === "paused" || k.stage === "below" ? 0 : 1;
  const ringColor = color;

  const status =
    k.stage === "grace"
      ? { text: t("kycInsights.ring.running", { defaultValue: "Running" }), color }
      : k.stage === "paused"
        ? { text: t("kycInsights.ring.ended", { defaultValue: "Ended" }), color: tones.negative }
        : k.stage === "below"
          ? { text: t("kycInsights.ring.notStarted", { defaultValue: "Not started" }), color: tones.muted }
          : { text: t("kycInsights.ring.notNeeded", { defaultValue: "Not needed" }), color: tones.positive };

  const body =
    k.stage === "grace"
      ? t("kycInsights.ring.graceBody", { defaultValue: "Payments, payment links and settlements keep working for the whole grace period." })
      : k.stage === "paused"
        ? t("kycInsights.ring.pausedBody", { defaultValue: "New checkouts and new payment links are paused. Payments you've already received still settle to your wallet." })
        : k.stage === "below"
          ? t("kycInsights.ring.belowBody", { days, threshold, defaultValue: "No clock is running. Your {{days}}-day grace period only starts if this brand reaches {{threshold}} — and even then everything keeps working while you verify." })
          : k.stage === "exempt"
            ? t("kycInsights.ring.exemptBody", { defaultValue: "This account is exempt, so no grace period applies." })
            : t("kycInsights.ring.verifiedBody", { defaultValue: "You're verified, so no grace period applies to any of your brands." });

  const ariaLabel = counting
    ? t("kycInsights.ring.aria", { left, days, defaultValue: "{{left}} of {{days}} grace days left" })
    : status.text;

  const dateRow = (icon: string, label: string, value: string, hint?: string, testId?: string) => (
    <Box data-testid={testId} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box sx={{ width: 32, height: 32, borderRadius: "10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: tones.muted, border: `1px solid ${tones.border}` }}>
        <Icon name={icon} size={15} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: tones.muted }}>{label}</Typography>
        <Typography sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 14.5, fontWeight: 700, color: tones.ink, mt: 0.25 }}>{value || "—"}</Typography>
        {hint && <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12, color: tones.muted, mt: 0.25 }}>{hint}</Typography>}
      </Box>
    </Box>
  );

  return (
    <PanelCard
      title={t("kycInsights.ring.title", { days, defaultValue: "{{days}}-day grace period" })}
      showHeaderBorder={false}
      sx={{ height: "100%" }}
      headerAction={
        <Box data-testid="kyc-ring-status" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1.1, py: 0.35, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: status.color, backgroundColor: `${status.color}17`, border: `1px solid ${status.color}40` }}>
          {status.text}
        </Box>
      }
      headerActionLayout="inline"
      bodySx={{ px: { xs: 2, md: 2.5 }, pt: { xs: 1.5, md: 2 }, pb: { xs: 2, md: 2.5 } }}
    >
      <Box data-testid="kyc-grace-ring" data-stage={k.stage} sx={{ display: "flex", flexDirection: { xs: "column", sm: "row", lg: "column", xl: "row" }, alignItems: { xs: "center", sm: "center" }, gap: { xs: 2, md: 2.5 } }}>
        <KycRing
          size={156}
          stroke={12}
          value={ringValue}
          color={ringColor}
          track={k.stage === "paused" ? `${tones.negative}33` : k.stage === "below" ? `${tones.muted}66` : tones.track}
          dashedTrack={k.stage === "below"}
          ticks={counting ? 3 : 0}
          label={ariaLabel}
          testId="kyc-ring-svg"
        >
          {k.stage === "verified" || k.stage === "exempt" ? (
            <>
              <Box sx={{ color: tones.positive, display: "flex" }}>
                <Icon name="badge-check" size={38} />
              </Box>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, color: tones.positive, mt: 0.5 }}>{status.text}</Typography>
            </>
          ) : (
            <>
              <Box data-testid="kyc-ring-days" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: k.stage === "below" ? tones.ink : color }}>
                {counting ? left : days}
              </Box>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: tones.muted, mt: 0.5, lineHeight: 1.25 }}>
                {counting
                  ? t("kycInsights.ring.daysLeft", { count: left, defaultValue: left === 1 ? "day left" : "days left" })
                  : t("kycInsights.ring.daysWhenNeeded", { defaultValue: "days, if ever needed" })}
              </Typography>
            </>
          )}
        </KycRing>

        <Box sx={{ flex: 1, minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
          {counting && (
            <>
              {dateRow(
                "calendar-check",
                t("kycInsights.ring.started", { defaultValue: "Started" }),
                k.thresholdDate ? formatDateI18n(k.thresholdDate, DATE) : "",
                t("kycInsights.ring.startedHint", { threshold, defaultValue: "The day you crossed {{threshold}}" }),
                "kyc-ring-start",
              )}
              {dateRow(
                k.stage === "paused" ? "calendar-x" : "calendar",
                k.stage === "paused" ? t("kycInsights.ring.endedOn", { defaultValue: "Ended" }) : t("kycInsights.ring.ends", { defaultValue: "Ends" }),
                k.graceEnd ? formatDateI18n(k.graceEnd, DATE) : "",
                undefined,
                "kyc-ring-end",
              )}
              {k.daysElapsed != null && (
                <Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: tones.muted, mb: 0.5 }}>
                    <span>{t("kycInsights.ring.dayOf", { day: Math.max(1, Math.min(days, k.daysElapsed)), days, defaultValue: "Day {{day}} of {{days}}" })}</span>
                  </Box>
                  <Box sx={{ height: 6, borderRadius: 999, backgroundColor: tones.track, overflow: "hidden" }}>
                    <Box sx={{ height: "100%", width: `${(k.daysElapsed / days) * 100}%`, borderRadius: 999, backgroundColor: color }} />
                  </Box>
                </Box>
              )}
            </>
          )}
          <Typography data-testid="kyc-ring-body" sx={{ fontFamily: "var(--font-sans)", fontSize: 13.5, lineHeight: 1.55, color: counting ? tones.muted : tones.ink }}>
            {body}
          </Typography>
        </Box>
      </Box>
    </PanelCard>
  );
};

export default KycGraceRing;
