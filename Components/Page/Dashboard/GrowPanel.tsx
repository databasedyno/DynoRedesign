import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import {
  ArrowOutward,
  DiamondRounded,
  CardGiftcardRounded,
  LocalOfferRounded,
} from "@mui/icons-material";
import { Box, Typography, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import React from "react";
import { useTranslation } from "react-i18next";

/**
 * GrowPanel — consolidates the old {FeeFreeWidget, PremiumTierCard,
 * ReferralAndKnowledge, ConversionBanner} into ONE card that surfaces
 * exactly ONE offer at a time in priority order:
 *   1. Fee-free promo — highest urgency, expires
 *   2. Premium upgrade — for users who've hit fee tier 3+
 *   3. Referral program — evergreen
 *
 * Priority is resolved from the props/state passed in — caller decides
 * what's active. Removes the "5 competing upsells" clutter the older
 * dashboard had, without losing any of them.
 */

interface OfferConfig {
  key: "fee_free" | "premium" | "referral";
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
  /** True when the merchant is on a paid tier and could upgrade further. */
  isPremiumEligible?: boolean;
  /** Called when the user clicks the fee-free CTA (or falls back to a default route). */
  onFeeFreeCta?: () => void;
  onPremiumCta?: () => void;
  onReferralCta?: () => void;
}

const GrowPanel: React.FC<GrowPanelProps> = ({
  hasFeeFreeCredit = false,
  isPremiumEligible = false,
  onFeeFreeCta,
  onPremiumCta,
  onReferralCta,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const { t } = useTranslation("dashboardLayout");

  const feeFreeOffer: OfferConfig = {
    key: "fee_free",
    title: t("growFeeFreeTitle"),
    body: t("growFeeFreeBody"),
    ctaLabel: t("createPaymentLink"),
    onCtaClick: onFeeFreeCta || (() => router.push("/create-pay-link")),
    icon: <LocalOfferRounded sx={{ fontSize: 22 }} />,
    accent: theme.palette.success.dark || "#10B981",
  };

  const premiumOffer: OfferConfig = {
    key: "premium",
    title: t("growPremiumTitle"),
    body: t("growPremiumBody"),
    ctaLabel: t("learnMore"),
    onCtaClick: onPremiumCta || (() => router.push("/settings/billing")),
    icon: <DiamondRounded sx={{ fontSize: 22 }} />,
    accent: theme.palette.primary.main,
  };

  const referralOffer: OfferConfig = {
    key: "referral",
    title: t("growReferralTitle"),
    body: t("growReferralBody"),
    ctaLabel: t("growReferralCta"),
    onCtaClick: onReferralCta || (() => router.push("/settings/referral")),
    icon: <CardGiftcardRounded sx={{ fontSize: 22 }} />,
    accent: "#EC4899",
  };

  // Priority: fee-free (highest, has expiry) > premium (eligibility gate) > referral (evergreen)
  const active: OfferConfig = hasFeeFreeCredit
    ? feeFreeOffer
    : isPremiumEligible
      ? premiumOffer
      : referralOffer;

  return (
    <Box sx={{ px: { xs: 2, md: 0 } }} data-testid="dashboard-grow-panel">
      <PanelCard
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
            borderRadius: "14px",
            p: isMobile ? 2 : 2.5,
            border: `1px solid ${active.accent}33`,
            background: `linear-gradient(135deg, ${active.accent}0d 0%, ${active.accent}03 100%)`,
            display: "flex",
            flexDirection: "column",
            gap: 1.25,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${active.accent}1F`,
                color: active.accent,
                flexShrink: 0,
              }}
            >
              {active.icon}
            </Box>
            <Typography
              sx={{
                fontFamily: "UrbanistSemiBold",
                fontWeight: 700,
                fontSize: isMobile ? "15px" : "16px",
                color: theme.palette.text.primary,
                lineHeight: 1.25,
              }}
            >
              {active.title}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: "UrbanistMedium",
              fontSize: isMobile ? "13px" : "13.5px",
              color: theme.palette.text.secondary,
              lineHeight: 1.55,
            }}
          >
            {active.body}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
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
              onClick={referralOffer.onCtaClick}
              sx={{
                fontFamily: "UrbanistMedium",
                fontSize: "12px",
                color: theme.palette.text.secondary,
                cursor: "pointer",
                "&:hover": { color: theme.palette.primary.main, textDecoration: "underline" },
              }}
              data-testid="grow-secondary-referral"
            >
              {t("growSecondaryReferral")}
            </Typography>
          )}
          {active.key !== "premium" && (
            <Typography
              onClick={premiumOffer.onCtaClick}
              sx={{
                fontFamily: "UrbanistMedium",
                fontSize: "12px",
                color: theme.palette.text.secondary,
                cursor: "pointer",
                "&:hover": { color: theme.palette.primary.main, textDecoration: "underline" },
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
