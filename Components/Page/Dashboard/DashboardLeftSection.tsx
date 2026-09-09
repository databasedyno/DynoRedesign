import { useCompanyStore } from "@/contexts/CompanyDataContext";
import { useWalletStore } from "@/contexts/WalletDataContext";
import RoundedStackIcon from "@/assets/Icons/roundedStck-icon.svg";
import TransactionIcon from "@/assets/Icons/transaction.svg";
import ArrowUpSuccessIcon from "@/assets/Icons/up-success.svg";
import WalletIcon from "@/assets/Icons/wallet-grey.svg";
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("@/Components/UI/AreaChart"), {
  ssr: false,
  loading: () => <div style={{ height: 300 }} />,
});
import CustomButton from "@/Components/UI/Buttons";
import {
  CryptocurrencyIcon,
  IconChip,
} from "@/Components/UI/CryptocurrencySelector/styled";
import PanelCard from "@/Components/UI/PanelCard";
import TimePeriodSelector from "@/Components/UI/TimePeriodSelector";
import { formatNumberWithComma } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { useWalletData } from "@/hooks/useWalletData";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  DateRange,
  TimePeriod,
  TransactionData,
} from "@/utils/types/dashboard";
import { Add, ArrowOutward, Remove } from "@mui/icons-material";
import { Box, IconButton, Skeleton, Typography, useTheme } from "@mui/material";
import {
  eachDayOfInterval,
  endOfDay,
  isAfter,
  isValid,
  startOfDay,
} from "date-fns";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PercentageChip } from "./styled";
import ConversionBanner from "./ConversionBanner";
import TodaySummaryStrip from "./TodaySummaryStrip";
import FeeFreeWidget from "./FeeFreeWidget";
import HeroMetrics from "./HeroMetrics";
import RecentTransactionsWidget from "./RecentTransactionsWidget";
import EmptyStatePanel from "./EmptyStatePanel";
import { rootReducer } from "@/utils/types";
import { useSelector } from "react-redux";

const formatDate = (date: Date): string => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

type SelectedPeriod = TimePeriod | DateRange;

const isDateRange = (value: SelectedPeriod): value is DateRange => {
  return typeof value !== "string";
};

const normalizeDateRange = (range: DateRange): DateRange => {
  const normalizedStart =
    range.startDate && isValid(range.startDate)
      ? startOfDay(range.startDate)
      : null;
  const normalizedEnd =
    range.endDate && isValid(range.endDate) ? endOfDay(range.endDate) : null;

  if (
    normalizedStart &&
    normalizedEnd &&
    isAfter(normalizedStart, normalizedEnd)
  ) {
    return { startDate: normalizedStart, endDate: null };
  }

  return { startDate: normalizedStart, endDate: normalizedEnd };
};

const generateDateRange = (period: SelectedPeriod): Date[] => {
  const today = startOfDay(new Date());

  if (isDateRange(period)) {
    const normalized = normalizeDateRange(period);
    if (!normalized.startDate) {
      return [];
    }
    const intervalEnd = normalized.endDate
      ? startOfDay(normalized.endDate)
      : normalized.startDate;
    if (isAfter(normalized.startDate, intervalEnd)) {
      return [];
    }
    return eachDayOfInterval({
      start: normalized.startDate,
      end: intervalEnd,
    }).map((d) => startOfDay(d));
  }

  let days = 7;
  if (period === "30days") days = 30;
  else if (period === "90days") days = 90;
  else if (period === "custom") days = 7;

  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(startOfDay(date));
  }
  return dates;
};

const processTransactionData = (
  rawData: TransactionData[],
  period: SelectedPeriod,
): TransactionData[] => {
  const dateRange = generateDateRange(period);
  const safeDateRange =
    dateRange.length > 0 ? dateRange : generateDateRange("7days");
  const dateMap = new Map<string, number>();

  rawData.forEach((item) => {
    // API returns dates like "2026-02-27", convert to "Feb 27" format to match
    const parsed = new Date(item.date + "T00:00:00");
    const key = !isNaN(parsed.getTime()) ? formatDate(parsed) : item.date;
    dateMap.set(key, (dateMap.get(key) ?? 0) + item.value);
  });

  const result = safeDateRange.map((date) => {
    const dateStr = formatDate(date);
    return {
      date: dateStr,
      value: dateMap.get(dateStr) ?? 0,
    };
  });

  return result;
};

const TransactionVolumeChart = ({
  selectedPeriod,
  apiChartData,
}: {
  selectedPeriod: SelectedPeriod;
  apiChartData: Array<{ date: string; value: number }>;
}) => {
  const isMobile = useIsMobile("md");

  // Honest data only — NEVER fabricate volume on a money dashboard. When the
  // merchant has no transactions in the selected period, processTransactionData
  // zero-fills the date range so the chart shows a truthful flat baseline
  // instead of plausible-looking fake numbers (prior code rendered a hardcoded
  // ~$8k–$15k sample series whenever apiChartData was empty — a trust risk).
  const transactionData = useMemo(
    () => processTransactionData(apiChartData, selectedPeriod),
    [apiChartData, selectedPeriod],
  );

  return (
    <Box
      sx={{
        width: "100%",
        mt: isMobile ? "14px" : "12px",
        overflow: "visible",
      }}
    >
      <Chart data={transactionData} />
    </Box>
  );
};

const ActiveWalletsCard = memo(
  ({
    title,
    icon,
    isMobile,
  }: {
    title: string;
    icon: any;
    isMobile: boolean;
  }) => {
    const theme = useTheme();
    return (
      <IconChip
        sx={{
          padding: "6px 8px !important",
          minWidth: "fit-content",
          height: "30px",
          alignItems: "center",
          flexShrink: 0,
          "& img": {
            userSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
            WebkitTouchCallout: "none",
          },
        }}
      >
        <CryptocurrencyIcon
          src={icon}
          alt={title}
          width={18}
          height={18}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: "none", pointerEvents: "none" }}
        />
        <span
          style={{
            fontSize: isMobile ? "11px" : "13px",
            fontWeight: 500,
            color: theme.palette.text.secondary,
            flexShrink: 0,
          }}
        >
          {title}
        </span>
      </IconChip>
    );
  },
);

ActiveWalletsCard.displayName = "ActiveWalletsCard";

const DashboardLeftSection = () => {
  const theme = useTheme();
  const namespaces = ["dashboardLayout", "common"];
  const isMobile = useIsMobile("md");
  const router = useRouter();
  const [showAllWallets, setShowAllWallets] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const statCardsContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const statCardsDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const statCardsStartXRef = useRef(0);
  const statCardsScrollLeftRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isStatCardsDragging, setIsStatCardsDragging] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("7days");
  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    startDate: null,
    endDate: null,
  });

  const { t } = useTranslation(namespaces);
  const tDashboard = useCallback(
    (key: string, options?: any): string =>
      t(key, { ns: "dashboardLayout", ...options }) as unknown as string,
    [t],
  );

  const { activeWalletsData } = useWalletData();
  // UX-2026-07-08: allow user to compact the Active Wallets card so the hero
  // row can stay clean. Now driven by the global dashboard-density hook so
  // toggling density in any widget (Recent Transactions header, Fee Tier
  // header, etc.) flips this card too. Migrates the old local flag on mount.
  const { isCompact: walletCardCompact, toggleDensity: toggleWalletCardCompact } =
    useDashboardDensity();
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // One-time migration: preserve merchants who had already opted into
      // the compact wallet layout via the old per-card localStorage key.
      const legacy = window.localStorage.getItem("dash_wallets_compact");
      const modern = window.localStorage.getItem("dashboard_density_mode");
      if (legacy === "1" && !modern) {
        window.localStorage.setItem("dashboard_density_mode", "compact");
        window.dispatchEvent(
          new CustomEvent("dynopay:dashboard-density-change", {
            detail: { value: "compact" },
          }),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);
  const { stats, chartData, loading, fetchChartData, recentTransactions } = useDashboardData();

  // Selectors for empty-state decision (company + wallet setup + payment history).
  const companyState = useCompanyStore();
  const walletState = useWalletStore();
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  // AUTHORITATIVE: use aggregate stats from the backend as the source of truth
  // for whether the merchant has EVER received a payment. Previously we only
  // scanned the latest 5 `recentTransactions` — if none of those happened to
  // carry a confirmed/settled/paid status (e.g. all pending or refunded, or
  // the merchant's most recent activity was old and the widget was empty),
  // established merchants with $18k+ lifetime volume were wrongly shown the
  // "waiting for your first payment" empty state.
  //
  // Fix: aggregate stats.totalTransactions / stats.totalVolume are the
  // authoritative signal. Fall back to the recent-list scan only when the
  // aggregate is unavailable (older API responses).
  const hasAggregatePayments = useMemo(() => {
    const totalTx = Number(stats?.totalTransactions ?? 0);
    const totalVol = Number(stats?.totalVolume ?? 0);
    return totalTx > 0 || totalVol > 0;
  }, [stats?.totalTransactions, stats?.totalVolume]);
  const hasAnyConfirmedTxn = useMemo(() => {
    // Primary signal: aggregate stats say there's been at least one payment.
    if (hasAggregatePayments) return true;
    // Fallback: scan the recent transactions list for any settled state.
    // Note: backend actually persists "successful" (not "success") — include both.
    const list = (recentTransactions as any[]) || [];
    return list.some((tx) => {
      const status = String(tx?.status || "").toLowerCase();
      return ["confirmed", "completed", "settled", "success", "successful", "paid"].includes(status);
    });
  }, [hasAggregatePayments, recentTransactions]);
  // Show the guiding empty-state instead of an empty Hero whenever the merchant
  // hasn't received a real payment yet — INCLUDING brand-new accounts that
  // haven't added a wallet (EmptyStatePanel renders the "finish setup" branch in
  // that case). Previously this required hasWallet, so a fresh account fell
  // through to a blank HeroMetrics with no zero-state or guidance (bug #10).
  const showEmptyState = hasCompany && !hasAnyConfirmedTxn && !loading;

  // Fetch chart data when period changes
  useEffect(() => {
    if (selectedPeriod === "custom") {
      if (customDateRange.startDate && customDateRange.endDate) {
        fetchChartData(
          "custom",
          customDateRange.startDate.toISOString(),
          customDateRange.endDate.toISOString()
        );
      }
    } else {
      const periodMap: Record<string, string> = {
        "7days": "7d",
        "30days": "30d",
        "90days": "90d",
      };
      fetchChartData(periodMap[selectedPeriod] || "7d");
    }
  }, [selectedPeriod, customDateRange, fetchChartData]);

  const totalTransactions = stats.totalTransactions || 0;
  const totalVolume = stats.totalVolume || 0;
  const totalVolumeFormatted = stats.totalVolumeFormatted || "$0.00 USD";
  const transactionChange = stats.transactionChange || 0;
  const volumeChange = stats.volumeChange || 0;

  const maxWalletsToShow = 3;
  const walletsToDisplay = showAllWallets
    ? activeWalletsData
    : activeWalletsData.slice(0, maxWalletsToShow);
  const hasMoreWallets = activeWalletsData.length > maxWalletsToShow;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isStatCardsDragging) return;
      if (!showAllWallets || !scrollContainerRef.current) return;
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      setIsDragging(true);
      startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
      scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    },
    [showAllWallets, isStatCardsDragging],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        !isDraggingRef.current ||
        !scrollContainerRef.current ||
        !showAllWallets
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startXRef.current) * 2;
      scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
    },
    [showAllWallets],
  );

  const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      e.stopPropagation();
    }
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(
    (e?: React.MouseEvent<HTMLDivElement>) => {
      if (e) {
        e.stopPropagation();
      }
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    [],
  );

  const handleStatCardsMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!statCardsContainerRef.current) return;
      if (
        (e.target as HTMLElement).closest("button") ||
        (e.target as HTMLElement).closest("a")
      )
        return;
      if (
        scrollContainerRef.current &&
        scrollContainerRef.current.contains(e.target as Node)
      )
        return;
      e.preventDefault();
      statCardsDraggingRef.current = true;
      setIsStatCardsDragging(true);
      statCardsStartXRef.current =
        e.pageX - statCardsContainerRef.current.offsetLeft;
      statCardsScrollLeftRef.current = statCardsContainerRef.current.scrollLeft;
    },
    [],
  );

  const handleStatCardsMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!statCardsDraggingRef.current || !statCardsContainerRef.current)
        return;
      if (isDraggingRef.current) return;
      if (
        scrollContainerRef.current &&
        scrollContainerRef.current.contains(e.target as Node)
      )
        return;
      e.preventDefault();
      const x = e.pageX - statCardsContainerRef.current.offsetLeft;
      const walk = (x - statCardsStartXRef.current) * 2;
      statCardsContainerRef.current.scrollLeft =
        statCardsScrollLeftRef.current - walk;
    },
    [],
  );

  const handleStatCardsMouseUp = useCallback(() => {
    statCardsDraggingRef.current = false;
    setIsStatCardsDragging(false);
  }, []);

  const handleStatCardsMouseLeave = useCallback(() => {
    statCardsDraggingRef.current = false;
    setIsStatCardsDragging(false);
  }, []);

  return (
    <Box>
      {/* Top of dashboard: empty-state for zero-payment merchants, else HeroMetrics.
          The old TodaySummaryStrip + FeeFreeWidget + "Welcome to Dynopay" banner
          were all fighting for the top-of-fold real estate. Consolidated here:
          - No confirmed payment yet → EmptyStatePanel (single clear next action)
          - Any confirmed payment → HeroMetrics (3 glanceable tiles) */}
      {showEmptyState ? (
        <EmptyStatePanel
          hasCompany={hasCompany}
          hasWallet={hasWallet}
          onCreateLink={() => router.push("/create-pay-link")}
        />
      ) : (
        <HeroMetrics
          loading={loading}
          currencySymbol={stats.currencySymbol}
          currency={stats.currency}
          volumeTodayFormatted={stats.todaySummary?.volumeTodayFormatted}
          volumeTodayChangePercent={stats.todaySummary?.volumeChangePercent}
          totalVolumeFormatted={totalVolumeFormatted}
          volumeChangePercent={volumeChange}
          transactionsToday={stats.todaySummary?.transactionsToday}
          transactionsChangePercent={stats.todaySummary?.transactionsChangePercent}
          activeWallets={stats.activeWallets}
          sparkData={chartData}
        />
      )}

      {!showEmptyState && Number(stats.taxCollected) > 0 && (
        <Box
          data-testid="dashboard-tax-collected"
          sx={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 1,
            mt: 1.5,
            px: 1.75,
            py: 1,
            borderRadius: "10px",
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontFamily: "var(--font-sans)" }}>
            {tDashboard("taxCollectedAllTime", { defaultValue: "Tax collected (all-time)" })}
          </Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary", fontFamily: "var(--font-sans)" }}>
            {stats.taxCollectedFormatted || String(stats.taxCollected)}
          </Typography>
        </Box>
      )}

      {/* Recent transactions — trust/retention signal. Renders empty-state
          copy internally when the list is empty. */}
      <RecentTransactionsWidget
        transactions={recentTransactions as any[]}
        loading={loading}
      />

      {/* Stat Cards */}
      <Box
        ref={statCardsContainerRef}
        onMouseDown={handleStatCardsMouseDown}
        onMouseMove={handleStatCardsMouseMove}
        onMouseUp={handleStatCardsMouseUp}
        onMouseLeave={handleStatCardsMouseLeave}
        sx={{
          mb: 2.5,
          px: { xs: "16px", md: "0px" },
          display: "flex",
          gap: isMobile ? "8px" : "20px",
          overflowX: "auto",
          overflowY: "hidden",
          cursor: isStatCardsDragging ? "grabbing" : "grab",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          willChange: isStatCardsDragging ? "scroll-position" : "auto",
          "& img": {
            userSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            KhtmlUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
            backfaceVisibility: "hidden",
            transform: "translateZ(0)",
          },
          "& *": {
            userSelect: "none",
            WebkitUserDrag: "none",
          },
          "& button": {
            pointerEvents: "auto",
          },
          "&::-webkit-scrollbar": {
            height: "0px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "transparent",
          },
        }}
      >
        {/* Active Wallets */}
        <PanelCard
          title={tDashboard("activeWallets")}
          showHeaderBorder={false}
          headerPadding={
            isMobile
              ? theme.spacing(2, 2, 0, 2)
              : theme.spacing(2.5, 2.5, 0, 2.5)
          }
          bodyPadding={
            isMobile
              ? theme.spacing(1.5, 2, walletCardCompact ? 1 : 2, 2)
              : theme.spacing(2, 2, walletCardCompact ? 1 : 2.5, 2.5)
          }
          sx={{
            width: { xs: "200px", sm: "240px", md: "289px", xl: "315px" },
            minHeight: walletCardCompact
              ? { xs: "88px", sm: "96px", md: "108px" }
              : { xs: "128px", sm: "140px", md: "176px" },
            flexShrink: 0,
            transition: "min-height 200ms ease",
          }}
          headerAction={
            <IconButton
              onClick={toggleWalletCardCompact}
              data-testid="wallets-compact-toggle"
              aria-label={
                walletCardCompact
                  ? tDashboard("expandWallets", { defaultValue: "Show wallets" })
                  : tDashboard("compactWallets", { defaultValue: "Compact view" })
              }
              sx={{
                padding: "8px",
                // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
                width: isMobile ? "44px" : "40px",
                height: isMobile ? "44px" : "40px",
                "&:hover": { backgroundColor: theme.palette.action.hover },
              }}
            >
              <Image
                src={WalletIcon}
                alt="Wallet Icon"
                style={{
                  width: "clamp(12px, 2vw, 17px)",
                  height: "auto",
                  opacity: walletCardCompact ? 0.5 : 1,
                }}
                draggable={false}
              />
            </IconButton>
          }
        >
          <Typography
            sx={{
              fontSize: isMobile ? "20px" : "40px",
              color: theme.palette.text.primary,
              fontFamily: "var(--font-sans)",
              lineHeight: "100%",
              fontWeight: 500,
              letterSpacing: 0,
            }}
          >
            {activeWalletsData.length}
          </Typography>

          <Box
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            sx={{
              display: walletCardCompact ? "none" : "flex",
              justifyContent: "start",
              alignItems: "center",
              gap: isMobile ? "6px" : "8px",
              mt: { xs: "18px", sm: 3, md: 2.5 },
              overflowX: "auto",
              overflowY: "hidden",
              flexWrap: "nowrap",
              cursor: showAllWallets
                ? isDragging
                  ? "grabbing"
                  : "grab"
                : "default",
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none",
              willChange: isDragging ? "scroll-position" : "auto",
              "& img": {
                userSelect: "none",
                WebkitUserDrag: "none",
                pointerEvents: "none",
                WebkitTouchCallout: "none",
                WebkitUserSelect: "none",
                KhtmlUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none",
                backfaceVisibility: "hidden",
                transform: "translateZ(0)",
              },
              "& *": {
                userSelect: "none",
                WebkitUserDrag: "none",
              },
              "& button": {
                pointerEvents: "auto",
              },
              "&::-webkit-scrollbar": {
                height: "0px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "transparent",
              },
            }}
          >
            {walletsToDisplay.map((wallet) => (
              <ActiveWalletsCard
                key={wallet.code}
                title={wallet.code}
                icon={wallet.icon}
                isMobile={isMobile}
              />
            ))}
            {hasMoreWallets && !showAllWallets && (
              <IconButton
                onClick={() => setShowAllWallets(true)}
                aria-label={tDashboard("showAllWallets", { defaultValue: "Show all wallets" })}
                sx={{
                  // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
                  width: { xs: "44px", md: "30px" },
                  height: { xs: "44px", md: "30px" },
                  borderRadius: "999px",
                  background: theme.palette.secondary.light,
                  border: `1px solid ${theme.palette.border.main}`,
                  padding: 0,
                  minWidth: { xs: "44px", md: "30px" },
                  flexShrink: 0,
                  "&:hover": {
                    background: theme.palette.secondary.dark,
                  },
                }}
              >
                <Add
                  sx={{
                    fontSize: "20px",
                    color: theme.palette.text.secondary,
                  }}
                />
              </IconButton>
            )}
            {showAllWallets && (
              <IconButton
                onClick={() => setShowAllWallets(false)}
                aria-label={tDashboard("hideAllWallets", { defaultValue: "Show fewer wallets" })}
                sx={{
                  // Session 74 P1: 44×44 tap target on mobile (WCAG 2.5.5).
                  width: { xs: "44px", md: "30px" },
                  height: { xs: "44px", md: "30px" },
                  borderRadius: "999px",
                  background: theme.palette.secondary.light,
                  border: `1px solid ${theme.palette.border.main}`,
                  padding: 0,
                  minWidth: { xs: "44px", md: "30px" },
                  flexShrink: 0,
                  "&:hover": {
                    background: theme.palette.secondary.dark,
                  },
                }}
              >
                <Remove
                  sx={{
                    fontSize: "20px",
                    color: theme.palette.text.secondary,
                  }}
                />
              </IconButton>
            )}
          </Box>
        </PanelCard>
      </Box>

      {/* Auto-Convert banner removed — the promo now lives inside the
          consolidated GrowPanel on the right side to reduce upsell noise. */}

      {/* Transaction Volume Graph — moved below the fold. Merchants first
          see Hero + Recent Txns above; the chart is for drill-down. */}
      <Box sx={{ px: { xs: "16px", md: "0px" } }}>
        <PanelCard
          showHeaderBorder={false}
          headerPadding={theme.spacing(2.5)}
          bodyPadding={
            isMobile ? theme.spacing(2, 0, 2, 2) : theme.spacing(2.5, 2, 2.5, 2)
          }
          headerActionLayout="inline"
          sx={{ mb: 2.5, boxShadow: "none !important", overflow: "visible" }}
        >
          <Box
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: { xs: "flex-start", sm: "space-between" },
              alignItems: { xs: "flex-start", md: "center" },
              gap: { xs: "12px", md: 0 },
            }}
          >
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: "6.41px" }}
            >
              <Typography
                sx={{
                  fontSize: isMobile ? "15px" : "20px",
                  color: theme.palette.text.primary,
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.2,
                }}
              >
                {tDashboard("transactionVolume")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.2,
                }}
              >
                {tDashboard("dailyTransactionActivity")}
              </Typography>
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: selectedPeriod === "custom" ? "6px" : "12px",
                alignItems: "center",
                width: { xs: "100%", sm: "auto" },
                p: { xs: "0px 16px 0px 0px", md: "0px" },
              }}
            >
              <TimePeriodSelector
                value={selectedPeriod}
                onChange={(period) => setSelectedPeriod(period)}
                dateRange={customDateRange}
                onDateRangeChange={setCustomDateRange}
                sx={{ flexShrink: 0 }}
              />
              <Box>
                <CustomButton
                  label={t("viewTransactions")}
                  variant="secondary"
                  size={isMobile ? "small" : "medium"}
                  endIcon={
                    <ArrowOutward sx={{ fontSize: isMobile ? 14 : 16 }} />
                  }
                  sx={{ flexShrink: 0, padding: "8px 12px !important" }}
                  onClick={() => router.push("/transactions")}
                />
              </Box>
            </Box>
          </Box>
          <TransactionVolumeChart
            selectedPeriod={
              selectedPeriod === "custom" ? customDateRange : selectedPeriod
            }
            apiChartData={chartData}
          />
        </PanelCard>
      </Box>
    </Box>
  );
};

export default DashboardLeftSection;
