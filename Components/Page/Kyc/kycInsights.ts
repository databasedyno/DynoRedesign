import { useMemo } from "react";
import { useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CB_TOKENS } from "@/Components/Page/Dashboard/coinbase/styled";
import type { KycStatus } from "@/hooks/useKycStatus";

/**
 * KYC insights — ONE derivation of "where does this brand stand on identity
 * verification" shared by the /kyc visuals and the dashboard KYC card.
 *
 * Mirrors backend/helper/kycEnforcement.ts exactly:
 *   below    — successful brand volume < threshold → nothing required, nothing restricted
 *   grace    — threshold crossed, not verified, grace running → everything still works
 *   paused   — grace ended unverified → ONLY new checkouts + new payment links pause
 *   verified — approved (account-level, covers every brand) → no volume limits
 *   exempt   — account exempt from enforcement
 * Settlement of funds already received is NEVER gated on KYC in any stage.
 */
export type KycStage = "below" | "grace" | "paused" | "verified" | "exempt";
export type KycReview = "none" | "in_review" | "retry";
export type KycUrgency = "calm" | "soon" | "urgent";

export interface KycInsights {
  ready: boolean;
  stage: KycStage;
  review: KycReview;
  threshold: number;
  graceDays: number;
  volume: number;
  /** 0–100, progress of volume toward the threshold. */
  pct: number;
  /** Amount still to go before verification is needed (0 once crossed). */
  remaining: number;
  /** Amount above the threshold (0 while below). */
  overBy: number;
  thresholdDate: string | null;
  graceEnd: string | null;
  daysRemaining: number | null;
  daysElapsed: number | null;
  urgency: KycUrgency;
  /** New checkouts + new payment links. */
  newPaymentsOn: boolean;
  /** Always true — kept explicit so the UI never has to assume. */
  settlementOn: true;
}

const RETRY = new Set(["declined", "expired", "resubmission_requested", "abandoned"]);
export const DEFAULT_THRESHOLD = 10000;
export const DEFAULT_GRACE_DAYS = 90;

export function deriveKycInsights(
  data?: KycStatus | null,
  requirements?: { volume_threshold?: number; grace_period_days?: number } | null,
): KycInsights {
  const threshold = Number(data?.volume_threshold ?? requirements?.volume_threshold ?? DEFAULT_THRESHOLD) || DEFAULT_THRESHOLD;
  const graceDays =
    Number(data?.grace_period?.grace_period_days ?? data?.grace_period_days ?? requirements?.grace_period_days ?? DEFAULT_GRACE_DAYS) || DEFAULT_GRACE_DAYS;
  const volume = Math.max(0, Number(data?.total_volume ?? 0) || 0);
  const status = String(data?.status || "not_started");

  let stage: KycStage = "below";
  if (data?.is_exempt) stage = "exempt";
  else if (status === "approved") stage = "verified";
  else if (data?.blocked || data?.grace_period?.blocked) stage = "paused";
  else if (data?.requires_kyc) stage = "grace";

  const review: KycReview =
    status === "submitted" || (status === "pending" && !!data?.has_active_session)
      ? "in_review"
      : RETRY.has(status)
        ? "retry"
        : "none";

  const rawDays = data?.grace_period?.days_remaining;
  const daysRemaining =
    stage === "grace" || stage === "paused"
      ? typeof rawDays === "number"
        ? Math.max(0, Math.min(graceDays, rawDays))
        : stage === "paused"
          ? 0
          : null
      : null;
  const daysElapsed = daysRemaining == null ? null : Math.max(0, Math.min(graceDays, graceDays - daysRemaining));
  const urgency: KycUrgency = daysRemaining == null ? "calm" : daysRemaining <= 7 ? "urgent" : daysRemaining <= 30 ? "soon" : "calm";

  return {
    ready: !!data,
    stage,
    review,
    threshold,
    graceDays,
    volume,
    pct: Math.max(0, Math.min(100, (volume / threshold) * 100)),
    remaining: Math.max(0, threshold - volume),
    overBy: Math.max(0, volume - threshold),
    thresholdDate: data?.grace_period?.threshold_date ?? null,
    graceEnd: data?.grace_period?.grace_period_end ?? null,
    daysRemaining,
    daysElapsed,
    urgency,
    newPaymentsOn: stage !== "paused",
    settlementOn: true,
  };
}

/** Theme-aware tones used by every KYC visual (AA-tuned CB tokens). */
export function useKycTones() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return useMemo(() => {
    const pick = (k: "positive" | "negative" | "warning" | "info") => (isDark ? CB_TOKENS.semantic[k].dark : CB_TOKENS.semantic[k].light);
    const glow = (k: "positive" | "negative" | "warning" | "info") => (isDark ? CB_TOKENS.semantic[k].glowDark : CB_TOKENS.semantic[k].glowLight);
    return {
      isDark,
      positive: pick("positive"),
      negative: pick("negative"),
      warning: pick("warning"),
      info: pick("info"),
      positiveGlow: glow("positive"),
      negativeGlow: glow("negative"),
      warningGlow: glow("warning"),
      accent: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
      accentGlow: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
      ink: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
      muted: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
      border: isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light,
      track: isDark ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.07)",
    };
  }, [isDark]);
}

/** Colour of the stage itself (pill / ring / marker). */
export function stageColor(stage: KycStage, urgency: KycUrgency, tones: ReturnType<typeof useKycTones>): string {
  if (stage === "verified" || stage === "exempt") return tones.positive;
  if (stage === "paused") return tones.negative;
  if (stage === "grace") return urgency === "urgent" ? tones.negative : tones.warning;
  return tones.accent;
}

/** Locale-aware whole-dollar USD formatter (the KYC rule is defined in USD). */
export function useUsd() {
  const { i18n } = useTranslation();
  const lang = i18n?.resolvedLanguage || i18n?.language || "en";
  return useMemo(() => {
    let nf: Intl.NumberFormat;
    try {
      nf = new Intl.NumberFormat(lang, { style: "currency", currency: "USD", maximumFractionDigits: 0, minimumFractionDigits: 0 });
    } catch {
      nf = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0, minimumFractionDigits: 0 });
    }
    return (n?: number | null) => nf.format(Math.round(Number(n) || 0));
  }, [lang]);
}
