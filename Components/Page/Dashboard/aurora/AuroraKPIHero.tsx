// AuroraKPIHero — the "how much did I make?" answer at the top of /dashboard.
// Big Unbounded aurora-ink number + 7-day sparkline + delta chip.
import { ArrowDownwardRounded, ArrowUpwardRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Body,
  CORAL,
  DeltaChip,
  Eyebrow,
  HeroNumber,
  SurfaceCard,
  VIOLET,
  VOLT,
  VOLT_INK,
} from "./styled";

interface Props {
  loading: boolean;
  totalVolumeFormatted?: string;
  totalVolume?: number;
  volumeChangePercent?: number;
  chartData: Array<{ date: string; value: number }>;
  transactionsCount?: number;
  currency?: string;
}

const AuroraKPIHero: React.FC<Props> = ({
  loading,
  totalVolumeFormatted,
  volumeChangePercent,
  chartData,
  transactionsCount,
  currency,
}) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");

  // Only use last 7 days of chart data for the sparkline. Guard against
  // empty arrays with a small placeholder so the SVG still renders.
  const spark = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return Array.from({ length: 7 }, (_, i) => ({ date: `d${i}`, value: 0 }));
    }
    return chartData.slice(-7);
  }, [chartData]);

  const changePercent = Number(volumeChangePercent ?? 0);
  const changeVariant =
    changePercent > 0.05
      ? "positive"
      : changePercent < -0.05
        ? "negative"
        : "neutral";
  const changeArrow =
    changePercent > 0 ? (
      <ArrowUpwardRounded sx={{ fontSize: 13 }} />
    ) : changePercent < 0 ? (
      <ArrowDownwardRounded sx={{ fontSize: 13 }} />
    ) : null;

  return (
    <SurfaceCard
      data-testid="aurora-kpi-hero"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        // Subtle aurora bloom in the top-right corner for visual interest.
        backgroundImage: dark
          ? "radial-gradient(circle at 100% -20%, rgba(255,91,73,0.10) 0%, rgba(21,21,27,0) 55%), radial-gradient(circle at -10% 120%, rgba(124,92,255,0.08) 0%, rgba(21,21,27,0) 55%)"
          : "radial-gradient(circle at 100% -20%, rgba(255,91,73,0.08) 0%, rgba(255,255,255,0) 55%), radial-gradient(circle at -10% 120%, rgba(124,92,255,0.05) 0%, rgba(255,255,255,0) 55%)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", md: "row" },
          gap: 1.5,
        }}
      >
        <Eyebrow>{t("heroLifetimeVolume") || "Total volume"}</Eyebrow>
        {typeof transactionsCount === "number" && transactionsCount > 0 && (
          <Typography
            sx={{
              fontFamily: "var(--font-tech)",
              fontSize: 12,
              color: dark ? "rgba(255,255,255,0.55)" : "#71717A",
            }}
          >
            {transactionsCount} {t("payments") || "payments"}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {loading ? (
          <Skeleton
            variant="text"
            width={280}
            height={80}
            sx={{ transform: "none" }}
          />
        ) : (
          <HeroNumber data-testid="aurora-kpi-value">
            {totalVolumeFormatted || `$0.00 ${currency || "USD"}`}
          </HeroNumber>
        )}

        {!loading && Number.isFinite(changePercent) && changePercent !== 0 && (
          <DeltaChip variant={changeVariant}>
            {changeArrow}
            {Math.abs(changePercent).toFixed(1)}%
          </DeltaChip>
        )}
      </Box>

      <Body sx={{ mt: -0.5 }}>
        {t("vsLastMonth") || "vs last month"}
      </Body>

      {/* Sparkline */}
      <Box
        sx={{
          width: "100%",
          height: 84,
          mt: 1,
          opacity: loading ? 0.4 : 1,
          transition: "opacity 240ms ease",
        }}
        data-testid="aurora-kpi-sparkline"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={spark}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="auroraSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CORAL} stopOpacity={0.42} />
                <stop offset="55%" stopColor={VIOLET} stopOpacity={0.24} />
                <stop
                  offset="100%"
                  stopColor={dark ? "#7C5CFF" : "#4FD1FF"}
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="auroraSparkStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={CORAL} />
                <stop offset="55%" stopColor={VIOLET} />
                <stop offset="100%" stopColor={dark ? VOLT : VOLT_INK} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip
              cursor={{ stroke: dark ? "#333" : "#DDD", strokeWidth: 1 }}
              contentStyle={{
                background: dark ? "#0B0B0F" : "#FFFFFF",
                border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
                borderRadius: 10,
                fontFamily: "var(--font-body)",
                fontSize: 12,
              }}
              labelStyle={{ color: dark ? "#F5F5F5" : "#0A0A0A" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#auroraSparkStroke)"
              strokeWidth={2}
              fill="url(#auroraSparkFill)"
              activeDot={{ r: 4, fill: CORAL, stroke: "#FFFFFF", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </SurfaceCard>
  );
};

export default memo(AuroraKPIHero);
