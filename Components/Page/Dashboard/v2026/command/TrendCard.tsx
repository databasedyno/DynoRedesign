import React, { useMemo, useState } from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import useIsMobile from "@/hooks/useIsMobile";
import { Icon, MONO } from "@/styles/uiKit";
import { SurfaceCard, Eyebrow, PillButton, CB_TOKENS } from "../../coinbase/styled";
import { moneyCompact, money } from "./format";
import CheckoutHealthLine from "./CheckoutHealthLine";
import type { DashboardOverview } from "./useDashboardOverview";

type Metric = "volume" | "payments" | "avg";
type Point = { date: string; value: number; transactionCount?: number };

interface Props {
  chartData: Point[];
  chartAssets: Array<{ currency: string; count: number; volume: number }>;
  loading: boolean;
  currencySymbol: string;
  currency: string;
  rangeLabel: string;
  health?: DashboardOverview["health"] | null;
  healthLoading: boolean;
}

const labelFor = (key: string, lang: string) => {
  const isHour = key.includes("T");
  const d = new Date(isHour ? `${key}:00Z` : `${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return isHour
    ? d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(lang, { month: "short", day: "numeric" });
};

/** Zone 4 — one wide trend card: metric toggle, asset legend, chart, checkout-health line. */
const TrendCard: React.FC<Props> = ({ chartData, chartAssets, loading, currencySymbol, currency, rangeLabel, health, healthLoading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isMobile = useIsMobile("md");
  const { t, i18n } = useTranslation("dashboardLayout");
  const [metric, setMetric] = useState<Metric>("volume");
  const [showAssets, setShowAssets] = useState(false);

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const stroke = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const series = useMemo(
    () =>
      (chartData || []).map((p) => {
        const count = Number(p.transactionCount) || 0;
        const vol = Number(p.value) || 0;
        const value = metric === "volume" ? vol : metric === "payments" ? count : count > 0 ? vol / count : 0;
        return { key: p.date, label: labelFor(p.date, i18n.language), value };
      }),
    [chartData, metric, i18n.language],
  );
  const empty = series.every((p) => p.value === 0);
  const assetTotal = chartAssets.reduce((a, c) => a + (Number(c.volume) || 0), 0);
  const fmt = (v: number) => (metric === "payments" ? String(Math.round(v)) : moneyCompact(v, currencySymbol, currency));
  const tickStep = Math.max(1, Math.ceil(series.length / (isMobile ? 4 : 8)));

  const metrics: Array<{ id: Metric; label: string; testId: string }> = [
    { id: "volume", label: t("command.metricVolume", { defaultValue: "Volume" }), testId: "trend-toggle-volume" },
    { id: "payments", label: t("command.metricPayments", { defaultValue: "Payments" }), testId: "trend-toggle-payments" },
    { id: "avg", label: t("command.metricAvgTicket", { defaultValue: "Avg ticket" }), testId: "trend-toggle-avg-ticket" },
  ];

  return (
    <SurfaceCard data-testid="trend-chart-card" sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
        <Eyebrow data-testid="trend-eyebrow">{`${t("command.trend", { defaultValue: "Trend" })} · ${rangeLabel}`}</Eyebrow>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Box role="tablist" sx={{ display: "flex", gap: 0.5, p: 0.5, borderRadius: 999, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)" }}>
            {metrics.map((m) => (
              <PillButton key={m.id} role="tab" aria-selected={metric === m.id} active={metric === m.id} onClick={() => setMetric(m.id)} data-testid={m.testId} sx={{ padding: "5px 12px", fontSize: 12.5 }}>
                {m.label}
              </PillButton>
            ))}
          </Box>
          <PillButton
            active={showAssets}
            onClick={() => setShowAssets((v) => !v)}
            data-testid="trend-toggle-assets"
            aria-pressed={showAssets}
            sx={{ padding: "5px 12px", fontSize: 12.5, display: "inline-flex", gap: 0.5, border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}` }}
          >
            <Icon name="coins" size={13} />
            {t("command.assetMix", { defaultValue: "Asset mix" })}
          </PillButton>
        </Box>
      </Box>

      {showAssets && (
        <Box data-testid="trend-asset-legend" sx={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
          {chartAssets.length === 0 || assetTotal === 0 ? (
            <Box component="span">{t("command.noAssets", { defaultValue: "No settled payments in this range" })}</Box>
          ) : (
            chartAssets.slice(0, 8).map((a, i) => (
              <Box key={a.currency} component="span" data-testid={`trend-asset-${a.currency}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: 2, backgroundColor: stroke, opacity: Math.max(0.15, 1 - i * 0.17) }} />
                <Box component="span" sx={{ color: ink, fontWeight: 600 }}>{a.currency}</Box>
                <Box component="span" sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: secondary }}>{money(a.volume, currencySymbol, currency)}</Box>
                {Math.round((a.volume / assetTotal) * 100)}% · {a.count}
              </Box>
            ))
          )}
        </Box>
      )}

      <Box data-testid="trend-chart" data-metric={metric} sx={{ width: "100%", height: isMobile ? 190 : 260, minWidth: 0 }}>
        {loading ? (
          <Skeleton variant="rounded" height="100%" sx={{ borderRadius: 3, bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(10,10,15,0.04)" }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={isDark ? 0.36 : 0.2} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(10,10,15,0.05)"} />
              <XAxis dataKey="label" interval={tickStep - 1} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: muted, fontFamily: "var(--font-sans)" }} dy={6} />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip
                cursor={{ stroke: isDark ? "rgba(255,255,255,0.14)" : "rgba(10,10,15,0.14)", strokeDasharray: "3 3" }}
                contentStyle={{ borderRadius: 10, border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`, backgroundColor: isDark ? "#1F2029" : "#FFFFFF", fontFamily: "var(--font-sans)", fontSize: 12 }}
                labelStyle={{ color: muted, fontSize: 11 }}
                itemStyle={{ color: ink, fontWeight: 700 }}
                formatter={(v: unknown) => [fmt(Number(v ?? 0)), metrics.find((m) => m.id === metric)?.label ?? ""]}
              />
              <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2.25} fill="url(#trend-fill)" activeDot={{ r: 4, fill: stroke, stroke: isDark ? "#0A0A0F" : "#FFFFFF", strokeWidth: 2 }} isAnimationActive animationDuration={500} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Box>
      {!loading && empty && (
        <Box data-testid="trend-empty" sx={{ mt: -1, fontFamily: "var(--font-sans)", fontSize: 12.5, color: muted }}>
          {t("command.trendEmpty", { defaultValue: "No settled payments in this range yet." })}
        </Box>
      )}

      <CheckoutHealthLine health={health} loading={healthLoading} />
    </SurfaceCard>
  );
};

export default TrendCard;
