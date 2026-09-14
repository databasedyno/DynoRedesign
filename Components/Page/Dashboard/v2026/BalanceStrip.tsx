import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Menu, MenuItem, Skeleton, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { useDashboardDensity } from "@/hooks/useDashboardDensity";
import { Icon, MONO } from "@/styles/uiKit";
import { SurfaceCard, DeltaChip, CB_TOKENS } from "../coinbase/styled";
import { GhostIconButton } from "./styled";
import { RangeId } from "./CommandBar";
import { toFixedStr } from "@/utils/money";
import { BalanceRangeControl } from "./BalanceRangeControl";
import { BalanceSettingsMenu, CustomRangePopover } from "./BalanceStripMenus";
import { ChartSummary, Metric, useBalanceHeadline } from "./useBalanceHeadline";

interface Props {
  stats: any;
  chartData: Array<{ date: string; value: number; transactionCount?: number }>;
  chartSummary?: ChartSummary | null;
  loading?: boolean;
  chartLoading?: boolean;
  rangeLabel: string;
  range: RangeId;
  onRangeChange: (r: RangeId) => void;
  custom?: { startDate: string; endDate: string } | null;
  onCustomApply: (startDate: string, endDate: string) => void;
  onCustomClear: () => void;
}

/**
 * BalanceStrip — P4 Row 1. The dashboard headline collapses into a single quiet
 * strip: the metric dropdown (This period / Lifetime / Today) on the left with
 * the range segmented control + settings on the right, then the big mono volume
 * number + delta line. The greeting moved up into the page H1 (Jun 2026 polish)
 * so this card carries numbers only.
 */
const BalanceStrip: React.FC<Props> = ({ stats, chartData, chartSummary, loading, chartLoading, rangeLabel, range, onRangeChange, custom, onCustomApply, onCustomClear }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation(["dashboardLayout", "common"]);
  const { isCompact } = useDashboardDensity();

  const [metric, setMetric] = useState<Metric>("period");
  const [metricAnchor, setMetricAnchor] = useState<null | HTMLElement>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  // Snap back to the range-driven metric whenever the active window changes.
  useEffect(() => {
    setMetric("period");
  }, [rangeLabel]);

  // ── Custom date-range picker ──
  const [customAnchor, setCustomAnchor] = useState<null | HTMLElement>(null);
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
  const customLabel = customActive && custom ? `${fmtDay(custom.startDate)} – ${fmtDay(custom.endDate)}` : t("customRange", { defaultValue: "Custom" });
  const openCustom = (anchor: HTMLElement) => {
    setDraftStart(custom?.startDate || defaultStart);
    setDraftEnd(custom?.endDate || today);
    setCustomAnchor(anchor);
  };
  const applyCustom = () => {
    if (draftStart && draftEnd && draftStart <= draftEnd) {
      onCustomApply(draftStart, draftEnd);
      setCustomAnchor(null);
    }
  };

  const { big, suffix, activeDelta, positive, showDelta, subline, insight, metricLabels } = useBalanceHeadline(metric, stats, chartData, chartSummary);
  const showSkeleton = loading || (metric === "period" && chartLoading);

  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const primaryInk = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;

  return (
    <SurfaceCard data-testid="dash2026-balance-strip" sx={{ ...(isCompact && { p: { xs: 1.75, md: 2 } }) }}>
      {/* Top row: metric dropdown + range control + settings */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: { xs: 1.5, md: 2 } }}>
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
            "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 4 },
          }}
        >
          {metricLabels[metric]}
        </Button>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <BalanceRangeControl isDark={isDark} range={range} customActive={customActive} customLabel={customLabel} onRangeChange={onRangeChange} onOpenCustom={openCustom} />
          <GhostIconButton
            data-testid="dash2026-settings"
            aria-label={t("dashboardSettings", { defaultValue: "Dashboard settings" })}
            onClick={(e) => setSettingsAnchor(e.currentTarget)}
          >
            <Icon name="sliders-horizontal" size={18} />
          </GhostIconButton>
        </Box>
      </Box>

      {/* Main row: number + delta */}
      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
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
              fontSize: isCompact ? { xs: 32, sm: 38, md: 44 } : { xs: 34, sm: 42, md: 52, lg: 56 },
            }}
          >
            {showSkeleton ? (
              <Skeleton width={280} height={60} />
            ) : (
              <>
                {big}
                {suffix && (
                  <Box component="span" sx={{ fontSize: "0.42em", fontWeight: 400, color: muted, ml: 1, verticalAlign: "middle" }}>
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
                {showDelta && (
                  <DeltaChip positive={positive} data-testid="dash2026-hero-delta" sx={{ fontSize: 13.5 }}>
                    <Icon name={positive ? "arrow-up" : "arrow-down"} size={13} />
                    {toFixedStr(Math.abs(activeDelta), 2)}%
                  </DeltaChip>
                )}
                <Box component="span" data-testid="dash2026-hero-subline" sx={{ fontFamily: "var(--font-sans)", fontSize: 13, color: muted }}>
                  {subline}
                </Box>
              </>
            )}
          </Box>

          {/* Move 6 (clarity microcopy): one plain-English line that reads the day for the merchant. */}
          {!showSkeleton && insight && (
            <Box component="p" data-testid="dash2026-hero-insight" sx={{ m: 0, mt: 0.75, fontFamily: "var(--font-sans)", fontSize: 13, color: muted }}>
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
        PaperProps={{ sx: { mt: 1, minWidth: 190, borderRadius: "12px", border: `1px solid ${isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light}` } }}
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

      <BalanceSettingsMenu anchor={settingsAnchor} onClose={() => setSettingsAnchor(null)} />
      <CustomRangePopover
        anchor={customAnchor}
        isDark={isDark}
        today={today}
        draftStart={draftStart}
        draftEnd={draftEnd}
        setDraftStart={setDraftStart}
        setDraftEnd={setDraftEnd}
        customActive={customActive}
        onApply={applyCustom}
        onClear={() => {
          onCustomClear();
          setCustomAnchor(null);
        }}
        onClose={() => setCustomAnchor(null)}
      />
    </SurfaceCard>
  );
};

export default BalanceStrip;
