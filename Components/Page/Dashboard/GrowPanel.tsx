import { brandFg } from "@/constants/theme";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import {
  ArrowOutward,
  DiamondRounded,
  CardGiftcardRounded,
  LocalOfferRounded,
  CelebrationRounded,
} from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";
import { CB_TOKENS } from "./coinbase/styled";
import { DASH_PANEL_SX, DASH_PANEL_HEADER_SX } from "./v2026/styled";

/**
 * GrowPanel — consolidates the old {FeeFreeWidget, PremiumTierCard,
 * ReferralAndKnowledge, ConversionBanner} into ONE card that surfaces
 * exactly ONE offer at a time in priority order:
 *   1. Fee-free promo — highest urgency, expires
 *   2. Trial complete celebration — for merchants who USED the trial
 *      (encouragement + next-step; replaces the stale fee-free CTA)
 *   3. Premium upgrade — for users who've hit fee tier 3+
 *   4. Referral program — evergreen
 *
 * Priority is resolved from the props/state passed in — caller decides
 * what's active. Removes the "5 competing upsells" clutter the older
 * dashboard had, without losing any of them.
 */

interface OfferConfig {
  key: "fee_free" | "trial_complete" | "premium" | "referral";
  title: string;
  body: string;
  ctaLabel: string;
  onCtaClick: () => void;
  icon: React.ReactNode;
  accent: string; // tailwind-y accent color for the border/gradient
}

export interface GrowPanelProps {
  /** True when the merchant still has unspent fee-free trial credit. */
  hasFeeFreeCredit?: boolean;
  /** True when the merchant has already used their $500 fee-free trial. */
  hasCompletedFeeFreeTrial?: boolean;
  /** True when the merchant is on a paid tier and could upgrade further. */
  isPremiumEligible?: boolean;
  /** Called when the user clicks the fee-free CTA (or falls back to a default route). */
  onFeeFreeCta?: () => void;
  onPremiumCta?: () => void;
  onReferralCta?: () => void;
}

const GrowPanel: React.FC<GrowPanelProps> = ({
  hasFeeFreeCredit = false,
  hasCompletedFeeFreeTrial = false,
  isPremiumEligible = false,
  onFeeFreeCta,
  onPremiumCta,
  onReferralCta,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");
  const isDark = theme.palette.mode === "dark";
  // Quiet Money: one brand accent for every offer (the icon differs, the colour
  // doesn't) — no more pink/amber/green competing tints in the right rail.
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const feeFreeOffer: OfferConfig = {
    key: "fee_free",
    title: t("growFeeFreeTitle"),
    body: t("growFeeFreeBody"),
    ctaLabel: t("createPaymentLink"),
    onCtaClick: onFeeFreeCta || (() => router.push("/create-pay-link")),
    icon: <LocalOfferRounded sx={{ fontSize: 22 }} />,
    accent: indigo,
  };

  const trialCompleteOffer: OfferConfig = {
    key: "trial_complete",
    // Congratulatory / encouraging state for merchants who USED the trial.
    // Nudges them toward the referral program (evergreen way to earn more
    // fee-free credit) rather than showing a stale fee-free CTA they can't
    // benefit from any more.
    title: t("growTrialCompleteTitle"),
    body: t("growTrialCompleteBody"),
    ctaLabel: t("growReferralCta"),
    onCtaClick: onReferralCta || (() => router.push("/referrals")),
    icon: <CelebrationRounded sx={{ fontSize: 22 }} />,
    accent: indigo,
  };

  const premiumOffer: OfferConfig = {
    key: "premium",
    title: t("growPremiumTitle"),
    body: t("growPremiumBody"),
    ctaLabel: t("learnMore"),
    // /fees is the public pricing/premium tier page. Previous target
    // (/settings/billing) 404'd because no such page exists.
    onCtaClick: onPremiumCta || (() => router.push("/fees")),
    icon: <DiamondRounded sx={{ fontSize: 22 }} />,
    accent: indigo,
  };

  const referralOffer: OfferConfig = {
    key: "referral",
    title: t("growReferralTitle"),
    body: t("growReferralBody"),
    ctaLabel: t("growReferralCta"),
    // /referrals is the merchant referral page. Previous target
    // (/settings/referral) 404'd because no such page exists.
    onCtaClick: onReferralCta || (() => router.push("/referrals")),
    icon: <CardGiftcardRounded sx={{ fontSize: 22 }} />,
    accent: indigo,
  };

  // Priority: fee-free (highest, has expiry) > trial-complete (celebration) >
  //           premium (eligibility gate) > referral (evergreen)
  const active: OfferConfig = hasFeeFreeCredit
    ? feeFreeOffer
    : hasCompletedFeeFreeTrial
      ? trialCompleteOffer
      : isPremiumEligible
        ? premiumOffer
        : referralOffer;

  return (
    <Box sx={{ px: { xs: 2, md: 0 } }} data-testid="dashboard-grow-panel">
      <PanelCard
        sx={DASH_PANEL_SX}
        headerSx={DASH_PANEL_HEADER_SX}
        showHeaderBorder={false}
        headerPadding={theme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={theme.spacing(2, 2.5, 2.5, 2.5)}
        title={t("growTitle")}
        subTitle={t("growSubtitle")}
      >
        <Box
          data-testid={`grow-offer-${active.key}`}
          sx={{
            position: "relative",
            borderRadius: "12px",
            p: isMobile ? 2 : 2.25,
            border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "#FAFAFC",
            display: "flex",
            flexDirection: "column",
            gap: 1.25,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? CB_TOKENS.indigo.darkGlow : CB_TOKENS.indigo.lightGlow,
                color: active.accent,
                flexShrink: 0,
              }}
            >
              {active.icon}
            </Box>
            <Typography
              sx={{
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: isMobile ? "14.5px" : "15px",
                letterSpacing: "-0.01em",
                color: theme.palette.text.primary,
                lineHeight: 1.25,
              }}
            >
              {active.title}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: "var(--font-sans)",
              fontSize: isMobile ? "13px" : "13.5px",
              color: theme.palette.text.secondary,
              lineHeight: 1.55,
            }}
          >
            {active.body}
          </Typography>
          <Box sx={{ mt: 0.25 }}>
            <CustomButton
              data-testid={`grow-offer-cta-${active.key}`}
              label={active.ctaLabel}
              variant="primary"
              size="small"
              endIcon={<ArrowOutward sx={{ fontSize: 14 }} />}
              onClick={active.onCtaClick}
            />
          </Box>
        </Box>

        {/* Tiny secondary CTA — lets the user reach the other offers without
            spamming them all at once. */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            mt: 1.5,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {active.key !== "referral" && (
            <Typography
              component="button"
              type="button"
              onClick={referralOffer.onCtaClick}
              sx={{
                border: 0,
                background: "none",
                p: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: theme.palette.text.secondary,
                cursor: "pointer",
                "&:hover": { color: brandFg(theme.palette.mode === "dark"), textDecoration: "underline" },
              }}
              data-testid="grow-secondary-referral"
            >
              {t("growSecondaryReferral")}
            </Typography>
          )}
          {active.key !== "premium" && (
            <Typography
              component="button"
              type="button"
              onClick={premiumOffer.onCtaClick}
              sx={{
                border: 0,
                background: "none",
                p: 0,
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
                color: theme.palette.text.secondary,
                cursor: "pointer",
                "&:hover": { color: brandFg(theme.palette.mode === "dark"), textDecoration: "underline" },
              }}
              data-testid="grow-secondary-premium"
            >
              {t("growSecondaryPremium")}
            </Typography>
          )}
        </Box>
      </PanelCard>
    </Box>
  );
};

export default GrowPanel;
