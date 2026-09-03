import { formatNumberWithComma } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowDownward, ArrowUpward, TrendingUpRounded, ReceiptLongRounded, PaidRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { brandFg } from "@/constants/theme";
import { toFixedStr } from "@/utils/money";

/**
 * Stagger animation config (added 2026-07-09).
 * Each tile fades + slides up 8px with a 90ms delay between siblings, so the
 * hero row "cascades in" instead of dumping — makes the metrics feel earned.
 * Uses a fluid cubic-bezier for the entry curve.
 */
const tileAnim = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.36, ease: [0.16, 1, 0.3, 1] as const },
};

/**
 * Detect when a formatted-currency string (e.g. "$1,234.56", "€1.234,56")
 * numerically INCREASES between renders — used to fire the "new payment
 * landed" pulse on the Today's Revenue tile.
 *
 * - Strips all non-digit / non-dot / non-comma / non-minus characters
 * - Handles both US ("," thousands, "." decimal) and EU ("." thousands,
 *   "," decimal) — falls back gracefully if it can't parse
 * - Returns a boolean that flips to `true` for the pulse duration
 *   (700ms) whenever a real increment is detected, then back to `false`
 * - Suppresses on first render (no baseline yet) so we don't pulse on load
 */
const parseFormattedAmount = (formatted?: string): number | null => {
  if (!formatted) return null;
  // Strip currency symbol + spaces
  const clean = formatted.replace(/[^\d.,-]/g, "");
  if (!clean) return null;
  const hasDot = clean.includes(".");
  const hasComma = clean.includes(",");
  let normalized = clean;
  if (hasDot && hasComma) {
    // Whichever appears LAST is the decimal separator
    if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
      normalized = clean.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = clean.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Only comma present — assume it's decimal if there are ≤2 digits after
    const parts = clean.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = clean.replace(",", ".");
    } else {
      normalized = clean.replace(/,/g, "");
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const usePulseOnIncrement = (formattedValue?: string, pulseMs = 700): boolean => {
  const [pulsing, setPulsing] = useState(false);
  const prevRef = useRef<number | null>(null);
  useEffect(() => {
    const current = parseFormattedAmount(formattedValue);
    const prev = prevRef.current;
    if (current !== null && prev !== null && current > prev) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), pulseMs);
      prevRef.current = current;
      return () => clearTimeout(t);
    }
    // Update baseline without pulsing (first meaningful value, or decrement)
    if (current !== null) prevRef.current = current;
  }, [formattedValue, pulseMs]);
  return pulsing;
};

/**
 * HeroMetrics — the top-of-dashboard glanceable summary.
 *
 * Three big tiles: Today's Revenue · Lifetime Volume · Payments Today.
 * Merchants open the dashboard to answer "am I making money?" — answer
 * that in <2 seconds. Replaces the older `TodaySummaryStrip` (thin
 * horizontal strip that was hard to scan).
 */

export interface HeroMetricsProps {
  loading?: boolean;
  currency?: string;
  currencySymbol?: string;
  volumeTodayFormatted?: string;
  volumeTodayChangePercent?: number;
  totalVolumeFormatted?: string;
  volumeChangePercent?: number;
  transactionsToday?: number;
  transactionsChangePercent?: number;
  activeWallets?: number;
  onCreateLink?: () => void;
  /** Data points for the Today's-Revenue sparkline. Uses whatever period the
   *  Transaction Volume chart is currently showing (7d default, up to 90d).
   *  Each point may carry a `transactionCount` (Payments-Today spark). */
  sparkData?: Array<{ date: string; value: number; transactionCount?: number }>;
}

/**
 * Sparkline — tiny inline area/line chart, no axes, no labels.
 *
 * Fills the bottom-right corner of the Today's Revenue tile. Kept as an
 * inline SVG (no lib) so it renders instantly, respects the tile bg and
 * theme, and doesn't pull chart.js/recharts into this critical bundle.
 *
 * Behaviour:
 *  - <2 real points → shows nothing (avoids a flat line that fake-signals
 *    "no growth" when there's simply no data yet).
 *  - Values are min-normalised so tiny differences still read as a slope.
 *  - Positive last-vs-first slope → primary color; negative → text-secondary
 *    (neutral, non-alarming); flat → text-secondary at 60% opacity.
 */
interface SparklineProps {
  data: Array<{ date: string; value: number }>;
  width?: number;
  height?: number;
  strokeColor?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  testId?: string;
}

const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 96,
  height = 30,
  strokeColor,
  fillOpacity = 0.15,
  strokeWidth = 1.5,
  testId = "hero-sparkline",
}) => {
  const theme = useTheme();
  if (!data || data.length < 2) return null;

  const values = data.map((d) => (Number.isFinite(d.value) ? d.value : 0));
  const nonZero = values.some((v) => v > 0);
  if (!nonZero) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);

  // Y is inverted: high value → low y (top).
  const toY = (v: number) => {
    const norm = (v - min) / range; // 0..1
    // 3px vertical padding so the stroke isn't clipped at the top/bottom.
    return height - 3 - norm * (height - 6);
  };

  const points = values.map((v, i) => [i * stepX, toY(v)] as const);
  const pathD = points
    .map(([x, y], i) => (i === 0 ? `M${toFixedStr(x, 2)},${toFixedStr(y, 2)}` : `L${toFixedStr(x, 2)},${toFixedStr(y, 2)}`))
    .join(" ");
  // Fill path continues down to the baseline and back to start
  const areaD = `${pathD} L${toFixedStr(((values.length - 1) * stepX), 2)},${height} L0,${height} Z`;

  const trending = values[values.length - 1] - values[0];
  const isUp = trending > 0;
  const isFlat = trending === 0;
  const resolvedStroke = strokeColor
    || (isFlat
      ? theme.palette.text.secondary
      : isUp
        ? theme.palette.primary.main
        : theme.palette.text.secondary);

  return (
    <svg
      data-testid={testId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Revenue trend sparkline"
      style={{ display: "block", overflow: "visible", opacity: isFlat ? 0.6 : 1 }}
    >
      <path d={areaD} fill={resolvedStroke} fillOpacity={fillOpacity} />
      <path
        d={pathD}
        fill="none"
        stroke={resolvedStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Trailing dot on the last point — anchors the eye to "now" */}
      <circle
        cx={toFixedStr(((values.length - 1) * stepX), 2)}
        cy={toFixedStr(toY(values[values.length - 1]), 2)}
        r={2.25}
        fill={resolvedStroke}
      />
    </svg>
  );
};

interface TileProps {
  label: string;
  value: string;
  changePercent?: number;
  changeLabel: string;
  meta?: string;
  icon: React.ReactNode;
  loading?: boolean;
  variant?: "primary" | "neutral";
  testId?: string;
  /** When true, plays a soft green flash + subtle scale — signals "new payment landed". */
  pulse?: boolean;
  /** Optional inline sparkline that renders in the tile's bottom-right corner. */
  spark?: React.ReactNode;
}

const DeltaChip: React.FC<{ change: number }> = ({ change }) => {
  const theme = useTheme();
  const positive = change >= 0;
  // Declines are shown in a neutral, informational tone (not alarming red) —
  // normal day/period swings on lower-volume accounts shouldn't read like an error.
  const color = positive ? theme.palette.success.dark || "#10B981" : theme.palette.text.secondary;
  const bg = positive
    ? theme.palette.mode === "dark"
      ? "rgba(16,185,129,0.16)"
      : "rgba(16,185,129,0.10)"
    : theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.08)"
      : "rgba(10,10,10,0.05)";
  const Arrow = positive ? ArrowUpward : ArrowDownward;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.75,
        py: 0.25,
        borderRadius: "999px",
        backgroundColor: bg,
        color,
        fontFamily: "var(--font-sans)",
        fontSize: "11px",
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      <Arrow sx={{ fontSize: 12 }} />
      {toFixedStr(Math.abs(change), 1)}%
    </Box>
  );
};

const Tile: React.FC<TileProps> = ({
  label,
  value,
  changePercent,
  changeLabel,
  meta,
  icon,
  loading,
  variant = "neutral",
  testId,
  pulse = false,
  spark,
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const isPrimary = variant === "primary";
  // Hide the change chip when the value is effectively zero (avoids a
  // misleading "-100%" chip on days/periods that simply have no activity yet).
  const numericValue = parseFormattedAmount(value);
  const showDelta =
    typeof changePercent === "number" &&
    Number.isFinite(changePercent) &&
    !(numericValue !== null && numericValue === 0);
  return (
    <Box
      data-testid={testId}
      data-pulsing={pulse ? "true" : undefined}
      className={pulse ? "hero-tile-pulse" : undefined}
      sx={{
        position: "relative",
        flex: 1,
        minWidth: 0,
        borderRadius: "16px",
        p: isMobile ? 2 : 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        minHeight: isMobile ? 120 : 140,
        border: `1px solid ${
          isPrimary
            ? theme.palette.primary.main + "33"
            : theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : theme.palette.border.main
        }`,
        background: isPrimary
          ? `linear-gradient(135deg, ${theme.palette.primary.main}0d 0%, ${theme.palette.primary.main}03 100%)`
          : theme.palette.background.paper,
        transition: "transform 200ms ease, box-shadow 200ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: theme.palette.mode === "dark"
            ? "0 8px 24px rgba(0,0,0,0.25)"
            : "0 8px 24px rgba(20,30,60,0.06)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: isMobile ? "12px" : "13px",
            color: theme.palette.text.secondary,
            letterSpacing: "0.2px",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isPrimary
              ? theme.palette.primary.main + "1A"
              : theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.06)"
                : "#F4F6FA",
            color: isPrimary ? brandFg(theme.palette.mode === "dark") : theme.palette.text.secondary,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography
        sx={{
          fontFamily: "var(--font-sans)",
          fontSize: isMobile ? "24px" : "32px",
          fontWeight: 700,
          color: theme.palette.text.primary,
          lineHeight: 1.1,
          letterSpacing: "-0.5px",
          minHeight: isMobile ? 28 : 36,
        }}
      >
        {loading ? <Skeleton width={140} /> : value}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {loading ? (
          <Skeleton width={80} height={18} />
        ) : (
          <>
            {showDelta && <DeltaChip change={changePercent as number} />}
            {/* F7: only render the trailing label when a delta chip is shown
                OR meta is explicitly set. Otherwise a dangling "vs yesterday"
                remains next to a $0 value with no delta chip in front of it. */}
            {(showDelta || meta) && (
              <Typography
                sx={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile ? "11px" : "12px",
                  color: theme.palette.text.secondary,
                  lineHeight: 1.3,
                }}
              >
                {meta || changeLabel}
              </Typography>
            )}
          </>
        )}
      </Box>
      {/* Sparkline — bottom-right pin. Rendered outside the delta row so it
          never wraps under the chip on narrow tiles. Purely decorative for
          visual momentum; the delta chip carries the "hard number". */}
      {!loading && spark && (
        <Box
          data-testid={`${testId}-spark-wrap`}
          sx={{
            position: "absolute",
            right: isMobile ? 10 : 14,
            bottom: isMobile ? 10 : 14,
            pointerEvents: "none",
            opacity: 0.85,
            display: { xs: "none", sm: "block" },
          }}
        >
          {spark}
        </Box>
      )}
    </Box>
  );
};

const HeroMetrics: React.FC<HeroMetricsProps> = ({
  loading = false,
  currencySymbol = "$",
  volumeTodayFormatted,
  volumeTodayChangePercent,
  totalVolumeFormatted,
  volumeChangePercent,
  transactionsToday,
  transactionsChangePercent,
  activeWallets,
  sparkData,
}) => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("dashboardLayout");

  // Pulse the Today's Revenue tile whenever the value goes UP between renders
  // (i.e. a new payment landed). Suppresses on initial load.
  const revenuePulse = usePulseOnIncrement(volumeTodayFormatted);

  // Only render sparklines if we actually have a few points to show —
  // one flat point looks like a bug (a dot in the corner with no line).
  const hasSparkData = Array.isArray(sparkData) && sparkData.length >= 2;

  const revenueSpark = hasSparkData ? (
    <Sparkline
      data={sparkData as Array<{ date: string; value: number }>}
      testId="hero-sparkline"
    />
  ) : undefined;

  // Lifetime Volume spark = cumulative running total of the same series.
  // Shows the merchant "how big we've gotten" as a monotonically-rising line.
  // React.useMemo keeps the transform cheap on re-renders.
  const cumulativeSparkData = React.useMemo(() => {
    if (!hasSparkData || !sparkData) return null;
    let acc = 0;
    return sparkData.map((d) => {
      acc += Number.isFinite(d.value) ? d.value : 0;
      return { date: d.date, value: acc };
    });
  }, [hasSparkData, sparkData]);
  const lifetimeSpark = cumulativeSparkData ? (
    <Sparkline data={cumulativeSparkData} testId="hero-sparkline-lifetime" />
  ) : undefined;

  // Payments Today spark = daily transaction counts.
  //   * Skip render if EVERY value is zero (avoids a flat line that fake-
  //     signals "no growth" when the API simply didn't return counts yet).
  //   * If `transactionCount` is missing entirely (older API responses),
  //     fall back to `undefined` so the tile shows no spark instead of a
  //     misleading revenue-based line.
  const txnCountSparkData = React.useMemo(() => {
    if (!hasSparkData || !sparkData) return null;
    const withCounts = sparkData
      .filter((d) => Number.isFinite(d.transactionCount as number))
      .map((d) => ({ date: d.date, value: Number(d.transactionCount) }));
    if (withCounts.length < 2) return null;
    if (withCounts.every((d) => d.value === 0)) return null;
    return withCounts;
  }, [hasSparkData, sparkData]);
  const paymentsSpark = txnCountSparkData ? (
    <Sparkline data={txnCountSparkData} testId="hero-sparkline-payments" />
  ) : undefined;

  return (
    <Box
      data-testid="dashboard-hero-metrics"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(3, 1fr)",
        },
        gap: isMobile ? 1.5 : 2,
        px: { xs: 2, md: 0 },
        mb: { xs: 2, md: 2.5 },
      }}
    >
      <motion.div {...tileAnim} transition={{ ...tileAnim.transition, delay: 0 }}>
        <Tile
          testId="hero-tile-today-revenue"
          label={t("heroTodayRevenue")}
          value={volumeTodayFormatted || `${currencySymbol}0.00`}
          changePercent={volumeTodayChangePercent}
          changeLabel={t("vsYesterday")}
          icon={<PaidRounded sx={{ fontSize: 18 }} />}
          loading={loading}
          variant="primary"
          pulse={revenuePulse}
          spark={revenueSpark}
        />
      </motion.div>
      <motion.div {...tileAnim} transition={{ ...tileAnim.transition, delay: 0.09 }}>
        <Tile
          testId="hero-tile-total-volume"
          label={t("heroLifetimeVolume")}
          value={totalVolumeFormatted || `${currencySymbol}0.00`}
          /* F7: "Lifetime Volume" is a cumulative metric — it cannot decline
             month-over-month. Suppress the misleading delta chip here. If a
             month-over-month comparison is needed, add a separate "Volume
             this month" tile with its own delta. */
          changeLabel={t("vsLastMonth")}
          icon={<TrendingUpRounded sx={{ fontSize: 18 }} />}
          loading={loading}
          spark={lifetimeSpark}
        />
      </motion.div>
      <motion.div {...tileAnim} transition={{ ...tileAnim.transition, delay: 0.18 }}>
        <Tile
          testId="hero-tile-payments-today"
          label={t("heroPaymentsToday")}
          value={
            loading
              ? ""
              : formatNumberWithComma(Number(transactionsToday ?? 0))
          }
          changePercent={transactionsChangePercent}
          changeLabel={
            activeWallets != null
              ? t("activeWalletsCount", { count: activeWallets })
              : t("vsYesterday")
          }
          meta={
            activeWallets != null
              ? t("activeWalletsCount", { count: activeWallets })
              : undefined
          }
          icon={<ReceiptLongRounded sx={{ fontSize: 18 }} />}
          loading={loading}
          spark={paymentsSpark}
        />
      </motion.div>
    </Box>
  );
};

export default HeroMetrics;
