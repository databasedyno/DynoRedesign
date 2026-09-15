import React from "react";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import PanelCard from "@/Components/UI/PanelCard";
import CustomButton from "@/Components/UI/Buttons";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import { Icon, MONO } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import type { KycStatus } from "@/hooks/useKycStatus";
import type { KycView } from "./useKycPage";

interface Props {
  view: KycView;
  loading: boolean;
  data?: KycStatus;
  daysRemaining: number | null;
  blocked: boolean;
  hasSession: boolean;
  busy: boolean;
  estimatedTime?: string;
  onContinue: () => void;
}

const fmtUsd = (n?: number) => `$${Math.round(n || 0).toLocaleString()}`;

/** Status hero: what state you're in, why it matters, how long it takes — and ONE button. */
const KycStatusHero: React.FC<Props> = ({ view, loading, data, daysRemaining, blocked, hasSession, busy, estimatedTime, onContinue }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const tone = view === "verified" ? "positive" : view === "in_review" ? "indigo" : view === "not_needed" ? "neutral" : blocked ? "negative" : "warning";
  const accent =
    tone === "positive" ? (isDark ? CB_TOKENS.semantic.positive.dark : CB_TOKENS.semantic.positive.light)
    : tone === "negative" ? (isDark ? CB_TOKENS.semantic.negative.dark : CB_TOKENS.semantic.negative.light)
    : tone === "warning" ? (isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light)
    : tone === "indigo" ? (isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light)
    : theme.palette.text.secondary;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const border = isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light;
  const threshold = data?.volume_threshold ?? 10000;
  const volume = data?.total_volume ?? 0;
  const pct = Math.min(100, Math.round((volume / (threshold || 1)) * 100));

  const copy: Record<KycView, { icon: string; title: string; body: string; cta?: string }> = {
    verified: { icon: "lucide:badge-check", title: t("kycPage.verifiedTitle", { defaultValue: "You're verified" }), body: t("kycPage.verifiedBody", { defaultValue: "Identity confirmed. There are no limits on your payments and the verified badge shows on your checkout." }) },
    in_review: { icon: "lucide:clock", title: t("kycPage.reviewTitle", { defaultValue: "In review" }), body: t("kycPage.reviewBody", { defaultValue: "We've received your documents. Most reviews finish within minutes, at most 24–48 hours. We'll email you and add a notification the moment it's done — nothing else to do here." }) },
    retry: { icon: "lucide:refresh-cw", title: t("kycPage.retryTitle", { defaultValue: "Needs another try" }), body: data?.kyc_record?.rejection_reason ? t("kycPage.retryBodyReason", { reason: data.kyc_record.rejection_reason, defaultValue: "Your last attempt couldn't be approved: {{reason}}. You can go again right away." }) : t("kycPage.retryBody", { defaultValue: "Your last attempt couldn't be approved — usually a blurry photo or a mismatched name. You can go again right away." }), cta: t("kycPage.ctaRetry", { defaultValue: "Try again" }) },
    action_needed: {
      icon: "lucide:id-card",
      title: blocked ? t("kycPage.blockedTitle", { defaultValue: "Payments paused until you verify" }) : daysRemaining !== null ? t("kycPage.daysTitle", { count: daysRemaining, defaultValue: "{{count}} days to verify your identity" }) : t("kycPage.neededTitle", { defaultValue: "Verify your identity" }),
      body: blocked ? t("kycPage.blockedBody", { threshold: fmtUsd(threshold), defaultValue: "You passed {{threshold}} in volume and the grace period has ended, so new payments are paused. Finish the {{threshold}}-free check below to resume." }) : t("kycPage.neededBody", { threshold: fmtUsd(threshold), defaultValue: "You passed {{threshold}} in payment volume, so regulations require a quick identity check. Payments keep flowing while you complete it." }),
      cta: hasSession ? t("kyc.continueVerification", { defaultValue: "Continue verification" }) : t("kyc.startVerification", { defaultValue: "Start verification" }),
    },
    not_needed: { icon: "lucide:shield", title: t("kycPage.notNeededTitle", { defaultValue: "Not needed yet" }), body: t("kycPage.notNeededBody", { threshold: fmtUsd(threshold), defaultValue: "Identity verification becomes required once your payment volume reaches {{threshold}}. You can verify early to unlock the verified badge." }), cta: t("kycPage.ctaEarly", { defaultValue: "Verify now" }) },
  };
  const c = copy[view];

  return (
    <PanelCard showHeaderBorder={false} bodySx={{ p: { xs: 2, md: 2.5 } }}>
      <Box data-testid="kyc-status-hero" data-view={view} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "auto 1fr auto" }, gap: { xs: 2, md: 3 }, alignItems: "center" }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", color: accent, backgroundColor: `${accent}1A`, border: `1px solid ${accent}44`, flexShrink: 0 }}>
          {loading ? <Skeleton variant="circular" width={32} height={32} /> : <Icon name={c.icon} size={30} />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {loading ? (
            <>
              <Skeleton width={260} height={30} />
              <Skeleton width="80%" height={20} />
            </>
          ) : (
            <>
              <Typography data-testid="kyc-status-title" sx={{ fontFamily: "var(--font-sans)", fontSize: { xs: 20, md: 24 }, fontWeight: 800, letterSpacing: "-0.02em", color: theme.palette.text.primary, lineHeight: 1.2 }}>
                {c.title}
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: theme.palette.text.secondary, mt: 0.75 }}>{c.body}</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
                {view !== "verified" && (
                  <Box data-testid="kyc-time-chip" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.25, py: 0.5, borderRadius: 999, border: `1px solid ${border}`, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: muted }}>
                    <Icon name="timer" size={13} />
                    {t("kycPage.takes", { time: estimatedTime || "5–10 minutes", defaultValue: "Takes {{time}}" })}
                  </Box>
                )}
                {view === "not_needed" && (
                  <Box data-testid="kyc-volume-chip" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.25, py: 0.5, borderRadius: 999, border: `1px solid ${border}`, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12, fontWeight: 600, color: muted }}>
                    {fmtUsd(volume)} / {fmtUsd(threshold)} · {pct}%
                  </Box>
                )}
                {view === "action_needed" && data?.grace_period?.grace_period_end && !blocked && (
                  <Box data-testid="kyc-deadline-chip" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.25, py: 0.5, borderRadius: 999, border: `1px solid ${accent}55`, backgroundColor: `${accent}14`, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: accent }}>
                    <Icon name="calendar" size={13} />
                    {t("kycPage.deadline", { date: formatDateI18n(data.grace_period.grace_period_end, { day: "2-digit", month: "short", year: "numeric" }), defaultValue: "Complete by {{date}}" })}
                  </Box>
                )}
                {view === "in_review" && data?.kyc_record?.submitted_at && (
                  <Box data-testid="kyc-submitted-chip" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6, px: 1.25, py: 0.5, borderRadius: 999, border: `1px solid ${border}`, fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: muted }}>
                    <Icon name="send" size={13} />
                    {t("kycPage.submittedOn", { date: formatDateI18n(data.kyc_record.submitted_at, { day: "2-digit", month: "short", year: "numeric" }), defaultValue: "Submitted {{date}}" })}
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
        {!loading && c.cta && (
          <Box sx={{ width: { xs: "100%", md: "auto" }, "& button": { width: { xs: "100%", md: "auto" }, minHeight: 46 } }}>
            <CustomButton
              label={c.cta}
              variant="primary"
              size="medium"
              loading={busy}
              endIcon={<Icon name="arrow-right" size={16} />}
              onClick={onContinue}
              data-testid="kyc-continue-btn"
            />
          </Box>
        )}
      </Box>
    </PanelCard>
  );
};

export default KycStatusHero;
