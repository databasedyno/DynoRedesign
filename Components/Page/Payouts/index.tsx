import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { SUCCESS_GREEN } from "@/constants/theme";
import { CardSx } from "./payoutsHelpers";
import { useAutoConvertSettings } from "./useAutoConvertSettings";
import SettlementCard from "./SettlementCard";
import SavingsCard from "./SavingsCard";
import DigestCard from "./DigestCard";
import QuickLinksRow from "./QuickLinksRow";
import PendingFundsCard from "./PendingFundsCard";
import RecentSettlementsCard from "./RecentSettlementsCard";

/**
 * Balances & Payouts — a single "where's my money" surface that pulls together
 * settled volume, pending funds, auto-conversion status, settlement wallets and
 * recent settlements. All data is real (dashboard stats + /company/auto-convert);
 * actions link out to the existing Settings, Payout wallets, Receipts and
 * Transactions screens.
 */
const PayoutsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation("common");
  const { selectedCompanyId } = useCompanyStore();

  const dashboard = useDashboardData();
  // stats/feeTiers are read loosely: the saga populates more fields at runtime
  // (e.g. pendingTransactions) than the reducer's TS type currently declares.
  const stats: any = dashboard.stats;
  const feeTiers: any = dashboard.feeTiers;
  const loading = dashboard.loading;
  const txns: any[] = Array.isArray(dashboard.recentTransactions) ? dashboard.recentTransactions : [];
  const sym = stats?.currencySymbol || "$";

  const ac = useAutoConvertSettings(selectedCompanyId);

  const cardSx: CardSx = {
    borderRadius: 3,
    border: `1px solid ${theme.palette.divider}`,
    bgcolor: theme.palette.background.paper,
    p: { xs: 2, sm: 2.5 },
  };

  const summary: { label: string; value: string | null; hint: string; accent?: string }[] = [
    {
      label: t("payouts.totalSettled", { defaultValue: "Total settled" }),
      value: loading ? null : stats?.totalVolumeFormatted || `${sym}0.00`,
      hint: t("payouts.totalSettledHint", { defaultValue: "Lifetime volume received" }),
    },
    {
      label: t("payouts.pending", { defaultValue: "Pending" }),
      value: loading ? null : `${stats?.pendingTransactions ?? 0}`,
      hint: t("payouts.pendingHint", { defaultValue: "Payments awaiting confirmation" }),
    },
    {
      label: t("payouts.autoConvert", { defaultValue: "Auto\u2011convert" }),
      value: ac.settlementLoading ? null : ac.enabled ? t("payouts.on", { defaultValue: "On" }) : t("payouts.off", { defaultValue: "Off" }),
      hint: ac.enabled
        ? t("payouts.settlingTo", { defaultValue: "Settling to {{target}}", target: ac.settlementTarget })
        : t("payouts.autoConvertHint", { defaultValue: "Convert crypto to a stablecoin" }),
      accent: ac.enabled ? SUCCESS_GREEN : undefined,
    },
    {
      label: t("payouts.feeTier", { defaultValue: "Fee tier" }),
      value: loading ? null : feeTiers?.currentTier || "Starter",
      hint:
        feeTiers?.currentTierPercent != null
          ? t("payouts.feePerTxn", { defaultValue: "{{pct}}% per transaction", pct: feeTiers.currentTierPercent })
          : t("payouts.feeTierHint", { defaultValue: "Your current pricing" }),
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 3 } }}>
      {/* Summary strip */}
      <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        {summary.map((c) => (
          <Box key={c.label} sx={cardSx}>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
              {c.label}
            </Typography>
            {c.value === null ? (
              <Skeleton width="70%" height={34} />
            ) : (
              <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 700, mt: 0.5, color: c.accent || theme.palette.text.primary, lineHeight: 1.2 }}>
                {c.value}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: "block", mt: 0.5 }}>
              {c.hint}
            </Typography>
          </Box>
        ))}
      </Box>

      <SettlementCard ac={ac} cardSx={cardSx} />
      <SavingsCard companyId={selectedCompanyId} cardSx={cardSx} />
      <DigestCard cardSx={cardSx} />
      <QuickLinksRow cardSx={cardSx} taxCollectedLabel={loading ? "\u2026" : stats?.taxCollectedFormatted || `${sym}0.00`} />
      <PendingFundsCard companyId={selectedCompanyId} cardSx={cardSx} sym={sym} onSettled={dashboard.refreshDashboard} />
      <RecentSettlementsCard companyId={selectedCompanyId} cardSx={cardSx} sym={sym} loading={loading} txns={txns} />
    </Box>
  );
};

export default PayoutsPage;
