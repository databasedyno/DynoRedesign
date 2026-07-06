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

  const rawTransactionData = useMemo(
    () =>
      apiChartData.length > 0
        ? apiChartData
        : [
            { date: "Feb 5", value: 8000 },
            { date: "Feb 6", value: 12000 },
            { date: "Feb 7", value: 10000 },
            { date: "Feb 8", value: 15600 },
            { date: "Feb 9", value: 11000 },
            { date: "Feb 10", value: 13500 },
            { date: "Feb 11", value: 15000 },
          ],
    [apiChartData],
  );

  const transactionData = useMemo(
    () => processTransactionData(rawTransactionData, selectedPeriod),
    [rawTransactionData, selectedPeriod],
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
    (key: string) => t(key, { ns: "dashboardLayout" }),
    [t],
  );

  const { activeWalletsData } = useWalletData();
  const { stats, chartData, loading, fetchChartData, recentTransactions } = useDashboardData();

  // Selectors for empty-state decision (company + wallet setup + payment history).
  const companyState = useSelector((s: rootReducer) => s.companyReducer);
  const walletState = useSelector((s: rootReducer) => s.walletReducer);
  const hasCompany = (companyState.companyList?.length ?? 0) > 0;
  const hasWallet = (walletState.walletList?.length ?? 0) > 0;
  const hasAnyConfirmedTxn = useMemo(() => {
    const list = (recentTransactions as any[]) || [];
    return list.some((tx) => {
      const status = String(tx?.status || "").toLowerCase();
      return ["confirmed", "completed", "settled", "success", "paid"].includes(status);
    });
  }, [recentTransactions]);
  // Show empty state instead of Hero when merchant has set up but hasn't
  // received any real payment yet. Turns the top-of-dashboard into a guide.
  const showEmptyState = hasCompany && hasWallet && !hasAnyConfirmedTxn && !loading;

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
        />
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
              ? theme.spacing(1.5, 2, 2, 2)
              : theme.spacing(2, 2, 2.5, 2.5)
          }
          sx={{
            width: { xs: "200px", sm: "240px", md: "289px", xl: "315px" },
            minHeight: { xs: "128px", sm: "140px", md: "176px" },
            flexShrink: 0,
          }}
          headerAction={
            <IconButton
              sx={{
                padding: "8px",
                width: isMobile ? "32px" : "40px",
                height: isMobile ? "32px" : "40px",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Image
                src={WalletIcon}
                alt="Wallet Icon"
                style={{
                  width: "clamp(12px, 2vw, 17px)",
                  height: "auto",
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
              fontFamily: "UrbanistMedium",
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
              display: "flex",
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
                sx={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "999px",
                  background: theme.palette.secondary.light,
                  border: `1px solid ${theme.palette.border.main}`,
                  padding: 0,
                  minWidth: "30px",
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
                sx={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "999px",
                  background: theme.palette.secondary.light,
                  border: `1px solid ${theme.palette.border.main}`,
                  padding: 0,
                  minWidth: "30px",
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
                  fontFamily: "UrbanistMedium",
                  lineHeight: 1.2,
                }}
              >
                {tDashboard("transactionVolume")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.secondary,
                  fontFamily: "UrbanistMedium",
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
