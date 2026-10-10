import React from "react";
import { Box, Skeleton, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { SurfaceCard, Eyebrow } from "../../coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import { useKycGate } from "@/hooks/useKycGate";
import KycRing from "@/Components/Page/Kyc/KycRing";
import { deriveKycInsights, stageColor, useKycTones, useUsd } from "@/Components/Page/Kyc/kycInsights";

/**
 * Dashboard — compact identity-verification status for EVERY merchant (not only
 * once KYC is required): stage, a mini ring/meter, the "settlement always on"
 * reassurance, and a link to the full /kyc breakdown.
 */
const KycStatusCard: React.FC = () => {
  const { t } = useTranslation("dashboardLayout");
  const router = useRouter();
  const tones = useKycTones();
  const usd = useUsd();
  const { data, loading } = useKycGate();

  if (loading) {
    return (
      <SurfaceCard data-testid="dash-kyc-card" data-state="loading" sx={{ p: { xs: 2, md: 2.25 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Skeleton variant="circular" width={56} height={56} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width={140} height={16} />
            <Skeleton width="60%" height={24} />
          </Box>
        </Box>
      </SurfaceCard>
    );
  }
  if (!data) return null;

  const k = deriveKycInsights(data);
  const color = stageColor(k.stage, k.urgency, tones);
  const date = k.graceEnd ? formatDateI18n(k.graceEnd, { day: "numeric", month: "short", year: "numeric" }) : "";

  const copy = (() => {
    switch (k.stage) {
      case "verified":
        return { title: t("kycInsights.card.verifiedTitle", { defaultValue: "Identity verified" }), sub: t("kycInsights.card.verifiedSub", { defaultValue: "No volume limits on any of your brands." }) };
      case "exempt":
        return { title: t("kycInsights.card.exemptTitle", { defaultValue: "Verification not required" }), sub: t("kycInsights.card.exemptSub", { defaultValue: "This account is exempt from verification limits." }) };
      case "paused":
        return { title: t("kycInsights.card.pausedTitle", { defaultValue: "New payments paused — verify to resume" }), sub: t("kycInsights.card.pausedSub", { defaultValue: "Payments you've already received still settle to your wallet." }) };
      case "grace":
        return {
          title: t("kycInsights.card.graceTitle", { count: k.daysRemaining ?? k.graceDays, defaultValue: "{{count}} days left to verify" }),
          sub: date
            ? t("kycInsights.card.graceSub", { date, defaultValue: "Grace period ends {{date}} — payments keep flowing until then." })
            : t("kycInsights.card.graceSubNoDate", { defaultValue: "Your grace period is running — payments keep flowing." }),
        };
      default:
        return {
          title: t("kycInsights.card.belowTitle", { defaultValue: "Verification not needed yet" }),
          sub: t("kycInsights.card.belowSub", { volume: usd(k.volume), threshold: usd(k.threshold), remaining: usd(k.remaining), defaultValue: "{{volume}} of {{threshold}} · {{remaining}} to go" }),
        };
    }
  })();

  const ringValue = k.stage === "below" ? k.pct / 100 : k.stage === "grace" ? (k.daysRemaining ?? k.graceDays) / k.graceDays : k.stage === "paused" ? 0 : 1;
  const ringLabel =
    k.stage === "below"
      ? t("kycInsights.meter.aria", { volume: usd(k.volume), threshold: usd(k.threshold), defaultValue: "{{volume}} of {{threshold}} toward verification" })
      : k.stage === "grace"
        ? t("kycInsights.ring.aria", { left: k.daysRemaining ?? k.graceDays, days: k.graceDays, defaultValue: "{{left}} of {{days}} grace days left" })
        : copy.title;

  const reviewChip =
    k.review === "in_review"
      ? { text: t("kycInsights.card.inReview", { defaultValue: "In review" }), color: tones.info }
      : k.review === "retry" && k.stage !== "verified"
        ? { text: t("kycInsights.card.retry", { defaultValue: "Needs another try" }), color: tones.warning }
        : null;

  return (
    <SurfaceCard data-testid="dash-kyc-card" data-stage={k.stage} sx={{ p: { xs: 2, md: 2.25 } }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "auto minmax(0, 1fr)", md: "auto minmax(0, 1fr) auto" }, alignItems: "center", columnGap: { xs: 1.75, md: 2.25 }, rowGap: 1.5 }}>
        <KycRing size={56} stroke={6} value={ringValue} color={k.stage === "below" ? tones.accent : color} track={k.stage === "paused" ? `${tones.negative}33` : tones.track} label={ringLabel} testId="dash-kyc-ring">
          {k.stage === "verified" || k.stage === "exempt" ? (
            <Box sx={{ color: tones.positive, display: "flex" }}>
              <Icon name="badge-check" size={22} />
            </Box>
          ) : k.stage === "paused" ? (
            <Box sx={{ color: tones.negative, display: "flex" }}>
              <Icon name="pause" size={20} />
            </Box>
          ) : (
            <Box sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: k.stage === "grace" ? 17 : 13, fontWeight: 800, color: k.stage === "grace" ? color : tones.ink, lineHeight: 1 }}>
              {k.stage === "grace" ? (k.daysRemaining ?? k.graceDays) : `${Math.floor(k.pct)}%`}
            </Box>
          )}
        </KycRing>

        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Eyebrow>{t("kycInsights.card.eyebrow", { defaultValue: "Identity verification" })}</Eyebrow>
            {reviewChip && (
              <Box data-testid="dash-kyc-review-chip" sx={{ px: 0.9, py: 0.15, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 700, color: reviewChip.color, border: `1px solid ${reviewChip.color}55` }}>
                {reviewChip.text}
              </Box>
            )}
          </Box>
          <Typography data-testid="dash-kyc-title" sx={{ mt: 0.5, fontFamily: "var(--font-sans)", fontSize: { xs: 15, md: 16 }, fontWeight: 800, letterSpacing: "-0.01em", color: k.stage === "paused" ? tones.negative : tones.ink, lineHeight: 1.3 }}>
            {copy.title}
          </Typography>
          <Typography data-testid="dash-kyc-sub" sx={{ mt: 0.25, fontFamily: k.stage === "below" ? MONO : "var(--font-sans)", fontVariantNumeric: "tabular-nums", fontSize: 13, color: tones.muted, lineHeight: 1.45 }}>
            {copy.sub}
          </Typography>
          {k.stage === "below" && (
            <Box aria-hidden sx={{ mt: 1, height: 6, maxWidth: 360, borderRadius: 999, backgroundColor: tones.track, overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${k.pct}%`, minWidth: k.pct > 0 ? 6 : 0, borderRadius: 999, backgroundColor: tones.accent }} />
            </Box>
          )}
        </Box>

        <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, display: "flex", alignItems: "center", justifyContent: { xs: "space-between", md: "flex-end" }, gap: 1.25, flexWrap: "wrap" }}>
          <Box data-testid="dash-kyc-settlement-chip" title={t("kycInsights.caps.assuranceBody", { defaultValue: "Whatever your verification status, money that arrives is forwarded to your payout wallet. Verification only ever affects starting new payments — and only after the grace period." }) as string} sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.1, py: 0.45, borderRadius: 999, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", color: tones.positive, backgroundColor: tones.positiveGlow, border: `1px solid ${tones.positive}40` }}>
            <Icon name="shield-check" size={14} />
            {t("kycInsights.card.settlementOn", { defaultValue: "Settlement always on" })}
          </Box>
          <Box
            component="button"
            type="button"
            data-testid="dash-kyc-details-btn"
            data-touch-44=""
            onClick={() => router.push("/kyc")}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              minHeight: 44,
              px: 1.5,
              border: `1px solid ${tones.border}`,
              borderRadius: "12px",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 700,
              color: tones.ink,
              "&:hover": { borderColor: tones.accent, color: tones.accent },
              "&:focus-visible": { outline: `2px solid ${tones.accent}`, outlineOffset: 2 },
            }}
          >
            {k.stage === "grace" || k.stage === "paused"
              ? t("kycInsights.card.verifyCta", { defaultValue: "See details & verify" })
              : t("kycInsights.card.details", { defaultValue: "View details" })}
            <Icon name="arrow-right" size={15} />
          </Box>
        </Box>
      </Box>
    </SurfaceCard>
  );
};

export default KycStatusCard;
