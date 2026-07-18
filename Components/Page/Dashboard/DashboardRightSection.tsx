import { ArrowOutward } from "@mui/icons-material";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import ReferralAndKnowledge from "@/Components/Layout/ReferralAndKnowledge";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import FeeTierProgress from "./FeeTierProgress";
import GrowPanel from "./GrowPanel";
import CreatorPageCard from "./CreatorPageCard";

import { formatNumberWithComma, getCurrencySymbol } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useDashboardData } from "@/hooks/useDashboardData";
import { rootReducer } from "@/utils/types";
// Using muiTheme from useTheme() for dark mode support

import CheckCircleIcon from "@/assets/Icons/correct-icon.png";
import CurrencyIcon from "@/assets/Icons/dollar-sign-icon.svg";

const DEFAULT_MONTHLY_LIMIT = 10000;
const DEFAULT_USED_AMOUNT = 0;
const CURRENT_TIER = "Starter";
const DEFAULT_TIER_PERCENT = 1.5;

const DashboardRightSection = () => {
  const muiTheme = useTheme();
  const isMobile = useIsMobile("md");

  const { t } = useTranslation(["dashboardLayout", "common"]);
  const tDashboard = useCallback(
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const { feeTiers } = useDashboardData();

  // Fee-free credit flag: user still has trial credit → prioritize that promo.
  // Read from userReducer.profile.fee_free_remaining_usd (set by /user/profile).
  // Previously read a non-existent `free_trial_volume_used` field which
  // defaulted to 0, so EVERY user (including those who had exhausted their
  // trial) saw the fee-free CTA — wrong for merchants like hostbay@moxx.co
  // who processed $17k+ and have $0 fee-free credit remaining.
  const userState = useSelector((s: rootReducer) => (s as any).userReducer);
  const feeFreeRemainingRaw =
    userState?.profile?.fee_free_remaining_usd ??
    userState?.profile?.feeFreeRemainingUsd;
  const feeFreeRemaining = Number(feeFreeRemainingRaw ?? NaN);
  const hasFeeFreeCredit = useMemo(() => {
    // Only show fee-free CTA when the field is known AND still positive.
    // If unknown (undefined/NaN), don't assume — fall through to premium/referral.
    return Number.isFinite(feeFreeRemaining) && feeFreeRemaining > 0;
  }, [feeFreeRemaining]);
  // True when the merchant HAS used their trial (i.e. the field exists but is 0).
  // Lets GrowPanel show a "trial complete → keep growing" state instead of the
  // fee-free CTA — more encouraging than blindly falling to a generic offer.
  const hasCompletedFeeFreeTrial = useMemo(() => {
    return (
      Number.isFinite(feeFreeRemaining) &&
      feeFreeRemaining <= 0 &&
      Number(userState?.profile?.cumulative_volume_usd ?? 0) > 0
    );
  }, [feeFreeRemaining, userState?.profile?.cumulative_volume_usd]);

  const monthlyLimit = feeTiers.monthlyLimit || DEFAULT_MONTHLY_LIMIT;
  const currentTier = feeTiers.currentTier || CURRENT_TIER;
  const currentTierPercent = feeTiers.currentTierPercent ?? DEFAULT_TIER_PERCENT;
  const nextTier = feeTiers.nextTier || "";
  const nextTierPercent = feeTiers.nextTierPercent ?? null;
  const [usedAmount, setUsedAmount] = useState(feeTiers.usedAmount || DEFAULT_USED_AMOUNT);

  // Merchant is "premium eligible" once they've hit ≥60% of monthly limit —
  // meaning they're actually processing real volume and would benefit.
  const isPremiumEligible = useMemo(
    () => usedAmount / Math.max(monthlyLimit, 1) >= 0.6,
    [usedAmount, monthlyLimit],
  );

  useEffect(() => {
    if (feeTiers.usedAmount > 0) {
      setUsedAmount(feeTiers.usedAmount);
    }
  }, [feeTiers.usedAmount]);

  useEffect(() => {
    if (usedAmount > monthlyLimit) {
      setUsedAmount(monthlyLimit);
    }
  }, [usedAmount, monthlyLimit]);

  return (
    <Box sx={{ px: { xs: "16px", md: "0px" } }}>
      <PanelCard
        title={tDashboard("feeTierProgress")}
        subTitle={tDashboard("yourProgressTowardsTheNextFeeTier")}
        showHeaderBorder={false}
        headerPadding={muiTheme.spacing(2.5, 2.5, 0, 2.5)}
        bodyPadding={
          isMobile
            ? muiTheme.spacing("12px", 2, 2, 2)
            : muiTheme.spacing("22px", 2.5, 2.5, 2.5)
        }
        headerActionLayout="inline"
        headerSx={{ alignItems: "start" }}
        headerAction={
          <IconButton
            aria-label={tDashboard?.("changeDisplayCurrency", { defaultValue: "Change display currency" }) || "Change display currency"}
            sx={{
              position: "absolute",
              right: "12px",
              top: "12px",
              backgroundColor: muiTheme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "#E9ECF2",
              p: "8px",
              // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
              width: isMobile ? 44 : 40,
              height: isMobile ? 44 : 40,
              "&:hover": { backgroundColor: muiTheme.palette.mode === "dark" ? "rgba(255,255,255,0.2)" : "#D9DCE2" },
            }}
          >
            <Image
              src={CurrencyIcon}
              alt="Currency"
              width={18}
              height={18}
              draggable={false}
              style={{ width: "clamp(14px, 2vw, 18px)", height: "auto " }}
            />
          </IconButton>
        }
      >
        <Box>
          {/* Monthly Volume */}
          <Box
            sx={{
              height: isMobile ? "16px" : "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: isMobile ? "8px" : "14px",
            }}
          >
            <Typography
              sx={{
                fontSize: isMobile ? 10 : 13,
                color: muiTheme.palette.text.secondary,
                fontFamily: "var(--font-sans)",
                lineHeight: 1.2,
                letterSpacing: 0,
                fontWeight: 500,
              }}
            >
              {tDashboard("monthlyVolume")}
            </Typography>

            <Typography component="div" sx={{ fontFamily: "var(--font-sans)" }}>
              <Box
                component="span"
                sx={{
                  fontSize: isMobile ? 13 : 15,
                  color: muiTheme.palette.text.primary,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontWeight: 500,
                }}
              >
                {getCurrencySymbol("USD", formatNumberWithComma(usedAmount))}
              </Box>
              <Box
                component="span"
                sx={{
                  px: "6px",
                  fontSize: isMobile ? 10 : 13,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontWeight: 500,
                  color: muiTheme.palette.text.secondary,
                }}
              >
                /
              </Box>
              <Box
                component="span"
                sx={{
                  fontSize: isMobile ? 10 : 13,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontWeight: 500,
                  color: muiTheme.palette.text.secondary,
                }}
              >
                {getCurrencySymbol("USD", monthlyLimit.toLocaleString())}
              </Box>
            </Typography>
          </Box>

          {/* Progress */}
          <FeeTierProgress
            monthlyLimit={monthlyLimit}
            usedAmount={usedAmount}
            currentTier={currentTier}
          />

          {/* Current Tier Badge — shows tier NAME + real %-rate merchant is charged */}
          <Box
            sx={{
              mt: isMobile ? 1.5 : 3,
              minHeight: isMobile ? "32px" : "40px",
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.75,
              px: 1.5,
              py: isMobile ? "8px" : "11px",
              borderRadius: "100px",
              background: muiTheme.palette.success.light,
              border: `1px solid ${muiTheme.palette.success.main}`,
            }}
          >
            <Typography
              component="div"
              sx={{
                fontSize: isMobile ? 13 : 15,
                fontWeight: 500,
                color: muiTheme.palette.success.dark,
                fontFamily: "var(--font-sans)",
                lineHeight: 1.2,
                letterSpacing: "0",
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {tDashboard("currentTier")}:
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Image
                  src={CheckCircleIcon}
                  alt="Active Tier"
                  width={16}
                  height={16}
                  draggable={false}
                />
                <Box component="span" data-testid="current-tier-name">{currentTier}</Box>
                <Box
                  component="span"
                  data-testid="current-tier-percent"
                  sx={{
                    fontWeight: 700,
                    fontFamily: "var(--font-sans)",
                    color: muiTheme.palette.success.dark,
                    ml: 0.5,
                  }}
                >
                  · {currentTierPercent}%
                </Box>
              </Box>
            </Typography>
          </Box>

          {/* Next-tier savings hint — encourages continued volume growth */}
          {nextTier && nextTierPercent !== null && nextTierPercent < currentTierPercent && (
            <Typography
              data-testid="next-tier-hint"
              sx={{
                mt: isMobile ? 1 : 1.5,
                textAlign: "center",
                fontSize: isMobile ? 11 : 12,
                color: muiTheme.palette.text.secondary,
                fontFamily: "var(--font-sans)",
                lineHeight: 1.4,
                px: 1,
              }}
            >
              {tDashboard("nextTierHint")
                .replace("{next}", nextTier)
                .replace("{pct}", `${nextTierPercent}%`)
                .replace("{savings}", `${(currentTierPercent - nextTierPercent).toFixed(2)}%`)}
            </Typography>
          )}

          {/* Consolidated "Grow with Dynopay" panel — replaces the standalone
              PremiumTierCard. Surfaces ONE offer at a time in priority order
              (fee-free trial credit → premium upgrade → referral program)
              so the right rail doesn't feel salesy. */}
        </Box>
      </PanelCard>

      <Box sx={{ mt: 2 }}>
        <CreatorPageCard />
      </Box>

      <Box sx={{ mt: 2 }}>
        <GrowPanel
          hasFeeFreeCredit={hasFeeFreeCredit}
          hasCompletedFeeFreeTrial={hasCompletedFeeFreeTrial}
          isPremiumEligible={isPremiumEligible}
        />
      </Box>

      {isMobile && (
        <Box mt={2}>
          <ReferralAndKnowledge isMobile />
        </Box>
      )}
    </Box>
  );
};

export default DashboardRightSection;
