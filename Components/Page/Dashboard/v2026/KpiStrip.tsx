import React, { useMemo } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { formatNumberWithComma } from "@/helpers";
import { DeltaChip, CB_TOKENS } from "../coinbase/styled";
import { StatCard } from "./styled";
import { Icon, MONO } from "@/styles/uiKit";

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
  // Semantic per-KPI accents — brand indigo, info blue, amber.
  const info = isDark ? CB_TOKENS.semantic.info.dark : CB_TOKENS.semantic.info.light;
  const amber = isDark ? CB_TOKENS.semantic.warning.dark : CB_TOKENS.semantic.warning.light;
  const symbol = stats?.currencySymbol || "$";

  const txSpark = useMemo(
    () =>
      (chartData || []).map((d) => ({
        date: d.date,
        value: Number(d.transactionCount) || 0,
      })),
    [chartData],
  );

  // Day-over-day payment COUNTS live on a tiny base: 1 → 4 payments is a true
  // "+300%" but reads as nonsense next to a volume that fell. Below a 5-payment
  // baseline we therefore show the plain difference (+3) and always spell out
  // what it is measured against.
  const paymentsToday = Number(stats?.todaySummary?.transactionsToday ?? 0);
  const paymentsYesterday = Number(stats?.todaySummary?.transactionsYesterday ?? 0);
  const paymentsDiff = paymentsToday - paymentsYesterday;
  const lowBaseline = paymentsYesterday < 5;
  const paymentsDelta = lowBaseline
    ? paymentsDiff
    : Number(stats?.todaySummary?.transactionsChangePercent ?? 0);
  const paymentsDeltaText = lowBaseline
    ? `${paymentsDiff > 0 ? "+" : ""}${paymentsDiff}`
    : `${Math.abs(Number(stats?.todaySummary?.transactionsChangePercent ?? 0)).toFixed(1)}%`;

  const cards: Array<{
    key: string;
    label: string;
    value: string;
    delta?: number;
    /** Overrides the plain "N%" chip — used for low-baseline day-over-day counts. */
    deltaText?: string;
    deltaCaption?: string;
    spark?: SparkPoint[];
    valueType?: "currency" | "count";
    color?: string;
    icon?: React.ReactNode;
  }> = [
    {
      key: "payments",
      label: t("paymentsToday", { defaultValue: "Payments today" }),
      value: String(paymentsToday),
      delta: paymentsDelta,
      deltaText: paymentsDeltaText,
      deltaCaption: t("vsYesterdayCount", {
        count: paymentsYesterday,
        defaultValue: `vs ${paymentsYesterday} yesterday`,
      }),
      spark: txSpark,
      valueType: "count",
      color: indigo,
    },
    {
      key: "wallets",
      label: t("activeWallets", { defaultValue: "Active wallets" }),
      value: String(stats?.activeWallets ?? 0),
      color: info,
    },
    {
      key: "tax",
      label: t("taxCollected", { defaultValue: "Tax collected" }),
      value:
        Number(stats?.taxCollected) > 0
          ? stats?.taxCollectedFormatted || String(stats?.taxCollected)
          : `${symbol}0.00`,
      color: amber,
    },
  ];

  return (
    <Box
      data-testid="dash2026-kpi-strip"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
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
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                color: isDark
                  ? CB_TOKENS.ink.mutedDark
                  : CB_TOKENS.ink.mutedLight,
              }}
            >
              {c.label}
            </Box>
          </Box>

          <Box
            sx={{
              fontFamily: MONO,
              fontVariantNumeric: "tabular-nums",
              fontSize: { xs: 22, md: 26 },
              fontWeight: 600,
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
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                flexWrap: "wrap",
              }}
            >
              <DeltaChip positive={c.delta >= 0} data-testid={`dash2026-kpi-${c.key}-delta`}>
                <Icon name={c.delta >= 0 ? "arrow-up" : "arrow-down"} size={12} />
                {c.deltaText ?? `${Math.abs(c.delta).toFixed(1)}%`}
              </DeltaChip>
              {c.deltaCaption && (
                <Box
                  sx={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 11,
                    color: isDark
                      ? CB_TOKENS.ink.mutedDark
                      : CB_TOKENS.ink.mutedLight,
                  }}
                >
                  {c.deltaCaption}
                </Box>
              )}
            </Box>
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
