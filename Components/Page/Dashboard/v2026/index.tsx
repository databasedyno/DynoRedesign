import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { rootReducer } from "@/utils/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { RangeId } from "./CommandBar";
import BalanceStrip from "./BalanceStrip";
import ActionsRow from "./ActionsRow";
import GatewayHealthStrip from "./GatewayHealthStrip";
import FeeTierCard from "./FeeTierCard";
import AssetsCard from "./AssetsCard";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import GrowSlot from "./GrowSlot";
import ReferralCodeCard from "../ReferralCodeCard";
import ConversionBanner from "../ConversionBanner";
import PasswordNudge from "../PasswordNudge";
import UnderpaidActionBanner from "../UnderpaidActionBanner";
import GettingStartedHero from "@/Components/Page/GetStarted/GettingStartedHero";
import DashboardPreview from "@/Components/Page/GetStarted/DashboardPreview";
import { useSetupProgress } from "@/Components/Page/GetStarted/useSetupProgress";

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

// One-time first-payment celebration (per brand). ssr:false + lazy so it never
// touches the dashboard's initial bundle.
const FirstPaymentCelebrationModal = dynamic(
  () => import("@/Components/Modals/FirstPaymentCelebrationModal"),
  { ssr: false },
);


/**
 * Dashboard2026 — the merchant command center (P4 "Quiet Money" re-layout).
 *
 * Vertical rhythm (design_guidelines 2026-06 · overview_layout):
 *   Row 1  BalanceStrip  — range control · big mono volume + delta + metric
 *   Row 2  ActionsRow    — 4 quick shortcut cards
 *   Row 3  GatewayHealthStrip · ConversionBanner (operations)
 *   Row 4  VolumeChart (8) + rail (4): FeeTierCard · GrowSlot · ReferralCodeCard
 *   Row 5  KpiStrip      — 3 KPIs with sparklines
 *   Row 6  Recent activity (8) + AssetsCard (4)
 *
 * Until the FIRST payment lands, the page is the new-merchant experience
 * (plan 1.19): a Getting-started hero (progress ring + the 4 setup steps,
 * resuming the /get-started wizard) above a faded, non-interactive preview
 * of rows 1–3. Team members never see onboarding (`onboarding={false}`).
 *
 * A single fetchChartData(range) call feeds both the chart and the KPI-strip
 * sparkline (shared redux chartData).
 */
const Dashboard2026: React.FC<{ onboarding?: boolean }> = ({ onboarding = true }) => {
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

  // ── First-payment celebration ─────────────────────────────────────
  // The confetti-on-settlement above intentionally skips the first-ever load
  // (it needs a PREVIOUS stored txn id to compare), so the single biggest
  // milestone — a brand's very first payment — was silent. Fire a one-time,
  // per-brand celebration modal the moment this brand's lifetime processed
  // payment count is exactly 1. `totalTransactions` is the LIFETIME count
  // (dashboardController: COUNT(*) with no date filter), so this never
  // false-fires for established merchants.
  const router = useRouter();
  const { selectedCompanyId, companyList } = useCompanyStore();
  const [firstPaymentModalOpen, setFirstPaymentModalOpen] = useState(false);

  const selectedCompanyName = useMemo(() => {
    const c = (companyList as any[])?.find(
      (x) => Number(x?.company_id) === Number(selectedCompanyId),
    );
    return (c?.company_name as string) || null;
  }, [companyList, selectedCompanyId]);

  useEffect(() => {
    if (loading || !stats) return;
    if (Number(stats?.totalTransactions ?? 0) !== 1) return; // only the FIRST payment
    if (selectedCompanyId == null) return; // need a brand to key the "once" flag
    const key = `dyno_fp_celebrated:${selectedCompanyId}`;
    try {
      if (window.localStorage.getItem(key)) return; // already celebrated for this brand
      // Mark BEFORE opening so "once" survives reloads even if never dismissed.
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      return; // storage unavailable — skip (harmless)
    }
    setFirstPaymentModalOpen(true);
  }, [loading, stats, selectedCompanyId]);

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

  const userProfile = useSelector(
    (s: rootReducer) => (s as any).userReducer?.profile,
  );
  const setupProgress = useSetupProgress();

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

  // New-merchant experience (plan 1.19): until the first payment lands, the
  // Getting-started hero owns the page and the real widgets sit beneath it as
  // a faded preview. Requires real stats so established merchants never see it.
  const showGettingStarted =
    onboarding && !loading && !!stats && setupProgress.coreReady && !hasPayment;

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

  const stackGap = isCompact ? { xs: 1.25, md: 2 } : { xs: 2, md: 3 };

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
    "& > div > *:nth-of-type(5)": { animationDelay: "200ms" },
    "& > div > *:nth-of-type(6)": { animationDelay: "250ms" },
    "@media (prefers-reduced-motion: reduce)": {
      "& > div > *": { animation: "none" },
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
      <FirstPaymentCelebrationModal
        open={firstPaymentModalOpen}
        onClose={() => setFirstPaymentModalOpen(false)}
        onViewTransactions={() => {
          setFirstPaymentModalOpen(false);
          router.push("/transactions");
        }}
        companyName={selectedCompanyName}
        amountLabel={stats?.totalVolumeFormatted || null}
      />
      {showGettingStarted ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          <GettingStartedHero progress={setupProgress} />
          <ActionsRow />
          <PasswordNudge />
          <GatewayHealthStrip />
          <DashboardPreview>
            <BalanceStrip
              stats={stats}
              chartData={chartData}
              chartSummary={chartSummary}
              loading={loading}
              chartLoading={chartLoading}
              rangeLabel={rangeLabel}
              range={range}
              onRangeChange={() => {}}
              custom={null}
              onCustomApply={() => {}}
              onCustomClear={() => {}}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 8fr) minmax(0, 4fr)" },
                gap: stackGap,
                alignItems: "start",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <VolumeChart
                  chartData={chartData}
                  loading={loading}
                  chartLoading={chartLoading}
                  currencySymbol={stats?.currencySymbol}
                  rangeLabel={rangeLabel}
                />
              </Box>
              <Box sx={{ display: { xs: "none", lg: "block" }, minWidth: 0 }}>
                <FeeTierCard />
              </Box>
            </Box>
            <KpiStrip stats={stats} chartData={chartData} loading={loading} />
          </DashboardPreview>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          {/* A5 — one-time "set a password" nudge for OTP-only accounts (dismissible). */}
          <PasswordNudge />

          {/* Slim amber banner — underpaid payments needing follow-up (only when > 0). */}
          <UnderpaidActionBanner count={stats?.todaySummary?.underpaidCount} />

          {/* ── Overview rhythm (design_guidelines 2026-06 · overview_layout) ──
              greeting (page header) → balance strip → 4 quick actions →
              gateway health → auto-convert → analytics (chart 8 · rail 4:
              fee tier · grow · referral) → KPI strip → activity 8 · assets 4.
              On phones the DOM order is the reading order. */}
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
          <ActionsRow />

          {/* ── Operations: live gateway health + auto-convert ── */}
          <GatewayHealthStrip />
          <ConversionBanner />

          {/* ── Analytics · chart (8) + rail (4): fee tier · grow · referral ── */}
          <Box
            data-testid="dash2026-fold-1"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 8fr) minmax(0, 4fr)" },
              gap: stackGap,
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <VolumeChart
                chartData={chartData}
                loading={loading}
                chartLoading={chartLoading}
                currencySymbol={stats?.currencySymbol}
                rangeLabel={rangeLabel}
              />
            </Box>
            <Box
              data-testid="dash2026-rail"
              sx={{
                minWidth: 0,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "1fr" },
                gap: stackGap,
                alignContent: "start",
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

          {/* ── KPIs (3 tiles with sparklines, full width) ── */}
          <KpiStrip stats={stats} chartData={chartData} loading={loading} />

          {/* ── Activity (8) + assets (4) ── */}
          <Box
            data-testid="dash2026-fold-4"
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 8fr) minmax(0, 4fr)" },
              gap: stackGap,
              alignItems: "start",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <RecentTransactionsWidget
                transactions={recentTransactions as any[]}
                loading={loading}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
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
