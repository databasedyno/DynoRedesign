// AuroraKPIHero — packed, TODAY-led hero (rebuilt 2026-07-18 per hybrid brief).
// Answers "am I making money right now?" in the fold:
//   • Big Today's-Revenue number (deeper coral→violet gradient for contrast) +
//     real vs-yesterday delta chip (stats.todaySummary.volumeChangePercent)
//   • 7-day sparkline hugging the number (no more stranded chart / dead space)
//   • Supporting stat rail: Lifetime volume · Payments today · Pending waiting
// Data comes from the same useDashboardData stats object (stats.todaySummary
// is populated by the backend today_summary block — hostbay has real data).
import { ArrowDownwardRounded, ArrowUpwardRounded } from "@mui/icons-material";
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  Body,
  CORAL,
  CORAL_DEEP,
  DeltaChip,
  Eyebrow,
  MonoLabel,
  SurfaceCard,
  VIOLET,
  VOLT,
  VOLT_INK,
} from "./styled";

interface Props {
  loading: boolean;
  stats: any;
  chartData: Array<{ date: string; value: number }>;
}

const MiniStat: React.FC<{
  label: string;
  value: React.ReactNode;
  accent?: "ink" | "coral" | "volt";
  testId?: string;
}> = ({ label, value, accent = "ink", testId }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const color =
    accent === "coral"
      ? CORAL
      : accent === "volt"
        ? dark
          ? VOLT
          : VOLT_INK
        : dark
          ? "#F5F5F5"
          : "#0A0A0A";
  return (
    <Box sx={{ minWidth: 0 }} data-testid={testId}>
      <MonoLabel sx={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </MonoLabel>
      <Typography
        sx={{
          mt: 0.4,
          fontFamily: "var(--font-hero)",
          fontWeight: 700,
          fontSize: 18,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

const AuroraKPIHero: React.FC<Props> = ({ loading, stats, chartData }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");

  const today = stats?.todaySummary;
  const currencySymbol = stats?.currencySymbol || "$";

  // Lead with TODAY's revenue when we have it; gracefully fall back to lifetime.
  const heroValue =
    today?.volumeTodayFormatted ?? stats?.totalVolumeFormatted ?? `${currencySymbol}0.00`;
  const heroEyebrow = today
    ? t("heroTodayRevenue", { defaultValue: "Today's revenue" })
    : t("heroLifetimeVolume", { defaultValue: "Lifetime volume" });

  const changePercent = Number(today?.volumeChangePercent ?? 0);
  const numericHero = Number(String(today?.volumeToday ?? stats?.totalVolume ?? 0));
  const showDelta =
    !!today && Number.isFinite(changePercent) && changePercent !== 0 && numericHero !== 0;
  const changeVariant =
    changePercent > 0.05 ? "positive" : changePercent < -0.05 ? "negative" : "neutral";
  const changeArrow =
    changePercent > 0 ? (
      <ArrowUpwardRounded sx={{ fontSize: 13 }} />
    ) : changePercent < 0 ? (
      <ArrowDownwardRounded sx={{ fontSize: 13 }} />
    ) : null;

  const transactionsToday = Number(today?.transactionsToday ?? 0);
  const pendingCount = Number(today?.pendingCount ?? stats?.pendingTransactions ?? 0);
  const lifetime = stats?.totalVolumeFormatted ?? `${currencySymbol}0.00`;

  const spark = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return Array.from({ length: 7 }, (_, i) => ({ date: `d${i}`, value: 0 }));
    }
    return chartData.slice(-7);
  }, [chartData]);

  return (
    <SurfaceCard
      data-testid="aurora-kpi-hero"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        backgroundImage: dark
          ? "radial-gradient(circle at 100% -20%, rgba(255,91,73,0.12) 0%, rgba(21,21,27,0) 55%), radial-gradient(circle at -10% 120%, rgba(124,92,255,0.10) 0%, rgba(21,21,27,0) 55%)"
          : "radial-gradient(circle at 100% -20%, rgba(255,91,73,0.09) 0%, rgba(255,255,255,0) 55%), radial-gradient(circle at -10% 120%, rgba(124,92,255,0.06) 0%, rgba(255,255,255,0) 55%)",
      }}
    >
      {/* Eyebrow + today's payment count */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Eyebrow>{heroEyebrow}</Eyebrow>
        {transactionsToday > 0 && (
          <MonoLabel sx={{ fontSize: 11 }}>
            {transactionsToday} {t("paymentsTodayShort", { defaultValue: "today" })}
          </MonoLabel>
        )}
      </Box>

      {/* Big today number + delta */}
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.25, flexWrap: "wrap" }}>
        {loading ? (
          <Skeleton variant="text" width={240} height={64} sx={{ transform: "none" }} />
        ) : (
          <Typography
            data-testid="aurora-kpi-value"
            sx={{
              fontFamily: "var(--font-hero)",
              fontWeight: 700,
              fontSize: "clamp(32px, 5vw, 50px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              // Deeper coral→violet (drops the low-contrast sky endpoint) so the
              // number stays legible at large sizes on a light background.
              background: `linear-gradient(115deg, ${CORAL_DEEP} 0%, ${VIOLET} 82%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {heroValue}
          </Typography>
        )}

        {!loading && showDelta && (
          <DeltaChip variant={changeVariant} data-testid="aurora-kpi-delta">
            {changeArrow}
            {Math.abs(changePercent).toFixed(1)}%
          </DeltaChip>
        )}
      </Box>

      <Body sx={{ mt: -0.5, fontSize: 13.5 }}>
        {today
          ? `${t("vsYesterday", { defaultValue: "vs yesterday" })} ${today.volumeYesterdayFormatted ?? ""}`.trim()
          : t("vsLastMonth", { defaultValue: "vs last month" })}
      </Body>

      {/* Sparkline hugging the number */}
      <Box
        sx={{
          width: "100%",
          height: 72,
          mt: 0.5,
          opacity: loading ? 0.4 : 1,
          transition: "opacity 240ms ease",
        }}
        data-testid="aurora-kpi-sparkline"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="auroraSparkFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CORAL} stopOpacity={0.42} />
                <stop offset="55%" stopColor={VIOLET} stopOpacity={0.24} />
                <stop offset="100%" stopColor={dark ? "#7C5CFF" : "#4FD1FF"} stopOpacity={0} />
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

      {/* Supporting stat rail */}
      <Box
        sx={{
          mt: 1,
          pt: 1.5,
          borderTop: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,10,0.07)"}`,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1.5,
        }}
      >
        <MiniStat
          testId="aurora-kpi-lifetime"
          label={t("heroLifetimeVolume", { defaultValue: "Lifetime volume" })}
          value={loading ? <Skeleton width={70} /> : lifetime}
        />
        <MiniStat
          testId="aurora-kpi-payments-today"
          label={t("heroPaymentsToday", { defaultValue: "Payments today" })}
          value={loading ? <Skeleton width={40} /> : transactionsToday}
        />
        <MiniStat
          testId="aurora-kpi-pending"
          label={t("pendingLabel", { defaultValue: "Pending" })}
          accent={pendingCount > 0 ? "coral" : "ink"}
          value={loading ? <Skeleton width={40} /> : pendingCount}
        />
      </Box>
    </SurfaceCard>
  );
};

export default memo(AuroraKPIHero);
