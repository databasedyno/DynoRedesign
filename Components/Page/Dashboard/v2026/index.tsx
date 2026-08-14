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
import CommandBar, { RangeId } from "./CommandBar";
import VolumeHero from "./VolumeHero";
import KpiStrip from "./KpiStrip";
import QuickActionsDock from "./QuickActionsDock";
import FeeTierCard from "./FeeTierCard";
import AssetsCard from "./AssetsCard";
import ActivationChecklist from "./ActivationChecklist";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import GrowSlot from "./GrowSlot";

/**
 * Dashboard2026 — the merchant command-center composition (default dashboard).
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
const Dashboard2026: React.FC = () => {
  const router = useRouter();
  const [range, setRange] = useState<RangeId>("7d");
  // Density (compact/spacious) — toggled from the CommandBar settings menu or
  // the Recent-transactions widget. Compact tightens the WHOLE dashboard:
  // grid gaps here + card paddings via the [data-density] overrides below.
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
  // Celebrate when a NEW payment has settled since the merchant last saw
  // the dashboard. We remember the most-recent settled txn id in
  // localStorage; if it changes on a later visit, a brand-coloured burst
  // fires once (never on the first-ever load, never for pending/failed,
  // honours prefers-reduced-motion via fireConfetti). No polling / no
  // extra API calls — purely a delightful "you got paid" welcome.
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

  // Human label for the active window (drives the VolumeHero eyebrow).
  const rangeLabel = useMemo(() => {
    const presetLabels: Record<RangeId, string> = {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
      "1y": "12 months",
    };
    if (!custom) return presetLabels[range];
    // "Jan 1 – Jan 31" when both dates share a year; include the year otherwise.
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

  const showActivation = hasAccount && hasWallet && !hasPayment && !loading;

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
    <Box
      data-testid="dash2026-root"
      data-density={density}
      sx={
        isCompact
          ? {
              // Compact density — tighten every above-the-fold card so the
              // Compact/Spacious toggle makes an OBVIOUS whole-page change.
              // px values on purpose (no theme-spacing ambiguity in nested
              // selectors); testid selectors beat each card's own sx padding
              // on specificity (root class + attribute > single class).
              "& [data-testid='dash2026-kpi-strip']": { gap: "12px" },
              "& [data-testid='dash2026-kpi-strip'] > div": {
                padding: "14px 16px",
                gap: "6px",
              },
              "& [data-testid='dash2026-quick-actions']": {
                padding: "16px",
                gap: "12px",
              },
              "& [data-testid='dash2026-fee-tier']": { padding: "16px" },
              "& [data-testid='dash2026-assets']": { padding: "16px" },
            }
          : undefined
      }
    >
      <CommandBar
        range={range}
        onRangeChange={(r) => {
          setCustom(null);
          setRange(r);
        }}
        custom={custom}
        onCustomApply={(s, e) => setCustom({ startDate: s, endDate: e })}
        onCustomClear={() => setCustom(null)}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 8fr) minmax(0, 4fr)",
          },
          gap: isCompact ? { xs: 1.25, md: 1.75, lg: 2 } : { xs: 2, md: 3, lg: 3.5 },
          alignItems: "start",
        }}
      >
        {/* MAIN */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: isCompact ? { xs: 1.25, md: 1.75 } : { xs: 2, md: 3 },
            minWidth: 0,
          }}
        >
          {showActivation ? (
            <ActivationChecklist
              accountType={accountType}
              profileComplete={profileComplete}
              hasWallet={hasWallet}
              onCreateLink={() => router.push("/create-pay-link")}
            />
          ) : (
            <>
              <VolumeHero
                stats={stats}
                chartData={chartData}
                chartSummary={chartSummary}
                loading={loading}
                chartLoading={chartLoading}
                rangeLabel={rangeLabel}
              />
              <KpiStrip stats={stats} chartData={chartData} loading={loading} />
            </>
          )}

          <RecentTransactionsWidget
            transactions={recentTransactions as any[]}
            loading={loading}
          />

          {!showActivation && (
            <AssetsCard
              assets={chartAssets}
              rangeLabel={rangeLabel}
              currencySymbol={stats?.currencySymbol}
              loading={loading || chartLoading}
            />
          )}
        </Box>

        {/* ASIDE */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: isCompact ? { xs: 1.25, md: 1.75 } : { xs: 2, md: 3 },
            minWidth: 0,
          }}
        >
          <QuickActionsDock />
          {!showActivation && <FeeTierCard />}
          <GrowSlot
            hasFeeFreeCredit={hasFeeFreeCredit}
            hasCompletedFeeFreeTrial={hasCompletedFeeFreeTrial}
            isPremiumEligible={isPremiumEligible}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard2026;
