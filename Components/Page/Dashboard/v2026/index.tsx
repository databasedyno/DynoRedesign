import React, { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { rootReducer } from "@/utils/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import CommandBar, { RangeId } from "./CommandBar";
import VolumeHero from "./VolumeHero";
import KpiStrip from "./KpiStrip";
import QuickActionsDock from "./QuickActionsDock";
import FeeTierCard from "./FeeTierCard";
import AssetsCard from "./AssetsCard";
import ActivationChecklist from "./ActivationChecklist";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import GrowPanel from "../GrowPanel";
import CreatorPageCard from "../CreatorPageCard";

interface Props {
  onSwitchClassic?: () => void;
}

/**
 * Dashboard2026 — the merchant command-center composition.
 *
 * Layout:
 *   CommandBar (greeting + global time range + settings)
 *   ─ bento grid (8fr / 4fr) ─
 *   MAIN : [Activation OR (VolumeHero + KpiStrip)] + Recent activity + Assets
 *   ASIDE: Quick actions + Fee tier + Grow offer + Storefront
 *
 * A single fetchChartData(range) call here feeds both the VolumeHero chart
 * and the KPI-strip sparklines (they read the shared redux chartData).
 */
const Dashboard2026: React.FC<Props> = ({ onSwitchClassic }) => {
  const router = useRouter();
  const [range, setRange] = useState<RangeId>("7d");
  const {
    stats,
    chartData,
    recentTransactions,
    feeTiers,
    loading,
    chartLoading,
    fetchChartData,
  } = useDashboardData();

  useEffect(() => {
    fetchChartData(range);
  }, [range, fetchChartData]);

  const companyState = useSelector((s: rootReducer) => s.companyReducer);
  const walletState = useSelector((s: rootReducer) => s.walletReducer);
  const userProfile = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile,
  );
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;

  const hasPayment = useMemo(() => {
    const totalTx = Number(stats?.totalTransactions ?? 0);
    const totalVol = Number(stats?.totalVolume ?? 0);
    if (totalTx > 0 || totalVol > 0) return true;
    const list = (recentTransactions as any[]) || [];
    return list.some((tx) =>
      [
        "confirmed",
        "completed",
        "settled",
        "success",
        "successful",
        "paid",
      ].includes(String(tx?.status || "").toLowerCase()),
    );
  }, [stats?.totalTransactions, stats?.totalVolume, recentTransactions]);

  const showActivation = hasCompany && hasWallet && !hasPayment && !loading;

  // Grow-panel offer signals (mirrors DashboardRightSection priority logic)
  const feeFreeRemaining = Number(
    userProfile?.fee_free_remaining_usd ?? userProfile?.feeFreeRemainingUsd ?? NaN,
  );
  const hasFeeFreeCredit =
    Number.isFinite(feeFreeRemaining) && feeFreeRemaining > 0;
  const hasCompletedFeeFreeTrial =
    Number.isFinite(feeFreeRemaining) &&
    feeFreeRemaining <= 0 &&
    Number(userProfile?.cumulative_volume_usd ?? 0) > 0;
  const usedAmount = Number(feeTiers?.usedAmount ?? 0);
  const monthlyLimit = Number(feeTiers?.monthlyLimit ?? 10000);
  const isPremiumEligible = usedAmount / Math.max(monthlyLimit, 1) >= 0.6;

  return (
    <Box data-testid="dash2026-root">
      <CommandBar
        range={range}
        onRangeChange={setRange}
        onSwitchClassic={onSwitchClassic}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 8fr) minmax(0, 4fr)",
          },
          gap: { xs: 2, md: 2.5, lg: 3 },
          alignItems: "start",
        }}
      >
        {/* MAIN */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 2, md: 2.5 },
            minWidth: 0,
          }}
        >
          {showActivation ? (
            <ActivationChecklist
              hasCompany={hasCompany}
              hasWallet={hasWallet}
              onCreateLink={() => router.push("/create-pay-link")}
            />
          ) : (
            <>
              <VolumeHero
                stats={stats}
                chartData={chartData}
                loading={loading}
                chartLoading={chartLoading}
                range={range}
              />
              <KpiStrip stats={stats} chartData={chartData} loading={loading} />
            </>
          )}

          <RecentTransactionsWidget
            transactions={recentTransactions as any[]}
            loading={loading}
          />

          {!showActivation && <AssetsCard />}
        </Box>

        {/* ASIDE */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: { xs: 2, md: 2.5 },
            minWidth: 0,
          }}
        >
          <QuickActionsDock />
          {!showActivation && <FeeTierCard />}
          <GrowPanel
            hasFeeFreeCredit={hasFeeFreeCredit}
            hasCompletedFeeFreeTrial={hasCompletedFeeFreeTrial}
            isPremiumEligible={isPremiumEligible}
          />
          <CreatorPageCard />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard2026;
