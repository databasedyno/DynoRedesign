import { formatNumberWithComma } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowDownward, ArrowUpward, TrendingUpRounded, ReceiptLongRounded, PaidRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
}

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
      {Math.abs(change).toFixed(1)}%
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
            color: isPrimary ? theme.palette.primary.main : theme.palette.text.secondary,
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
          </>
        )}
      </Box>
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
}) => {
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("dashboardLayout");

  // Pulse the Today's Revenue tile whenever the value goes UP between renders
  // (i.e. a new payment landed). Suppresses on initial load.
  const revenuePulse = usePulseOnIncrement(volumeTodayFormatted);

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
        />
      </motion.div>
      <motion.div {...tileAnim} transition={{ ...tileAnim.transition, delay: 0.09 }}>
        <Tile
          testId="hero-tile-total-volume"
          label={t("heroLifetimeVolume")}
          value={totalVolumeFormatted || `${currencySymbol}0.00`}
          changePercent={volumeChangePercent}
          changeLabel={t("vsLastMonth")}
          icon={<TrendingUpRounded sx={{ fontSize: 18 }} />}
          loading={loading}
        />
      </motion.div>
      <motion.div {...tileAnim} transition={{ ...tileAnim.transition, delay: 0.18 }}>
        <Tile
          testId="hero-tile-payments-today"
          label={t("heroPaymentsToday")}
          value={
            loading
              ? ""
              : formatNumberWithComma(String(transactionsToday ?? 0))
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
        />
      </motion.div>
    </Box>
  );
};

export default HeroMetrics;
