import useAccountProfile from "@/hooks/useAccountProfile";
import { useWalletStore } from "@/contexts/WalletDataContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { rootReducer } from "@/utils/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import dynamic from "next/dynamic";
import { RangeId } from "./CommandBar";
import BalanceStrip from "./BalanceStrip";
import ActionsRow from "./ActionsRow";
import EmptyHero from "./EmptyHero";
import FeeTierCard from "./FeeTierCard";
import AssetsCard from "./AssetsCard";
import ActivationChecklist from "./ActivationChecklist";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import GrowSlot from "./GrowSlot";
import ReferralCodeCard from "../ReferralCodeCard";
import ConversionBanner from "../ConversionBanner";

// Dashboard Diet: VolumeChart and KpiStrip both pull in `recharts` (a large
// dependency). Loading them via next/dynamic (ssr:false) moves recharts into
// separate async chunks so the dashboard's initial JS paints the numbers first;
// height-matched skeletons hold the layout so there's no shift when they hydrate.
const ChartSkeleton = ({ h }: { h: number }) => (
  <Box
    aria-hidden
    sx={{
      height: h,
      width: "100%",
      borderRadius: 3,
      backgroundColor: "action.hover",
      opacity: 0.4,
    }}
  />
);
const VolumeChart = dynamic(() => import("./VolumeChart"), {
  ssr: false,
  loading: () => <ChartSkeleton h={340} />,
});
const KpiStrip = dynamic(() => import("./KpiStrip"), {
  ssr: false,
  loading: () => <ChartSkeleton h={116} />,
});


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
  const { t } = useTranslation("dashboardLayout");
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
      // Lazy-load canvas-confetti only when actually celebrating a settlement,
      // keeping it out of the dashboard's initial bundle (Dashboard Diet).
      void import("@/helpers/fireConfetti")
        .then((m) => m.default())
        .catch(() => {});
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
      "7d": t("rangeDays7", { defaultValue: "7 days" }),
      "30d": t("rangeDays30", { defaultValue: "30 days" }),
      "90d": t("rangeDays90", { defaultValue: "90 days" }),
      "1y": t("rangeMonths12", { defaultValue: "12 months" }),
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
  }, [range, custom, t]);

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

  // Entrance motion: each section fades in with a 6px rise, staggered 50ms
  // apart (page-transition rule: tiny slide + fade, ≤300ms, reduced-motion safe).
  const riseSx = {
    "@keyframes dashRise": {
      from: { opacity: 0, transform: "translateY(6px)" },
      to: { opacity: 1, transform: "none" },
    },
    "& > div > *": {
      animation: "dashRise 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
    },
    "& > div > *:nth-of-type(2)": { animationDelay: "50ms" },
    "& > div > *:nth-of-type(3)": { animationDelay: "100ms" },
    "& > div > *:nth-of-type(4)": { animationDelay: "150ms" },
    "& > div > div:nth-of-type(3) > *": {
      animation: "dashRise 320ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
    },
    "& > div > div:nth-of-type(3) > *:nth-of-type(1)": { animationDelay: "120ms" },
    "& > div > div:nth-of-type(3) > *:nth-of-type(2)": { animationDelay: "170ms" },
    "& > div > div:nth-of-type(3) > *:nth-of-type(3)": { animationDelay: "220ms" },
    "& > div > div:nth-of-type(3) > *:nth-of-type(4)": { animationDelay: "270ms" },
    "& > div > div:nth-of-type(3) > *:nth-of-type(5)": { animationDelay: "320ms" },
    "@media (prefers-reduced-motion: reduce)": {
      "& > div > *, & > div > div:nth-of-type(3) > *": { animation: "none" },
    },
  } as const;

  return (
    <Box
      data-testid="dash2026-root"
      data-density={density}
      sx={
        isCompact
          ? {
              ...riseSx,
              "& [data-testid='dash2026-kpi-strip']": { gap: "12px" },
              "& [data-testid='dash2026-kpi-strip'] > div": {
                padding: "14px 16px",
                gap: "6px",
              },
              "& [data-testid='dash2026-fee-tier']": { padding: "16px" },
              "& [data-testid='dash2026-assets']": { padding: "16px" },
            }
          : riseSx
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

          {/* Auto-convert status + inline enable/disable (QA DASH-001):
              surfaces whether incoming crypto is auto-converted to a
              stablecoin, with a quick toggle. Self-guards (renders null while
              loading / no company). Shown for established merchants only. */}
          <ConversionBanner />

          {/* Rows 2-5 — one grid: the LEFT column (chart → KPIs → activity →
              assets) flows beside the RIGHT rail (fee tier · grow · referral).
              Previously the rail and chart shared a single grid row, so the
              3-card rail's height left a huge empty space under the short
              chart before Row 3 could start. The rail now spans the rows and
              the left content climbs up next to it. Mobile (xs) DOM order is
              unchanged: chart → rail → KPIs → activity → assets. */}
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
            <Box sx={{ minWidth: 0, gridColumn: { lg: "1" } }}>
              <VolumeChart
                chartData={chartData}
                loading={loading}
                chartLoading={chartLoading}
                currencySymbol={stats?.currencySymbol}
                rangeLabel={rangeLabel}
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1fr" },
                gap: stackGap,
                alignItems: "start",
                gridColumn: { lg: "2" },
                gridRow: { lg: "1 / span 4" },
                minWidth: 0,
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

            {/* Row 3 — KPIs */}
            <Box sx={{ minWidth: 0, gridColumn: { lg: "1" } }}>
              <KpiStrip stats={stats} chartData={chartData} loading={loading} />
            </Box>

            {/* Row 4 — recent activity */}
            <Box sx={{ minWidth: 0, gridColumn: { lg: "1" } }}>
              <RecentTransactionsWidget
                transactions={recentTransactions as any[]}
                loading={loading}
              />
            </Box>

            {/* Row 5 — assets breakdown (kept, below the fold) */}
            <Box sx={{ minWidth: 0, gridColumn: { lg: "1" } }}>
              <AssetsCard
                assets={chartAssets}
                rangeLabel={rangeLabel}
                currencySymbol={stats?.currencySymbol}
                loading={loading || chartLoading}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard2026;
