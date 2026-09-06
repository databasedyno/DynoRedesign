import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Popover,
  Skeleton,
  TextField,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { Icon, MONO } from "@/styles/uiKit";
import { formatWithSeparators } from "@/utils/currencyFormat";
import {
  SurfaceCard,
  DeltaChip,
  PillButton,
  CB_TOKENS,
} from "../coinbase/styled";
import { GhostIconButton } from "./styled";
import { RangeId } from "./CommandBar";
import { toFixedStr } from "@/utils/money";

const RANGES: Array<{ id: RangeId; label: string }> = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
];

type Metric = "period" | "lifetime" | "today";

interface Props {
  stats: any;
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  chartSummary?: {
    total_volume: number;
    previous_total_volume: number;
    volume_change_percent: number;
  } | null;
  loading?: boolean;
  chartLoading?: boolean;
  rangeLabel: string;
  range: RangeId;
  onRangeChange: (r: RangeId) => void;
  custom?: { startDate: string; endDate: string } | null;
  onCustomApply: (startDate: string, endDate: string) => void;
  onCustomClear: () => void;
}

const splitAmount = (raw: string) => {
  const idx = raw.lastIndexOf(" ");
  if (idx > 0 && idx < raw.length - 1) {
    return { big: raw.slice(0, idx), suffix: raw.slice(idx + 1) };
  }
  return { big: raw, suffix: "" };
};

/**
 * BalanceStrip — P4 Row 1. The dashboard headline collapses into a single quiet
 * strip: the metric dropdown (This period / Lifetime / Today) on the left with
 * the range segmented control + settings on the right, then the big mono volume
 * number + delta line. The greeting moved up into the page H1 (Jun 2026 polish)
 * so this card carries numbers only.
 */
const BalanceStrip: React.FC<Props> = ({
  stats,
  chartData,
  chartSummary,
  loading,
  chartLoading,
  rangeLabel,
  range,
  onRangeChange,
  custom,
  onCustomApply,
  onCustomClear,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { mode, toggleTheme } = useThemeMode();
  const { isCompact, toggleDensity } = useDashboardDensity();

  const [metric, setMetric] = useState<Metric>("period");
  const [metricAnchor, setMetricAnchor] = useState<null | HTMLElement>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  // Snap back to the range-driven metric whenever the active window changes.
  useEffect(() => {
    setMetric("period");
  }, [rangeLabel]);

  // ── Custom date-range picker ──
  const [customAnchor, setCustomAnchor] = useState<null | HTMLElement>(null);
  // Move 5: phone-only range dropdown (replaces the pill row < 600px).
  const [rangeMenuAnchor, setRangeMenuAnchor] = useState<null | HTMLElement>(null);
  const customActive = !!(custom && custom.startDate && custom.endDate);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  }, []);
  const [draftStart, setDraftStart] = useState<string>(custom?.startDate || defaultStart);
  const [draftEnd, setDraftEnd] = useState<string>(custom?.endDate || today);
  const fmtDay = (iso: string) => {
    try {
      return format(new Date(`${iso}T00:00:00`), "MMM d");
    } catch {
      return iso;
    }
  };
  const customLabel =
    customActive && custom
      ? `${fmtDay(custom.startDate)} – ${fmtDay(custom.endDate)}`
      : t("customRange", { defaultValue: "Custom" });
  const openCustom = (e: React.MouseEvent<HTMLElement>) => {
    setDraftStart(custom?.startDate || defaultStart);
    setDraftEnd(custom?.endDate || today);
    setCustomAnchor(e.currentTarget);
  };
  const applyCustom = () => {
    if (draftStart && draftEnd && draftStart <= draftEnd) {
      onCustomApply(draftStart, draftEnd);
      setCustomAnchor(null);
    }
  };

  // ── Headline value + delta (from VolumeHero) ──
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
  const periodVolume =
    chartSummary && typeof chartSummary.total_volume === "number"
      ? chartSummary.total_volume
      : periodVolumeFromChart;
  const periodStr = `${currencySymbol}${formatWithSeparators(periodVolume, stats?.currency || "USD", 2)}`;
  const periodDelta = Number(chartSummary?.volume_change_percent ?? 0);
  const hasPeriodDelta = !!chartSummary;

  const activeStr =
    metric === "period" ? periodStr : metric === "lifetime" ? lifetimeStr : todayStr;
  const activeDelta =
    metric === "period" ? periodDelta : metric === "lifetime" ? lifetimeDelta : todayDelta;
  const positive = activeDelta >= 0;
  const { big, suffix } = useMemo(() => splitAmount(activeStr), [activeStr]);
  const showSkeleton = loading || (metric === "period" && chartLoading);

  // Move 6: plain-English "how is today going" line under the main number,
  // e.g. "Busier than yesterday — 3 more payments, smaller average".
  const insight = useMemo(() => {
    const ts = stats?.todaySummary;
    if (!ts) return null;
    const todayTx = Number(ts.transactionsToday ?? 0);
    const yesterdayTx = Number(ts.transactionsYesterday ?? 0);
    if (todayTx === 0 && yesterdayTx === 0) return null;
    if (todayTx === 0) {
      return t("heroInsightNoneYet", {
        defaultValue: "No payments yet today — yesterday had {{count}}",
        count: yesterdayTx,
      });
    }
    const diff = todayTx - yesterdayTx;
    const avgToday = todayTx > 0 ? Number(ts.volumeToday ?? 0) / todayTx : 0;
    const avgYesterday = yesterdayTx > 0 ? Number(ts.volumeYesterday ?? 0) / yesterdayTx : 0;
    if (diff > 0) {
      if (avgYesterday > 0 && avgToday < avgYesterday * 0.95) {
        return t("heroInsightBusierSmaller", {
          defaultValue: "Busier than yesterday — {{count}} more payments, smaller average",
          count: diff,
        });
      }
      return t("heroInsightBusier", {
        defaultValue: "Busier than yesterday — {{count}} more payments",
        count: diff,
      });
    }
    if (diff < 0) {
      return t("heroInsightQuieter", {
        defaultValue: "Quieter than yesterday — {{count}} fewer payments",
        count: Math.abs(diff),
      });
    }
    return t("heroInsightSteady", {
      defaultValue: "Steady — same number of payments as yesterday",
    });
  }, [stats?.todaySummary, t]);

  const metricLabels: Record<Metric, string> = {
    period: t("heroPeriodVolume", { defaultValue: "This period" }),
    lifetime: t("heroLifetimeVolume", { defaultValue: "Lifetime volume" }),
    today: t("heroTodayRevenue", { defaultValue: "Today" }),
  };

  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primaryInk = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;

  return (
    <SurfaceCard
      data-testid="dash2026-balance-strip"
      sx={{ ...(isCompact && { p: { xs: 1.75, md: 2 } }) }}
    >
      {/* Top row: metric dropdown + range control + settings */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
          mb: { xs: 1.5, md: 2 },
        }}
      >
        <Button
          data-testid="dash2026-metric"
          onClick={(e) => setMetricAnchor(e.currentTarget)}
          endIcon={<Icon name="chevron-down" size={14} />}
          sx={{
            p: 0,
            minWidth: 0,
            minHeight: 40,
            textTransform: "none",
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.1,
            color: isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight,
            borderRadius: 8,
            transition: "color 150ms ease",
            "&:hover": { backgroundColor: "transparent", color: primaryInk },
            "&:focus-visible": {
              outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`,
              outlineOffset: 4,
            },
          }}
        >
          {metricLabels[metric]}
        </Button>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {/* Move 5: on phones the 5 range pills collapse into ONE dropdown. */}
          <Box sx={{ display: { xs: "block", sm: "none" } }}>
            <PillButton
              active
              onClick={(e: React.MouseEvent<HTMLElement>) => setRangeMenuAnchor(e.currentTarget)}
              data-testid="dash2026-range-dropdown"
              aria-haspopup="menu"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, minHeight: 44 }}
            >
              {customActive ? customLabel : RANGES.find((r) => r.id === range)?.label || "30D"}
              <Icon name="chevron-down" size={14} />
            </PillButton>
            <Menu
              anchorEl={rangeMenuAnchor}
              open={Boolean(rangeMenuAnchor)}
              onClose={() => setRangeMenuAnchor(null)}
            >
              {RANGES.map((r) => (
                <MenuItem
                  key={r.id}
                  selected={range === r.id && !customActive}
                  data-testid={`dash2026-range-menu-${r.id}`}
                  onClick={() => {
                    onRangeChange(r.id);
                    setRangeMenuAnchor(null);
                  }}
                  sx={{ minHeight: 44 }}
                >
                  {r.label}
                </MenuItem>
              ))}
              <MenuItem
                selected={customActive}
                data-testid="dash2026-range-menu-custom"
                onClick={() => {
                  // Anchor the custom-range popover to the dropdown BUTTON
                  // (the menu item unmounts when the menu closes).
                  const anchorBtn = rangeMenuAnchor;
                  setRangeMenuAnchor(null);
                  if (anchorBtn) {
                    setDraftStart(custom?.startDate || defaultStart);
                    setDraftEnd(custom?.endDate || today);
                    setCustomAnchor(anchorBtn);
                  }
                }}
                sx={{ minHeight: 44 }}
              >
                {t("customRange", { defaultValue: "Custom range" })}
              </MenuItem>
            </Menu>
          </Box>

          <Box
            data-testid="dash2026-range"
            role="tablist"
            sx={{
              display: { xs: "none", sm: "flex" },
              alignItems: "center",
              gap: 0.5,
              p: 0.5,
              borderRadius: 999,
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.05)",
            }}
          >
            {RANGES.map((r) => (
              <PillButton
                key={r.id}
                active={range === r.id && !customActive}
                onClick={() => onRangeChange(r.id)}
                role="tab"
                aria-selected={range === r.id && !customActive}
                data-testid={`dash2026-range-${r.id}`}
              >
                {r.label}
              </PillButton>
            ))}
            <PillButton
              active={customActive}
              onClick={openCustom}
              role="tab"
              aria-selected={customActive}
              data-testid="dash2026-range-custom"
              aria-label={t("customRange", { defaultValue: "Custom range" })}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <Icon name="calendar" size={14} />
              {customLabel}
            </PillButton>
          </Box>

          <GhostIconButton
            data-testid="dash2026-settings"
            aria-label={t("dashboardSettings", { defaultValue: "Dashboard settings" })}
            onClick={(e) => setSettingsAnchor(e.currentTarget)}
          >
            <Icon name="sliders-horizontal" size={18} />
          </GhostIconButton>
        </Box>
      </Box>

      {/* Main row: number + delta + metric dropdown / primary CTA */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            data-testid="dash2026-hero-value"
            sx={{
              fontFamily: MONO,
              fontVariantNumeric: "tabular-nums",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              color: primaryInk,
              fontSize: isCompact
                ? { xs: 32, sm: 38, md: 44 }
                : { xs: 34, sm: 42, md: 52, lg: 56 },
            }}
          >
            {showSkeleton ? (
              <Skeleton width={280} height={60} />
            ) : (
              <>
                {big}
                {suffix && (
                  <Box
                    component="span"
                    sx={{ fontSize: "0.42em", fontWeight: 400, color: muted, ml: 1, verticalAlign: "middle" }}
                  >
                    {suffix}
                  </Box>
                )}
              </>
            )}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
            {showSkeleton ? (
              <Skeleton width={180} height={18} />
            ) : (
              <>
                {(metric !== "period" || hasPeriodDelta) && (
                  <DeltaChip positive={positive} data-testid="dash2026-hero-delta" sx={{ fontSize: 13.5 }}>
                    <Icon name={positive ? "arrow-up" : "arrow-down"} size={13} />
                    {toFixedStr(Math.abs(activeDelta), 2)}%
                  </DeltaChip>
                )}
                <Box
                  component="span"
                  data-testid="dash2026-hero-subline"
                  sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: muted }}
                >
                  {metric === "period"
                    ? (t("periodVsPrevious", {
                        defaultValue: "vs previous period · {count} payments",
                      }) as string).replace("{count}", String(periodTxCount))
                    : metric === "lifetime"
                      ? t("vsLastMonth", { defaultValue: "vs previous period" })
                      : t("vsYesterday", { defaultValue: "vs yesterday" })}
                </Box>
              </>
            )}
          </Box>

          {/* Move 6 (clarity microcopy): one plain-English line that reads the
              day for the merchant; hidden when there is nothing to say. */}
          {!showSkeleton && insight && (
            <Box
              component="p"
              data-testid="dash2026-hero-insight"
              sx={{
                m: 0,
                mt: 0.75,
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                color: muted,
              }}
            >
              {insight}
            </Box>
          )}
        </Box>
      </Box>

      {/* Metric dropdown */}
      <Menu
        anchorEl={metricAnchor}
        open={Boolean(metricAnchor)}
        onClose={() => setMetricAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 190,
            borderRadius: "12px",
            border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
          },
        }}
      >
        {(Object.keys(metricLabels) as Metric[]).map((m) => (
          <MenuItem
            key={m}
            selected={metric === m}
            onClick={() => {
              setMetric(m);
              setMetricAnchor(null);
            }}
            data-testid={`dash2026-metric-${m}`}
            sx={{ fontFamily: "var(--font-sans)", fontSize: 14, py: 1 }}
          >
            {metricLabels[m]}
          </MenuItem>
        ))}
      </Menu>

      {/* Settings menu (theme + density) */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 236,
            borderRadius: "12px",
            border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
          },
        }}
      >
        <MenuItem
          onClick={() => toggleTheme()}
          data-testid="dash2026-toggle-theme"
          sx={{ fontFamily: "var(--font-sans)", fontSize: 14, py: 1.1 }}
        >
          {mode === "dark" ? (
            <Icon name="sun" size={18} style={{ marginRight: 12 }} />
          ) : (
            <Icon name="moon" size={18} style={{ marginRight: 12 }} />
          )}
          {mode === "dark"
            ? t("switchLight", { defaultValue: "Light mode" })
            : t("switchDark", { defaultValue: "Dark mode" })}
        </MenuItem>
        <MenuItem
          onClick={() => toggleDensity()}
          data-testid="dash2026-toggle-density"
          sx={{ fontFamily: "var(--font-sans)", fontSize: 14, py: 1.1 }}
        >
          {isCompact ? (
            <Icon name="rows-3" size={18} style={{ marginRight: 12 }} />
          ) : (
            <Icon name="rows-2" size={18} style={{ marginRight: 12 }} />
          )}
          {isCompact
            ? t("spaciousView", { defaultValue: "Spacious view" })
            : t("compactView", { defaultValue: "Compact view" })}
        </MenuItem>
      </Menu>

      {/* Custom date-range popover */}
      <Popover
        open={Boolean(customAnchor)}
        anchorEl={customAnchor}
        onClose={() => setCustomAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          sx: {
            mt: 1,
            p: 2,
            width: 280,
            borderRadius: "12px",
            border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}`,
          },
        }}
      >
        <Box
          sx={{
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 700,
            mb: 1.5,
            color: primaryInk,
          }}
        >
          {t("customRangeTitle", { defaultValue: "Custom date range" })}
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <TextField
            type="date"
            size="small"
            label={t("from", { defaultValue: "From" })}
            InputLabelProps={{ shrink: true }}
            value={draftStart}
            onChange={(e) => setDraftStart(e.target.value)}
            inputProps={{ max: draftEnd || today }}
            data-testid="dash2026-custom-start"
            sx={{
              "& input::-webkit-calendar-picker-indicator": {
                filter: isDark ? "invert(0.8)" : "none",
                cursor: "pointer",
              },
            }}
          />
          <TextField
            type="date"
            size="small"
            label={t("to", { defaultValue: "To" })}
            InputLabelProps={{ shrink: true }}
            value={draftEnd}
            onChange={(e) => setDraftEnd(e.target.value)}
            inputProps={{ min: draftStart, max: today }}
            data-testid="dash2026-custom-end"
            sx={{
              "& input::-webkit-calendar-picker-indicator": {
                filter: isDark ? "invert(0.8)" : "none",
                cursor: "pointer",
              },
            }}
          />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2, gap: 1 }}>
          {customActive ? (
            <Button
              size="small"
              onClick={() => {
                onCustomClear();
                setCustomAnchor(null);
              }}
              data-testid="dash2026-custom-clear"
              sx={{ textTransform: "none", fontFamily: "var(--font-sans)", color: muted }}
            >
              {t("clear", { defaultValue: "Clear" })}
            </Button>
          ) : (
            <Box />
          )}
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={applyCustom}
            disabled={!draftStart || !draftEnd || draftStart > draftEnd}
            data-testid="dash2026-custom-apply"
            sx={{
              textTransform: "none",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              borderRadius: 999,
              px: 2,
              background: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
              "&:hover": {
                background: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light,
                opacity: 0.9,
              },
            }}
          >
            {t("apply", { defaultValue: "Apply" })}
          </Button>
        </Box>
      </Popover>
    </SurfaceCard>
  );
};

export default BalanceStrip;
