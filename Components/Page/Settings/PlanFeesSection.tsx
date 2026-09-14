/**
 * Settings → Payments → Plan & fees (in-app).
 *
 * Replaces the old rail pointer that navigated to the public /fees marketing
 * page (which dropped the merchant out of the dashboard shell). Shows the
 * merchant's live tier + volume progress (reusing the dashboard FeeTierCard),
 * a plain-language breakdown of what a payment costs, and a worked example.
 */
import React, { useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import {
  PercentRounded,
  ArrowOutwardRounded,
  CheckCircleRounded,
} from "@mui/icons-material";
import Link from "next/link";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

import FeeTierCard from "@/Components/Page/Dashboard/v2026/FeeTierCard";
import { rootReducer } from "@/utils/types";
import {
  PUBLIC_FEE_TIERS,
  FIXED_FEE_USD,
  MONTHLY_FEE_USD,
  SETUP_FEE_USD,
} from "@/constants/feeTiers";
import { MONO } from "@/styles/uiKit";

const fmtUsd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);

const PlanFeesSection: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("common");

  const feeTiers = useSelector((s: rootReducer) => s.dashboardReducer?.feeTiers) as
    | { currentTier?: string; currentTierPercent?: number }
    | undefined;

  const currentTier = feeTiers?.currentTier || PUBLIC_FEE_TIERS[0].name;
  const currentPct =
    typeof feeTiers?.currentTierPercent === "number"
      ? feeTiers.currentTierPercent
      : PUBLIC_FEE_TIERS.find((x) => x.name === currentTier)?.pct ?? PUBLIC_FEE_TIERS[0].pct;

  // Worked example on a $100 payment at the merchant's live rate.
  const example = useMemo(() => {
    const amount = 100;
    const pctFee = (amount * currentPct) / 100;
    const total = pctFee + FIXED_FEE_USD;
    return { amount, pctFee, total, net: amount - total };
  }, [currentPct]);

  const cardSx = {
    borderRadius: "14px",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#E9ECF2"}`,
    bgcolor: isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF",
    p: { xs: 2, md: 2.5 },
  };

  const rowSx = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    py: 1.25,
    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "#F0F2F6"}`,
    "&:last-of-type": { borderBottom: 0 },
  };

  const labelSx = { fontSize: 13.5, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, fontWeight: 500 };
  const subSx = { fontSize: 12, fontFamily: "var(--font-sans)", color: theme.palette.text.secondary, mt: 0.25 };
  const valueSx = { fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" as const };

  const includes = [
    t("planFees.inc1", { defaultValue: "Unlimited payment links, invoices and storefront products" }),
    t("planFees.inc2", { defaultValue: "Auto-conversion to stablecoins and merchant payouts" }),
    t("planFees.inc3", { defaultValue: "Real-time email + webhook notifications" }),
    t("planFees.inc4", { defaultValue: "Team access and API keys" }),
  ];

  return (
    <Box data-testid="plan-fees-section" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Intro banner */}
      <Box
        sx={{
          ...cardSx,
          display: "flex",
          gap: 1.5,
          alignItems: "flex-start",
          bgcolor: isDark ? "rgba(129,140,248,0.06)" : "#F5F6FE",
          border: `1px solid ${isDark ? "rgba(129,140,248,0.20)" : "#E0E3F7"}`,
        }}
      >
        <PercentRounded sx={{ fontSize: 20, color: theme.palette.text.secondary, mt: "1px" }} />
        <Typography sx={{ fontSize: 13, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", lineHeight: 1.55 }}>
          {t("planFees.intro", {
            defaultValue:
              "You're on pay-as-you-go: no monthly fee, no setup fee. You only pay a small fee on each successful payment, and the percentage drops automatically as your monthly volume grows.",
          })}
        </Typography>
      </Box>

      {/* Live tier + progress (shared with the dashboard) */}
      <Box data-testid="plan-fees-tier-card">
        <FeeTierCard />
      </Box>

      {/* What a payment costs */}
      <Box sx={cardSx} data-testid="plan-fees-breakdown">
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-sans)", mb: 0.5 }}>
          {t("planFees.breakdownTitle", { defaultValue: "What a payment costs" })}
        </Typography>
        <Typography sx={{ ...subSx, mb: 1 }}>
          {t("planFees.breakdownSub", {
            defaultValue: "Fees are deducted from each payment before it is credited to your wallet.",
          })}
        </Typography>

        <Box sx={rowSx}>
          <Box>
            <Typography sx={labelSx}>{t("planFees.platformFee", { defaultValue: "Platform fee" })}</Typography>
            <Typography sx={subSx}>
              {t("planFees.platformFeeSub", { defaultValue: "Based on your current tier ({{tier}})", tier: currentTier })}
            </Typography>
          </Box>
          <Typography sx={valueSx} data-testid="plan-fees-current-pct">{currentPct}%</Typography>
        </Box>
        <Box sx={rowSx}>
          <Box>
            <Typography sx={labelSx}>{t("planFees.fixedFee", { defaultValue: "Fixed fee" })}</Typography>
            <Typography sx={subSx}>{t("planFees.fixedFeeSub", { defaultValue: "Per successful payment" })}</Typography>
          </Box>
          <Typography sx={valueSx}>{fmtUsd(FIXED_FEE_USD)}</Typography>
        </Box>
        <Box sx={rowSx}>
          <Box>
            <Typography sx={labelSx}>{t("planFees.networkFee", { defaultValue: "Blockchain network fee" })}</Typography>
            <Typography sx={subSx}>
              {t("planFees.networkFeeSub", {
                defaultValue: "Set per payment link — paid by you or by your customer",
              })}
            </Typography>
          </Box>
          <Typography sx={{ ...valueSx, color: theme.palette.text.secondary, fontWeight: 600 }}>
            {t("planFees.varies", { defaultValue: "Varies" })}
          </Typography>
        </Box>
        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t("planFees.monthlyFee", { defaultValue: "Monthly fee" })}</Typography>
          <Typography sx={valueSx}>{fmtUsd(MONTHLY_FEE_USD)}</Typography>
        </Box>
        <Box sx={rowSx}>
          <Typography sx={labelSx}>{t("planFees.setupFee", { defaultValue: "Setup fee" })}</Typography>
          <Typography sx={valueSx}>{fmtUsd(SETUP_FEE_USD)}</Typography>
        </Box>

        {/* Worked example */}
        <Box
          data-testid="plan-fees-example"
          sx={{
            mt: 2,
            p: 1.75,
            borderRadius: "12px",
            bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#F7F8FB",
            border: `1px dashed ${theme.palette.divider}`,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.palette.text.secondary, fontFamily: "var(--font-tech), monospace", mb: 0.75 }}>
            {t("planFees.exampleTitle", { defaultValue: "Example" })}
          </Typography>
          <Typography sx={{ fontSize: 13.5, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, lineHeight: 1.6 }}>
            {t("planFees.exampleBody", {
              defaultValue:
                "A customer pays {{amount}}. Dynopay keeps {{pct}}% ({{pctFee}}) + {{fixed}} fixed = {{total}}. You receive {{net}}.",
              amount: fmtUsd(example.amount),
              pct: currentPct,
              pctFee: fmtUsd(example.pctFee),
              fixed: fmtUsd(FIXED_FEE_USD),
              total: fmtUsd(example.total),
              net: fmtUsd(example.net),
            })}
          </Typography>
        </Box>
      </Box>

      {/* Included */}
      <Box sx={cardSx}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-sans)", mb: 1.25 }}>
          {t("planFees.includedTitle", { defaultValue: "Included in every plan" })}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1 }}>
          {includes.map((line) => (
            <Box key={line} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
              <CheckCircleRounded sx={{ fontSize: 17, color: "#10B981", mt: "1px" }} />
              <Typography sx={{ fontSize: 13, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{line}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Link
            href="/fees"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="plan-fees-public-link"
            style={{ textDecoration: "none" }}
          >
            <Typography
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                color: theme.palette.text.secondary,
                "&:hover": { color: theme.palette.text.primary },
              }}
            >
              {t("planFees.publicLink", { defaultValue: "View public pricing page" })}
              <ArrowOutwardRounded sx={{ fontSize: 14 }} />
            </Typography>
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default PlanFeesSection;
