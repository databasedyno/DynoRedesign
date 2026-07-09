import { formatNumberWithComma } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowDownward, ArrowUpward, TrendingUpRounded, ReceiptLongRounded, PaidRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import React from "react";
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
}

const DeltaChip: React.FC<{ change: number }> = ({ change }) => {
  const theme = useTheme();
  const positive = change >= 0;
  const color = positive ? theme.palette.success.dark || "#10B981" : theme.palette.error.main;
  const bg = positive
    ? theme.palette.mode === "dark"
      ? "rgba(16,185,129,0.16)"
      : "rgba(16,185,129,0.10)"
    : theme.palette.mode === "dark"
      ? "rgba(239,68,68,0.16)"
      : "rgba(239,68,68,0.10)";
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
}) => {
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const isPrimary = variant === "primary";
  return (
    <Box
      data-testid={testId}
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
            {typeof changePercent === "number" && Number.isFinite(changePercent) && (
              <DeltaChip change={changePercent} />
            )}
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
