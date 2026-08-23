import useAccountProfile from "@/hooks/useAccountProfile";
import { useWalletStore } from "@/contexts/WalletDataContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { rootReducer } from "@/utils/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import fireConfetti from "@/helpers/fireConfetti";
import { RangeId } from "./CommandBar";
import BalanceStrip from "./BalanceStrip";
import VolumeChart from "./VolumeChart";
import ActionsRow from "./ActionsRow";
import EmptyHero from "./EmptyHero";
import KpiStrip from "./KpiStrip";
import FeeTierCard from "./FeeTierCard";
import AssetsCard from "./AssetsCard";
import ActivationChecklist from "./ActivationChecklist";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import GrowSlot from "./GrowSlot";
import ReferralCodeCard from "../ReferralCodeCard";

/**
 * Dashboard2026 — the merchant command center (P4 "Quiet Money" re-layout).
 *
 * Vertical rhythm (Coinbase/Stripe-class restraint):
 *   Row 1  BalanceStrip  — eyebrow greeting · range control · settings ·
 *                          big mono volume + delta + metric dropdown · ONE
 *                          primary "+ Payment link" button
 *   Row 1½ ActionsRow    — 4 quiet ghost-button shortcuts (was the 2×2 dock)
 *   Row 2  VolumeChart (8) + rail (4): FeeTierCard (quiet line) + GrowSlot
 *   Row 3  KpiStrip      — 3 KPIs (payments today · active wallets · tax)
 *   Row 4  Recent activity
 *   Row 5  AssetsCard    — assets breakdown (kept, scrolls below the fold)
 *
 * A single fetchChartData(range) call feeds both the chart and the KPI-strip
 * sparkline (shared redux chartData).
 */
const Dashboard2026: React.FC = () => {
  const router = useRouter();
  const [range, setRange] = useState<RangeId>("7d");
  const { density, isCompact } = useDashboardDensity();
  const [custom, setCustom] = useState<{ startDate: string; endDate: string } | null>(
    null,
  );
  const {
    stats,
    chartData,
    chartSummary,
    chartAssets,
    recentTransactions,
    feeTiers,
    loading,
    chartLoading,
    fetchChartData,
  } = useDashboardData();

  useEffect(() => {
    if (custom) fetchChartData("custom", custom.startDate, custom.endDate);
    else fetchChartData(range);
  }, [range, custom, fetchChartData]);

  // ── Confetti on paid ──────────────────────────────────────────────
  // Celebrate when a NEW payment has settled since the merchant last saw the
  // dashboard (once; never on first-ever load, honours reduced-motion).
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (confettiFiredRef.current) return;
    const list = (recentTransactions as any[]) || [];
    if (!list.length) return;
    const settledStatuses = ["confirmed", "completed", "settled", "success", "successful", "paid"];
    const topSettled = list.find((tx) =>
      settledStatuses.includes(String(tx?.status || "").toLowerCase()),
    );
    if (!topSettled) return;
    const id = String(
      topSettled.id ?? topSettled.transaction_id ?? topSettled.reference ?? topSettled.createdAt ?? "",
    );
    if (!id) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem("dyno_last_settled_txn");
    } catch {
      /* storage unavailable — skip celebration, still harmless */
    }
    if (last && last !== id) {
      confettiFiredRef.current = true;
      void fireConfetti();
    }
    try {
      window.localStorage.setItem("dyno_last_settled_txn", id);
    } catch {
      /* ignore */
    }
  }, [recentTransactions]);

  // Human label for the active window (drives the chart eyebrow + balance strip).
  const rangeLabel = useMemo(() => {
    const presetLabels: Record<RangeId, string> = {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
      "1y": "12 months",
    };
    if (!custom) return presetLabels[range];
    const sameYear = custom.startDate.slice(0, 4) === custom.endDate.slice(0, 4);
    const fmt = (iso: string, withYear: boolean) => {
      try {
        return format(new Date(`${iso}T00:00:00`), withYear ? "MMM d, yyyy" : "MMM d");
      } catch {
        return iso;
      }
    };
    return `${fmt(custom.startDate, !sameYear)} – ${fmt(custom.endDate, !sameYear)}`;
  }, [range, custom]);

  const { accountType, hasAccount, profileComplete } = useAccountProfile();
  const walletState = useWalletStore();
  const userProfile = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile,
  );
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;

  const hasPayment = useMemo(() => {
    const totalTx = Number(stats?.totalTransactions ?? 0);
    const totalVol = Number(stats?.totalVolume ?? 0);
    if (totalTx > 0 || totalVol > 0) return true;
    const list = (recentTransactions as any[]) || [];
    return list.some((tx) =>
      ["confirmed", "completed", "settled", "success", "successful", "paid"].includes(
        String(tx?.status || "").toLowerCase(),
      ),
    );
  }, [stats?.totalTransactions, stats?.totalVolume, recentTransactions]);

  const showActivation = hasAccount && hasWallet && !hasPayment && !loading;

  // Has an account but zero lifetime volume AND isn't in the activation flow
  // (e.g. no wallet yet) → show the encouraging "make first sale" hero.
  const isEmpty =
    !loading &&
    !!stats &&
    Number(stats.totalTransactions ?? 0) === 0 &&
    Number(stats.totalVolume ?? 0) === 0;

  // Grow-panel offer signals (mirrors DashboardRightSection priority logic).
  const feeFreeRemaining = Number(
    userProfile?.fee_free_remaining_usd ?? userProfile?.feeFreeRemainingUsd ?? NaN,
  );
  const hasFeeFreeCredit = Number.isFinite(feeFreeRemaining) && feeFreeRemaining > 0;
  const hasCompletedFeeFreeTrial =
    Number.isFinite(feeFreeRemaining) &&
    feeFreeRemaining <= 0 &&
    Number(userProfile?.cumulative_volume_usd ?? 0) > 0;
  const usedAmount = Number(feeTiers?.usedAmount ?? 0);
  const monthlyLimit = Number(feeTiers?.monthlyLimit ?? 10000);
  const isPremiumEligible = usedAmount / Math.max(monthlyLimit, 1) >= 0.6;

  const stackGap = isCompact ? { xs: 1.25, md: 1.75 } : { xs: 2, md: 2.5 };

  return (
    <Box
      data-testid="dash2026-root"
      data-density={density}
      sx={
        isCompact
          ? {
              "& [data-testid='dash2026-kpi-strip']": { gap: "12px" },
              "& [data-testid='dash2026-kpi-strip'] > div": {
                padding: "14px 16px",
                gap: "6px",
              },
              "& [data-testid='dash2026-fee-tier']": { padding: "16px" },
              "& [data-testid='dash2026-assets']": { padding: "16px" },
            }
          : undefined
      }
    >
      {showActivation ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          <ActionsRow />
          <ActivationChecklist
            accountType={accountType}
            profileComplete={profileComplete}
            hasWallet={hasWallet}
            onCreateLink={() => router.push("/create-pay-link")}
          />
          <RecentTransactionsWidget
            transactions={recentTransactions as any[]}
            loading={loading}
          />
          <ReferralCodeCard />
        </Box>
      ) : isEmpty ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          <ActionsRow />
          <EmptyHero />
          <RecentTransactionsWidget
            transactions={recentTransactions as any[]}
            loading={loading}
          />
          <ReferralCodeCard />
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          {/* Row 1 — balance strip */}
          <BalanceStrip
            stats={stats}
            chartData={chartData}
            chartSummary={chartSummary}
            loading={loading}
            chartLoading={chartLoading}
            rangeLabel={rangeLabel}
            range={range}
            onRangeChange={(r) => {
              setCustom(null);
              setRange(r);
            }}
            custom={custom}
            onCustomApply={(s, e) => setCustom({ startDate: s, endDate: e })}
            onCustomClear={() => setCustom(null)}
          />

          {/* Row 1½ — quick actions */}
          <ActionsRow />

          {/* Row 2 — chart (8) + rail (4) */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(0, 8fr) minmax(0, 4fr)",
              },
              gap: stackGap,
              alignItems: "start",
            }}
          >
            <VolumeChart
              chartData={chartData}
              loading={loading}
              chartLoading={chartLoading}
              currencySymbol={stats?.currencySymbol}
              rangeLabel={rangeLabel}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1fr" },
                gap: stackGap,
                alignItems: "start",
              }}
            >
              <FeeTierCard />
              <GrowSlot
                hasFeeFreeCredit={hasFeeFreeCredit}
                hasCompletedFeeFreeTrial={hasCompletedFeeFreeTrial}
                isPremiumEligible={isPremiumEligible}
              />
              <ReferralCodeCard />
            </Box>
          </Box>

          {/* Row 3 — KPIs */}
          <KpiStrip stats={stats} chartData={chartData} loading={loading} />

          {/* Row 4 — recent activity */}
          <RecentTransactionsWidget
            transactions={recentTransactions as any[]}
            loading={loading}
          />

          {/* Row 5 — assets breakdown (kept, below the fold) */}
          <AssetsCard
            assets={chartAssets}
            rangeLabel={rangeLabel}
            currencySymbol={stats?.currencySymbol}
            loading={loading || chartLoading}
          />
        </Box>
      )}
    </Box>
  );
};

export default Dashboard2026;
