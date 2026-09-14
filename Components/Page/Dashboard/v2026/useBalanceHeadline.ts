import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatWithSeparators } from "@/utils/currencyFormat";

export type Metric = "period" | "lifetime" | "today";

export interface ChartSummary {
  total_volume: number;
  previous_total_volume: number;
  volume_change_percent: number;
}

const splitAmount = (raw: string) => {
  const idx = raw.lastIndexOf(" ");
  if (idx > 0 && idx < raw.length - 1) {
    return { big: raw.slice(0, idx), suffix: raw.slice(idx + 1) };
  }
  return { big: raw, suffix: "" };
};

/** Headline value + delta for the selected metric, plus the plain-English "how is today going" line (Move 6). */
export const useBalanceHeadline = (
  metric: Metric,
  stats: any,
  chartData: Array<{ date: string; value: number; transactionCount?: number }>,
  chartSummary?: ChartSummary | null,
) => {
  const { t } = useTranslation(["dashboardLayout", "common"]);

  const currencySymbol = stats?.currencySymbol || "$";
  const lifetimeStr = stats?.totalVolumeFormatted || `${currencySymbol}0.00`;
  const todayStr = stats?.todaySummary?.volumeTodayFormatted || `${currencySymbol}0.00`;
  const lifetimeDelta = Number(stats?.volumeChange ?? 0);
  const todayDelta = Number(stats?.todaySummary?.volumeChangePercent ?? 0);

  const { periodVolumeFromChart, periodTxCount } = useMemo(() => {
    let v = 0;
    let c = 0;
    for (const d of chartData || []) {
      v += Number(d?.value) || 0;
      c += Number(d?.transactionCount) || 0;
    }
    return { periodVolumeFromChart: v, periodTxCount: c };
  }, [chartData]);
  const periodVolume = chartSummary && typeof chartSummary.total_volume === "number" ? chartSummary.total_volume : periodVolumeFromChart;
  const periodStr = `${currencySymbol}${formatWithSeparators(periodVolume, stats?.currency || "USD", 2)}`;
  const periodDelta = Number(chartSummary?.volume_change_percent ?? 0);
  const hasPeriodDelta = !!chartSummary;

  const activeStr = metric === "period" ? periodStr : metric === "lifetime" ? lifetimeStr : todayStr;
  const activeDelta = metric === "period" ? periodDelta : metric === "lifetime" ? lifetimeDelta : todayDelta;
  const { big, suffix } = useMemo(() => splitAmount(activeStr), [activeStr]);

  const insight = useMemo(() => {
    const ts = stats?.todaySummary;
    if (!ts) return null;
    const todayTx = Number(ts.transactionsToday ?? 0);
    const yesterdayTx = Number(ts.transactionsYesterday ?? 0);
    if (todayTx === 0 && yesterdayTx === 0) return null;
    if (todayTx === 0) {
      return t("heroInsightNoneYet", { defaultValue: "No payments yet today — yesterday had {{count}}", count: yesterdayTx });
    }
    const diff = todayTx - yesterdayTx;
    const avgToday = todayTx > 0 ? Number(ts.volumeToday ?? 0) / todayTx : 0;
    const avgYesterday = yesterdayTx > 0 ? Number(ts.volumeYesterday ?? 0) / yesterdayTx : 0;
    if (diff > 0) {
      if (avgYesterday > 0 && avgToday < avgYesterday * 0.95) {
        return t("heroInsightBusierSmaller", { defaultValue: "Busier than yesterday — {{count}} more payments, smaller average", count: diff });
      }
      return t("heroInsightBusier", { defaultValue: "Busier than yesterday — {{count}} more payments", count: diff });
    }
    if (diff < 0) {
      return t("heroInsightQuieter", { defaultValue: "Quieter than yesterday — {{count}} fewer payments", count: Math.abs(diff) });
    }
    return t("heroInsightSteady", { defaultValue: "Steady — same number of payments as yesterday" });
  }, [stats?.todaySummary, t]);

  const subline =
    metric === "period"
      ? (t("periodVsPrevious", { defaultValue: "vs previous period · {count} payments" }) as string).replace("{count}", String(periodTxCount))
      : metric === "lifetime"
        ? t("vsLastMonth", { defaultValue: "vs previous period" })
        : t("vsYesterday", { defaultValue: "vs yesterday" });

  const metricLabels: Record<Metric, string> = {
    period: t("heroPeriodVolume", { defaultValue: "This period" }),
    lifetime: t("heroLifetimeVolume", { defaultValue: "Lifetime volume" }),
    today: t("heroTodayRevenue", { defaultValue: "Today" }),
  };

  return { big, suffix, activeDelta, positive: activeDelta >= 0, showDelta: metric !== "period" || hasPeriodDelta, subline, insight, metricLabels };
};
