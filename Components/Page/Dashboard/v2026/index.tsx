import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { useCompanyStore } from "@/contexts/CompanyDataContext";
import useIsMobile from "@/hooks/useIsMobile";
import RecentTransactionsWidget from "../RecentTransactionsWidget";
import GettingStartedHero from "@/Components/Page/GetStarted/GettingStartedHero";
import DashboardPreview from "@/Components/Page/GetStarted/DashboardPreview";
import { useSetupProgress } from "@/Components/Page/GetStarted/useSetupProgress";
import { CustomRange, RangeId } from "./ranges";
import RangeBar from "./command/RangeBar";
import AttentionFeed from "./command/AttentionFeed";
import MoneyRow from "./command/MoneyRow";
import TopSourcesCard from "./command/TopSourcesCard";
import PlanRow from "./command/PlanRow";
import { useDashboardOverview } from "./command/useDashboardOverview";
import { useAttentionItems } from "./command/useAttentionItems";

const ChartSkeleton = ({ h }: { h: number }) => (
  <Box aria-hidden sx={{ height: h, width: "100%", borderRadius: 3, backgroundColor: "action.hover", opacity: 0.4 }} />
);
// recharts is heavy — load the trend card as its own async chunk.
const TrendCard = dynamic(() => import("./command/TrendCard"), { ssr: false, loading: () => <ChartSkeleton h={420} /> });
const FirstPaymentCelebrationModal = dynamic(() => import("@/Components/Modals/FirstPaymentCelebrationModal"), { ssr: false });

const SETTLED = ["confirmed", "completed", "settled", "success", "successful", "paid"];

/**
 * Dashboard2026 — the merchant command centre.
 * Zones: 1 pulse + range → 2 needs attention → 3 money now → 4 trend + checkout
 * health → 5 recent payments + top links/products → 6 plan & fees (collapsed).
 * Until the first payment lands the Getting-started checklist owns the page and
 * zones 3–5 render as a faded preview.
 */
const Dashboard2026: React.FC<{ onboarding?: boolean }> = ({ onboarding = true }) => {
  const { t } = useTranslation("dashboardLayout");
  const router = useRouter();
  const isPhone = useIsMobile("md");
  const { density, isCompact } = useDashboardDensity();
  const [range, setRange] = useState<RangeId>("30d");
  const [custom, setCustom] = useState<CustomRange>(null);
  const rangeTouched = useRef(false);
  const { stats, chartData, chartAssets, recentTransactions, loading, chartLoading, fetchChartData } = useDashboardData();
  const overviewQuery = useDashboardOverview({ range, custom });
  const overview = overviewQuery.data;
  const overviewLoading = overviewQuery.isLoading && !overview;

  // Phones default to the 7-day window; the merchant's own choice always wins.
  useEffect(() => {
    if (!rangeTouched.current && typeof window !== "undefined" && window.innerWidth < 900) setRange("7d");
  }, []);

  useEffect(() => {
    if (custom) fetchChartData("custom", custom.startDate, custom.endDate);
    else fetchChartData(range);
  }, [range, custom, fetchChartData]);

  // ── Confetti when a NEW payment settled since the last visit ──────────────
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (confettiFiredRef.current) return;
    const list = (recentTransactions as any[]) || [];
    const topSettled = list.find((tx) => SETTLED.includes(String(tx?.status || "").toLowerCase()));
    if (!topSettled) return;
    const id = String(topSettled.id ?? topSettled.transaction_id ?? topSettled.reference ?? topSettled.createdAt ?? "");
    if (!id) return;
    let last: string | null = null;
    try {
      last = window.localStorage.getItem("dyno_last_settled_txn");
    } catch {
      /* storage unavailable */
    }
    if (last && last !== id) {
      confettiFiredRef.current = true;
      void import("@/helpers/fireConfetti").then((m) => m.default()).catch(() => {});
    }
    try {
      window.localStorage.setItem("dyno_last_settled_txn", id);
    } catch {
      /* ignore */
    }
  }, [recentTransactions]);

  // ── One-time first-payment celebration (per brand) ────────────────────────
  const { selectedCompanyId, companyList } = useCompanyStore();
  const [firstPaymentModalOpen, setFirstPaymentModalOpen] = useState(false);
  const selectedCompanyName = useMemo(() => {
    const c = (companyList as any[])?.find((x) => Number(x?.company_id) === Number(selectedCompanyId));
    return (c?.company_name as string) || null;
  }, [companyList, selectedCompanyId]);
  useEffect(() => {
    if (loading || !stats || Number(stats?.totalTransactions ?? 0) !== 1 || selectedCompanyId == null) return;
    const key = `dyno_fp_celebrated:${selectedCompanyId}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      return;
    }
    setFirstPaymentModalOpen(true);
  }, [loading, stats, selectedCompanyId]);

  const rangeLabel = useMemo(() => {
    const presets: Record<RangeId, string> = {
      today: t("rangeToday", { defaultValue: "Today" }),
      "7d": t("rangeDays7", { defaultValue: "7 days" }),
      "30d": t("rangeDays30", { defaultValue: "30 days" }),
      "90d": t("rangeDays90", { defaultValue: "90 days" }),
      "1y": t("rangeMonths12", { defaultValue: "12 months" }),
    };
    if (!custom) return presets[range];
    const sameYear = custom.startDate.slice(0, 4) === custom.endDate.slice(0, 4);
    const fmt = (iso: string) => {
      try {
        return format(new Date(`${iso}T00:00:00`), sameYear ? "MMM d" : "MMM d, yyyy");
      } catch {
        return iso;
      }
    };
    return `${fmt(custom.startDate)} – ${fmt(custom.endDate)}`;
  }, [range, custom, t]);

  const setupProgress = useSetupProgress();
  const hasPayment = useMemo(() => {
    if (Number(stats?.totalTransactions ?? 0) > 0 || Number(stats?.totalVolume ?? 0) > 0) return true;
    return ((recentTransactions as any[]) || []).some((tx) => SETTLED.includes(String(tx?.status || "").toLowerCase()));
  }, [stats?.totalTransactions, stats?.totalVolume, recentTransactions]);
  const showGettingStarted = onboarding && !loading && !!stats && setupProgress.coreReady && !hasPayment;

  const { items: attentionItems, dismiss } = useAttentionItems({ overview, onboarding });

  const stackGap = isCompact ? { xs: 1.25, md: 2 } : { xs: 2, md: 3 };
  const riseSx = {
    "@keyframes dashRise": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "none" } },
    "& > div > *": { animation: "dashRise 240ms cubic-bezier(0.2, 0.7, 0.2, 1) both" },
    "& > div > *:nth-of-type(2)": { animationDelay: "40ms" },
    "& > div > *:nth-of-type(3)": { animationDelay: "80ms" },
    "& > div > *:nth-of-type(4)": { animationDelay: "120ms" },
    "& > div > *:nth-of-type(5)": { animationDelay: "160ms" },
    "& > div > *:nth-of-type(6)": { animationDelay: "200ms" },
    "@media (prefers-reduced-motion: reduce)": { "& > div > *": { animation: "none" } },
  } as const;

  const trend = (
    <TrendCard
      chartData={chartData}
      chartAssets={chartAssets}
      loading={loading || chartLoading}
      currencySymbol={overview?.currency_symbol || stats?.currencySymbol || "$"}
      currency={overview?.currency || stats?.currency || "USD"}
      rangeLabel={rangeLabel}
      health={overview?.health}
      healthLoading={overviewLoading}
    />
  );
  const txRange = custom ? undefined : range === "1y" ? "all" : range;
  const moneyRow = <MoneyRow overview={overview} loading={overviewLoading} rangeLabel={rangeLabel} txRange={txRange} />;

  return (
    <Box data-testid="dash2026-root" data-density={density} sx={riseSx}>
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
        <Box data-testid="new-merchant-getting-started" sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          <GettingStartedHero progress={setupProgress} />
          <AttentionFeed items={attentionItems.filter((i) => i.group === "security")} onDismiss={dismiss} />
          <Box data-testid="new-merchant-faded-preview">
            <DashboardPreview>
              {moneyRow}
              {trend}
            </DashboardPreview>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: stackGap }}>
          <RangeBar
            pulse={overview?.pulse}
            pulseLoading={overviewLoading}
            range={range}
            custom={custom}
            onRangeChange={(r) => {
              rangeTouched.current = true;
              setCustom(null);
              setRange(r);
            }}
            onCustomApply={(s, e) => {
              rangeTouched.current = true;
              setCustom({ startDate: s, endDate: e });
            }}
            onCustomClear={() => setCustom(null)}
          />
          <AttentionFeed items={attentionItems} onDismiss={dismiss} />
          {moneyRow}
          {trend}
          <Box
            data-testid="dash2026-activity"
            sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 7fr) minmax(0, 5fr)" }, gap: stackGap, alignItems: "start" }}
          >
            <Box sx={{ minWidth: 0 }} data-testid="recent-payments-list">
              <RecentTransactionsWidget transactions={recentTransactions as any[]} loading={loading} max={isPhone ? 5 : 8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <TopSourcesCard
                sources={overview?.top_sources ?? []}
                loading={overviewLoading}
                currencySymbol={overview?.currency_symbol || stats?.currencySymbol || "$"}
                currency={overview?.currency || stats?.currency || "USD"}
                rangeLabel={rangeLabel}
              />
            </Box>
          </Box>
          <PlanRow />
        </Box>
      )}
    </Box>
  );
};

export default Dashboard2026;
