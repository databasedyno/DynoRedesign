import React, { useMemo } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  ArrowUpwardRounded,
  ArrowDownwardRounded,
  AccountBalanceWalletRounded,
  ReceiptLongRounded,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { formatNumberWithComma } from "@/helpers";
import { DeltaChip, CB_TOKENS } from "../coinbase/styled";
import { StatCard } from "./styled";

interface Props {
  stats: any;
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  loading?: boolean;
}

type SparkPoint = { date?: string; value: number };

const fmtSparkDate = (iso?: string) => {
  if (!iso) return "";
  try {
    return format(new Date(`${iso}T00:00:00`), "MMM d");
  } catch {
    return iso;
  }
};

/** Themed hover tooltip for the KPI mini-sparklines (date + exact value). */
const MiniSparkTooltip: React.FC<any> = ({
  active,
  payload,
  valueType,
  currencySymbol,
  isDark,
}) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as SparkPoint;
  const raw = Number(payload[0]?.value ?? 0);
  const valueStr =
    valueType === "currency"
      ? `${currencySymbol}${formatNumberWithComma(raw)}`
      : `${Math.round(raw)}`;
  return (
    <Box
      sx={{
        px: 1,
        py: 0.5,
        borderRadius: "8px",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        backgroundColor: isDark ? "#12121A" : "#FFFFFF",
        border: `1px solid ${
          isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light
        }`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
      }}
    >
      {point?.date && (
        <Box
          component="span"
          sx={{
            color: isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight,
            mr: 0.75,
          }}
        >
          {fmtSparkDate(point.date)}
        </Box>
      )}
      <Box
        component="span"
        sx={{
          fontWeight: 700,
          color: isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight,
        }}
      >
        {valueStr}
      </Box>
    </Box>
  );
};

const MiniSpark: React.FC<{
  data: SparkPoint[];
  color: string;
  valueType: "currency" | "count";
  currencySymbol: string;
  isDark: boolean;
}> = ({ data, color, valueType, currencySymbol, isDark }) => {
  if (!data || data.length === 0) return null;
  const anyNonZero = data.some((d) => Number(d.value) > 0);
  if (!anyNonZero) return null;
  const gid = `mini-${color.replace("#", "")}`;
  return (
    <Box sx={{ height: 34, width: "100%", mt: 0.5 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.26} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={
              <MiniSparkTooltip
                valueType={valueType}
                currencySymbol={currencySymbol}
                isDark={isDark}
              />
            }
            cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.4 }}
            wrapperStyle={{ zIndex: 20, outline: "none" }}
            allowEscapeViewBox={{ x: false, y: true }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gid})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};

/**
 * KpiStrip — four glanceable merchant KPIs directly under the hero. Replaces
 * the old drag-to-scroll stat strip with a clean responsive grid. The first
 * two cards carry a mini sparkline + delta; the last two are point-in-time
 * counters (active wallets, tax collected).
 */
const KpiStrip: React.FC<Props> = ({ stats, chartData, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const green = "#05B169";
  const symbol = stats?.currencySymbol || "$";

  const revSpark = useMemo(
    () =>
      (chartData || []).map((d) => ({
        date: d.date,
        value: Number(d.value) || 0,
      })),
    [chartData],
  );
  const txSpark = useMemo(
    () =>
      (chartData || []).map((d) => ({
        date: d.date,
        value: Number(d.transactionCount) || 0,
      })),
    [chartData],
  );

  const cards: Array<{
    key: string;
    label: string;
    value: string;
    delta?: number;
    spark?: SparkPoint[];
    valueType?: "currency" | "count";
    color?: string;
    icon?: React.ReactNode;
  }> = [
    {
      key: "revenue",
      label: t("todaysRevenue", { defaultValue: "Today's revenue" }),
      value: stats?.todaySummary?.volumeTodayFormatted || `${symbol}0.00`,
      delta: Number(stats?.todaySummary?.volumeChangePercent ?? 0),
      spark: revSpark,
      valueType: "currency",
      color: indigo,
    },
    {
      key: "payments",
      label: t("paymentsToday", { defaultValue: "Payments today" }),
      value: String(stats?.todaySummary?.transactionsToday ?? 0),
      delta: Number(stats?.todaySummary?.transactionsChangePercent ?? 0),
      spark: txSpark,
      valueType: "count",
      color: green,
    },
    {
      key: "wallets",
      label: t("activeWallets", { defaultValue: "Active wallets" }),
      value: String(stats?.activeWallets ?? 0),
      icon: <AccountBalanceWalletRounded sx={{ fontSize: 18 }} />,
    },
    {
      key: "tax",
      label: t("taxCollected", { defaultValue: "Tax collected" }),
      value:
        Number(stats?.taxCollected) > 0
          ? stats?.taxCollectedFormatted || String(stats?.taxCollected)
          : `${symbol}0.00`,
      icon: <ReceiptLongRounded sx={{ fontSize: 18 }} />,
    },
  ];

  return (
    <Box
      data-testid="dash2026-kpi-strip"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: { xs: 1.5, md: 2 },
      }}
    >
      {cards.map((c) => (
        <StatCard key={c.key} data-testid={`dash2026-kpi-${c.key}`}>
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box
              sx={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 600,
                color: isDark
                  ? CB_TOKENS.ink.mutedDark
                  : CB_TOKENS.ink.mutedLight,
              }}
            >
              {c.label}
            </Box>
            {c.icon && (
              <Box sx={{ color: indigo, display: "flex", flexShrink: 0 }}>
                {c.icon}
              </Box>
            )}
          </Box>

          <Box
            sx={{
              fontFamily:
                "var(--font-unbounded, 'Unbounded', 'Inter', system-ui)",
              fontSize: { xs: 22, md: 26 },
              fontWeight: 500,
              letterSpacing: -0.4,
              lineHeight: 1,
              color: isDark
                ? CB_TOKENS.ink.primaryDark
                : CB_TOKENS.ink.primaryLight,
            }}
          >
            {loading ? <Skeleton width={80} height={30} /> : c.value}
          </Box>

          {!loading && typeof c.delta === "number" && (
            <DeltaChip positive={c.delta >= 0}>
              {c.delta >= 0 ? (
                <ArrowUpwardRounded sx={{ fontSize: 12 }} />
              ) : (
                <ArrowDownwardRounded sx={{ fontSize: 12 }} />
              )}
              {Math.abs(c.delta).toFixed(1)}%
            </DeltaChip>
          )}

          {!loading && c.spark && c.color && (
            <MiniSpark
              data={c.spark}
              color={c.color}
              valueType={c.valueType || "count"}
              currencySymbol={symbol}
              isDark={isDark}
            />
          )}
        </StatCard>
      ))}
    </Box>
  );
};

export default KpiStrip;
